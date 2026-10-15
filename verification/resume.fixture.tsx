// Local-only synthetic mounted-tree regression. No backend/provider calls.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CustomerSessionBoundary } from "../src/components/session/SessionStatus";
import { CustomerSessionController } from "../src/session/controller";
import { ApiClientError, type CustomerApi } from "../src/api/client";
import type { NativeBridgePort } from "../src/webview/bridge";

const tracker = { mounts: 0, unmounts: 0, grants: 0, exchanges: 0 };
let expired = false,
  offline = false;
let releaseGrant: (() => void) | undefined;
const data = {
  authenticated: true as const,
  csrfToken: "D".repeat(43),
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const api: CustomerApi = {
  status: async () => {
    if (offline) throw new ApiClientError("offline", "NETWORK_ERROR");
    if (expired)
      throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
    return data;
  },
  bootstrap: async () => ({
    protocolVersion: "1",
    launchRequestId: crypto.randomUUID(),
    state: "A".repeat(43),
    codeChallenge: "B".repeat(43),
    codeChallengeMethod: "S256",
    expiresAt: data.expiresAt,
  }),
  exchange: async () => {
    tracker.exchanges++;
    expired = false;
    return data;
  },
  logout: async () => {},
  requestWebOtp: async () => {
    throw new Error("unused");
  },
  authorizeWebOtp: async () => {
    throw new Error("unused");
  },
};
const bridge: NativeBridgePort = {
  requestSessionRecovery: async () => {
    tracker.grants++;
    await new Promise<void>((resolve) => {
      releaseGrant = resolve;
    });
  },
  requestLaunchCode: async (bootstrap) => ({
    protocolVersion: "1",
    launchRequestId: bootstrap.launchRequestId,
    state: bootstrap.state,
    code: "C".repeat(43),
  }),
  notifyLoaded: () => {},
  notifyError: () => {
    throw new Error("Unexpected terminal bridge error");
  },
  requestPaymentHandoff: async () => {
    throw new Error("No payment is permitted in fixture");
  },
};
const controller = new CustomerSessionController(api, bridge, {
  entryMode: "embedded",
});
function Content() {
  const [basket, setBasket] = useState(2);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    tracker.mounts++;
    return () => {
      tracker.unmounts++;
    };
  }, []);
  return (
    <section id="content">
      <p id="basket">Basket: {basket}</p>
      <button id="add" onClick={() => setBasket(basket + 1)}>
        Add
      </button>
      <input
        id="draft"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <span id="pending-payment">Pending payment kept</span>
    </section>
  );
}
Object.assign(window, {
  resumeFixture: {
    tracker,
    controller,
    expire: () => {
      expired = true;
      void controller.resume();
    },
    release: () => releaseGrant?.(),
    offline: () => {
      offline = true;
      void controller.resume();
    },
    online: () => {
      offline = false;
      return controller.resume();
    },
  },
});
createRoot(document.getElementById("root")!).render(
  <CustomerSessionBoundary controller={controller} embeddedHost>
    <Content />
  </CustomerSessionBoundary>,
);
