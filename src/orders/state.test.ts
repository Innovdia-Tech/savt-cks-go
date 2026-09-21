import { describe, expect, it } from "vitest";
import { OrdersError } from "./api";
import type { CancellationResult, OrderDetail, OrderPage } from "./contracts";
import { OrdersController } from "./state";

const orderId = "11111111-1111-4111-8111-111111111111";
const outletId = "33333333-3333-4333-8333-333333333333";
const itemId = "22222222-2222-4222-8222-222222222222";
const at = "2026-09-21T04:00:00.000Z";

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
  outletName: "Demo outlet",
  canCancel: true,
  items: [
    {
      orderItemId: itemId,
      skuCode: "SAFE-1",
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
const page = (pageNumber = 1, totalPages = 1): OrderPage => ({
  data: [
    {
      orderId,
      orderNumber: "CKS-20260921-0001",
      createdAt: at,
      updatedAt: at,
      customerStage: "ORDER_RECEIVED",
      paymentStatus: "PAID",
      outletId,
      outletName: "Demo outlet",
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
    },
  ],
  meta: { page: pageNumber, pageSize: 10, total: 1, totalPages },
});
const cancelled = (): CancellationResult => ({
  orderId,
  customerStage: "CANCELLED",
  paymentStatus: "PAID",
  cancelledAt: at,
  canCancel: false,
  refundRequired: true,
  requiredAmountMinor: 4590,
  requirementStatus: "REQUIRED",
  currency: "MYR",
});

class SessionStub {
  phase = "authenticated";
  listeners = new Set<() => void>();
  getSnapshot = () => ({ phase: this.phase });
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(phase: string) {
    this.phase = phase;
    this.listeners.forEach((listener) => listener());
  }
}
const api = (
  overrides: Partial<{
    list(page?: number, pageSize?: number): Promise<OrderPage>;
    detail(orderId: string): Promise<OrderDetail>;
    cancel(orderId: string, key: string): Promise<CancellationResult>;
    downloadReceipt(orderId: string, path: string): Promise<Blob>;
  }> = {},
) => ({
  list: async () => page(),
  detail: async () => detail(),
  cancel: async () => cancelled(),
  downloadReceipt: async () => new Blob(["pdf"], { type: "application/pdf" }),
  ...overrides,
});

describe("OrdersController", () => {
  it("loads an order page and supports bounded page navigation", async () => {
    const calls: number[] = [];
    const controller = new OrdersController(
      api({
        list: async (number = 1) => {
          calls.push(number);
          return page(number, 3);
        },
      }),
      new SessionStub(),
      () => "44444444-4444-4444-8444-444444444444",
    );
    await controller.load();
    await controller.nextPage();
    await controller.previousPage();
    expect(calls).toEqual([1, 2, 1]);
    expect(controller.getSnapshot()).toMatchObject({
      listPhase: "ready",
      page: { meta: { page: 1 } },
    });
  });

  it("represents an empty history as a ready empty page", async () => {
    const controller = new OrdersController(
      api({
        list: async () => ({
          data: [],
          meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
        }),
      }),
      new SessionStub(),
    );
    await controller.load();
    expect(controller.getSnapshot().page?.data).toEqual([]);
    expect(controller.getSnapshot().listPhase).toBe("ready");
  });

  it("loads and closes an owned order detail", async () => {
    const controller = new OrdersController(api(), new SessionStub());
    await controller.open(orderId);
    expect(controller.getSnapshot()).toMatchObject({
      detailPhase: "ready",
      detail: { orderId },
    });
    controller.closeDetail();
    expect(controller.getSnapshot()).toMatchObject({
      detailPhase: "idle",
      detail: null,
    });
  });

  it("rejects a detail projection for a different requested order", async () => {
    const controller = new OrdersController(
      api({
        detail: async () => ({
          ...detail(),
          orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      }),
      new SessionStub(),
    );
    await controller.open(orderId);
    expect(controller.getSnapshot()).toMatchObject({
      detailPhase: "error",
      detail: null,
      detailError: "INVALID_RESPONSE",
    });
  });

  it("maps safe recovery and session-expired errors", async () => {
    const controller = new OrdersController(
      api({
        list: async () => {
          throw new OrdersError("NETWORK_ERROR");
        },
        detail: async () => {
          throw new OrdersError("CUSTOMER_SESSION_INVALID");
        },
      }),
      new SessionStub(),
    );
    await controller.load();
    expect(controller.getSnapshot()).toMatchObject({
      listPhase: "error",
      listError: "NETWORK_ERROR",
    });
    await controller.open(orderId);
    expect(controller.getSnapshot()).toMatchObject({
      detailPhase: "session-expired",
      detailError: "CUSTOMER_SESSION_INVALID",
    });
  });

  it("fences a late page response after a newer refresh", async () => {
    let resolveFirst!: (value: OrderPage) => void;
    const first = new Promise<OrderPage>((resolve) => {
      resolveFirst = resolve;
    });
    let call = 0;
    const controller = new OrdersController(
      api({ list: async () => (++call === 1 ? first : page(2, 2)) }),
      new SessionStub(),
    );
    const stale = controller.load(1);
    await controller.load(2);
    resolveFirst(page(1, 2));
    await stale;
    expect(controller.getSnapshot().page?.meta.page).toBe(2);
  });

  it("clears all customer order evidence and fences work on session loss", async () => {
    const session = new SessionStub();
    const controller = new OrdersController(api(), session);
    await controller.load();
    await controller.open(orderId);
    session.set("expired");
    expect(controller.getSnapshot()).toMatchObject({
      listPhase: "session-expired",
      detailPhase: "session-expired",
      page: null,
      detail: null,
    });
  });

  it("reuses the same cancellation key after an uncertain failure", async () => {
    const keys: string[] = [];
    let call = 0;
    const controller = new OrdersController(
      api({
        cancel: async (_id, key) => {
          keys.push(key);
          if (++call === 1) throw new OrdersError("REQUEST_TIMEOUT");
          return cancelled();
        },
      }),
      new SessionStub(),
      () => "44444444-4444-4444-8444-444444444444",
    );
    await controller.open(orderId);
    await controller.cancel();
    expect(controller.getSnapshot()).toMatchObject({
      cancelPhase: "error",
      canRetryCancellation: true,
    });
    await controller.retryCancellation();
    expect(keys).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "44444444-4444-4444-8444-444444444444",
    ]);
    expect(controller.getSnapshot()).toMatchObject({
      cancelPhase: "succeeded",
      detail: {
        customerStage: "CANCELLED",
        canCancel: false,
        refund: { refundRequired: true },
      },
    });
  });

  it("treats a backend cancellation rejection as authoritative", async () => {
    const controller = new OrdersController(
      api({
        cancel: async () => {
          throw new OrdersError("CUSTOMER_ORDER_NOT_CANCELLABLE");
        },
      }),
      new SessionStub(),
    );
    await controller.open(orderId);
    await controller.cancel();
    expect(controller.getSnapshot()).toMatchObject({
      cancelPhase: "error",
      cancelError: "CUSTOMER_ORDER_NOT_CANCELLABLE",
      canRetryCancellation: false,
    });
  });

  it("rejects a cancellation projection for a different order", async () => {
    const controller = new OrdersController(
      api({
        cancel: async () => ({
          ...cancelled(),
          orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        }),
      }),
      new SessionStub(),
    );
    await controller.open(orderId);
    await controller.cancel();
    expect(controller.getSnapshot()).toMatchObject({
      cancelPhase: "error",
      cancelError: "INVALID_RESPONSE",
      canRetryCancellation: true,
      detail: { orderId, customerStage: "ORDER_RECEIVED" },
    });
  });

  it("downloads only the receipt capability on the current detail", async () => {
    const withReceipt = detail();
    withReceipt.receipt = {
      receiptAvailable: true,
      receiptReference: "CKS-20260921-0001",
      issuedAt: at,
      metadataPath: `/api/v1/orders/${orderId}/receipt`,
      downloadPath: `/api/v1/orders/${orderId}/receipt/download`,
    };
    const controller = new OrdersController(
      api({ detail: async () => withReceipt }),
      new SessionStub(),
    );
    await controller.open(orderId);
    const result = await controller.downloadReceipt();
    expect(result).toMatchObject({
      filename: "CKS-Go-Receipt-CKS-20260921-0001.pdf",
    });
    expect(result?.blob.type).toBe("application/pdf");
    expect(controller.getSnapshot().receiptPhase).toBe("ready");
  });

  it("disposes subscriptions and resets state", async () => {
    const session = new SessionStub();
    const controller = new OrdersController(api(), session);
    await controller.load();
    controller.dispose();
    expect(session.listeners.size).toBe(0);
    expect(controller.getSnapshot().page).toBeNull();
  });
});
