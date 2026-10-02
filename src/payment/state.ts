import type { CheckoutQuote } from "../checkout/contracts";
import { uuid } from "../customer/contracts";
import { BridgeError } from "../webview/bridge";
import { PaymentError } from "./api";
import {
  parsePaymentRetry,
  type PaymentCreate,
  type PaymentOrder,
  type PaymentResult,
  type PaymentRetry,
} from "./contracts";

type PaymentApiPort = {
  create(
    quoteId: string,
    quoteToken: string,
    idempotencyKey: string,
  ): Promise<PaymentCreate>;
  result(paymentIntentId: string): Promise<PaymentResult>;
  retry(paymentIntentId: string, idempotencyKey: string): Promise<PaymentRetry>;
};

type PaymentBridgePort = {
  requestPaymentHandoff(checkoutUrl: string): Promise<void>;
};

type SessionPort = {
  getSnapshot(): { phase: string };
  subscribe(listener: () => void): () => void;
};

type TrustedQuote = Pick<
  CheckoutQuote,
  "quoteId" | "quoteToken" | "quoteExpiresAt"
>;
type PaymentAttempt = {
  quoteId: string;
  quoteToken: string;
  key: string;
};

export type PaymentState = {
  phase:
    | "idle"
    | "ready"
    | "initiating"
    | "opening"
    | "pending"
    | "retryable-pending"
    | "retrying"
    | "handoff-error"
    | "checking"
    | "failed"
    | "paid-processing"
    | "paid"
    | "error"
    | "session-expired";
  paymentIntentId: string | null;
  order: PaymentOrder | null;
  error: string | null;
  canRetryInitiation: boolean;
  canRetryPayment: boolean;
};

const empty = (phase: PaymentState["phase"] = "idle"): PaymentState => ({
  phase,
  paymentIntentId: null,
  order: null,
  error: null,
  canRetryInitiation: false,
  canRetryPayment: false,
});

const uncertainCreateErrors = new Set([
  "NETWORK_ERROR",
  "REQUEST_TIMEOUT",
  "INVALID_RESPONSE",
  "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  "SAVT_PAYMENT_CREATE_FAILED",
]);

const codeOf = (error: unknown) =>
  error instanceof PaymentError
    ? error.code
    : error instanceof BridgeError
      ? `PAYMENT_HANDOFF_${error.kind.toUpperCase()}`
      : "INVALID_RESPONSE";

const validOrder = (order: PaymentOrder | null): order is PaymentOrder =>
  order !== null &&
  uuid(order.orderId) &&
  typeof order.orderNumber === "string" &&
  order.orderNumber.trim().length > 0 &&
  order.orderNumber.length <= 120 &&
  /^[A-Z][A-Z0-9_]{0,63}$/.test(order.status);

export class PaymentController {
  private state = empty();
  private readonly listeners = new Set<() => void>();
  private trustedQuote: TrustedQuote | null = null;
  private attempt: PaymentAttempt | null = null;
  private checkoutReference: string | null = null;
  private checkoutUrl: string | null = null;
  private statusCheck: Promise<void> | null = null;
  private returnObservation: Promise<void> | null = null;
  private retryAttempt: { paymentIntentId: string; key: string } | null = null;
  private returnedToCheckout = false;
  private returnChecksComplete = false;
  private paymentReceived = false;
  private retryUnavailable = false;
  private generation = 0;
  private readonly unsubscribeSession: () => void;
  private sessionPhase: string;

  constructor(
    private readonly api: PaymentApiPort,
    private readonly bridge: PaymentBridgePort,
    private readonly session: SessionPort,
    private readonly freezeQuote: (quoteId: string) => boolean,
    private readonly onRestart: (preserveBasket: boolean) => void,
    private readonly now = Date.now,
    private readonly newId = () => crypto.randomUUID(),
    private readonly waitForReturnCheck = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    this.sessionPhase = session.getSnapshot().phase;
    this.unsubscribeSession = session.subscribe(() => {
      const phase = session.getSnapshot().phase;
      if (this.sessionPhase === "authenticated" && phase !== "authenticated")
        this.clearForSessionLoss();
      this.sessionPhase = phase;
    });
  }

  getSnapshot = (): PaymentState => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  syncQuote(quote: CheckoutQuote | null, quotePhase: string): void {
    if (this.attempt || this.state.paymentIntentId) return;
    if (!quote || quotePhase !== "ready") {
      this.trustedQuote = null;
      this.update(empty());
      return;
    }
    this.trustedQuote = {
      quoteId: quote.quoteId,
      quoteToken: quote.quoteToken,
      quoteExpiresAt: quote.quoteExpiresAt,
    };
    if (Date.parse(quote.quoteExpiresAt) <= this.now()) {
      this.update({ ...empty("error"), error: "QUOTE_EXPIRED" });
      return;
    }
    this.update(empty("ready"));
  }

  async initiate(): Promise<void> {
    if (this.attempt && this.state.canRetryInitiation)
      return this.executeCreate(this.attempt);
    if (this.state.phase !== "ready" || !this.trustedQuote) return;
    if (Date.parse(this.trustedQuote.quoteExpiresAt) <= this.now()) {
      this.update({ ...empty("error"), error: "QUOTE_EXPIRED" });
      return;
    }
    if (!this.freezeQuote(this.trustedQuote.quoteId)) {
      this.update({ ...empty("error"), error: "QUOTE_NOT_READY" });
      return;
    }
    this.attempt = {
      quoteId: this.trustedQuote.quoteId,
      quoteToken: this.trustedQuote.quoteToken,
      key: this.newId(),
    };
    return this.executeCreate(this.attempt);
  }

  async reopen(): Promise<void> {
    if (
      !this.checkoutUrl ||
      !this.state.paymentIntentId ||
      this.state.phase !== "handoff-error"
    )
      return;
    await this.openCheckout();
  }

  checkStatus(): Promise<void> {
    if (
      this.returnedToCheckout &&
      !this.returnChecksComplete &&
      !this.returnObservation &&
      this.state.phase !== "failed"
    )
      return this.handleReturn();
    return this.checkCurrentStatus();
  }

  private checkCurrentStatus(): Promise<void> {
    if (this.state.phase === "paid" || this.state.phase === "retrying")
      return Promise.resolve();
    if (!this.state.paymentIntentId || !this.checkoutReference)
      return Promise.resolve();
    if (this.statusCheck) return this.statusCheck;
    const check = this.executeStatus().finally(() => {
      if (this.statusCheck === check) this.statusCheck = null;
    });
    this.statusCheck = check;
    return this.statusCheck;
  }

  handleReturn(): Promise<void> {
    if (this.returnObservation) return this.returnObservation;
    if (this.state.phase === "retrying") return Promise.resolve();
    if (!this.state.paymentIntentId) return Promise.resolve();
    const generation = this.generation;
    const paymentIntentId = this.state.paymentIntentId;
    this.returnedToCheckout = true;
    this.returnChecksComplete = false;
    const observe = async () => {
      for (let index = 0; index < 3; index += 1) {
        if (
          generation !== this.generation ||
          this.state.paymentIntentId !== paymentIntentId ||
          ["paid", "failed", "session-expired"].includes(this.state.phase)
        )
          return;
        if (index > 0) await this.waitForReturnCheck(index === 1 ? 750 : 1500);
        if (
          generation !== this.generation ||
          this.state.paymentIntentId !== paymentIntentId ||
          ["paid", "failed", "session-expired"].includes(this.state.phase)
        )
          return;
        await this.checkCurrentStatus();
        if (!["pending", "paid-processing"].includes(this.state.phase)) return;
      }
      this.returnChecksComplete = true;
      if (
        generation === this.generation &&
        this.state.paymentIntentId === paymentIntentId &&
        this.state.phase === "pending"
      ) {
        this.returnedToCheckout = true;
        this.checkoutUrl = null;
        this.update({
          ...empty("retryable-pending"),
          paymentIntentId,
          canRetryPayment: !this.paymentReceived,
        });
      }
    };
    const observation = observe().finally(() => {
      if (this.returnObservation === observation) this.returnObservation = null;
    });
    this.returnObservation = observation;
    return this.returnObservation;
  }

  async retryPayment(): Promise<void> {
    if (
      !this.state.paymentIntentId ||
      !this.checkoutReference ||
      this.statusCheck ||
      this.returnObservation ||
      this.paymentReceived ||
      this.retryUnavailable ||
      (!["retryable-pending", "failed"].includes(this.state.phase) &&
        !this.state.canRetryPayment)
    )
      return;
    const generation = this.generation;
    const checkoutReference = this.checkoutReference;
    const paymentIntentId = this.state.paymentIntentId;
    const attempt = this.retryAttempt ?? { paymentIntentId, key: this.newId() };
    this.retryAttempt = attempt;
    this.checkoutUrl = null;
    this.update({ ...empty("retrying"), paymentIntentId });
    try {
      // Validate again at the controller boundary, including injected API ports.
      const response = parsePaymentRetry({
        data: await this.api.retry(attempt.paymentIntentId, attempt.key),
      });
      if (generation !== this.generation) return;
      if (response.checkoutReference !== checkoutReference)
        throw new PaymentError("INVALID_RESPONSE");
      this.retryAttempt = null;
      if ("payment" in response) {
        this.checkoutReference = response.checkoutReference;
        this.checkoutUrl =
          response.payment.status === "PENDING"
            ? (response.payment.checkoutUrl ?? null)
            : null;
        const activeIntent = response.payment.paymentIntentId;
        this.returnedToCheckout = !this.checkoutUrl;
        this.returnChecksComplete = true;
        this.update({
          ...empty(
            response.payment.status === "FAILED"
              ? "failed"
              : this.checkoutUrl
                ? "opening"
                : "retryable-pending",
          ),
          paymentIntentId: activeIntent,
          canRetryPayment: !this.checkoutUrl,
        });
        if (this.checkoutUrl) await this.openCheckout();
      } else {
        this.returnedToCheckout = true;
        this.returnChecksComplete = true;
        this.applyResult(response, paymentIntentId);
      }
    } catch (error) {
      if (generation !== this.generation) return;
      const code = codeOf(error);
      // Keep the exact source intent/key across transport uncertainty and invalid evidence.
      // Invalid evidence offers status checking only; a later valid observation may recover.
      const canRetryPayment =
        uncertainCreateErrors.has(code) && code !== "INVALID_RESPONSE";
      if (code === "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED")
        this.retryUnavailable = true;
      this.update({
        ...empty(
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        ),
        paymentIntentId:
          code === "CUSTOMER_SESSION_INVALID" ? null : paymentIntentId,
        error: code,
        canRetryPayment,
      });
      if (code === "CUSTOMER_SESSION_INVALID") this.clearPayment();
    }
  }

  restart(): void {
    if (this.paymentReceived) return;
    const confirmedFailed = this.state.phase === "failed" && !this.retryAttempt;
    const voucherUnsupported =
      this.state.phase === "error" &&
      this.state.error === "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED";
    const rejectedBeforeIntent =
      this.state.phase === "error" &&
      !this.state.canRetryInitiation &&
      !this.state.paymentIntentId &&
      !this.attempt;
    if (!confirmedFailed && !rejectedBeforeIntent && !voucherUnsupported)
      return;
    this.clearPayment();
    this.onRestart(true);
    this.update(empty());
  }

  finishPaidOrder(): void {
    if (this.state.phase !== "paid") return;
    this.clearPayment();
    this.onRestart(false);
    this.update(empty());
  }

  dispose(): void {
    this.unsubscribeSession();
    this.listeners.clear();
    this.clearPayment();
    this.state = empty();
  }

  private async executeCreate(attempt: PaymentAttempt): Promise<void> {
    const generation = this.generation;
    this.update({
      ...empty("initiating"),
      canRetryInitiation: false,
    });
    try {
      const created = await this.api.create(
        attempt.quoteId,
        attempt.quoteToken,
        attempt.key,
      );
      if (generation !== this.generation) return;
      if (created.checkoutReference !== attempt.quoteId)
        throw new PaymentError("INVALID_RESPONSE");
      this.checkoutReference = created.checkoutReference;
      this.checkoutUrl = created.payment.checkoutUrl;
      this.attempt = null;
      this.trustedQuote = null;
      this.update({
        ...empty(created.payment.status === "FAILED" ? "failed" : "opening"),
        paymentIntentId: created.payment.paymentIntentId,
      });
      if (created.payment.status === "PENDING") await this.openCheckout();
    } catch (error) {
      if (generation !== this.generation) return;
      const code = codeOf(error);
      const canRetryInitiation = uncertainCreateErrors.has(code);
      if (!canRetryInitiation) {
        this.attempt = null;
        this.trustedQuote = null;
      }
      this.update({
        ...empty(
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        ),
        error: code,
        canRetryInitiation,
      });
    }
  }

  private async openCheckout(): Promise<void> {
    if (!this.checkoutUrl || !this.state.paymentIntentId) return;
    const generation = this.generation;
    const paymentIntentId = this.state.paymentIntentId;
    this.returnedToCheckout = false;
    this.returnChecksComplete = false;
    this.update({
      ...empty("opening"),
      paymentIntentId,
    });
    try {
      await this.bridge.requestPaymentHandoff(this.checkoutUrl);
      if (
        generation !== this.generation ||
        this.state.phase !== "opening" ||
        this.state.paymentIntentId !== paymentIntentId
      )
        return;
      this.update({ ...empty("pending"), paymentIntentId });
    } catch (error) {
      if (
        generation !== this.generation ||
        this.state.phase !== "opening" ||
        this.state.paymentIntentId !== paymentIntentId
      )
        return;
      this.update({
        ...empty("handoff-error"),
        paymentIntentId,
        error: codeOf(error),
      });
    }
  }

  private async executeStatus(): Promise<void> {
    const paymentIntentId = this.state.paymentIntentId;
    const checkoutReference = this.checkoutReference;
    if (!paymentIntentId || !checkoutReference) return;
    const generation = this.generation;
    this.update({ ...empty("checking"), paymentIntentId });
    try {
      const result = await this.api.result(paymentIntentId);
      if (generation !== this.generation) return;
      if (result.checkoutReference !== checkoutReference)
        throw new PaymentError("INVALID_RESPONSE");
      if (result.status === "PAID" && !validOrder(result.order))
        throw new PaymentError("INVALID_RESPONSE");
      if (result.status !== "PAID" && result.order !== null)
        throw new PaymentError("INVALID_RESPONSE");
      this.applyResult(result, paymentIntentId);
    } catch (error) {
      if (generation !== this.generation) return;
      const code = codeOf(error);
      this.update({
        ...empty(
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        ),
        paymentIntentId:
          code === "CUSTOMER_SESSION_INVALID" ? null : paymentIntentId,
        error:
          code === "CUSTOMER_SESSION_INVALID"
            ? code
            : this.retryUnavailable
              ? "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED"
              : code,
      });
      if (code === "CUSTOMER_SESSION_INVALID") this.clearPayment();
    }
  }

  private applyResult(result: PaymentResult, paymentIntentId: string): void {
    // Receipt of payment is monotonic; stale observations cannot make it chargeable again.
    if (["PAID", "PAID_PROCESSING"].includes(result.status))
      this.paymentReceived = true;
    const phase =
      result.status === "PAID"
        ? "paid"
        : this.paymentReceived
          ? "paid-processing"
          : this.retryUnavailable
            ? "error"
            : result.status === "FAILED"
              ? this.retryAttempt
                ? "error"
                : "failed"
              : this.returnedToCheckout && this.returnChecksComplete
                ? "retryable-pending"
                : "pending";
    if (this.paymentReceived) {
      this.retryAttempt = null;
      this.retryUnavailable = false;
    }
    this.update({
      ...empty(phase),
      paymentIntentId,
      order: phase === "paid" ? result.order : null,
      error:
        phase === "error" && this.retryUnavailable
          ? "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED"
          : null,
      canRetryPayment:
        ["retryable-pending", "failed"].includes(phase) ||
        (phase === "error" && !!this.retryAttempt && !this.retryUnavailable),
    });
  }

  private clearForSessionLoss(): void {
    this.clearPayment();
    this.update(empty("session-expired"));
  }

  private clearPayment(): void {
    ++this.generation;
    this.trustedQuote = null;
    this.attempt = null;
    this.checkoutReference = null;
    this.checkoutUrl = null;
    this.statusCheck = null;
    this.returnObservation = null;
    this.retryAttempt = null;
    this.returnedToCheckout = false;
    this.returnChecksComplete = false;
    this.paymentReceived = false;
    this.retryUnavailable = false;
  }

  private update(state: PaymentState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
