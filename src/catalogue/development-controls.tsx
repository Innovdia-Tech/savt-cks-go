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
import type { PaymentController } from "../payment/state";
import type { DevelopmentBridgeAdapter } from "../webview/bridge";
import type {
  DevelopmentCurrentLocation,
  DevelopmentGpsMode,
} from "../location/development";
export function DevelopmentControls({
  adapter,
  customer,
  catalogue,
  payment,
  bridge,
  currentLocation,
}: {
  adapter: DevelopmentCatalogueAdapter;
  customer: CustomerDataController;
  catalogue: CatalogueController;
  payment: PaymentController;
  bridge?: DevelopmentBridgeAdapter;
  currentLocation?: DevelopmentCurrentLocation;
}) {
  const [value, setValue] = useState(adapter.currentScenario());
  const [paymentResult, setPaymentResult] = useState<PaymentResultScenario>(
    adapter.currentPaymentResult(),
  );
  const [orderResult, setOrderResult] = useState<OrderScenario>(
    adapter.currentOrderScenario(),
  );
  const metrics = adapter.paymentMetrics();
  const [gpsMode, setGpsMode] = useState<DevelopmentGpsMode>("available");
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
          const url = new URL(window.location.href);
          if (e.target.value === "ux03-reference-match")
            url.searchParams.set("scenario", e.target.value);
          else url.searchParams.delete("scenario");
          window.history.replaceState(null, "", url);
          void customer.load();
        }}
      >
        {scenarios.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {currentLocation && (
        <>
          <label htmlFor="location-result">Synthetic current location</label>
          <select
            id="location-result"
            value={gpsMode}
            onChange={(event) => {
              const mode = event.target.value as DevelopmentGpsMode;
              setGpsMode(mode);
              currentLocation.setMode(mode);
            }}
          >
            <option value="available">Available</option>
            <option value="denied">Denied</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </>
      )}
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
      <button onClick={() => void payment.handleReturn()}>
        Simulate return from payment
      </button>
      {bridge && (
        <button onClick={() => bridge.failNextPaymentHandoff()}>
          Fail next secure-payment handoff
        </button>
      )}
      <p>
        {value === "ux03-reference-match"
          ? "Design preview — sample products and amounts. "
          : "Local fixtures only. "}
        Payment create POSTs: {metrics.creates}; result GETs: {metrics.results};
        direct provider calls: {metrics.directProviderCalls}; browser Order
        POSTs: {metrics.browserOrderPosts}.
      </p>
    </details>
  );
}
