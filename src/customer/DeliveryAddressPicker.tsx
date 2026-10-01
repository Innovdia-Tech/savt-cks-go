import { useEffect, useState } from "react";
import type { Address } from "../addresses/contracts";
import { AddressForm } from "../addresses/AddressForm";
import { editAddressName } from "../addresses/presentation";
import { AddressTransitionError } from "../checkout/components";
import { useCheckout } from "../checkout/context";
import { PinIcon, SearchIcon } from "../components/Icons";
import { DataFeedback } from "./components";
import { useCustomer } from "./context";
import { DeliveryLocationSetup } from "./DeliveryLocationSetup";
import { hasDeliveryCoordinates } from "./delivery-readiness";

type Action =
  | {
      kind: "location";
      address: Address | null;
      mode: "choose" | "search" | "current" | "confirm";
    }
  | { kind: "edit"; address: Address }
  | null;

export function DeliveryAddressPicker({
  onDone,
  onBack,
  onManage,
  initialAdd = false,
}: {
  onDone: () => void;
  onBack: () => void;
  onManage: () => void;
  initialAdd?: boolean;
}) {
  const { state, controller } = useCustomer();
  const checkout = useCheckout();
  const [action, setAction] = useState<Action>(
    initialAdd ? { kind: "location", address: null, mode: "choose" } : null,
  );
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selected = controller.selectedAddress();
  const active = state.addresses.filter(
    (address) => address.status === "ACTIVE",
  );
  const blocked = state.readOnly || state.busy || checkout.state.paymentFrozen;

  useEffect(() => {
    if (confirmationId && checkout.state.transitionPhase === "idle") {
      setConfirmationId(null);
      if (state.selectedId === confirmationId) onDone();
    }
  }, [
    confirmationId,
    checkout.state.transitionPhase,
    state.selectedId,
    onDone,
  ]);

  const choose = async (address: Address) => {
    if (blocked || checkingId) return;
    setError("");
    if (!hasDeliveryCoordinates(address)) {
      setAction({ kind: "location", address, mode: "choose" });
      return;
    }
    setCheckingId(address.id);
    const result = await checkout.selectAddress(address.id);
    if (result === "committed") {
      setCheckingId(null);
      onDone();
    } else if (result === "confirmation") {
      setCheckingId(null);
      setConfirmationId(address.id);
    } else if (result === "error") {
      setCheckingId(null);
      setError(
        "We couldn’t check delivery for this address. Your current address is still selected.",
      );
    }
  };

  if (action?.kind === "location")
    return (
      <DeliveryLocationSetup
        address={action.address}
        initialMode={action.mode}
        onDone={onDone}
        onCancel={() => setAction(null)}
      />
    );
  if (action?.kind === "edit")
    return (
      <main className="delivery-setup">
        <button
          type="button"
          className="delivery-flow__back"
          onClick={() => setAction(null)}
        >
          ← Back to addresses
        </button>
        <h1 className="delivery-flow__title">Edit address</h1>
        <AddressForm
          address={action.address}
          onDone={() => setAction(null)}
          onCancel={() => setAction(null)}
          onDeleted={() => setAction(null)}
          onChangeLocation={() =>
            setAction({
              kind: "location",
              address: action.address,
              mode: "confirm",
            })
          }
        />
      </main>
    );

  return (
    <main className="delivery-setup delivery-picker">
      <button type="button" className="delivery-flow__back" onClick={onBack}>
        ← Back to Home
      </button>
      <h1>Delivery address</h1>
      <p className="delivery-picker__intro">
        Choose where we should deliver your order.
      </p>
      <button
        type="button"
        className="delivery-flow__search-entry"
        onClick={() =>
          setAction({ kind: "location", address: null, mode: "search" })
        }
        disabled={blocked}
      >
        <SearchIcon className="h-5 w-5" /> Search building, street or postcode
      </button>
      <button
        type="button"
        className="delivery-flow__current"
        onClick={() =>
          setAction({ kind: "location", address: null, mode: "current" })
        }
        disabled={blocked}
      >
        <PinIcon className="h-5 w-5" /> Use my current location
      </button>
      <section
        className="delivery-picker__saved"
        aria-labelledby="saved-addresses-title"
      >
        <div className="delivery-picker__section-heading">
          <h2 id="saved-addresses-title">Saved addresses</h2>
          <span>{active.length}</span>
        </div>
        {state.listPhase === "loading" && (
          <p role="status">Loading saved addresses…</p>
        )}
        {state.listPhase === "error" && <DataFeedback />}
        {state.listPhase === "ready" && !active.length && (
          <p className="delivery-picker__empty">
            No saved delivery addresses yet.
          </p>
        )}
        {active.map((address) => (
          <article
            key={address.id}
            className={`delivery-picker__card ${selected?.id === address.id ? "delivery-picker__card--selected" : ""}`}
          >
            <button
              type="button"
              className="delivery-picker__select"
              onClick={() => void choose(address)}
              disabled={blocked || Boolean(checkingId)}
              aria-current={selected?.id === address.id ? "true" : undefined}
            >
              <span className="delivery-picker__check" aria-hidden="true">
                {selected?.id === address.id ? "✓" : "⌂"}
              </span>
              <span className="delivery-picker__card-copy">
                <strong>{address.label}</strong>
                <span>
                  {[address.addressLine1, address.addressLine2]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                <small>
                  {[address.postcode, address.city, address.state]
                    .filter(Boolean)
                    .join(", ")}
                </small>
                <span className="delivery-picker__metadata">
                  {address.isDefault && <em>Default</em>}
                  {selected?.id === address.id && (
                    <em>Selected for delivery</em>
                  )}
                  {!hasDeliveryCoordinates(address) && (
                    <em>Set delivery location</em>
                  )}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="delivery-picker__edit"
              onClick={() =>
                setAction(
                  hasDeliveryCoordinates(address)
                    ? { kind: "edit", address }
                    : { kind: "location", address, mode: "choose" },
                )
              }
              disabled={blocked || Boolean(checkingId)}
              aria-label={editAddressName(address, active)}
            >
              Edit <span aria-hidden="true">›</span>
            </button>
          </article>
        ))}
      </section>
      {checkingId && (
        <p role="status" className="delivery-picker__feedback">
          Checking delivery for this address…
        </p>
      )}
      {error && (
        <p role="alert" className="delivery-picker__feedback">
          {error}
        </p>
      )}
      {checkout.state.transitionPhase === "error" && (
        <AddressTransitionError error={checkout.state.transitionError} />
      )}
      <button
        type="button"
        className="delivery-picker__add"
        onClick={() =>
          setAction({ kind: "location", address: null, mode: "choose" })
        }
        disabled={blocked}
      >
        ＋ Add a new address
      </button>
      <button
        type="button"
        className="delivery-picker__manage"
        onClick={onManage}
      >
        Manage all addresses
      </button>
    </main>
  );
}
