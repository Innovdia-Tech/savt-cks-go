import { useEffect, useState } from "react";
import type {
  CustomerOrderStage,
  OrderDetail,
  OrderListItem,
} from "./contracts";
import type { OrdersController, OrdersState } from "./state";
import { SupportAction } from "../support/SupportAction";
import { IconButton, StatusBadge, SystemState } from "../components/ui";
import { ReceiptIcon, RefreshIcon } from "../components/Icons";
import {
  hasDocumentSaveBridge,
  requestDocumentSave,
} from "../webview/document-save";

type Actions = Pick<
  OrdersController,
  | "load"
  | "refresh"
  | "nextPage"
  | "previousPage"
  | "downloadReceipt"
  | "downloadPaymentReceipt"
  | "refreshDocuments"
  | "reportReceiptSaveFailure"
>;

const money = (minor: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    minor / 100,
  );
const malaysiaTime = (value: string) =>
  new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));

function Status({ stage }: { stage: CustomerOrderStage }) {
  return <StatusBadge status={stage} />;
}
function StateCard({
  title,
  message,
  action,
  actionLabel,
  busy = false,
  tone = "error",
}: {
  title: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
  busy?: boolean;
  tone?: "empty" | "error";
}) {
  return (
    <SystemState
      tone={busy ? "loading" : tone}
      title={title}
      description={message}
      actionLabel={actionLabel}
      onAction={action}
      busy={busy}
    />
  );
}

const currentOrderStages: CustomerOrderStage[] = [
  "ORDER_RECEIVED",
  "PICK_AND_PACK",
  "OUT_FOR_DELIVERY",
];

const stagePresentation: Record<
  CustomerOrderStage,
  { title: string; explanation: string }
> = {
  ORDER_RECEIVED: {
    title: "Order received",
    explanation:
      "We have your order. The outlet will begin preparing your items.",
  },
  PICK_AND_PACK: {
    title: "Preparing your order",
    explanation: "The outlet is selecting and packing your groceries.",
  },
  OUT_FOR_DELIVERY: {
    title: "Out for delivery",
    explanation: "Your packed order is on its way to your delivery address.",
  },
  DELIVERED: {
    title: "Delivered",
    explanation: "Your order has been delivered.",
  },
  CANCELLED: {
    title: "Cancelled",
    explanation: "This order was cancelled and will not be delivered.",
  },
  REJECTED: {
    title: "Unable to fulfil",
    explanation: "The outlet could not fulfil this order.",
  },
};

function OrderCard({
  order,
  onOpen,
}: {
  order: OrderListItem;
  onOpen: (orderId: string) => void;
}) {
  return (
    <button
      className="order-card order-card--shopping"
      onClick={() => onOpen(order.orderId)}
      aria-label={`View order ${order.orderNumber}`}
    >
      <strong>#{order.orderNumber}</strong>
      <Status stage={order.customerStage} />
      <span>{malaysiaTime(order.createdAt)}</span>
      <b>
        <span className="sr-only">Order total </span>
        {money(order.grandTotalMinor)}
      </b>
      <span className="order-card--shopping-arrow" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export function OrdersRefreshButton({
  state,
  controller,
}: {
  state: OrdersState;
  controller: Actions;
}) {
  const busy = state.listPhase === "idle" || state.listPhase === "loading";
  return (
    <IconButton
      label="Refresh orders"
      title="Refresh orders"
      className="orders-header-refresh"
      disabled={busy || state.listPhase === "session-expired"}
      aria-busy={busy || undefined}
      onClick={() => void controller.refresh()}
    >
      <RefreshIcon />
    </IconButton>
  );
}

type OrdersScreenProps = {
  state: OrdersState;
  controller: Actions;
  onOpen: (orderId: string) => void;
  onBrowse: () => void;
  supportWhatsApp?: string;
};

export function OrdersScreen({
  supportWhatsApp = "",
  ...props
}: OrdersScreenProps) {
  return (
    <>
      <SupportAction digits={supportWhatsApp} context="orders" />
      <OrdersContent {...props} />
    </>
  );
}

function OrdersContent({
  state,
  controller,
  onOpen,
  onBrowse,
}: OrdersScreenProps) {
  const [statusView, setStatusView] = useState<"current" | "history">(
    "current",
  );
  useEffect(() => {
    if (state.listPhase === "idle") void controller.load();
  }, [state.listPhase, controller]);
  if (state.listPhase === "idle" || state.listPhase === "loading")
    return <StateCard title="Loading your orders…" message="" busy />;
  if (state.listPhase === "session-expired")
    return (
      <StateCard
        title="Session expired"
        message="Return to Savt and reopen CKS Go to view your orders."
      />
    );
  if (state.listPhase === "error")
    return (
      <StateCard
        title="Orders unavailable"
        message="We couldn’t load your orders. Check your connection and try again."
        action={() => void controller.refresh()}
        actionLabel="Try again"
      />
    );
  const page = state.page;
  if (!page || (page.data.length === 0 && page.meta.total === 0))
    return (
      <SystemState
        title="No orders yet"
        tone="empty"
        description="Your CKS Go orders will appear here after checkout."
        icon={<ReceiptIcon className="h-7 w-7" />}
        onAction={onBrowse}
        actionLabel="Browse products"
      />
    );
  const current = page.data.filter((order) =>
    currentOrderStages.includes(order.customerStage),
  );
  const history = page.data.filter(
    (order) => !currentOrderStages.includes(order.customerStage),
  );
  return (
    <div className="orders-stack orders-stack--shopping">
      <div
        className="orders-status-tabs"
        role="group"
        aria-label="Order status"
      >
        <button
          type="button"
          aria-pressed={statusView === "current"}
          onClick={() => setStatusView("current")}
        >
          Current orders ({current.length}
          {page.meta.totalPages > 1 ? " on this page" : ""})
        </button>
        <button
          type="button"
          aria-pressed={statusView === "history"}
          onClick={() => setStatusView("history")}
        >
          Order history ({history.length}
          {page.meta.totalPages > 1 ? " on this page" : ""})
        </button>
      </div>
      {page.meta.totalPages > 1 && (
        <p className="orders-page-note">
          Showing orders on page {page.meta.page} of {page.meta.totalPages}.
        </p>
      )}
      <div className="order-list" hidden={statusView !== "current"}>
        {current.length ? (
          current.map((order) => (
            <OrderCard key={order.orderId} order={order} onOpen={onOpen} />
          ))
        ) : (
          <p className="order-page-empty">
            {page.meta.totalPages > 1
              ? "No current orders on this page. Other pages may still contain active orders."
              : "No current orders."}
          </p>
        )}
      </div>
      <div className="order-list" hidden={statusView !== "history"}>
        {history.length ? (
          history.map((order) => (
            <OrderCard key={order.orderId} order={order} onOpen={onOpen} />
          ))
        ) : (
          <p className="order-page-empty">
            {page.meta.totalPages > 1
              ? "No completed or cancelled orders on this page. Other pages may contain order history."
              : "No completed or cancelled orders."}
          </p>
        )}
      </div>
      {page.meta.totalPages > 1 && (
        <nav className="order-pages" aria-label="Order pages">
          <button
            className="customer-button"
            disabled={page.meta.page <= 1}
            onClick={() => void controller.previousPage()}
          >
            Previous page
          </button>
          <span>
            Page {page.meta.page} of {Math.max(page.meta.totalPages, 1)}
          </span>
          <button
            className="customer-button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => void controller.nextPage()}
          >
            Next page
          </button>
        </nav>
      )}
    </div>
  );
}

const progressStages = [
  "ORDER_RECEIVED",
  "PICK_AND_PACK",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

const progressTimes = (detail: OrderDetail) => [
  detail.milestones.paymentConfirmedAt,
  detail.milestones.pickingStartedAt ?? detail.milestones.acceptedAt,
  detail.delivery.pickedUpAt,
  detail.milestones.deliveredAt ?? detail.delivery.deliveredAt,
];

export async function saveReceipt(controller: Actions, paymentReceipt = false) {
  const embedded = hasDocumentSaveBridge();
  const result = await (paymentReceipt
    ? controller.downloadPaymentReceipt(embedded)
    : controller.downloadReceipt(embedded));
  if (!result) return;
  let url: string | undefined;
  let link: HTMLAnchorElement | undefined;
  try {
    if (embedded) {
      await requestDocumentSave(result.blob, result.filename);
      result.completeSave?.(true);
      return;
    }
    url = URL.createObjectURL(result.blob);
    link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
  } catch {
    if (result.completeSave) result.completeSave(false);
    else controller.reportReceiptSaveFailure(paymentReceipt);
  } finally {
    link?.remove();
    // Give the browser/WebView time to consume the attachment before releasing it.
    if (url) setTimeout(() => URL.revokeObjectURL(url!), 60_000);
  }
}

function OrderDocumentsSection({
  state,
  controller,
}: {
  state: OrdersState;
  controller: Actions;
}) {
  const paymentAvailable =
    state.documentsPhase === "ready" &&
    state.documents?.paymentReceiptAvailable;
  const receiptUnavailable =
    state.documentsPhase === "error" ||
    (state.documentsPhase === "ready" && !paymentAvailable);
  const showFinalReceipt =
    state.documentsPhase === "ready" &&
    !receiptUnavailable &&
    Boolean(state.detail?.milestones.completedAt);
  const finalAvailable = state.detail?.receipt.receiptAvailable;
  return (
    <>
      <section
        className="order-section order-documents"
        aria-labelledby="order-receipt-title"
      >
        <h3 id="order-receipt-title">
          {receiptUnavailable ? "Receipt temporarily unavailable" : "Receipt"}
        </h3>
        {(state.documentsPhase === "idle" ||
          state.documentsPhase === "loading") && (
          <p role="status">Loading your receipt…</p>
        )}
        {receiptUnavailable && (
          <div>
            <p role="alert">We couldn’t load your receipt. Please try again.</p>
            <button
              className="customer-button"
              onClick={() => void controller.refreshDocuments()}
            >
              Try again
            </button>
          </div>
        )}
        {paymentAvailable && (
          <div className="order-document">
            <p>Payment received</p>
            <strong>{money(state.detail!.money.grandTotalMinor)}</strong>
            <button
              className="customer-button customer-primary"
              disabled={state.paymentReceiptPhase === "downloading"}
              aria-busy={state.paymentReceiptPhase === "downloading"}
              onClick={() => void saveReceipt(controller, true)}
            >
              {state.paymentReceiptPhase === "downloading"
                ? "Preparing receipt…"
                : "Download Receipt"}
            </button>
            {state.paymentReceiptPhase === "error" && (
              <p className="order-action-error" role="alert">
                We couldn’t download your receipt. Please try again.
              </p>
            )}
            {state.paymentReceiptPhase === "saved" && (
              <p role="status">Receipt saved</p>
            )}
          </div>
        )}
      </section>
      {showFinalReceipt && (
        <section
          className="order-section order-documents"
          aria-labelledby="order-final-receipt-title"
        >
          <h3 id="order-final-receipt-title">Final Sales Receipt</h3>
          <p>Final fulfilled-order record</p>
          {finalAvailable && (
            <button
              className="customer-button"
              disabled={state.receiptPhase === "downloading"}
              aria-busy={state.receiptPhase === "downloading"}
              onClick={() => void saveReceipt(controller)}
            >
              {state.receiptPhase === "downloading"
                ? "Preparing Final Sales Receipt…"
                : "Download Final Sales Receipt"}
            </button>
          )}
          {!finalAvailable && (
            <p role="status">Your Final Sales Receipt is being prepared.</p>
          )}
          {state.receiptPhase === "error" && (
            <p className="order-action-error" role="alert">
              We couldn’t download your Final Sales Receipt. Please try again.
            </p>
          )}
          {state.receiptPhase === "saved" && <p role="status">Receipt saved</p>}
        </section>
      )}
    </>
  );
}

export function OrderDetailScreen({
  state,
  controller,
  onBack,
  supportWhatsApp = "",
}: {
  state: OrdersState;
  controller: Actions;
  onBack: () => void;
  supportWhatsApp?: string;
}) {
  if (state.detailPhase === "idle" || state.detailPhase === "loading")
    return <StateCard title="Loading order details…" message="" busy />;
  if (state.detailPhase === "session-expired")
    return (
      <StateCard
        title="Session expired"
        message="Return to Savt and reopen CKS Go before viewing this order."
      />
    );
  if (state.detailPhase === "error" || !state.detail)
    return (
      <StateCard
        title="Order unavailable"
        message="We couldn’t load this order. Return to your orders and try again."
        action={onBack}
        actionLabel="Back to orders"
      />
    );
  const order = state.detail;
  const currentStageIndex = progressStages.indexOf(
    order.customerStage as (typeof progressStages)[number],
  );
  const times = progressTimes(order);
  const activeOrder = currentOrderStages.includes(order.customerStage);
  return (
    <div className="order-detail-stack order-detail-stack--shopping">
      <section className="order-detail-hero">
        <div>
          <h2>#{order.orderNumber}</h2>
          <Status stage={order.customerStage} />
        </div>
        <p>Placed {malaysiaTime(order.createdAt)}</p>
      </section>
      <section className="order-section" aria-labelledby="order-progress-title">
        <div className="order-section-heading">
          <div>
            <p className="order-eyebrow">Latest update</p>
            <h3 id="order-progress-title">Where your order is</h3>
          </div>
        </div>
        <ol className="order-progress" aria-label="Order progress">
          {progressStages.map((progressStage, index) => {
            const reached =
              order.customerStage === "DELIVERED" ||
              (currentStageIndex >= 0 && index <= currentStageIndex) ||
              Boolean(times[index]);
            const current = activeOrder && index === currentStageIndex;
            const copy = stagePresentation[progressStage];
            return (
              <li
                key={progressStage}
                className={`${reached ? "is-reached" : ""} ${current ? "is-current" : ""}`}
                aria-current={current ? "step" : undefined}
              >
                <span aria-hidden="true">{reached ? "✓" : index + 1}</span>
                <div>
                  <strong>{copy.title}</strong>
                  {times[index] ? (
                    <time dateTime={times[index]!}>
                      {malaysiaTime(times[index]!)}
                    </time>
                  ) : reached || current ? (
                    <small>
                      {current ? copy.explanation : "Update time unavailable."}
                    </small>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="order-section" aria-labelledby="order-items-title">
        <h3 id="order-items-title">Items</h3>
        <ul className="order-items">
          {order.items.map((item) => (
            <li key={item.orderItemId}>
              <div>
                <strong>{item.productName}</strong>
                <span>
                  {item.orderedQuantity} × {item.uomName}
                </span>
                {order.fulfilment.fulfilmentConfirmed && (
                  <span>
                    Fulfilled {item.fulfilledQuantity ?? 0}; unavailable{" "}
                    {item.unavailableQuantity ?? 0}
                  </span>
                )}
              </div>
              <strong>{money(item.lineTotalMinor)}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="order-section" aria-labelledby="order-total-title">
        <h3 id="order-total-title">Payment summary</h3>
        <dl className="order-money">
          <dt>Items</dt>
          <dd>{money(order.money.itemsSubtotalMinor)}</dd>
          {order.money.discountAmountMinor > 0 && (
            <>
              <dt>Discount</dt>
              <dd>−{money(order.money.discountAmountMinor)}</dd>
            </>
          )}
          <dt>Delivery</dt>
          <dd>{money(order.money.finalDeliveryChargeMinor)}</dd>
          <dt>Processing fee</dt>
          <dd>{money(order.money.processingFeeMinor)}</dd>
          <dt className="order-grand">Grand total</dt>
          <dd className="order-grand">{money(order.money.grandTotalMinor)}</dd>
        </dl>
      </section>
      <section className="order-section" aria-labelledby="order-delivery-title">
        <h3 id="order-delivery-title">Delivery details</h3>
        {order.destination.recipientName && (
          <p>
            <strong>{order.destination.recipientName}</strong>
            {order.destination.recipientPhoneE164 && (
              <> · {order.destination.recipientPhoneE164}</>
            )}
          </p>
        )}
        <address>
          {order.destination.addressLine1}
          {order.destination.addressLine2 && (
            <>, {order.destination.addressLine2}</>
          )}
          <br />
          {order.destination.postcode} {order.destination.city},{" "}
          {order.destination.state}
        </address>
      </section>
      {order.refund.refundRequired && (
        <section className="order-refund" role="status">
          <h3>Refund required</h3>
          <p>
            CKS Go recorded a refund obligation of{" "}
            {money(order.refund.totalRequiredAmountMinor)}. This does not mean
            the refund has been settled.
          </p>
        </section>
      )}
      <OrderDocumentsSection state={state} controller={controller} />
      <section
        className="order-section order-help"
        aria-labelledby="order-help-title"
      >
        <h3 id="order-help-title">Need help with this order?</h3>
        <SupportAction
          digits={supportWhatsApp}
          orderNumber={order.orderNumber}
        />
      </section>
    </div>
  );
}
