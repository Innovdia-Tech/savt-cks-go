import { guardHistoryNavigation } from "./navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../components/Layout";
import { CustomerProfileScreen, CheckoutAddress } from "../customer/components";
import { useCustomer } from "../customer/context";
import { useCatalogue } from "./context";
import type { Product } from "./contracts";
import type { CatalogueState } from "./state";
import type { Screen } from "../types";
import { useCheckout } from "../checkout/context";
import { AddressTransitionError, CartScreen } from "../checkout/components";
import { usePayment } from "../payment/context";
import { useOrders } from "../orders/context";
import { OrderDetailScreen, OrdersScreen } from "../orders/components";
import {
  Button,
  SearchField,
  StatusBadge,
  SystemState,
} from "../components/ui";
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
  onAdd,
  orderingDisabled = false,
  variant = "grid",
}: {
  product: Product;
  onOpen: () => void;
  onAdd?: () => void;
  orderingDisabled?: boolean;
  variant?: "grid" | "list";
}) {
  const canAdd =
    product.availability === "AVAILABLE" && !orderingDisabled && !!onAdd;
  return (
    <article className={`catalogue-tile catalogue-tile--${variant}`}>
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
      <div className="catalogue-price-row">
        <strong className="catalogue-price">
          {money(product.sellingPriceMinor)}
        </strong>
        <StatusBadge status={product.availability} />
      </div>
      <Button
        className="catalogue-add"
        disabled={!canAdd}
        onClick={onAdd}
        aria-label={
          canAdd
            ? `Add ${product.name} to cart`
            : `Add ${product.name} — unavailable`
        }
      >
        {variant === "list" ? (
          <>
            <span aria-hidden="true">+</span>
            <span className="sr-only">Add to cart</span>
          </>
        ) : (
          "Add to cart"
        )}
      </Button>
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
    <SystemState
      tone={busy ? "loading" : "error"}
      title={title}
      description={description}
      busy={busy}
      actionLabel={
        !busy && phase !== "session-expired"
          ? addressAction
            ? "Manage addresses"
            : "Try again"
          : undefined
      }
      onAction={
        !busy && phase !== "session-expired"
          ? addressAction
            ? onManage
            : onRetry
          : undefined
      }
    />
  );
}
function readRoute() {
  const value = window.location.hash.slice(1);
  return /^(home|categories|profile|cart|orders|detail\/[0-9a-f-]{36}|order\/[0-9a-f-]{36})$/.test(
    value,
  )
    ? value
    : "home";
}

export function routeTitle(route: string) {
  const page = route.startsWith("detail/")
    ? "Product details"
    : route.startsWith("order/")
      ? "Order details"
      : route === "categories"
        ? "Categories"
        : route === "cart"
          ? "Cart"
          : route === "orders"
            ? "Orders"
            : route === "profile"
              ? "Profile and addresses"
              : "Browse products";
  return `${page} | CKS Go`;
}

export function CatalogueApp({ onLogout }: { onLogout?: () => void }) {
  const { state, controller, controls } = useCatalogue();
  const checkout = useCheckout();
  const payment = usePayment();
  const orders = useOrders();
  const { guardNavigation } = useCustomer();
  const [route, setRoute] = useState(readRoute);
  const [query, setQuery] = useState(state.q);
  const [composing, setComposing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    document.title = routeTitle(route);
  }, [route]);
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
  useEffect(() => {
    if (route !== "home" || (!state.q && !state.categoryId)) return;
    setQuery("");
    void controller.resetFilters();
  }, [route, state.q, state.categoryId, controller]);
  const detailId = route.startsWith("detail/") ? route.slice(7) : undefined;
  const orderDetailId = route.startsWith("order/") ? route.slice(6) : undefined;
  useEffect(() => {
    if (detailId && state.assignment && state.detailId !== detailId)
      void controller.open(detailId);
    else if (!detailId && state.detailId) void controller.closeDetail();
  }, [detailId, state.assignment, state.detailId, controller]);
  useEffect(() => {
    if (orderDetailId) void orders.controller.open(orderDetailId);
    else orders.controller.closeDetail();
  }, [orderDetailId, orders.controller]);
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
            : route === "orders" || orderDetailId
              ? "Orders"
              : "Home"
      }
      cartCount={checkout.state.lines.reduce(
        (sum, line) => sum + line.quantity,
        0,
      )}
      onNavigate={nav}
      onLogout={onLogout}
      screenKey={route}
      outlet={state.assignment?.outlet}
    >
      <div className="catalogue-root">
        {route === "profile" ? (
          <>
            <CheckoutAddress
              catalogue
              onManage={() => {}}
              selecting={
                checkout.state.transitionPhase === "checking" ||
                checkout.state.paymentFrozen
              }
              onSelect={(addressId) => void checkout.selectAddress(addressId)}
            />
            {checkout.state.transitionPhase === "error" && (
              <AddressTransitionError error={checkout.state.transitionError} />
            )}
            <CustomerProfileScreen />
          </>
        ) : (
          <>
            <div
              className={`catalogue-heading ${route === "home" ? "catalogue-heading--hidden" : ""}`}
            >
              <h1
                ref={heading}
                tabIndex={-1}
                className={route === "home" ? "sr-only" : undefined}
              >
                {route === "home"
                  ? "CKS Go home"
                  : route === "categories"
                    ? "Categories"
                    : detailId
                      ? "Product details"
                      : route === "cart"
                        ? "Cart"
                        : orderDetailId
                          ? "Order details"
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
              {orderDetailId && (
                <button
                  className="catalogue-link"
                  onClick={() => navigate("orders")}
                >
                  Back to orders
                </button>
              )}
            </div>
            {state.readOnly && (
              <p className="catalogue-notice" role="status">
                Your account is read-only. Products cannot be ordered.
              </p>
            )}
            {route === "home" && state.phase === "ready" && (
              <section className="catalogue-trust-banner">
                <strong>Shop with trusted totals</strong>
                <span>Prices and stock are confirmed before payment.</span>
              </section>
            )}
            {route === "cart" ? (
              <CartScreen
                state={checkout.state}
                controller={checkout.controller}
                payment={{
                  ...payment,
                  onViewOrder: (orderId) => navigate(`order/${orderId}`),
                }}
                onBrowse={() => navigate("home")}
              />
            ) : route === "orders" ? (
              <OrdersScreen
                state={orders.state}
                controller={orders.controller}
                onOpen={(orderId) => navigate(`order/${orderId}`)}
                onBrowse={() => navigate("home")}
              />
            ) : orderDetailId ? (
              <OrderDetailScreen
                state={orders.state}
                controller={orders.controller}
                onBack={() => navigate("orders")}
              />
            ) : (
              <>
                {route === "categories" && (
                  <SearchField
                    className="catalogue-search"
                    id="catalogue-search"
                    ref={search}
                    label="Search products"
                    maxLength={200}
                    value={query}
                    placeholder="Search this outlet"
                    onCompositionStart={() => setComposing(true)}
                    onCompositionEnd={() => setComposing(false)}
                    onChange={(e) => setQuery(e.target.value)}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!composing) void controller.search(query);
                    }}
                    onClear={() => {
                      setQuery("");
                      void controller.search("");
                      search.current?.focus();
                    }}
                  />
                )}
                {route === "home" && state.categories.length > 0 && (
                  <section
                    className="catalogue-home-categories"
                    aria-labelledby="home-categories-title"
                  >
                    <div className="catalogue-section-heading">
                      <h2 id="home-categories-title">Categories</h2>
                      <button
                        type="button"
                        className="catalogue-link"
                        onClick={() => navigate("categories")}
                      >
                        View all
                      </button>
                    </div>
                    <div className="catalogue-category-tiles">
                      <button
                        type="button"
                        onClick={() => {
                          void controller.category();
                          navigate("categories");
                        }}
                      >
                        <span aria-hidden="true">⌂</span>
                        <span>All</span>
                      </button>
                      {state.categories.slice(0, 4).map((category) => (
                        <button
                          type="button"
                          key={category.id}
                          onClick={() => {
                            void controller.category(category.id);
                            navigate("categories");
                          }}
                        >
                          <span aria-hidden="true">◇</span>
                          <span>{category.name}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {route === "categories" &&
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
                      <Button
                        className="catalogue-add"
                        disabled={
                          state.readOnly ||
                          checkout.state.paymentFrozen ||
                          p.availability !== "AVAILABLE" ||
                          !state.assignment ||
                          checkout.state.assignment?.outletId !==
                            state.assignment.outlet.id
                        }
                        onClick={() => {
                          if (!state.assignment) return;
                          checkout.controller.add(p, state.assignment);
                          navigate("cart");
                        }}
                      >
                        Add to cart
                      </Button>
                      <p>
                        Prices and stock are confirmed when you request a
                        trusted quote.
                      </p>
                    </article>
                  )
                ) : (
                  <>
                    {state.categories.length === 0 && (
                      <p className="catalogue-notice">
                        No categories are available for this outlet.
                      </p>
                    )}
                    <div className="catalogue-section-heading catalogue-products-heading">
                      <div>
                        <h2>
                          {route === "home"
                            ? "Products from this outlet"
                            : "Browse products"}
                        </h2>
                        <p className="catalogue-caption">
                          Displayed prices are confirmed by a trusted quote.
                        </p>
                      </div>
                      {route === "home" && (
                        <button
                          type="button"
                          className="catalogue-link"
                          onClick={() => navigate("categories")}
                        >
                          View all
                        </button>
                      )}
                    </div>
                    {state.products?.data.length ? (
                      <div
                        className={
                          route === "home" ? "catalogue-list" : "catalogue-grid"
                        }
                      >
                        {(route === "home"
                          ? state.products.data.slice(0, 6)
                          : state.products.data
                        ).map((product) => (
                          <ProductTile
                            key={product.outletProductId}
                            product={product}
                            variant={route === "home" ? "list" : "grid"}
                            onOpen={() =>
                              navigate("detail/" + product.outletProductId)
                            }
                            orderingDisabled={
                              state.readOnly ||
                              checkout.state.paymentFrozen ||
                              !state.assignment ||
                              checkout.state.assignment?.outletId !==
                                state.assignment.outlet.id
                            }
                            onAdd={() => {
                              if (state.assignment)
                                checkout.controller.add(
                                  product,
                                  state.assignment,
                                );
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <SystemState
                        tone="empty"
                        title={
                          state.q
                            ? "No search results"
                            : "No products in this selection"
                        }
                        description={
                          state.q
                            ? "Try another product name or clear your search."
                            : "Choose another category or try again later."
                        }
                      />
                    )}
                    {state.products && route === "categories" && (
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
                {controls && (
                  <div className="catalogue-dev-tools">{controls}</div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
