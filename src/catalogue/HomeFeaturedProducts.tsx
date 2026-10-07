import { useState, type ReactNode } from "react";
import type { Product } from "./contracts";

export const nextFeaturedCount = (current: number, total: number) =>
  Math.min(current + 6, total, 24);

export function HomeFeaturedProducts({
  products,
  renderProduct,
  onBrowse,
}: {
  products: readonly Product[];
  renderProduct: (product: Product) => ReactNode;
  onBrowse: () => void;
}) {
  const [count, setCount] = useState(6);
  const total = Math.min(products.length, 24);
  if (!total) return null;
  return (
    <section
      className="catalogue-home-featured"
      aria-labelledby="featured-products-title"
    >
      <div className="catalogue-section-heading catalogue-products-heading">
        <h2 id="featured-products-title">Featured products</h2>
      </div>
      <div className="catalogue-grid">
        {products.slice(0, Math.min(count, 24)).map(renderProduct)}
      </div>
      <div className="catalogue-featured-actions">
        {count < total ? (
          <button
            type="button"
            className="catalogue-link"
            onClick={() => setCount((value) => nextFeaturedCount(value, total))}
          >
            Show more products
          </button>
        ) : (
          <button type="button" className="catalogue-link" onClick={onBrowse}>
            Browse all products
          </button>
        )}
      </div>
    </section>
  );
}
