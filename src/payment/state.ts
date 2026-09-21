import type { CheckoutQuote } from "../checkout/contracts";
import { uuid } from "../customer/contracts";
import { BridgeError } from "../webview/bridge";
import { PaymentError } from "./api";
import type { PaymentCreate, PaymentOrder, PaymentResult } from "./contracts";

type PaymentApiPort = {
  create(
    quoteId: string,
    quoteToken: string,
    idempotencyKey: string,
  ): Promise<PaymentCreate>;
  result(paymentIntentId: string): Promise<PaymentResult>;
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
};

const empty = (phase: PaymentState["phase"] = "idle"): PaymentState => ({
  phase,
  paymentIntentId: null,
  order: null,
  error: null,
  canRetryInitiation: false,
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
  private generation = 0;
  private readonly unsubscribeSession: () => void;
  private sessionPhase: string;

  constructor(
    private readonly api: PaymentApiPort,
    private readonly bridge: PaymentBridgePort,
    private readonly session: SessionPort,
    private readonly freezeQuote: (quoteId: string) => boolean,
    private readonly onRestart: () => void,
    private readonly now = Date.now,
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
      !["pending", "handoff-error"].includes(this.state.phase)
    )
      return;
    await this.openCheckout();
  }

  checkStatus(): Promise<void> {
    if (this.state.phase === "paid" || this.state.phase === "failed")
      return Promise.resolve();
    if (!this.state.paymentIntentId || !this.checkoutReference)
      return Promise.resolve();
    if (this.statusCheck) return this.statusCheck;
    this.statusCheck = this.executeStatus().finally(() => {
      this.statusCheck = null;
    });
    return this.statusCheck;
  }

  handleReturn(): Promise<void> {
    return this.checkStatus();
  }

  restart(): void {
    if (
      this.state.phase !== "failed" &&
      !(this.state.phase === "error" && !this.state.canRetryInitiation)
    )
      return;
    this.clearPayment();
    this.onRestart();
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
      const phase =
        result.status === "PENDING"
          ? "pending"
          : result.status === "FAILED"
            ? "failed"
            : result.status === "PAID_PROCESSING"
              ? "paid-processing"
              : "paid";
      this.update({
        ...empty(phase),
        paymentIntentId,
        order: phase === "paid" ? result.order : null,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      const code = codeOf(error);
      this.update({
        ...empty(
          code === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
        ),
        paymentIntentId:
          code === "CUSTOMER_SESSION_INVALID" ? null : paymentIntentId,
        error: code,
      });
      if (code === "CUSTOMER_SESSION_INVALID") this.clearPayment();
    }
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
  }

  private update(state: PaymentState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
