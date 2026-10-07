import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { CartController, type CartState } from "../../src/checkout/state";
import { parseQuote, type CheckoutQuote } from "../../src/checkout/contracts";
import { id, quoteEnvelope } from "../../src/checkout/test-fixtures";
import "../../src/styles.css";
import "../../src/customer/customer.css";
import "../../src/checkout/checkout.css";

// Synthetic presentation evidence only. No app bootstrap, API or bridge is used.
const parameters = new URLSearchParams(window.location.search);
const parseFixtures = parameters.get("parse") === "1";
const baselineModule = "./.cache/baseline-components.tsx";
const { CartScreen } =
  parameters.get("baseline") === "1"
    ? await import(/* @vite-ignore */ baselineModule)
    : await import("../../src/checkout/components");
const controller = new CartController(
  {
    create: async () => {
      throw new Error("Fixture must not request a quote");
    },
  },
  {
    assign: async () => {
      throw new Error("Fixture must not assign an address");
    },
  },
);

function fixtureQuote(scenario: string): CheckoutQuote | null {
  if (scenario === "invalidated") return null;
  const envelope = quoteEnvelope();
  const data: any = envelope.data;
  // Deliberately distinct authoritative fields detect using cart/total/delivery
  // as the qualifying amount, or using matched tier charge as the payable fee.
  data.baseDeliveryFeeMinor = 4990;
  data.finalDeliveryChargeMinor = 4990;
  data.processingFeeBasisMinor = 5890;
  if (scenario === "legacy-percentage") {
    data.processingFeeMinor = 42;
  } else if (scenario === "legacy-fixed") {
    data.processingFee = {
      enabled: true,
      feeType: "FIXED",
      rate: null,
      fixedAmountMinor: 125,
    };
    data.processingFeeMinor = 125;
  } else {
    const zero = scenario === "zero";
    const noMatch = scenario === "no-match";
    const disabled = scenario === "disabled";
    data.processingFee = {
      feeType: "SMALL_ORDER_TIERS",
      policyKind: "SMALL_ORDER_TIERS",
      enabled: !disabled,
      qualifyingAmountMinor: 2220,
      matchedTier:
        noMatch || disabled
          ? null
          : {
              fromMinor: 0,
              belowMinor: 3000,
              chargeMinor: zero ? 0 : 900,
            },
      outcome: disabled
        ? "DISABLED"
        : noMatch
          ? "NO_MATCH"
          : zero
            ? "ZERO_TIER"
            : "CHARGED",
      feeFreeFromMinor:
        scenario === "unknown-threshold" || noMatch || disabled
          ? null
          : scenario === "equal-threshold"
            ? 2220
            : scenario === "lower-threshold"
              ? 1000
              : 3000,
    };
    data.processingFeeMinor = zero || noMatch || disabled ? 0 : 200;
  }
  data.grandTotalMinor = data.processingFeeBasisMinor + data.processingFeeMinor;
  return parseFixtures ? parseQuote(envelope) : (data as CheckoutQuote);
}

function stateFor(scenario: string): CartState {
  return {
    lines: [
      {
        outletId: id("a"),
        outletProductId: id("2"),
        product: {
          productId: id("3"),
          name: "Synthetic rice fixture",
          imageUrl: null,
          packSize: "Two packs",
          uom: { code: "PACK", name: "Pack" },
        },
        quantity: 2,
        displayedUnitPriceMinor: 3900,
        currency: "MYR",
      },
    ],
    assignment: {
      outletId: id("a"),
      outletDisplayName: "Synthetic store",
      outletDisplayReference: "TEST",
      customerAddressId: id("b"),
      addressLabel: "Synthetic delivery address",
      addressRowVersion: 7,
    },
    pendingAddress: null,
    transitionPhase: "idle",
    transitionError: null,
    quotePhase: scenario === "invalidated" ? "idle" : "ready",
    quote: fixtureQuote(scenario),
    error: null,
    canRetry: false,
    priceChanged: false,
    payableTotalChanged: false,
    previousPayableTotalMinor: null,
    paymentFrozen: false,
  };
}

function Fixture() {
  const [scenario, setScenario] = useState(
    parameters.get("scenario") || "charged",
  );
  (window as any).__setFeeScenario = setScenario;
  (window as any).__feeFixtureMeta = {
    scenario,
    parsed: parseFixtures,
    source: "real CartScreen; synthetic quoteEnvelope",
    cartSubtotalMinor: 7800,
    itemsSubtotalMinor: 900,
    deliveryMinor: 4990,
    qualifyingAmountMinor: 2220,
    thresholdMinor: 3000,
    authoritativeFeeMinor: 200,
    tierChargeMinor: 900,
  };
  return (
    <main
      className="customer-surface"
      style={{ width: "100%", maxWidth: 620, margin: "0 auto", padding: 12 }}
    >
      <CartScreen
        state={stateFor(scenario)}
        controller={controller}
        onBrowse={() => {}}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
