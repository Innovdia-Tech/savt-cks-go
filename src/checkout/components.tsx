import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { PaymentPanel } from "../payment/components";
import { MAX_LINE_QUANTITY, type ProcessingFee } from "./contracts";
import { syncDialog } from "../components/ui";
import {
  cartMerchandiseSummary,
  type CartController,
  type CartState,
} from "./state";
import { QuantitySelector } from "../components/QuantitySelector";
import {
  BagIcon,
  CheckIcon,
  ChevronDownIcon,
  TrashIcon,
} from "../components/Icons";
import { useProductArtworkUrl } from "../catalogue/reference-match/useArtwork";
import { addressLocationText } from "../addresses/presentation";

const money = (minor: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    minor / 100,
  );
const malaysiaTime = (value: string) =>
  new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
  });

const quoteErrors: Record<string, [string, string]> = {
  CHECKOUT_FEE_CONTRACT_UPGRADE_REQUIRED: [
    "We couldn't confirm the checkout fee.",
    "Your basket is still here. Refresh your total and try again.",
  ],
  CHECKOUT_PROCESSING_FEE_UNCONFIGURED: [
    "We couldn't confirm the checkout fee.",
    "Your basket is still here. Refresh your total and try again.",
  ],
  CHECKOUT_PROCESSING_FEE_INVALID: [
    "We couldn't confirm the checkout fee.",
    "Your basket is still here. Refresh your total and try again.",
  ],
  CHECKOUT_OUTLET_PRODUCT_NOT_FOUND: [
    "Product unavailable",
    "One item is no longer available. Remove it to continue.",
  ],
  CHECKOUT_PRODUCT_INACTIVE: [
    "Product unavailable",
    "One item is no longer available. Remove it to continue.",
  ],
  CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE: [
    "Product unavailable",
    "One item is no longer available. Remove it to continue.",
  ],
  CHECKOUT_INSUFFICIENT_STOCK: [
    "Stock changed",
    "The available stock changed. Reduce the quantity and refresh your total.",
  ],
  CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH: [
    "Store changed",
    "Your basket belongs to a different store. Check your delivery address to continue.",
  ],
  CUSTOMER_ADDRESS_CHANGED: [
    "Address changed",
    "Your saved address changed. Reload addresses, then refresh your total.",
  ],
  CUSTOMER_ASSIGNMENT_INCOMPLETE: [
    "We couldn't use this address.",
    "Check your delivery address and try again.",
  ],
  CUSTOMER_NO_SERVICEABLE_OUTLET: [
    "Delivery isn't available here yet.",
    "Choose another delivery address to continue.",
  ],
  CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE: [
    "This store can't accept orders right now.",
    "Try again later or choose another delivery address.",
  ],
  CHECKOUT_ADDRESS_NOT_SERVICEABLE: [
    "We're not delivering here yet.",
    "Choose another delivery address to continue.",
  ],
  CHECKOUT_ROUTE_DURATION_UNAVAILABLE: [
    "Delivery timing unavailable",
    "We couldn’t check delivery timing. Try again later.",
  ],
  NETWORK_ERROR: [
    "You appear to be offline",
    "Check your connection and try again.",
  ],
  REQUEST_TIMEOUT: [
    "Checking your total timed out",
    "We couldn’t confirm your total. Try again.",
  ],
  INVALID_RESPONSE: [
    "We couldn't refresh your total.",
    "Check your connection and try again.",
  ],
  CUSTOMER_SESSION_INVALID: [
    "Session expired",
    "Please return to Savt and sign in again.",
  ],
  CUSTOMER_CSRF_INVALID: [
    "Session expired",
    "Please return to Savt and sign in again.",
  ],
};

const transitionErrors: Record<string, [string, string]> = {
  CUSTOMER_ASSIGNMENT_INCOMPLETE: [
    "We couldn't use this address.",
    "Your current address and basket were kept. Check this address and try again.",
  ],
  CUSTOMER_NO_SERVICEABLE_OUTLET: [
    "Delivery isn't available here yet.",
    "Your current address and basket were kept. Choose another delivery address.",
  ],
  CUSTOMER_ADDRESS_CHANGED: [
    "Address changed",
    "Your saved address changed. Reload addresses and try again. Your current address and basket were kept.",
  ],
};

export function AddressTransitionError({ error }: { error: string | null }) {
  if (!error) return null;
  const [title, message] = transitionErrors[error] ?? [
    "This store can't accept orders right now.",
    "Your current address and basket were kept. Try again later or choose another delivery address.",
  ];
  return (
    <section className="quote-error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}

function SmallOrderFee({
  fee,
  chargedMinor,
}: {
  fee: Extract<ProcessingFee, { feeType: "SMALL_ORDER_TIERS" }>;
  chargedMinor: number;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const helperId = useId();
  const difference =
    fee.outcome === "CHARGED" &&
    fee.feeFreeFromMinor !== null &&
    fee.feeFreeFromMinor > fee.qualifyingAmountMinor
      ? fee.feeFreeFromMinor - fee.qualifyingAmountMinor
      : null;
  const helper =
    fee.outcome === "DISABLED"
      ? "Small order fee is currently not applied."
      : fee.outcome === "ZERO_TIER" || fee.outcome === "NO_MATCH"
        ? "No small order fee for this order."
        : difference !== null
          ? `${money(difference)} to go for no small order fee`
          : null;
  const close = () => setOpen(false);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    // Reuse the app's native modal foundation and bottom-sheet geometry.
    syncDialog(element, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const returnFocus = trigger.current;
    return () => {
      syncDialog(element, false);
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <dt className="small-order-fee-label">
        Small order fee
        <button
          ref={trigger}
          type="button"
          className="small-order-fee-info"
          aria-label="About small order fee"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={helperId}
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">ⓘ</span>
        </button>
      </dt>
      <dd className="small-order-fee-amount">{money(chargedMinor)}</dd>
      <dd className="small-order-fee-helper" id={helperId}>
        {helper && (
          <p
            className={
              difference !== null ? "small-order-fee-progress" : undefined
            }
          >
            {helper}
          </p>
        )}
        {fee.outcome === "CHARGED" && (
          <p>Based on items total after discounts. Delivery is excluded.</p>
        )}
        {open && (
          <dialog
            ref={dialog}
            className="ui-bottom-sheet small-order-fee-sheet"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onClose={close}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div className="ui-bottom-sheet__panel">
              <header>
                <h2 id={titleId}>Small order fee</h2>
                <strong>{money(chargedMinor)}</strong>
              </header>
              <p id={descriptionId}>
                {fee.outcome === "CHARGED"
                  ? "A small order fee applies based on your items total after discounts."
                  : helper}
              </p>
              <dl className="small-order-fee-details">
                <dt>Current items total after discounts</dt>
                <dd>{money(fee.qualifyingAmountMinor)}</dd>
                {fee.feeFreeFromMinor !== null && (
                  <>
                    <dt>No-fee threshold</dt>
                    <dd>{money(fee.feeFreeFromMinor)}</dd>
                  </>
                )}
              </dl>
              {difference !== null && (
                <p className="small-order-fee-progress">{helper}.</p>
              )}
              <p>
                {fee.feeFreeFromMinor === null
                  ? "Delivery charges are excluded from the items total after discounts."
                  : "Delivery charges do not count toward this threshold."}
              </p>
              <button
                type="button"
                className="customer-button customer-primary"
                autoFocus
                onClick={close}
              >
                Got it
              </button>
            </div>
          </dialog>
        )}
      </dd>
    </>
  );
}

function QuoteSummary({
  state,
  controller,
  payment,
}: {
  state: CartState;
  controller: CartController;
  payment?: ComponentProps<typeof PaymentPanel>;
}) {
  const quote = state.quote;
  if (!quote) return null;
  const cartPrices = new Map(
    state.lines.map((line) => [
      line.outletProductId,
      line.displayedUnitPriceMinor,
    ]),
  );
  return (
    <section className="quote-card" aria-labelledby="quote-title">
      <div className="quote-card-heading">
        <div>
          <h2 id="quote-title">Order summary</h2>
        </div>
        <span className="quote-currency">{quote.currency}</span>
      </div>
      {state.quotePhase === "price-review" && (
        <div className="quote-warning" role="alert">
          <h3>Your total has changed</h3>
          <p>
            {state.payableTotalChanged &&
            state.previousPayableTotalMinor !== null
              ? `The payable total changed from ${money(state.previousPayableTotalMinor)} to ${money(quote.grandTotalMinor)}. Check the items and fees before accepting.`
              : "One or more confirmed item prices changed. Check the items and fees before accepting."}
          </p>
        </div>
      )}
      {state.quotePhase === "expired" && (
        <div className="quote-warning" role="alert">
          <h3>Prices need refreshing</h3>
          <p>
            Refresh your total to check the latest prices, stock and delivery
            timing.
          </p>
        </div>
      )}
      {state.quotePhase === "price-review" && (
        <ul className="quote-lines" aria-label="Confirmed order lines">
          {quote.items.map((line) => {
            const previous = cartPrices.get(line.outletProductId);
            return (
              <li key={line.outletProductId}>
                <div>
                  <strong>{line.productNameSnapshot}</strong>
                  <span>Quantity {line.quantity}</span>
                  {previous !== undefined &&
                    previous !== line.unitPriceMinor && (
                      <span className="quote-price-change">
                        Previously {money(previous)} → confirmed{" "}
                        {money(line.unitPriceMinor)}
                      </span>
                    )}
                </div>
                <strong>{money(line.lineSubtotalMinor)}</strong>
              </li>
            );
          })}
        </ul>
      )}
      <dl className="quote-totals">
        <dt>Items subtotal</dt>
        <dd>{money(quote.itemsSubtotalMinor)}</dd>
        <dt>Delivery fee</dt>
        <dd>{money(quote.finalDeliveryChargeMinor)}</dd>
        {quote.processingFee.feeType === "SMALL_ORDER_TIERS" ? (
          <SmallOrderFee
            key={quote.quoteId}
            fee={quote.processingFee}
            chargedMinor={quote.processingFeeMinor}
          />
        ) : (
          <>
            <dt>Processing fee</dt>
            <dd>{money(quote.processingFeeMinor)}</dd>
          </>
        )}
        <dt className="quote-grand">Total</dt>
        <dd className="quote-grand">{money(quote.grandTotalMinor)}</dd>
      </dl>
      <details className="quote-evidence-details">
        <summary>
          Delivery details
          <ChevronDownIcon className="h-6 w-6" />
        </summary>
        <dl className="quote-evidence">
          <dt>Estimated delivery</dt>
          <dd>{quote.estimatedTotalOrderMinutes} minutes</dd>
          <dt>Prices valid until</dt>
          <dd>{malaysiaTime(quote.quoteExpiresAt)} (Malaysia time)</dd>
        </dl>
      </details>
      {state.quotePhase === "price-review" && (
        <button
          className="customer-button customer-primary quote-action"
          disabled={state.paymentFrozen}
          onClick={() => controller.acceptPriceChanges()}
        >
          Continue with {money(quote.grandTotalMinor)}
        </button>
      )}
      {state.quotePhase === "expired" && (
        <button
          className="customer-button customer-primary quote-action"
          disabled={state.paymentFrozen}
          onClick={() => void controller.requestQuote()}
        >
          Refresh total
        </button>
      )}
      {state.quotePhase === "ready" && (
        <p className="quote-safe-note">
          <CheckIcon className="h-4 w-4" />
          Prices and fees confirmed
        </p>
      )}
      {payment?.state.phase === "ready" && (
        <PaymentPanel {...payment} acceptedTotalMinor={quote.grandTotalMinor} />
      )}
    </section>
  );
}

function CartProductImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const source = useProductArtworkUrl(url);
  useEffect(() => setFailed(false), [source]);
  return (
    <div className="cart-line-image">
      {source && !failed ? (
        <img
          src={source}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span role="img" aria-label={`Image unavailable for ${name}`}>
          <BagIcon className="h-6 w-6" />
        </span>
      )}
    </div>
  );
}

export function CartScreen({
  state,
  controller,
  payment,
  onBrowse,
  deliveryAddress,
  onChangeAddress,
}: {
  state: CartState;
  controller: CartController;
  payment?: ComponentProps<typeof PaymentPanel>;
  onBrowse: () => void;
  deliveryAddress?: string;
  onChangeAddress?: () => void;
}) {
  if (!state.lines.length && payment?.state.paymentIntentId) {
    return (
      <div className="cart-stack cart-stack--shopping">
        <PaymentPanel {...payment} />
      </div>
    );
  }
  if (!state.lines.length)
    return (
      <section className="catalogue-state cart-empty" role="status">
        <h2>Your basket is empty</h2>
        <p>Browse products and add groceries to your basket.</p>
        <button className="customer-button customer-primary" onClick={onBrowse}>
          Browse products
        </button>
      </section>
    );
  const subtotal = cartMerchandiseSummary(state.lines).subtotalMinor;
  const error = state.error
    ? (quoteErrors[state.error] ?? [
        "We couldn’t refresh your total.",
        "Check your basket and try again.",
      ])
    : null;
  const paymentStatus =
    payment && payment.state.phase !== "ready" ? (
      <PaymentPanel
        {...payment}
        acceptedTotalMinor={state.quote?.grandTotalMinor}
      />
    ) : null;
  return (
    <div className="cart-stack cart-stack--shopping">
      {state.paymentFrozen && paymentStatus}
      {state.assignment && (
        <section
          className="cart-delivery"
          aria-labelledby="cart-delivery-title"
        >
          <div>
            <p className="quote-eyebrow">Deliver to</p>
            <h2 id="cart-delivery-title">
              {deliveryAddress || state.assignment.addressLabel}
            </h2>
          </div>
          {onChangeAddress && (
            <button
              className="cart-change-address"
              aria-label="Change delivery address"
              disabled={state.paymentFrozen}
              onClick={onChangeAddress}
            >
              Change
            </button>
          )}
          <p>
            From <strong>{state.assignment.outletDisplayName}</strong>
          </p>
        </section>
      )}
      <section className="cart-lines" aria-labelledby="cart-lines-title">
        <div className="cart-section-heading">
          <h2 id="cart-lines-title">Your items</h2>
        </div>
        {state.lines.map((line) => {
          const accepted = state.quote?.items.find(
            (item) => item.outletProductId === line.outletProductId,
          );
          const name = accepted?.productNameSnapshot ?? line.product.name;
          return (
            <article className="cart-line" key={line.outletProductId}>
              <CartProductImage url={line.product.imageUrl} name={name} />
              <div className="cart-line-copy">
                <h3>{name}</h3>
                <strong>
                  {money(
                    accepted?.unitPriceMinor ?? line.displayedUnitPriceMinor,
                  )}
                </strong>
              </div>
              <QuantitySelector
                className="cart-quantity"
                label={`Quantity for ${name}`}
                quantity={line.quantity}
                minimum={0}
                maximum={MAX_LINE_QUANTITY}
                disabled={state.paymentFrozen}
                onDecrement={() =>
                  controller.setQuantity(
                    line.outletProductId,
                    line.quantity - 1,
                  )
                }
                onIncrement={() =>
                  controller.setQuantity(
                    line.outletProductId,
                    line.quantity + 1,
                  )
                }
              />
              <button
                className="cart-remove"
                aria-label={`Remove ${name}`}
                disabled={state.paymentFrozen}
                onClick={() => controller.remove(line.outletProductId)}
              >
                <TrashIcon className="h-4 w-4" />
                Remove
              </button>
              {line.quantity > 1 && (
                <p className="cart-line-subtotal">
                  <span>Item subtotal</span>
                  <strong>
                    {money(
                      accepted?.lineSubtotalMinor ??
                        line.displayedUnitPriceMinor * line.quantity,
                    )}
                  </strong>
                </p>
              )}
            </article>
          );
        })}
      </section>
      {!state.quote && (
        <section className="quote-card" aria-labelledby="cart-estimate-title">
          <div className="quote-card-heading">
            <h2 id="cart-estimate-title">Order summary</h2>
          </div>
          <div className="cart-display-total">
            <span>Items subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <p className="catalogue-caption">
            Item prices are estimates. Delivery and processing fees are
            confirmed at review.
          </p>
          {!state.assignment && (
            <p className="catalogue-caption" role="status">
              Choose a delivery address before reviewing your order.
              {onChangeAddress && (
                <button
                  className="customer-button mt-2"
                  disabled={state.paymentFrozen}
                  onClick={onChangeAddress}
                >
                  Choose address
                </button>
              )}
            </p>
          )}
          {state.quotePhase === "idle" && (
            <button
              className="customer-button customer-primary quote-action"
              disabled={!state.assignment || state.paymentFrozen}
              onClick={() => void controller.requestQuote()}
            >
              Checkout
            </button>
          )}
          {state.quotePhase === "quoting" && (
            <p className="quote-loading" role="status">
              Checking prices and delivery…
            </p>
          )}
        </section>
      )}
      {error && (
        <section className="quote-error" role="alert">
          <h2>{error[0]}</h2>
          <p>{error[1]}</p>
          {state.canRetry && (
            <button
              className="customer-button customer-primary"
              disabled={state.paymentFrozen}
              onClick={() => void controller.retryQuote()}
            >
              Try again
            </button>
          )}
          {!state.canRetry && state.quotePhase !== "session-expired" && (
            <button
              className="customer-button"
              disabled={state.paymentFrozen}
              onClick={() => void controller.requestQuote()}
            >
              Refresh total
            </button>
          )}
        </section>
      )}
      <QuoteSummary state={state} controller={controller} payment={payment} />
      {!state.paymentFrozen && paymentStatus}
    </div>
  );
}

export function AddressChangeDialog({
  state,
  controller,
  onCommit,
}: {
  state: CartState;
  controller: CartController;
  onCommit: (addressId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = state.pendingAddress;
  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
    if (!pending && dialog.current?.open) dialog.current.close();
  }, [pending]);
  if (!pending) return null;
  return (
    <dialog
      ref={dialog}
      className="customer-dialog cart-dialog"
      aria-labelledby="cart-switch-title"
      aria-describedby="cart-switch-description"
      onCancel={(event) => {
        event.preventDefault();
        controller.cancelAddressChange();
      }}
    >
      <h2 id="cart-switch-title">
        {pending.assignment
          ? "Clear basket and switch address?"
          : "Change delivery address?"}
      </h2>
      <div id="cart-switch-description">
        <p>
          <strong>{pending.address.label}</strong>
          <br />
          {addressLocationText(pending.address)}
        </p>
        <p>
          {pending.assignment
            ? `Delivery to this address is from ${pending.assignment.outletDisplayName}. Your basket belongs to another store.`
            : "This address has been saved, but we are not delivering there yet."}
        </p>
        <p>
          Keep your current delivery address and basket, or use this address and
          clear the basket and reviewed total. This address remains saved for
          later if you keep your current delivery address.
        </p>
      </div>
      <div className="cart-dialog-actions">
        <button
          autoFocus
          className="customer-button"
          onClick={() => controller.cancelAddressChange()}
        >
          Keep current delivery address
        </button>
        <button
          className="customer-button customer-danger"
          onClick={() => {
            const addressId = controller.confirmAddressChange();
            if (addressId) onCommit(addressId);
          }}
        >
          Use this address &amp; clear basket
        </button>
      </div>
    </dialog>
  );
}
