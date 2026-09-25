import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentPanel } from "./components";
import type { PaymentState } from "./state";

const base: PaymentState = {
  phase: "ready",
  paymentIntentId: null,
  order: null,
  error: null,
  canRetryInitiation: false,
};

const controller = {
  initiate: async () => {},
  reopen: async () => {},
  checkStatus: async () => {},
  restart: () => {},
};

const render = (state: PaymentState) =>
  renderToStaticMarkup(
    createElement(PaymentPanel, {
      state,
      controller,
      acceptedTotalMinor: 2300,
    } as never),
  );

describe("customer payment presentation", () => {
  it("starts only from the explicit proceed action", () => {
    const html = render(base);
    expect(html).toMatch(/Pay (?:RM|MYR).*23\.00/);
    expect(html).toContain("Secure checkout with Savt");
    expect(html).toContain(
      "Please check your items and delivery address before paying.",
    );
    expect(html).toContain(
      "Once confirmed, orders cannot be changed or cancelled in the app.",
    );
    expect(html).not.toContain("Order Confirmed");
  });

  it.each([
    ["initiating", "Opening secure payment"],
    ["opening", "Opening secure payment"],
    ["pending", "Payment pending"],
    ["checking", "Checking payment status"],
    ["failed", "Payment failed"],
    ["paid-processing", "Payment received — finalising your order"],
    ["handoff-error", "Could not open secure payment"],
  ] as const)("shows %s without confirming an order", (phase, copy) => {
    const html = render({
      ...base,
      phase,
      paymentIntentId: phase === "initiating" ? null : "intent-redacted",
      error: phase === "handoff-error" ? "PAYMENT_HANDOFF_UNAVAILABLE" : null,
    });
    expect(html).toContain(copy);
    expect(html).not.toContain("Order Confirmed");
    expect(html).not.toContain("Payment successful");
  });

  it("keeps unresolved pending and processing states static after bounded observation", () => {
    const pending = render({
      ...base,
      phase: "pending",
      paymentIntentId: "intent-redacted",
    });
    const processing = render({
      ...base,
      phase: "paid-processing",
      paymentIntentId: "intent-redacted",
    });
    for (const html of [pending, processing]) {
      expect(html).not.toContain("Check payment status");
      expect(html).not.toContain("Reopen secure payment");
      expect(html).not.toContain("payment-progress");
      expect(html).not.toMatch(/Pay (?:RM|MYR)/);
      expect(html).not.toContain("Order confirmed");
    }
  });

  it("offers only same-attempt recovery for a failed handoff", () => {
    const html = render({
      ...base,
      phase: "handoff-error",
      paymentIntentId: "intent-redacted",
      error: "PAYMENT_HANDOFF_UNAVAILABLE",
    });
    expect(html).toContain("Continue secure payment");
    expect(html).not.toContain("Check payment status");
    expect(html).not.toContain("Reopen secure payment");
    expect(html.match(/<button/g) ?? []).toHaveLength(1);
  });

  it("retries only the status request after a failed status check", () => {
    const html = render({
      ...base,
      phase: "error",
      paymentIntentId: "intent-redacted",
      error: "NETWORK_ERROR",
    });
    expect(html).toContain("Retry status check");
    expect(html).not.toContain("Reopen secure payment");
    expect(html.match(/<button/g) ?? []).toHaveLength(1);
  });

  it("shows Order Confirmed only with a backend-projected Order", () => {
    const html = render({
      ...base,
      phase: "paid",
      paymentIntentId: "intent-redacted",
      order: {
        orderId: "40000000-0000-4000-8000-000000000004",
        orderNumber: "ORD-2026-0001",
        status: "CONFIRMED",
      },
    });
    expect(html).toContain("Payment successful");
    expect(html).toContain("Order confirmed");
    expect(html).toContain("ORD-2026-0001");
    expect(html).not.toContain("CONFIRMED");
  });

  it("links to history only after paid plus valid backend Order evidence", () => {
    const paid = renderToStaticMarkup(
      createElement(PaymentPanel, {
        state: {
          ...base,
          phase: "paid",
          paymentIntentId: "intent-redacted",
          order: {
            orderId: "40000000-0000-4000-8000-000000000004",
            orderNumber: "ORD-2026-0001",
            status: "CONFIRMED",
          },
        },
        controller,
        onViewOrder: () => {},
      } as never),
    );
    expect(paid).toContain("View order");
    const processing = renderToStaticMarkup(
      createElement(PaymentPanel, {
        state: {
          ...base,
          phase: "paid-processing",
          paymentIntentId: "intent-redacted",
        },
        controller,
        onViewOrder: () => {},
      } as never),
    );
    expect(processing).not.toContain("View order");
  });

  it("never renders internal codes, payment URL, quote token, or intent ID", () => {
    const html = render({
      ...base,
      phase: "error",
      paymentIntentId: "20000000-0000-4000-8000-000000000002",
      error: "SAVT_PAYMENT_INVALID_RESPONSE",
      canRetryInitiation: true,
    });
    expect(html).toContain("Payment unavailable");
    expect(html).not.toContain("SAVT_PAYMENT_INVALID_RESPONSE");
    expect(html).not.toContain("20000000-0000-4000-8000-000000000002");
    expect(html).not.toMatch(/https:\/\/|quoteToken/i);
  });
});
