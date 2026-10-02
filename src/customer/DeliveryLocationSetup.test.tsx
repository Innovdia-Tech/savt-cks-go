import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { syntheticAddress } from "./fixtures";

const fixture = vi.hoisted(() => ({ customer: {} as Record<string, unknown> }));
vi.mock("./context", () => ({ useCustomer: () => fixture.customer }));
vi.mock("../checkout/context", () => ({
  useCheckout: () => ({ state: { transitionPhase: "idle" } }),
}));
import { DeliveryLocationSetup } from "./DeliveryLocationSetup";

describe("secondary delivery setup support", () => {
  it.each(["choose", "search", "confirm"] as const)(
    "places help after the %s controls",
    (initialMode) => {
      const address = {
        ...syntheticAddress,
        latitude: 5.92,
        longitude: 116.08,
      };
      fixture.customer = {
        state: { profilePhase: "ready", listPhase: "ready", readOnly: false },
        controller: {
          selectedAddress: () => (initialMode === "confirm" ? address : null),
        },
        guardNavigation: vi.fn(),
      };
      const html = renderToStaticMarkup(
        createElement(DeliveryLocationSetup, {
          onDone: () => {},
          initialMode,
          supportWhatsApp: "60123456789",
        }),
      );
      const control =
        initialMode === "confirm"
          ? "Confirm this location"
          : "Use my current location";
      expect(html).toContain(control);
      expect(html).toContain("Need help with your delivery address?");
      expect(html.indexOf(control)).toBeLessThan(
        html.indexOf("support-action"),
      );
      expect(html.indexOf("support-action")).toBeGreaterThan(
        html.lastIndexOf("delivery-flow__"),
      );
      expect(html).not.toContain("60123456789");
    },
  );
});
