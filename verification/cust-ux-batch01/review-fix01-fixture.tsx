import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CustomerDataController } from "../../src/customer/state";
import { CustomerDataProvider, useCustomer } from "../../src/customer/context";
import {
  syntheticAddress,
  syntheticProfile,
} from "../../src/customer/fixtures";
import { DeliveryAddressPicker } from "../../src/customer/DeliveryAddressPicker";
import { CatalogueController } from "../../src/catalogue/state";
import { CatalogueProvider } from "../../src/catalogue/context";
import { CatalogueError, type CataloguePort } from "../../src/catalogue/api";
import { CartController } from "../../src/checkout/state";
import { CheckoutProvider, useCheckout } from "../../src/checkout/context";
import type { CustomerSessionController } from "../../src/session/controller";
import type { CustomerDataPort } from "../../src/customer/api";
import type { Assignment, Product } from "../../src/catalogue/contracts";
import "../../src/styles.css";
import "../../src/customer/customer.css";
import "../../src/checkout/checkout.css";

// Local fixture: only session/remote ports are doubles. Real controllers,
// providers, picker, dialog and their effects own both decisions.
const authenticated = { phase: "authenticated" };
const session = {
  getSnapshot: () => authenticated,
  subscribe: () => () => {},
} as unknown as CustomerSessionController;
const address = {
  ...syntheticAddress,
  rowVersion: 2,
  latitude: 5.9,
  longitude: 116.1,
};
const customer = new CustomerDataController(
  {
    profile: async () => syntheticProfile,
    addresses: async () => [address],
  } as CustomerDataPort,
  session,
);
const unavailable = async () => {
  throw new CatalogueError("CUSTOMER_NO_SERVICEABLE_OUTLET");
};
const api = {
  assign: unavailable,
  categories: unavailable,
  products: unavailable,
  detail: unavailable,
} satisfies CataloguePort;
const catalogue = new CatalogueController(api);
const cart = new CartController(
  {
    create: async () => {
      throw new Error("No quote in fixture");
    },
  },
  api,
);
const oldAddress = { ...address, rowVersion: 1 };
const assignment: Assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: address.id,
  addressRowVersion: 1,
  outlet: {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Synthetic store",
    displayReference: "DEMO",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 300000).toISOString(),
};
const product: Product = {
  productId: "66666666-6666-4666-8666-666666666666",
  outletProductId: "88888888-8888-4888-8888-888888888888",
  name: "Synthetic rice",
  imageUrl: null,
  category: { id: "77777777-7777-4777-8777-777777777777", name: "Grocery" },
  subcategory: null,
  brand: null,
  uom: { code: "PACK", name: "Pack" },
  packSize: "1 kg",
  sellingPriceMinor: 850,
  currency: "MYR",
  availability: "AVAILABLE",
};
cart.syncAssignment(oldAddress, assignment);
cart.add(product, assignment);
// Existing supported rebind: same address, newer version, retained Basket,
// and no committed checkout assignment. No private state is modified.
cart.bindSelectedAddress(address);
function Journey() {
  const { state } = useCheckout();
  const { state: customerState } = useCustomer();
  const [done, setDone] = useState(0);
  return (
    <>
      <output data-testid="decision-state">
        {JSON.stringify({
          onDoneCount: done,
          selectedId: customerState.selectedId,
          assignment: state.assignment,
          lines: state.lines,
          transitionPhase: state.transitionPhase,
        })}
      </output>
      <DeliveryAddressPicker
        embeddedHost
        onDone={() => {
          setDone((n) => n + 1);
          history.pushState(null, "", "#home");
        }}
        onBack={() => {
          throw new Error("Unexpected Back");
        }}
        onManage={() => {
          throw new Error("Unexpected Manage");
        }}
      />
    </>
  );
}
history.replaceState(null, "", "#delivery-address");
createRoot(document.getElementById("root")!).render(
  <CustomerDataProvider controller={customer}>
    <CatalogueProvider
      controller={catalogue}
      customer={customer}
      session={session}
    >
      <CheckoutProvider controller={cart} customer={customer}>
        <Journey />
      </CheckoutProvider>
    </CatalogueProvider>
  </CustomerDataProvider>,
);
