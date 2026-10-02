import { OrdersError } from "./api";
import type { OrderDetail, OrderPage, OrderDocuments } from "./contracts";

type OrdersPort = {
  list(
    page?: number,
    pageSize?: number,
    signal?: AbortSignal,
  ): Promise<OrderPage>;
  detail(orderId: string, signal?: AbortSignal): Promise<OrderDetail>;
  documents(orderId: string, signal?: AbortSignal): Promise<OrderDocuments>;
  downloadPaymentReceipt(
    orderId: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Blob>;
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
  receiptPhase: "idle" | "downloading" | "ready" | "error";
  receiptError: string | null;
  documentsPhase: Phase;
  documents: OrderDocuments | null;
  documentsError: string | null;
  paymentReceiptPhase: "idle" | "downloading" | "ready" | "error";
  paymentReceiptError: string | null;
};
export type ReceiptDownload = { blob: Blob; filename: string };

const empty = (sessionExpired = false): OrdersState => ({
  listPhase: sessionExpired ? "session-expired" : "idle",
  page: null,
  listError: sessionExpired ? "CUSTOMER_SESSION_INVALID" : null,
  detailPhase: sessionExpired ? "session-expired" : "idle",
  detail: null,
  detailError: sessionExpired ? "CUSTOMER_SESSION_INVALID" : null,
  receiptPhase: "idle",
  receiptError: null,
  documentsPhase: "idle",
  documents: null,
  documentsError: null,
  paymentReceiptPhase: "idle",
  paymentReceiptError: null,
});
const codeOf = (error: unknown) =>
  error instanceof OrdersError ? error.code : "INVALID_RESPONSE";

export class OrdersController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private listGeneration = 0;
  private detailGeneration = 0;
  private receiptGeneration = 0;
  private documentsGeneration = 0;
  private paymentReceiptGeneration = 0;
  private documentsAbort?: AbortController;
  private paymentReceiptAbort?: AbortController;
  private listAbort?: AbortController;
  private detailAbort?: AbortController;
  private receiptAbort?: AbortController;
  private readonly unsubscribeSession: () => void;
  private sessionPhase: string;

  constructor(
    private readonly api: OrdersPort,
    private readonly session: SessionPort,
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
    this.abortDocuments();
    this.receiptAbort?.abort();
    ++this.receiptGeneration;
    const abort = new AbortController();
    this.detailAbort = abort;
    const generation = ++this.detailGeneration;
    this.update({
      detailPhase: "loading",
      detail: null,
      detailError: null,
      receiptPhase: "idle",
      receiptError: null,
      documentsPhase: "idle",
      documents: null,
      documentsError: null,
      paymentReceiptPhase: "idle",
      paymentReceiptError: null,
    });
    try {
      const result = await this.api.detail(orderId, abort.signal);
      if (generation !== this.detailGeneration) return;
      if (result.orderId !== orderId) throw new OrdersError("INVALID_RESPONSE");
      this.update({ detailPhase: "ready", detail: result, detailError: null });
      await this.refreshDocuments();
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
    this.abortDocuments();
    this.receiptAbort?.abort();
    ++this.detailGeneration;
    ++this.receiptGeneration;
    this.update({
      detailPhase: "idle",
      detail: null,
      detailError: null,
      receiptPhase: "idle",
      receiptError: null,
      documentsPhase: "idle",
      documents: null,
      documentsError: null,
      paymentReceiptPhase: "idle",
      paymentReceiptError: null,
    });
  }

  async refreshDocuments(): Promise<void> {
    const orderId = this.state.detail?.orderId;
    if (!orderId) return;
    this.abortDocuments();
    const abort = new AbortController();
    this.documentsAbort = abort;
    const generation = ++this.documentsGeneration;
    this.update({
      documentsPhase: "loading",
      documents: null,
      documentsError: null,
      paymentReceiptPhase: "idle",
      paymentReceiptError: null,
    });
    try {
      const documents = await this.api.documents(orderId, abort.signal);
      if (
        generation !== this.documentsGeneration ||
        this.state.detail?.orderId !== orderId
      )
        return;
      if (documents.orderId !== orderId)
        throw new OrdersError("INVALID_RESPONSE");
      this.update({ documentsPhase: "ready", documents, documentsError: null });
    } catch (error) {
      if (generation !== this.documentsGeneration) return;
      const code = codeOf(error);
      if (code === "CUSTOMER_SESSION_INVALID") {
        this.clearForSessionLoss();
        return;
      }
      this.update({
        documentsPhase: "error",
        documents: null,
        documentsError: code,
      });
    }
  }

  async downloadPaymentReceipt(): Promise<ReceiptDownload | null> {
    const detail = this.state.detail;
    const documents = this.state.documents;
    const receipt = documents?.paymentReceipt;
    if (
      !detail ||
      this.state.documentsPhase !== "ready" ||
      documents?.orderId !== detail.orderId ||
      !documents.paymentReceiptAvailable ||
      !receipt ||
      this.state.paymentReceiptPhase === "downloading"
    )
      return null;
    this.paymentReceiptAbort?.abort();
    const abort = new AbortController();
    this.paymentReceiptAbort = abort;
    const generation = ++this.paymentReceiptGeneration;
    this.update({
      paymentReceiptPhase: "downloading",
      paymentReceiptError: null,
    });
    try {
      const blob = await this.api.downloadPaymentReceipt(
        detail.orderId,
        receipt.downloadPath,
        abort.signal,
      );
      if (
        generation !== this.paymentReceiptGeneration ||
        this.state.detail?.orderId !== detail.orderId
      )
        return null;
      this.update({ paymentReceiptPhase: "ready", paymentReceiptError: null });
      return {
        blob,
        filename: `CKS-Go-Payment-Receipt-${receipt.receiptReference.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`,
      };
    } catch (error) {
      if (generation !== this.paymentReceiptGeneration) return null;
      const code = codeOf(error);
      if (code === "CUSTOMER_SESSION_INVALID") {
        this.clearForSessionLoss();
        return null;
      }
      this.update({ paymentReceiptPhase: "error", paymentReceiptError: code });
      return null;
    }
  }

  reportReceiptSaveFailure(paymentReceipt: boolean): void {
    if (!this.state.detail) return;
    this.update(
      paymentReceipt
        ? {
            paymentReceiptPhase: "error",
            paymentReceiptError: "DOWNLOAD_FAILED",
          }
        : { receiptPhase: "error", receiptError: "DOWNLOAD_FAILED" },
    );
  }

  private abortDocuments(): void {
    ++this.documentsGeneration;
    ++this.paymentReceiptGeneration;
    this.documentsAbort?.abort();
    this.paymentReceiptAbort?.abort();
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
    this.state = empty(true);
    this.emit();
  }
  private abortAll(): void {
    ++this.listGeneration;
    ++this.detailGeneration;
    ++this.receiptGeneration;
    this.listAbort?.abort();
    this.detailAbort?.abort();
    this.abortDocuments();
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
