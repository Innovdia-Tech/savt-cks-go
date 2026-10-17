// Local verification only; this entry is not imported by the production app.
import React from "react";
import { createRoot } from "react-dom/client";
import { CheckoutPolicyPayment } from "../../src/legal/CheckoutPolicyPayment";
import { PolicyGatewayProvider } from "../../src/legal/context";
import { POLICY_KINDS, type PolicyGateway } from "../../src/legal/contracts";
import "../../src/styles.css";
import "../../src/customer/customer.css";
import "../../src/checkout/checkout.css";

const scenario = new URLSearchParams(window.location.search).get("scenario");
const fixture = {
  version: "test-v1",
  offline: scenario === "offline",
  delay: 0,
  initiations: 0,
  acceptances: 0,
};
Object.assign(window, { __legalFixture: fixture });
const documents = () =>
  POLICY_KINDS.map((kind) => ({
    kind,
    version: fixture.version,
    status: "published",
    publishedAt: "2026-01-01T00:00:00Z",
    effectiveAt: "2026-01-02T00:00:00Z",
    content:
      "LOCAL TEST FIXTURE — NOT A LEGAL DOCUMENT.\n\n" +
      Array.from(
        { length: 12 },
        (_, i) =>
          `Reader layout sample ${i + 1}. This is non-legal placeholder text used only to verify scrolling and preserved checkout state.`,
      ).join("\n\n"),
  }));
const expiresAt = new Date(Date.now() + 600_000).toISOString();
const gateway: PolicyGateway = {
  listPublished: async () => {
    if (fixture.offline) throw new Error("Fixture offline");
    return documents();
  },
  checkoutRequirement: async (quoteId) => {
    if (scenario === "pending")
      await new Promise((resolve) => setTimeout(resolve, 8_000));
    if (fixture.offline) throw new Error("Fixture offline");
    return {
      mode: "required",
      enforcementReady: true,
      quoteId,
      checkoutAttemptId: "local-attempt",
      requirementId: fixture.version,
      expiresAt,
      policies: documents(),
    };
  },
  recordAcceptance: async (request) => {
    fixture.acceptances += 1;
    await new Promise((resolve) => setTimeout(resolve, fixture.delay));
    if (fixture.offline) throw new Error("Fixture offline");
    return {
      ...request,
      acceptanceId: "local-fixture-receipt",
      acceptedAt: new Date().toISOString(),
      expiresAt,
    };
  },
};
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main className="app-viewport">
      <section className="app-shell">
        <div className="app-shell__scroll" style={{ padding: 20 }}>
          <p>LOCAL UI TEST · synthetic policy metadata</p>
          <h1 className="text-xl font-bold">Checkout agreement</h1>
          <PolicyGatewayProvider gateway={gateway}>
            <CheckoutPolicyPayment
              quoteId="local-quote"
              acceptedTotalMinor={1432}
              onInitiate={async () => {
                fixture.initiations += 1;
                await new Promise((resolve) => setTimeout(resolve, 300));
              }}
            />
          </PolicyGatewayProvider>
          <output id="fixture-result" />
        </div>
      </section>
    </main>
  </React.StrictMode>,
);
