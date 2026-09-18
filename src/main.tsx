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

const root = createRoot(document.getElementById("root")!);

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

  root.render(
    <React.StrictMode>
      <CustomerSessionBoundary controller={session}>
        <App onLogout={() => void session.logout()} />
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
          The customer application configuration is invalid. Return to Savt and
          try again later.
        </p>
      </section>
    </main>,
  );
}
