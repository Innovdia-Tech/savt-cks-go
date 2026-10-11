import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProductTile } from "../../src/catalogue/components";
import type { Product } from "../../src/catalogue/contracts";
import "../../src/styles.css";
import "../../src/catalogue/catalogue.css";

const product: Product = {
  productId: "66666666-6666-4666-8666-666666666666",
  outletProductId: "88888888-8888-4888-8888-888888888888",
  name: "Body Wash 500ml",
  imageUrl:
    "/api/v1/product-media/66666666-6666-4666-8666-666666666666/44444444-4444-4444-8444-444444444444",
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
const products: Product[] = [
  product,
  {
    ...product,
    outletProductId: "88888888-8888-4888-8888-888888888889",
    name: "Gentle Daily Care Body Wash 500ml",
    packSize: null,
  },
  {
    ...product,
    outletProductId: "88888888-8888-4888-8888-888888888880",
    name: "Dishwashing Liquid 900ml",
    availability: "UNAVAILABLE",
  },
];

function Fixture() {
  const [quantities, setQuantities] = useState<Record<string, number | null>>({
    [products[1].outletProductId]: 2,
  });
  return (
    <main style={{ padding: 16 }}>
      <h1>Shared list presentation</h1>
      <section className="catalogue-list" data-presentation="list">
        {products.map((item) => (
          <ProductTile
            key={item.outletProductId}
            product={item}
            variant="list"
            onOpen={() => {}}
            onAdd={() =>
              setQuantities((current) => ({
                ...current,
                [item.outletProductId]: 1,
              }))
            }
            quantity={quantities[item.outletProductId] ?? null}
            onSetQuantity={(value) =>
              setQuantities((current) => ({
                ...current,
                [item.outletProductId]: value || null,
              }))
            }
          />
        ))}
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
