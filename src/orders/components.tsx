import { useEffect, useState } from "react";
import type {
  CustomerOrderStage,
  OrderDetail,
  OrderListItem,
} from "./contracts";
import type { OrdersController, OrdersState } from "./state";
import { buildOrderSupportUrl, openOrderSupport } from "./support";
import { StatusBadge, SystemState } from "../components/ui";

type Actions = Pick<
  OrdersController,
  "load" | "refresh" | "nextPage" | "previousPage" | "downloadReceipt"
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
}: {
  title: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
  busy?: boolean;
}) {
  return (
    <SystemState
      tone={busy ? "loading" : action ? "error" : "empty"}
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
    title: "Pick & Pack",
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

export function OrdersScreen({
  state,
  controller,
  onOpen,
  onBrowse,
}: {
  state: OrdersState;
  controller: Actions;
  onOpen: (orderId: string) => void;
  onBrowse: () => void;
}) {
  const [statusView, setStatusView] = useState<"current" | "history">(
    "current",
  );
  useEffect(() => {
    if (state.listPhase === "idle") void controller.load();
  }, [state.listPhase, controller]);
  if (state.listPhase === "idle" || state.listPhase === "loading")
    return (
      <StateCard
        title="Loading your orders"
        message="Getting your latest order history from CKS Go."
        busy
      />
    );
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
        message="Your order history could not be loaded safely. Check your connection and try again."
        action={() => void controller.refresh()}
        actionLabel="Try again"
      />
    );
  const page = state.page;
  if (!page || (page.data.length === 0 && page.meta.total === 0))
    return (
      <StateCard
        title="No orders yet"
        message="Completed checkout orders will appear here after CKS Go confirms payment and Order identity."
        action={onBrowse}
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
      <button
        className="order-refresh"
        onClick={() => void controller.refresh()}
      >
        Refresh orders
      </button>
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

async function saveReceipt(controller: Actions) {
  const result = await controller.downloadReceipt();
  if (!result) return;
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  link.rel = "noopener";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
    return (
      <StateCard
        title="Loading order details"
        message="Getting the customer-safe Order projection from CKS Go."
        busy
      />
    );
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
        message="This order could not be found or loaded for this customer session."
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
  const helpUrl = buildOrderSupportUrl(supportWhatsApp, order.orderNumber);
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
                      {current
                        ? copy.explanation
                        : "Stage confirmed; update time unavailable."}
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
      {(order.receipt.receiptAvailable || state.receiptPhase === "error") && (
        <section className="order-actions" aria-label="Order actions">
          {order.receipt.receiptAvailable && (
            <button
              className="customer-button customer-primary"
              disabled={state.receiptPhase === "downloading"}
              onClick={() => void saveReceipt(controller)}
            >
              {state.receiptPhase === "downloading"
                ? "Preparing receipt…"
                : "Download receipt"}
            </button>
          )}
          {state.receiptPhase === "error" && (
            <p className="order-action-error" role="alert">
              The receipt could not be downloaded safely. Try again later.
            </p>
          )}
        </section>
      )}
      <section
        className="order-section order-help"
        aria-labelledby="order-help-title"
      >
        <h3 id="order-help-title">Get help with this order</h3>
        {helpUrl ? (
          <button
            className="customer-button"
            onClick={() => openOrderSupport(supportWhatsApp, order.orderNumber)}
          >
            Open WhatsApp support
          </button>
        ) : (
          <p>WhatsApp support is not available yet.</p>
        )}
      </section>
    </div>
  );
}
