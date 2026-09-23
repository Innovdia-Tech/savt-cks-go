import { useEffect, useRef, useState } from "react";
import type {
  CustomerOrderStage,
  OrderDetail,
  OrderListItem,
} from "./contracts";
import type { OrdersController, OrdersState } from "./state";
import { StatusBadge, SystemState } from "../components/ui";

type Actions = Pick<
  OrdersController,
  | "load"
  | "refresh"
  | "nextPage"
  | "previousPage"
  | "cancel"
  | "retryCancellation"
  | "downloadReceipt"
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
      className="order-card"
      onClick={() => onOpen(order.orderId)}
      aria-label={`View order ${order.orderNumber}`}
    >
      <span className="order-card-top">
        <span>
          <small>Order</small>
          <strong>{order.orderNumber}</strong>
        </span>
        <Status stage={order.customerStage} />
      </span>
      <span className="order-card-meta">
        <span>{malaysiaTime(order.createdAt)}</span>
        <span>{order.outletName}</span>
      </span>
      <span className="order-card-total">
        <span>Order total</span>
        <strong>{money(order.grandTotalMinor)}</strong>
      </span>
      <span className="order-card-delivery-type">
        {order.deliveryType === "NOW" ? "Delivery now" : "Scheduled delivery"}
      </span>
      <span className="order-card-open">
        View details <span aria-hidden="true">→</span>
      </span>
    </button>
  );
}

function OrderGroup({
  title,
  orders,
  empty,
  onOpen,
}: {
  title: string;
  orders: OrderListItem[];
  empty: string;
  onOpen: (orderId: string) => void;
}) {
  const headingId = `order-group-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section className="order-group" aria-labelledby={headingId}>
      <div className="order-group-heading">
        <h2 id={headingId}>{title}</h2>
        <span>{orders.length} on this page</span>
      </div>
      {orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <OrderCard key={order.orderId} order={order} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="order-page-empty">{empty}</p>
      )}
    </section>
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
  if (!page || page.data.length === 0)
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
    <div className="orders-stack">
      <div className="orders-toolbar">
        <p>
          {page.meta.total} {page.meta.total === 1 ? "order" : "orders"}
        </p>
        <button
          className="order-refresh"
          onClick={() => void controller.refresh()}
        >
          Refresh
        </button>
      </div>
      {page.meta.totalPages > 1 && (
        <p className="orders-page-note">
          Showing orders on page {page.meta.page} of {page.meta.totalPages}.
        </p>
      )}
      <OrderGroup
        title="Current orders"
        orders={current}
        empty={
          page.meta.totalPages > 1
            ? "No current orders on this page. Other pages may still contain active orders."
            : "No current orders."
        }
        onOpen={onOpen}
      />
      <OrderGroup
        title="Order history"
        orders={history}
        empty={
          page.meta.totalPages > 1
            ? "No completed or cancelled orders on this page. Other pages may contain order history."
            : "No completed or cancelled orders."
        }
        onOpen={onOpen}
      />
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
}: {
  state: OrdersState;
  controller: Actions;
  onBack: () => void;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);
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
  const stage = stagePresentation[order.customerStage];
  const currentStageIndex = progressStages.indexOf(
    order.customerStage as (typeof progressStages)[number],
  );
  const times = progressTimes(order);
  const activeOrder = currentOrderStages.includes(order.customerStage);
  return (
    <div className="order-detail-stack">
      <section className="order-detail-hero">
        <p className="order-eyebrow">{order.outletName}</p>
        <div>
          <h2>{order.orderNumber}</h2>
          <Status stage={order.customerStage} />
        </div>
        <p>Placed {malaysiaTime(order.createdAt)}</p>
        <p className="order-stage-explanation">{stage.explanation}</p>
        {activeOrder && (
          <div className="order-eta-compact" aria-label="Estimated delivery">
            <span>Estimated delivery</span>
            <strong>Estimate unavailable</strong>
          </div>
        )}
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
        {order.destination.instructions && (
          <p className="order-instructions">
            Delivery note: {order.destination.instructions}
          </p>
        )}
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
      {(order.receipt.receiptAvailable ||
        order.canCancel ||
        state.cancelPhase !== "idle" ||
        state.receiptPhase === "error") && (
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
          {order.canCancel && !state.canRetryCancellation && (
            <button
              className="customer-button order-cancel"
              disabled={state.cancelPhase === "cancelling"}
              onClick={() => setCancelOpen(true)}
            >
              Cancel order
            </button>
          )}
          {state.canRetryCancellation && (
            <button
              className="customer-button order-cancel"
              onClick={() => void controller.retryCancellation()}
            >
              Retry cancellation
            </button>
          )}
          {state.cancelPhase === "succeeded" && (
            <p className="order-action-success" role="status">
              Order cancelled. CKS Go recorded the refund requirement.
            </p>
          )}
          {state.cancelPhase === "error" && (
            <p className="order-action-error" role="alert">
              {state.canRetryCancellation
                ? "The cancellation result could not be confirmed. Retry the same request before taking another action."
                : "This order could not be cancelled. CKS Go rechecked the current order state."}
            </p>
          )}
          {state.receiptPhase === "error" && (
            <p className="order-action-error" role="alert">
              The receipt could not be downloaded safely. Try again later.
            </p>
          )}
        </section>
      )}
      <CancellationDialog
        open={cancelOpen}
        orderNumber={order.orderNumber}
        busy={state.cancelPhase === "cancelling"}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          void controller.cancel();
        }}
      />
    </div>
  );
}

export function CancellationDialog({
  open,
  orderNumber,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  orderNumber: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="customer-dialog order-dialog"
      aria-labelledby="cancel-order-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <p className="order-eyebrow">Customer cancellation</p>
      <h2 id="cancel-order-title">Cancel order {orderNumber}?</h2>
      <p>
        CKS Go will recheck whether this paid order can still be cancelled. If
        accepted, it creates a refund requirement; it does not prove a completed
        refund.
      </p>
      <div className="order-dialog-actions">
        <button
          autoFocus
          className="customer-button"
          disabled={busy}
          onClick={onCancel}
        >
          Keep order
        </button>
        <button
          className="customer-button order-cancel-confirm"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Cancelling…" : "Cancel order"}
        </button>
      </div>
    </dialog>
  );
}
