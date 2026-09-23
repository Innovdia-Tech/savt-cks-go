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
});
