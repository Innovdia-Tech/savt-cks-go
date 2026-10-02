import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProfileSummary,
  CheckoutAddress,
  CustomerProfileScreen,
  CustomerDataProvider,
  DeliveryAddressLink,
} from "./components";
import { CustomerDataController } from "./state";
import { CustomerDataApi } from "./api";
import { DevelopmentDataAdapter } from "./development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
async function render(
  scenario: string,
  component:
    | typeof ProfileSummary
    | typeof CheckoutAddress
    | typeof CustomerProfileScreen
    | typeof DeliveryAddressLink,
) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  const controller = new CustomerDataController(
    new CustomerDataApi(
      "",
      session,
      new DevelopmentDataAdapter(false, scenario).fetch,
    ),
    session,
  );
  await session.start();
  await controller.load();
  return renderToStaticMarkup(
    createElement(CustomerDataProvider, {
      controller,
      children: createElement(component, { onManage: () => {} }),
    }),
  );
}
describe("customer presentation", () => {
  it("renders a safe profile and stale warning", async () => {
    const html = await render("stale", ProfileSummary);
    expect(html).toContain("Synthetic member");
    expect(html).toContain("GOLD");
    expect(html).toContain("may be out of date");
    expect(html).not.toContain("csrf");
  });
  it("shows only active saved addresses with customer delete language", async () => {
    const html = await render("mixed", CustomerProfileScreen);
    for (const text of [
      "Saved addresses",
      "Demo home",
      "Demo flat",
      "Edit",
      "Add address",
    ])
      expect(html).toContain(text);
    expect(html).toContain("Selected for delivery");
    for (const hidden of [
      "Inactive addresses",
      "Active addresses",
      "Deactivate",
      "Reactivate",
      "INACTIVE",
      "Demo office",
    ])
      expect(html).not.toContain(hidden);
  });
  it("shows an actionable no-address checkout state", async () => {
    const html = await render("empty", CheckoutAddress);
    expect(html).toContain("No active saved address");
    expect(html).toContain("Add an address");
  });
  it("renders the selected address as one change-address control", async () => {
    const html = await render("mixed", DeliveryAddressLink);
    expect(html).toContain('aria-label="Change delivery address"');
    expect(html).toContain("Deliver to");
    expect(html).toContain("Demo home · 1 Example Street, Demo City");
    expect(html).toContain("delivery-address-link__change");
    expect(html).toContain(">Change<");
    expect(html.match(/<button/g)).toHaveLength(1);
  });
  it("checkout links to delivery selection without a native address dropdown", async () => {
    const html = await render("mixed", CheckoutAddress);
    expect(html).toContain("Deliver to");
    expect(html).toContain("Change");
    expect(html).toContain("Demo home");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Demo office");
    expect(html).toContain("1 Example Street");
  });
  it("explains read-only accounts and disables changes", async () => {
    const html = await render("readonly", CustomerProfileScreen);
    expect(html).toContain("read-only");
    expect(html).toMatch(/disabled/);
  });
});
