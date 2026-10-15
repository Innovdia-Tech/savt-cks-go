import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CartScreen } from "../checkout/components";
import { CartController } from "../checkout/state";
describe("saved basket feedback", () => {
  it("keeps a successfully saved draft quiet without hiding recovery errors", () => {
    const cart = new CartController({ create: vi.fn() }, { assign: vi.fn() });
    cart.setBasketStatus("saved");
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: cart.getSnapshot(),
        controller: cart,
        onBrowse: vi.fn(),
      }),
    );
    expect(html).not.toContain("Basket saved");
    expect(html).toContain("Your basket is empty");
  });

  it("does not present an empty basket while restoration is loading or failed", () => {
    const cart = new CartController({ create: vi.fn() }, { assign: vi.fn() });
    for (const phase of ["loading", "restore-error"] as const) {
      cart.setBasketStatus(phase);
      const html = renderToStaticMarkup(
        createElement(CartScreen, {
          state: cart.getSnapshot(),
          controller: cart,
          onBrowse: vi.fn(),
        }),
      );
      expect(html).not.toContain("Your basket is empty");
      expect(html).not.toContain("Basket saved");
      expect(html).toContain(
        phase === "loading" ? "Loading your saved basket" : "Try again",
      );
    }
  });
  it("keeps clear-save failures actionable even when there are no lines", () => {
    const cart = new CartController({ create: vi.fn() }, { assign: vi.fn() });
    cart.setBasketStatus("save-error");
    const html = renderToStaticMarkup(
      createElement(CartScreen, {
        state: cart.getSnapshot(),
        controller: cart,
        onBrowse: vi.fn(),
      }),
    );
    expect(html).toContain("Try saving again");
    expect(html).not.toContain("Basket saved");
  });
});
