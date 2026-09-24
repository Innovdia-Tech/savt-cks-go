import { describe, expect, it } from "vitest";
import { OrdersError } from "./api";
import type { OrderDetail, OrderPage } from "./contracts";
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
const detailWithReceipt = (): OrderDetail => ({
  ...detail(),
  receipt: {
    receiptAvailable: true,
    receiptReference: "CKS-20260921-0001",
    issuedAt: at,
    metadataPath: `/api/v1/orders/${orderId}/receipt`,
    downloadPath: `/api/v1/orders/${orderId}/receipt/download`,
  },
});
const deferredReceipt = () => {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Blob>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};
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
    detail(orderId: string, signal?: AbortSignal): Promise<OrderDetail>;
    downloadReceipt(
      orderId: string,
      path: string,
      signal?: AbortSignal,
    ): Promise<Blob>;
  }> = {},
) => ({
  list: async () => page(),
  detail: async () => detail(),
  downloadReceipt: async () => new Blob(["pdf"], { type: "application/pdf" }),
  ...overrides,
});

describe("OrdersController", () => {
  it("does not expose cancellation commands even for a stale capability", async () => {
    const controller = new OrdersController(api(), new SessionStub());
    await controller.open(orderId);
    expect(controller.getSnapshot().detail?.canCancel).toBe(true);
    expect("cancel" in controller).toBe(false);
    expect("retryCancellation" in controller).toBe(false);
  });
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

  it("downloads only the receipt capability on the current detail", async () => {
    const controller = new OrdersController(
      api({ detail: async () => detailWithReceipt() }),
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

  it("fences a late receipt after another order opens even when abort is ignored", async () => {
    const otherOrderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const pending = deferredReceipt();
    let receiptSignal: AbortSignal | undefined;
    const controller = new OrdersController(
      api({
        detail: async (requestedOrderId) =>
          requestedOrderId === orderId
            ? detailWithReceipt()
            : {
                ...detail(),
                orderId: otherOrderId,
                orderNumber: "CKS-20260921-0002",
              },
        downloadReceipt: async (_orderId, _path, signal) => {
          receiptSignal = signal;
          return pending.promise;
        },
      }),
      new SessionStub(),
    );
    await controller.open(orderId);
    const oldDownload = controller.downloadReceipt();
    expect(controller.getSnapshot().receiptPhase).toBe("downloading");
    await controller.open(otherOrderId);
    expect(receiptSignal?.aborted).toBe(true);
    const orderBState = controller.getSnapshot();
    expect(orderBState).toMatchObject({
      detailPhase: "ready",
      detail: { orderId: otherOrderId, orderNumber: "CKS-20260921-0002" },
      receiptPhase: "idle",
      receiptError: null,
    });
    pending.resolve(new Blob(["old receipt"], { type: "application/pdf" }));
    expect(await oldDownload).toBeNull();
    expect(controller.getSnapshot()).toBe(orderBState);
  });

  it.each(["resolve", "reject"] as const)(
    "aborts and fences a receipt when detail closes (%s)",
    async (settlement) => {
      const pending = deferredReceipt();
      let receiptSignal: AbortSignal | undefined;
      const controller = new OrdersController(
        api({
          detail: async () => detailWithReceipt(),
          downloadReceipt: async (_orderId, _path, signal) => {
            receiptSignal = signal;
            return pending.promise;
          },
        }),
        new SessionStub(),
      );
      await controller.open(orderId);
      const oldDownload = controller.downloadReceipt();
      controller.closeDetail();
      expect(receiptSignal?.aborted).toBe(true);
      const closedState = controller.getSnapshot();
      expect(closedState).toMatchObject({
        detailPhase: "idle",
        detail: null,
        detailError: null,
        receiptPhase: "idle",
        receiptError: null,
      });
      if (settlement === "resolve")
        pending.resolve(new Blob(["old receipt"], { type: "application/pdf" }));
      else pending.reject(new Error("late receipt failure"));
      expect(await oldDownload).toBeNull();
      expect(controller.getSnapshot()).toBe(closedState);
    },
  );

  it.each(["resolve", "reject"] as const)(
    "aborts and clears a receipt when the session expires (%s)",
    async (settlement) => {
      const pending = deferredReceipt();
      let receiptSignal: AbortSignal | undefined;
      const session = new SessionStub();
      const controller = new OrdersController(
        api({
          detail: async () => detailWithReceipt(),
          downloadReceipt: async (_orderId, _path, signal) => {
            receiptSignal = signal;
            return pending.promise;
          },
        }),
        session,
      );
      await controller.load();
      await controller.open(orderId);
      const oldDownload = controller.downloadReceipt();
      session.set("expired");
      expect(receiptSignal?.aborted).toBe(true);
      const expiredState = controller.getSnapshot();
      expect(expiredState).toMatchObject({
        listPhase: "session-expired",
        page: null,
        listError: "CUSTOMER_SESSION_INVALID",
        detailPhase: "session-expired",
        detail: null,
        detailError: "CUSTOMER_SESSION_INVALID",
        receiptPhase: "idle",
        receiptError: null,
      });
      if (settlement === "resolve")
        pending.resolve(new Blob(["old receipt"], { type: "application/pdf" }));
      else pending.reject(new Error("late receipt failure"));
      expect(await oldDownload).toBeNull();
      expect(controller.getSnapshot()).toBe(expiredState);
    },
  );

  it("disposes subscriptions and resets state", async () => {
    const session = new SessionStub();
    const controller = new OrdersController(api(), session);
    await controller.load();
    controller.dispose();
    expect(session.listeners.size).toBe(0);
    expect(controller.getSnapshot().page).toBeNull();
  });
});
