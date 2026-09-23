import { describe, it, expect, vi } from "vitest";
import { CatalogueController } from "./state";
import { CatalogueError, type CataloguePort } from "./api";
import { syntheticAddress } from "../customer/fixtures";
import type { Assignment, Page, Product, Category } from "./contracts";
const now = Date.parse("2026-09-19T00:00:00.000Z");
const address = { ...syntheticAddress, latitude: 5, longitude: 116 };
const session = {};
const assignment: Assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: address.id,
  addressRowVersion: 1,
  outlet: {
    id: "11111111-1111-4111-8111-111111111111",
    displayReference: "DEMO",
    displayName: "Demo outlet",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  },
  resolvedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 300000).toISOString(),
};
const page = <T>(data: T[]): Page<T> => ({
  data,
  meta: {
    page: 1,
    pageSize: 24,
    total: data.length,
    hasNextPage: false,
    asOf: new Date(now).toISOString(),
    outlet: assignment.outlet,
    assignmentContextExpiresAt: assignment.expiresAt,
  },
});
function setup(overrides: Partial<CataloguePort> = {}) {
  const api = {
    assign: vi.fn(async () => assignment),
    categories: vi.fn(async () => page<Category>([])),
    products: vi.fn(async () => page<Product>([])),
    detail: vi.fn(),
    ...overrides,
  };
  const c = new CatalogueController(api, () => now);
  return { c, api };
}
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const bind = (c: CatalogueController, patch: Record<string, unknown> = {}) =>
  c.bind({
    session,
    address,
    phase: "ready",
    readOnly: false,
    ...patch,
  } as never);
describe("assignment state isolation", () => {
  it("gates loading, no active address and missing coordinates", async () => {
    const { c, api } = setup();
    bind(c, { phase: "loading" });
    expect(c.getSnapshot().phase).toBe("address-loading");
    bind(c, { address: undefined });
    expect(c.getSnapshot().phase).toBe("no-address");
    bind(c, { address: { ...address, latitude: null } });
    expect(c.getSnapshot().phase).toBe("coordinates");
    expect(api.assign).not.toHaveBeenCalled();
    c.dispose();
  });
  it("automatically assigns and consumes only the returned outlet", async () => {
    const { c, api } = setup();
    bind(c);
    await settle();
    expect(c.getSnapshot().phase).toBe("ready");
    expect(c.getSnapshot().assignment?.outlet.displayName).toBe("Demo outlet");
    expect(api.assign).toHaveBeenCalledWith(
      { id: address.id, rowVersion: 1 },
      expect.any(AbortSignal),
    );
    expect(api.products).toHaveBeenCalledWith(
      assignment,
      { page: 1, q: "", categoryId: undefined },
      expect.any(AbortSignal),
    );
    c.dispose();
  });
  it.each([
    "CUSTOMER_NO_SERVICEABLE_OUTLET",
    "CUSTOMER_ASSIGNMENT_INCOMPLETE",
    "CUSTOMER_ASSIGNMENT_CONTEXT_UNAVAILABLE",
  ])("preserves distinct %s failure", async (code) => {
    const { c } = setup({
      assign: async () => {
        throw new CatalogueError(code);
      },
    });
    bind(c);
    await settle();
    expect(c.getSnapshot().error).toBe(code);
    expect(c.getSnapshot().assignment).toBeNull();
    c.dispose();
  });
  it("renews once after context expiry then stops a persistent expiry", async () => {
    const assign = vi.fn(async () => assignment),
      products = vi.fn(async () => {
        throw new CatalogueError("CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED");
      });
    const { c } = setup({ assign, products });
    bind(c);
    await settle();
    expect(assign).toHaveBeenCalledTimes(2);
    expect(products).toHaveBeenCalledTimes(2);
    expect(c.getSnapshot().error).toBe("CUSTOMER_ASSIGNMENT_CONTEXT_EXPIRED");
    c.dispose();
  });
  it("drops delayed assignment after address revision change and logout", async () => {
    let resolve!: (v: Assignment) => void;
    const { c } = setup({
      assign: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    bind(c);
    bind(c, { address: { ...address, rowVersion: 2 } });
    bind(c, { session: null });
    resolve(assignment);
    await settle();
    expect(c.getSnapshot().phase).toBe("session-expired");
    expect(c.getSnapshot().assignment).toBeNull();
    c.dispose();
  });
  it("rejects assignment for another address revision", async () => {
    const { c } = setup({
      assign: async () => ({ ...assignment, addressRowVersion: 5 }),
    });
    bind(c);
    await settle();
    expect(c.getSnapshot().error).toBe("INVALID_RESPONSE");
    c.dispose();
  });
  it("rejects old search results and resets pagination", async () => {
    let resolve!: (p: Page<Product>) => void;
    const products = vi
      .fn()
      .mockResolvedValueOnce(page([]))
      .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
      .mockResolvedValue(page([]));
    const { c } = setup({ products });
    bind(c);
    await settle();
    void c.search("old");
    void c.search("new");
    await settle();
    resolve({ ...page([]), meta: { ...page([]).meta, total: 99 } });
    await settle();
    expect(c.getSnapshot().q).toBe("new");
    expect(c.getSnapshot().products?.meta.total).toBe(0);
    expect(c.getSnapshot().page).toBe(1);
    c.dispose();
  });
  it("clears hidden search and category filters before returning Home", async () => {
    const { c, api } = setup();
    bind(c);
    await settle();
    await c.search("rice");
    await c.category("00000000-0000-4000-8000-000000000003");
    vi.mocked(api.products).mockClear();

    await c.resetFilters();

    expect(c.getSnapshot().q).toBe("");
    expect(c.getSnapshot().categoryId).toBeUndefined();
    expect(c.getSnapshot().page).toBe(1);
    expect(api.products).toHaveBeenCalledTimes(1);
    expect(api.products).toHaveBeenCalledWith(
      assignment,
      { page: 1, q: "", categoryId: undefined },
      expect.any(AbortSignal),
    );
    c.dispose();
  });
  it("clears catalogue on session loss and preserves read-only state", async () => {
    const { c } = setup();
    bind(c, { readOnly: true });
    await settle();
    expect(c.getSnapshot().readOnly).toBe(true);
    bind(c, { session: null });
    expect(c.getSnapshot().categories).toEqual([]);
    expect(c.getSnapshot().products).toBeNull();
    expect(c.getSnapshot().assignment).toBeNull();
    c.dispose();
  });
});

it("expires and clears state even while a catalogue response is delayed", async () => {
  vi.useFakeTimers();
  try {
    let time = now;
    let resolve!: (v: Page<Product>) => void;
    const api: CataloguePort = {
      assign: async () => assignment,
      categories: async () => page([]),
      products: vi
        .fn()
        .mockResolvedValueOnce(page([]))
        .mockImplementationOnce(() => new Promise((r) => (resolve = r))),
      detail: vi.fn(),
    };
    const c = new CatalogueController(api, () => time);
    bind(c);
    await settle();
    void c.search("pending");
    time = now + 300001;
    await vi.advanceTimersByTimeAsync(300001);
    expect(c.getSnapshot().phase).toBe("expired");
    expect(c.getSnapshot().assignment).toBeNull();
    resolve(page([]));
    await settle();
    expect(c.getSnapshot().products).toBeNull();
    c.dispose();
  } finally {
    vi.useRealTimers();
  }
});
it("keeps catalogue reads route-free while assignment provider is down", async () => {
  const { c, api } = setup();
  bind(c);
  await settle();
  vi.mocked(api.assign).mockRejectedValue(
    new CatalogueError("CUSTOMER_ASSIGNMENT_INCOMPLETE"),
  );
  await c.search("rice");
  expect(c.getSnapshot().phase).toBe("ready");
  expect(api.assign).toHaveBeenCalledTimes(1);
  c.dispose();
});
it("rejects a mismatched catalogue outlet", async () => {
  const { c } = setup({
    products: async () => ({
      ...page([]),
      meta: {
        ...page([]).meta,
        outlet: {
          ...assignment.outlet,
          id: "99999999-9999-4999-8999-999999999999",
        },
      },
    }),
  });
  bind(c);
  await settle();
  expect(c.getSnapshot().error).toBe("INVALID_RESPONSE");
  expect(c.getSnapshot().products).toBeNull();
  c.dispose();
});
it("renews an expired context on demand with the first page", async () => {
  let time = now;
  const assign = vi.fn(async () => ({
    ...assignment,
    resolvedAt: new Date(time).toISOString(),
    expiresAt: new Date(time + 300000).toISOString(),
  }));
  const api: CataloguePort = {
    assign,
    categories: async (a) => ({
      ...page([]),
      meta: { ...page([]).meta, assignmentContextExpiresAt: a.expiresAt },
    }),
    products: async (a, f) => ({
      ...page([]),
      meta: {
        ...page([]).meta,
        page: f.page,
        assignmentContextExpiresAt: a.expiresAt,
      },
    }),
    detail: vi.fn(),
  };
  const c = new CatalogueController(api, () => time);
  bind(c);
  await settle();
  await c.nextPage(2);
  time += 300001;
  await c.retry();
  expect(assign).toHaveBeenCalledTimes(2);
  expect(c.getSnapshot().page).toBe(1);
  expect(c.getSnapshot().phase).toBe("ready");
  c.dispose();
});

it("bounds profile bootstrap recovery across address-controller reload events", async () => {
  let reloads = 0;
  const api: CataloguePort = {
    assign: async () => {
      throw new CatalogueError("CUSTOMER_NOT_FOUND");
    },
    categories: vi.fn(),
    products: vi.fn(),
    detail: vi.fn(),
  };
  const c = new CatalogueController(
    api,
    () => now,
    async () => {
      reloads++;
      if (reloads < 4) {
        bind(c, { phase: "loading" });
        bind(c);
      }
    },
  );
  bind(c);
  for (let i = 0; i < 60; i++) await Promise.resolve();
  expect(reloads).toBe(1);
  expect(c.getSnapshot().error).toBe("CUSTOMER_NOT_FOUND");
  c.dispose();
});

it("rejects an older session's assignment after a new session succeeds", async () => {
  const pending: Array<(a: Assignment) => void> = [];
  const { c } = setup({
    assign: () => new Promise((resolve) => pending.push(resolve)),
  });
  bind(c);
  bind(c, { session: {} });
  pending[1]({ ...assignment, assignmentContextId: "B".repeat(42) + "A" });
  await settle();
  pending[0](assignment);
  await settle();
  expect(c.getSnapshot().assignment?.assignmentContextId).toBe(
    "B".repeat(42) + "A",
  );
  c.dispose();
});
it("rejects delayed products after the selected address changes", async () => {
  const pending: Array<(p: Page<Product>) => void> = [];
  const { c } = setup({
    assign: async (b) => ({
      ...assignment,
      customerAddressId: b.id,
      addressRowVersion: b.rowVersion,
    }),
    products: () => new Promise((resolve) => pending.push(resolve)),
  });
  bind(c);
  await settle();
  bind(c, { address: { ...address, rowVersion: 2 } });
  await settle();
  pending[1](page([]));
  await settle();
  pending[0]({ ...page([]), meta: { ...page([]).meta, total: 99 } });
  await settle();
  expect(c.getSnapshot().assignment?.addressRowVersion).toBe(2);
  expect(c.getSnapshot().products?.meta.total).toBe(0);
  c.dispose();
});
it("never browses with an inactive address or absent session", async () => {
  const { c, api } = setup();
  bind(c, { address: { ...address, status: "INACTIVE" } });
  await settle();
  expect(c.getSnapshot().phase).toBe("no-address");
  bind(c, { session: null });
  await settle();
  expect(api.assign).not.toHaveBeenCalled();
  expect(api.products).not.toHaveBeenCalled();
  c.dispose();
});

it("keeps context in memory and operates with browser persistence forbidden", async () => {
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw new Error("Browser persistence forbidden");
      },
      set() {
        throw new Error("Browser persistence forbidden");
      },
    },
  );
  vi.stubGlobal("localStorage", forbidden);
  vi.stubGlobal("sessionStorage", forbidden);
  try {
    const { c } = setup();
    bind(c);
    await settle();
    expect(c.getSnapshot().phase).toBe("ready");
    expect(c.getSnapshot().assignment?.assignmentContextId).toBe(
      assignment.assignmentContextId,
    );
    bind(c, { session: null });
    expect(c.getSnapshot().assignment).toBeNull();
    c.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});
