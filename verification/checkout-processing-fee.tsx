// Local synthetic acceptance entry; excluded from the production build.
import { createElement, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { Address } from "../src/addresses/contracts";
import type { Assignment } from "../src/catalogue/contracts";
import { DevelopmentCustomerApi } from "../src/api/development";
import { QuoteApi } from "../src/checkout/api";
import { CartScreen } from "../src/checkout/components";
import { CartController } from "../src/checkout/state";
import {
  id,
  minimumQuoteEnvelope,
  quoteEnvelope,
} from "../src/checkout/test-fixtures";
import { CustomerSessionController } from "../src/session/controller";
import { DevelopmentBridgeAdapter } from "../src/webview/bridge";
import "../src/styles.css";
import "../src/checkout/checkout.css";

const scenario = new URLSearchParams(location.search).get("scenario");
const value =
  scenario === "rm100"
    ? minimumQuoteEnvelope(10000)
    : scenario === "rm50" || scenario === "authoritative"
      ? minimumQuoteEnvelope(5000)
      : quoteEnvelope();
const quote = value.data;
const address: Address = {
  id: id("b"),
  label: "Home",
  rowVersion: 7,
  status: "ACTIVE",
  recipientName: "Fixture Customer",
  recipientPhoneE164: null,
  addressLine1: "Local fixture address",
  addressLine2: null,
  city: "Tuaran",
  state: "Sabah",
  postcode: null,
  countryCode: "MY",
  deliveryInstructions: null,
  latitude: 5.95,
  longitude: 116.07,
  isDefault: true,
  createdAt: quote.quoteIssuedAt,
  updatedAt: quote.quoteIssuedAt,
};
const assignment: Assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: address.id,
  addressRowVersion: address.rowVersion,
  outlet: {
    id: id("a"),
    displayReference: "LOCAL",
    displayName: "Local fixture outlet",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: quote.quoteIssuedAt,
  expiresAt: quote.quoteExpiresAt,
};
const session = new CustomerSessionController(
  new DevelopmentCustomerApi(false),
  new DevelopmentBridgeAdapter(true, false),
);
await session.start();
const controller = new CartController(
  new QuoteApi("", session),
  { assign: async () => assignment },
  () => Date.parse(quote.quoteIssuedAt),
);
controller.syncAssignment(address, assignment);
controller.add(
  {
    outletProductId: id("2"),
    productId: id("3"),
    name: "Rice",
    imageUrl: null,
    category: { id: id("4"), name: "Pantry" },
    subcategory: null,
    brand: null,
    uom: { code: "PACK", name: "Pack" },
    packSize: "1 kg",
    sellingPriceMinor: quote.items[0].unitPriceMinor,
    currency: "MYR",
    availability: "AVAILABLE",
  },
  assignment,
);
controller.setQuantity(id("2"), quote.items[0].quantity);
function Proof() {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  return createElement(CartScreen, {
    state,
    controller,
    onBrowse: () => {},
  });
}
createRoot(document.getElementById("root")!).render(createElement(Proof));
