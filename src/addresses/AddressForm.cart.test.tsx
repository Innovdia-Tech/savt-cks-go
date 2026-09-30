import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { syntheticAddress } from "../customer/fixtures";

const fixture = vi.hoisted(() => ({
  customer: {} as Record<string, unknown>,
  checkout: {} as Record<string, unknown>,
}));
vi.mock("../customer/context", () => ({ useCustomer: () => fixture.customer }));
vi.mock("../checkout/context", () => ({
  useOptionalCheckout: () => fixture.checkout,
}));
import { AddressForm } from "./AddressForm";

const address = {
  ...syntheticAddress,
  label: "Home",
  postcode: "89500",
  latitude: 5.9186,
  longitude: 116.0818,
};

function render(hasCart: boolean, moved: boolean) {
  fixture.customer = {
    state: {
      profile: null,
      addresses: [address],
      selectedId: address.id,
      busy: false,
      canRetryOperation: false,
      readOnly: false,
      error: null,
      listPhase: "ready",
    },
    controller: {},
    setDirty: () => {},
    guardNavigation: () => {},
  };
  fixture.checkout = {
    state: { lines: hasCart ? [{}] : [], paymentFrozen: false },
  };
  return renderToStaticMarkup(
    createElement(AddressForm, {
      address,
      location: {
        latitude: address.latitude,
        longitude: moved ? 116.082 : address.longitude,
        addressLine1: address.addressLine1,
        city: address.city,
        state: address.state,
      },
      onDone: () => {},
    }),
  );
}

describe("selected address form with a cart", () => {
  it("names the separate save before submission and explains the existing cart", () => {
    const html = render(true, true);
    expect(html).toContain("Save as new address");
    expect(html).toContain(
      "current delivery address and cart will stay unchanged",
    );
    expect(html).not.toContain(">Save changes</button>");
  });

  it.each([
    [false, true],
    [true, false],
  ])("keeps ordinary editing copy with cart=%s and moved=%s", (cart, moved) => {
    const html = render(cart, moved);
    expect(html).toContain(">Save changes</button>");
    expect(html).not.toContain("Save as new address");
  });
});
