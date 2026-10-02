import { it, expect } from "vitest";
import { DevelopmentCatalogueAdapter } from "./development";
import { CatalogueApi } from "./api";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { QuoteApi } from "../checkout/api";
import { PaymentApi } from "../payment/api";
import { OrdersApi } from "../orders/api";
import { homeCategories } from "./shopping";
const address = { id: "22222222-2222-4222-8222-222222222222", rowVersion: 1 };
async function setup(scenario = "success", now = Date.now) {
  const adapter = new DevelopmentCatalogueAdapter(false, now);
  adapter.reset(scenario);
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return {
    adapter,
    api: new CatalogueApi("", session, adapter.fetch, 10),
    quote: new QuoteApi("", session, adapter.fetch, 10),
    payment: new PaymentApi("", session, adapter.fetch, 10),
    orders: new OrdersApi("", session, adapter.fetch, 10),
  };
}
it("cannot construct a production fixture adapter", () =>
  expect(() => new DevelopmentCatalogueAdapter(true)).toThrow());
it("uses a moved synthetic pin to demonstrate no coverage for only that saved address", async () => {
  const { adapter, api } = await setup();
  adapter.setAddressLookup((id) =>
    id === address.id ? { latitude: 5.9186, longitude: 116.082 } : undefined,
  );
  await expect(api.assign(address)).rejects.toMatchObject({
    code: "CUSTOMER_NO_SERVICEABLE_OUTLET",
  });
  await expect(
    api.assign({ id: "44444444-4444-4444-8444-444444444444", rowVersion: 1 }),
  ).resolves.toMatchObject({ outlet: { availability: "AVAILABLE" } });
});
it("uses a second synthetic pin for a different authoritative outlet", async () => {
  const { adapter, api } = await setup();
  adapter.setAddressLookup(() => ({ latitude: 5.9186, longitude: 116.0816 }));
  const assigned = await api.assign(address);
  expect(assigned.outlet.displayReference).toBe("DEMO-02");
});
it("supplies strict paginated data, development artwork URLs and detail", async () => {
  const { api } = await setup();
  const a = await api.assign(address);
  const p = await api.products(a, { page: 1 });
  const next = await api.products(a, { page: 2 });
  expect(p.data).toHaveLength(24);
  expect(p.meta.total).toBe(30);
  expect(next.data).toHaveLength(6);
  expect(p.data[0].imageUrl).toMatch(
    /^https:\/\/cks-go-development\.invalid\/artwork\//,
  );
  expect((await api.categories(a)).data.length).toBeGreaterThan(0);
  expect(
    (await api.detail(a, p.data[0].outletProductId)).data.description,
  ).toBeTruthy();
  expect((await api.products(a, { page: 1, q: "no match" })).data).toEqual([]);
  expect((await api.products(a, { page: 1, q: "%" })).data).toEqual([]);
});
it("preserves the missing-image fixture for fallback review", async () => {
  const { api } = await setup("null-images");
  const assignment = await api.assign(address);
  expect(
    (await api.products(assignment, { page: 1 })).data[0].imageUrl,
  ).toBeNull();
});
it("provides a development-only mixed card alignment scenario", async () => {
  const { api } = await setup("card-alignment");
  const assignment = await api.assign(address);
  const products = (await api.products(assignment, { page: 1 })).data;
  expect(products[0].name).toBe("Synthetic long-name apples sample pack");
  expect(products[1].name).toBe("Rice 02");
  expect(products[3].availability).toBe("UNAVAILABLE");
});
it("provides a local shopping acceptance catalogue with the four preferred categories", async () => {
  const { api } = await setup("cust-shop01");
  const assignment = await api.assign(address);
  const categories = (await api.categories(assignment)).data;
  expect(categories.map(({ name }) => name)).toEqual([
    "Fresh Produce",
    "Household",
    "Frozen",
    "Beverages",
    "Pantry",
  ]);
  const selected = await api.products(assignment, {
    page: 1,
    categoryId: categories[0].id,
  });
  expect(selected.data.length).toBeGreaterThan(0);
  expect(
    selected.data.every((product) => product.category.id === categories[0].id),
  ).toBe(true);
});
it("omits unavailable Frozen from the local customer-visible category response", async () => {
  const { api } = await setup("cust-shop01-no-frozen");
  const assignment = await api.assign(address);
  const categories = (await api.categories(assignment)).data;
  expect(categories.map(({ name }) => name)).toEqual([
    "Fresh Produce",
    "Household",
    "Beverages",
    "Pantry",
  ]);
  const products = (await api.products(assignment, { page: 1 })).data;
  expect(products.every((product) => product.category.name !== "Frozen")).toBe(
    true,
  );
});
it("exposes five active directory entries while empty preferred categories stay on Home", async () => {
  const { api } = await setup("cust-shop01r");
  const assignment = await api.assign(address);
  const directory = (await api.categories(assignment)).data;
  expect(directory.map(({ code, name }) => [code, name])).toEqual([
    ["004", "Beverages"],
    ["OTHER_CATEGORY", "Snacks"],
    ["003", "Frozen Food"],
    ["002", "Household Essentials"],
    ["001", "Fresh Fruits & Vegetables"],
  ]);
  expect(homeCategories(directory).map(({ code }) => code)).toEqual([
    "001",
    "002",
    "003",
    "004",
  ]);
  for (const code of ["001", "003"]) {
    const category = directory.find((item) => item.code === code);
    expect(category).toBeDefined();
    expect(
      (await api.products(assignment, { page: 1, categoryId: category!.id }))
        .data,
    ).toEqual([]);
  }
  expect(
    (await api.products(assignment, { page: 1, categoryId: directory[1].id }))
      .data.length,
  ).toBeGreaterThan(0);
});
it("removes inactive Frozen from the synthetic directory and Home without a dead tile", async () => {
  const { api } = await setup("cust-shop01r-no-frozen");
  const assignment = await api.assign(address);
  const directory = (await api.categories(assignment)).data;
  expect(directory.map(({ code }) => code)).not.toContain("003");
  expect(homeCategories(directory).map(({ code }) => code)).toEqual([
    "001",
    "002",
    "004",
  ]);
});
it("provides local portrait, wide, transparent, missing and failed image cases", async () => {
  const { api } = await setup("cust-shop01-images");
  const assignment = await api.assign(address);
  const products = (await api.products(assignment, { page: 1 })).data;
  expect(products.slice(0, 5).map((product) => product.imageUrl)).toEqual([
    "https://cks-go-development.invalid/artwork/portrait.svg",
    "https://cks-go-development.invalid/artwork/wide.svg",
    "https://cks-go-development.invalid/artwork/transparent.svg",
    null,
    "https://cks-go-development.invalid/artwork/failed.svg",
  ]);
  expect(
    (await api.categories(assignment)).data.map((category) => category.name),
  ).toEqual(["Fresh Produce", "Household", "Frozen", "Beverages", "Pantry"]);
});
it("maps the supplied reference sample through the existing catalogue, quote and order contracts", async () => {
  const { api, quote, orders } = await setup("ux03-reference-match");
  const assignment = await api.assign(address);
  const categories = await api.categories(assignment);
  expect(categories.data.map((category) => category.name)).toEqual([
    "Fruits & Vegetables",
    "Meat & Seafood",
    "Dairy & Chilled",
    "Pantry Essentials",
  ]);
  const home = await api.products(assignment, { page: 1 });
  expect(home.data.slice(0, 2).map((product) => product.name)).toEqual([
    "Cavendish Banana",
    "Red Apple",
  ]);
  expect(home.meta.total).toBe(7);
  expect(home.data[1].imageUrl).toBe(
    "https://cks-go-development.invalid/reference-match/red-apple.png",
  );
  const listing = await api.products(assignment, {
    page: 1,
    categoryId: categories.data[0].id,
  });
  expect(listing.data.slice(0, 6).map((product) => product.name)).toEqual([
    "Red Apple",
    "Orange",
    "Broccoli",
    "Carrot",
    "Tomato",
    "Potato",
  ]);
  const lines = ["Red Apple", "Carrot", "Potato"].map((name) => ({
    outletProductId: home.data.find((product) => product.name === name)!
      .outletProductId,
    quantity: 1,
  }));
  const reviewed = await quote.create(
    {
      outletId: assignment.outlet.id,
      customerAddressId: address.id,
      deliveryType: "NOW",
      items: lines,
    },
    crypto.randomUUID(),
  );
  expect([
    reviewed.itemsSubtotalMinor,
    reviewed.finalDeliveryChargeMinor,
    reviewed.processingFeeMinor,
    reviewed.grandTotalMinor,
  ]).toEqual([1260, 490, 50, 1800]);
  const listed = (await orders.list()).data[0];
  const detail = await orders.detail(listed.orderId);
  expect(listed).toMatchObject({
    orderNumber: "CKS100123",
    grandTotalMinor: 1800,
  });
  expect(detail.items.map((item) => item.productName)).toEqual([
    "Red Apple",
    "Carrot",
    "Potato",
  ]);
  expect(detail.money.grandTotalMinor).toBe(reviewed.grandTotalMinor);
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

it("keeps the longer-price acceptance fixture explicit and formatter-compatible", async () => {
  const { api } = await setup("long-price");
  const assignment = await api.assign(address);
  const products = await api.products(assignment, { page: 1 });
  expect(
    products.data.find((product) => product.name === "Apples 01"),
  ).toMatchObject({
    sellingPriceMinor: 123450,
    currency: "MYR",
  });
});

it("assigns deterministic same and different outlets for address-transition acceptance", async () => {
  const { api } = await setup();
  const home = await api.assign(address);
  const same = await api.assign({
    id: "44444444-4444-4444-8444-444444444444",
    rowVersion: 1,
  });
  const other = await api.assign({
    id: "55555555-5555-4555-8555-555555555555",
    rowVersion: 1,
  });
  expect(same.outlet.id).toBe(home.outlet.id);
  expect(other.outlet.id).not.toBe(home.outlet.id);
});

it("creates a strict trusted quote from authoritative fixture prices", async () => {
  const { api, quote } = await setup();
  const a = await api.assign(address);
  const item = (await api.products(a, { page: 1 })).data[0];
  const result = await quote.create(
    {
      outletId: a.outlet.id,
      customerAddressId: address.id,
      deliveryType: "NOW",
      items: [{ outletProductId: item.outletProductId, quantity: 2 }],
    },
    crypto.randomUUID(),
  );
  expect(result.items[0]).toMatchObject({
    outletProductId: item.outletProductId,
    quantity: 2,
    unitPriceMinor: item.sellingPriceMinor,
  });
  expect(result.grandTotalMinor).toBe(
    result.itemsSubtotalMinor +
      result.finalDeliveryChargeMinor +
      result.processingFeeMinor,
  );
});

it.each([
  ["quote-stock-changed", "CHECKOUT_INSUFFICIENT_STOCK"],
  ["quote-unavailable", "CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE"],
  ["quote-assignment-mismatch", "CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH"],
  ["quote-address-changed", "CUSTOMER_ADDRESS_CHANGED"],
])("provides deterministic %s quote failure", async (scenario, code) => {
  const { api, quote } = await setup(scenario);
  const a = await api.assign(address);
  const item = (await api.products(a, { page: 1 })).data[0];
  await expect(
    quote.create(
      {
        outletId: a.outlet.id,
        customerAddressId: address.id,
        deliveryType: "NOW",
        items: [{ outletProductId: item.outletProductId, quantity: 2 }],
      },
      crypto.randomUUID(),
    ),
  ).rejects.toMatchObject({ code });
});

it("returns a higher authoritative price in the price-change scenario", async () => {
  const { api, quote } = await setup("quote-price-changed");
  const a = await api.assign(address);
  const item = (await api.products(a, { page: 1 })).data[0];
  const result = await quote.create(
    {
      outletId: a.outlet.id,
      customerAddressId: address.id,
      deliveryType: "NOW",
      items: [{ outletProductId: item.outletProductId, quantity: 1 }],
    },
    crypto.randomUUID(),
  );
  expect(result.items[0].unitPriceMinor).toBeGreaterThan(
    item.sellingPriceMinor,
  );
});

it("simulates payment only through the CKS Go endpoints and keeps finality observational", async () => {
  const { adapter, api, quote, payment, orders } = await setup();
  const assignment = await api.assign(address);
  const item = (await api.products(assignment, { page: 1 })).data[0];
  const trusted = await quote.create(
    {
      outletId: assignment.outlet.id,
      customerAddressId: address.id,
      deliveryType: "NOW",
      items: [{ outletProductId: item.outletProductId, quantity: 1 }],
    },
    crypto.randomUUID(),
  );
  const created = await payment.create(
    trusted.quoteId,
    trusted.quoteToken,
    crypto.randomUUID(),
  );
  expect(created).toMatchObject({
    checkoutReference: trusted.quoteId,
    payment: { status: "PENDING" },
  });
  expect(created.payment.checkoutUrl).toMatch(/^https:\/\//);

  adapter.setPaymentResult("processing");
  await expect(
    payment.result(created.payment.paymentIntentId),
  ).resolves.toMatchObject({
    status: "PAID_PROCESSING",
    order: null,
  });
  adapter.setPaymentResult("paid");
  await expect(
    payment.result(created.payment.paymentIntentId),
  ).resolves.toMatchObject({
    status: "PAID",
    order: { orderNumber: "SYNTH-ORDER-0001" },
  });
  const completed = (await orders.list()).data[0];
  const detail = await orders.detail(completed.orderId);
  expect(completed.grandTotalMinor).toBe(trusted.grandTotalMinor);
  expect(detail.money.grandTotalMinor).toBe(trusted.grandTotalMinor);
  expect(detail.items).toMatchObject([
    {
      productName: item.name,
      orderedQuantity: 1,
      lineTotalMinor: trusted.items[0].lineSubtotalMinor,
    },
  ]);
  expect(adapter.paymentMetrics()).toEqual({
    creates: 1,
    results: 2,
    directProviderCalls: 0,
    browserOrderPosts: 0,
  });
});

it("provides a malformed paid-without-order fixture for fail-closed acceptance", async () => {
  const { adapter, api, quote, payment } = await setup();
  const assignment = await api.assign(address);
  const item = (await api.products(assignment, { page: 1 })).data[0];
  const trusted = await quote.create(
    {
      outletId: assignment.outlet.id,
      customerAddressId: address.id,
      deliveryType: "NOW",
      items: [{ outletProductId: item.outletProductId, quantity: 1 }],
    },
    crypto.randomUUID(),
  );
  const created = await payment.create(
    trusted.quoteId,
    trusted.quoteToken,
    crypto.randomUUID(),
  );
  adapter.setPaymentResult("paid-no-order");
  await expect(
    payment.result(created.payment.paymentIntentId),
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
});

it("provides strict customer order history and detail fixtures", async () => {
  const { orders } = await setup();
  const history = await orders.list();
  expect(history.data[0]).toMatchObject({
    orderNumber: "SYNTH-ORDER-0001",
    customerStage: "ORDER_RECEIVED",
    paymentStatus: "PAID",
  });
  const order = await orders.detail(history.data[0].orderId);
  expect(order).toMatchObject({
    orderNumber: "SYNTH-ORDER-0001",
    customerStage: "ORDER_RECEIVED",
    canCancel: true,
  });
  expect(JSON.stringify(order)).not.toContain("riderPhone");
});

it("can show recovery after a failed synthetic payment status request", async () => {
  const { adapter, api, quote, payment } = await setup();
  const assignment = await api.assign(address);
  const item = (await api.products(assignment, { page: 1 })).data[0];
  const trusted = await quote.create(
    {
      outletId: assignment.outlet.id,
      customerAddressId: address.id,
      deliveryType: "NOW",
      items: [{ outletProductId: item.outletProductId, quantity: 1 }],
    },
    crypto.randomUUID(),
  );
  const created = await payment.create(
    trusted.quoteId,
    trusted.quoteToken,
    crypto.randomUUID(),
  );
  adapter.setPaymentResult("status-error");
  await expect(
    payment.result(created.payment.paymentIntentId),
  ).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  });
  adapter.setPaymentResult("pending");
  await expect(
    payment.result(created.payment.paymentIntentId),
  ).resolves.toMatchObject({
    status: "PENDING",
  });
});

it("keeps synthetic order times stable between history and detail", async () => {
  let now = Date.parse("2026-09-28T05:00:00.000Z");
  const { orders } = await setup("success", () => now);
  const summary = (await orders.list()).data[0];
  now += 60_000;
  const detail = await orders.detail(summary.orderId);
  expect(detail.createdAt).toBe(summary.createdAt);
  expect(detail.updatedAt).toBe(summary.updatedAt);
});

it("provides empty, delivered, and receipt-ready order acceptance states", async () => {
  const { adapter, orders } = await setup();
  adapter.setOrderScenario("empty");
  expect((await orders.list()).data).toEqual([]);
  adapter.setOrderScenario("delivered");
  expect((await orders.list()).data[0].customerStage).toBe("DELIVERED");
  adapter.setOrderScenario("receipt-ready");
  const history = await orders.list();
  const order = await orders.detail(history.data[0].orderId);
  expect(order.receipt.receiptAvailable).toBe(true);
  const pdf = await orders.downloadReceipt(
    order.orderId,
    order.receipt.downloadPath!,
  );
  expect(pdf.type).toBe("application/pdf");
  expect(pdf.size).toBeGreaterThan(0);
});

it("provides explicit customer-stage and paginated order review fixtures", async () => {
  const { adapter, orders } = await setup();
  adapter.setOrderScenario("preparing" as never);
  expect((await orders.list()).data[0].customerStage).toBe("PICK_AND_PACK");
  adapter.setOrderScenario("out-for-delivery" as never);
  expect((await orders.list()).data[0].customerStage).toBe("OUT_FOR_DELIVERY");
  adapter.setOrderScenario("mixed" as never);
  const mixed = await orders.list();
  expect(mixed.data.map((order) => order.customerStage)).toEqual([
    "ORDER_RECEIVED",
    "DELIVERED",
  ]);
  adapter.setOrderScenario("multi-page" as never);
  const first = await orders.list(1, 25);
  const second = await orders.list(2, 25);
  expect(first.meta.totalPages).toBe(2);
  expect(first.data[0].customerStage).toBe("DELIVERED");
  expect(second.data[0].customerStage).toBe("OUT_FOR_DELIVERY");
});

it("keeps order totals accurate when a requested page is now empty", async () => {
  const { adapter, orders } = await setup();
  adapter.setOrderScenario("cancelled");
  const page = await orders.list(2, 25);
  expect(page.data).toEqual([]);
  expect(page.meta.total).toBe(1);
  expect(page.meta.totalPages).toBe(1);
});

it("keeps historical cancelled Orders readable without a customer cancel command", async () => {
  const { adapter, orders } = await setup();
  adapter.setOrderScenario("cancelled");
  const order = (await orders.list()).data[0];
  expect(order).toMatchObject({
    customerStage: "CANCELLED",
    canCancel: false,
  });
  expect(await orders.detail(order.orderId)).toMatchObject({
    customerStage: "CANCELLED",
    refund: { refundRequired: true },
  });
  expect("cancel" in orders).toBe(false);
  expect(adapter.paymentMetrics().browserOrderPosts).toBe(0);
});
