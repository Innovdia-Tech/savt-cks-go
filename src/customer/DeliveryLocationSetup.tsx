import { useState } from "react";
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

export function DeliveryLocationSetup({ onDone }: { onDone: () => void }) {
  const { state, controller } = useCustomer();
  const selected = controller.selectedAddress();
  const repairing = Boolean(selected && !hasDeliveryCoordinates(selected));
  const [port] = useState(() => new BrowserDeliveryLocationPort());
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DeliveryLocationError | null>(null);
  const [details, setDetails] = useState(false);

  const resolve = async (operation: () => Promise<DeliveryLocation>) => {
    if (busy) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  if (
    state.profilePhase !== "ready" ||
    state.listPhase === "loading"
  ) {
    return (
      <main className="delivery-setup delivery-setup--center" aria-busy="true">
        <div className="delivery-setup__spinner" aria-hidden="true" />
        <h1>Getting your delivery details ready…</h1>
      </main>
    );
  }

  if (details && location) {
    return (
      <main className="delivery-setup">
        <div className="delivery-setup__heading">
          <span className="delivery-setup__eyebrow">CKS Go delivery</span>
          <h1>Delivery details</h1>
          <p>{locationCopy(location)}</p>
          <button
            type="button"
            className="delivery-setup__text-action"
            onClick={() => setDetails(false)}
          >
            Change location
          </button>
        </div>
        <AddressForm
          address={repairing ? selected : undefined}
          location={location}
          onDone={onDone}
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
            {[selected.addressLine1, selected.addressLine2, selected.postcode, selected.city, selected.state]
              .filter(Boolean)
              .join(", ")}
          </span>
        </section>
      )}

      <section className="delivery-setup__actions" aria-label="Choose delivery location">
        <button
          type="button"
          className="delivery-setup__primary"
          disabled={busy}
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
          disabled={busy || !query.trim()}
          onClick={() => void resolve(() => port.searchLocation(query))}
        >
          Search for this address
        </button>
      </section>

      {errorMessage && (
        <section className="delivery-setup__message" role="status">
          <strong>
            {error?.kind === "denied" ? "Location access is off" : "Location unavailable"}
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
            onClick={() => setDetails(true)}
          >
            Confirm location
          </button>
        </section>
      )}

      <p className="delivery-setup__privacy">
        CKS Go uses the location you confirm only to save your delivery address and check service from the assigned outlet.
      </p>
    </main>
  );
}
