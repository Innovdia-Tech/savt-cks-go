// LOCAL ONLY. Actual built React app and its actual same-origin runtime proxy.
// HTTP backend, session/customer/address/native save acknowledgment are synthetic.
// Original handoff bytes and static renderer PDF are kept unchanged.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  readFile,
  writeFile,
  mkdir,
  access,
  readdir,
  unlink,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, join } from "node:path";

const phase = process.argv[2];
assert(
  ["before", "after"].includes(phase),
  "Run with before or after argument",
);
const repository = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const baseline =
  "C:/Users/isaac/Documents/ChatGPT/CKS GO/exports/fe-final01/customer-cat-cks-align02";
const appRepository = phase === "before" ? baseline : repository;
const outputRoot = fileURLToPath(new URL("./browser/", import.meta.url));
const output = join(outputRoot, phase);
const handoff = fileURLToPath(new URL("./handoff/", import.meta.url));
const { createCustomerServer } = await import(
  pathToFileURL(join(appRepository, "runtime/server.mjs"))
);
const { chromium } = createRequire(import.meta.url)(
  "C:/Users/isaac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashes = {};
async function supplied(name, json = true) {
  const bytes = await readFile(join(handoff, name));
  hashes[name] = sha256(bytes);
  return json ? JSON.parse(bytes.toString("utf8")) : bytes;
}
const [catalogue, quotes, orders, classification, pdf] = await Promise.all([
  supplied("fixtures.json"),
  supplied("quote-envelopes.json"),
  supplied("order-envelopes.json"),
  supplied("align02-serializer-fixtures.json"),
  supplied("final-sales-receipt.pdf", false),
]);
const expectedBaselineTree = "efe1073fb69e0ce4cafac2f33f3e5b6645f84a27";
const git = (directory, ...args) =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
assert.equal(
  git(baseline, "rev-parse", "HEAD^{tree}"),
  expectedBaselineTree,
  "Frozen BEFORE source tree pin",
);
const clone = (value) => structuredClone(value);
const addressId = "99999999-9999-4999-8999-999999999999";
const csrf = "S".repeat(43);
const leadingZero = "0000123456789";
const normalBarcode = "9556234000012";
const description = "Rice 5kg. Cooking time 20 minutes; batch 2026.";
const observations = [];
const screenChecks = [];
const receipts = [];
const screenshots = [];
const responseChecks = [];
const errors = [];
const unexpected = [];
const blockedOrigins = new Set();
let active;
let appServer;
let browser;
let origin;

function scenario(kind) {
  const missing = kind === "historical-missing";
  const page = clone(
    missing ? catalogue.legacyCataloguePage : catalogue.cataloguePage,
  );
  const detail = clone(
    missing ? catalogue.legacyCatalogueDetail : catalogue.catalogueDetail,
  );
  const quote = clone(missing ? quotes.legacy : quotes.cks);
  const order = clone(missing ? orders.legacy : orders.cks);
  const clock = new Date(
    Date.parse(quote.data.quoteIssuedAt) + 60_000,
  ).toISOString();
  const expiry = new Date(Date.parse(clock) + 240_000).toISOString();
  const item = quote.data.items[0];
  const productName = missing ? "Fresh Milk 1 L" : "Brand Rice 5kg";
  for (const product of [page.data[0], detail.data]) {
    product.productId = item.productId;
    product.outletProductId = item.outletProductId;
    product.name = productName;
    product.imageUrl = null;
    product.sellingPriceMinor = item.unitPriceMinor;
    if (!missing) {
      product.category = clone(classification.detail.data.category);
      product.subcategory = clone(classification.detail.data.subcategory);
    }
    if (kind === "populated") product.barcode = normalBarcode;
    if (kind === "historical-null") product.barcode = null;
  }
  detail.data.description = missing
    ? "Milk 1 L. Keep chilled at 4 degrees; batch 2026."
    : description;
  item.productNameSnapshot = `${productName} frozen quote 2026`;
  order.data.items[0].productName = `${productName} frozen order 2026`;
  if (kind === "populated") {
    item.barcodeSnapshot = normalBarcode;
    order.data.items[0].barcode = normalBarcode;
  }
  if (kind === "historical-null") {
    item.barcodeSnapshot = null;
    order.data.items[0].barcode = null;
  }
  for (const meta of [page.meta, detail.meta]) {
    meta.asOf = clock;
    meta.assignmentContextExpiresAt = expiry;
  }
  // Explicit completed-order/document-availability derivative lets the real
  // receipt controls fetch the same unchanged supplied PDF in every scenario.
  order.data.customerStage = "DELIVERED";
  order.data.milestones.completedAt = order.data.updatedAt;
  order.data.receipt = {
    receiptAvailable: true,
    receiptReference: "SYNTH-FINAL",
    issuedAt: order.data.updatedAt,
    metadataPath: `/api/v1/orders/${order.data.orderId}/receipt`,
    downloadPath: `/api/v1/orders/${order.data.orderId}/receipt/download`,
  };
  const productCategory = page.data[0].category;
  const productSubcategory = page.data[0].subcategory;
  const categoryPage = {
    data: [{ ...productCategory, code: "02" }],
    meta: { ...page.meta, pageSize: 50, total: 1, hasNextPage: false },
  };
  const subcategoryPage = {
    data: [
      { ...productSubcategory, categoryId: productCategory.id, code: "03" },
    ],
    meta: { ...page.meta, pageSize: 50, total: 1, hasNextPage: false },
  };
  const barcode =
    missing || kind === "historical-null"
      ? null
      : kind === "populated"
        ? normalBarcode
        : leadingZero;
  return {
    kind,
    page,
    detail,
    quote,
    order,
    clock,
    categoryPage,
    subcategoryPage,
    barcode,
    fingerprint: sha256(
      JSON.stringify({
        page,
        detail,
        quote,
        order,
        categoryPage,
        subcategoryPage,
      }),
    ),
  };
}

function send(res, data) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(data));
}
const fixtureServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    const event = {
      scenario: active?.kind,
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      productContract: req.headers["x-cks-product-contract"] ?? null,
      feeContract: req.headers["x-cks-fee-contract"] ?? null,
      assignmentContextPresent: Boolean(
        req.headers["x-cks-assignment-context"],
      ),
    };
    observations.push(event);
    if (url.pathname === "/api/v1/customer/session")
      return send(res, {
        data: {
          authenticated: true,
          expiresAt: "2099-01-01T00:00:00.000Z",
          csrfToken: csrf,
        },
      });
    if (url.pathname === "/api/v1/customer/me")
      return send(res, {
        data: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          savtMemberId: null,
          nameSnapshot: "Synthetic evidence member",
          phoneE164Snapshot: null,
          membershipTier: "GOLD",
          savtMemberStatus: "ACTIVE",
          accountStatus: "ACTIVE",
          savtSyncStatus: "SYNCED",
          savtSyncedAt: active.clock,
        },
      });
    if (url.pathname === "/api/v1/customer/me/addresses")
      return send(res, {
        data: [
          {
            id: addressId,
            label: "Synthetic home",
            recipientName: "Synthetic recipient",
            recipientPhoneE164: null,
            addressLine1: "1 Example Street",
            addressLine2: null,
            city: "Demo City",
            state: "Sabah",
            postcode: "88000",
            countryCode: "MY",
            deliveryInstructions: null,
            latitude: 5.9804,
            longitude: 116.0735,
            isDefault: true,
            status: "ACTIVE",
            rowVersion: 1,
            createdAt: active.clock,
            updatedAt: active.clock,
          },
        ],
      });
    if (url.pathname === "/api/v1/customer/support")
      return send(res, { data: { whatsapp: null } });
    if (url.pathname === "/api/v1/customer/advertisements")
      return send(res, { data: [] });
    if (url.pathname === "/api/v1/customer/outlet-assignment") {
      assert.deepEqual(JSON.parse(body), {
        customerAddressId: addressId,
        addressRowVersion: 1,
      });
      assert.equal(req.headers["x-cks-csrf"], csrf);
      return send(res, {
        data: {
          assignmentContextId: "A".repeat(43),
          customerAddressId: addressId,
          addressRowVersion: 1,
          outlet: active.page.meta.outlet,
          resolvedAt: active.clock,
          expiresAt: active.page.meta.assignmentContextExpiresAt,
        },
        meta: { asOf: active.clock },
      });
    }
    if (url.pathname.endsWith("/subcategories"))
      return send(res, active.subcategoryPage);
    if (url.pathname.endsWith("/categories"))
      return send(res, active.categoryPage);
    if (url.pathname.endsWith("/products")) return send(res, active.page);
    if (/\/products\/[0-9a-f-]{36}$/i.test(url.pathname))
      return send(res, active.detail);
    if (url.pathname === "/api/v1/checkout/quote") {
      const parsed = JSON.parse(body);
      assert.deepEqual(parsed, {
        outletId: active.page.meta.outlet.id,
        customerAddressId: addressId,
        deliveryType: "NOW",
        items: [
          { outletProductId: active.page.data[0].outletProductId, quantity: 2 },
        ],
      });
      event.itemIds = parsed.items.map((item) => item.outletProductId);
      event.quantities = parsed.items.map((item) => item.quantity);
      event.idempotencyKeyPresent = Boolean(req.headers["idempotency-key"]);
      return send(res, active.quote);
    }
    if (url.pathname === "/api/v1/customer/orders") {
      const order = active.order.data;
      return send(res, {
        data: [
          {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            customerStage: order.customerStage,
            paymentStatus: order.paymentStatus,
            outletId: order.outletId,
            outletName: order.outletName,
            currency: order.money.currency,
            grandTotalMinor: order.money.grandTotalMinor,
            deliveryType: order.delivery.deliveryType,
            tracking: {
              currentState: order.delivery.currentState,
              assignedAt: order.delivery.assignedAt,
              pickedUpAt: order.delivery.pickedUpAt,
              deliveredAt: order.delivery.deliveredAt,
            },
            receiptAvailable: true,
            canCancel: false,
          },
        ],
        meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      });
    }
    if (/\/customer\/orders\/[0-9a-f-]{36}\/documents$/i.test(url.pathname)) {
      const order = active.order.data;
      const document = (kind, reference, suffix) => ({
        kind,
        receiptReference: reference,
        issuedAt: order.updatedAt,
        metadataPath: `/api/v1/orders/${order.orderId}/${suffix}`,
        downloadPath: `/api/v1/orders/${order.orderId}/${suffix}/download`,
      });
      return send(res, {
        data: {
          orderId: order.orderId,
          paymentReceiptAvailable: true,
          finalSalesReceiptAvailable: true,
          paymentReceipt: document(
            "PAYMENT_RECEIPT",
            "SYNTH-PAYMENT",
            "payment-receipt",
          ),
          finalSalesReceipt: document(
            "FINAL_SALES_RECEIPT",
            "SYNTH-FINAL",
            "receipt",
          ),
        },
      });
    }
    if (
      /\/api\/v1\/orders\/[0-9a-f-]{36}\/(?:payment-receipt|receipt)\/download$/i.test(
        url.pathname,
      )
    ) {
      assert.equal(req.headers.accept, "application/pdf");
      res.setHeader("content-type", "application/pdf");
      res.setHeader(
        "content-disposition",
        'attachment; filename="synthetic-backend-receipt.pdf"',
      );
      res.setHeader("content-length", pdf.length);
      return res.end(pdf);
    }
    if (/\/customer\/orders\/[0-9a-f-]{36}$/i.test(url.pathname))
      return send(res, active.order);
    unexpected.push({ method: req.method, path: url.pathname });
    res.statusCode = 404;
    return send(res, {
      error: {
        code: "SYNTHETIC_ROUTE_NOT_FOUND",
        message: "Evidence boundary only",
      },
    });
  } catch (error) {
    unexpected.push({ message: error.message });
    res.statusCode = 500;
    return send(res, {
      error: { code: "EVIDENCE_ASSERTION_FAILED", message: error.message },
    });
  }
});

async function layout(page, surface) {
  const geometry = await page.evaluate(() => {
    const scroller = document.querySelector(".app-shell__scroll");
    const shell = document.querySelector(".app-shell")?.getBoundingClientRect();
    const nav = document
      .querySelector('nav[aria-label="Primary navigation"]')
      ?.getBoundingClientRect();
    const purchase = document
      .querySelector(".catalogue-detail-purchase")
      ?.getBoundingClientRect();
    return {
      width: innerWidth,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      scrollerOverflow:
        !scroller || scroller.scrollWidth > scroller.clientWidth + 1,
      shellLeft: shell?.left,
      shellRight: shell?.right,
      navBottom: nav?.bottom,
      navTop: nav?.top,
      purchaseBottom: purchase?.bottom ?? null,
      overflowingItemContent: [
        ...document.querySelectorAll(
          ".catalogue-tile, .catalogue-detail, .cart-line, .quote-lines li, .order-items li",
        ),
      ]
        .filter((item) => item.scrollWidth > item.clientWidth + 1)
        .map((item) => item.className),
    };
  });
  assert.equal(
    geometry.documentOverflow,
    false,
    `${surface}: document overflow`,
  );
  assert.equal(
    geometry.scrollerOverflow,
    false,
    `${surface}: scroller overflow`,
  );
  assert.deepEqual(
    geometry.overflowingItemContent,
    [],
    `${surface}: item overflow`,
  );
  assert(
    geometry.shellLeft >= -1 && geometry.shellRight <= geometry.width + 1,
    `${surface}: shell clipped`,
  );
  assert(
    geometry.navBottom <= page.viewportSize().height + 1,
    `${surface}: bottom navigation clipped`,
  );
  if (geometry.purchaseBottom !== null)
    assert(
      geometry.purchaseBottom <= geometry.navTop + 1,
      `${surface}: purchase overlaps bottom navigation`,
    );
  return geometry;
}

async function surface(
  page,
  width,
  label,
  locator,
  name,
  expectedBarcode,
  capture,
) {
  await locator.waitFor();
  const text = await locator.innerText();
  assert(
    text.includes(name),
    `${label}: frozen/live description and its numbers preserved`,
  );
  const barcodeNodes = await locator.locator(".item-barcode").allTextContents();
  assert.deepEqual(
    barcodeNodes,
    phase === "before" && expectedBarcode !== null
      ? [`Barcode ${expectedBarcode}`]
      : [],
    `${phase}/${label}: barcode visibility`,
  );
  if (phase === "after") {
    assert(!/\bBarcode\b/i.test(text), `${label}: Barcode label leaked`);
    assert(
      !text.includes(leadingZero) && !text.includes(normalBarcode),
      `${label}: raw barcode leaked`,
    );
  }
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const geometry = await layout(page, label);
  screenChecks.push({
    width,
    scenario: active.kind,
    surface: label,
    name,
    rawApiBarcode: expectedBarcode,
    expectedVisible: phase === "before" && expectedBarcode !== null,
    actualBarcodeNodes: barcodeNodes,
    geometry,
  });
  if (capture) {
    const filename = `${width}-${label}.png`;
    await page.screenshot({ path: join(output, filename) });
    screenshots.push({
      width,
      surface: label,
      filename,
      scenario: active.kind,
    });
  }
}

async function journey(width, kind) {
  active = scenario(kind);
  const setup = active;
  const capture = kind === "leading-zero";
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on("pageerror", (error) =>
    errors.push({ scenario: kind, width, message: error.message }),
  );
  await page.clock.setFixedTime(new Date(setup.clock));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ["blob:", "data:"].includes(url.protocol))
      return route.continue();
    blockedOrigins.add(url.origin);
    return route.abort("blockedbyclient");
  });
  page.on("response", async (response) => {
    const path = new URL(response.url()).pathname;
    let envelope;
    if (/\/products\/[0-9a-f-]{36}$/i.test(path)) envelope = setup.detail;
    else if (path.endsWith("/products")) envelope = setup.page;
    else if (path === "/api/v1/checkout/quote") envelope = setup.quote;
    else if (/\/customer\/orders\/[0-9a-f-]{36}$/i.test(path))
      envelope = setup.order;
    if (!envelope || response.status() !== 200) return;
    try {
      assert.deepEqual(
        await response.json(),
        envelope,
        "Actual runtime receives exact synthetic envelope, including raw barcode contract",
      );
      responseChecks.push({
        width,
        scenario: kind,
        path,
        envelopeFingerprint: sha256(JSON.stringify(envelope)),
        exactEnvelopeEquality: true,
      });
    } catch (error) {
      errors.push({ width, scenario: kind, message: error.message });
    }
  });
  await page.addInitScript(() => {
    window.__repairReceiptMessages = [];
    window.SavtCksGoBridge = {
      postMessage(raw) {
        const message = JSON.parse(raw);
        window.__repairReceiptMessages.push(message);
        if (message.type === "document-save")
          queueMicrotask(() =>
            window.dispatchEvent(
              new CustomEvent("savt-cks-go-document-result", {
                detail: {
                  protocolVersion: "1",
                  requestId: message.payload.requestId,
                  status: "saved",
                },
              }),
            ),
          );
      },
    };
    window.open = () => {
      throw new Error("External window blocked in local evidence");
    };
  });
  try {
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(
      await page
        .getByRole("button", { name: "Close CKS Go", exact: true })
        .count(),
      0,
      "Native host keeps close ownership",
    );
    const product = setup.page.data[0];
    const tile = page.locator(".catalogue-tile").first();
    await surface(
      page,
      width,
      "catalogue-card",
      tile,
      product.name,
      setup.barcode,
      capture,
    );
    assert(
      (await tile.innerText()).includes("5.00"),
      "Catalogue selling price preserved",
    );
    await tile
      .getByRole("button", { name: `View ${product.name}`, exact: true })
      .click();
    const detail = page.locator(".catalogue-detail");
    await surface(
      page,
      width,
      "product-detail",
      detail,
      product.name,
      setup.barcode,
      capture,
    );
    const fieldLabels = await detail.locator("dt").allInnerTexts();
    const values = await detail.locator("dd").allInnerTexts();
    assert.deepEqual(fieldLabels, [
      "Item description",
      "Category",
      "Subcategory",
    ]);
    assert.deepEqual(
      values,
      [
        setup.detail.data.description,
        product.category.name,
        product.subcategory.name,
      ],
      "Numeric description and approved shopping classification preserved",
    );
    assert.equal(
      await detail
        .getByRole("img", {
          name: `Image unavailable for ${product.name}`,
          exact: true,
        })
        .count(),
      1,
      "Existing null image fallback preserved",
    );
    const add = page.getByRole("button", {
      name: "Add to Basket",
      exact: true,
    });
    assert.equal(await add.isEnabled(), true);
    await add.click();
    await page
      .getByRole("button", { name: /^Basket(?:,|\s|$)/ })
      .last()
      .click();
    const draft = page.locator(".cart-line").first();
    await draft.waitFor();
    await draft
      .getByRole("button", { name: "Increase quantity", exact: true })
      .click();
    assert.equal(await draft.locator(".ui-quantity > span").innerText(), "2");
    assert(
      (await draft.innerText()).includes("10.00"),
      "Draft quantity/subtotal preserved",
    );
    await surface(
      page,
      width,
      "basket-item",
      draft,
      product.name,
      setup.barcode,
      capture,
    );
    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page
      .getByText("Prices and fees confirmed", { exact: true })
      .waitFor();
    const confirmed = page.locator(".cart-lines");
    await surface(
      page,
      width,
      "checkout-item",
      confirmed,
      setup.quote.data.items[0].productNameSnapshot,
      setup.barcode,
      capture,
    );
    assert.equal(
      await confirmed.locator(".ui-quantity > span").innerText(),
      "2",
    );
    assert(
      (await page.locator(".quote-card").innerText()).includes("15.45"),
      "Backend accepted quote total preserved",
    );
    assert.equal(
      await page.getByRole("button", { name: /^Pay (RM|MYR)/ }).isEnabled(),
      true,
      "Payment entry control preserved; payment not executed",
    );
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page.getByRole("button", { name: /^Order history/ }).click();
    await page
      .getByRole("button", {
        name: `View order ${setup.order.data.orderNumber}`,
        exact: true,
      })
      .click();
    const items = page.locator(".order-items");
    await surface(
      page,
      width,
      "order-item",
      items,
      setup.order.data.items[0].productName,
      setup.barcode,
      capture,
    );
    assert(
      (await items.innerText()).includes("Quantity 2") &&
        (await items.innerText()).includes("14.00"),
      "Order frozen quantity/line total preserved",
    );
    assert(
      (await page.locator(".order-money").innerText()).includes("18.00"),
      "Historical order grand total preserved",
    );
    await page
      .getByRole("button", { name: "Download Receipt", exact: true })
      .click();
    await page.getByText("Receipt saved", { exact: true }).first().waitFor();
    await page
      .getByRole("button", {
        name: "Download Final Sales Receipt",
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[role="status"]')].filter(
          (element) => element.textContent?.trim() === "Receipt saved",
        ).length === 2,
    );
    const messages = await page.evaluate(() =>
      window.__repairReceiptMessages
        .filter((message) => message.type === "document-save")
        .map((message) => message.payload),
    );
    assert.equal(messages.length, 2);
    for (const [index, payload] of messages.entries()) {
      assert.equal(payload.protocolVersion, "1");
      assert.equal(payload.mimeType, "application/pdf");
      assert(
        payload.filename.startsWith(
          index === 0 ? "CKS-Go-Payment-Receipt-" : "CKS-Go-Receipt-",
        ),
      );
      assert.deepEqual(
        Buffer.from(payload.base64, "base64"),
        pdf,
        "Server PDF passed unchanged to native bridge",
      );
      receipts.push({
        width,
        scenario: kind,
        kind: index === 0 ? "PAYMENT_RECEIPT" : "FINAL_SALES_RECEIPT",
        filename: payload.filename,
        byteLength: pdf.length,
        sha256: sha256(pdf),
        exactByteEquality: true,
        nativeResult: "synthetic saved acknowledgement",
      });
    }
    await layout(page, "receipt-controls");
  } catch (error) {
    await page
      .screenshot({ path: join(output, `failure-${width}-${kind}.png`) })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function artifactHashes(root) {
  const result = [];
  async function visit(directory, relative = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const local = join(relative, entry.name);
      if (entry.isDirectory()) await visit(join(directory, entry.name), local);
      else
        result.push({
          path: local.replaceAll("\\", "/"),
          sha256: sha256(await readFile(join(directory, entry.name))),
        });
    }
  }
  await visit(root);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

try {
  await access(join(appRepository, "dist/index.html"));
  await mkdir(output, { recursive: true });
  const assets = await artifactHashes(join(appRepository, "dist"));
  fixtureServer.listen(0, "127.0.0.1");
  await once(fixtureServer, "listening");
  appServer = createCustomerServer({
    target: `http://127.0.0.1:${fixtureServer.address().port}`,
    distDirectory: join(appRepository, "dist"),
  });
  appServer.listen(0, "127.0.0.1");
  await once(appServer, "listening");
  origin = `http://127.0.0.1:${appServer.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  for (const width of [390, 320])
    for (const kind of [
      "leading-zero",
      "populated",
      "historical-missing",
      "historical-null",
    ])
      await journey(width, kind);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  assert.equal(screenshots.length, 10);
  assert.equal(screenChecks.length, 40);
  assert.equal(receipts.length, 16);
  const quoteRequests = observations.filter(
    (request) => request.path === "/api/v1/checkout/quote",
  );
  assert.equal(quoteRequests.length, 8);
  assert(
    quoteRequests.every(
      (request) =>
        request.idempotencyKeyPresent &&
        request.feeContract === "small-order-fee-v1" &&
        request.productContract === "cks-v1",
    ),
  );
  const catalogueRequests = observations.filter((request) =>
    /\/products(?:$|\/)/.test(request.path),
  );
  assert(
    catalogueRequests.every(
      (request) =>
        request.assignmentContextPresent &&
        request.productContract === "cks-v1",
    ),
  );
  const orderRequests = observations.filter((request) =>
    /\/customer\/orders\/[0-9a-f-]{36}$/i.test(request.path),
  );
  assert(
    orderRequests.every(
      (request) =>
        request.feeContract === "small-order-fee-v1" &&
        request.productContract === "cks-v1",
    ),
  );
  assert.deepEqual(
    await artifactHashes(join(appRepository, "dist")),
    assets,
    "App artifacts changed during evidence run",
  );
  for (const [name, hash] of Object.entries(hashes))
    assert.equal(
      sha256(await readFile(join(handoff, name))),
      hash,
      "Supplied evidence bytes changed",
    );
  const scenarioFingerprints = Object.fromEntries(
    ["leading-zero", "populated", "historical-missing", "historical-null"].map(
      (kind) => [kind, scenario(kind).fingerprint],
    ),
  );
  if (phase === "after") {
    const previous = JSON.parse(
      await readFile(join(outputRoot, "before/results.json"), "utf8"),
    );
    assert.equal(previous.result, "PASS");
    assert.deepEqual(
      previous.handoffHashes,
      hashes,
      "Before/after source fixture bytes differ",
    );
    assert.deepEqual(
      previous.scenarioFingerprints,
      scenarioFingerprints,
      "Before/after synthetic scenarios differ",
    );
  }
  await writeFile(
    join(output, "results.json"),
    `${JSON.stringify({ result: "PASS", phase, claimScope: "Bounded actual production React app and runtime proxy screen proof against explicitly synthetic HTTP, authenticated session, native host and routing boundaries. No real backend/authentication/database/native device/payment execution claim.", baselineSourceTree: expectedBaselineTree, baselineSourceHead: git(baseline, "rev-parse", "HEAD"), appRepository, appSourceHead: git(appRepository, "rev-parse", "HEAD"), appArtifacts: assets, artifactBytesStableDuringRun: true, handoffHashes: hashes, handoffBytesUnchanged: true, scenarioFingerprints, actual: ["built React components and navigation", "strict API parsers/state controllers", "actual runtime/server.mjs and runtime/proxy.mjs", "receipt download controls/PDF API and native bridge payload"], synthetic: ["HTTP catalogue/quote/order/documents backend", "authenticated session and CSRF", "member/address and assignment context", "empty advertising/support", "fixed browser clock", "native host presence and saved acknowledgement", "coherent catalogue IDs/prices derived from independent quote fixture", "catalogue numeric description and frozen quote/order name derivatives", "completed order/document availability", "normal barcode and null-barcode derivatives", "null images using actual fallback"], limitation: "Original handoff files and static backend-rendered final-sales PDF remain unchanged. Rendered catalogue/quote/order envelopes are explicitly derived synthetic setups, not claimed unchanged backend serializer outputs. The same static PDF is served at both receipt endpoints to verify exact transport bytes; this is not live receipt rendering or native file-system save acceptance.", browser: await browser.version(), widths: [390, 320], screenshots, screenChecks, receiptChecks: receipts, responseChecks, requests: observations, blockedExternalOriginsBeforeNetwork: [...blockedOrigins], errors, unexpected }, null, 2)}\n`,
  );
  await unlink(join(output, "failure.json")).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  console.log(
    JSON.stringify({
      result: "PASS",
      phase,
      output,
      screenshots: screenshots.length,
      screenChecks: screenChecks.length,
      exactReceiptHandoffs: receipts.length,
    }),
  );
} catch (error) {
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "failure.json"),
    `${JSON.stringify({ result: "FAIL", phase, message: error.message, stack: error.stack, scenario: active?.kind, screenshots, screenChecks, requests: observations, errors, unexpected }, null, 2)}\n`,
  );
  throw error;
} finally {
  await browser?.close();
  for (const server of [appServer, fixtureServer]) {
    if (!server?.listening) continue;
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}
