import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BottomNavigation,
  HeaderActions,
  BasketSummaryBar,
  RefreshButton,
} from "./Layout";

it("offers a named keyboard/click refresh alternative and disables it while refreshing", () => {
  const render = (refreshing: boolean) =>
    renderToStaticMarkup(
      createElement(RefreshButton, {
        onRefresh: () => {},
        refreshing,
      }),
    );
  expect(render(false)).toContain('aria-label="Refresh Home"');
  expect(render(false)).toContain('type="button"');
  expect(render(false)).not.toContain("disabled");
  expect(render(true)).toContain('aria-label="Refreshing Home"');
  expect(render(true)).toContain('aria-busy="true"');
  expect(render(true)).toContain("disabled");
});

it("shows an accessible Basket merchandise summary only for a nonempty basket", () => {
  const render = (count: number) =>
    renderToStaticMarkup(
      createElement(BasketSummaryBar, {
        count,
        subtotal: "RM 11.99",
        onOpen: () => {},
      }),
    );
  expect(render(0)).toBe("");
  expect(render(3)).toContain(
    'aria-label="View basket, 3 items, items subtotal RM 11.99"',
  );
  expect(render(3)).toContain("Basket · 3 items");
  expect(render(3)).toContain("RM 11.99");
});

describe("BottomNavigation", () => {
  it("labels Browse and Basket and caps the accessible quantity badge", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNavigation, {
        active: "Browse",
        cartCount: 104,
        onNavigate: () => {},
      }),
    );
    expect(html).toContain('aria-label="Basket, 104 items"');
    expect(html).toContain(">99+</span>");
    expect(html).toContain(">Browse</span>");
    expect(html).not.toContain(">Categories</span>");
    expect(html).not.toContain(">Cart</span>");
  });
  it("renders only supported routes and marks the active destination", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNavigation, {
        active: "Browse",
        cartCount: 0,
        onNavigate: () => {},
      }),
    );

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Home");
    expect(html).toContain("Browse");
    expect(html).toContain(
      '<span class="bottom-navigation__label">Browse</span>',
    );
    expect(html).toContain("Basket");
    expect(html).toContain("Orders");
    expect(html).not.toContain("Account");
  });

  it("announces cart quantity without making the badge duplicate it", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNavigation, {
        active: "Basket",
        cartCount: 3,
        onNavigate: () => {},
      }),
    );

    expect(html).toContain('aria-label="Basket, 3 items"');
    expect(html).toMatch(/aria-hidden="true">3/);
  });
});

describe("HeaderActions", () => {
  it("uses the accepted compact home header with ordinary data", () => {
    const html = renderToStaticMarkup(
      createElement(HeaderActions, {
        context: "home",
        cartCount: 2,
        onCart: () => {},
        onLogout: () => {},
      }),
    );
    expect(html).toContain("CKS Go");
    expect(html).not.toContain('aria-label="Open basket');
    expect(html).toContain('aria-label="Close CKS Go"');
    expect(html).toContain("app-header__shopping-actions--shopping");
  });

  it("keeps compact Back and Close controls on browse screens", () => {
    const html = renderToStaticMarkup(
      createElement(HeaderActions, {
        context: "browse",
        title: "Categories",
        onLogout: () => {},
      }),
    );

    expect(html).toContain('aria-label="Back"');
    expect(html).toContain('aria-label="Close CKS Go"');
    expect(html).toContain('<span class="app-header__brand">Categories</span>');
  });

  it("presents the valid outlet assignment as quiet informational text", async () => {
    const layout = (await import("./Layout")) as typeof import("./Layout") & {
      AssignedOutletLine?: React.ComponentType<{
        outlet: {
          id: string;
          displayReference: string;
          displayName: string;
          status: "ACTIVE";
          operatingState: "ONLINE";
          availability: "AVAILABLE";
        };
      }>;
    };
    expect(layout.AssignedOutletLine).toBeTypeOf("function");
    const html = renderToStaticMarkup(
      createElement(layout.AssignedOutletLine!, {
        outlet: {
          id: "00000000-0000-4000-8000-000000000001",
          displayReference: "DEMO-01",
          displayName: "Demo neighbourhood outlet",
          status: "ACTIVE",
          operatingState: "ONLINE",
          availability: "AVAILABLE",
        },
      }),
    );

    expect(html).toContain("From Demo neighbourhood outlet");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Delivery available");
    expect(html).not.toContain("DEMO-01");
    expect(html).not.toContain("app-header__outlet-icon");
  });

  it("keeps shopping context on browse screens and removes it from orders", async () => {
    const layout = (await import("./Layout")) as typeof import("./Layout") & {
      DeliveryHeader?: React.ComponentType<{
        context: "home" | "browse" | "transaction" | "orders";
        outlet: {
          id: string;
          displayReference: string;
          displayName: string;
          status: "ACTIVE";
          operatingState: "ONLINE";
          availability: "AVAILABLE";
        };
        onManage: () => void;
        addressLink?: React.ReactNode;
        title?: string;
      }>;
    };
    expect(layout.DeliveryHeader).toBeTypeOf("function");
    const outlet = {
      id: "00000000-0000-4000-8000-000000000001",
      displayReference: "DEMO-01",
      displayName: "Demo neighbourhood outlet",
      status: "ACTIVE" as const,
      operatingState: "ONLINE" as const,
      availability: "AVAILABLE" as const,
    };
    const browse = renderToStaticMarkup(
      createElement(layout.DeliveryHeader!, {
        context: "browse",
        outlet,
        onManage: () => {},
        addressLink: createElement("span", null, "Selected address"),
        title: "Categories",
      }),
    );
    const orders = renderToStaticMarkup(
      createElement(layout.DeliveryHeader!, {
        context: "orders",
        outlet,
        onManage: () => {},
        addressLink: createElement("span", null, "Selected address"),
        title: "My Orders",
      }),
    );

    expect(browse).toContain("Selected address");
    expect(browse).toContain("From Demo neighbourhood outlet");
    expect(browse).toContain('aria-label="Close CKS Go"');
    expect(browse).not.toContain("Delivery available");
    expect(browse).not.toContain("DEMO-01");
    expect(browse).toContain(
      '<span class="app-header__brand">Categories</span>',
    );
    expect(orders).not.toContain("Selected address");
    expect(orders).not.toContain("Demo neighbourhood outlet");
    expect(orders).toContain("app-header__brand");
    expect(orders).toContain(
      '<span class="app-header__brand">My Orders</span>',
    );
    expect(orders).toContain('aria-label="Close CKS Go"');
  });

  it("retains embedded delivery context without duplicate title or Basket shortcut", async () => {
    const layout = (await import("./Layout")) as typeof import("./Layout") & {
      DeliveryHeader?: React.ComponentType<{
        context: "home" | "browse" | "transaction" | "orders";
        onManage: () => void;
        addressLink?: React.ReactNode;
        title?: string;
        embeddedHost?: boolean;
        onCart?: () => void;
        cartCount?: number;
      }>;
    };
    expect(layout.DeliveryHeader).toBeTypeOf("function");

    const home = renderToStaticMarkup(
      createElement(layout.DeliveryHeader!, {
        context: "home",
        onManage: () => {},
        addressLink: createElement("span", null, "Home · Lot 57"),
        embeddedHost: true,
        onCart: () => {},
        cartCount: 2,
      }),
    );
    expect(home).toContain("Home · Lot 57");
    expect(home).not.toContain('aria-label="Open basket');
    expect(home).not.toContain(">CKS Go<");
    expect(home).not.toContain('aria-label="Close CKS Go"');
    expect(home).not.toContain('aria-label="Back"');

    const browse = renderToStaticMarkup(
      createElement(layout.DeliveryHeader!, {
        context: "browse",
        onManage: () => {},
        title: "Categories",
        embeddedHost: true,
      }),
    );
    expect(browse).toContain("Categories");
    expect(browse).not.toContain('aria-label="Close CKS Go"');
    expect(browse).not.toContain('aria-label="Back"');
  });
});

it("uses a receipt for Orders and a decorative Basket summary chevron", () => {
  const nav = renderToStaticMarkup(
    createElement(BottomNavigation, {
      active: "Orders",
      cartCount: 0,
      onNavigate: () => {},
    }),
  );
  expect(nav).toContain('d="M7 3h10');
  const basket = renderToStaticMarkup(
    createElement(BasketSummaryBar, {
      count: 3,
      subtotal: "RM 29.40",
      onOpen: () => {},
    }),
  );
  expect(basket).toContain("<svg");
  expect(basket).toContain('aria-hidden="true"');
  expect(basket).not.toContain("Delivery fee");
});
