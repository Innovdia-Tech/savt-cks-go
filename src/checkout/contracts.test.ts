import { describe, expect, it } from "vitest";
import { parseQuote } from "./contracts";
import { id, quoteEnvelope } from "./test-fixtures";

describe("trusted quote response contract", () => {
  it("parses authoritative lines, totals, timing, expiry and optional assignment evidence", () => {
    const quote = parseQuote(quoteEnvelope());
    expect(quote.items[0]).toMatchObject({
      outletProductId: id("2"),
      productNameSnapshot: "Rice",
      quantity: 2,
      unitPriceMinor: 450,
      lineSubtotalMinor: 900,
    });
    expect(quote).toMatchObject({
      quoteId: id("1"),
      itemsSubtotalMinor: 900,
      finalDeliveryChargeMinor: 490,
      processingFeeMinor: 42,
      grandTotalMinor: 1432,
      currency: "MYR",
      estimatedTotalOrderMinutes: 55,
      quoteExpiresAt: "2026-09-20T04:10:00.000Z",
      outletId: id("a"),
      customerAddressId: id("b"),
      addressRowVersion: 7,
    });
  });

  it.each([
    ["expanded envelope", () => ({ ...quoteEnvelope(), secret: "no" })],
    [
      "expanded line",
      () => {
        const value = quoteEnvelope();
        return {
          ...value,
          data: {
            ...value.data,
            items: [{ ...value.data.items[0], clientPrice: 1 }],
          },
        };
      },
    ],
    [
      "incorrect line subtotal",
      () => {
        const value = quoteEnvelope();
        value.data.items[0].lineSubtotalMinor = 899;
        return value;
      },
    ],
    [
      "incorrect grand total",
      () => {
        const value = quoteEnvelope();
        value.data.grandTotalMinor = 999;
        return value;
      },
    ],
    [
      "expired on issue",
      () => {
        const value = quoteEnvelope();
        value.data.quoteExpiresAt = value.data.quoteIssuedAt;
        return value;
      },
    ],
    [
      "partial assignment evidence",
      () => {
        const value = quoteEnvelope();
        const { addressRowVersion: _ignored, ...data } = value.data;
        return { data };
      },
    ],
  ])("rejects %s", (_name, value) => {
    expect(() => parseQuote(value())).toThrow(
      "Invalid checkout quote response",
    );
  });
});
