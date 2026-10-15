import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CartScreen } from "./components";
import { parseQuote } from "./contracts";
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
  currency: "MYR",
};
const render = (quote: unknown, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(CartScreen, {
      state: {
        lines: [line],
        assignment: null,
        pendingAddress: null,
        transitionPhase: "idle",
        transitionError: null,
        quotePhase: "ready",
        quote,
        error: null,
        canRetry: false,
        paymentFrozen: false,
        ...extra,
      },
      controller: {},
      onBrowse() {},
    } as never),
  );

describe("approved compact checkout refinement", () => {
  it.each([
    [0, 490],
    [200, 290],
    [490, 0],
  ])("shows one payable delivery row for discount %i", (discount, payable) => {
    const envelope = quoteEnvelope();
    Object.assign(envelope.data, {
      deliveryDiscountMinor: discount,
      finalDeliveryChargeMinor: payable,
      processingFeeBasisMinor: 900 + payable,
      grandTotalMinor: 942 + payable,
    });
    const html = render(parseQuote(envelope));
    expect(html).toContain('aria-label="About delivery fee"');
    expect(html).not.toContain("Standard delivery</dt>");
    expect(html).not.toContain("Delivery charged</dt>");
    expect(html.match(/class="quote-delivery-charge"/g)).toHaveLength(1);
    expect(html).toContain(
      payable === 0 ? ">FREE<" : (payable / 100).toFixed(2),
    );
    if (discount > 0) expect(html).toMatch(/<s[^>]*>RM[^<]*4\.90<\/s>/);
    else expect(html).not.toMatch(/<s[ >]/);
    expect(html).toContain("Grand total");
  });
  it("omits a zero small-order fee row and unearned policy copy", () => {
    const quote = quoteEnvelope().data;
    Object.assign(quote, {
      processingFeeMinor: 0,
      processingFee: {
        feeType: "SMALL_ORDER_TIERS",
        policyKind: "SMALL_ORDER_TIERS",
        enabled: false,
        qualifyingAmountMinor: 900,
        matchedTier: null,
        outcome: "DISABLED",
        feeFreeFromMinor: null,
      },
    });
    const html = render(quote);
    expect(html).not.toContain("Small order fee");
    expect(html).not.toContain("Small order fee is currently not applied");
  });
  it("keeps estimated delivery outside the secondary expiry disclosure", () => {
    const html = render(parseQuote(quoteEnvelope()));
    expect(html.indexOf("Estimated delivery")).toBeLessThan(
      html.indexOf("<details"),
    );
    expect(html).toContain("Prices valid until");
  });
  it("names a stock-affected basket line and preserves decrement and removal", () => {
    const html = render(null, {
      quotePhase: "error",
      error: "CHECKOUT_INSUFFICIENT_STOCK",
      affectedOutletProductId: id("2"),
    });
    expect(html).toContain("Rice: The available stock changed");
    expect(html).toMatch(
      /<button[^>]*aria-label="Increase quantity"[^>]*disabled/,
    );
    expect(html).not.toMatch(
      /<button[^>]*aria-label="Decrease quantity"[^>]*disabled/,
    );
    expect(html).toContain('aria-label="Remove Rice"');
  });
  it.each(["expired", "price-review"])(
    "does not offer payment before quote phase %s is ready",
    (quotePhase) => {
      const html = renderToStaticMarkup(
        createElement(CartScreen, {
          state: {
            lines: [line],
            quote: parseQuote(quoteEnvelope()),
            quotePhase,
            error: null,
          },
          controller: {},
          onBrowse() {},
          payment: { state: { phase: "ready" }, controller: {} },
        } as never),
      );
      expect(html).not.toContain("Pay RM");
      expect(html).toContain(
        quotePhase === "expired" ? "Refresh total" : "Continue with",
      );
    },
  );
});
