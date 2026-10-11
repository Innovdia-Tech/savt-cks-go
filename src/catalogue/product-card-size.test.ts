import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProductTile } from "./components";
import type { Product } from "./contracts";

const product: Product = {
  productId: "66666666-6666-4666-8666-666666666666",
  outletProductId: "88888888-8888-4888-8888-888888888888",
  name: "Body Wash 500ml",
  imageUrl: null,
  category: {
    id: "77777777-7777-4777-8777-777777777777",
    name: "Personal care",
  },
  subcategory: null,
  brand: null,
  uom: { code: "BTL", name: "Bottle" },
  packSize: "500 ml",
  sellingPriceMinor: 1090,
  currency: "MYR",
  availability: "AVAILABLE",
};

it.each(["grid", "list"] as const)(
  "%s card retains the official name and price without a Pack Size subtitle",
  (variant) => {
    const html = renderToStaticMarkup(
      createElement(ProductTile, {
        product,
        variant,
        onOpen: () => {},
        onAdd: () => {},
      }),
    );
    expect(html).toContain('class="catalogue-name">Body Wash 500ml</span>');
    expect(html).toContain('aria-label="View Body Wash 500ml"');
    expect(html).toContain("10.90");
    expect(html).toContain(">Add</button>");
    expect(html).toContain("Image unavailable for Body Wash 500ml");
    expect(html).not.toContain("500 ml");
    expect(html).not.toContain("catalogue-unit");
    expect(product.packSize).toBe("500 ml");
  },
);

it.each(["grid", "list"] as const)(
  "%s card does not substitute a UOM subtitle when Pack Size is absent",
  (variant) => {
    const html = renderToStaticMarkup(
      createElement(ProductTile, {
        product: {
          ...product,
          name: "Daily Care Body Wash 500ml",
          packSize: null,
        },
        variant,
        onOpen: () => {},
        quantity: 2,
        onSetQuantity: () => {},
      }),
    );
    expect(html).toContain(
      'class="catalogue-name">Daily Care Body Wash 500ml</span>',
    );
    expect(html).toContain("10.90");
    expect(html).not.toContain("Bottle");
    expect(html).not.toContain("catalogue-unit");
    expect(html).toContain('aria-label="Decrease quantity"');
    expect(html).toContain('aria-label="Increase quantity"');
  },
);
