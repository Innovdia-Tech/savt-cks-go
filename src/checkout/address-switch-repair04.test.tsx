import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddressChangeDialog } from "./components";
import { CartController, type CartState } from "./state";
import { id, quoteEnvelope } from "./test-fixtures";
import { parseQuote } from "./contracts";

const currentAssignment = {
  outletId: id("a"),
  outletDisplayName: "Current outlet",
  outletDisplayReference: "CURRENT",
  customerAddressId: id("b"),
  addressLabel: "Current home",
  addressRowVersion: 7,
};
const address = {
  id: id("d"),
  label: "Saved home",
  rowVersion: 3,
  addressLine1: "Lot 88 Jalan Example",
  addressLine2: null,
  postcode: "89200",
  city: "Tuaran",
  state: "Sabah",
};
const state: CartState = {
  lines: [
    {
      outletId: id("a"),
      outletProductId: id("2"),
      product: {
        productId: id("3"),
        name: "Rice",
        imageUrl: null,
        packSize: "1 kg",
        uom: { code: "PACK", name: "Pack" },
      },
      quantity: 2,
      displayedUnitPriceMinor: 450,
      currency: "MYR",
    },
  ],
  assignment: currentAssignment,
  pendingAddress: { address, assignment: null },
  transitionPhase: "confirmation",
  transitionError: null,
  quotePhase: "ready",
  quote: parseQuote(quoteEnvelope()),
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
const controller = new CartController(
  { create: async () => parseQuote(quoteEnvelope()) },
  {
    assign: async () => {
      throw new Error("Rendering a confirmation must not reassign an address");
    },
  },
);
const markup = (fixture: CartState) =>
  renderToStaticMarkup(
    createElement(AddressChangeDialog, {
      state: fixture,
      controller,
      onCommit: () => {},
    }),
  );

describe("REPAIR04 address switch presentation", () => {
  it("explains a saved unserviceable address with a filled, reviewed basket", () => {
    const html = markup(state);
    expect(html).toContain(
      '<h2 id="cart-switch-title">Delivery isn&#x27;t available here yet</h2>',
    );
    expect(html).toContain(
      "This address is saved, but we don&#x27;t deliver here yet. Switching will clear your basket.",
    );
    expect(html).toContain("Saved home");
    expect(html).toContain("Lot 88 Jalan Example");
    expect(html).toContain("Tuaran, Sabah");
    expect(html).not.toContain(address.id);
    expect(html).not.toContain("reviewed total");
  });

  it("names a different CKS outlet and the same explicit basket consequence", () => {
    const html = markup({
      ...state,
      pendingAddress: {
        address,
        assignment: {
          ...currentAssignment,
          outletId: id("e"),
          outletDisplayName: "Other outlet",
          customerAddressId: address.id,
          addressLabel: address.label,
          addressRowVersion: address.rowVersion,
        },
      },
    });
    expect(html).toContain("Clear basket and switch address?");
    expect(html).toContain(
      "This address uses a different CKS outlet. Switching will clear your basket.",
    );
    expect(html).not.toContain("deliver here yet");
    expect(html).toContain("Saved home");
  });

  it("makes the safe action primary and initially focused, with a named danger action", () => {
    const html = markup(state);
    expect(html).toContain('aria-labelledby="cart-switch-title"');
    expect(html).toContain('aria-describedby="cart-switch-description"');
    expect(html).toMatch(
      /<button autofocus="" class="customer-button customer-primary">Keep current address<\/button>/,
    );
    expect(html).toMatch(
      /<button class="customer-button customer-danger">Switch &amp; clear basket<\/button>/,
    );
    expect(html.indexOf("Keep current address")).toBeLessThan(
      html.indexOf("Switch &amp; clear basket"),
    );
    expect(html).not.toMatch(/>Continue<|>OK</);
  });
});
