import { describe, expect, it } from "vitest";
import { parseOrderDocuments as parse } from "./contracts";
const orderId = "11111111-1111-4111-8111-111111111111";
const documents = (id = orderId) => ({
  orderId: id,
  paymentReceiptAvailable: true,
  finalSalesReceiptAvailable: false,
  paymentReceipt: {
    kind: "PAYMENT_RECEIPT" as const,
    receiptReference: "CKS-20260921-0001",
    issuedAt: "2026-09-21T04:00:00.000Z",
    metadataPath: `/api/v1/orders/${id}/payment-receipt`,
    downloadPath: `/api/v1/orders/${id}/payment-receipt/download`,
  },
  finalSalesReceipt: null,
});

describe("separate document capabilities", () => {
  it("accepts a payment receipt while final receipt is unavailable", () => {
    expect(parse({ data: documents() })).toEqual(documents());
  });
  it("accepts both separate documents after completion", () => {
    const value = {
      ...documents(),
      finalSalesReceiptAvailable: true,
      finalSalesReceipt: {
        ...documents().paymentReceipt,
        kind: "FINAL_SALES_RECEIPT",
        metadataPath: `/api/v1/orders/${orderId}/receipt`,
        downloadPath: `/api/v1/orders/${orderId}/receipt/download`,
      },
    };
    expect(parse({ data: value })).toEqual(value);
  });
  it.each([
    { ...documents(), paymentReceiptAvailable: false },
    { ...documents(), finalSalesReceiptAvailable: true },
    { ...documents(), customerId: "injected" },
    {
      ...documents(),
      paymentReceipt: {
        ...documents().paymentReceipt,
        kind: "FINAL_SALES_RECEIPT",
      },
    },
    {
      ...documents(),
      paymentReceipt: { ...documents().paymentReceipt, issuedAt: "invalid" },
    },
    {
      ...documents(),
      paymentReceipt: {
        ...documents().paymentReceipt,
        downloadPath: "/api/v1/orders/other/payment-receipt/download",
      },
    },
    {
      ...documents(),
      paymentReceipt: {
        ...documents().paymentReceipt,
        downloadPath: documents().paymentReceipt.downloadPath + "?token=secret",
      },
    },
    {
      ...documents(),
      paymentReceipt: {
        ...documents().paymentReceipt,
        metadataPath: "https://evil.example/receipt",
      },
    },
  ])("rejects inconsistent or untrusted capability %#", (value) => {
    expect(() => parse({ data: value })).toThrow();
  });
});
