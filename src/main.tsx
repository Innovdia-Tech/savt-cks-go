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
import { CustomerSessionController } from "./session/controller";
import {
  DevelopmentBridgeAdapter,
  FlutterBridgeAdapter,
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

const root = createRoot(document.getElementById("root")!);

async function start() {
  try {
    const production = import.meta.env.PROD;
    const config = loadRuntimeConfig(import.meta.env, production);
    const api = config.developmentApi
      ? new DevelopmentCustomerApi(production)
      : new CustomerApiClient(config.apiOrigin);
    const bridge = config.developmentBridge
      ? new DevelopmentBridgeAdapter(true, production)
      : new FlutterBridgeAdapter();
    const session = new CustomerSessionController(api, bridge);

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
      () => checkout.clear(),
    );
    root.render(
      <React.StrictMode>
        <CustomerSessionBoundary controller={session}>
          <CustomerDataProvider controller={customer} development={development}>
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
                  />
                ) : undefined
              }
            >
              <CheckoutProvider controller={checkout} customer={customer}>
                <PaymentProvider controller={payment}>
                  <App onLogout={() => void session.logout()} />
                </PaymentProvider>
              </CheckoutProvider>
            </CatalogueProvider>
          </CustomerDataProvider>
        </CustomerSessionBoundary>
      </React.StrictMode>,
    );
  } catch {
    root.render(
      <main className="grid min-h-dvh place-items-center bg-[#EAF2ED] px-5 text-center">
        <section className="max-w-sm rounded-[32px] bg-white p-7 shadow-lift">
          <h1 className="text-2xl font-black text-slate-950">
            Unable to open CKS Go
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            The customer application configuration is invalid. Return to Savt
            and try again later.
          </p>
        </section>
      </main>,
    );
  }
}
void start();
