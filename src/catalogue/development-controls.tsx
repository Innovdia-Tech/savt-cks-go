import { useState } from "react";
import { scenarios, type DevelopmentCatalogueAdapter } from "./development";
import type { CustomerDataController } from "../customer/state";
import type { CatalogueController } from "./state";
export function DevelopmentControls({
  adapter,
  customer,
  catalogue,
}: {
  adapter: DevelopmentCatalogueAdapter;
  customer: CustomerDataController;
  catalogue: CatalogueController;
}) {
  const [value, setValue] = useState("success");
  return (
    <details className="catalogue-dev">
      <summary>Synthetic development fixtures</summary>
      <label htmlFor="catalogue-scenario">Catalogue scenario</label>
      <select
        id="catalogue-scenario"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          adapter.reset(e.target.value);
          void customer.load();
        }}
      >
        {scenarios.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <button
        onClick={() => {
          adapter.expire();
          void catalogue.retry();
        }}
      >
        Expire context and renew
      </button>
      <p>Local fixtures only. No live catalogue or commerce requests.</p>
    </details>
  );
}
