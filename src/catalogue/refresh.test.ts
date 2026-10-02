import { afterEach, expect, it, vi } from "vitest";
import { CustomerDataController } from "../customer/state";
import { CustomerDataApi } from "../customer/api";
import { DevelopmentDataAdapter } from "../customer/development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { DevelopmentCatalogueAdapter } from "./development";
import { CatalogueApi, CatalogueError } from "./api";
import { CatalogueController } from "./state";
import { CatalogueRefreshCoordinator } from "./refresh";
import { CartController } from "../checkout/state";
import { syncCheckoutBinding } from "../checkout/context";
import { PaymentController } from "../payment/state";

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});
const settle = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};
async function setup(scenario = "shopping-success") {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  const data = new DevelopmentDataAdapter(false, "mixed");
  const transport = new DevelopmentCatalogueAdapter(false);
  transport.reset(scenario);
  let hold: Promise<void> | null = null;
  const customerFetch = transport.customerFetch(data.fetch);
  const reads = vi.fn(async (...args: Parameters<typeof fetch>) => {
    if (hold) await hold;
    return customerFetch(...args);
  });
  const customer = new CustomerDataController(
    new CustomerDataApi("", session, reads),
    session,
  );
  await customer.load();
  transport.setAddressLookup((id) =>
    customer.getSnapshot().addresses.find((a) => a.id === id),
  );
  const requests = vi.fn(transport.fetch);
  const api = new CatalogueApi("", session, requests);
  const catalogue = new CatalogueController(api);
  const coordinator = new CatalogueRefreshCoordinator(
    catalogue,
    customer,
    session,
  );
  await settle();
  cleanup.push(() => {
    coordinator.dispose();
    catalogue.dispose();
    customer.dispose();
  });
  const count = (route: string) =>
    requests.mock.calls.filter(([url]) => String(url).includes(route)).length;
  return {
    session,
    data,
    transport,
    reads,
    customer,
    requests,
    api,
    catalogue,
    coordinator,
    count,
    setHold: (p: Promise<void> | null) => {
      hold = p;
    },
  };
}
it("refreshes customer and the full catalogue once while preserving a valid assignment", async () => {
  const s = await setup();
  expect(s.catalogue.getSnapshot().phase).toBe("ready");
  const assignment = s.catalogue.getSnapshot().assignment;
  const products = s.catalogue.getSnapshot().products;
  let release!: () => void;
  s.setHold(
    new Promise<void>((r) => {
      release = r;
    }),
  );
  const pending = s.coordinator.refresh();
  expect(s.catalogue.getSnapshot().products).toBe(products);
  expect(s.customer.getSnapshot().listPhase).toBe("ready");
  release();
  expect(await pending).toBe(true);
  expect(s.catalogue.getSnapshot().assignment?.assignmentContextId).toBe(
    assignment?.assignmentContextId,
  );
  expect(s.count("/outlet-assignment")).toBe(1);
  expect(s.count("/categories?")).toBe(2);
  expect(s.count("/products?")).toBe(2);
  expect(s.reads).toHaveBeenCalledTimes(4);
});
it("coalesces repeated refresh requests while customer data is in flight", async () => {
  const s = await setup();
  let release!: () => void;
  s.setHold(
    new Promise<void>((r) => {
      release = r;
    }),
  );
  const first = s.coordinator.refresh();
  const second = s.coordinator.refresh();
  expect(second).toBe(first);
  release();
  await Promise.all([first, second]);
  expect(s.count("/categories?")).toBe(2);
  expect(s.count("/products?")).toBe(2);
});
it("rechecks authoritative assignment from no-service and can become Home", async () => {
  const s = await setup("no-service");
  expect(s.catalogue.getSnapshot().phase).toBe("no-service");
  expect(await s.coordinator.refresh()).toBe(true);
  expect(s.catalogue.getSnapshot().phase).toBe("no-service");
  s.transport.reset("shopping-success");
  expect(await s.coordinator.refresh()).toBe(true);
  expect(s.catalogue.getSnapshot().phase).toBe("ready");
  expect(s.count("/outlet-assignment")).toBe(3);
});
it.each(["shopping-success", "no-service"])(
  "retains %s after connectivity failure and announces transient recovery",
  async (scenario) => {
    vi.useFakeTimers();
    const s = await setup(scenario);
    const before = s.catalogue.getSnapshot();
    s.transport.reset("offline");
    expect(await s.coordinator.refresh()).toBe(false);
    expect(s.catalogue.getSnapshot()).toEqual(before);
    expect(s.customer.getSnapshot().listPhase).toBe("ready");
    expect(s.customer.getSnapshot().notice).toBe(
      "Couldn't refresh. Check your connection and try again.",
    );
    vi.advanceTimersByTime(2800);
    expect(s.customer.getSnapshot().notice).toBe("");
  },
);
it("retains loaded products when only catalogue refresh fails", async () => {
  const s = await setup();
  const before = s.catalogue.getSnapshot();
  s.requests.mockImplementation(async (url, init) => {
    if (String(url).includes("/categories?")) throw new TypeError("Offline");
    return s.transport.fetch(url, init);
  });
  expect(await s.coordinator.refresh()).toBe(false);
  expect(s.catalogue.getSnapshot()).toEqual(before);
});
it("renews an expired assignment once through existing assignment authority", async () => {
  vi.useFakeTimers();
  const s = await setup();
  vi.advanceTimersByTime(300001);
  s.transport.expire();
  expect(await s.coordinator.refresh()).toBe(true);
  expect(s.catalogue.getSnapshot().phase).toBe("ready");
  expect(s.count("/outlet-assignment")).toBe(2);
});
it("binds a changed address rowVersion once without duplicate catalogue loads", async () => {
  const s = await setup();
  const address = s.customer.selectedAddress()!;
  const response = await s.data.fetch(
    `/api/v1/customer/me/addresses/${address.id}`,
    {
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ label: "Renamed" }),
      headers: {
        "x-cks-csrf": "synthetic",
        "If-Match": `"${address.rowVersion}"`,
      },
    },
  );
  expect(response.status).toBe(200);
  await s.coordinator.refresh();
  expect(s.customer.selectedAddress()?.rowVersion).toBe(2);
  expect(s.catalogue.getSnapshot().assignment?.addressRowVersion).toBe(2);
  expect(s.count("/outlet-assignment")).toBe(2);
  expect(s.count("/categories?")).toBe(2);
});
it("preserves Basket lines, checkout authority and payment state across refresh", async () => {
  const s = await setup();
  const quote = vi.fn();
  const cart = new CartController({ create: quote }, s.api);
  const paymentApi = { create: vi.fn(), result: vi.fn(), retry: vi.fn() };
  const payment = new PaymentController(
    paymentApi,
    new DevelopmentBridgeAdapter(true, false),
    s.session,
    (id) => cart.freezeForPayment(id),
    () => {},
  );
  const sync = () =>
    syncCheckoutBinding(
      cart,
      s.customer.selectedAddress(),
      s.catalogue.getSnapshot().assignment,
      s.coordinator.getSnapshot(),
    );
  const offs = [
    s.customer.subscribe(sync),
    s.catalogue.subscribe(sync),
    s.coordinator.subscribe(sync),
  ];
  cleanup.push(() => {
    offs.forEach((off) => off());
    cart.dispose();
    payment.dispose();
  });
  sync();
  cart.add(
    s.catalogue.getSnapshot().products!.data[0],
    s.catalogue.getSnapshot().assignment!,
  );
  const lines = cart.getSnapshot().lines;
  const paymentBefore = payment.getSnapshot();
  await s.coordinator.refresh();
  expect(cart.getSnapshot().lines).toEqual(lines);
  expect(payment.getSnapshot()).toBe(paymentBefore);
  expect(quote).not.toHaveBeenCalled();
  expect(paymentApi.create).not.toHaveBeenCalled();
  expect(paymentApi.result).not.toHaveBeenCalled();
  expect(paymentApi.retry).not.toHaveBeenCalled();
  const original = s.catalogue.getSnapshot().assignment!;
  const changed = {
    ...original,
    outlet: { ...original.outlet, id: "00000000-0000-4000-8000-000000000099" },
  };
  syncCheckoutBinding(cart, s.customer.selectedAddress(), changed, false);
  expect(cart.getSnapshot().lines).toEqual(lines);
  expect(cart.getSnapshot().assignment?.outletId).toBe(original.outlet.id);
  expect(cart.getSnapshot().transitionError).toBe("CART_OUTLET_MISMATCH");
});
it("preserves the original Basket outlet when refreshed address authority resolves to a different outlet", async () => {
  const s = await setup();
  const cart = new CartController({ create: vi.fn() }, s.api);
  const sync = () =>
    syncCheckoutBinding(
      cart,
      s.customer.selectedAddress(),
      s.catalogue.getSnapshot().assignment,
      s.coordinator.getSnapshot(),
    );
  const offs = [
    s.customer.subscribe(sync),
    s.catalogue.subscribe(sync),
    s.coordinator.subscribe(sync),
  ];
  cleanup.push(() => {
    offs.forEach((off) => off());
    cart.dispose();
  });
  sync();
  const original = s.catalogue.getSnapshot().assignment!;
  const loaded = s.catalogue.getSnapshot().products!;
  cart.add(loaded.data[0], original);
  const lines = cart.getSnapshot().lines;
  const address = s.customer.selectedAddress()!;
  await s.data.fetch(`/api/v1/customer/me/addresses/${address.id}`, {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify({ label: "Renamed externally" }),
    headers: {
      "x-cks-csrf": "synthetic",
      "If-Match": `"${address.rowVersion}"`,
    },
  });
  const changed = {
    ...original,
    addressRowVersion: 2,
    outlet: { ...original.outlet, id: "00000000-0000-4000-8000-000000000099" },
  };
  const categoryData = s.catalogue.getSnapshot().homeCategories;
  vi.spyOn(s.api, "assign").mockResolvedValue(changed);
  vi.spyOn(s.api, "categories").mockResolvedValue({
    data: categoryData,
    meta: {
      ...loaded.meta,
      page: 1,
      total: categoryData.length,
      hasNextPage: false,
      outlet: changed.outlet,
    },
  });
  vi.spyOn(s.api, "products").mockResolvedValue({
    ...loaded,
    meta: { ...loaded.meta, outlet: changed.outlet },
  });
  expect(await s.coordinator.refresh()).toBe(true);
  expect(s.catalogue.getSnapshot().assignment?.outlet.id).toBe(
    changed.outlet.id,
  );
  expect(cart.getSnapshot().lines).toEqual(lines);
  expect(cart.getSnapshot().assignment?.outletId).toBe(original.outlet.id);
  expect(cart.getSnapshot().transitionError).toBe("CART_OUTLET_MISMATCH");
});
it("preserves Basket outlet authority after a changed-address refresh fails and a retry resolves elsewhere", async () => {
  const s = await setup();
  const quote = vi.fn();
  const cart = new CartController({ create: quote }, s.api);
  const sync = () =>
    syncCheckoutBinding(
      cart,
      s.customer.selectedAddress(),
      s.catalogue.getSnapshot().assignment,
      s.coordinator.getSnapshot(),
    );
  const offs = [
    s.customer.subscribe(sync),
    s.catalogue.subscribe(sync),
    s.coordinator.subscribe(sync),
  ];
  cleanup.push(() => {
    offs.forEach((off) => off());
    cart.dispose();
  });
  sync();
  const original = s.catalogue.getSnapshot().assignment!;
  const loaded = s.catalogue.getSnapshot().products!;
  const categoryData = s.catalogue.getSnapshot().homeCategories;
  cart.add(loaded.data[0], original);
  const lines = cart.getSnapshot().lines;
  const address = s.customer.selectedAddress()!;
  await s.data.fetch(`/api/v1/customer/me/addresses/${address.id}`, {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify({ label: "Renamed externally" }),
    headers: {
      "x-cks-csrf": "synthetic",
      "If-Match": `"${address.rowVersion}"`,
    },
  });
  const changed = {
    ...original,
    addressRowVersion: 2,
    outlet: { ...original.outlet, id: "00000000-0000-4000-8000-000000000099" },
  };
  vi.spyOn(s.api, "assign")
    .mockRejectedValueOnce(new CatalogueError("NETWORK_ERROR"))
    .mockResolvedValue(changed);
  expect(await s.coordinator.refresh()).toBe(false);
  expect(cart.getSnapshot().assignment).toBeNull();
  expect(cart.getSnapshot().lines).toEqual(lines);
  vi.spyOn(s.api, "categories").mockResolvedValue({
    data: categoryData,
    meta: {
      ...loaded.meta,
      page: 1,
      total: categoryData.length,
      hasNextPage: false,
      outlet: changed.outlet,
    },
  });
  vi.spyOn(s.api, "products").mockResolvedValue({
    ...loaded,
    meta: { ...loaded.meta, outlet: changed.outlet },
  });
  expect(await s.coordinator.refresh()).toBe(true);
  expect(cart.getSnapshot().lines).toEqual(lines);
  expect(cart.getSnapshot().assignment).toBeNull();
  expect(cart.getSnapshot().transitionError).toBe("CART_OUTLET_MISMATCH");
  expect(quote).not.toHaveBeenCalled();
});
it("fences refresh completions after logout or coordinator disposal", async () => {
  const s = await setup();
  let release!: () => void;
  s.setHold(
    new Promise<void>((r) => {
      release = r;
    }),
  );
  const pending = s.coordinator.refresh();
  await settle();
  await s.session.logout();
  s.coordinator.dispose();
  release();
  expect(await pending).toBe(false);
  expect(s.customer.getSnapshot().addresses).toEqual([]);
  expect(s.catalogue.getSnapshot().assignment).toBeNull();
  expect(s.customer.getSnapshot().notice).toBe("");
});
