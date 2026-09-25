import { useEffect, useRef, useState, type ComponentProps } from "react";
import { PaymentPanel } from "../payment/components";
import { MAX_LINE_QUANTITY } from "./contracts";
import type { CartController, CartState } from "./state";
import { QuantitySelector } from "../components/QuantitySelector";
import { BagIcon } from "../components/Icons";
import { useProductArtworkUrl } from "../catalogue/reference-match/useArtwork";

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
  CHECKOUT_OUTLET_PRODUCT_NOT_FOUND: [
    "Product unavailable",
    "A cart product was not found at this outlet. Remove it before requesting another quote.",
  ],
  CHECKOUT_PRODUCT_INACTIVE: [
    "Product unavailable",
    "A cart product is no longer available. Remove it before requesting another quote.",
  ],
  CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE: [
    "Product unavailable",
    "A cart product is no longer available at this outlet. Remove it before requesting another quote.",
  ],
  CHECKOUT_INSUFFICIENT_STOCK: [
    "Stock changed",
    "The available stock changed. Reduce the quantity before requesting another quote.",
  ],
  CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH: [
    "Assigned outlet changed",
    "This cart no longer matches the outlet assigned to the address. Review the address before continuing.",
  ],
  CUSTOMER_ADDRESS_CHANGED: [
    "Address changed",
    "The saved address changed. Reload addresses and request a new quote.",
  ],
  CUSTOMER_ASSIGNMENT_INCOMPLETE: [
    "Assignment could not be completed",
    "The assignment or route provider is unavailable. Try again later.",
  ],
  CUSTOMER_NO_SERVICEABLE_OUTLET: [
    "No serviceable outlet",
    "No outlet can serve this address right now. Choose another saved address.",
  ],
  CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE: [
    "Assigned outlet unavailable",
    "The assigned outlet cannot accept this cart right now.",
  ],
  CHECKOUT_ADDRESS_NOT_SERVICEABLE: [
    "Address not serviceable",
    "The assigned outlet cannot deliver to this address.",
  ],
  CHECKOUT_ROUTE_DURATION_UNAVAILABLE: [
    "Delivery timing unavailable",
    "A trusted delivery time could not be calculated. Try again later.",
  ],
  NETWORK_ERROR: [
    "You appear to be offline",
    "Check your connection, then retry the same quote request.",
  ],
  REQUEST_TIMEOUT: [
    "Quote request timed out",
    "The outcome is uncertain. Retry the same request safely.",
  ],
  INVALID_RESPONSE: [
    "Quote response unavailable",
    "We could not safely read the trusted quote response. Retry the same request.",
  ],
  CUSTOMER_SESSION_INVALID: [
    "Session expired",
    "Return to Savt and reopen CKS Go before requesting another quote.",
  ],
  CUSTOMER_CSRF_INVALID: [
    "Session expired",
    "Return to Savt and reopen CKS Go before requesting another quote.",
  ],
};

const transitionErrors: Record<string, [string, string]> = {
  CUSTOMER_ASSIGNMENT_INCOMPLETE: [
    "Assignment could not be completed",
    "The assignment provider could not complete this address. Your current address and cart were kept.",
  ],
  CUSTOMER_NO_SERVICEABLE_OUTLET: [
    "No serviceable outlet",
    "No outlet can serve that address right now. Your current address and cart were kept.",
  ],
  CUSTOMER_ADDRESS_CHANGED: [
    "Address changed",
    "The saved address changed before assignment. Reload addresses before trying again; your current address and cart were kept.",
  ],
};

export function AddressTransitionError({ error }: { error: string | null }) {
  if (!error) return null;
  const [title, message] = transitionErrors[error] ?? [
    "Assigned outlet unavailable",
    "We could not verify the assigned outlet for that address. Your current address and cart were kept.",
  ];
  return (
    <section className="quote-error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
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
          <h2 id="quote-title" className="sr-only">
            Review your order
          </h2>
        </div>
        <span className="quote-currency">{quote.currency}</span>
      </div>
      {state.quotePhase === "price-review" && (
        <div className="quote-warning" role="alert">
          <h3>Review updated total</h3>
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
          <h3>Quote expired</h3>
          <p>
            This quote is no longer valid. Request a new quote to refresh
            prices, stock and delivery timing.
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
                  <span>
                    {line.quantity} × {line.uomNameSnapshot}
                  </span>
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
        <dt>Merchandise subtotal</dt>
        <dd>{money(quote.itemsSubtotalMinor)}</dd>
        <dt>Delivery fee</dt>
        <dd>{money(quote.finalDeliveryChargeMinor)}</dd>
        <dt>Processing fee</dt>
        <dd>{money(quote.processingFeeMinor)}</dd>
        <dt className="quote-grand">Total</dt>
        <dd className="quote-grand">{money(quote.grandTotalMinor)}</dd>
      </dl>
      <details className="quote-evidence-details">
        <summary>Quote details</summary>
        <dl className="quote-evidence">
          <dt>Estimated delivery</dt>
          <dd>{quote.estimatedTotalOrderMinutes} minutes</dd>
          <dt>Expires</dt>
          <dd>{malaysiaTime(quote.quoteExpiresAt)} (Malaysia time)</dd>
        </dl>
      </details>
      {state.quotePhase === "price-review" && (
        <button
          className="customer-button customer-primary quote-action"
          onClick={() => controller.acceptPriceChanges()}
        >
          Accept updated total
        </button>
      )}
      {state.quotePhase === "expired" && (
        <button
          className="customer-button customer-primary quote-action"
          onClick={() => void controller.requestQuote()}
        >
          Get a new quote
        </button>
      )}
      {state.quotePhase === "ready" && (
        <p className="quote-safe-note">
          Prices and fees are confirmed for this review.
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
  if (!state.lines.length)
    return (
      <section className="catalogue-state cart-empty" role="status">
        <h2>Your cart is empty</h2>
        <p>Add available products from your assigned outlet.</p>
        <button className="customer-button customer-primary" onClick={onBrowse}>
          Browse products
        </button>
      </section>
    );
  const subtotal = state.lines.reduce(
    (sum, line) => sum + line.displayedUnitPriceMinor * line.quantity,
    0,
  );
  const error = state.error
    ? (quoteErrors[state.error] ?? [
        "Quote unavailable",
        "The trusted quote could not be created. Review the cart and try again.",
      ])
    : null;
  return (
    <div className="cart-stack cart-stack--shopping">
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
          <h2 id="cart-lines-title" className="sr-only">
            Cart items
          </h2>
        </div>
        {state.lines.map((line) => (
          <article className="cart-line" key={line.outletProductId}>
            <CartProductImage
              url={line.product.imageUrl}
              name={line.product.name}
            />
            <div className="cart-line-copy">
              <h3>{line.product.name}</h3>
              <p>{line.product.packSize || line.product.uom.name}</p>
              <strong>{money(line.displayedUnitPriceMinor)}</strong>
            </div>
            <QuantitySelector
              className="cart-quantity"
              label={`Quantity for ${line.product.name}`}
              quantity={line.quantity}
              minimum={0}
              maximum={MAX_LINE_QUANTITY}
              disabled={state.paymentFrozen}
              onDecrement={() =>
                controller.setQuantity(line.outletProductId, line.quantity - 1)
              }
              onIncrement={() =>
                controller.setQuantity(line.outletProductId, line.quantity + 1)
              }
            />
            <button
              className="cart-remove"
              aria-label={`Remove ${line.product.name}`}
              disabled={state.paymentFrozen}
              onClick={() => controller.remove(line.outletProductId)}
            >
              Remove
            </button>
            {line.quantity > 1 && (
              <p className="cart-line-subtotal">
                <span>Line subtotal</span>
                <strong>
                  {money(line.displayedUnitPriceMinor * line.quantity)}
                </strong>
              </p>
            )}
          </article>
        ))}
        {!state.quote && (
          <div className="cart-display-total">
            <span>Estimated subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
        )}
        {!state.quote && (
          <p className="catalogue-caption">
            Item prices are estimates. Delivery and processing fees are
            confirmed at review.
          </p>
        )}
        {state.quotePhase === "idle" && (
          <button
            className="customer-button customer-primary quote-action"
            onClick={() => void controller.requestQuote()}
          >
            Review order
          </button>
        )}
        {state.quotePhase === "quoting" && (
          <p className="quote-loading" role="status">
            Checking prices and delivery…
          </p>
        )}
      </section>
      {error && (
        <section className="quote-error" role="alert">
          <h2>{error[0]}</h2>
          <p>{error[1]}</p>
          {state.canRetry && (
            <button
              className="customer-button customer-primary"
              onClick={() => void controller.retryQuote()}
            >
              Retry same quote request
            </button>
          )}
          {!state.canRetry && state.quotePhase !== "session-expired" && (
            <button
              className="customer-button"
              onClick={() => void controller.requestQuote()}
            >
              Request a new quote
            </button>
          )}
        </section>
      )}
      <QuoteSummary state={state} controller={controller} payment={payment} />
      {payment && payment.state.phase !== "ready" && (
        <PaymentPanel
          {...payment}
          acceptedTotalMinor={state.quote?.grandTotalMinor}
        />
      )}
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
      <h2 id="cart-switch-title">Clear cart and switch address?</h2>
      <p id="cart-switch-description">
        {pending.address.label} is assigned to{" "}
        {pending.assignment.outletDisplayName}. Your current cart belongs to
        another outlet and cannot be remapped. Switching clears the cart and its
        quote.
      </p>
      <div className="cart-dialog-actions">
        <button
          autoFocus
          className="customer-button"
          onClick={() => controller.cancelAddressChange()}
        >
          Keep current cart
        </button>
        <button
          className="customer-button customer-danger"
          onClick={() => {
            const addressId = controller.confirmAddressChange();
            if (addressId) onCommit(addressId);
          }}
        >
          Clear cart and switch
        </button>
      </div>
    </dialog>
  );
}
