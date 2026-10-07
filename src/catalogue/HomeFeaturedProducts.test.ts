import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  HomeFeaturedProducts,
  nextFeaturedCount,
} from "./HomeFeaturedProducts";
import type { Product } from "./contracts";

const products = Array.from(
  { length: 24 },
  (_, i) => ({ outletProductId: String(i) }) as Product,
);
const renderProduct = (p: Product) =>
  createElement("div", {
    key: p.outletProductId,
    "data-product": p.outletProductId,
  });
it("initially shows six configured products and an explicit Show more action", () => {
  const html = renderToStaticMarkup(
    createElement(HomeFeaturedProducts, {
      products,
      renderProduct,
      onBrowse: () => {},
    }),
  );
  expect(html.match(/data-product=/g)?.length).toBe(6);
  expect(html).toContain("Show more products");
  expect(html).not.toContain("Browse all products");
});
it("reveals at most 12, 18 and 24 with a finite cap", () => {
  expect([
    nextFeaturedCount(6, 24),
    nextFeaturedCount(12, 24),
    nextFeaturedCount(18, 24),
    nextFeaturedCount(24, 40),
  ]).toEqual([12, 18, 24, 24]);
  expect(nextFeaturedCount(6, 9)).toBe(9);
});
it("hides zero featured items and offers normal Browse after the available set", () => {
  expect(
    renderToStaticMarkup(
      createElement(HomeFeaturedProducts, {
        products: [],
        renderProduct,
        onBrowse: () => {},
      }),
    ),
  ).toBe("");
  const html = renderToStaticMarkup(
    createElement(HomeFeaturedProducts, {
      products: products.slice(0, 3),
      renderProduct,
      onBrowse: () => {},
    }),
  );
  expect(html.match(/data-product=/g)?.length).toBe(3);
  expect(html).toContain("Browse all products");
  expect(html).not.toContain("Show more products");
});
