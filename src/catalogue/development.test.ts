import { it, expect } from "vitest";
import { DevelopmentCatalogueAdapter } from "./development";
import { CatalogueApi } from "./api";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { QuoteApi } from "../checkout/api";
import { PaymentApi } from "../payment/api";
import { OrdersApi } from "../orders/api";
const address = { id: "22222222-2222-4222-8222-222222222222", rowVersion: 1 };
async function setup(scenario = "success") {
  const adapter = new DevelopmentCatalogueAdapter(false);
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

it("cancels through only the customer cancel command and retains zero browser Order creation", async () => {
  const { adapter, orders } = await setup();
  const order = (await orders.list()).data[0];
  await expect(
    orders.cancel(order.orderId, crypto.randomUUID()),
  ).resolves.toMatchObject({
    customerStage: "CANCELLED",
    refundRequired: true,
  });
  expect((await orders.detail(order.orderId)).customerStage).toBe("CANCELLED");
  expect(adapter.paymentMetrics().browserOrderPosts).toBe(0);
});
