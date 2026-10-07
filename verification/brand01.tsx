// Synthetic visual proof only; never an authentication/expiry qualification.
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import { AppShell, HeaderActions } from "../src/components/Layout";
import {
  CustomerSessionBoundary,
  StoreLoading,
  WebOtpEntry,
} from "../src/components/session/SessionStatus";
import type { CustomerSessionController } from "../src/session/controller";
import "../src/styles.css";
import "../src/customer/customer.css";
import "../src/catalogue/catalogue.css";

const screen = new URLSearchParams(location.search).get("screen") ?? "header";
const offline = { phase: "offline" } as const;
const loading = { phase: "loading" } as const;
const controller = {
  getSnapshot: () => offline,
  subscribe: () => () => {},
  start: async () => {},
  retry: async () => {},
  resendRemainingSeconds: () => 0,
  retryRemainingSeconds: () => 0,
} as unknown as CustomerSessionController;

function Proof() {
  useEffect(() => {
    document.documentElement.dataset.brand01Ready = "true";
  }, []);
  if (screen === "loading") return <StoreLoading />;
  if (screen === "embedded-loading")
    return (
      <CustomerSessionBoundary
        controller={
          {
            ...controller,
            getSnapshot: () => loading,
          } as CustomerSessionController
        }
        embeddedHost
      >
        Loaded content
      </CustomerSessionBoundary>
    );
  if (screen === "entry")
    return (
      <WebOtpEntry
        controller={controller}
        state={{ phase: "awaitingMobile" }}
      />
    );
  if (screen === "error")
    return (
      <CustomerSessionBoundary controller={controller}>
        Loaded content
      </CustomerSessionBoundary>
    );
  if (screen === "embedded")
    return (
      <AppShell
        active="Orders"
        cartCount={0}
        onNavigate={() => {}}
        title="Orders"
        headerContext="orders"
        embeddedHost
      >
        <p className="p-4">Local shell containment proof</p>
      </AppShell>
    );
  return (
    <main className="app-viewport">
      <section className="app-shell app-shell--shopping">
        <header className="app-header app-header--home">
          <HeaderActions context="home" onLogout={() => {}} />
        </header>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Proof />);
