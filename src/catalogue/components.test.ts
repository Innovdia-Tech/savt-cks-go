import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductTile,
  CatalogueStatus,
  ProductImage,
  money,
  routeTitle,
} from "./components";
const product = {
  productId: "00000000-0000-4000-8000-000000000001",
  outletProductId: "00000000-0000-4000-8000-000000000002",
  name: "Rice",
  imageUrl: null,
  category: { id: "00000000-0000-4000-8000-000000000003", name: "Pantry" },
  subcategory: null,
  brand: null,
  uom: { code: "BAG", name: "Bag" },
  packSize: "1 kg",
  sellingPriceMinor: 1234,
  currency: "MYR" as const,
  availability: "AVAILABLE" as const,
};
it("renders approved price and enables real-cart add only for available products", () => {
  const html = renderToStaticMarkup(
    createElement(ProductTile, {
      product,
      onOpen: () => {},
      onAdd: () => {},
      orderingDisabled: false,
    }),
  );
  expect(html).toContain("Rice");
  expect(html).toContain("12.34");
  expect(html).toContain("ui-status--positive");
  expect(html).toContain("ui-button--primary");
  expect(html).not.toMatch(/<button[^>]+disabled[^>]*>Add/);
  expect(html).toContain("Image unavailable");
  expect(html).not.toMatch(
    /cashback|reward|member price|original price|bestseller|ETA|savings|flash sale/i,
  );
});
it("keeps add disabled for an unavailable outlet product", () => {
  const html = renderToStaticMarkup(
    createElement(ProductTile, {
      product: { ...product, availability: "UNAVAILABLE" },
      onOpen: () => {},
      onAdd: () => {},
      orderingDisabled: false,
    }),
  );
  expect(html).toMatch(/<button[^>]+disabled[^>]*>Add/);
});
it("supports the compact Figma-derived home list-card composition", () => {
  const html = renderToStaticMarkup(
    createElement(ProductTile, {
      product,
      variant: "list",
      onOpen: () => {},
      onAdd: () => {},
    }),
  );

  expect(html).toContain("catalogue-tile--list");
  expect(html).toContain('aria-label="Add Rice to cart"');
  expect(html).toContain('aria-hidden="true">+</span>');
  expect(html).not.toMatch(/points|free delivery|popular/i);
});
it("uses approved returned image URLs without inventing sources", () => {
  const html = renderToStaticMarkup(
    createElement(ProductImage, {
      url: "https://approved.example/rice.jpg",
      name: "Rice",
    }),
  );
  expect(html).toContain('src="https://approved.example/rice.jpg"');
  expect(html).toContain('loading="lazy"');
});
it.each([
  "CUSTOMER_ASSIGNMENT_INCOMPLETE",
  "CUSTOMER_NO_SERVICEABLE_OUTLET",
  "CUSTOMER_ASSIGNMENT_CONTEXT_UNAVAILABLE",
  "NETWORK_ERROR",
  "REQUEST_TIMEOUT",
  "INVALID_RESPONSE",
  "CUSTOMER_PRODUCT_NOT_FOUND",
])("offers an explicit safe %s state", (code) => {
  const html = renderToStaticMarkup(
    createElement(CatalogueStatus, {
      phase: "error",
      error: code,
      onRetry: () => {},
      onManage: () => {},
    }),
  );
  expect(html).toContain('role="status"');
  expect(html).toContain("ui-system-state");
  expect(html).toContain("button");
  expect(html).not.toContain(code);
});
it("formats integer minor units in MYR", () =>
  expect(money(1234)).toMatch(/(?:RM|MYR).*12\.34/));

it.each([
  ["home", "Browse products | CKS Go"],
  ["categories", "Categories | CKS Go"],
  ["cart", "Cart | CKS Go"],
  ["orders", "Orders | CKS Go"],
  ["detail/00000000-0000-4000-8000-000000000001", "Product details | CKS Go"],
  ["order/00000000-0000-4000-8000-000000000001", "Order details | CKS Go"],
  ["profile", "Profile and addresses | CKS Go"],
] as const)("provides an honest title for %s", (route, title) => {
  expect(routeTitle(route)).toBe(title);
});
