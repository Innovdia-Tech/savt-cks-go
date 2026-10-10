import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fixtures from "../verification/cat-cks-align01/handoff/fixtures.json";
import quotes from "../verification/cat-cks-align01/handoff/quote-envelopes.json";
import orders from "../verification/cat-cks-align01/handoff/order-envelopes.json";
import joint from "../verification/cat-cks-align01/joint-envelopes.json";
import {
  parseProducts,
  parseDetail,
  type Assignment,
} from "./catalogue/contracts";
import { ProductTile } from "./catalogue/components";
import { CatalogueApi } from "./catalogue/api";
import { parseQuote } from "./checkout/contracts";
import { QuoteApi, type QuoteRequest } from "./checkout/api";
import { CartController } from "./checkout/state";
import { CartScreen } from "./checkout/components";
import { parseOrderDetail } from "./orders/contracts";
import { OrdersApi } from "./orders/api";
import { OrderDetailScreen } from "./orders/components";

const assignment: Assignment = {
  assignmentContextId: "A".repeat(43),
  customerAddressId: "99999999-9999-4999-8999-999999999999",
  addressRowVersion: 1,
  outlet: fixtures.cataloguePage.meta.outlet as Assignment["outlet"],
  resolvedAt: "2026-09-03T06:00:00.000Z",
  expiresAt: "2026-09-03T06:05:00.000Z",
};
const render = <P extends object>(component: ComponentType<P>, props: object) =>
  renderToStaticMarkup(createElement(component, props as P));
const itemText = (html: string) => html.replace(/<[^>]*>/g, " ");

describe("CAT-CKS-ALIGN01 exact serializer contracts", () => {
  it("retains the accepted pre-R3 processing minimum repair for the exact legacy quote", () => {
    expect(parseQuote(quotes.legacy).processingFee).toHaveProperty(
      "minimumAmountMinor",
      null,
    );
    expect(parseQuote(quotes.legacy).grandTotalMinor).toBe(1545);
  });
  it("accepts minimal CKS catalogue with truthful null retired attributes", () => {
    const product = parseProducts(fixtures.cataloguePage).data[0];
    expect(product).toMatchObject({
      name: "Brand Rice 5kg",
      barcode: "0000123456789",
      category: null,
      uom: null,
    });
    expect(parseDetail(fixtures.catalogueDetail).data.storageType).toBeNull();
  });
  it("accepts the exact CKS quote and order snapshots without rewriting totals", () => {
    expect(parseQuote(quotes.cks).items[0]).toMatchObject({
      barcodeSnapshot: "0000123456789",
      uomCodeSnapshot: null,
      uomNameSnapshot: null,
    });
    expect(parseOrderDetail(orders.cks).items[0].barcode).toBe("0000123456789");
    expect(parseQuote(quotes.cks).grandTotalMinor).toBe(
      quotes.cks.data.grandTotalMinor,
    );
  });
  it("retains closed legacy catalogue and order alternatives", () => {
    expect(parseProducts(fixtures.legacyCataloguePage).data[0].name).toBe(
      "Fresh Milk",
    );
    expect(parseDetail(fixtures.legacyCatalogueDetail).data.storageType).toBe(
      "CHILLED",
    );
    expect(parseOrderDetail(orders.legacy).items[0]).not.toHaveProperty(
      "barcode",
    );
  });
  it.each([123, "", " ", "x".repeat(81), {}, false])(
    "rejects malformed barcode %j",
    (barcode) => {
      const page = structuredClone(fixtures.cataloguePage);
      Object.assign(page.data[0], { barcode });
      expect(() => parseProducts(page)).toThrow();
      const quote = structuredClone(quotes.cks);
      Object.assign(quote.data.items[0], { barcodeSnapshot: barcode });
      expect(() => parseQuote(quote)).toThrow();
      const order = structuredClone(orders.cks);
      Object.assign(order.data.items[0], { barcode });
      expect(() => parseOrderDetail(order)).toThrow();
    },
  );
  it("rejects unknown keys, missing contract keys, unpaired UOM and legacy null dependencies", () => {
    const quote = structuredClone(quotes.cks);
    Object.assign(quote.data.items[0], { uomCodeSnapshot: "EA" });
    expect(() => parseQuote(quote)).toThrow();
    const order = structuredClone(orders.cks);
    Object.assign(order.data.items[0], { uomName: null });
    expect(() => parseOrderDetail(order)).toThrow();
    const page = structuredClone(fixtures.cataloguePage);
    Object.assign(page.data[0], { internalSku: "secret" });
    expect(() => parseProducts(page)).toThrow();
    const missing = structuredClone(fixtures.cataloguePage);
    Reflect.deleteProperty(missing.data[0], "uom");
    expect(() => parseProducts(missing)).toThrow();
    const legacy = structuredClone(fixtures.legacyCataloguePage);
    Object.assign(legacy.data[0], { uom: null });
    expect(() => parseProducts(legacy)).toThrow();
  });
});

describe("CAT-CKS-ALIGN01 actual item screens", () => {
  it("displays the assigned outlet price and totals captured from the actual joint backend run", () => {
    const product = parseDetail(joint.detail).data;
    expect(product.sellingPriceMinor).toBe(1299);
    const tile = render(ProductTile, { product, onOpen() {}, onAdd() {} });
    expect(tile).toMatch(/RM[^<]*12\.99/);
    const quote = parseQuote({ data: joint.quote });
    const products = parseProducts(joint.catalogue).data;
    const html = render(CartScreen, {
      state: {
        lines: quote.items.map((item) => ({
          outletId: joint.detail.meta.outlet.id,
          outletProductId: item.outletProductId,
          product: products.find(
            (p) => p.outletProductId === item.outletProductId,
          ),
          quantity: item.quantity,
          displayedUnitPriceMinor: item.unitPriceMinor,
          currency: "MYR",
        })),
        assignment: {
          outletId: joint.detail.meta.outlet.id,
          outletDisplayName: joint.detail.meta.outlet.displayName,
          addressLabel: "Synthetic home",
        },
        quote,
        quotePhase: "ready",
        transitionPhase: "idle",
        paymentFrozen: false,
      },
      controller: {},
      onBrowse() {},
    });
    expect(html).not.toContain("Barcode");
    expect(html).not.toContain("0001234567890");
    expect(html).toMatch(/RM[^<]*12\.99/);
    expect(html).toMatch(/RM[^<]*37\.06/);
    expect(html).not.toMatch(/RM[^<]*29\.99/);
  });
  it.each([null, undefined])(
    "never fills a missing accepted barcode from the draft (%j)",
    (barcodeSnapshot) => {
      const quote = structuredClone(quotes.legacy);
      if (barcodeSnapshot === null)
        Object.assign(quote.data.items[0], { barcodeSnapshot });
      const accepted = parseQuote(quote);
      const item = accepted.items[0];
      const html = render(CartScreen, {
        state: {
          lines: [
            {
              outletId: assignment.outlet.id,
              outletProductId: item.outletProductId,
              product: {
                productId: item.productId,
                name: "Changed master",
                barcode: "0000999",
                imageUrl: null,
                uom: null,
                packSize: null,
              },
              quantity: item.quantity,
              displayedUnitPriceMinor: 7777,
              currency: "MYR",
            },
          ],
          assignment: {
            outletId: assignment.outlet.id,
            outletDisplayName: "Synthetic outlet",
            addressLabel: "Home",
          },
          quote: accepted,
          quotePhase: "ready",
          transitionPhase: "idle",
          paymentFrozen: false,
        },
        controller: {},
        onBrowse() {},
      });
      expect(html).toContain("Frozen product");
      expect(html).not.toContain("Barcode");
      expect(html).not.toContain("0000999");
      expect(html).not.toContain("Changed master");
      expect(html).toMatch(/RM[^<]*5\.00/);
      expect(html).toMatch(/RM[^<]*10\.00/);
    },
  );
  it.each([fixtures.legacyCataloguePage, fixtures.cataloguePage])(
    "renders product identification and assigned-outlet price",
    (envelope) => {
      const product = parseProducts(envelope).data[0];
      const html = render(ProductTile, { product, onOpen() {}, onAdd() {} });
      expect(html).toContain(product.name);
      expect(html).toMatch(/RM[^<]*12\.99/);
      expect(html).not.toContain("Barcode");
      expect(html).not.toContain("item-barcode");
      if (product.barcode) expect(html).not.toContain(product.barcode);
      expect(itemText(html)).not.toMatch(
        /Each|Farm|1 L|AUTO-|44444444|22222222/,
      );
    },
  );
  it("uses catalogue identity for draft basket and frozen quote identity after acceptance", async () => {
    const product = parseProducts(fixtures.cataloguePage).data[0];
    const response = structuredClone(quotes.cks);
    Object.assign(response.data.items[0], {
      outletProductId: product.outletProductId,
      unitPriceMinor: 1299,
      quantity: 1,
      lineSubtotalMinor: 1299,
    });
    Object.assign(response.data, {
      itemsSubtotalMinor: 1299,
      netItemsTotalMinor: 1299,
      processingFeeBasisMinor: 1799,
      grandTotalMinor: 1844,
    });
    const create = vi.fn(async (_request: QuoteRequest, _key: string) =>
      parseQuote(response),
    );
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
    const draft = render(CartScreen, {
      state: cart.getSnapshot(),
      controller: cart,
      onBrowse() {},
    });
    expect(draft).not.toContain("Barcode");
    expect(draft).not.toContain("0000123456789");
    await cart.requestQuote();
    expect(create.mock.calls[0][0].items).toEqual([
      { outletProductId: product.outletProductId, quantity: 1 },
    ]);
    const current = cart.getSnapshot();
    const changedDraft = {
      ...current,
      lines: current.lines.map((line) => ({
        ...line,
        product: { ...line.product, name: "Changed master", barcode: "999999" },
      })),
    };
    const accepted = render(CartScreen, {
      state: changedDraft,
      controller: cart,
      onBrowse() {},
    });
    expect(accepted).toContain("Brand Rice 5kg");
    expect(accepted).not.toContain("Barcode");
    expect(accepted).not.toContain("0000123456789");
    expect(accepted).not.toContain("Changed master");
    expect(accepted).not.toContain("999999");
  });
  it.each(["legacy", "cks", "historical"])(
    "renders %s order identity without fallback metadata",
    (mode) => {
      const envelope = structuredClone(
        mode === "legacy" ? orders.legacy : orders.cks,
      );
      if (mode === "historical")
        Object.assign(envelope.data.items[0], {
          barcode: null,
          uomCode: null,
          uomName: null,
        });
      const detail = parseOrderDetail(envelope);
      const html = render(OrderDetailScreen, {
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
      expect(html).toContain("Frozen product name");
      expect(itemText(html)).not.toMatch(/OLD-SKU|Each|88888888/);
      expect(html).not.toContain("Barcode");
      expect(html).not.toContain("0000123456789");
    },
  );
});

it("opts in at actual product APIs while retaining fee capability and request IDs", async () => {
  const requests: Array<{ path: string; headers: Headers }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input);
    requests.push({ path, headers: new Headers(init?.headers) });
    const response = path.includes("checkout")
      ? quotes.legacy
      : path.includes("orders")
        ? orders.legacy
        : path.endsWith(fixtures.cataloguePage.data[0].outletProductId)
          ? fixtures.legacyCatalogueDetail
          : fixtures.legacyCataloguePage;
    return new Response(JSON.stringify(response));
  };
  const session = {
    withCredentials: async <T>(action: (csrf: string) => Promise<T>) =>
      action("synthetic-csrf"),
  };
  const catalogue = new CatalogueApi("", session as never, fetcher);
  await catalogue.products(assignment, { page: 1 });
  await catalogue.detail(
    assignment,
    fixtures.cataloguePage.data[0].outletProductId,
  );
  await new QuoteApi("", session as never, fetcher).create(
    {
      outletId: assignment.outlet.id,
      customerAddressId: assignment.customerAddressId,
      deliveryType: "NOW",
      items: [
        {
          outletProductId: quotes.legacy.data.items[0].outletProductId,
          quantity: 2,
        },
      ],
    },
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  await new OrdersApi("", session as never, fetcher).detail(
    orders.legacy.data.orderId,
  );
  expect(requests).toHaveLength(4);
  for (const request of requests)
    expect(request.headers.get("X-CKS-Product-Contract")).toBe("cks-v1");
  for (const request of requests.slice(2))
    expect(request.headers.get("X-CKS-Fee-Contract")).toBe(
      "small-order-fee-v1",
    );
});
