import { describe, expect, it } from "vitest";
import { parseQuote } from "./contracts";
import { id, minimumQuoteEnvelope, quoteEnvelope } from "./test-fixtures";

describe("trusted quote response contract", () => {
  it("keeps legacy processing rules without a minimum compatible", () => {
    expect(parseQuote(quoteEnvelope()).processingFee).not.toHaveProperty(
      "minimumAmountMinor",
    );
  });

  it.each([null, 0])("accepts a percentage minimum of %s", (minimum) => {
    const value = quoteEnvelope();
    Object.assign(value.data.processingFee, { minimumAmountMinor: minimum });
    expect(parseQuote(value).processingFee.minimumAmountMinor).toBe(minimum);
  });

  it.each([
    [5000, 200, 5200],
    [10000, 300, 10300],
  ] as const)(
    "accepts an RM2 minimum with basis %i and preserves the supplied fee and total",
    (basis, fee, total) => {
      expect(parseQuote(minimumQuoteEnvelope(basis))).toMatchObject({
        processingFee: { minimumAmountMinor: 200 },
        processingFeeMinor: fee,
        grandTotalMinor: total,
      });
    },
  );

  it("accepts a frozen minimum above the settings Int32 bound", () => {
    const value = minimumQuoteEnvelope(5000);
    value.data.processingFee.minimumAmountMinor = 2_147_483_648;
    value.data.processingFeeMinor = 2_147_483_648;
    value.data.grandTotalMinor = 2_147_488_648;
    expect(parseQuote(value).processingFee.minimumAmountMinor).toBe(
      2_147_483_648,
    );
  });

  it("accepts the documented safe-integer maximum for frozen quote money", () => {
    const value = quoteEnvelope();
    Object.assign(value.data.processingFee, {
      minimumAmountMinor: Number.MAX_SAFE_INTEGER,
    });
    value.data.items[0].unitPriceMinor = 0;
    value.data.items[0].lineSubtotalMinor = 0;
    value.data.itemsSubtotalMinor = 0;
    value.data.netItemsTotalMinor = 0;
    value.data.baseDeliveryFeeMinor = 0;
    value.data.finalDeliveryChargeMinor = 0;
    value.data.processingFeeBasisMinor = 0;
    value.data.processingFeeMinor = Number.MAX_SAFE_INTEGER;
    value.data.grandTotalMinor = Number.MAX_SAFE_INTEGER;
    expect(parseQuote(value).processingFee.minimumAmountMinor).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each([
    -1,
    0.5,
    200.5,
    Number.MAX_SAFE_INTEGER + 1,
    NaN,
    Infinity,
    -Infinity,
    "200",
    true,
    false,
    {},
    [],
    undefined,
  ])("rejects invalid minimum %s", (minimum) => {
    const value = quoteEnvelope();
    Object.assign(value.data.processingFee, { minimumAmountMinor: minimum });
    expect(() => parseQuote(value)).toThrow("Invalid checkout quote response");
  });

  it.each([true, false])(
    "accepts legacy and null minimum Fixed rules when enabled is %s",
    (enabled) => {
      const value = quoteEnvelope();
      Object.assign(value.data.processingFee, {
        enabled,
        feeType: "FIXED",
        rate: null,
        fixedAmountMinor: 42,
      });
      if (!enabled) {
        value.data.processingFeeMinor = 0;
        value.data.grandTotalMinor = 1390;
      }
      expect(parseQuote(value).processingFee.feeType).toBe("FIXED");
      Object.assign(value.data.processingFee, { minimumAmountMinor: null });
      expect(parseQuote(value).processingFee.minimumAmountMinor).toBeNull();
    },
  );

  it("preserves a disabled percentage minimum and the zero backend fee", () => {
    const value = minimumQuoteEnvelope(5000);
    value.data.processingFee.enabled = false;
    value.data.processingFeeMinor = 0;
    value.data.grandTotalMinor = 5000;
    expect(parseQuote(value)).toMatchObject({
      processingFee: { enabled: false, minimumAmountMinor: 200 },
      processingFeeMinor: 0,
      grandTotalMinor: 5000,
    });
  });

  it.each([
    [true, 0],
    [true, 200],
    [false, 0],
    [false, 200],
  ])("rejects enabled=%s Fixed rules with minimum %i", (enabled, minimum) => {
    const value = quoteEnvelope();
    Object.assign(value.data.processingFee, {
      enabled,
      feeType: "FIXED",
      rate: null,
      fixedAmountMinor: 42,
      minimumAmountMinor: minimum,
    });
    expect(() => parseQuote(value)).toThrow("Invalid checkout quote response");
  });

  it("rejects unknown processing fields alongside a valid minimum", () => {
    const value = minimumQuoteEnvelope(5000);
    Object.assign(value.data.processingFee, { unexpected: null });
    expect(() => parseQuote(value)).toThrow("Invalid checkout quote response");
  });

  it.each(["enabled", "feeType", "rate", "fixedAmountMinor"])(
    "still requires processing field %s alongside a valid minimum",
    (key) => {
      const value = minimumQuoteEnvelope(5000);
      delete (value.data.processingFee as Record<string, unknown>)[key];
      expect(() => parseQuote(value)).toThrow(
        "Invalid checkout quote response",
      );
    },
  );

  it.each([
    ["unknown quote field", { unexpected: null }],
    ["invalid quote identity", { quoteId: "bad" }],
    ["empty quote token", { quoteToken: "" }],
    ["invalid outlet identity", { outletId: "bad" }],
    ["incorrect processing basis", { processingFeeBasisMinor: 5001 }],
    ["incorrect grand total", { grandTotalMinor: 5201 }],
  ])("retains quote validation with a minimum: %s", (_name, patch) => {
    const value = minimumQuoteEnvelope(5000);
    Object.assign(value.data, patch);
    expect(() => parseQuote(value)).toThrow("Invalid checkout quote response");
  });

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
