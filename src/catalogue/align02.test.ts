import { expect, it, vi } from "vitest";
import * as contracts from "./contracts";
import { CatalogueApi, type Filter } from "./api";
import { CatalogueController } from "./state";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { syntheticAddress } from "../customer/fixtures";
import supplied from "../../verification/cat-cks-align02/handoff/serializer-fixtures.json";

const fixture = () => structuredClone(supplied);
const parent = supplied.detail.data.category.id;
const child = supplied.detail.data.subcategory.id;
const now = Date.parse(supplied.detail.meta.asOf);
const assignment: contracts.Assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: syntheticAddress.id,
  addressRowVersion: syntheticAddress.rowVersion,
  outlet: supplied.detail.meta.outlet as contracts.Outlet,
  resolvedAt: new Date(now).toISOString(),
  expiresAt: supplied.detail.meta.assignmentContextExpiresAt,
};

it("parses the unchanged mapped and historical-null serializer details", () => {
  expect(contracts.parseDetail(supplied.detail).data).toMatchObject({
    barcode: "000123",
    description: "Brand Rice 5kg",
    category: supplied.detail.data.category,
    subcategory: supplied.detail.data.subcategory,
    sellingPriceMinor: 1299,
  });
  expect(contracts.parseDetail(supplied.legacyDetail).data).toMatchObject({
    barcode: null,
    category: null,
    subcategory: null,
  });
});

it("parses a closed parent-scoped child directory without deriving labels", () => {
  expect(contracts.parseSubcategories).toBeTypeOf("function");
  expect(
    contracts.parseSubcategories(supplied.subcategories, parent).data,
  ).toEqual(supplied.subcategories.data);
});

it.each(["parent", "extra", "missing", "numeric-code", "duplicate"])(
  "rejects malformed child directory: %s",
  (kind) => {
    const f = fixture().subcategories;
    if (kind === "parent")
      f.data[0].categoryId = supplied.categories.data[1].id;
    if (kind === "extra")
      Object.assign(f.data[0], { sourceDescription: "Rice" });
    if (kind === "missing")
      delete (f.data[0] as Partial<(typeof f.data)[0]>).categoryId;
    if (kind === "numeric-code") Object.assign(f.data[0], { code: 3 });
    if (kind === "duplicate") {
      f.data.push(f.data[0]);
      f.meta.total = 2;
    }
    expect(contracts.parseSubcategories).toBeTypeOf("function");
    expect(() => contracts.parseSubcategories(f, parent)).toThrow();
  },
);

async function api(fetcher: typeof fetch) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return new CatalogueApi("", session, fetcher);
}

it("requests children and filters products with both authoritative IDs", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(supplied.subcategories))
    .mockResolvedValueOnce(Response.json(supplied.filtered));
  const client = await api(fetcher);
  expect(client.subcategories).toBeTypeOf("function");
  await client.subcategories(assignment, parent);
  await client.products(assignment, {
    page: 1,
    categoryId: parent,
    subcategoryId: child,
  });
  expect(String(fetcher.mock.calls[0][0])).toContain(
    `/categories/${parent}/subcategories?page=1&pageSize=50`,
  );
  expect(
    new Headers(fetcher.mock.calls[0][1]?.headers).get(
      "x-cks-assignment-context",
    ),
  ).toBe(assignment.assignmentContextId);
  expect(String(fetcher.mock.calls[1][0])).toContain(
    `categoryId=${parent}&subcategoryId=${child}`,
  );
  expect(
    new Headers(fetcher.mock.calls[1][1]?.headers).get(
      "x-cks-product-contract",
    ),
  ).toBe("cks-v1");
  expect(fetcher.mock.calls[0][1]?.credentials).toBe("include");
  await expect(
    client.products(assignment, { page: 1, subcategoryId: child }),
  ).rejects.toThrow();
  await expect(client.subcategories(assignment, "invalid")).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("falls back only for ALIGN01's missing child route, rejecting malformed success", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
    .mockResolvedValueOnce(Response.json({ data: [] }));
  const client = await api(fetcher);
  expect(client.subcategories).toBeTypeOf("function");
  expect(await client.subcategories(assignment, parent)).toBeNull();
  await expect(client.subcategories(assignment, parent)).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});

function controller(
  subcategories: CatalogueApi["subcategories"] = vi.fn(async () =>
    contracts.parseSubcategories(supplied.subcategories, parent),
  ),
) {
  const products = vi.fn(async (_a: contracts.Assignment, _filter: Filter) =>
    contracts.parseProducts(supplied.filtered),
  );
  const c = new CatalogueController(
    {
      assign: async () => assignment,
      categories: async () => contracts.parseCategories(supplied.categories),
      subcategories,
      products,
      detail: async () => contracts.parseDetail(supplied.detail),
    },
    () => now,
  );
  return { c, products, subcategories };
}
const bind = (c: CatalogueController) =>
  c.bind({
    session: {},
    address: { ...syntheticAddress, latitude: 5, longitude: 116 },
    phase: "ready",
    readOnly: false,
  });

it("keeps child filtering through detail/back and clears it on parent/all changes", async () => {
  const { c, products } = controller();
  try {
    await bind(c);
    await c.category(parent);
    expect(c.getSnapshot().subcategories).toEqual(supplied.subcategories.data);
    await c.subcategory(child);
    expect(products.mock.calls.at(-1)?.[1]).toMatchObject({
      categoryId: parent,
      subcategoryId: child,
    });
    await c.open(supplied.detail.data.outletProductId);
    await c.closeDetail();
    expect(c.getSnapshot().subcategoryId).toBe(child);
    expect(c.getSnapshot().detail).toBeNull();
    await c.category();
    expect(c.getSnapshot().subcategoryId).toBeUndefined();
    expect(c.getSnapshot().subcategories).toEqual([]);
    await c.category(parent);
    await c.subcategory(child);
    await c.resetFilters();
    expect(c.getSnapshot().subcategoryId).toBeUndefined();
    expect(c.getSnapshot().subcategories).toEqual([]);
  } finally {
    c.dispose();
  }
});

it("keeps category browsing on ALIGN01 without inventing children", async () => {
  const { c } = controller(vi.fn(async () => null));
  try {
    await bind(c);
    await c.category(parent);
    expect(c.getSnapshot().phase).toBe("ready");
    expect(c.getSnapshot().subcategories).toEqual([]);
    expect(c.getSnapshot().products?.data[0].barcode).toBe("000123");
  } finally {
    c.dispose();
  }
});

it("opens a product truthfully even when its former child directory is no longer available", async () => {
  const children = vi
    .fn<CatalogueApi["subcategories"]>()
    .mockResolvedValue(
      contracts.parseSubcategories(supplied.subcategories, parent),
    );
  const { c } = controller(children);
  try {
    await bind(c);
    await c.category(parent);
    await c.subcategory(child);
    children.mockResolvedValue(null);
    await c.open(supplied.detail.data.outletProductId);
    expect(c.getSnapshot().phase).toBe("ready");
    expect(c.getSnapshot().detail?.data.barcode).toBe("000123");
  } finally {
    c.dispose();
  }
});

it("fences stale child directories after a parent switch", async () => {
  let release!: (value: contracts.Page<contracts.CustomerSubcategory>) => void;
  const pending = new Promise<contracts.Page<contracts.CustomerSubcategory>>(
    (resolve) => {
      release = resolve;
    },
  );
  const { c } = controller(vi.fn(async () => pending));
  try {
    await bind(c);
    const prior = c.category(parent);
    await c.category();
    release(contracts.parseSubcategories(supplied.subcategories, parent));
    await prior;
    expect(c.getSnapshot().categoryId).toBeUndefined();
    expect(c.getSnapshot().subcategories).toEqual([]);
    expect(c.getSnapshot().phase).toBe("ready");
  } finally {
    c.dispose();
  }
});

it("rejects child selection outside its approved parent without a request", async () => {
  const { c, products } = controller();
  try {
    await bind(c);
    await c.category(parent);
    const count = products.mock.calls.length;
    expect(await c.subcategory(supplied.categories.data[1].id)).toBe(false);
    expect(products).toHaveBeenCalledTimes(count);
    expect(c.getSnapshot().subcategoryId).toBeUndefined();
  } finally {
    c.dispose();
  }
});

it.each([400, 401, 500])(
  "does not hide a child endpoint failure (%s) as ALIGN01 compatibility",
  async (status) => {
    const client = await api(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("Failure", { status })),
    );
    await expect(client.subcategories(assignment, parent)).rejects.toThrow();
  },
);

it("clears child state when the assignment expires", async () => {
  vi.useFakeTimers();
  const { c } = controller();
  try {
    await bind(c);
    await c.category(parent);
    await c.subcategory(child);
    vi.advanceTimersByTime(300001);
    expect(c.getSnapshot()).toMatchObject({
      phase: "expired",
      assignment: null,
      subcategories: [],
    });
    expect(c.getSnapshot().subcategoryId).toBeUndefined();
  } finally {
    c.dispose();
    vi.useRealTimers();
  }
});

it("accumulates parent-scoped children across directory pages", async () => {
  const first = fixture().subcategories;
  first.meta = { ...first.meta, pageSize: 1, total: 2, hasNextPage: true };
  const second = structuredClone(first);
  second.data[0].id = supplied.categories.data[1].id;
  second.data[0].name = "Other approved child";
  second.meta = { ...second.meta, page: 2, hasNextPage: false };
  const children = vi
    .fn<CatalogueApi["subcategories"]>()
    .mockResolvedValueOnce(contracts.parseSubcategories(first, parent))
    .mockResolvedValueOnce(contracts.parseSubcategories(second, parent));
  const { c } = controller(children);
  try {
    await bind(c);
    await c.category(parent);
    expect(c.getSnapshot().subcategories.map((s) => s.name)).toEqual([
      "Rice",
      "Other approved child",
    ]);
    expect(children.mock.calls.map((call) => call[2]?.page)).toEqual([1, 2]);
  } finally {
    c.dispose();
  }
});

it("rejects products outside the selected child instead of showing a misleading match", async () => {
  const { c, products } = controller();
  try {
    await bind(c);
    await c.category(parent);
    const invalid = fixture().filtered;
    invalid.data[0].subcategory.id = supplied.categories.data[1].id;
    products.mockResolvedValueOnce(contracts.parseProducts(invalid));
    await c.subcategory(child);
    expect(c.getSnapshot().phase).toBe("error");
    expect(c.getSnapshot().error).toBe("INVALID_RESPONSE");
    expect(c.getSnapshot().products).toBeNull();
  } finally {
    c.dispose();
  }
});

it("keeps a valid empty browse result usable after a selected child becomes inactive", async () => {
  const children = vi
    .fn<CatalogueApi["subcategories"]>()
    .mockResolvedValue(
      contracts.parseSubcategories(supplied.subcategories, parent),
    );
  const { c, products } = controller(children);
  try {
    await bind(c);
    await c.category(parent);
    await c.subcategory(child);
    children.mockResolvedValue({
      data: [],
      meta: { ...supplied.subcategories.meta, total: 0 } as contracts.PageMeta,
    });
    products.mockResolvedValue(contracts.parseProducts(supplied.wrongParent));
    await c.retry();
    expect(c.getSnapshot().phase).toBe("ready");
    expect(c.getSnapshot().products?.data).toEqual([]);
    expect(c.getSnapshot().categories).toEqual(supplied.categories.data);
    expect(c.getSnapshot().error).toBeNull();
    await c.category(parent);
    expect(c.getSnapshot().subcategoryId).toBeUndefined();
  } finally {
    c.dispose();
  }
});
