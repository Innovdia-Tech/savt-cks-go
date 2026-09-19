import { it, expect } from "vitest";
import { DevelopmentCatalogueAdapter } from "./development";
import { CatalogueApi } from "./api";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
const address = { id: "22222222-2222-4222-8222-222222222222", rowVersion: 1 };
async function setup(scenario = "success") {
  const adapter = new DevelopmentCatalogueAdapter(false);
  adapter.reset(scenario);
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return { adapter, api: new CatalogueApi("", session, adapter.fetch, 10) };
}
it("cannot construct a production fixture adapter", () =>
  expect(() => new DevelopmentCatalogueAdapter(true)).toThrow());
it("supplies strict paginated data, null images and detail", async () => {
  const { api } = await setup();
  const a = await api.assign(address);
  const p = await api.products(a, { page: 1 });
  const next = await api.products(a, { page: 2 });
  expect(p.data).toHaveLength(24);
  expect(p.meta.total).toBe(30);
  expect(next.data).toHaveLength(6);
  expect(p.data[0].imageUrl).toBeNull();
  expect((await api.categories(a)).data.length).toBeGreaterThan(0);
  expect(
    (await api.detail(a, p.data[0].outletProductId)).data.description,
  ).toBeTruthy();
  expect((await api.products(a, { page: 1, q: "no match" })).data).toEqual([]);
  expect((await api.products(a, { page: 1, q: "%" })).data).toEqual([]);
});
it.each([
  ["incomplete", "CUSTOMER_ASSIGNMENT_INCOMPLETE"],
  ["no-service", "CUSTOMER_NO_SERVICEABLE_OUTLET"],
  ["context-store", "CUSTOMER_ASSIGNMENT_CONTEXT_UNAVAILABLE"],
  ["offline", "NETWORK_ERROR"],
  ["timeout", "REQUEST_TIMEOUT"],
  ["session-expired", "CUSTOMER_SESSION_INVALID"],
  ["address-changed", "CUSTOMER_ADDRESS_CHANGED"],
])("maps deterministic %s", async (scenario, code) => {
  const { api } = await setup(scenario);
  await expect(api.assign(address)).rejects.toMatchObject({ code });
});
it("requires context, expires old handles and renews with a fresh handle", async () => {
  const { api, adapter } = await setup();
  const a = await api.assign(address);
  adapter.expire();
  await expect(api.products(a, { page: 1 })).rejects.toMatchObject({
    code: "CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED",
  });
  const b = await api.assign(address);
  expect(b.assignmentContextId).not.toBe(a.assignmentContextId);
  expect((await api.products(b, { page: 1 })).data.length).toBe(24);
});
it.each(["blocked", "unavailable"])(
  "provides unavailable products for %s",
  async (scenario) => {
    const { api } = await setup(scenario);
    const a = await api.assign(address);
    expect((await api.products(a, { page: 1 })).data[0].availability).toBe(
      "UNAVAILABLE",
    );
  },
);

it("keeps the empty-assortment fixture consistent across categories and products", async () => {
  const { api } = await setup("empty-categories");
  const a = await api.assign(address);
  expect((await api.categories(a)).data).toEqual([]);
  expect((await api.products(a, { page: 1 })).data).toEqual([]);
});
