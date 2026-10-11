import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CustomerDataProvider } from "../../src/customer/context";
import { CustomerDataController } from "../../src/customer/state";
import { CustomerDataError } from "../../src/customer/errors";
import { DeliveryLocationSetup } from "../../src/customer/DeliveryLocationSetup";
import {
  syntheticAddress,
  syntheticProfile,
} from "../../src/customer/fixtures";
import type { CustomerSessionController } from "../../src/session/controller";
import type { PinMapAdapter } from "../../src/location/DeliveryPinMap";

// Mount the real flow/provider/controller. Only external data, map and checkout
// boundaries are fixtures; readiness transitions use the public load operation.
const address = { ...syntheticAddress, latitude: 5.92, longitude: 116.08 };
let mode: "ready" | "loading" | "error" = "ready";
const customer = new CustomerDataController(
  {
    profile: () => {
      if (mode === "loading") return new Promise(() => {});
      if (mode === "error")
        return Promise.reject(
          new CustomerDataError("offline", "NETWORK_ERROR"),
        );
      return Promise.resolve(syntheticProfile);
    },
    addresses: async () => [address],
    mutate: async () => {
      throw new Error("Mutations are outside this ownership fixture");
    },
  },
  {
    subscribe: () => () => {},
    getSnapshot: () => ({ phase: "authenticated" }),
  } as unknown as CustomerSessionController,
);
const pinMapAdapter: PinMapAdapter = {
  mount: async (_element, center, onIdle) => {
    onIdle(center);
    return { recenter: onIdle, dispose: () => {} };
  },
};
function Fixture() {
  const [exited, setExited] = useState(false);
  const [navigations, setNavigations] = useState(0);
  return (
    <CustomerDataProvider controller={customer} pinMapAdapter={pinMapAdapter}>
      {(["loading", "error", "ready"] as const).map((next) => (
        <button
          key={next}
          onClick={() => {
            mode = next;
            void customer.load();
          }}
        >
          Fixture data {next}
        </button>
      ))}
      <output aria-label="Caller navigations">{navigations}</output>
      {exited ? (
        <h1>Delivery address</h1>
      ) : (
        <DeliveryLocationSetup
          initialMode="confirm"
          address={address}
          onDone={() => {}}
          onCancel={() => {
            setNavigations((value) => value + 1);
            setExited(true);
          }}
        />
      )}
    </CustomerDataProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
