import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BasketCheckoutAction, CartScreen } from "../checkout/components";
import { CartController, type CartState } from "../checkout/state";
import { parseQuote } from "../checkout/contracts";
import { id, quoteEnvelope } from "../checkout/test-fixtures";

const controller = new CartController({ create: vi.fn() }, { assign: vi.fn() });
const state = (overrides: Partial<CartState> = {}): CartState => ({
  ...controller.getSnapshot(),
  basketPhase: "saved",
  lines: [
    {
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
    },
  ],
  assignment: {
    outletId: id("a"),
    outletDisplayName: "Demo outlet",
    outletDisplayReference: "DEMO",
    customerAddressId: id("b"),
    addressLabel: "Home",
    addressRowVersion: 7,
  },
  ...overrides,
});
const action = (overrides: Partial<CartState> = {}) =>
  renderToStaticMarkup(
    createElement(BasketCheckoutAction, {
      state: state(overrides),
      controller,
      placement: "shell",
    }),
  );

describe("Basket checkout placement", () => {
  it("moves the same explicit Checkout action out of the summary without quoting on render", () => {
    const request = vi.spyOn(controller, "requestQuote");
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: state(),
        controller,
        checkoutActionPlacement: "shell",
        onBrowse: vi.fn(),
      }),
    );
    expect(html).toContain("Order summary");
    expect(html).not.toContain(">Checkout</button>");
    expect(action()).toContain(">Checkout</button>");
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });

  it.each<Partial<CartState>>([
    { assignment: null },
    { paymentFrozen: true },
    { basketPhase: "loading" },
    { basketPhase: "restore-error" },
    { basketPhase: "conflict" },
  ])("preserves the existing mutation guard for %j", (overrides) => {
    expect(action(overrides)).toContain("disabled");
  });

  it("does not offer duplicate checkout for an empty basket or an existing quote", () => {
    expect(action({ lines: [] })).toBe("");
    expect(
      action({ quote: parseQuote(quoteEnvelope()), quotePhase: "ready" }),
    ).toBe("");
  });

  it("keeps quote-in-progress feedback in the same footer without another action", () => {
    const html = action({ quotePhase: "quoting" });
    expect(html).toContain('role="status"');
    expect(html).toContain("Checking prices and delivery…");
    expect(html).not.toContain("<button");
  });
});
