import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseQuote } from "./contracts";
import { CartScreen } from "./components";

const fixtures = [
  ["legacy-percentage", "Processing fee", "0.45", "15.45"],
  ["legacy-percentage-minimum", "Processing fee", "2.00", "17.00"],
  ["legacy-fixed", "Processing fee", "1.25", "16.25"],
  ["small-charged", "Small order processing fee", "3.00", "18.00"],
  ["small-no-match", "Small order processing fee", "0.00", "25.00"],
  ["small-zero-tier", "Small order processing fee", "0.00", "15.00"],
  ["small-disabled", "Small order processing fee", "0.00", "15.00"],
] as const;
const envelope = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/small-order-fee01/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const screen = (value: unknown) =>
  renderToStaticMarkup(
    createElement(CartScreen, {
      state: {
        lines: [
          {
            outletProductId: "33333333-3333-4333-8333-333333333333",
            product: {
              name: "Frozen product",
              imageUrl: null,
              uom: { name: "Each" },
            },
            quantity: 2,
            displayedUnitPriceMinor: 500,
          },
        ],
        quote: parseQuote(value),
        quotePhase: "ready",
      },
      controller: {},
      onBrowse() {},
    } as never),
  );

describe("small-order serializer contract and actual Basket summary", () => {
  it.each(fixtures)(
    "loads %s with the single frozen fee and total",
    (name, label, fee, total) => {
      const html = screen(envelope(name));
      expect(html).toMatch(
        new RegExp(
          `<dt[^>]*>${label}</dt><dd[^>]*>RM[^<]*${fee.replace(".", "\\.")}</dd>`,
        ),
      );
      expect(html).toMatch(
        new RegExp(
          `<dt[^>]*>Total</dt><dd[^>]*>RM[^<]*${total.replace(".", "\\.")}</dd>`,
        ),
      );
      expect(html.indexOf("Delivery fee")).toBeLessThan(html.indexOf(label));
      expect(html.indexOf(label)).toBeLessThan(
        html.indexOf('class="quote-grand"'),
      );
      if (name.startsWith("small-")) {
        expect(html).not.toContain("<dt>Processing fee</dt>");
        expect(html).toContain(
          "Based on items total after discounts. Delivery is excluded.",
        );
        expect(html.includes("No small order fee for this order.")).toBe(
          name === "small-no-match" || name === "small-zero-tier",
        );
      }
    },
  );

  it.each([999, 1000, 1001, 1999, 2000, 2001])(
    "accepts frozen evidence at the %i-cent boundary",
    (amount) => {
      const body = envelope("small-charged");
      const d = body.data;
      Object.assign(d.items[0], {
        quantity: 1,
        unitPriceMinor: amount,
        lineSubtotalMinor: amount,
      });
      Object.assign(d, {
        itemsSubtotalMinor: amount,
        netItemsTotalMinor: amount,
        processingFeeBasisMinor: amount + 500,
      });
      Object.assign(d.processingFee, {
        qualifyingAmountMinor: amount,
        matchedTier:
          amount < 1000
            ? { fromMinor: 0, belowMinor: 1000, chargeMinor: 500 }
            : amount < 2000
              ? { fromMinor: 1000, belowMinor: 2000, chargeMinor: 300 }
              : null,
        outcome: amount < 2000 ? "CHARGED" : "NO_MATCH",
      });
      d.processingFeeMinor = amount < 1000 ? 500 : amount < 2000 ? 300 : 0;
      d.grandTotalMinor = amount + 500 + d.processingFeeMinor;
      expect(parseQuote(body).grandTotalMinor).toBe(d.grandTotalMinor);
    },
  );

  it("shows discounts and the server's net items, excluding delivery from eligibility", () => {
    const body = envelope("small-charged");
    Object.assign(body.data, {
      discountAmountMinor: 200,
      netItemsTotalMinor: 800,
      processingFeeBasisMinor: 1300,
      processingFeeMinor: 500,
      grandTotalMinor: 1800,
    });
    Object.assign(body.data.processingFee, {
      qualifyingAmountMinor: 800,
      matchedTier: { fromMinor: 0, belowMinor: 1000, chargeMinor: 500 },
    });
    const html = screen(body);
    expect(html).toMatch(/Discounts<\/dt><dd>−RM[^<]*2\.00/);
    expect(html).toMatch(/Items total after discounts<\/dt><dd>RM[^<]*8\.00/);
    expect(html).toMatch(/Small order processing fee<\/dt><dd>RM[^<]*5\.00/);
  });

  it.each([
    { policyKind: "LEGACY" },
    { qualifyingAmountMinor: 1500 },
    { qualifyingAmountMinor: -1 },
    { outcome: "UNKNOWN" },
    { outcome: "DISABLED" },
    { outcome: "ZERO_TIER" },
    { enabled: false },
    { feeFreeFromMinor: null },
    { feeFreeFromMinor: "2000" },
    { feeFreeFromMinor: 2147483648 },
    { minimumAmountMinor: null },
    { tiers: [] },
    { matchedTier: null },
    { matchedTier: { fromMinor: 1000, belowMinor: 1000, chargeMinor: 300 } },
    { matchedTier: { fromMinor: 1001, belowMinor: 2000, chargeMinor: 300 } },
    { matchedTier: { fromMinor: 0, belowMinor: 1000, chargeMinor: 300 } },
    { matchedTier: { fromMinor: 1000, belowMinor: 2000, chargeMinor: 301 } },
    { matchedTier: { fromMinor: 1000, belowMinor: 2000, chargeMinor: -1 } },
    { matchedTier: { fromMinor: 1000, belowMinor: 2000, chargeMinor: 0.5 } },
    {
      matchedTier: {
        fromMinor: 1000,
        belowMinor: 2147483648,
        chargeMinor: 300,
      },
    },
    {
      matchedTier: {
        fromMinor: 1000,
        belowMinor: 2000,
        chargeMinor: 300,
        private: true,
      },
    },
  ])("rejects malformed or inconsistent new evidence %j", (patch) => {
    const body = envelope("small-charged");
    Object.assign(body.data.processingFee, patch);
    expect(() => parseQuote(body)).toThrow();
  });

  it("retains total, identity, token and closed envelope validation", () => {
    for (const patch of [
      { grandTotalMinor: 1801 },
      { quoteId: "bad" },
      { quoteToken: "" },
      { rawStaff: true },
    ]) {
      const body = envelope("small-charged");
      Object.assign(body.data, patch);
      expect(() => parseQuote(body)).toThrow();
    }
  });
});
