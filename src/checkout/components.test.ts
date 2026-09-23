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

describe("real cart and trusted quote presentation", () => {
  it("shows product snapshots and displayed subtotal with an explicit quote action only", () => {
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: base,
        controller,
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("Rice");
    expect(html).toContain("Estimated subtotal");
    expect(html).toMatch(/(?:RM|MYR).*9\.00/);
    expect(html).toContain("Review order");
    expect(html).toContain("Delivery address");
    expect(html).toContain("Demo outlet");
    expect(html).toContain("Line subtotal");
    expect(html).toContain("Remove Rice");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Quantity for Rice"');
    expect(html).not.toMatch(
      /<(?:button|a)[^>]*>[^<]*(?:pay|confirm order|tracking)/i,
    );
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
      "Review your order",
      "Rice",
      "Merchandise subtotal",
      "Delivery fee",
      "Processing fee",
      "Grand total",
      "Estimated delivery",
      "Expires",
      "Home",
      "Demo outlet",
    ])
      expect(html).toContain(text);
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
      },
      controller: {
        initiate: async () => {},
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
      } as never),
    );
    expect(frozen).toContain("Payment pending");
    expect(frozen.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
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
    expect(html).toContain("Review price changes");
    expect(html).toContain("Accept updated prices");
    expect(html).not.toMatch(/pay|confirm order/i);
  });

  it.each([
    ["CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE", "no longer available"],
    ["CHECKOUT_INSUFFICIENT_STOCK", "stock changed"],
    ["CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH", "assigned outlet changed"],
    ["CUSTOMER_ADDRESS_CHANGED", "address changed"],
    ["CUSTOMER_ASSIGNMENT_INCOMPLETE", "assignment could not be completed"],
    ["CUSTOMER_NO_SERVICEABLE_OUTLET", "No serviceable outlet"],
    ["NETWORK_ERROR", "offline"],
    ["REQUEST_TIMEOUT", "timed out"],
    ["INVALID_RESPONSE", "could not safely read"],
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
    expect(html).toContain("Quote expired");
    expect(html).toContain("Get a new quote");
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
    expect(html).toContain("Clear cart and switch address?");
    expect(html).toContain("Suburb outlet");
    expect(html).toContain("Keep current cart");
    expect(html).toContain("Clear cart and switch");
  });

  it.each([
    [
      "CUSTOMER_ASSIGNMENT_INCOMPLETE",
      "assignment provider could not complete",
    ],
    ["CUSTOMER_NO_SERVICEABLE_OUTLET", "No serviceable outlet"],
    ["CUSTOMER_ADDRESS_CHANGED", "saved address changed"],
  ])("names address assignment recovery for %s", (error, text) => {
    const html = renderToStaticMarkup(
      createElement(AddressTransitionError, { error }),
    );
    expect(html).toContain(text);
    expect(html).not.toContain(error);
  });
});
