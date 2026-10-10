import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import fixtures from "../verification/cat-cks-align01/handoff/fixtures.json";
import quotes from "../verification/cat-cks-align01/handoff/quote-envelopes.json";
import orders from "../verification/cat-cks-align01/handoff/order-envelopes.json";
import { parseProducts, type Assignment } from "./catalogue/contracts";
import { ProductTile } from "./catalogue/components";
import { CatalogueApi } from "./catalogue/api";
import { parseQuote } from "./checkout/contracts";
import type { QuoteRequest } from "./checkout/api";
import { CartController } from "./checkout/state";
import { CartScreen } from "./checkout/components";
import { parseOrderDetail } from "./orders/contracts";
import { OrderDetailScreen } from "./orders/components";

const render = <P extends object>(component: ComponentType<P>, props: object) =>
  renderToStaticMarkup(createElement(component, props as P));
const noBarcode = (html: string, barcode: string | null) => {
  expect(html).not.toContain("Barcode");
  expect(html).not.toContain("item-barcode");
  if (barcode) expect(html).not.toContain(barcode);
};

it("retains the leading-zero barcode search query and response identity", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(fixtures.cataloguePage));
  const session = {
    withCredentials: async <T>(action: (csrf: string) => Promise<T>) =>
      action("synthetic-csrf"),
  };
  const api = new CatalogueApi("", session as never, fetcher);
  const result = await api.products(
    {
      outlet: fixtures.cataloguePage.meta.outlet,
      assignmentContextId: "A".repeat(43),
    } as Assignment,
    {
      page: 1,
      q: "0000123456789",
    },
  );
  const [input, init] = fetcher.mock.calls[0];
  expect(
    new URL(String(input), "http://local.test").searchParams.get("q"),
  ).toBe("0000123456789");
  expect(new Headers(init?.headers).get("X-CKS-Product-Contract")).toBe(
    "cks-v1",
  );
  expect(result.data[0]).toMatchObject({
    productId: fixtures.cataloguePage.data[0].productId,
    outletProductId: fixtures.cataloguePage.data[0].outletProductId,
    barcode: "0000123456789",
  });
});

it.each(["1234567890123", "0000123456789", null])(
  "keeps barcode %j internally while removing its presentation across customer item screens",
  async (barcode) => {
    const page = structuredClone(fixtures.cataloguePage);
    Object.assign(page.data[0], { barcode, name: "Rice 5kg item 123" });
    const product = parseProducts(page).data[0];
    expect(product.barcode).toBe(barcode);
    const tile = render(ProductTile, { product, onOpen() {}, onAdd() {} });
    noBarcode(tile, barcode);
    expect(tile).toContain("Rice 5kg item 123");
    expect(tile).toContain('aria-label="Add Rice 5kg item 123 to basket"');
    expect(tile).toMatch(/RM[^<]*12\.99/);

    const response = structuredClone(quotes.cks);
    Object.assign(response.data.items[0], {
      productId: product.productId,
      outletProductId: product.outletProductId,
      barcodeSnapshot: barcode,
      productNameSnapshot: "Frozen Rice 5kg item 123",
    });
    const quote = parseQuote(response);
    expect(quote.items[0].barcodeSnapshot).toBe(barcode);
    const assignment: Assignment = {
      assignmentContextId: "A".repeat(43),
      customerAddressId: "99999999-9999-4999-8999-999999999999",
      addressRowVersion: 1,
      outlet: page.meta.outlet as Assignment["outlet"],
      resolvedAt: response.data.quoteIssuedAt,
      expiresAt: response.data.quoteExpiresAt,
    };
    const create = vi.fn(async (_request: QuoteRequest, _key: string) => quote);
    const cart = new CartController(
      { create },
      { assign: async () => assignment },
      () => Date.parse(response.data.quoteIssuedAt),
    );
    cart.syncAssignment(
      {
        id: assignment.customerAddressId,
        label: "Home",
        rowVersion: 1,
      } as never,
      assignment,
    );
    cart.add(product, assignment);
    cart.setQuantity(product.outletProductId, 2);
    const draft = cart.getSnapshot();
    expect(draft.lines[0]).toMatchObject({
      outletProductId: product.outletProductId,
      quantity: 2,
      product: { productId: product.productId, barcode },
    });
    const basket = render(CartScreen, {
      state: draft,
      controller: cart,
      onBrowse() {},
    });
    noBarcode(basket, barcode);
    expect(basket).toContain("Rice 5kg item 123");
    expect(basket).toContain('aria-label="Quantity for Rice 5kg item 123"');
    expect(basket).toContain('aria-label="Increase quantity"');
    await cart.requestQuote();
    expect(create.mock.calls[0][0].items).toEqual([
      { outletProductId: product.outletProductId, quantity: 2 },
    ]);
    expect(quote.items[0]).toMatchObject({
      productId: product.productId,
      outletProductId: product.outletProductId,
      quantity: 2,
    });
    const checkout = render(CartScreen, {
      state: { ...cart.getSnapshot(), quote, quotePhase: "price-review" },
      controller: cart,
      onBrowse() {},
    });
    noBarcode(checkout, barcode);
    expect(checkout).toContain("Frozen Rice 5kg item 123");
    expect(checkout).toContain("Confirmed order lines");
    expect(checkout).toContain("Quantity 2");
    expect(checkout).toMatch(/Continue with RM[^<]*15\.45/);

    const envelope = structuredClone(orders.cks);
    Object.assign(envelope.data.items[0], {
      barcode,
      productName: "Historical Rice 5kg item 123",
    });
    const detail = parseOrderDetail(envelope);
    expect(detail.items[0].barcode).toBe(barcode);
    const order = render(OrderDetailScreen, {
      state: {
        detailPhase: "ready",
        detail,
        documentsPhase: "idle",
        receiptPhase: "idle",
        paymentReceiptPhase: "idle",
      },
      controller: {},
      onBack() {},
    });
    noBarcode(order, barcode);
    expect(order).toContain("Historical Rice 5kg item 123");
    expect(order).toContain("Quantity 2");
    expect(order).toContain("Payment summary");
  },
);
