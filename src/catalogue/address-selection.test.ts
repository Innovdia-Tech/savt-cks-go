import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutAddress } from "../customer/components";
import { CustomerDataProvider } from "../customer/context";
import { CustomerDataController } from "../customer/state";
import { CustomerDataApi } from "../customer/api";
import { DevelopmentDataAdapter } from "../customer/development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
it("reuses active-address selection without prototype commerce copy", async () => {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  const controller = new CustomerDataController(
    new CustomerDataApi("", session, new DevelopmentDataAdapter(false).fetch),
    session,
  );
  await controller.load();
  const html = renderToStaticMarkup(
    createElement(CustomerDataProvider, {
      controller,
      children: createElement(CheckoutAddress, {
        onManage: () => {},
        catalogue: true,
      } as never),
    }),
  );
  expect(html).toContain("Deliver to");
  expect(html).toContain("Change selected address");
  expect(html).toContain("Demo home");
  expect(html).not.toContain("Demo office");
  expect(html).not.toMatch(/prototype|remain mocked/);
});
