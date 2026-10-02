import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { syntheticAddress } from "./fixtures";

const fixture = vi.hoisted(() => ({
  customer: {} as Record<string, unknown>,
  checkout: {} as Record<string, unknown>,
}));
vi.mock("./context", () => ({ useCustomer: () => fixture.customer }));
vi.mock("../checkout/context", () => ({ useCheckout: () => fixture.checkout }));
import { DeliveryAddressPicker } from "./DeliveryAddressPicker";

describe("delivery address picker", () => {
  it("leaves page Back to Flutter while keeping standalone recovery", () => {
    fixture.customer = {
      state: { addresses: [], listPhase: "ready" },
      controller: { selectedAddress: () => undefined },
    };
    fixture.checkout = { state: { transitionPhase: "idle" } };
    const render = (embeddedHost: boolean) =>
      renderToStaticMarkup(
        createElement(DeliveryAddressPicker, {
          embeddedHost,
          onDone: () => {},
          onBack: () => {},
          onManage: () => {},
        }),
      );
    expect(render(true)).not.toContain("Back to Home");
    expect(render(false)).toContain("Back to Home");
  });
  it("shows active full-card actions, obvious selection, current location, and add action without a select", () => {
    const home = { ...syntheticAddress, latitude: 5.92, longitude: 116.08 };
    fixture.customer = {
      state: {
        addresses: [
          home,
          {
            ...home,
            id: "33333333-3333-4333-8333-333333333333",
            label: "Work",
            status: "INACTIVE",
          },
        ],
        listPhase: "ready",
        readOnly: false,
        busy: false,
        selectedId: home.id,
      },
      controller: { selectedAddress: () => home },
    };
    fixture.checkout = {
      state: {
        paymentFrozen: false,
        transitionPhase: "idle",
        transitionError: null,
      },
      selectAddress: vi.fn(),
    };
    const html = renderToStaticMarkup(
      createElement(DeliveryAddressPicker, {
        onDone: () => {},
        onBack: () => {},
        onManage: () => {},
      }),
    );
    expect(html).toContain("Delivery address");
    expect(html).toContain("Use my current location");
    expect(html).toContain("Search building, street or postcode");
    expect(html).toContain("Add a new address");
    expect(html).toContain("Selected for delivery");
    expect(html).toContain(
      "Edit Demo home, 1 Example Street, Demo City, Sabah",
    );
    expect(html).not.toContain("Work");
    expect(html).not.toContain("<select");
  });

  it("distinguishes two Home Edit controls without exposing IDs or coordinates", () => {
    const home = {
      ...syntheticAddress,
      label: "Home",
      latitude: 5.9186,
      longitude: 116.0818,
    };
    const moved = {
      ...home,
      id: "33333333-3333-4333-8333-333333333333",
      longitude: 116.082,
      isDefault: false,
    };
    fixture.customer = {
      state: {
        addresses: [home, moved],
        listPhase: "ready",
        readOnly: false,
        busy: false,
        selectedId: home.id,
      },
      controller: { selectedAddress: () => home },
    };
    fixture.checkout = {
      state: {
        paymentFrozen: false,
        transitionPhase: "idle",
        transitionError: null,
      },
      selectAddress: vi.fn(),
    };
    const html = renderToStaticMarkup(
      createElement(DeliveryAddressPicker, {
        onDone: () => {},
        onBack: () => {},
        onManage: () => {},
      }),
    );
    const names = [...html.matchAll(/aria-label="(Edit [^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    expect(
      names.every((name) =>
        name.includes("1 Example Street, Demo City, Sabah"),
      ),
    ).toBe(true);
    expect(names.join(" ")).not.toMatch(/22222222|33333333|5\.9186|116\.08/);
  });
});
