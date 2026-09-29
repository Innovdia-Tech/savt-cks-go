import { useEffect, useRef, useState } from "react";
import type { Address } from "../addresses/contracts";
import { DataFeedback } from "./components";
import { useCheckout } from "../checkout/context";
import { StoreLoading } from "../components/session/SessionStatus";
import { AddressForm } from "../addresses/AddressForm";
import { PinIcon, SearchIcon } from "../components/Icons";
import {
  DeliveryLocationError,
  type DeliveryLocation,
} from "../location/contracts";
import { BrowserDeliveryLocationPort } from "../location/bridge";
import { useCustomer } from "./context";
import { hasDeliveryCoordinates } from "./delivery-readiness";

const locationCopy = (location: DeliveryLocation) =>
  location.formattedAddress ||
  [location.addressLine1, location.postcode, location.city, location.state]
    .filter(Boolean)
    .join(", ") ||
  "Location found";

export function DeliveryLocationSetup({
  onDone,
  address,
  onCancel,
}: {
  onDone: () => void;
  address?: Address | null;
  onCancel?: () => void;
}) {
  const { state, controller, guardNavigation } = useCustomer();
  const checkout = useCheckout();
  const originalIds = useRef(new Set(state.addresses.map((item) => item.id)));
  const selected =
    address === undefined ? controller.selectedAddress() : address;
  const done = async () => {
    const savedId =
      selected?.id ??
      controller
        .getSnapshot()
        .addresses.find((item) => !originalIds.current.has(item.id))?.id;
    if (!selected && savedId && savedId !== controller.selectedAddress()?.id)
      await checkout.selectAddress(savedId);
    onDone();
  };
  const repairing = Boolean(selected && !hasDeliveryCoordinates(selected));
  const [port] = useState(() => new BrowserDeliveryLocationPort());
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [query, setQuery] = useState(() =>
    selected
      ? [
          selected.addressLine1,
          selected.city,
          selected.state,
          selected.postcode,
        ]
          .filter(Boolean)
          .join(", ")
      : "",
  );
  useEffect(() => {
    if (selected)
      setQuery(
        [
          selected.addressLine1,
          selected.city,
          selected.state,
          selected.postcode,
        ]
          .filter(Boolean)
          .join(", "),
      );
  }, [selected?.id]);
  const pending = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  const locationFeedback = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DeliveryLocationError | null>(null);
  const [details, setDetails] = useState(false);

  useEffect(() => () => port.dispose(), [port]);

  const resolve = async (operation: () => Promise<DeliveryLocation>) => {
    if (pending.current || state.readOnly) return;
    pending.current = true;
    setBusy(true);
    setLocation(null);
    setError(null);
    try {
      setLocation(await operation());
    } catch (value) {
      setError(
        value instanceof DeliveryLocationError
          ? value
          : new DeliveryLocationError("unavailable"),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (error?.kind === "denied") search.current?.focus();
    else if (error) locationFeedback.current?.focus();
    else if (state.error) feedback.current?.focus();
  }, [error, state.error]);

  const dataFeedback = (
    <div ref={feedback} tabIndex={-1}>
      <DataFeedback
        onReload={() =>
          guardNavigation(() => {
            setDetails(false);
            void controller.load();
          })
        }
        onRetried={() => void done()}
      />
    </div>
  );
  if (
    !details &&
    (state.profilePhase === "loading" || state.listPhase === "loading")
  )
    return <StoreLoading />;
  if (
    state.profilePhase === "error" ||
    (!details && state.listPhase === "error")
  )
    return (
      <main className="delivery-setup">
        <h1>Your delivery details could not be loaded</h1>
        {dataFeedback}
      </main>
    );

  if (details && location) {
    return (
      <main className="delivery-setup">
        {dataFeedback}
        <div className="delivery-setup__heading">
          <span className="delivery-setup__eyebrow">CKS Go delivery</span>
          <h1>Delivery details</h1>
          <p>{locationCopy(location)}</p>
          <button
            type="button"
            className="delivery-setup__text-action"
            onClick={() => guardNavigation(() => setDetails(false))}
          >
            Change location
          </button>
        </div>
        <AddressForm
          address={selected ?? undefined}
          location={location}
          onDone={() => void done()}
          onCancel={() => setDetails(false)}
        />
      </main>
    );
  }

  const errorMessage =
    error?.kind === "denied"
      ? "Location access is off. You can still search for your address."
      : error?.kind === "not-found"
        ? "We couldn’t find that address. Try a more specific building, street or postcode."
        : error
          ? "We couldn’t get that location. Try again or search for your address."
          : "";

  return (
    <main className="delivery-setup">
      {dataFeedback}
      {onCancel && (
        <button
          type="button"
          className="customer-button"
          onClick={() => guardNavigation(onCancel)}
        >
          Cancel
        </button>
      )}
      {state.readOnly && (
        <p role="status">Your account is read-only. Return to Savt for help.</p>
      )}
      <div className="delivery-setup__heading">
        <span className="delivery-setup__eyebrow">CKS Go delivery</span>
        <h1>Set your delivery location</h1>
        <p>
          {repairing
            ? "We have your address. Confirm the exact delivery location so we can assign your store."
            : "Choose where you want your CKS Go order delivered before you start shopping."}
        </p>
      </div>

      {repairing && selected && (
        <section className="delivery-setup__existing">
          <strong>{selected.label}</strong>
          <span>
            {[
              selected.addressLine1,
              selected.addressLine2,
              selected.postcode,
              selected.city,
              selected.state,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        </section>
      )}

      <section
        className="delivery-setup__actions"
        aria-label="Choose delivery location"
      >
        <button
          type="button"
          className="delivery-setup__primary"
          disabled={busy || state.readOnly}
          onClick={() => void resolve(() => port.requestCurrentLocation())}
        >
          <PinIcon className="h-5 w-5" />
          {busy ? "Finding your location…" : "Use my current location"}
        </button>

        <div className="delivery-setup__or" aria-hidden="true">
          <span />
          <small>or</small>
          <span />
        </div>

        <label className="delivery-setup__search">
          <span>Search address or building</span>
          <div>
            <SearchIcon className="h-5 w-5" />
            <input
              ref={search}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing &&
                  query.trim()
                ) {
                  event.preventDefault();
                  void resolve(() => port.searchLocation(query));
                }
              }}
              value={query}
              maxLength={300}
              placeholder="e.g. Kobusak Perdana, Penampang"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </label>
        <button
          type="button"
          className="delivery-setup__secondary"
          disabled={busy || state.readOnly || !query.trim()}
          onClick={() => void resolve(() => port.searchLocation(query))}
        >
          Search for this address
        </button>
      </section>

      {errorMessage && (
        <section
          ref={locationFeedback}
          className="delivery-setup__message"
          role="alert"
          tabIndex={-1}
        >
          <strong>
            {error?.kind === "denied"
              ? "Location access is off"
              : "Location unavailable"}
          </strong>
          <p>{errorMessage}</p>
        </section>
      )}

      {location && (
        <section className="delivery-setup__found" aria-live="polite">
          <div className="delivery-setup__pin" aria-hidden="true">
            <PinIcon className="h-6 w-6" />
          </div>
          <div>
            <span>Detected location</span>
            <strong>{locationCopy(location)}</strong>
          </div>
          <button
            type="button"
            className="delivery-setup__primary"
            disabled={busy || state.readOnly}
            onClick={() => setDetails(true)}
          >
            Confirm location
          </button>
        </section>
      )}

      <p className="delivery-setup__privacy">
        CKS Go uses the location you confirm only to save your delivery address
        and check service from the assigned outlet.
      </p>
    </main>
  );
}
