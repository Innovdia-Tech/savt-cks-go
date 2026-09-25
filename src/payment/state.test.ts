import { describe, expect, it, vi } from "vitest";
import type { CheckoutQuote } from "../checkout/contracts";
import { BridgeError } from "../webview/bridge";
import { PaymentError } from "./api";
import type { PaymentCreate, PaymentResult } from "./contracts";
import { PaymentController } from "./state";

const quoteId = "10000000-0000-4000-8000-000000000001";
const paymentIntentId = "20000000-0000-4000-8000-000000000002";
const key = "30000000-0000-4000-8000-000000000003";
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

const fixture = () => {
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
  };
  const bridge = {
    requestPaymentHandoff: vi.fn<(url: string) => Promise<void>>(),
  };
  const session = new SessionFixture();
  const freeze = vi.fn(() => true);
  const restart = vi.fn();
  const controller = new PaymentController(
    api,
    bridge,
    session,
    freeze,
    restart,
    () => now,
    () => key,
    async () => {},
  );
  controller.syncQuote(quote(), "ready");
  return { api, bridge, session, freeze, restart, controller };
};

describe("PaymentController", () => {
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
    expect(controller.getSnapshot().phase).toBe("pending");
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
