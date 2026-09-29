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

  it("accepts the canonical rate format from a sanitized real quote", () => {
    const {
      outletId: _outletId,
      customerAddressId: _customerAddressId,
      addressRowVersion: _addressRowVersion,
      ...data
    } = quoteEnvelope().data;
    data.processingFee.rate = "0.03";

    expect(parseQuote({ data }).processingFee.rate).toBe("0.03");
  });

  it.each(["0", "0.03", "0.0300", "1", "1.5"])(
    "accepts canonical percentage rate %s",
    (rate) => {
      const value = quoteEnvelope();
      value.data.processingFee.rate = rate;
      expect(parseQuote(value).processingFee.rate).toBe(rate);
    },
  );

  it.each([
    "",
    " 0.03",
    "-0.03",
    "+0.03",
    "3e-2",
    "abc",
    "00.03",
    "0.",
    "1".repeat(33),
  ])("rejects malformed percentage rate %s", (rate) => {
    const value = quoteEnvelope();
    value.data.processingFee.rate = rate;
    expect(() => parseQuote(value)).toThrow("Invalid checkout quote response");
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
