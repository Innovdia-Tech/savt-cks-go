import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogueController } from "./state";
import { CatalogueError, type CataloguePort } from "./api";
import { syntheticAddress } from "../customer/fixtures";
import type {
  Assignment,
  Product,
  Page,
  Detail,
  CustomerCategory,
} from "./contracts";
import { CartController } from "../checkout/state";
import { syncCheckoutBinding } from "../checkout/context";

const epoch = Date.parse("2026-10-11T00:00:00Z");
const address = { ...syntheticAddress, latitude: 5.9, longitude: 116.1 };
const session = {};
const product = {
  productId: "p",
  outletProductId: "op",
  name: "Milk 500 ml",
  imageUrl: null,
  category: { id: "c", name: "Drinks" },
  subcategory: null,
  brand: null,
  uom: { code: "BTL", name: "Bottle" },
  packSize: "500 ml",
  sellingPriceMinor: 500,
  currency: "MYR",
  availability: "AVAILABLE",
} as Product;
const controllers: CatalogueController[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(epoch);
});
afterEach(() => {
  controllers.splice(0).forEach((c) => c.dispose());
  vi.useRealTimers();
});
const assignment = (id = "A", outlet = "outlet"): Assignment => ({
  assignmentContextId: id.repeat(43),
  customerAddressId: address.id,
  addressRowVersion: address.rowVersion,
  outlet: {
    id: outlet,
    displayReference: "DEMO",
    displayName: outlet,
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: new Date(Date.now()).toISOString(),
  expiresAt: new Date(Date.now() + 300000).toISOString(),
});
const page = <T>(a: Assignment, data: T[], number = 1): Page<T> => ({
  data,
  meta: {
    page: number,
    pageSize: 24,
    total: data.length,
    hasNextPage: false,
    asOf: new Date().toISOString(),
    outlet: a.outlet,
    assignmentContextExpiresAt: a.expiresAt,
  },
});
const settle = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};
async function setup() {
  const api = {
    assign: vi.fn(async () => assignment("A")),
    categories: vi.fn(async (a: Assignment, f) =>
      page<CustomerCategory>(
        a,
        [{ id: "c", name: "Drinks", code: "001" }],
        f.page,
      ),
    ),
    products: vi.fn(async (a: Assignment, f) => page(a, [product], f.page)),
    detail: vi.fn(async (a: Assignment) => ({
      data: {
        ...product,
        description: "Official description",
        storageType: "CHILLED",
      } as Detail,
      meta: page(a, []).meta,
    })),
  } satisfies CataloguePort;
  const c = new CatalogueController(api);
  controllers.push(c);
  await c.bind({ session, address, phase: "ready", readOnly: false });
  api.assign.mockImplementation(async () => assignment("B"));
  return { c, api };
}

it("renews before expiry, preserving current filters/page/detail and Basket ownership", async () => {
  const { c, api } = await setup();
  await c.search("milk");
  await c.category("c", 2);
  await c.nextPage(3);
  await c.open("op");
  const cart = new CartController({ create: vi.fn() }, api);
  syncCheckoutBinding(cart, address, c.getSnapshot().assignment, false);
  cart.add(product, c.getSnapshot().assignment!);
  const lines = cart.getSnapshot().lines;
  c.setBrowsingActive(true);
  await vi.advanceTimersByTimeAsync(270000);
  expect(api.assign).toHaveBeenCalledTimes(2);
  expect(c.getSnapshot()).toMatchObject({
    phase: "ready",
    q: "milk",
    categoryId: "c",
    categoryPage: 2,
    page: 3,
    detailId: "op",
    renewing: false,
  });
  expect(c.getSnapshot().assignment?.assignmentContextId).toBe("B".repeat(43));
  expect(c.getSnapshot().detail?.meta.assignmentContextExpiresAt).toBe(
    c.getSnapshot().assignment?.expiresAt,
  );
  syncCheckoutBinding(cart, address, c.getSnapshot().assignment, false);
  expect(cart.getSnapshot().lines).toBe(lines);
  expect(cart.getSnapshot().assignment?.outletId).toBe("outlet");
  cart.dispose();
});

it("does not renew in the background and recovers expired authority on foreground", async () => {
  const { c, api } = await setup();
  await c.search("milk");
  await c.nextPage(2);
  c.setBrowsingActive(true);
  c.setBrowsingActive(false);
  await vi.advanceTimersByTimeAsync(300001);
  expect(api.assign).toHaveBeenCalledTimes(1);
  expect(c.getSnapshot().assignment).toBeNull();
  c.setBrowsingActive(true);
  await settle();
  expect(api.assign).toHaveBeenCalledTimes(2);
  expect(c.getSnapshot()).toMatchObject({ phase: "ready", q: "milk", page: 2 });
});

it("coalesces timer, foreground and simultaneous renewal/retry; blocks expired authority while pending", async () => {
  const { c, api } = await setup();
  let resolve!: (a: Assignment) => void;
  api.assign.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  c.setBrowsingActive(true);
  await vi.advanceTimersByTimeAsync(270000);
  const a = c.renewAssignment(),
    b = c.renewAssignment(),
    retry = c.retry();
  c.setBrowsingActive(true);
  expect(a).toBe(b);
  expect(a).toBe(retry);
  expect(api.assign).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(30001);
  expect(c.getSnapshot().assignment).toBeNull();
  expect(c.getSnapshot().renewing).toBe(true);
  resolve(assignment("B"));
  expect(await a).toBe(true);
  expect(c.getSnapshot()).toMatchObject({ phase: "ready", renewing: false });
});

it("failed renewal retains only unexpired display, stops automatic retries and exposes a working Try again", async () => {
  const { c, api } = await setup();
  await c.search("milk");
  await c.nextPage(2);
  api.assign.mockRejectedValueOnce(new CatalogueError("NETWORK_ERROR"));
  c.setBrowsingActive(true);
  await vi.advanceTimersByTimeAsync(270000);
  expect(c.getSnapshot()).toMatchObject({
    phase: "ready",
    renewalError: "NETWORK_ERROR",
  });
  await vi.advanceTimersByTimeAsync(30001);
  expect(api.assign).toHaveBeenCalledTimes(2);
  expect(c.getSnapshot().assignment).toBeNull();
  expect(await c.retry()).toBe(true);
  expect(c.getSnapshot()).toMatchObject({
    phase: "ready",
    q: "milk",
    page: 2,
    renewalError: null,
  });
});

it("changed outlet requires explicit address review; retry/resume cannot silently adopt it or alter Basket", async () => {
  const { c, api } = await setup();
  const cart = new CartController({ create: vi.fn() }, api);
  syncCheckoutBinding(cart, address, c.getSnapshot().assignment, false);
  cart.add(product, c.getSnapshot().assignment!);
  const before = cart.getSnapshot();
  api.assign.mockImplementation(async () => assignment("B", "new-outlet"));
  expect(await c.renewAssignment()).toBe(false);
  expect(c.getSnapshot()).toMatchObject({
    phase: "authority-change",
    assignment: null,
  });
  c.setBrowsingActive(true);
  expect(await c.retry()).toBe(false);
  expect(api.assign).toHaveBeenCalledTimes(2);
  syncCheckoutBinding(cart, address, c.getSnapshot().assignment, false);
  expect(cart.getSnapshot()).toBe(before);
  expect(await cart.requestAddress(address)).toBe("confirmation");
  expect(cart.getSnapshot().lines).toBe(before.lines);
  cart.cancelAddressChange();
  expect(c.getSnapshot().phase).toBe("authority-change");
  expect(await cart.requestAddress(address)).toBe("confirmation");
  expect(cart.confirmAddressChange()).toBe(address.id);
  expect(await c.resumeAfterAddressSelection()).toBe(true);
  expect(c.getSnapshot().assignment?.outlet.id).toBe("new-outlet");
  expect(cart.getSnapshot().lines).toEqual([]);
  cart.dispose();
});

it("authentication failure invalidates catalogue authority and is never renewed or bypassed", async () => {
  const { c, api } = await setup();
  api.assign.mockRejectedValue(new CatalogueError("CUSTOMER_SESSION_INVALID"));
  c.setBrowsingActive(true);
  await vi.advanceTimersByTimeAsync(270000);
  expect(c.getSnapshot()).toMatchObject({
    phase: "session-expired",
    assignment: null,
  });
  await vi.advanceTimersByTimeAsync(900000);
  c.setBrowsingActive(true);
  await settle();
  expect(api.assign).toHaveBeenCalledTimes(2);
});

it.each(["logout", "disposal", "address"])(
  "ignores late renewal after %s and never clears a replacement owner",
  async (mode) => {
    const { c, api } = await setup();
    let resolve!: (a: Assignment) => void;
    api.assign.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const pending = c.renewAssignment();
    await settle();
    if (mode === "logout")
      c.bind({ session: null, phase: "ready", readOnly: false });
    else if (mode === "disposal") c.dispose();
    else
      await c.bind({
        session,
        address: { ...address, rowVersion: 2 },
        phase: "ready",
        readOnly: false,
      });
    const replacement = c.getSnapshot();
    resolve(assignment("OLD"));
    expect(await pending).toBe(false);
    expect(c.getSnapshot()).toBe(replacement);
  },
);

it("rejects wrong-address or expired renewal responses without accepting authority", async () => {
  const { c, api } = await setup();
  api.assign.mockResolvedValueOnce({
    ...assignment("B"),
    customerAddressId: "wrong",
  });
  expect(await c.renewAssignment()).toBe(false);
  expect(c.getSnapshot().assignment?.assignmentContextId).not.toBe(
    "B".repeat(43),
  );
  api.assign.mockImplementation(async () => ({
    ...assignment("B"),
    expiresAt: new Date(Date.now() - 1).toISOString(),
  }));
  expect(await c.renewAssignment()).toBe(false);
  expect(c.getSnapshot().assignment?.assignmentContextId).not.toBe(
    "B".repeat(43),
  );
});

it("does not publish a stale Detail response when the customer changes query during renewal", async () => {
  const { c, api } = await setup();
  await c.open("op");
  let release!: () => void;
  const hold = new Promise<void>((r) => {
    release = r;
  });
  api.detail.mockImplementationOnce(async (a) => {
    await hold;
    return {
      data: {
        ...product,
        description: "Old detail",
        storageType: "CHILLED",
      } as Detail,
      meta: page(a, []).meta,
    };
  });
  const renewal = c.renewAssignment();
  await settle();
  const observed: unknown[] = [];
  const off = c.subscribe(() => observed.push(c.getSnapshot().detail));
  const search = c.search("new query");
  release();
  await renewal;
  await search;
  off();
  expect(observed.every((detail) => detail === null)).toBe(true);
  expect(c.getSnapshot()).toMatchObject({
    phase: "ready",
    q: "new query",
    detailId: undefined,
    detail: null,
  });
});

it("rejects Add using an expired context even when no expiry timer has run", async () => {
  const { c, api } = await setup();
  const a = c.getSnapshot().assignment!;
  const cart = new CartController({ create: vi.fn() }, api);
  syncCheckoutBinding(cart, address, a, false);
  vi.setSystemTime(epoch + 300001);
  expect(() => cart.add(product, a)).toThrow("CART_ASSIGNMENT_EXPIRED");
  expect(cart.getSnapshot().lines).toEqual([]);
  cart.dispose();
});

it("blocks an externally changed address until customer review", async () => {
  const { c, api } = await setup();
  api.assign.mockRejectedValueOnce(
    new CatalogueError("CUSTOMER_ADDRESS_CHANGED"),
  );
  expect(await c.renewAssignment()).toBe(false);
  expect(c.getSnapshot()).toMatchObject({
    phase: "authority-change",
    assignment: null,
  });
  expect(await c.retry()).toBe(false);
  expect(api.assign).toHaveBeenCalledTimes(2);
});

it("retains merged-main subcategory filters during active assignment renewal", async () => {
  const { c, api } = await setup();
  Object.assign(api, {
    subcategories: vi.fn(async (a: Assignment) =>
      page(a, [{ id: "s", categoryId: "c", name: "Milk", code: "001" }]),
    ),
  });
  api.products.mockImplementation(async (a, f) =>
    page(a, [{ ...product, subcategory: { id: "s", name: "Milk" } }], f.page),
  );
  await c.search("milk");
  await c.category("c");
  await c.subcategory("s");
  await c.nextPage(2);
  c.setBrowsingActive(true);
  await vi.advanceTimersByTimeAsync(270000);
  expect(c.getSnapshot()).toMatchObject({
    phase: "ready",
    q: "milk",
    categoryId: "c",
    subcategoryId: "s",
    page: 2,
    subcategories: [{ id: "s", categoryId: "c" }],
  });
  expect(api.products).toHaveBeenLastCalledWith(
    expect.objectContaining({ assignmentContextId: "B".repeat(43) }),
    { page: 2, q: "milk", categoryId: "c", subcategoryId: "s" },
    expect.any(AbortSignal),
  );
});

it("does not publish an old Detail when merged-main subcategory selection replaces a pending renewal view", async () => {
  const { c, api } = await setup();
  Object.assign(api, {
    subcategories: vi.fn(async (a: Assignment) =>
      page(a, [{ id: "s", categoryId: "c", name: "Milk", code: "001" }]),
    ),
  });
  api.products.mockImplementation(async (a, f) =>
    page(a, [{ ...product, subcategory: { id: "s", name: "Milk" } }], f.page),
  );
  await c.category("c");
  await c.open("op");
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  api.detail.mockImplementationOnce(async (a) => {
    await hold;
    return {
      data: {
        ...product,
        description: "Old detail",
        storageType: "CHILLED",
      } as Detail,
      meta: page(a, []).meta,
    };
  });
  const renewal = c.renewAssignment();
  await settle();
  const observed: unknown[] = [];
  const off = c.subscribe(() => observed.push(c.getSnapshot().detail));
  const selection = c.subcategory("s");
  release();
  await renewal;
  await selection;
  off();
  expect(observed.every((detail) => detail === null)).toBe(true);
  expect(c.getSnapshot()).toMatchObject({
    phase: "ready",
    categoryId: "c",
    subcategoryId: "s",
    detailId: undefined,
    detail: null,
  });
});
