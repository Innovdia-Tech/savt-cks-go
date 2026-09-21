import { useState } from "react";
import {
  paymentResultScenarios,
  orderScenarios,
  scenarios,
  type DevelopmentCatalogueAdapter,
  type OrderScenario,
  type PaymentResultScenario,
} from "./development";
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
  const [paymentResult, setPaymentResult] =
    useState<PaymentResultScenario>("pending");
  const [orderResult, setOrderResult] = useState<OrderScenario>("active");
  const metrics = adapter.paymentMetrics();
  return (
    <details className="catalogue-dev">
      <summary>Synthetic development fixtures</summary>
      <label htmlFor="catalogue-scenario">Catalogue and quote scenario</label>
      <select
        id="catalogue-scenario"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setPaymentResult("pending");
          setOrderResult("active");
          adapter.reset(e.target.value);
          void customer.load();
        }}
      >
        {scenarios.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label htmlFor="order-result">Customer orders</label>
      <select
        id="order-result"
        value={orderResult}
        onChange={(event) => {
          const result = event.target.value as OrderScenario;
          setOrderResult(result);
          adapter.setOrderScenario(result);
        }}
      >
        {orderScenarios.map((result) => (
          <option key={result}>{result}</option>
        ))}
      </select>
      <label htmlFor="payment-result">Backend payment result</label>
      <select
        id="payment-result"
        value={paymentResult}
        onChange={(event) => {
          const result = event.target.value as PaymentResultScenario;
          setPaymentResult(result);
          adapter.setPaymentResult(result);
        }}
      >
        {paymentResultScenarios.map((result) => (
          <option key={result}>{result}</option>
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
      <p>
        Local fixtures only. Payment create POSTs: {metrics.creates}; result
        GETs: {metrics.results}; direct provider calls:{" "}
        {metrics.directProviderCalls}; browser Order POSTs:{" "}
        {metrics.browserOrderPosts}.
      </p>
    </details>
  );
}
