import { describe, expect, it, vi } from "vitest";
import type { CheckoutQuote } from "../checkout/contracts";
import { BridgeError } from "../webview/bridge";
import { PaymentError } from "./api";
import type { PaymentCreate, PaymentResult, PaymentRetry } from "./contracts";
import { PaymentController } from "./state";

const quoteId = "10000000-0000-4000-8000-000000000001";
const paymentIntentId = "20000000-0000-4000-8000-000000000002";
const key = "30000000-0000-4000-8000-000000000003";
const retryKey = "30000000-0000-4000-8000-000000000004";
const successor = "20000000-0000-4000-8000-000000000003";
const newCheckoutUrl = "https://payments.example.test/checkout/successor";
const orderId = "40000000-0000-4000-8000-000000000004";
const checkoutUrl = "https://payments.example.test/checkout/approved";
const now = Date.parse("2026-09-21T02:00:00.000Z");

const quote = (expiresAt = "2026-09-21T02:10:00.000Z") =>
  ({
    quoteId,
    quoteToken: "Q".repeat(43),
    quoteExpiresAt: expiresAt,
  }) as CheckoutQuote;

const pendingCreate: PaymentCreate = {
  checkoutReference: quoteId,
  payment: { paymentIntentId, status: "PENDING", checkoutUrl },
};

const result = (
  status: PaymentResult["status"],
  overrides: Partial<PaymentResult> = {},
): PaymentResult => ({
  checkoutReference: quoteId,
  status,
  order:
    status === "PAID"
      ? { orderId, orderNumber: "ORD-2026-0001", status: "CONFIRMED" }
      : null,
  ...overrides,
});

class SessionFixture {
  private phase = "authenticated";
  private readonly listeners = new Set<() => void>();
  getSnapshot = () => ({ phase: this.phase });
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(phase: string) {
    this.phase = phase;
    this.listeners.forEach((listener) => listener());
  }
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
};

const fixture = (
  waitForReturnCheck: (ms: number) => Promise<void> = async () => {},
) => {
  const api = {
    create: vi
      .fn<
        (
          quoteId: string,
          quoteToken: string,
          idempotencyKey: string,
        ) => Promise<PaymentCreate>
      >()
      .mockResolvedValue(pendingCreate),
    result: vi
      .fn<(paymentIntentId: string) => Promise<PaymentResult>>()
      .mockResolvedValue(result("PENDING")),
    retry: vi
      .fn<(intent: string, key: string) => Promise<PaymentRetry>>()
      .mockResolvedValue({
        checkoutReference: quoteId,
        payment: {
          paymentIntentId: successor,
          status: "PENDING",
          checkoutUrl: newCheckoutUrl,
        },
      }),
  };
  const bridge = {
    requestPaymentHandoff: vi.fn<(url: string) => Promise<void>>(),
  };
  const session = new SessionFixture();
  const freeze = vi.fn(() => true);
  const restart = vi.fn();
  const newId = vi.fn().mockReturnValueOnce(key).mockReturnValue(retryKey);
  const controller = new PaymentController(
    api,
    bridge,
    session,
    freeze,
    restart,
    () => now,
    newId,
    waitForReturnCheck,
  );
  controller.syncQuote(quote(), "ready");
  return { api, bridge, session, freeze, restart, controller, newId };
};

describe("PaymentController", () => {
  it.each(["PENDING", "PAID"] as const)(
    "ignores an old third return GET while a new checkout observes %s",
    async (newResult) => {
      const wait = vi
        .fn<(ms: number) => Promise<void>>()
        .mockResolvedValue(undefined);
      const { api, bridge, session, controller } = fixture(wait);
      const oldThirdRead = deferred<PaymentResult>();
      api.result
        .mockResolvedValueOnce(result("PENDING"))
        .mockResolvedValueOnce(result("PENDING"))
        .mockReturnValueOnce(oldThirdRead.promise);
      await controller.initiate();
      const oldObservation = controller.handleReturn();
      await vi.waitFor(() => expect(api.result).toHaveBeenCalledTimes(3));

      session.set("expired");
      expect(controller.getSnapshot()).toMatchObject({
        phase: "session-expired",
        paymentIntentId: null,
        order: null,
        canRetryPayment: false,
      });
      session.set("authenticated");
      const nextQuote = {
        ...quote(),
        quoteId: "10000000-0000-4000-8000-000000000002",
      };
      api.create.mockResolvedValueOnce({
        checkoutReference: nextQuote.quoteId,
        payment: {
          paymentIntentId: successor,
          status: "PENDING",
          checkoutUrl: newCheckoutUrl,
        },
      });
      controller.syncQuote(nextQuote, "ready");
      await controller.initiate();
      api.result
        .mockResolvedValueOnce(
          result("PENDING", { checkoutReference: nextQuote.quoteId }),
        )
        .mockResolvedValueOnce(
          result("PENDING", { checkoutReference: nextQuote.quoteId }),
        )
        .mockResolvedValueOnce(
          result(newResult, { checkoutReference: nextQuote.quoteId }),
        );
      const newSequenceDelay = deferred<void>();
      wait.mockReturnValueOnce(newSequenceDelay.promise);
      const newObservation = controller.handleReturn();
      await vi.waitFor(() => {
        expect(wait).toHaveBeenCalledTimes(3);
        expect(controller.getSnapshot().phase).toBe("pending");
      });
      const beforeStaleCompletion = controller.getSnapshot();
      const changes = vi.fn();
      const unsubscribe = controller.subscribe(changes);
      oldThirdRead.resolve(result("PENDING"));
      await oldObservation;
      expect(controller.getSnapshot()).toBe(beforeStaleCompletion);
      expect(controller.getSnapshot()).toMatchObject({
        phase: "pending",
        paymentIntentId: successor,
        error: null,
        order: null,
        canRetryPayment: false,
      });
      expect(changes).not.toHaveBeenCalled();
      expect(controller.handleReturn()).toBe(newObservation);
      expect(api.result).toHaveBeenCalledTimes(4);
      newSequenceDelay.resolve();
      await newObservation;

      expect(api.result.mock.calls.map(([intent]) => intent)).toEqual([
        paymentIntentId,
        paymentIntentId,
        paymentIntentId,
        successor,
        successor,
        successor,
      ]);
      expect(wait.mock.calls.map(([ms]) => ms)).toEqual([750, 1500, 750, 1500]);
      expect(controller.getSnapshot()).toMatchObject({
        phase: newResult === "PAID" ? "paid" : "retryable-pending",
        paymentIntentId: successor,
        error: null,
        order: result(newResult).order,
        canRetryPayment: newResult === "PENDING",
      });
      expect(api.create).toHaveBeenCalledTimes(2);
      expect(api.retry).not.toHaveBeenCalled();
      expect(bridge.requestPaymentHandoff.mock.calls).toEqual([
        [checkoutUrl],
        [newCheckoutUrl],
      ]);
      unsubscribe();
    },
  );

  it("never restores voucher basket restart after known payment receipt and a failed read", async () => {
    const { api, controller, restart } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    api.retry.mockRejectedValueOnce(
      new PaymentError("CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED"),
    );
    await controller.retryPayment();
    api.result.mockResolvedValueOnce(result("PAID_PROCESSING"));
    await controller.checkStatus();
    api.result.mockRejectedValueOnce(new PaymentError("NETWORK_ERROR"));
    await controller.checkStatus();
    expect(controller.getSnapshot().error).not.toBe(
      "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
    );
    controller.restart();
    await controller.retryPayment();
    expect(restart).not.toHaveBeenCalled();
    expect(api.retry).toHaveBeenCalledOnce();
  });
  it("checks a returned failed payment again and can discover paid finality", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce(result("FAILED"));
    await controller.handleReturn();
    api.result.mockResolvedValueOnce(result("PAID"));
    await controller.checkStatus();
    expect(api.result).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().phase).toBe("paid");
  });

  it("preserves voucher basket recovery on focus but still recognises paid finality", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    api.retry.mockRejectedValueOnce(
      new PaymentError("CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED"),
    );
    await controller.retryPayment();
    await controller.handleReturn();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      error: "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
      canRetryPayment: false,
    });
    await controller.retryPayment();
    expect(api.retry).toHaveBeenCalledOnce();
    api.result.mockResolvedValueOnce(result("PAID"));
    await controller.checkStatus();
    expect(controller.getSnapshot().phase).toBe("paid");
  });

  it("retains voucher basket guidance when a later status request fails", async () => {
    const { api, controller, restart } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    api.retry.mockRejectedValueOnce(
      new PaymentError("CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED"),
    );
    await controller.retryPayment();
    api.result.mockRejectedValueOnce(new PaymentError("NETWORK_ERROR"));
    await controller.handleReturn();
    expect(controller.getSnapshot().error).toBe(
      "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
    );
    controller.restart();
    expect(restart).toHaveBeenCalledWith(true);
  });
  it("recovers to actionable unpaid after a failed browser-return GET", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    api.result.mockRejectedValueOnce(new PaymentError("NETWORK_ERROR"));
    await controller.handleReturn();
    await controller.checkStatus();
    expect(controller.getSnapshot().phase).toBe("retryable-pending");
    expect(api.result).toHaveBeenCalledTimes(4);
    await controller.retryPayment();
    expect(api.retry).toHaveBeenCalledOnce();
  });

  it("keeps an unresolved retry operation when its source intent reports FAILED", async () => {
    const { api, controller, restart, newId } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    api.retry.mockRejectedValueOnce(new PaymentError("REQUEST_TIMEOUT"));
    await controller.retryPayment();
    api.result.mockResolvedValueOnce(result("FAILED"));
    await controller.checkStatus();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      canRetryPayment: true,
    });
    controller.restart();
    expect(restart).not.toHaveBeenCalled();
    await controller.retryPayment();
    expect(api.retry.mock.calls).toEqual([
      [paymentIntentId, retryKey],
      [paymentIntentId, retryKey],
    ]);
    expect(newId).toHaveBeenCalledTimes(2);
  });
  it("does not retry or reopen a handed-off pending payment before return checks", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    await controller.retryPayment();
    await controller.reopen();
    expect(api.retry).not.toHaveBeenCalled();
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
  });

  it("exposes retryable pending only after all bounded return observations", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    const phases: string[] = [];
    controller.subscribe(() => phases.push(controller.getSnapshot().phase));
    await controller.handleReturn();
    expect(api.result).toHaveBeenCalledTimes(3);
    expect(
      phases.filter((phase) => phase === "retryable-pending"),
    ).toHaveLength(1);
    expect(phases.at(-1)).toBe("retryable-pending");
    expect(api.retry).not.toHaveBeenCalled();
  });

  it("sends one explicit retry, blocks double taps and adopts the returned intent", async () => {
    const { api, bridge, controller, newId } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    let resolve!: (response: PaymentRetry) => void;
    api.retry.mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const first = controller.retryPayment();
    expect(controller.getSnapshot().phase).toBe("retrying");
    await controller.retryPayment();
    await controller.checkStatus();
    await controller.handleReturn();
    expect(api.retry).toHaveBeenCalledExactlyOnceWith(
      paymentIntentId,
      retryKey,
    );
    expect(newId).toHaveBeenCalledTimes(2);
    expect(api.result).toHaveBeenCalledTimes(3);
    resolve({
      checkoutReference: quoteId,
      payment: {
        paymentIntentId: successor,
        status: "PENDING",
        checkoutUrl: newCheckoutUrl,
      },
    });
    await first;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "pending",
      paymentIntentId: successor,
    });
    expect(bridge.requestPaymentHandoff.mock.calls).toEqual([
      [checkoutUrl],
      [newCheckoutUrl],
    ]);
    await controller.checkStatus();
    expect(api.result).toHaveBeenLastCalledWith(successor);
  });

  it.each([
    result("PENDING"),
    {
      checkoutReference: quoteId,
      payment: { paymentIntentId: successor, status: "PENDING" },
    } as PaymentRetry,
  ])(
    "never reopens a stale URL for retry pending without a returned URL %#",
    async (response) => {
      const { api, bridge, controller } = fixture();
      await controller.initiate();
      await controller.handleReturn();
      api.retry.mockResolvedValueOnce(response);
      await controller.retryPayment();
      expect(controller.getSnapshot()).toMatchObject({
        phase: "retryable-pending",
        paymentIntentId: "payment" in response ? successor : paymentIntentId,
      });
      await controller.reopen();
      expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
    },
  );

  it.each(["PAID", "PAID_PROCESSING", "FAILED"] as const)(
    "handles authoritative retry %s safely",
    async (status) => {
      const { api, bridge, controller } = fixture();
      await controller.initiate();
      await controller.handleReturn();
      api.retry.mockResolvedValueOnce(result(status));
      await controller.retryPayment();
      expect(controller.getSnapshot()).toMatchObject({
        phase:
          status === "PAID"
            ? "paid"
            : status === "PAID_PROCESSING"
              ? "paid-processing"
              : "failed",
        order: result(status).order,
      });
      expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
      if (status !== "FAILED") {
        await controller.retryPayment();
        expect(api.retry).toHaveBeenCalledOnce();
      }
    },
  );

  it.each([
    "NETWORK_ERROR",
    "REQUEST_TIMEOUT",
    "SAVT_PAYMENT_CREATE_FAILED",
    "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  ])(
    "retains the source intent and operation key after uncertain retry %s",
    async (code) => {
      const { api, controller, newId } = fixture();
      await controller.initiate();
      await controller.handleReturn();
      api.retry.mockRejectedValueOnce(new PaymentError(code));
      await controller.retryPayment();
      expect(controller.getSnapshot()).toMatchObject({
        phase: "error",
        canRetryPayment: true,
      });
      await controller.checkStatus();
      await controller.retryPayment();
      expect(api.retry.mock.calls).toEqual([
        [paymentIntentId, retryKey],
        [paymentIntentId, retryKey],
      ]);
      expect(newId).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    result("PAID", { order: null }),
    result("PAID", { checkoutReference: successor }),
    result("UNKNOWN" as never),
    {
      checkoutReference: quoteId,
      payment: {
        paymentIntentId: "bad",
        status: "PENDING",
        checkoutUrl: newCheckoutUrl,
      },
    },
  ])(
    "fails closed on invalid retry evidence and prevents a blind retry %#",
    async (response) => {
      const { api, bridge, controller } = fixture();
      await controller.initiate();
      await controller.handleReturn();
      api.retry.mockResolvedValueOnce(response as PaymentRetry);
      await controller.retryPayment();
      expect(controller.getSnapshot()).toMatchObject({
        phase: "error",
        error: "INVALID_RESPONSE",
        canRetryPayment: false,
        order: null,
      });
      await controller.retryPayment();
      expect(api.retry).toHaveBeenCalledOnce();
      expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
    },
  );

  it("fails an initiation-style retry safely and permits explicit failed recovery", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce(result("FAILED"));
    await controller.handleReturn();
    api.retry.mockResolvedValueOnce({
      checkoutReference: quoteId,
      payment: {
        paymentIntentId: successor,
        status: "FAILED",
        checkoutUrl: newCheckoutUrl,
      },
    });
    await controller.retryPayment();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "failed",
      paymentIntentId: successor,
    });
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
  });

  it("keeps voucher rejection recoverable only through the basket", async () => {
    const { api, restart, controller } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    api.retry.mockRejectedValueOnce(
      new PaymentError("CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED"),
    );
    await controller.retryPayment();
    await controller.retryPayment();
    expect(api.retry).toHaveBeenCalledOnce();
    controller.restart();
    expect(restart).toHaveBeenCalledWith(true);
    expect(controller.getSnapshot().phase).toBe("idle");
  });

  it("fences a late retry completion and forgets its key after session loss", async () => {
    const { api, bridge, session, controller } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    let resolve!: (response: PaymentRetry) => void;
    api.retry.mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const retry = controller.retryPayment();
    session.set("expired");
    resolve(result("PAID"));
    await retry;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "session-expired",
      paymentIntentId: null,
      order: null,
      canRetryPayment: false,
    });
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
  });

  it("keeps received-payment finality non-chargeable after a stale unpaid observation", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce(result("PAID_PROCESSING"));
    await controller.checkStatus();
    await controller.handleReturn();
    await controller.retryPayment();
    expect(controller.getSnapshot().phase).toBe("paid-processing");
    expect(api.retry).not.toHaveBeenCalled();
  });

  it("reopens only the new returned checkout after its own bridge failure", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    await controller.handleReturn();
    bridge.requestPaymentHandoff.mockRejectedValueOnce(
      new BridgeError("unavailable"),
    );
    await controller.retryPayment();
    expect(controller.getSnapshot().phase).toBe("handoff-error");
    await controller.reopen();
    expect(bridge.requestPaymentHandoff.mock.calls).toEqual([
      [checkoutUrl],
      [newCheckoutUrl],
      [newCheckoutUrl],
    ]);
    expect(api.retry).toHaveBeenCalledOnce();
  });
  it("does not start payment before explicit action and keeps secrets out of state", () => {
    const { api, bridge, controller } = fixture();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "ready",
      paymentIntentId: null,
      order: null,
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(
      "Q".repeat(43),
    );
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(checkoutUrl);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.result).not.toHaveBeenCalled();
    expect(bridge.requestPaymentHandoff).not.toHaveBeenCalled();
  });

  it("freezes the accepted quote, creates once, and requests native handoff", async () => {
    const { api, bridge, freeze, controller } = fixture();
    await controller.initiate();
    expect(freeze).toHaveBeenCalledWith(quoteId);
    expect(api.create).toHaveBeenCalledWith(quoteId, "Q".repeat(43), key);
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledWith(checkoutUrl);
    expect(controller.getSnapshot()).toEqual({
      phase: "pending",
      paymentIntentId,
      order: null,
      error: null,
      canRetryInitiation: false,
      canRetryPayment: false,
    });
    await controller.initiate();
    expect(api.create).toHaveBeenCalledOnce();
  });

  it.each([
    "NETWORK_ERROR",
    "REQUEST_TIMEOUT",
    "INVALID_RESPONSE",
    "IDEMPOTENCY_REQUEST_IN_PROGRESS",
    "SAVT_PAYMENT_CREATE_FAILED",
  ])("retries uncertain initiation %s with the same key", async (code) => {
    const { api, controller } = fixture();
    api.create.mockRejectedValueOnce(new PaymentError(code));
    await controller.initiate();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      canRetryInitiation: true,
      error: code,
    });
    await controller.initiate();
    expect(api.create.mock.calls.map((call) => call[2])).toEqual([key, key]);
    expect(controller.getSnapshot().phase).toBe("pending");
  });

  it("blocks initiation when the quote is expired or cannot be frozen", async () => {
    const expired = fixture();
    expired.controller.syncQuote(quote("2026-09-21T01:59:59.000Z"), "ready");
    await expired.controller.initiate();
    expect(expired.api.create).not.toHaveBeenCalled();
    expect(expired.controller.getSnapshot()).toMatchObject({
      phase: "error",
      error: "QUOTE_EXPIRED",
    });

    const rejected = fixture();
    rejected.freeze.mockReturnValue(false);
    await rejected.controller.initiate();
    expect(rejected.api.create).not.toHaveBeenCalled();
    expect(rejected.controller.getSnapshot()).toMatchObject({
      phase: "error",
      error: "QUOTE_NOT_READY",
    });
  });

  it("preserves the PaymentIntent after handoff failure and reopens without a POST", async () => {
    const { api, bridge, controller } = fixture();
    bridge.requestPaymentHandoff.mockRejectedValueOnce(
      new BridgeError("unavailable"),
    );
    await controller.initiate();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "handoff-error",
      paymentIntentId,
      error: "PAYMENT_HANDOFF_UNAVAILABLE",
    });
    await controller.reopen();
    expect(api.create).toHaveBeenCalledOnce();
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().phase).toBe("pending");
  });

  it("ignores repeated Pay while one create is in flight and after handoff", async () => {
    const { api, controller } = fixture();
    let resolveCreate!: (value: PaymentCreate) => void;
    api.create.mockImplementationOnce(
      () => new Promise((resolve) => (resolveCreate = resolve)),
    );
    const first = controller.initiate();
    await controller.initiate();
    expect(api.create).toHaveBeenCalledOnce();
    resolveCreate(pendingCreate);
    await first;
    expect(controller.getSnapshot().phase).toBe("pending");
    await controller.initiate();
    expect(api.create).toHaveBeenCalledOnce();
  });

  it("retries a failed status GET without creating or reopening payment", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    api.result.mockRejectedValueOnce(new PaymentError("NETWORK_ERROR"));
    await controller.checkStatus();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      paymentIntentId,
    });
    await controller.checkStatus();
    expect(controller.getSnapshot().phase).toBe("pending");
    expect(api.result).toHaveBeenCalledTimes(2);
    expect(api.create).toHaveBeenCalledOnce();
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
  });

  it.each([
    ["PENDING", "pending"],
    ["FAILED", "failed"],
    ["PAID_PROCESSING", "paid-processing"],
    ["PAID", "paid"],
  ] as const)("projects backend %s as %s", async (backend, phase) => {
    const { api, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce(result(backend));
    await controller.checkStatus();
    expect(controller.getSnapshot().phase).toBe(phase);
    expect(controller.getSnapshot().order).toEqual(
      backend === "PAID"
        ? { orderId, orderNumber: "ORD-2026-0001", status: "CONFIRMED" }
        : null,
    );
  });

  it("fails closed when PAID lacks valid backend Order evidence", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce({
      checkoutReference: quoteId,
      status: "PAID",
      order: null,
    } as PaymentResult);
    await controller.checkStatus();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      order: null,
      error: "INVALID_RESPONSE",
    });
  });

  it("treats browser return as a GET-only observation and coalesces overlap", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    let resolve!: (value: PaymentResult) => void;
    api.result.mockImplementationOnce(
      () => new Promise((done) => (resolve = done)),
    );
    const first = controller.handleReturn();
    const second = controller.handleReturn();
    expect(api.create).toHaveBeenCalledOnce();
    expect(api.result).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().phase).toBe("checking");
    resolve(result("PENDING"));
    await Promise.all([first, second]);
    expect(controller.getSnapshot().phase).toBe("retryable-pending");
    expect(api.result).toHaveBeenCalledTimes(3);
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
  });

  it("settles unresolved paid-processing after bounded return checks", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValue(result("PAID_PROCESSING"));
    await controller.handleReturn();
    expect(api.result).toHaveBeenCalledTimes(3);
    expect(api.create).toHaveBeenCalledOnce();
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "paid-processing",
      order: null,
    });
  });

  it("stops bounded return checks as soon as backend finality is verified", async () => {
    const { api, bridge, controller } = fixture();
    await controller.initiate();
    api.result
      .mockResolvedValueOnce(result("PENDING"))
      .mockResolvedValueOnce(result("PAID_PROCESSING"))
      .mockResolvedValueOnce(result("PAID"));
    await controller.handleReturn();
    expect(api.result).toHaveBeenCalledTimes(3);
    expect(api.create).toHaveBeenCalledOnce();
    expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "paid",
      order: { orderId },
    });
  });

  it("never lets a late native handoff downgrade newer backend finality", async () => {
    const { api, bridge, controller } = fixture();
    let finishHandoff!: () => void;
    bridge.requestPaymentHandoff.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishHandoff = resolve)),
    );
    const initiation = controller.initiate();
    await vi.waitFor(() =>
      expect(bridge.requestPaymentHandoff).toHaveBeenCalledOnce(),
    );
    api.result.mockResolvedValueOnce(result("PAID"));
    await controller.checkStatus();
    expect(controller.getSnapshot().phase).toBe("paid");
    finishHandoff();
    await initiation;
    expect(controller.getSnapshot()).toMatchObject({
      phase: "paid",
      order: { orderId },
    });
  });

  it.each(["PAID", "FAILED"] as const)(
    "does not re-observe terminal backend %s after finality",
    async (terminal) => {
      const { api, controller } = fixture();
      await controller.initiate();
      api.result.mockResolvedValueOnce(result(terminal));
      await controller.checkStatus();
      await controller.handleReturn();
      expect(api.result).toHaveBeenCalledOnce();
      expect(controller.getSnapshot().phase).toBe(
        terminal === "PAID" ? "paid" : "failed",
      );
    },
  );

  it("rejects mismatched quote evidence and never promotes it to paid", async () => {
    const { api, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce(
      result("PAID", {
        checkoutReference: "50000000-0000-4000-8000-000000000005",
      }),
    );
    await controller.checkStatus();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      order: null,
      error: "INVALID_RESPONSE",
    });
  });

  it("clears all payment memory on session loss", async () => {
    const { session, controller } = fixture();
    await controller.initiate();
    session.set("expired");
    expect(controller.getSnapshot()).toEqual({
      phase: "session-expired",
      paymentIntentId: null,
      order: null,
      error: null,
      canRetryInitiation: false,
      canRetryPayment: false,
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(checkoutUrl);
  });

  it("ignores late handoff and result completion after session loss", async () => {
    const handoff = fixture();
    let finishHandoff!: () => void;
    handoff.bridge.requestPaymentHandoff.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishHandoff = resolve)),
    );
    const initiation = handoff.controller.initiate();
    await vi.waitFor(() =>
      expect(handoff.bridge.requestPaymentHandoff).toHaveBeenCalledOnce(),
    );
    handoff.session.set("expired");
    finishHandoff();
    await initiation;
    expect(handoff.controller.getSnapshot()).toEqual({
      phase: "session-expired",
      paymentIntentId: null,
      order: null,
      error: null,
      canRetryInitiation: false,
      canRetryPayment: false,
    });

    const observation = fixture();
    await observation.controller.initiate();
    let finishResult!: (value: PaymentResult) => void;
    observation.api.result.mockImplementationOnce(
      () => new Promise((resolve) => (finishResult = resolve)),
    );
    const checking = observation.controller.checkStatus();
    observation.session.set("expired");
    finishResult(result("PAID"));
    await checking;
    expect(observation.controller.getSnapshot()).toEqual({
      phase: "session-expired",
      paymentIntentId: null,
      order: null,
      error: null,
      canRetryInitiation: false,
      canRetryPayment: false,
    });
  });

  it("restarts a failed payment as a fresh cart journey", async () => {
    const { api, restart, controller } = fixture();
    api.create.mockResolvedValueOnce({
      checkoutReference: quoteId,
      payment: { paymentIntentId, status: "FAILED", checkoutUrl },
    });
    await controller.initiate();
    expect(controller.getSnapshot().phase).toBe("failed");
    controller.restart();
    expect(restart).toHaveBeenCalledWith(true);
    expect(controller.getSnapshot().phase).toBe("idle");
  });

  it("clears the completed basket only when leaving a verified paid order", async () => {
    const { api, restart, controller } = fixture();
    await controller.initiate();
    api.result.mockResolvedValueOnce(result("PAID"));
    await controller.checkStatus();
    expect(controller.getSnapshot().phase).toBe("paid");
    controller.finishPaidOrder();
    expect(restart).toHaveBeenCalledWith(false);
    expect(controller.getSnapshot().phase).toBe("idle");
  });

  it("keeps the basket after an authoritative payment initiation rejection", async () => {
    const { api, restart, controller } = fixture();
    api.create.mockRejectedValueOnce(new PaymentError("QUOTE_TOKEN_INVALID"));
    await controller.initiate();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      canRetryInitiation: false,
      canRetryPayment: false,
    });
    controller.restart();
    expect(restart).toHaveBeenCalledWith(true);
    expect(controller.getSnapshot().phase).toBe("idle");
  });

  it("cannot restart while a payment intent has an unverified result", async () => {
    const { api, restart, controller } = fixture();
    await controller.initiate();
    api.result.mockRejectedValueOnce(new PaymentError("NETWORK_ERROR"));
    await controller.checkStatus();
    expect(controller.getSnapshot()).toMatchObject({
      phase: "error",
      paymentIntentId,
    });
    controller.restart();
    expect(restart).not.toHaveBeenCalled();
    expect(controller.getSnapshot().paymentIntentId).toBe(paymentIntentId);
  });
});
