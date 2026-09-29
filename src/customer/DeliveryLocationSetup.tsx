import { useEffect, useRef, useState } from "react";
import type { Address } from "../addresses/contracts";
import { AddressForm } from "../addresses/AddressForm";
import { AddressTransitionError } from "../checkout/components";
import { useCheckout } from "../checkout/context";
import { PinIcon, SearchIcon } from "../components/Icons";
import { StoreLoading } from "../components/session/SessionStatus";
import type { PlaceSuggestion } from "../location/api";
import { BrowserDeliveryLocationPort } from "../location/bridge";
import {
  DeliveryLocationError,
  type DeliveryLocation,
} from "../location/contracts";
import { DataFeedback } from "./components";
import { useCustomer } from "./context";
import { hasDeliveryCoordinates } from "./delivery-readiness";

type Stage = "choose" | "search" | "confirm" | "details" | "denied";
type SearchPhase =
  "initial" | "typing" | "loading" | "results" | "empty" | "error";
const locationCopy = (location: DeliveryLocation) =>
  location.formattedAddress ||
  [location.addressLine1, location.postcode, location.city, location.state]
    .filter(Boolean)
    .join(", ") ||
  "Current location";

export function DeliveryLocationSetup({
  onDone,
  address,
  onCancel,
  initialMode = "choose",
}: {
  onDone: () => void;
  address?: Address | null;
  onCancel?: () => void;
  initialMode?: "choose" | "search" | "current";
}) {
  const {
    state,
    controller,
    guardNavigation,
    locationSearch,
    currentLocation: currentLocationPort,
  } = useCustomer();
  const checkout = useCheckout();
  const originalIds = useRef(new Set(state.addresses.map((item) => item.id)));
  const originalIdsReady = useRef(state.listPhase === "ready");
  const selected =
    address === undefined ? controller.selectedAddress() : address;
  const repairing = Boolean(selected && !hasDeliveryCoordinates(selected));
  const [port] = useState(
    () => currentLocationPort ?? new BrowserDeliveryLocationPort(),
  );
  const [stage, setStage] = useState<Stage>(
    initialMode === "search" ? "search" : "choose",
  );
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("initial");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [locationTitle, setLocationTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [awaitingAssignmentId, setAwaitingAssignmentId] = useState<
    string | null
  >(null);
  const [gpsError, setGpsError] = useState("");
  const token = useRef<string | null>(
    initialMode === "search" ? crypto.randomUUID() : null,
  );
  const searchAbort = useRef<AbortController | null>(null);
  const resolveAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const currentStarted = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      searchAbort.current?.abort();
      resolveAbort.current?.abort();
      port.dispose?.();
    },
    [port],
  );
  useEffect(() => {
    if (!originalIdsReady.current && state.listPhase === "ready") {
      originalIds.current = new Set(state.addresses.map((item) => item.id));
      originalIdsReady.current = true;
    }
  }, [state.addresses, state.listPhase]);
  useEffect(() => {
    if (stage === "search") input.current?.focus();
  }, [stage]);

  const openSearch = () => {
    token.current = crypto.randomUUID();
    setQuery("");
    setSuggestions([]);
    setSearchPhase("initial");
    setGpsError("");
    setStage("search");
  };
  const closeSearch = () => {
    ++generation.current;
    searchAbort.current?.abort();
    resolveAbort.current?.abort();
    token.current = null;
    setQuery("");
    setSuggestions([]);
    setStage("choose");
  };
  const changeQuery = (value: string) => {
    ++generation.current;
    searchAbort.current?.abort();
    setSuggestions([]);
    setSearchPhase(
      !value.trim()
        ? "initial"
        : [...value.trim()].length < 3
          ? "typing"
          : "loading",
    );
    setQuery(value);
  };

  useEffect(() => {
    if (stage !== "search" || composing) return;
    const requestGeneration = ++generation.current;
    searchAbort.current?.abort();
    setSuggestions([]);
    const value = query.trim();
    if (!value) {
      setSearchPhase("initial");
      return;
    }
    if ([...value].length < 3) {
      setSearchPhase("typing");
      return;
    }
    if (!locationSearch || !token.current) {
      setSearchPhase("error");
      return;
    }
    setSearchPhase("loading");
    const abort = new AbortController();
    searchAbort.current = abort;
    const timer = setTimeout(() => {
      const known = controller.selectedAddress();
      const bias =
        known && hasDeliveryCoordinates(known)
          ? { latitude: known.latitude!, longitude: known.longitude! }
          : undefined;
      void locationSearch
        .search(value, token.current!, abort.signal, bias)
        .then((results) => {
          if (generation.current !== requestGeneration || abort.signal.aborted)
            return;
          setSuggestions(results);
          setSearchPhase(results.length ? "results" : "empty");
        })
        .catch(() => {
          if (generation.current !== requestGeneration || abort.signal.aborted)
            return;
          setSearchPhase("error");
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, stage, composing, locationSearch, controller]);

  const currentLocation = async () => {
    if (busy || state.readOnly) return;
    ++generation.current;
    searchAbort.current?.abort();
    token.current = null;
    setBusy(true);
    setGpsError("");
    try {
      const found = await port.requestCurrentLocation();
      setLocation(found);
      setLocationTitle("Your current location");
      setStage("confirm");
    } catch (error) {
      if (error instanceof DeliveryLocationError && error.kind === "denied") {
        setStage("denied");
      } else {
        setGpsError(
          "We couldn’t get your current location. Search for your address or try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (initialMode === "current" && !currentStarted.current) {
      currentStarted.current = true;
      void currentLocation();
    }
    // The initial current-location request exists only after an explicit picker tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    if (!locationSearch || !token.current || busy) return;
    ++generation.current;
    searchAbort.current?.abort();
    const abort = new AbortController();
    resolveAbort.current = abort;
    setBusy(true);
    try {
      const resolved = await locationSearch.resolve(
        suggestion.placeId,
        token.current,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      setLocation(resolved);
      setLocationTitle(suggestion.primaryText);
      token.current = null;
      setStage("confirm");
    } catch {
      if (!abort.signal.aborted) setSearchPhase("error");
    } finally {
      setBusy(false);
    }
  };

  const finishSave = async () => {
    const snapshot = controller.getSnapshot();
    const savedId =
      selected?.id ??
      snapshot.addresses.find((item) => !originalIds.current.has(item.id))?.id;
    if (!savedId || snapshot.listPhase !== "ready") {
      setSaveError(
        "Address saved. Reload your addresses before selecting it for delivery.",
      );
      return;
    }
    setBusy(true);
    setSaveError("");
    const result = await checkout.selectAddress(savedId);
    setBusy(false);
    if (result === "committed") onDone();
    else if (result === "confirmation") setAwaitingAssignmentId(savedId);
    else if (result === "error")
      setSaveError(
        "We couldn’t check delivery for this address. Please try again.",
      );
  };

  useEffect(() => {
    if (!awaitingAssignmentId || checkout.state.transitionPhase !== "idle")
      return;
    setAwaitingAssignmentId(null);
    if (state.selectedId === awaitingAssignmentId) onDone();
  }, [
    awaitingAssignmentId,
    checkout.state.transitionPhase,
    state.selectedId,
    onDone,
  ]);

  if (state.profilePhase === "loading" || state.listPhase === "loading")
    return <StoreLoading />;
  if (state.profilePhase === "error" || state.listPhase === "error")
    return (
      <main className="delivery-setup">
        <h1>Your delivery details could not be loaded</h1>
        <DataFeedback />
      </main>
    );

  const back = () => {
    if (stage === "search") closeSearch();
    else if (stage === "confirm")
      locationTitle === "Your current location"
        ? setStage("choose")
        : openSearch();
    else if (stage === "details") guardNavigation(() => setStage("confirm"));
    else if (onCancel) guardNavigation(onCancel);
  };
  return (
    <main className="delivery-setup delivery-flow">
      <button
        type="button"
        className="delivery-flow__back"
        onClick={back}
        aria-label="Go back"
        disabled={!onCancel && stage === "choose"}
      >
        ← <span>Back</span>
      </button>
      {stage === "choose" && (
        <>
          <div className="delivery-setup__heading">
            <span className="delivery-setup__eyebrow">CKS Go delivery</span>
            <h1>Set delivery location</h1>
            <p>
              {repairing
                ? "Confirm the location for this saved address so we can check delivery."
                : "Choose where you want your order delivered."}
            </p>
          </div>
          {repairing && selected && (
            <section className="delivery-setup__existing">
              <strong>{selected.label}</strong>
              <span>
                {[selected.addressLine1, selected.city, selected.state]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </section>
          )}
          <button
            type="button"
            className="delivery-flow__search-entry"
            onClick={openSearch}
          >
            <SearchIcon className="h-5 w-5" /> Search building, street or
            postcode
          </button>
          <button
            type="button"
            className="delivery-flow__current"
            disabled={busy || state.readOnly}
            onClick={() => void currentLocation()}
          >
            <PinIcon className="h-5 w-5" />
            {busy ? "Finding your location…" : "Use my current location"}
          </button>
          {gpsError && (
            <p role="alert" className="delivery-setup__message">
              {gpsError}
            </p>
          )}
        </>
      )}
      {stage === "search" && (
        <>
          <h1 className="delivery-flow__title">Search location</h1>
          <label htmlFor="location-query" className="sr-only">
            Search building, street or postcode
          </label>
          <div className="delivery-flow__query">
            <SearchIcon className="h-5 w-5" />
            <input
              id="location-query"
              ref={input}
              value={query}
              maxLength={200}
              placeholder="Building, street or postcode"
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onChange={(event) => changeQuery(event.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  changeQuery("");
                  input.current?.focus();
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            className="delivery-flow__current"
            onClick={() => void currentLocation()}
            disabled={busy || state.readOnly}
          >
            <PinIcon className="h-5 w-5" />
            Use my current location
          </button>
          {gpsError && (
            <p role="alert" className="delivery-setup__message">
              {gpsError}
            </p>
          )}
          {searchPhase === "typing" && (
            <p className="delivery-flow__hint">
              Keep typing to search locations.
            </p>
          )}
          {searchPhase === "loading" && (
            <p role="status" className="delivery-flow__hint">
              Finding locations…
            </p>
          )}
          {searchPhase === "empty" && (
            <p role="status" className="delivery-flow__hint">
              We couldn't find that location. Try a building name, street or
              postcode.
            </p>
          )}
          {searchPhase === "error" && (
            <p role="alert" className="delivery-flow__hint">
              Address search is temporarily unavailable.
            </p>
          )}
          {searchPhase === "results" && (
            <section
              className="delivery-flow__results"
              aria-label="Location suggestions"
            >
              <div className="delivery-flow__rows">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.placeId}
                    disabled={busy}
                    onClick={() => void selectSuggestion(suggestion)}
                  >
                    <PinIcon className="h-5 w-5" />
                    <span>
                      <strong>{suggestion.primaryText}</strong>
                      <small>{suggestion.secondaryText}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="delivery-flow__attribution" translate="no">
                Google Maps
              </p>
            </section>
          )}
        </>
      )}
      {stage === "denied" && (
        <section className="delivery-flow__denied">
          <span className="delivery-flow__pin">
            <PinIcon className="h-6 w-6" />
          </span>
          <h1>Location access is off</h1>
          <p>
            You can still set your delivery location by searching for your
            address.
          </p>
          <button
            type="button"
            className="delivery-setup__primary"
            onClick={openSearch}
          >
            Search address
          </button>
          <button
            type="button"
            className="delivery-setup__secondary"
            onClick={() => void currentLocation()}
            disabled={busy}
          >
            Try current location again
          </button>
        </section>
      )}
      {stage === "confirm" && location && (
        <section className="delivery-flow__confirm">
          <span className="delivery-setup__eyebrow">Delivery location</span>
          <h1>Confirm delivery location</h1>
          <div className="delivery-flow__location">
            <span className="delivery-flow__pin">
              <PinIcon className="h-6 w-6" />
            </span>
            <strong>{locationTitle}</strong>
            <p>{locationCopy(location)}</p>
          </div>
          <p>Make sure this is where you want your order delivered.</p>
          <button
            type="button"
            className="delivery-setup__secondary"
            onClick={() => setStage("choose")}
          >
            Change location
          </button>
          <button
            type="button"
            className="delivery-setup__primary"
            onClick={() => setStage("details")}
          >
            Confirm this location
          </button>
        </section>
      )}
      {stage === "details" && location && (
        <>
          <div className="delivery-setup__heading">
            <span className="delivery-setup__eyebrow">CKS Go delivery</span>
            <h1>Delivery details</h1>
            <p>{locationCopy(location)}</p>
            <button
              type="button"
              className="delivery-setup__text-action"
              onClick={() => guardNavigation(() => setStage("confirm"))}
            >
              Change location
            </button>
          </div>
          <DataFeedback onRetried={() => void finishSave()} />
          <AddressForm
            address={selected ?? undefined}
            location={location}
            onDone={() => void finishSave()}
            onCancel={() => setStage("confirm")}
          />
          {busy && <p role="status">Checking delivery for this address…</p>}
          {saveError && (
            <p role="alert" className="delivery-setup__message">
              {saveError}
            </p>
          )}
          {checkout.state.transitionPhase === "error" && (
            <AddressTransitionError error={checkout.state.transitionError} />
          )}
        </>
      )}
    </main>
  );
}
