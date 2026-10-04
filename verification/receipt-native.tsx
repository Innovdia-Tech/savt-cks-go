import type { OrderDetail } from "../src/orders/contracts";
const orderId = "11111111-1111-4111-8111-111111111111",
  outletId = "33333333-3333-4333-8333-333333333333",
  itemId = "22222222-2222-4222-8222-222222222222",
  at = "2026-09-21T04:00:00.000Z";
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

import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { OrderDetailScreen } from "../src/orders/components";
import { OrdersController } from "../src/orders/state";
import { OrdersApi } from "../src/orders/api";
import "../src/styles.css";
import "../src/orders/orders.css";
const report = (kind: string, data: Record<string, unknown> = {}) =>
  fetch("/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, ...data }),
  });
const session = {
  getSnapshot: () => ({ phase: "authenticated" }),
  subscribe: () => () => {},
  withCredentials: async <T,>(operation: (csrf: string) => Promise<T>) =>
    operation("SYNTHETIC-TEST-ONLY"),
};
const api = new OrdersApi("", session);
const controller = new OrdersController(
  {
    list: async () => ({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    }),
    detail: async () => ({
      ...detailWithReceipt(),
      customerStage: "DELIVERED",
      milestones: { ...detail().milestones, completedAt: at },
    }),
    documents: async () => ({
      orderId,
      paymentReceiptAvailable: true,
      finalSalesReceiptAvailable: true,
      paymentReceipt: {
        kind: "PAYMENT_RECEIPT",
        receiptReference: "FE-RECEIPT01-PAYMENT",
        issuedAt: at,
        metadataPath: `/api/v1/orders/${orderId}/payment-receipt`,
        downloadPath: `/api/v1/orders/${orderId}/payment-receipt/download`,
      },
      finalSalesReceipt: {
        kind: "FINAL_SALES_RECEIPT",
        receiptReference: "CKS-20260921-0001",
        issuedAt: at,
        metadataPath: `/api/v1/orders/${orderId}/receipt`,
        downloadPath: `/api/v1/orders/${orderId}/receipt/download`,
      },
    }),
    downloadPaymentReceipt: (id, path, signal) =>
      api.downloadPaymentReceipt(id, path, signal),
    downloadReceipt: (id, path, signal) =>
      api.downloadReceipt(id, path, signal),
  },
  session,
);
function App() {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  return (
    <main
      className="app-shell"
      style={{ padding: "16px", overflow: "auto", height: "100vh" }}
    >
      <p>TEST/DEBUG · Current Orders / Order Detail</p>
      <OrderDetailScreen
        state={state}
        controller={controller}
        onBack={() => report("web-back")}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
controller.subscribe(() =>
  report("state", {
    payment: controller.getSnapshot().paymentReceiptPhase,
    final: controller.getSnapshot().receiptPhase,
  }),
);
window.addEventListener("savt-cks-go-document-result", (event) =>
  report("document-result", (event as CustomEvent).detail),
);
window.addEventListener("savt-cks-go-handoff", async () => {
  window.SavtCksGoBridge!.postMessage(JSON.stringify({ type: "loaded" }));
  await controller.open(orderId);
  await report("ready");
});
const bootstrap = () => {
  if (!window.SavtCksGoBridge) {
    setTimeout(bootstrap, 100);
    return;
  }
  const channel = window.SavtCksGoBridge;
  const original = channel.postMessage.bind(channel);
  channel.postMessage = (message) => {
    const parsed = JSON.parse(message);
    if (parsed.type === "document-save")
      report("document-request", {
        requestId: parsed.payload.requestId,
        filename: parsed.payload.filename,
        envelopeKeys: Object.keys(parsed),
        payloadKeys: Object.keys(parsed.payload),
      });
    original(message);
  };
  channel.postMessage(
    JSON.stringify({
      type: "bootstrap",
      payload: {
        protocolVersion: "1",
        launchRequestId: crypto.randomUUID(),
        state: "A".repeat(43),
        codeChallenge: "B".repeat(43),
        codeChallengeMethod: "S256",
      },
    }),
  );
};
bootstrap();
async function commands() {
  try {
    const { command } = await (await fetch("/command")).json();
    if (command === "payment" || command === "final")
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find(
          (button) =>
            button.textContent ===
            (command === "payment"
              ? "Download Receipt"
              : "Download Final Sales Receipt"),
        )
        ?.click();
    if (command === "unexpected") {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(
        new Blob(["%PDF-1.7"], { type: "application/pdf" }),
      );
      link.download = "Unsupported.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(
        () => report("unexpected-complete", { origin: location.origin }),
        700,
      );
    }
    if (command === "failure") {
      const requestId = crypto.randomUUID();
      window.SavtCksGoBridge!.postMessage(
        JSON.stringify({
          type: "document-save",
          payload: {
            protocolVersion: "1",
            requestId,
            filename: "../bad.pdf",
            mimeType: "application/pdf",
            base64: "JVBERi0xLjc=",
          },
        }),
      );
    }
  } catch {}
  setTimeout(commands, 100);
}
commands();
