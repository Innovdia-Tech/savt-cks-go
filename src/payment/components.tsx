import type { ReactNode } from "react";
import type { PaymentController, PaymentState } from "./state";
import { ClockIcon } from "../components/Icons";
import { SupportAction } from "../support/SupportAction";
import { useSupportWhatsApp } from "../support/context";
import { isLocalPaymentSimulatorBrowserEnabled } from "./local-simulator";

type PaymentActions = Pick<
  PaymentController,
  "initiate" | "retryPayment" | "reopen" | "checkStatus" | "restart"
>;

const action = "customer-button customer-primary payment-action";
const money = (minor: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    minor / 100,
  );

export function PaymentPanel({
  state,
  controller,
  onViewOrder,
  acceptedTotalMinor,
  supportWhatsApp: suppliedSupportWhatsApp,
}: {
  state: PaymentState;
  controller: PaymentActions;
  onViewOrder?: (orderId: string) => void;
  acceptedTotalMinor?: number;
  supportWhatsApp?: string;
}) {
  const configuredSupportWhatsApp = useSupportWhatsApp();
  const support = (
    <SupportAction
      digits={suppliedSupportWhatsApp ?? configuredSupportWhatsApp}
      context="payment"
    />
  );
  if (state.phase === "idle") return null;
  if (state.phase === "paid" && state.order)
    return (
      <section className="payment-card payment-success" aria-live="polite">
        <p className="quote-eyebrow">Payment successful</p>
        <h2>Order confirmed</h2>
        <p>Payment is complete and your CKS Go order is ready to track.</p>
        <dl className="payment-evidence">
          <dt>Order number</dt>
          <dd>{state.order.orderNumber}</dd>
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
        message="We couldn’t confirm your order. Check payment again before paying again."
      />
    );
  if (state.phase === "ready")
    return (
      <section className="payment-card" aria-label="Secure checkout">
        <p className="quote-eyebrow">Secure checkout with Savt</p>
        <p className="payment-final-notice">
          Please check your items and delivery address before paying.
          <br />
          Once confirmed, orders cannot be changed or cancelled in the app.
        </p>
        <button className={action} onClick={() => void controller.initiate()}>
          {acceptedTotalMinor === undefined
            ? "Pay securely"
            : `Pay ${money(acceptedTotalMinor)}`}
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
      <section
        className="payment-card payment-pending"
        role="status"
        aria-live="polite"
      >
        <h2>
          <ClockIcon className="h-6 w-6" />
          Payment pending
        </h2>
        <p>We're checking your payment status.</p>
        <p>Your order will appear once payment is confirmed.</p>
        {isLocalPaymentSimulatorBrowserEnabled() && (
          <button
            className="customer-button payment-action"
            onClick={() => void controller.checkStatus()}
          >
            Check Payment Status
          </button>
        )}
      </section>
    );
  if (state.phase === "retryable-pending" || state.phase === "retrying")
    return (
      <PaymentRecovery
        controller={controller}
        busy={state.phase === "retrying"}
      />
    );
  if (state.phase === "checking")
    return (
      <PaymentNotice
        title="Checking payment status"
        message="Confirming the latest payment result with CKS Go."
        busy
      />
    );
  if (state.phase === "paid-processing")
    return (
      <section className="payment-card" aria-live="polite">
        <p className="quote-eyebrow">Order confirmation in progress</p>
        <h2>Payment received — finalising your order</h2>
        <p>
          Payment is still processing and the order is not confirmed yet.
          Returning to CKS Go later will check the result again.
        </p>
        {isLocalPaymentSimulatorBrowserEnabled() && (
          <button
            className={action}
            onClick={() => void controller.checkStatus()}
          >
            Check Payment Status
          </button>
        )}
      </section>
    );
  if (state.phase === "handoff-error")
    return (
      <section className="payment-card payment-warning" role="alert">
        <p className="quote-eyebrow">Payment remains pending</p>
        <h2>Could not open secure payment</h2>
        <p>
          The existing payment attempt was kept. Continue that same attempt in
          the secure page; no new payment will be created.
        </p>
        <button className={action} onClick={() => void controller.reopen()}>
          Continue secure payment
        </button>
        {support}
      </section>
    );
  if (state.phase === "failed")
    return (
      <section className="payment-card payment-warning" role="alert">
        <p className="quote-eyebrow">Payment result</p>
        <h2>Payment failed</h2>
        <p>
          This payment did not complete. Your basket is saved. Review it and
          refresh your total before paying again.
        </p>
        <RecoveryActions controller={controller} />
        <button
          className="customer-button payment-action"
          onClick={() => controller.restart()}
        >
          Review basket
        </button>
        {support}
      </section>
    );
  if (state.phase === "session-expired")
    return (
      <PaymentNotice
        title="Session expired"
        message="Return to Savt and reopen CKS Go before checking payment again."
      />
    );
  if (state.error === "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED")
    return (
      <section className="payment-card payment-warning" role="alert">
        <h2>Payment could not be restarted</h2>
        <p>
          This payment can't be restarted from this checkout. Please return to
          your basket and try again.
        </p>
        <button className={action} onClick={() => controller.restart()}>
          Review basket
        </button>
        {support}
      </section>
    );
  if (state.canRetryPayment)
    return (
      <PaymentRecovery controller={controller} uncertain support={support} />
    );
  return (
    <section className="payment-card payment-warning" role="alert">
      <p className="quote-eyebrow">Check your payment</p>
      <h2>Payment unavailable</h2>
      <p>
        {state.paymentIntentId
          ? "CKS Go could not verify the latest payment status. No order has been confirmed."
          : "CKS Go could not safely confirm this payment response. No order has been confirmed."}
      </p>
      {state.canRetryInitiation ? (
        <button className={action} onClick={() => void controller.initiate()}>
          Try again
        </button>
      ) : state.paymentIntentId ? (
        <button
          className={action}
          onClick={() => void controller.checkStatus()}
        >
          Check payment again
        </button>
      ) : (
        <button className={action} onClick={() => controller.restart()}>
          Review basket
        </button>
      )}
      {support}
    </section>
  );
}

function RecoveryActions({
  controller,
  busy = false,
}: {
  controller: PaymentActions;
  busy?: boolean;
}) {
  return (
    <div className="payment-actions">
      <button
        className={action}
        disabled={busy}
        onClick={() => void controller.retryPayment()}
      >
        Try Payment Again
      </button>
      <button
        className="customer-button payment-action"
        disabled={busy}
        onClick={() => void controller.checkStatus()}
      >
        Check Payment Status
      </button>
    </div>
  );
}

function PaymentRecovery({
  controller,
  busy = false,
  uncertain = false,
  support,
}: {
  controller: PaymentActions;
  busy?: boolean;
  uncertain?: boolean;
  support?: ReactNode;
}) {
  return (
    <section
      className="payment-card"
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <h2>{busy ? "Preparing a new payment" : "Payment not completed"}</h2>
      <p>
        {busy
          ? "Please wait while we check your payment and prepare the secure payment page."
          : uncertain
            ? "We couldn't confirm the payment request. You can try again safely or check the latest payment status."
            : "We haven't received payment confirmation. If you closed the payment page before finishing, you can try again."}
      </p>
      <RecoveryActions controller={controller} busy={busy} />
      {support}
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
