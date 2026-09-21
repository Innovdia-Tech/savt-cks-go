import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductTile,
  CatalogueStatus,
  ProductImage,
  money,
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
it("renders only approved price and disabled commerce with neutral images", () => {
  const html = renderToStaticMarkup(
    createElement(ProductTile, { product, onOpen: () => {} }),
  );
  expect(html).toContain("Rice");
  expect(html).toContain("12.34");
  expect(html).toContain("disabled");
  expect(html).toContain("Image unavailable");
  expect(html).not.toMatch(
    /cashback|reward|member price|original price|bestseller|ETA|savings|flash sale/i,
  );
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
  expect(html).toContain("button");
  expect(html).not.toContain(code);
});
it("formats integer minor units in MYR", () =>
  expect(money(1234)).toMatch(/(?:RM|MYR).*12\.34/));
