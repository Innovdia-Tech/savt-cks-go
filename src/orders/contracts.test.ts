import { describe, expect, it } from "vitest";
import {
  parseCancellation,
  parseOrderDetail,
  parseOrderList,
  type OrderDetail,
} from "./contracts";

const orderId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const outletId = "33333333-3333-4333-8333-333333333333";
const at = "2026-09-21T04:00:00.000Z";

const listItem = () => ({
  orderId,
  orderNumber: "CKS-20260921-0001",
  createdAt: at,
  updatedAt: at,
  customerStage: "ORDER_RECEIVED",
  paymentStatus: "PAID",
  outletId,
  outletName: "Demo neighbourhood outlet",
  currency: "MYR",
  grandTotalMinor: 4590,
  deliveryType: "NOW",
  tracking: {
    currentState: null,
    assignedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
  },
  receiptAvailable: false,
  canCancel: true,
});

const detail = (): OrderDetail => ({
  orderId,
  orderNumber: "CKS-20260921-0001",
  createdAt: at,
  updatedAt: at,
  customerStage: "ORDER_RECEIVED",
  paymentStatus: "PAID",
  cancellationKind: null,
  operationalFailure: null,
  outletId,
  outletName: "Demo neighbourhood outlet",
  canCancel: true,
  items: [
    {
      orderItemId: itemId,
      skuCode: "SAFE-SNAPSHOT-1",
      productName: "Apples",
      uomCode: "PACK",
      uomName: "Pack",
      orderedQuantity: 2,
      fulfilledQuantity: null,
      unavailableQuantity: null,
      unitPriceMinor: 1800,
      discountMinor: 100,
      lineTotalMinor: 3500,
    },
  ],
  fulfilment: { fulfilmentConfirmed: false, confirmedAt: null },
  money: {
    itemsSubtotalMinor: 3600,
    discountAmountMinor: 100,
    netItemsTotalMinor: 3500,
    finalDeliveryChargeMinor: 990,
    processingFeeMinor: 100,
    grandTotalMinor: 4590,
    currency: "MYR",
  },
  destination: {
    recipientName: "Demo Customer",
    recipientPhoneE164: "+60123456789",
    addressLine1: "1 Demo Street",
    addressLine2: null,
    city: "Kota Kinabalu",
    state: "Sabah",
    postcode: "88000",
    instructions: null,
  },
  delivery: {
    deliveryType: "NOW",
    currentState: null,
    assignedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
  },
  milestones: {
    paymentConfirmedAt: at,
    acceptedAt: null,
    pickingStartedAt: null,
    pickingConfirmedAt: null,
    pandaConfirmedAt: null,
    packingCompletedAt: null,
    cancelledAt: null,
    deliveredAt: null,
    completedAt: null,
  },
  refund: {
    refundRequired: false,
    requiredAmountMinor: 0,
    totalRequiredAmountMinor: 0,
    requirementStatus: null,
  },
  receipt: {
    receiptAvailable: false,
    receiptReference: null,
    issuedAt: null,
    metadataPath: null,
    downloadPath: null,
  },
});

describe("customer order contracts", () => {
  it("parses the exact paged order history projection", () => {
    const value = {
      data: [listItem()],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    };
    expect(parseOrderList(value)).toEqual(value);
  });

  it("parses the exact customer order detail projection", () => {
    const value = { data: detail() };
    expect(parseOrderDetail(value)).toEqual(value.data);
  });

  it("parses receipt capability only for the exact owned order paths", () => {
    const value = detail();
    value.receipt = {
      receiptAvailable: true,
      receiptReference: "CKS-20260921-0001",
      issuedAt: at,
      metadataPath: `/api/v1/orders/${orderId}/receipt`,
      downloadPath: `/api/v1/orders/${orderId}/receipt/download`,
    };
    expect(parseOrderDetail({ data: value }).receipt.receiptAvailable).toBe(
      true,
    );
  });

  it("parses the exact cancellation result", () => {
    const value = {
      data: {
        orderId,
        customerStage: "CANCELLED",
        paymentStatus: "PAID",
        cancelledAt: at,
        canCancel: false,
        refundRequired: true,
        requiredAmountMinor: 4590,
        requirementStatus: "REQUIRED",
        currency: "MYR",
      },
    };
    expect(parseCancellation(value)).toEqual(value.data);
  });

  it.each([
    [
      "extra list field",
      {
        data: [{ ...listItem(), riderPhone: "+6011" }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    ],
    [
      "internal status",
      {
        data: [{ ...listItem(), status: "NEW" }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    ],
    [
      "unknown stage",
      {
        data: [{ ...listItem(), customerStage: "PACKED_INTERNAL" }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    ],
    [
      "negative money",
      {
        data: [{ ...listItem(), grandTotalMinor: -1 }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    ],
    [
      "fractional money",
      {
        data: [{ ...listItem(), grandTotalMinor: 1.5 }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    ],
    [
      "invalid date",
      {
        data: [{ ...listItem(), createdAt: "today" }],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      },
    ],
  ])("fails closed for %s", (_name, value) => {
    expect(() => parseOrderList(value)).toThrow(
      "Invalid customer order response",
    );
  });

  it("rejects a receipt path for another order", () => {
    const value = detail();
    value.receipt = {
      receiptAvailable: true,
      receiptReference: "CKS-20260921-0001",
      issuedAt: at,
      metadataPath:
        "/api/v1/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/receipt",
      downloadPath:
        "/api/v1/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/receipt/download",
    };
    expect(() => parseOrderDetail({ data: value })).toThrow(
      "Invalid customer order response",
    );
  });

  it("rejects unavailable receipt metadata that still exposes a path", () => {
    const value = detail();
    value.receipt.downloadPath = `/api/v1/orders/${orderId}/receipt/download`;
    expect(() => parseOrderDetail({ data: value })).toThrow(
      "Invalid customer order response",
    );
  });
});
