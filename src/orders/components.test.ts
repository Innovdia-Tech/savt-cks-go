import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OrderDetail, OrderPage } from "./contracts";
import {
  CancellationDialog,
  OrderDetailScreen,
  OrdersScreen,
} from "./components";
import type { OrdersState } from "./state";

const orderId = "11111111-1111-4111-8111-111111111111";
const at = "2026-09-21T04:00:00.000Z";
const page: OrderPage = {
  data: [
    {
      orderId,
      orderNumber: "CKS-20260921-0001",
      createdAt: at,
      updatedAt: at,
      customerStage: "OUT_FOR_DELIVERY",
      paymentStatus: "PAID",
      outletId: "33333333-3333-4333-8333-333333333333",
      outletName: "Demo outlet",
      currency: "MYR",
      grandTotalMinor: 4590,
      deliveryType: "NOW",
      tracking: {
        currentState: "RIDER_INTERNAL_STATE",
        assignedAt: at,
        pickedUpAt: at,
        deliveredAt: null,
      },
      receiptAvailable: false,
      canCancel: false,
    },
  ],
  meta: { page: 1, pageSize: 25, total: 1, totalPages: 2 },
};
const detail: OrderDetail = {
  orderId,
  orderNumber: "CKS-20260921-0001",
  createdAt: at,
  updatedAt: at,
  customerStage: "ORDER_RECEIVED",
  paymentStatus: "PAID",
  cancellationKind: null,
  operationalFailure: null,
  outletId: "33333333-3333-4333-8333-333333333333",
  outletName: "Demo outlet",
  canCancel: true,
  items: [
    {
      orderItemId: "22222222-2222-4222-8222-222222222222",
      skuCode: "INTERNAL-SKU",
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
    instructions: "Leave at reception",
  },
  delivery: {
    deliveryType: "NOW",
    currentState: "RIDER_INTERNAL_STATE",
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
};
const state = (patch: Partial<OrdersState> = {}): OrdersState => ({
  listPhase: "ready",
  page,
  listError: null,
  detailPhase: "ready",
  detail,
  detailError: null,
  cancelPhase: "idle",
  cancelError: null,
  canRetryCancellation: false,
  receiptPhase: "idle",
  receiptError: null,
  ...patch,
});
const controller = {
  load: async () => {},
  refresh: async () => {},
  nextPage: async () => {},
  previousPage: async () => {},
  cancel: async () => {},
  retryCancellation: async () => {},
  downloadReceipt: async () => null,
};

describe("customer orders presentation", () => {
  it.each([
    ["loading", "Loading your orders"],
    ["error", "Orders unavailable"],
    ["session-expired", "Session expired"],
  ] as const)("renders the %s history state", (phase, copy) => {
    const html = renderToStaticMarkup(
      createElement(OrdersScreen, {
        state: state({
          listPhase: phase,
          page: null,
          listError: phase === "error" ? "NETWORK_ERROR" : null,
        }),
        controller,
        onOpen: () => {},
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain(copy);
  });

  it("renders an actionable empty history", () => {
    const html = renderToStaticMarkup(
      createElement(OrdersScreen, {
        state: state({
          page: {
            data: [],
            meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
          },
        }),
        controller,
        onOpen: () => {},
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("No orders yet");
    expect(html).toContain("Browse products");
  });

  it("renders safe list evidence and bounded pagination without internal tracking state", () => {
    const html = renderToStaticMarkup(
      createElement(OrdersScreen, {
        state: state(),
        controller,
        onOpen: () => {},
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("CKS-20260921-0001");
    expect(html).toContain("Out for delivery");
    expect(html).toContain("Current orders");
    expect(html).toContain("Order history");
    expect(html).toContain("this page");
    expect(html).toContain("status filtering isn&#x27;t available yet");
    expect(html).toContain("ui-status--info");
    expect(html).toContain("Next page");
    expect(html).not.toContain("RIDER_INTERNAL_STATE");
    expect(html).not.toContain(orderId);
  });

  it("separates current and history entries without dropping either from the loaded page", () => {
    const delivered = {
      ...page.data[0],
      orderId: "44444444-4444-4444-8444-444444444444",
      orderNumber: "CKS-20260920-0009",
      customerStage: "DELIVERED" as const,
      receiptAvailable: true,
    };
    const html = renderToStaticMarkup(
      createElement(OrdersScreen, {
        state: state({
          page: {
            data: [page.data[0], delivered],
            meta: { ...page.meta, total: 2 },
          },
        }),
        controller,
        onOpen: () => {},
        onBrowse: () => {},
      } as never),
    );
    expect(html).toContain("CKS-20260921-0001");
    expect(html).toContain("CKS-20260920-0009");
    expect(html).toContain("1 on this page");
  });

  it("renders customer-safe detail, milestones, totals, and address without internal fields", () => {
    const html = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: state(),
        controller,
        onBack: () => {},
      } as never),
    );
    for (const copy of [
      "Order received",
      "Pick &amp; Pack",
      "Out for delivery",
      "Delivered",
      "Delivery estimate unavailable",
      "Apples",
      "Grand total",
      "Demo Customer",
      "Leave at reception",
      "Cancel order",
    ])
      expect(html).toContain(copy);
    expect(html).not.toContain("INTERNAL-SKU");
    expect(html).not.toContain("RIDER_INTERNAL_STATE");
    expect(html).not.toContain("Backend status");
    expect(html).not.toContain(orderId);
  });

  it("shows receipt download only when the exact parsed capability is available", () => {
    const receipt = {
      ...detail,
      canCancel: false,
      receipt: {
        receiptAvailable: true,
        receiptReference: "CKS-20260921-0001",
        issuedAt: at,
        metadataPath: `/api/v1/orders/${orderId}/receipt`,
        downloadPath: `/api/v1/orders/${orderId}/receipt/download`,
      },
    } as OrderDetail;
    const html = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: state({ detail: receipt }),
        controller,
        onBack: () => {},
      } as never),
    );
    expect(html).toContain("Download receipt");
    expect(html).not.toContain(receipt.receipt.downloadPath!);
    expect(html).toContain("Delivery estimate unavailable");
  });

  it("does not invent a live ETA for delivered history", () => {
    const delivered = {
      ...detail,
      customerStage: "DELIVERED" as const,
      canCancel: false,
      milestones: { ...detail.milestones, deliveredAt: at },
      delivery: { ...detail.delivery, deliveredAt: at },
    };
    const html = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: state({ detail: delivered }),
        controller,
        onBack: () => {},
      } as never),
    );
    expect(html).toContain("Delivered");
    expect(html).not.toContain("Delivery estimate unavailable");
    expect(html).not.toMatch(/arriv(?:e|ing) in/i);
  });

  it("does not describe reached stages as unreached when timestamps are absent", () => {
    const deliveredWithoutTimes = {
      ...detail,
      customerStage: "DELIVERED" as const,
      canCancel: false,
    };
    const html = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: state({ detail: deliveredWithoutTimes }),
        controller,
        onBack: () => {},
      } as never),
    );

    expect(html).toContain("Stage confirmed; update time unavailable.");
    expect(html).not.toContain("Not reached yet");
  });

  it("renders authoritative cancellation rejection and stable retry copy", () => {
    const rejected = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: state({
          cancelPhase: "error",
          cancelError: "CUSTOMER_ORDER_NOT_CANCELLABLE",
        }),
        controller,
        onBack: () => {},
      } as never),
    );
    expect(rejected).toContain("could not be cancelled");
    expect(rejected).not.toContain("CUSTOMER_ORDER_NOT_CANCELLABLE");
    const retry = renderToStaticMarkup(
      createElement(OrderDetailScreen, {
        state: state({
          cancelPhase: "error",
          cancelError: "REQUEST_TIMEOUT",
          canRetryCancellation: true,
        }),
        controller,
        onBack: () => {},
      } as never),
    );
    expect(retry).toContain("Retry cancellation");
    expect(retry).not.toContain(
      '<button class="customer-button order-cancel">Cancel order</button>',
    );
  });

  it("uses an app-owned cancellation dialog with least-destructive initial focus", () => {
    const html = renderToStaticMarkup(
      createElement(CancellationDialog, {
        open: true,
        orderNumber: detail.orderNumber,
        busy: false,
        onCancel: () => {},
        onConfirm: () => {},
      }),
    );
    expect(html).toContain("Cancel order CKS-20260921-0001?");
    expect(html).toContain("refund requirement");
    expect(html).toMatch(/<button[^>]*autofocus=""[^>]*>Keep order<\/button>/);
    expect(html).not.toMatch(/confirm\(|alert\(/);
  });
});
