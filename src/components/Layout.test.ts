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
  it("keeps compact Savt return and exit controls available on Home", () => {
    const html = renderToStaticMarkup(
      createElement(HeaderActions, { home: true, onLogout: () => {} }),
    );

    expect(html).toContain('aria-label="Back to Savt"');
    expect(html).toContain('aria-label="Log out of CKS Go"');
    expect(html).toContain("Exit");
    expect(html).not.toContain("app-header__brand");
  });

  it("presents outlet assignment as compact delivery availability", async () => {
    const layout = (await import("./Layout")) as typeof import("./Layout") & {
      DeliveryAvailabilityPanel?: React.ComponentType<{
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
    expect(layout.DeliveryAvailabilityPanel).toBeTypeOf("function");
    const html = renderToStaticMarkup(
      createElement(layout.DeliveryAvailabilityPanel!, {
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

    expect(html).toContain("Delivery available");
    expect(html).toContain("From Demo neighbourhood outlet");
    expect(html).not.toContain("Assigned for this address");
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
      }),
    );
    const orders = renderToStaticMarkup(
      createElement(layout.DeliveryHeader!, {
        context: "orders",
        outlet,
        onManage: () => {},
        addressLink: createElement("span", null, "Selected address"),
      }),
    );

    expect(browse).toContain("Selected address");
    expect(browse).toContain("Delivery available");
    expect(browse).toContain("app-header__outlet--quiet");
    expect(browse).toContain("app-header__outlet-availability");
    expect(browse).toContain("app-header__outlet-name");
    expect(browse).toContain("app-header__outlet-reference");
    expect(orders).not.toContain("Selected address");
    expect(orders).not.toContain("Delivery available");
    expect(orders).toContain("app-header__brand");
  });
});
