import { CatalogueApi } from "./catalogue/api";
import { CatalogueController } from "./catalogue/state";
import { CatalogueProvider } from "./catalogue/context";
import "./catalogue/catalogue.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CustomerApiClient } from "./api/client";
import { DevelopmentCustomerApi } from "./api/development";
import { loadRuntimeConfig } from "./api/runtimeConfig";
import { CustomerSessionBoundary } from "./components/session/SessionStatus";
import { SystemState } from "./components/ui";
import { CustomerSessionController } from "./session/controller";
import {
  DevelopmentBridgeAdapter,
  selectCustomerBridge,
} from "./webview/bridge";
import "./styles.css";
import "./customer/customer.css";
import { CustomerDataApi } from "./customer/api";
import { CustomerDataController } from "./customer/state";
import { CustomerDataProvider } from "./customer/context";
import { QuoteApi } from "./checkout/api";
import { CartController } from "./checkout/state";
import { CheckoutProvider } from "./checkout/context";
import { PaymentApi } from "./payment/api";
import { PaymentProvider } from "./payment/context";
import { PaymentController } from "./payment/state";
import "./checkout/checkout.css";
import { OrdersApi } from "./orders/api";
import { OrdersController } from "./orders/state";
import { OrdersProvider } from "./orders/context";
import "./orders/orders.css";
import { LocationSearchApi } from "./location/api";
import { googlePinMapAdapter } from "./location/DeliveryPinMap";
import { SupportProvider } from "./support/context";

const root = createRoot(document.getElementById("root")!);

async function start() {
  try {
    const production = import.meta.env.PROD;
    const config = loadRuntimeConfig(import.meta.env, production);
    const api = config.developmentApi
      ? new DevelopmentCustomerApi(production)
      : new CustomerApiClient(config.apiOrigin);
    const embeddedHost = Boolean(window.SavtCksGoBridge);
    const bridge = selectCustomerBridge(
      embeddedHost,
      config.developmentBridge,
      production,
    );
    const session = new CustomerSessionController(api, bridge, {
      entryMode: embeddedHost ? "embedded" : "standalone",
    });

    const development =
      import.meta.env.DEV && config.developmentApi
        ? new (await import("./customer/development")).DevelopmentDataAdapter(
            production,
          )
        : undefined;
    const catalogueDevelopment =
      import.meta.env.DEV && config.developmentApi
        ? new (
            await import("./catalogue/development")
          ).DevelopmentCatalogueAdapter(production)
        : undefined;
    const localScenario = new URLSearchParams(window.location.search).get(
      "scenario",
    );
    if (
      import.meta.env.DEV &&
      catalogueDevelopment &&
      (localScenario === "ux03-reference-match" ||
        localScenario === "cust-shop01" ||
        localScenario === "cust-shop01-no-frozen" ||
        localScenario === "cust-shop01-images" ||
        localScenario === "cust-shop01r" ||
        localScenario === "cust-shop01r-no-frozen")
    )
      catalogueDevelopment.reset(localScenario);
    const DevelopmentControls =
      import.meta.env.DEV && config.developmentApi
        ? (await import("./catalogue/development-controls")).DevelopmentControls
        : undefined;
    const customer = new CustomerDataController(
      new CustomerDataApi(
        config.apiOrigin,
        session,
        development && catalogueDevelopment
          ? catalogueDevelopment.customerFetch(development.fetch)
          : development?.fetch,
      ),
      session,
    );
    catalogueDevelopment?.setAddressLookup((id) =>
      customer.getSnapshot().addresses.find((address) => address.id === id),
    );
    const locationSearch = development
      ? new (await import("./location/development")).DevelopmentLocationSearch()
      : new LocationSearchApi(config.apiOrigin, session);
    const currentLocation = development
      ? new (
          await import("./location/development")
        ).DevelopmentCurrentLocation()
      : undefined;
    const pinMapAdapter = development
      ? (await import("./location/development-map")).developmentPinMapAdapter
      : googlePinMapAdapter(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? "");
    const catalogueApi = new CatalogueApi(
      config.apiOrigin,
      session,
      catalogueDevelopment?.fetch,
    );
    const catalogue = new CatalogueController(catalogueApi, Date.now, () =>
      customer.load(),
    );
    const checkout = new CartController(
      new QuoteApi(config.apiOrigin, session, catalogueDevelopment?.fetch),
      catalogueApi,
    );
    const payment = new PaymentController(
      new PaymentApi(config.apiOrigin, session, catalogueDevelopment?.fetch),
      bridge,
      session,
      (quoteId) => checkout.freezeForPayment(quoteId),
      (preserveBasket) =>
        preserveBasket
          ? checkout.recoverBasketAfterPayment()
          : checkout.clear(),
    );
    const orders = new OrdersController(
      new OrdersApi(config.apiOrigin, session, catalogueDevelopment?.fetch),
      session,
    );
    root.render(
      <React.StrictMode>
        <CustomerSessionBoundary
          controller={session}
          embeddedHost={embeddedHost}
        >
          <CustomerDataProvider
            controller={customer}
            development={development}
            locationSearch={locationSearch}
            currentLocation={currentLocation}
            pinMapAdapter={pinMapAdapter}
          >
            <CatalogueProvider
              controller={catalogue}
              customer={customer}
              session={session}
              controls={
                catalogueDevelopment && DevelopmentControls ? (
                  <DevelopmentControls
                    adapter={catalogueDevelopment}
                    customer={customer}
                    catalogue={catalogue}
                    payment={payment}
                    currentLocation={currentLocation}
                    bridge={
                      bridge instanceof DevelopmentBridgeAdapter
                        ? bridge
                        : undefined
                    }
                  />
                ) : undefined
              }
            >
              <CheckoutProvider controller={checkout} customer={customer}>
                <PaymentProvider controller={payment}>
                  <OrdersProvider controller={orders}>
                    <SupportProvider
                      origin={config.apiOrigin}
                      session={session}
                    >
                      <App
                        onLogout={() => void session.logout()}
                        embeddedHost={embeddedHost}
                      />
                    </SupportProvider>
                  </OrdersProvider>
                </PaymentProvider>
              </CheckoutProvider>
            </CatalogueProvider>
          </CustomerDataProvider>
        </CustomerSessionBoundary>
      </React.StrictMode>,
    );
  } catch {
    root.render(
      <main className="grid min-h-dvh place-items-center bg-app-background px-5">
        <SystemState
          tone="error"
          title="Unable to open CKS Go"
          description="Return to Savt and try again later."
        />
      </main>,
    );
  }
}
void start();
