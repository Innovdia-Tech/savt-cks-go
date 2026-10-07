import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/Layout";
import { CartScreen } from "../../src/checkout/components";
import { CartController, type CartState } from "../../src/checkout/state";
import { parseQuote } from "../../src/checkout/contracts";
import { id, quoteEnvelope } from "../../src/checkout/test-fixtures";
import "../../src/styles.css";
import "../../src/customer/customer.css";
import "../../src/checkout/checkout.css";

// Actual customer scroll/layout and fee components; synthetic data, no API/native.
const controller = new CartController(
  {
    create: async () => {
      throw new Error("No fixture quote requests");
    },
  },
  {
    assign: async () => {
      throw new Error("No fixture assignments");
    },
  },
);
const envelope = quoteEnvelope();
const data: any = envelope.data;
data.processingFee = {
  feeType: "SMALL_ORDER_TIERS",
  policyKind: "SMALL_ORDER_TIERS",
  enabled: true,
  qualifyingAmountMinor: 2220,
  matchedTier: { fromMinor: 0, belowMinor: 3000, chargeMinor: 900 },
  outcome: "CHARGED",
  feeFreeFromMinor: 3000,
};
data.processingFeeMinor = 200;
data.grandTotalMinor = data.processingFeeBasisMinor + data.processingFeeMinor;
const state: CartState = {
  ...controller.getSnapshot(),
  assignment: {
    outletId: id("a"),
    outletDisplayName: "Synthetic store",
    outletDisplayReference: "TEST",
    customerAddressId: id("b"),
    addressLabel: "Synthetic delivery address",
    addressRowVersion: 7,
  },
  lines: Array.from({ length: 12 }, (_, index) => ({
    outletId: id("a"),
    outletProductId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    product: {
      productId: id("3"),
      name: `Synthetic groceries ${index + 1}`,
      imageUrl: null,
      packSize: "Two packs",
      uom: { code: "PACK", name: "Pack" },
    },
    quantity: 2,
    displayedUnitPriceMinor: 3900,
    currency: "MYR" as const,
  })),
  quotePhase: "ready",
  quote: parseQuote(envelope),
};

createRoot(document.getElementById("root")!).render(
  <AppShell
    active="Basket"
    cartCount={24}
    onNavigate={() => {}}
    headerContext="transaction"
    title="Basket"
    embeddedHost
  >
    <CartScreen state={state} controller={controller} onBrowse={() => {}} />
  </AppShell>,
);
