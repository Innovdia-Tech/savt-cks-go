import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseQuote } from "./contracts";
import {
  AddressChangeDialog,
  AddressTransitionError,
  CartScreen,
} from "./components";
import { id, quoteEnvelope } from "./test-fixtures";
import { PaymentController } from "../payment/state";
import { PaymentError } from "../payment/api";
import type { PaymentResult } from "../payment/contracts";

const line = {
  outletId: id("a"),
  outletProductId: id("2"),
  product: {
    productId: id("3"),
    name: "Rice",
    imageUrl: null,
    packSize: "1 kg",
    uom: { code: "PACK", name: "Pack" },
  },
  quantity: 2,
  displayedUnitPriceMinor: 450,
  currency: "MYR" as const,
};
const base = {
  lines: [line],
  assignment: {
    outletId: id("a"),
    outletDisplayName: "Demo outlet",
    outletDisplayReference: "DEMO",
    customerAddressId: id("b"),
    addressLabel: "Home",
    addressRowVersion: 7,
  },
  pendingAddress: null,
  transitionPhase: "idle",
  transitionError: null,
  quotePhase: "idle",
  quote: null,
  error: null,
  canRetry: false,
  priceChanged: false,
  paymentFrozen: false,
};
const controller = {
  setQuantity() {},
  remove() {},
  requestQuote: async () => {},
  retryQuote: async () => {},
  acceptPriceChanges() {},
  cancelAddressChange() {},
  confirmAddressChange: () => null,
};

const smallOrderQuote = (overrides: Record<string, unknown> = {}) => ({
  ...quoteEnvelope().data,
  processingFeeMinor: 200,
  processingFee: {
    feeType: "SMALL_ORDER_TIERS",
    policyKind: "SMALL_ORDER_TIERS",
    enabled: true,
    qualifyingAmountMinor: 2220,
    matchedTier: { fromMinor: 0, belowMinor: 3000, chargeMinor: 900 },
    outcome: "CHARGED",
    feeFreeFromMinor: 3000,
    ...overrides,
  },
});

const feeMarkup = (quote: unknown) =>
  renderToStaticMarkup(
    createElement(CartScreen, {
      state: { ...base, quote, quotePhase: "ready" },
      controller,
      onBrowse: () => {},
    } as never),
  );

describe("small order fee presentation from the frozen quote", () => {
  it("preserves the legacy fee name and charged amount", () => {
    const html = feeMarkup(quoteEnvelope().data);
    expect(html).toMatch(/<dt>Processing fee<\/dt><dd>RM[^<]*0\.42/);
    expect(html).not.toContain("About small order fee");
  });

  it("renders one small-order row with the authoritative charge and a labelled info button", () => {
    const html = feeMarkup(smallOrderQuote());
    expect(html).toMatch(/Small order fee[^]*?<\/dt><dd[^>]*>RM[^<]*2\.00/);
    expect(html.match(/<dt[^>]*>Small order fee/g)).toHaveLength(1);
    expect(html).not.toContain("Processing fee</dt>");
    expect(html).toContain('aria-label="About small order fee"');
    expect(html).not.toMatch(/<dialog[^>]* open/);
  });

  it("uses only the quoted qualifying amount and threshold for the compact helper", () => {
    const html = feeMarkup(smallOrderQuote());
    expect(html).toMatch(/RM[^<]*7\.80 to go for no small order fee/);
    expect(html).toContain(
      "Based on items total after discounts. Delivery is excluded.",
    );
    expect(html).not.toContain("21.00 to go");
    expect(html).not.toContain("16.10 to go");
  });

  it.each([null, 2220, 2000])(
    "does not invent a no-fee promise for threshold %s",
    (feeFreeFromMinor) => {
      const html = feeMarkup(smallOrderQuote({ feeFreeFromMinor }));
      expect(html).not.toContain("to go for no small order fee");
    },
  );

  it.each(["ZERO_TIER", "NO_MATCH"])(
    "explains %s without a threshold promise",
    (outcome) => {
      const html = feeMarkup({
        ...smallOrderQuote({ outcome }),
        processingFeeMinor: 0,
      });
      expect(html).toContain("No small order fee for this order.");
      expect(html).not.toContain("to go for no small order fee");
    },
  );

  it("explains disabled policy without earned-savings language", () => {
    const html = feeMarkup({
      ...smallOrderQuote({ outcome: "DISABLED", enabled: false }),
      processingFeeMinor: 0,
    });
    expect(html).toContain("Small order fee is currently not applied.");
    expect(html).not.toMatch(/saved|reward|to go for no small order fee/i);
  });

  it.each([
    "CHECKOUT_FEE_CONTRACT_UPGRADE_REQUIRED",
    "CHECKOUT_PROCESSING_FEE_UNCONFIGURED",
    "CHECKOUT_PROCESSING_FEE_INVALID",
  ])("keeps the basket and shows safe recovery for %s", (error) => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, quotePhase: "error", error },
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("We couldn&#x27;t confirm the checkout fee.");
    expect(html).toContain(
      "Your basket is still here. Refresh your total and try again.",
    );
    expect(html).toContain("Rice");
    expect(html).toContain("Refresh total");
    expect(html).not.toContain(error);
    expect(html).not.toContain("Processing fee</dt>");
  });
});

describe("real cart and trusted quote presentation", () => {
  it.each([
    "PENDING",
    "FAILED",
    "PAID_PROCESSING",
    "PAID",
    "NETWORK_ERROR",
  ] as const)(
    "shows recovered backend %s payment without persisted basket lines",
    async (status) => {
      const paymentId = "20000000-0000-4000-8000-000000000002";
      const paymentController = new PaymentController(
        {
          create: async () => {
            throw new Error("No payment creation during recovery");
          },
          retry: async () => {
            throw new Error("No automatic retry during recovery");
          },
          result: async (): Promise<PaymentResult> => {
            if (status === "NETWORK_ERROR")
              throw new PaymentError("NETWORK_ERROR");
            return {
              checkoutReference: "10000000-0000-4000-8000-000000000001",
              status,
              order:
                status === "PAID"
                  ? {
                      orderId: "40000000-0000-4000-8000-000000000004",
                      orderNumber: "CKS-123",
                      status: "NEW",
                    }
                  : null,
            };
          },
        },
        {
          requestPaymentHandoff: async () => {
            throw new Error("No checkout launch during recovery");
          },
        },
        {
          getSnapshot: () => ({ phase: "authenticated" }),
          subscribe: () => () => {},
        },
        () => false,
        () => {},
        Date.now,
        () => paymentId,
        async () => {},
      );
      await paymentController.restore(paymentId);
      const html = renderToStaticMarkup(
        createElement(CartScreen, {
          state: { ...base, lines: [], assignment: null },
          controller,
          payment: {
            state: paymentController.getSnapshot(),
            controller: paymentController,
            onViewOrder: () => {},
          },
          onBrowse: () => {},
        } as never),
      );
      expect(html).not.toContain("Your basket is empty");
      expect(html).not.toContain(paymentId);
      if (status === "PAID") {
        expect(html).toContain("Order confirmed");
        expect(html).toContain("Track order");
      } else {
        expect(html).not.toContain("Order confirmed");
        expect(html).not.toContain("Track order");
      }
      if (status === "FAILED") expect(html).toContain("Payment failed");
      if (status === "NETWORK_ERROR")
        expect(html).toContain("Check payment status");
      paymentController.dispose();
    },
  );
  it("uses Basket copy for the empty customer state", () => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, lines: [] },
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("Your basket is empty");
    expect(html).not.toContain("Your cart is empty");
  });
  it("gates quote review when saved cart lines lack a current delivery assignment", () => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, assignment: null },
        controller,
        onBrowse: () => {},
        onChangeAddress: () => {},
      } as never),
    );
    expect(html).toContain(
      "Choose a delivery address before reviewing your order",
    );
    expect(html).toContain("disabled");
  });
  it("explains a saved unserviceable address before clearing a filled cart", () => {
    const html = renderToStaticMarkup(
      createElement(AddressChangeDialog, {
        state: {
          ...base,
          pendingAddress: {
            address: {
              id: id("d"),
              label: "Home",
              rowVersion: 1,
              addressLine1: "Lot 88 Jalan Example",
              addressLine2: null,
              city: "Tuaran",
              state: "Sabah",
            },
            assignment: null,
          },
          transitionPhase: "confirmation",
        },
        controller,
        onCommit: () => {},
      } as never),
    );
    expect(html).toContain("saved");
    expect(html).toContain("Lot 88 Jalan Example");
    expect(html).toContain("Tuaran, Sabah");
    expect(html).toContain("remains saved for later");
    expect(html).toContain("Keep current delivery address");
    expect(html).toContain("Use this address &amp; clear basket");
    expect(html).not.toContain("Delivery isn&#x27;t available here yet");
  });
  it("uses accepted checkout rows and server totals with ordinary data", () => {
    const quote = parseQuote(quoteEnvelope());
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, quote, quotePhase: "ready" },
        controller,
        onBrowse: () => {},
        deliveryAddress: "Real saved address",
        onChangeAddress: () => {},
      } as never),
    );
    expect(html).toContain("cart-stack--shopping");
    expect(html).toContain("Deliver to");
    expect(html).toContain("Real saved address");
    expect(html).toContain("Total");
    expect(html).toContain("14.32");
    expect(html).not.toContain("1 Example Street");
  });

  it("shows product snapshots and displayed subtotal with an explicit quote action only", () => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: base,
        controller,
        onBrowse: () => {},
        deliveryAddress: "1 Example Street, Demo City, Sabah",
        onChangeAddress: () => {},
      } as never),
    );
    expect(html).toContain("Rice");
    expect(html).toContain("Your items");
    expect(html).toContain("Order summary");
    expect(html).toContain("Items subtotal");
    expect(html).toMatch(/(?:RM|MYR).*9\.00/);
    expect(html).toContain("Checkout");
    expect(html).toContain("Deliver to");
    expect(html).toContain("1 Example Street, Demo City, Sabah");
    expect(html).toContain('aria-label="Change delivery address"');
    expect(html).toContain("Demo outlet");
    expect(html).toContain("Item subtotal");
    expect(html.indexOf('aria-label="Quantity for Rice"')).toBeLessThan(
      html.indexOf("Item subtotal"),
    );
    expect(html.indexOf('aria-label="Remove Rice"')).toBeLessThan(
      html.indexOf("Item subtotal"),
    );
    expect(html).toContain("Remove Rice");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Quantity for Rice"');
    expect(html).not.toContain("Your basket");
    expect(html).not.toContain(">Your cart<");
    expect(html).not.toMatch(
      /<(?:button|a)[^>]*>[^<]*(?:pay|confirm order|tracking)/i,
    );
  });

  it.each([1, 6])(
    "keeps quantity %i bound to its unit price and only repeats a subtotal for multiple units",
    (quantity) => {
      const html = renderToStaticMarkup(
        createElement(CartScreen, {
          state: { ...base, lines: [{ ...line, quantity }] },
          controller,
          onBrowse: () => {},
        } as never),
      );
      expect(html).toContain('aria-label="Quantity for Rice"');
      expect(html).toContain(`<span aria-live="polite">${quantity}</span>`);
      expect(html).toContain('aria-label="Remove Rice"');
      expect(html).toContain("1 kg");
      expect(html).toMatch(/cart-line-copy[^]*RM[^<]*4\.50/);
      if (quantity === 1) expect(html).not.toContain("Item subtotal</span>");
      else expect(html).toMatch(/Item subtotal<\/span><strong>RM[^<]*27\.00/);
    },
  );

  it("keeps many products within one Your items surface and freezes each product's controls", () => {
    const lines = Array.from({ length: 10 }, (_, index) => ({
      ...line,
      outletProductId: `item-${index}`,
      product: { ...line.product, name: `Rice ${index + 1}` },
      quantity: index === 0 ? 6 : 1,
    }));
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, lines, paymentFrozen: true },
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html.match(/class="cart-lines"/g)).toHaveLength(1);
    expect(html.match(/class="cart-line"/g)).toHaveLength(10);
    expect(html.match(/disabled=""/g)).toHaveLength(31);
    expect(html.match(/Item subtotal<\/span>/g)).toHaveLength(1);
    for (const item of lines) {
      expect(html).toContain(`Quantity for ${item.product.name}`);
      expect(html).toContain(`Remove ${item.product.name}`);
      expect(html).toContain(`Image unavailable for ${item.product.name}`);
    }
    expect(html).toMatch(/cart-display-total[^]*RM[^<]*67\.50/);
    expect(html).toContain('<h2 id="cart-lines-title">Your items</h2>');
    expect(html).not.toContain("Your items (10)");
  });

  it("presents authoritative server lines, fees, total, timing and expiry", () => {
    const quote = parseQuote(quoteEnvelope());
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, quote, quotePhase: "ready" },
        controller,
        onBrowse: () => {},
      } as never),
    );
    for (const text of [
      "Order summary",
      "Rice",
      "Items subtotal",
      "Delivery fee",
      "Processing fee",
      "Total",
      "Estimated delivery",
      "Prices valid until",
      "Home",
      "Demo outlet",
    ])
      expect(html).toContain(text);
    expect(html).toContain('<h2 id="quote-title">Order summary</h2>');
    expect(html).not.toContain("Merchandise subtotal");
    expect(html).toContain("Prices and fees confirmed");
    expect(html).toMatch(
      /<details[^>]*><summary>Delivery details<svg[^>]*aria-hidden="true"/,
    );
    for (const [label, amount] of [
      ["Items subtotal", "9.00"],
      ["Delivery fee", "4.90"],
      ["Processing fee", "0.42"],
      ["Total", "14.32"],
    ]) {
      expect(html).toMatch(
        new RegExp(
          `<dt[^>]*>${label}</dt><dd[^>]*>RM[^<]*${amount.replace(".", "\\.")}</dd>`,
        ),
      );
    }
    expect(html).not.toContain("Quote ID");
    expect(html).not.toContain(id("b"));
    expect(html).not.toContain(id("a"));
    expect(html).not.toContain("memory-only-quote-token");
    expect(html).not.toMatch(
      /<(?:button|a)[^>]*>[^<]*(?:pay|confirm order|tracking)/i,
    );
  });

  it("adds payment only after a ready quote and locks cart controls once frozen", () => {
    const quote = parseQuote(quoteEnvelope());
    const payment = {
      state: {
        phase: "ready",
        paymentIntentId: null,
        order: null,
        error: null,
        canRetryInitiation: false,
        canRetryPayment: false,
      },
      controller: {
        initiate: async () => {},
        retryPayment: async () => {},
        reopen: async () => {},
        checkStatus: async () => {},
        restart: () => {},
      },
    };
    const ready = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, quote, quotePhase: "ready" },
        controller,
        payment,
        onBrowse: () => {},
      } as never),
    );
    expect(ready).toMatch(/Pay (?:RM|MYR).*14\.32/);
    expect(ready).not.toContain("memory-only-quote-token");

    const frozen = renderToStaticMarkup(
      createElement(CartScreen, {
        state: { ...base, quote, quotePhase: "ready", paymentFrozen: true },
        controller,
        payment: {
          ...payment,
          state: {
            ...payment.state,
            phase: "pending",
            paymentIntentId: "redacted",
          },
        },
        onBrowse: () => {},
        onChangeAddress: () => {},
      } as never),
    );
    expect(frozen).toContain("Confirming your payment…");
    expect(frozen.match(/disabled=""/g)?.length).toBe(4);
    expect(frozen).toMatch(/aria-label="Change delivery address" disabled=""/);
    expect(frozen.indexOf("Confirming your payment…")).toBeLessThan(
      frozen.indexOf("Deliver to"),
    );
    expect(frozen.indexOf("Confirming your payment…")).toBeLessThan(
      frozen.indexOf("Your items"),
    );
  });

  it("requires explicit acceptance of changed prices", () => {
    const quote = parseQuote(quoteEnvelope());
    quote.items[0] = {
      ...quote.items[0],
      unitPriceMinor: 500,
      lineSubtotalMinor: 1000,
    };
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: {
          ...base,
          quote,
          quotePhase: "price-review",
          priceChanged: true,
        },
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("Your total has changed");
    expect(html).toContain("Continue with");
    expect(html).not.toMatch(/pay|confirm order/i);
  });

  it.each([
    ["CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE", "no longer available"],
    ["CHECKOUT_INSUFFICIENT_STOCK", "stock changed"],
    ["CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH", "store changed"],
    ["CUSTOMER_ADDRESS_CHANGED", "address changed"],
    ["CUSTOMER_ASSIGNMENT_INCOMPLETE", "couldn&#x27;t use this address"],
    [
      "CUSTOMER_NO_SERVICEABLE_OUTLET",
      "Delivery isn&#x27;t available here yet",
    ],
    ["NETWORK_ERROR", "offline"],
    ["REQUEST_TIMEOUT", "timed out"],
    ["INVALID_RESPONSE", "couldn&#x27;t refresh your total"],
    ["CUSTOMER_SESSION_INVALID", "Session expired"],
  ])("renders safe recovery copy for %s", (error, text) => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: {
          ...base,
          quotePhase:
            error === "CUSTOMER_SESSION_INVALID" ? "session-expired" : "error",
          error,
          canRetry: [
            "NETWORK_ERROR",
            "REQUEST_TIMEOUT",
            "INVALID_RESPONSE",
          ].includes(error),
        },
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html.toLowerCase()).toContain(text.toLowerCase());
    expect(html).not.toContain(error);
  });

  it("keeps expired quotes non-actionable until deliberate requote", () => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: {
          ...base,
          quote: parseQuote(quoteEnvelope()),
          quotePhase: "expired",
        },
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("Prices need refreshing");
    expect(html).toContain("Refresh total");
    expect(html).not.toMatch(/pay|confirm order/i);
  });

  it("names the clear-cart consequence in the outlet-switch dialog", () => {
    const html = renderToStaticMarkup(
      createElement(AddressChangeDialog, {
        state: {
          ...base,
          transitionPhase: "confirmation",
          pendingAddress: {
            address: { id: id("d"), label: "Suburb", rowVersion: 3 },
            assignment: {
              ...base.assignment,
              outletId: id("e"),
              outletDisplayName: "Suburb outlet",
              customerAddressId: id("d"),
              addressLabel: "Suburb",
              addressRowVersion: 3,
            },
          },
        },
        controller,
        onCommit: () => {},
      } as never),
    );
    expect(html).toContain("Clear basket and switch address?");
    expect(html).toContain("Suburb outlet");
    expect(html).toContain("Keep current delivery address");
    expect(html).toContain("Use this address &amp; clear basket");
  });

  it.each([
    ["CUSTOMER_ASSIGNMENT_INCOMPLETE", "couldn&#x27;t use this address"],
    [
      "CUSTOMER_NO_SERVICEABLE_OUTLET",
      "Delivery isn&#x27;t available here yet",
    ],
    ["CUSTOMER_ADDRESS_CHANGED", "saved address changed"],
  ])("names address assignment recovery for %s", (error, text) => {
    const html = renderToStaticMarkup(
      createElement(AddressTransitionError, { error }),
    );
    expect(html).toContain(text);
    expect(html).not.toContain(error);
  });
});

it.each(["ready", "price-review", "expired", "error"])(
  "keeps internal checkout concepts out of visible %s copy",
  (quotePhase) => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: {
          ...base,
          quote: quotePhase === "error" ? null : parseQuote(quoteEnvelope()),
          quotePhase,
          error: quotePhase === "error" ? "INVALID_RESPONSE" : null,
          canRetry: quotePhase === "error",
        },
        controller,
        onBrowse: () => {},
      } as never),
    );
    const copy = html.replace(/<[^>]*>/g, " ");
    expect(copy).not.toMatch(
      /quote|assignment|serviceable|trusted|idempotency/i,
    );
    if (quotePhase === "price-review")
      expect(copy).toMatch(/Continue with RM.*\d/);
    if (quotePhase === "error") expect(copy).toContain("Try again");
  },
);
