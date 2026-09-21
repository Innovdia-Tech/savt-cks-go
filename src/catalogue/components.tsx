import { guardHistoryNavigation } from "./navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/Layout";
import { CustomerProfileScreen, CheckoutAddress } from "../customer/components";
import { useCustomer } from "../customer/context";
import { useCatalogue } from "./context";
import type { Product } from "./contracts";
import type { CatalogueState } from "./state";
import type { Screen } from "../types";
export const money = (minor: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    minor / 100,
  );
export function ProductImage({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className="catalogue-image">
      {url && !failed ? (
        <img
          src={url}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span role="img" aria-label={`Image unavailable for ${name}`}>
          <span aria-hidden="true" className="catalogue-image-symbol">
            ▧
          </span>
          <span>Image unavailable</span>
        </span>
      )}
    </div>
  );
}
export function ProductTile({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: () => void;
}) {
  return (
    <article className="catalogue-tile">
      <button
        className="catalogue-open"
        onClick={onOpen}
        aria-label={`View ${product.name}`}
      >
        <ProductImage url={product.imageUrl} name={product.name} />
        <span className="catalogue-name">{product.name}</span>
        <span className="catalogue-unit">
          {product.packSize || product.uom.name}
        </span>
      </button>
      <strong className="catalogue-price">
        {money(product.sellingPriceMinor)}
      </strong>
      <span className="catalogue-availability">
        {product.availability === "AVAILABLE" ? "Available" : "Unavailable"}
      </span>
      <button
        className="catalogue-add"
        disabled
        aria-label={`Add ${product.name} — ordering unavailable`}
      >
        Add
      </button>
    </article>
  );
}
const errors: Record<string, [string, string]> = {
  CUSTOMER_NO_SERVICEABLE_OUTLET: [
    "No serviceable outlet",
    "We cannot serve this address right now. Try another saved address.",
  ],
  CUSTOMER_ASSIGNMENT_INCOMPLETE: [
    "Assignment could not be completed",
    "The route provider is unavailable. Try again later.",
  ],
  CUSTOMER_ASSIGNMENT_CONTEXT_UNAVAILABLE: [
    "Browsing is temporarily unavailable",
    "We could not validate your browsing session. Try again later.",
  ],
  CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED: [
    "Browsing session expired",
    "Refresh the assignment to continue browsing.",
  ],
  CUSTOMER_ASSIGNED_OUTLET_UNAVAILABLE: [
    "Assigned outlet unavailable",
    "Refresh the assignment to check service for this address.",
  ],
  CUSTOMER_OUTLET_ASSIGNMENT_MISMATCH: [
    "Assignment changed",
    "Refresh the assignment before browsing.",
  ],
  CUSTOMER_ADDRESS_CHANGED: [
    "Address changed",
    "Reload your saved addresses before continuing.",
  ],
  CUSTOMER_ASSIGNMENT_CHANGED: [
    "Service availability changed",
    "Try the automatic assignment again.",
  ],
  CUSTOMER_ADDRESS_NOT_FOUND: [
    "Address unavailable",
    "Choose another active saved address.",
  ],
  CUSTOMER_ADDRESS_INACTIVE: [
    "Address is inactive",
    "Choose an active saved address.",
  ],
  CHECKOUT_LOCATION_UNAVAILABLE: [
    "Address needs coordinates",
    "Add coordinates in your saved address to check service.",
  ],
  CUSTOMER_PRODUCT_NOT_FOUND: [
    "Product unavailable",
    "This product is no longer available to browse. Return to products.",
  ],
  NETWORK_ERROR: [
    "You appear to be offline",
    "Check your connection and try again.",
  ],
  REQUEST_TIMEOUT: [
    "Request timed out",
    "Check your connection and try again.",
  ],
  INVALID_RESPONSE: [
    "Catalogue response unavailable",
    "We could not safely load this response. Try again later.",
  ],
  CUSTOMER_SESSION_INVALID: [
    "Session expired",
    "Return to Savt to reopen CKS Go.",
  ],
  CUSTOMER_CSRF_INVALID: [
    "Session needs refreshing",
    "Return to Savt to reopen CKS Go.",
  ],
};
export function CatalogueStatus({
  phase,
  error,
  onRetry,
  onManage,
}: {
  phase: CatalogueState["phase"];
  error: string | null;
  onRetry: () => void;
  onManage: () => void;
}) {
  const phases: Partial<Record<CatalogueState["phase"], [string, string]>> = {
    "address-loading": [
      "Loading your address",
      "Your saved addresses will appear shortly.",
    ],
    "address-error": [
      "Could not load your address",
      "Reload your saved addresses to continue.",
    ],
    "no-address": [
      "Choose an active address",
      "Add or select a saved address before browsing.",
    ],
    coordinates: [
      "Address needs coordinates",
      "Edit your saved address and add its coordinates.",
    ],
    "assignment-loading": [
      "Finding your assigned outlet",
      "Checking service for this address.",
    ],
    loading: ["Loading catalogue", "Fetching the latest products."],
    "session-expired": errors.CUSTOMER_SESSION_INVALID,
    expired: errors.CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED,
  };
  const [title, description] = phases[phase] ??
    errors[error ?? ""] ?? ["Catalogue unavailable", "Please try again later."];
  const busy = ["address-loading", "assignment-loading", "loading"].includes(
    phase,
  );
  const addressAction =
    ["no-address", "coordinates", "address-error"].includes(phase) ||
    error?.startsWith("CUSTOMER_ADDRESS_");
  return (
    <section className="catalogue-state" role="status" aria-live="polite">
      <h2>{title}</h2>
      <p>{description}</p>
      {!busy && phase !== "session-expired" && (
        <button
          className="customer-button"
          onClick={addressAction ? onManage : onRetry}
        >
          {addressAction ? "Manage addresses" : "Try again"}
        </button>
      )}
    </section>
  );
}
function readRoute() {
  const value = window.location.hash.slice(1);
  return /^(home|categories|profile|cart|orders|detail\/[0-9a-f-]{36})$/.test(
    value,
  )
    ? value
    : "home";
}
export function CatalogueApp({ onLogout }: { onLogout?: () => void }) {
  const { state, controller, controls } = useCatalogue();
  const { guardNavigation } = useCustomer();
  const [route, setRoute] = useState(readRoute);
  const [query, setQuery] = useState(state.q);
  const [composing, setComposing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const change = () =>
      guardHistoryNavigation(
        route,
        readRoute(),
        (next) => window.history.replaceState(null, "", "#" + next),
        guardNavigation,
        setRoute,
      );
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, [route, guardNavigation]);
  useEffect(() => {
    heading.current?.focus();
  }, [route]);
  useEffect(() => {
    if (composing || query === state.q) return;
    const timer = setTimeout(() => void controller.search(query), 300);
    return () => clearTimeout(timer);
  }, [query, composing, state.q, controller]);
  useEffect(() => {
    setQuery(state.q);
  }, [
    state.assignment?.customerAddressId,
    state.assignment?.addressRowVersion,
  ]);
  const detailId = route.startsWith("detail/") ? route.slice(7) : undefined;
  useEffect(() => {
    if (detailId && state.assignment && state.detailId !== detailId)
      void controller.open(detailId);
    else if (!detailId && state.detailId) void controller.closeDetail();
  }, [detailId, state.assignment, state.detailId, controller]);
  const navigate = (next: string) =>
    guardNavigation(() => {
      window.location.hash = next;
      setRoute(next);
    });
  const nav = (screen: Screen) =>
    navigate(
      screen === "listing"
        ? "categories"
        : screen === "tracking"
          ? "orders"
          : screen,
    );
  const browse = route === "home" || route === "categories";
  const p = state.detail?.data;
  return (
    <AppShell
      active={
        route === "categories"
          ? "Categories"
          : route === "cart"
            ? "Cart"
            : route === "orders"
              ? "Orders"
              : "Home"
      }
      cartCount={0}
      onNavigate={nav}
      onLogout={onLogout}
      screenKey={route}
      outlet={state.assignment?.outlet}
    >
      <div className="catalogue-root">
        {controls}
        {route === "profile" ? (
          <>
            <CheckoutAddress catalogue onManage={() => {}} />
            <CustomerProfileScreen />
          </>
        ) : (
          <>
            <div className="catalogue-heading">
              <h1 ref={heading} tabIndex={-1}>
                {route === "home"
                  ? "Browse products"
                  : route === "categories"
                    ? "Categories"
                    : detailId
                      ? "Product details"
                      : route === "cart"
                        ? "Cart"
                        : "Orders"}
              </h1>
              {detailId && (
                <button
                  className="catalogue-link"
                  onClick={() => navigate("home")}
                >
                  Back to products
                </button>
              )}
            </div>
            {state.readOnly && (
              <p className="catalogue-notice" role="status">
                Your account is read-only. Products cannot be ordered.
              </p>
            )}
            {route === "cart" || route === "orders" ? (
              <section className="catalogue-state">
                <h2>
                  {route === "cart"
                    ? "Ordering is not available yet"
                    : "Orders are not connected yet"}
                </h2>
                <p>
                  You can browse the catalogue. Cart, checkout and order
                  tracking are unavailable.
                </p>
                <button
                  className="customer-button"
                  onClick={() => navigate("home")}
                >
                  Browse products
                </button>
              </section>
            ) : (
              <>
                {browse && (
                  <form
                    noValidate
                    className="catalogue-search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!composing) void controller.search(query);
                    }}
                  >
                    <label htmlFor="catalogue-search">Search products</label>
                    <div>
                      <input
                        id="catalogue-search"
                        ref={search}
                        type="search"
                        maxLength={200}
                        value={query}
                        onCompositionStart={() => setComposing(true)}
                        onCompositionEnd={() => setComposing(false)}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search this outlet"
                      />
                      {query && (
                        <button
                          type="button"
                          aria-label="Clear search"
                          onClick={() => {
                            setQuery("");
                            void controller.search("");
                            search.current?.focus();
                          }}
                        >
                          ×
                        </button>
                      )}
                      <button type="submit">Search</button>
                    </div>
                  </form>
                )}
                {browse &&
                  (state.categories.length > 0 || state.categoryPage > 1) && (
                    <section aria-label="Product categories">
                      <div className="catalogue-categories">
                        <button
                          aria-pressed={!state.categoryId}
                          onClick={() => void controller.category()}
                        >
                          All products
                        </button>
                        {state.categories.map((c) => (
                          <button
                            key={c.id}
                            aria-pressed={state.categoryId === c.id}
                            onClick={() => void controller.category(c.id)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                      {(state.categoryPage > 1 || state.categoryHasNext) && (
                        <div className="catalogue-pages">
                          <button
                            disabled={state.categoryPage <= 1}
                            onClick={() =>
                              void controller.categoryPage(
                                state.categoryPage - 1,
                              )
                            }
                          >
                            Previous categories
                          </button>
                          <button
                            disabled={!state.categoryHasNext}
                            onClick={() =>
                              void controller.categoryPage(
                                state.categoryPage + 1,
                              )
                            }
                          >
                            More categories
                          </button>
                        </div>
                      )}
                    </section>
                  )}
                {state.phase !== "ready" ? (
                  <CatalogueStatus
                    phase={state.phase}
                    error={state.error}
                    onRetry={() => void controller.retry()}
                    onManage={() => navigate("profile")}
                  />
                ) : detailId ? (
                  p && (
                    <article className="catalogue-detail">
                      <ProductImage url={p.imageUrl} name={p.name} />
                      <h2>{p.name}</h2>
                      <p>{p.packSize || p.uom.name}</p>
                      <strong>{money(p.sellingPriceMinor)}</strong>
                      <p>
                        {p.availability === "AVAILABLE"
                          ? "Available"
                          : "Unavailable"}
                      </p>
                      <p>{p.description || "No description provided."}</p>
                      <dl>
                        <dt>Category</dt>
                        <dd>{p.category.name}</dd>
                        {p.subcategory && (
                          <>
                            <dt>Subcategory</dt>
                            <dd>{p.subcategory.name}</dd>
                          </>
                        )}
                        {p.brand && (
                          <>
                            <dt>Brand</dt>
                            <dd>{p.brand.name}</dd>
                          </>
                        )}
                        <dt>Unit</dt>
                        <dd>{p.uom.name}</dd>
                        <dt>Storage</dt>
                        <dd>{p.storageType.toLowerCase()}</dd>
                      </dl>
                      <button className="catalogue-add" disabled>
                        Add to cart
                      </button>
                      <p>Ordering is not available yet.</p>
                    </article>
                  )
                ) : (
                  <>
                    {state.categories.length === 0 && (
                      <p className="catalogue-notice">
                        No categories are available for this outlet.
                      </p>
                    )}
                    <p className="catalogue-caption">
                      Ordering is not available yet. Prices are shown in MYR.
                    </p>
                    {state.products?.data.length ? (
                      <div className="catalogue-grid">
                        {state.products.data.map((product) => (
                          <ProductTile
                            key={product.outletProductId}
                            product={product}
                            onOpen={() =>
                              navigate("detail/" + product.outletProductId)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <section className="catalogue-state" role="status">
                        <h2>
                          {state.q
                            ? "No search results"
                            : "No products in this selection"}
                        </h2>
                        <p>
                          {state.q
                            ? "Try another product name or clear your search."
                            : "Choose another category or try again later."}
                        </p>
                      </section>
                    )}
                    {state.products && (
                      <div className="catalogue-pages">
                        <button
                          disabled={state.page <= 1}
                          onClick={() =>
                            void controller.nextPage(state.page - 1)
                          }
                        >
                          Previous
                        </button>
                        <span role="status">
                          Page {state.page} · {state.products.meta.total}{" "}
                          products
                        </span>
                        <button
                          disabled={!state.products.meta.hasNextPage}
                          onClick={() =>
                            void controller.nextPage(state.page + 1)
                          }
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
