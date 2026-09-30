import { describe, expect, it } from "vitest";
import {
  addressFormFields,
  shouldSaveLocationAsNewAddress,
} from "./AddressForm";
import { AddressForm } from "./AddressForm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerDataProvider } from "../customer/context";
import { CustomerDataController } from "../customer/state";
import { CustomerDataApi } from "../customer/api";
import { DevelopmentDataAdapter } from "../customer/development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";

describe("AddressForm customer fields", () => {
  it("never exposes latitude or longitude as editable address fields", () => {
    expect(Object.keys(addressFormFields)).not.toContain("latitude");
    expect(Object.keys(addressFormFields)).not.toContain("longitude");
    expect(Object.values(addressFormFields).join(" ")).not.toMatch(
      /latitude|longitude|coordinates/i,
    );
  });
  it("keeps confirmed location text tied to its pin and places delete below save", async () => {
    const session = new CustomerSessionController(
      new DevelopmentCustomerApi(false),
      new DevelopmentBridgeAdapter(true, false),
    );
    const controller = new CustomerDataController(
      new CustomerDataApi(
        "",
        session,
        new DevelopmentDataAdapter(false, "mixed").fetch,
      ),
      session,
    );
    await session.start();
    await controller.load();
    const address = {
      ...controller.selectedAddress()!,
      latitude: 5.9186,
      longitude: 116.0818,
    };
    const html = renderToStaticMarkup(
      createElement(CustomerDataProvider, {
        controller,
        children: createElement(AddressForm, {
          address,
          onDone: () => {},
          onChangeLocation: () => {},
        }),
      }),
    );
    expect(html).toContain("Change delivery location");
    for (const key of ["addressLine1", "city", "state", "postcode"])
      expect(html).toMatch(new RegExp(`<input[^>]*readOnly[^>]*name="${key}"`));
    expect(html.indexOf("Save changes")).toBeLessThan(
      html.indexOf("Delete address"),
    );
    expect(html).not.toContain("latitude");
    expect(html).not.toContain("longitude");
  });
  it("keeps the original selected delivery place while a filled cart evaluates a moved pin", () => {
    const address = {
      id: "22222222-2222-4222-8222-222222222222",
      latitude: 5.9186,
      longitude: 116.0818,
      addressLine1: "Jalan Pintas Penampang",
      city: "Penampang",
      state: "Sabah",
      postcode: "89500",
    };
    expect(
      shouldSaveLocationAsNewAddress(
        address,
        { ...address, longitude: 116.082 },
        address.id,
        true,
      ),
    ).toBe(true);
    const recipientOnly = { ...address, recipientName: "New recipient" };
    expect(
      shouldSaveLocationAsNewAddress(address, recipientOnly, address.id, true),
    ).toBe(false);
    expect(
      shouldSaveLocationAsNewAddress(
        address,
        { ...address, longitude: 116.082 },
        address.id,
        false,
      ),
    ).toBe(false);
  });
});
