import { parseQuote } from "./contracts";
import type { CartState } from "./state";
import { id, quoteEnvelope } from "./test-fixtures";
import { smallOrderFee } from "./processing-fee.test-fixtures";

// Reuses the existing synthetic quote/fee contracts. These are the customer's
// supplied amounts, not a new pricing rule or a call to a customer/payment API.
export function biscuitCartState(quantity: 3 | 4, revision: number): CartState {
  const envelope = quoteEnvelope();
  const subtotal = quantity === 3 ? 1650 : 2200;
  const fee = quantity === 3 ? 200 : 0;
  Object.assign(envelope.data.items[0], {
    productNameSnapshot: "Chocolate Biscuit 120g",
    quantity,
    unitPriceMinor: 550,
    lineSubtotalMinor: subtotal,
  });
  Object.assign(envelope.data, {
    quoteId: `20000000-0000-4000-8000-${String(revision).padStart(12, "0")}`,
    itemsSubtotalMinor: subtotal,
    netItemsTotalMinor: subtotal,
    baseDeliveryFeeMinor: 500,
    deliveryDiscountMinor: 500,
    finalDeliveryChargeMinor: 0,
    processingFeeBasisMinor: subtotal,
    processingFeeMinor: fee,
    grandTotalMinor: quantity === 3 ? 1850 : 2200,
    processingFee: smallOrderFee({
      qualifyingAmountMinor: subtotal,
      matchedTier:
        quantity === 3
          ? { fromMinor: 0, belowMinor: 2000, chargeMinor: 200 }
          : null,
      outcome: quantity === 3 ? "CHARGED" : "NO_MATCH",
    }),
  });
  return {
    lines: [
      {
        outletId: id("a"),
        outletProductId: id("2"),
        product: {
          productId: id("3"),
          name: "Chocolate Biscuit 120g",
          imageUrl: null,
          packSize: "120g",
          uom: { code: "PACK", name: "Pack" },
        },
        quantity,
        displayedUnitPriceMinor: 550,
        currency: "MYR",
      },
    ],
    assignment: {
      outletId: id("a"),
      outletDisplayName: "Synthetic QA outlet",
      outletDisplayReference: "QA",
      customerAddressId: id("b"),
      addressLabel: "Synthetic delivery address",
      addressRowVersion: 7,
    },
    pendingAddress: null,
    transitionPhase: "idle",
    transitionError: null,
    quotePhase: "ready",
    quote: parseQuote(envelope),
    error: null,
    canRetry: false,
    priceChanged: false,
    payableTotalChanged: false,
    previousPayableTotalMinor: null,
    paymentFrozen: false,
    basketPhase: "disabled",
    basketRevision: null,
    basketReview: false,
  };
}
