import type { PaymentController, PaymentState } from "./state";

type PaymentActions = Pick<
  PaymentController,
  "initiate" | "reopen" | "checkStatus" | "restart"
>;

const action = "customer-button customer-primary payment-action";

export function PaymentPanel({
  state,
  controller,
  onViewOrder,
}: {
  state: PaymentState;
  controller: PaymentActions;
  onViewOrder?: (orderId: string) => void;
}) {
  if (state.phase === "idle") return null;
  if (state.phase === "paid" && state.order)
    return (
      <section className="payment-card payment-success" aria-live="polite">
        <p className="quote-eyebrow">Payment successful</p>
        <h2>Order Confirmed</h2>
        <p>
          CKS Go confirmed payment and created your order from authenticated
          backend evidence.
        </p>
        <dl className="payment-evidence">
          <dt>Order number</dt>
          <dd>{state.order.orderNumber}</dd>
          <dt>Order status</dt>
          <dd>{state.order.status}</dd>
        </dl>
        {onViewOrder && (
          <button
            className={action}
            onClick={() => onViewOrder(state.order!.orderId)}
          >
            View order
          </button>
        )}
      </section>
    );
  if (state.phase === "paid")
    return (
      <PaymentNotice
        title="Payment unavailable"
        message="We could not verify the Order created for this payment. Check again before taking another action."
      />
    );
  if (state.phase === "ready")
    return (
      <section className="payment-card" aria-labelledby="payment-title">
        <p className="quote-eyebrow">Secure checkout</p>
        <h2 id="payment-title">Ready for payment</h2>
        <p>
          CKS Go securely starts payment with the accepted quote. The external
          payment page will open through Savt.
        </p>
        <button className={action} onClick={() => void controller.initiate()}>
          Proceed to payment
        </button>
      </section>
    );
  if (state.phase === "initiating" || state.phase === "opening")
    return (
      <PaymentNotice
        title="Opening secure payment"
        message="Keep CKS Go open while Savt prepares the external payment page."
        busy
      />
    );
  if (state.phase === "pending")
    return (
      <section className="payment-card" aria-live="polite">
        <p className="quote-eyebrow">Awaiting backend confirmation</p>
        <h2>Payment pending</h2>
        <p>
          Returning from the payment page does not confirm payment. CKS Go will
          show an order only after the backend reports paid with Order details.
        </p>
        <PaymentObservationActions controller={controller} reopen />
      </section>
    );
  if (state.phase === "checking")
    return (
      <PaymentNotice
        title="Checking payment status"
        message="Confirming payment and Order evidence with CKS Go."
        busy
      />
    );
  if (state.phase === "paid-processing")
    return (
      <section className="payment-card" aria-live="polite">
        <p className="quote-eyebrow">Backend finality pending</p>
        <h2>Payment received — finalising your order</h2>
        <p>
          Payment was received, but the backend has not projected a complete
          Order yet. Keep this page open and check again shortly.
        </p>
        <PaymentObservationActions controller={controller} />
      </section>
    );
  if (state.phase === "handoff-error")
    return (
      <section className="payment-card payment-warning" role="alert">
        <p className="quote-eyebrow">Payment remains pending</p>
        <h2>Could not open secure payment</h2>
        <p>
          The existing payment was kept. Reopen it through Savt or check its
          backend status; do not start another payment.
        </p>
        <PaymentObservationActions controller={controller} reopen />
      </section>
    );
  if (state.phase === "failed")
    return (
      <section className="payment-card payment-warning" role="alert">
        <p className="quote-eyebrow">Backend payment result</p>
        <h2>Payment failed</h2>
        <p>
          This payment did not complete. Restart checkout to clear the cart and
          request a fresh quote.
        </p>
        <button className={action} onClick={() => controller.restart()}>
          Restart checkout
        </button>
      </section>
    );
  if (state.phase === "session-expired")
    return (
      <PaymentNotice
        title="Session expired"
        message="Return to Savt and reopen CKS Go before checking payment again."
      />
    );
  return (
    <section className="payment-card payment-warning" role="alert">
      <p className="quote-eyebrow">Safe recovery</p>
      <h2>Payment unavailable</h2>
      <p>
        CKS Go could not safely confirm this payment response. No order has been
        confirmed.
      </p>
      {state.canRetryInitiation ? (
        <button className={action} onClick={() => void controller.initiate()}>
          Retry payment initiation
        </button>
      ) : state.paymentIntentId ? (
        <PaymentObservationActions controller={controller} />
      ) : (
        <button className={action} onClick={() => controller.restart()}>
          Restart checkout
        </button>
      )}
    </section>
  );
}

function PaymentNotice({
  title,
  message,
  busy = false,
}: {
  title: string;
  message: string;
  busy?: boolean;
}) {
  return (
    <section className="payment-card" role="status" aria-live="polite">
      <h2>{title}</h2>
      <p>{message}</p>
      {busy && <span className="payment-progress" aria-hidden="true" />}
    </section>
  );
}

function PaymentObservationActions({
  controller,
  reopen = false,
}: {
  controller: PaymentActions;
  reopen?: boolean;
}) {
  return (
    <div className="payment-actions">
      <button className={action} onClick={() => void controller.checkStatus()}>
        Check payment status
      </button>
      {reopen && (
        <button
          className="customer-button payment-action"
          onClick={() => void controller.reopen()}
        >
          Reopen secure payment
        </button>
      )}
    </div>
  );
}
