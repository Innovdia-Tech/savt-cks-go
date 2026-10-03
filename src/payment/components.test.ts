import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentPanel } from "./components";
import { PaymentController, type PaymentState } from "./state";
import type { CheckoutQuote } from "../checkout/contracts";
import { BrowserBridgeAdapter } from "../webview/bridge";

const base: PaymentState = {
  phase: "ready",
  paymentIntentId: null,
  order: null,
  error: null,
  canRetryInitiation: false,
  canRetryPayment: false,
};

const controller = {
  initiate: async () => {},
  retryPayment: async () => {},
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
  it.each(["REQUEST_TIMEOUT", "NETWORK_ERROR", "INVALID_RESPONSE"])(
    "keeps an uncertain %s payment request safe to retry without claiming it did not start",
    (error) => {
      const html = render({
        ...base,
        phase: "error",
        error,
        canRetryInitiation: true,
      });
      expect(html).toContain("We couldn’t confirm the payment request.");
      expect(html).toContain("Try again");
      expect(html).not.toContain("We couldn’t start your payment");
      expect(html).not.toContain(error);
    },
  );
  it.each(["pending", "checking", "paid-processing"] as const)(
    "keeps %s payment copy unconfirmed until authoritative PAID and an order",
    (phase) => {
      const html = render({
        ...base,
        phase,
        paymentIntentId: "private-intent",
      });
      expect(html).toContain("Confirming your payment…");
      expect(html).toContain("This usually takes a moment.");
      expect(html).not.toMatch(
        /Payment received|Payment successful|Order confirmed|private-intent/,
      );
    },
  );

  it("gives payment handoff recovery without operational terminology", () => {
    const html = render({ ...base, phase: "handoff-error" });
    expect(html).toContain("Continue secure payment");
    expect(html).not.toMatch(
      /payment attempt|same attempt|provider|callback|webhook/i,
    );
  });

  it("keeps payment recovery memory-only with no storage or URL persistence", () => {
    for (const file of [
      "api.ts",
      "contracts.ts",
      "state.ts",
      "components.tsx",
      "context.tsx",
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(
        /localStorage|sessionStorage|history\.(pushState|replaceState)|location\.(href|hash)\s*=|globalThis\.[\w]+\s*=|window\.[\w]+\s*=/,
      );
    }
  });
  it("offers explicit retry and status after returned unpaid observations", () => {
    const html = render({
      ...base,
      phase: "retryable-pending",
      paymentIntentId: "intent-redacted",
    });
    expect(html).toContain("Payment not completed");
    expect(html).toContain(
      "We haven&#x27;t received payment confirmation. If you closed the payment page before finishing, you can try again.",
    );
    expect(html).toContain("Try Payment Again");
    expect(html).toContain("Check payment status");
    expect(html).not.toContain("Continue secure payment");
    expect(html).not.toContain("Order confirmed");
  });

  it("disables both recovery actions during retry without showing paid", () => {
    const html = render({
      ...base,
      phase: "retrying",
      paymentIntentId: "intent-redacted",
    });
    expect(html).toContain("Preparing a new payment");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Payment successful");
  });

  it("uses nontechnical voucher guidance with a basket action", () => {
    const html = render({
      ...base,
      phase: "error",
      paymentIntentId: "intent-redacted",
      error: "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
    });
    expect(html).toContain(
      "This payment can&#x27;t be restarted from this checkout.",
    );
    expect(html).toContain("Please return to your basket and try again.");
    expect(html).toContain("Review basket");
    expect(html).not.toContain("CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED");
    expect(html).not.toContain("Try Payment Again");
  });

  it("offers the same operation retry after an uncertain request", () => {
    const html = render({
      ...base,
      phase: "error",
      paymentIntentId: "intent-redacted",
      error: "REQUEST_TIMEOUT",
      canRetryPayment: true,
    });
    expect(html).toContain("Try Payment Again");
    expect(html).toContain("Check payment status");
    expect(html).not.toMatch(
      /REQUEST_TIMEOUT|idempotency|409|PENDING|intent-redacted/,
    );
  });

  it("does not offer retry before return observations or after receiving payment", () => {
    for (const phase of ["pending", "checking", "paid-processing"] as const) {
      const html = render({
        ...base,
        phase,
        paymentIntentId: "intent-redacted",
      });
      expect(html).not.toContain("Try Payment Again");
    }
  });
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
    ["pending", "Confirming your payment…"],
    ["retryable-pending", "Payment not completed"],
    ["retrying", "Preparing a new payment"],
    ["checking", "Confirming your payment…"],
    ["failed", "Payment failed"],
    ["paid-processing", "Confirming your payment…"],
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

  it("explains pending payment without claiming confirmation", () => {
    const html = render({
      ...base,
      phase: "pending",
      paymentIntentId: "intent-redacted",
    });
    expect(html).toContain("This usually takes a moment.");
    expect(html).toContain("Your order will appear once payment is confirmed.");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Returning from the payment page");
    expect(html).not.toContain("Payment successful");
    expect(html).not.toContain("Order confirmed");
    expect(html).not.toContain("View order");
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
    expect(html).toContain("Check payment status");
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
    expect(html).toContain("Payment received.");
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
    expect(paid).toContain("Track order");
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
    expect(processing).not.toContain("Track order");
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

describe("secondary payment error support", () => {
  const renderSupport = (state: PaymentState, digits = "60123456789") =>
    renderToStaticMarkup(
      createElement(PaymentPanel, {
        state,
        controller,
        supportWhatsApp: digits,
      }),
    );
  it.each([
    [{ ...base, phase: "failed" }, "Review basket"],
    [{ ...base, phase: "handoff-error" }, "Continue secure payment"],
    [{ ...base, phase: "error", canRetryInitiation: true }, "Try again"],
    [
      { ...base, phase: "error", paymentIntentId: "intent-private" },
      "Check payment status",
    ],
    [{ ...base, phase: "error" }, "Review basket"],
    [
      { ...base, phase: "error", canRetryPayment: true },
      "Check payment status",
    ],
    [
      {
        ...base,
        phase: "error",
        error: "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
      },
      "Review basket",
    ],
  ] as const)("puts general help after recovery in %j", (state, recovery) => {
    const html = renderSupport(state);
    expect(html).toContain("Need help?");
    expect(html).toContain(">Get help on WhatsApp</button>");
    expect(html).toContain(recovery);
    expect(html.indexOf(recovery)).toBeLessThan(html.indexOf("support-action"));
    expect(html).toContain("Open CKS Go support in WhatsApp");
    expect(html).not.toContain("intent-private");
  });
  it.each([
    "idle",
    "ready",
    "initiating",
    "opening",
    "pending",
    "retryable-pending",
    "retrying",
    "checking",
    "paid-processing",
    "paid",
    "session-expired",
  ] as const)("omits support in %s", (phase) => {
    expect(renderSupport({ ...base, phase })).not.toContain("support-action");
  });
  it("omits support after confirmed payment", () => {
    expect(
      renderSupport({
        ...base,
        phase: "paid",
        order: {
          orderId: "private-id",
          orderNumber: "CKSGO-0001",
          status: "CONFIRMED",
        },
      }),
    ).not.toContain("support-action");
  });
  it.each(["", "invalid"])(
    "has no invalid support action for %s config",
    (digits) => {
      const html = renderSupport({ ...base, phase: "failed" }, digits);
      expect(html).toContain("Review basket");
      expect(html).not.toContain("Open CKS Go support");
    },
  );
  it("renders without invoking payment actions or mutating the frozen state", () => {
    const frozen = Object.freeze({ ...base, phase: "failed" as const });
    const actions = {
      initiate: vi.fn(),
      retryPayment: vi.fn(),
      reopen: vi.fn(),
      checkStatus: vi.fn(),
      restart: vi.fn(),
    };
    const before = JSON.stringify(frozen);
    renderToStaticMarkup(
      createElement(PaymentPanel, {
        state: frozen,
        controller: actions,
        supportWhatsApp: "60123456789",
      }),
    );
    expect(JSON.stringify(frozen)).toBe(before);
    for (const fn of Object.values(actions)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("local simulator pending status action", () => {
  const localOrigin = "http://127.0.0.1:4312";
  const pending: PaymentState = {
    ...base,
    phase: "pending",
    paymentIntentId: "20000000-0000-4000-8000-000000000002",
  };
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN", localOrigin);
    vi.stubGlobal("window", {
      location: { href: "http://127.0.0.1:5173/" },
      open: () => null,
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const findStatusButton = (
    node: ReactNode,
  ):
    ReactElement<{ children?: ReactNode; onClick: () => void }> | undefined => {
    if (!isValidElement<{ children?: ReactNode; onClick: () => void }>(node))
      return undefined;
    if (
      node.type === "button" &&
      node.props.children === "Check payment status"
    )
      return node;
    for (const child of Children.toArray(node.props.children)) {
      const button = findStatusButton(child);
      if (button) return button;
    }
    return undefined;
  };

  it.each([
    {
      setting: "",
      development: true,
      production: false,
      href: "http://127.0.0.1:5173/",
    },
    {
      setting: undefined,
      development: true,
      production: false,
      href: "http://127.0.0.1:5173/",
    },
    {
      setting: localOrigin,
      development: false,
      production: false,
      href: "http://127.0.0.1:5173/",
    },
    {
      setting: localOrigin,
      development: true,
      production: true,
      href: "http://127.0.0.1:5173/",
    },
    {
      setting: localOrigin,
      development: true,
      production: false,
      href: "https://127.0.0.1:5173/",
    },
    {
      setting: localOrigin,
      development: true,
      production: false,
      href: "http://customer.example.test/",
    },
    {
      setting: "http://localhost:4312",
      development: true,
      production: false,
      href: "http://127.0.0.1:5173/",
    },
  ])(
    "hides the local status action outside its explicit development allowance: %o",
    ({ setting, development, production, href }) => {
      vi.stubEnv("DEV", development);
      vi.stubEnv("PROD", production);
      vi.stubEnv("VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN", setting);
      vi.stubGlobal("window", { location: { href } });
      for (const phase of ["pending", "paid-processing"] as const) {
        expect(render({ ...pending, phase })).not.toContain(
          "Check payment status",
        );
      }
    },
  );

  it.each(["pending", "paid-processing"] as const)(
    "shows one explicit status action while local payment is %s",
    (phase) => {
      const html = render({ ...pending, phase });
      expect(html).toContain("Check payment status");
      expect(html.match(/<button/g)).toHaveLength(1);
      expect(html).not.toContain("Try Payment Again");
      expect(html).not.toContain("Order confirmed");
    },
  );

  it.each(["PENDING", "PAID_PROCESSING"] as const)(
    "reads %s status only on an explicit click without another create, retry or invented finality",
    async (status) => {
      const quoteId = "10000000-0000-4000-8000-000000000001";
      const paymentIntentId = pending.paymentIntentId!;
      const api = {
        create: vi.fn().mockResolvedValue({
          checkoutReference: quoteId,
          payment: {
            paymentIntentId,
            status: "PENDING",
            checkoutUrl:
              localOrigin +
              "/api/integrations/cks-go/v1/payment-simulator/ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq",
          },
        }),
        result: vi.fn().mockResolvedValue({
          checkoutReference: quoteId,
          status,
          order: null,
        }),
        retry: vi.fn(),
      };
      const actual = new PaymentController(
        api,
        new BrowserBridgeAdapter(),
        {
          getSnapshot: () => ({ phase: "authenticated" }),
          subscribe: () => () => {},
        },
        () => true,
        () => {},
        () => Date.parse("2026-09-21T02:00:00.000Z"),
        () => "30000000-0000-4000-8000-000000000003",
      );
      actual.syncQuote(
        {
          quoteId,
          quoteToken: "Q".repeat(43),
          quoteExpiresAt: "2026-09-21T02:10:00.000Z",
        } as CheckoutQuote,
        "ready",
      );
      await actual.initiate();
      expect(actual.getSnapshot().phase).toBe("pending");
      expect(api.result).not.toHaveBeenCalled();
      const renderStatusButton = () => {
        let statusButton: ReturnType<typeof findStatusButton>;
        function StatusActionHarness() {
          const panel = PaymentPanel({
            state: actual.getSnapshot(),
            controller: actual,
          });
          statusButton = findStatusButton(panel);
          return panel;
        }
        renderToStaticMarkup(createElement(StatusActionHarness));
        return statusButton;
      };
      const button = renderStatusButton();
      expect(button).toBeDefined();
      button!.props.onClick();
      await vi.waitFor(() => {
        expect(api.result).toHaveBeenCalledExactlyOnceWith(paymentIntentId);
        expect(actual.getSnapshot()).toMatchObject({
          phase: status === "PAID_PROCESSING" ? "paid-processing" : "pending",
          order: null,
          canRetryPayment: false,
        });
      });
      const nextButton = renderStatusButton();
      expect(nextButton).toBeDefined();
      expect(api.result).toHaveBeenCalledOnce();
      nextButton!.props.onClick();
      await vi.waitFor(() => expect(api.result).toHaveBeenCalledTimes(2));
      expect(api.create).toHaveBeenCalledOnce();
      expect(api.retry).not.toHaveBeenCalled();
      actual.dispose();
    },
  );
});
