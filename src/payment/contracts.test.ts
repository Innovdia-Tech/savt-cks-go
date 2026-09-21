import { describe, expect, it } from "vitest";
import { parsePaymentCreate, parsePaymentResult } from "./contracts";

const quoteId = "10000000-0000-4000-8000-000000000001";
const paymentIntentId = "20000000-0000-4000-8000-000000000002";
const orderId = "30000000-0000-4000-8000-000000000003";

const createEnvelope = () => ({
  data: {
    checkoutReference: quoteId,
    payment: {
      paymentIntentId,
      status: "PENDING",
      checkoutUrl: "https://pay.example.test/checkout/approved",
      expiresAt: "2026-09-21T04:30:00.000Z",
    },
  },
});

const resultEnvelope = (status: string, order: unknown = null) => ({
  data: { checkoutReference: quoteId, status, order },
});

describe("customer payment contracts", () => {
  it("accepts only the backend payment initiation projection", () => {
    expect(parsePaymentCreate(createEnvelope())).toEqual(createEnvelope().data);
  });

  it.each([
    "http://pay.example.test/checkout",
    "https://user:password@pay.example.test/checkout",
    "javascript:alert(1)",
    "not a URL",
  ])("rejects unsafe checkout URL %s", (checkoutUrl) => {
    const envelope = createEnvelope();
    envelope.data.payment.checkoutUrl = checkoutUrl;
    expect(() => parsePaymentCreate(envelope)).toThrow(
      "Invalid customer payment response.",
    );
  });

  it("rejects expanded initiation data", () => {
    const envelope = createEnvelope();
    expect(() =>
      parsePaymentCreate({
        data: {
          ...envelope.data,
          providerReference: "internal-provider-field",
        },
      }),
    ).toThrow("Invalid customer payment response.");
  });

  it.each(["PENDING", "FAILED", "PAID_PROCESSING"])(
    "accepts %s only without Order evidence",
    (status) => {
      expect(parsePaymentResult(resultEnvelope(status))).toEqual(
        resultEnvelope(status).data,
      );
      expect(() =>
        parsePaymentResult(
          resultEnvelope(status, {
            orderId,
            orderNumber: "CKS-20260921-0001",
            status: "CONFIRMED",
          }),
        ),
      ).toThrow("Invalid customer payment response.");
    },
  );

  it("accepts PAID only with valid backend-projected Order identity", () => {
    const envelope = resultEnvelope("PAID", {
      orderId,
      orderNumber: "CKS-20260921-0001",
      status: "CONFIRMED",
    });
    expect(parsePaymentResult(envelope)).toEqual(envelope.data);
  });

  it.each([
    null,
    { orderId, orderNumber: "", status: "CONFIRMED" },
    { orderId: "not-a-uuid", orderNumber: "CKS-1", status: "CONFIRMED" },
    {
      orderId,
      orderNumber: "CKS-1",
      status: "CONFIRMED",
      receiptUrl: "https://internal.example/receipt",
    },
  ])("fails closed when PAID Order identity is invalid", (order) => {
    expect(() => parsePaymentResult(resultEnvelope("PAID", order))).toThrow(
      "Invalid customer payment response.",
    );
  });

  it("rejects expanded result envelopes", () => {
    expect(() =>
      parsePaymentResult({
        data: resultEnvelope("PENDING").data,
        meta: { provider: "GKASH" },
      }),
    ).toThrow("Invalid customer payment response.");
  });
});
