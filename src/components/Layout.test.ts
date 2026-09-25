import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomNavigation, HeaderActions } from "./Layout";

describe("BottomNavigation", () => {
  it("renders only supported routes and marks the active destination", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNavigation, {
        active: "Categories",
        cartCount: 0,
        onNavigate: () => {},
      }),
    );

    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Home");
    expect(html).toContain("Categories");
    expect(html).toContain("Cart");
    expect(html).toContain("Orders");
    expect(html).not.toContain("Account");
  });

  it("announces cart quantity without making the badge duplicate it", () => {
    const html = renderToStaticMarkup(
      createElement(BottomNavigation, {
        active: "Cart",
        cartCount: 3,
        onNavigate: () => {},
      }),
    );

    expect(html).toContain('aria-label="Cart, 3 items"');
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
    expect(html).toContain('aria-label="Open cart"');
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
});
