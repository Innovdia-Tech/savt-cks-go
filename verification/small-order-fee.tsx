// Synthetic local entry only: the actual screen, shell, parser and controllers.
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../src/components/Layout";
import { QuoteApi } from "../src/checkout/api";
import { CartScreen } from "../src/checkout/components";
import { CartController } from "../src/checkout/state";
import { PaymentController } from "../src/payment/state";
import { CustomerSessionController } from "../src/session/controller";
import { DevelopmentCustomerApi } from "../src/api/development";
import { DevelopmentBridgeAdapter } from "../src/webview/bridge";
import { parseOrderDetail } from "../src/orders/contracts";
import { OrderDetailScreen } from "../src/orders/components";
import "../src/styles.css";
import "../src/customer/customer.css";
import "../src/catalogue/catalogue.css";
import "../src/checkout/checkout.css";
import "../src/orders/orders.css";

const params = new URLSearchParams(location.search);
const name = params.get("fixture") ?? "small-charged";
const fixtures = import.meta.glob(
  "../src/checkout/fixtures/small-order-fee01/*.json",
  { eager: true, import: "default" },
);
const body = structuredClone(
  fixtures[`../src/checkout/fixtures/small-order-fee01/${name}.json`],
) as any;
const q = body.data;
const at = q.quoteIssuedAt;
const now = () => Date.parse(at);
const address = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  label: "Home",
  rowVersion: 7,
  status: "ACTIVE",
  addressLine1: "Local fixture address",
  addressLine2: null,
  city: "Tuaran",
  state: "Sabah",
  postcode: null,
} as any;
const assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: address.id,
  addressRowVersion: 7,
  outlet: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    displayReference: "LOCAL",
    displayName: "Local fixture outlet",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: at,
  expiresAt: q.quoteExpiresAt,
} as any;
const session = new CustomerSessionController(
  new DevelopmentCustomerApi(false),
  new DevelopmentBridgeAdapter(true, false),
);
await session.start();
const cart = new CartController(
  new QuoteApi("", session),
  { assign: async () => assignment },
  now,
);
cart.syncAssignment(address, assignment);
cart.add(
  {
    outletProductId: q.items[0].outletProductId,
    productId: q.items[0].productId,
    name: "Frozen product with a long authoritative name for narrow layouts",
    imageUrl: null,
    category: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Pantry" },
    subcategory: null,
    brand: null,
    uom: { code: "EA", name: "Each" },
    packSize: null,
    sellingPriceMinor: q.items[0].unitPriceMinor,
    currency: "MYR",
    availability: "AVAILABLE",
  },
  assignment,
);
cart.setQuantity(q.items[0].outletProductId, q.items[0].quantity);
const forbidden = async (): Promise<never> => {
  throw new Error("Payment/provider calls are forbidden in this proof.");
};
const payment = new PaymentController(
  { create: forbidden, result: forbidden, retry: forbidden },
  { requestPaymentHandoff: forbidden },
  session,
  (id) => cart.freezeForPayment(id),
  () => {},
  now,
);
cart.subscribe(() => {
  const state = cart.getSnapshot();
  payment.syncQuote(state.quote, state.quotePhase);
});
Object.assign(window, {
  smallFeeProof: {
    body,
    cart,
    payment,
    freeze: () => cart.freezeForPayment(cart.getSnapshot().quote!.quoteId),
    changeAddress: () =>
      cart.syncAssignment(
        { ...address, rowVersion: 8 },
        { ...assignment, addressRowVersion: 8 },
      ),
  },
});

function Basket() {
  const state = useSyncExternalStore(cart.subscribe, cart.getSnapshot);
  const paymentState = useSyncExternalStore(
    payment.subscribe,
    payment.getSnapshot,
  );
  return (
    <AppShell
      active="Basket"
      cartCount={state.lines.reduce((n, l) => n + l.quantity, 0)}
      onNavigate={() => {}}
      title="Basket"
      headerContext="transaction"
    >
      <CartScreen
        state={state}
        controller={cart}
        payment={{ state: paymentState, controller: payment }}
        onBrowse={() => {}}
        onChangeAddress={() => {}}
      />
    </AppShell>
  );
}

const id = "11111111-1111-4111-8111-111111111111";
const order = parseOrderDetail({
  data: {
    orderId: id,
    orderNumber: "CKS-LOCAL-0001",
    createdAt: at,
    updatedAt: at,
    customerStage: "ORDER_RECEIVED",
    paymentStatus: "PAID",
    cancellationKind: null,
    operationalFailure: null,
    outletId: assignment.outlet.id,
    outletName: "Local fixture outlet",
    canCancel: false,
    items: q.items.map((line: any) => ({
      orderItemId: "22222222-2222-4222-8222-222222222222",
      skuCode: line.skuCode,
      productName: line.productNameSnapshot,
      uomCode: line.uomCodeSnapshot,
      uomName: line.uomNameSnapshot,
      orderedQuantity: line.quantity,
      fulfilledQuantity: null,
      unavailableQuantity: null,
      unitPriceMinor: line.unitPriceMinor,
      discountMinor: 0,
      lineTotalMinor: line.lineSubtotalMinor,
    })),
    fulfilment: { fulfilmentConfirmed: false, confirmedAt: null },
    money: {
      itemsSubtotalMinor: q.itemsSubtotalMinor,
      discountAmountMinor: q.discountAmountMinor,
      netItemsTotalMinor: q.netItemsTotalMinor,
      finalDeliveryChargeMinor: q.finalDeliveryChargeMinor,
      processingFeeMinor: q.processingFeeMinor,
      grandTotalMinor: q.grandTotalMinor,
      currency: "MYR",
      ...(params.get("historical") ? {} : { processingFee: q.processingFee }),
    },
    destination: {
      recipientName: "Fixture customer",
      recipientPhoneE164: null,
      addressLine1: "Local fixture address",
      addressLine2: null,
      city: "Tuaran",
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
  },
});
const orderController = {
  load: forbidden,
  refresh: forbidden,
  nextPage: forbidden,
  previousPage: forbidden,
  downloadReceipt: forbidden,
  downloadPaymentReceipt: forbidden,
  refreshDocuments: forbidden,
  reportReceiptSaveFailure() {},
};
function Order() {
  return (
    <AppShell
      active="Orders"
      cartCount={0}
      onNavigate={() => {}}
      title="Order details"
      headerContext="orders"
    >
      <OrderDetailScreen
        state={{
          listPhase: "idle",
          page: null,
          listError: null,
          detailPhase: "ready",
          detail: order,
          detailError: null,
          receiptPhase: "idle",
          receiptError: null,
          documentsPhase: "ready",
          documents: null,
          documentsError: null,
          paymentReceiptPhase: "idle",
          paymentReceiptError: null,
        }}
        controller={orderController}
        onBack={() => {}}
      />
    </AppShell>
  );
}
createRoot(document.getElementById("root")!).render(
  params.get("screen") === "order" ? <Order /> : <Basket />,
);
