import { OrdersError } from "./api";
import type { CancellationResult, OrderDetail, OrderPage } from "./contracts";

type OrdersPort = {
  list(
    page?: number,
    pageSize?: number,
    signal?: AbortSignal,
  ): Promise<OrderPage>;
  detail(orderId: string, signal?: AbortSignal): Promise<OrderDetail>;
  cancel(
    orderId: string,
    key: string,
    signal?: AbortSignal,
  ): Promise<CancellationResult>;
  downloadReceipt(
    orderId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Blob>;
};
type SessionPort = {
  getSnapshot(): { phase: string };
  subscribe(listener: () => void): () => void;
};
type Phase = "idle" | "loading" | "ready" | "error" | "session-expired";
export type OrdersState = {
  listPhase: Phase;
  page: OrderPage | null;
  listError: string | null;
  detailPhase: Phase;
  detail: OrderDetail | null;
  detailError: string | null;
  cancelPhase: "idle" | "cancelling" | "succeeded" | "error";
  cancelError: string | null;
  canRetryCancellation: boolean;
  receiptPhase: "idle" | "downloading" | "ready" | "error";
  receiptError: string | null;
};
export type ReceiptDownload = { blob: Blob; filename: string };
type CancellationAttempt = { orderId: string; key: string };

const empty = (sessionExpired = false): OrdersState => ({
  listPhase: sessionExpired ? "session-expired" : "idle",
  page: null,
  listError: sessionExpired ? "CUSTOMER_SESSION_INVALID" : null,
  detailPhase: sessionExpired ? "session-expired" : "idle",
  detail: null,
  detailError: sessionExpired ? "CUSTOMER_SESSION_INVALID" : null,
  cancelPhase: "idle",
  cancelError: null,
  canRetryCancellation: false,
  receiptPhase: "idle",
  receiptError: null,
});
const uncertainCancellation = new Set([
  "NETWORK_ERROR",
  "REQUEST_TIMEOUT",
  "INVALID_RESPONSE",
]);
const codeOf = (error: unknown) =>
  error instanceof OrdersError ? error.code : "INVALID_RESPONSE";

export class OrdersController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private listGeneration = 0;
  private detailGeneration = 0;
  private cancellationGeneration = 0;
  private receiptGeneration = 0;
  private listAbort?: AbortController;
  private detailAbort?: AbortController;
  private cancellationAbort?: AbortController;
  private receiptAbort?: AbortController;
  private cancellation?: CancellationAttempt;
  private readonly unsubscribeSession: () => void;
  private sessionPhase: string;

  constructor(
    private readonly api: OrdersPort,
    private readonly session: SessionPort,
    private readonly newId = () => crypto.randomUUID(),
  ) {
    this.sessionPhase = session.getSnapshot().phase;
    this.unsubscribeSession = session.subscribe(() => {
      const phase = session.getSnapshot().phase;
      if (this.sessionPhase === "authenticated" && phase !== "authenticated")
        this.clearForSessionLoss();
      this.sessionPhase = phase;
    });
  }

  getSnapshot = (): OrdersState => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async load(
    page = this.state.page?.meta.page ?? 1,
    pageSize = this.state.page?.meta.pageSize ?? 25,
  ): Promise<void> {
    this.listAbort?.abort();
    const abort = new AbortController();
    this.listAbort = abort;
    const generation = ++this.listGeneration;
    this.update({ listPhase: "loading", listError: null });
    try {
      const result = await this.api.list(page, pageSize, abort.signal);
      if (generation !== this.listGeneration) return;
      this.update({ listPhase: "ready", page: result, listError: null });
    } catch (error) {
      if (generation !== this.listGeneration) return;
      const code = codeOf(error);
      this.update({
        listPhase:
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        listError: code,
        ...(code === "CUSTOMER_SESSION_INVALID" ? { page: null } : {}),
      });
    }
  }

  refresh(): Promise<void> {
    return this.load();
  }
  nextPage(): Promise<void> {
    const meta = this.state.page?.meta;
    return meta && meta.page < meta.totalPages
      ? this.load(meta.page + 1, meta.pageSize)
      : Promise.resolve();
  }
  previousPage(): Promise<void> {
    const meta = this.state.page?.meta;
    return meta && meta.page > 1
      ? this.load(meta.page - 1, meta.pageSize)
      : Promise.resolve();
  }

  async open(orderId: string): Promise<void> {
    this.detailAbort?.abort();
    this.cancellationAbort?.abort();
    this.receiptAbort?.abort();
    ++this.cancellationGeneration;
    ++this.receiptGeneration;
    this.cancellation = undefined;
    const abort = new AbortController();
    this.detailAbort = abort;
    const generation = ++this.detailGeneration;
    this.update({
      detailPhase: "loading",
      detail: null,
      detailError: null,
      cancelPhase: "idle",
      cancelError: null,
      canRetryCancellation: false,
      receiptPhase: "idle",
      receiptError: null,
    });
    try {
      const result = await this.api.detail(orderId, abort.signal);
      if (generation !== this.detailGeneration) return;
      if (result.orderId !== orderId) throw new OrdersError("INVALID_RESPONSE");
      this.update({ detailPhase: "ready", detail: result, detailError: null });
    } catch (error) {
      if (generation !== this.detailGeneration) return;
      const code = codeOf(error);
      this.update({
        detailPhase:
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        detail: null,
        detailError: code,
      });
    }
  }

  closeDetail(): void {
    this.detailAbort?.abort();
    this.cancellationAbort?.abort();
    this.receiptAbort?.abort();
    ++this.detailGeneration;
    ++this.cancellationGeneration;
    ++this.receiptGeneration;
    this.cancellation = undefined;
    this.update({
      detailPhase: "idle",
      detail: null,
      detailError: null,
      cancelPhase: "idle",
      cancelError: null,
      canRetryCancellation: false,
      receiptPhase: "idle",
      receiptError: null,
    });
  }

  cancel(): Promise<void> {
    const detail = this.state.detail;
    if (
      !detail ||
      !detail.canCancel ||
      this.cancellation ||
      this.state.cancelPhase === "cancelling"
    )
      return Promise.resolve();
    this.cancellation = { orderId: detail.orderId, key: this.newId() };
    return this.executeCancellation(this.cancellation);
  }
  retryCancellation(): Promise<void> {
    return this.cancellation && this.state.canRetryCancellation
      ? this.executeCancellation(this.cancellation)
      : Promise.resolve();
  }
  private async executeCancellation(
    attempt: CancellationAttempt,
  ): Promise<void> {
    this.cancellationAbort?.abort();
    const abort = new AbortController();
    this.cancellationAbort = abort;
    const generation = ++this.cancellationGeneration;
    this.update({
      cancelPhase: "cancelling",
      cancelError: null,
      canRetryCancellation: false,
    });
    try {
      const result = await this.api.cancel(
        attempt.orderId,
        attempt.key,
        abort.signal,
      );
      if (generation !== this.cancellationGeneration) return;
      if (
        result.orderId !== attempt.orderId ||
        this.state.detail?.orderId !== attempt.orderId
      )
        throw new OrdersError("INVALID_RESPONSE");
      this.cancellation = undefined;
      const current = this.state.detail;
      const detail: OrderDetail = {
        ...current,
        customerStage: "CANCELLED",
        cancellationKind: "CUSTOMER_REQUEST",
        canCancel: false,
        milestones: { ...current.milestones, cancelledAt: result.cancelledAt },
        refund: {
          refundRequired: true,
          requiredAmountMinor: result.requiredAmountMinor,
          totalRequiredAmountMinor: result.requiredAmountMinor,
          requirementStatus: "REQUIRED",
        },
      };
      const page = this.state.page
        ? {
            ...this.state.page,
            data: this.state.page.data.map((order) =>
              order.orderId === result.orderId
                ? {
                    ...order,
                    customerStage: "CANCELLED" as const,
                    canCancel: false,
                  }
                : order,
            ),
          }
        : null;
      this.update({
        detail,
        page,
        cancelPhase: "succeeded",
        cancelError: null,
        canRetryCancellation: false,
      });
    } catch (error) {
      if (generation !== this.cancellationGeneration) return;
      const code = codeOf(error);
      const retry = uncertainCancellation.has(code);
      if (!retry) this.cancellation = undefined;
      this.update({
        cancelPhase: "error",
        cancelError: code,
        canRetryCancellation: retry,
      });
    }
  }

  async downloadReceipt(): Promise<ReceiptDownload | null> {
    const detail = this.state.detail;
    const path = detail?.receipt.downloadPath;
    const reference = detail?.receipt.receiptReference;
    if (
      !detail ||
      !detail.receipt.receiptAvailable ||
      !path ||
      !reference ||
      this.state.receiptPhase === "downloading"
    )
      return null;
    this.receiptAbort?.abort();
    const abort = new AbortController();
    this.receiptAbort = abort;
    const generation = ++this.receiptGeneration;
    this.update({ receiptPhase: "downloading", receiptError: null });
    try {
      const blob = await this.api.downloadReceipt(
        detail.orderId,
        path,
        abort.signal,
      );
      if (
        generation !== this.receiptGeneration ||
        this.state.detail?.orderId !== detail.orderId
      )
        return null;
      this.update({ receiptPhase: "ready", receiptError: null });
      return {
        blob,
        filename: `CKS-Go-Receipt-${reference.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`,
      };
    } catch (error) {
      if (generation !== this.receiptGeneration) return null;
      const code = codeOf(error);
      this.update({ receiptPhase: "error", receiptError: code });
      return null;
    }
  }

  dispose(): void {
    this.unsubscribeSession();
    this.abortAll();
    this.listeners.clear();
    this.state = empty();
  }

  private clearForSessionLoss(): void {
    this.abortAll();
    this.cancellation = undefined;
    this.state = empty(true);
    this.emit();
  }
  private abortAll(): void {
    ++this.listGeneration;
    ++this.detailGeneration;
    ++this.cancellationGeneration;
    ++this.receiptGeneration;
    this.listAbort?.abort();
    this.detailAbort?.abort();
    this.cancellationAbort?.abort();
    this.receiptAbort?.abort();
  }
  private update(patch: Partial<OrdersState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }
  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
