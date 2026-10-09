// Evidence only: built customer app -> its unchanged runtime proxy -> either
// unchanged serializer envelopes or the pinned Nest catalogue controller/service.
// Session, native host, customer/address, assignment readiness and persistence
// are synthetic. This is bounded screen evidence, not authenticated acceptance.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import { readFile, mkdir, writeFile, access, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { createCustomerServer } from "../../runtime/server.mjs";
import { startPairedBackend } from "./paired-backend.mjs";

const { chromium } = createRequire(import.meta.url)(
  "C:/Users/isaac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const repository = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const evidenceDirectory = fileURLToPath(new URL("./browser/", import.meta.url));
const fixturePath = fileURLToPath(
  new URL("./handoff/serializer-fixtures.json", import.meta.url),
);
const fixtureBytes = await readFile(fixturePath);
const fixtureSha256 = createHash("sha256").update(fixtureBytes).digest("hex");
const fixtures = JSON.parse(fixtureBytes.toString("utf8"));
const mapped = fixtures.detail.data;
const historical = fixtures.legacyDetail.data;
const categoryId = mapped.category.id;
const subcategoryId = mapped.subcategory.id;
const widths = [390, 320];
const results = [];
const checks = [];
const requests = [];
const responseChecks = [];
const unexpected = [];
const browserErrors = [];
const blockedExternalOrigins = new Set();
const servers = [];
let paired;
let browser;
let activeScenario;

const syntheticCustomerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const syntheticAddressId = "99999999-9999-4999-8999-999999999999";
const syntheticCsrf = "S".repeat(43);

function profile(id, asOf) {
  return {
    id,
    savtMemberId: null,
    nameSnapshot: "Synthetic evidence member",
    phoneE164Snapshot: null,
    membershipTier: "GOLD",
    savtMemberStatus: "ACTIVE",
    accountStatus: "ACTIVE",
    savtSyncStatus: "SYNCED",
    savtSyncedAt: asOf,
  };
}

function address(id, asOf) {
  return {
    id,
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
    createdAt: asOf,
    updatedAt: asOf,
  };
}

const send = (res, value, status = 200) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
};

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

function recordRequest(req, url, mode) {
  const item = {
    scenario: activeScenario,
    boundary: mode,
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    productContract: req.headers["x-cks-product-contract"] ?? null,
    assignmentContextPresent: Boolean(req.headers["x-cks-assignment-context"]),
    syntheticCookiePresent: Boolean(
      req.headers.cookie?.includes("align02-synthetic-session"),
    ),
  };
  requests.push(item);
  return item;
}

// No browser API fulfillment: every catalogue request crosses the actual
// runtime/server.mjs proxy. The shim supplies unrelated synthetic startup data.
async function routingBoundary(mode, upstream) {
  const fixedAsOf = fixtures.categories.meta.asOf;
  const fixedExpiresAt = fixtures.categories.meta.assignmentContextExpiresAt;
  const memberId = upstream?.customerId ?? syntheticCustomerId;
  const addressId = upstream?.addressId ?? syntheticAddressId;
  const contextId = upstream?.assignmentContextId ?? "A".repeat(43);
  const outlet = fixtures.categories.meta.outlet;
  const clock = () => (upstream ? upstream.asOf() : fixedAsOf);
  const expiry = () => upstream?.assignmentContextExpiresAt ?? fixedExpiresAt;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      recordRequest(req, url, mode);
      const body = [];
      for await (const chunk of req) body.push(chunk);
      const rawBody = Buffer.concat(body);
      if (url.pathname === "/api/v1/customer/session")
        return send(res, {
          data: {
            authenticated: true,
            expiresAt: "2099-01-01T00:00:00.000Z",
            csrfToken: syntheticCsrf,
          },
        });
      if (url.pathname === "/api/v1/customer/me")
        return send(res, { data: profile(memberId, clock()) });
      if (url.pathname === "/api/v1/customer/me/addresses")
        return send(res, { data: [address(addressId, clock())] });
      if (url.pathname === "/api/v1/customer/advertisements")
        return send(res, { data: [] });
      if (url.pathname === "/api/v1/customer/support")
        return send(res, { data: { whatsapp: null } });
      if (url.pathname === "/api/v1/customer/outlet-assignment") {
        assert.deepEqual(JSON.parse(rawBody.toString("utf8")), {
          customerAddressId: addressId,
          addressRowVersion: 1,
        });
        assert.equal(req.headers["x-cks-csrf"], syntheticCsrf);
        return send(res, {
          data: {
            assignmentContextId: contextId,
            customerAddressId: addressId,
            addressRowVersion: 1,
            outlet,
            resolvedAt: new Date(Date.parse(expiry()) - 300_000).toISOString(),
            expiresAt: expiry(),
          },
          meta: { asOf: clock() },
        });
      }
      if (
        mode === "paired" &&
        url.pathname.startsWith("/api/v1/customer/outlets/")
      ) {
        // Fixed loopback Nest target; preserves cookies/context/capability from
        // the real proxy. No direct controller invocation from the browser.
        const outgoing = httpRequest(
          new URL(req.url, upstream.origin),
          {
            method: req.method,
            headers: { ...req.headers, host: new URL(upstream.origin).host },
          },
          (response) => {
            res.writeHead(response.statusCode ?? 502, response.headers);
            response.pipe(res);
          },
        );
        outgoing.on("error", (error) => {
          unexpected.push({ boundary: mode, message: error.message });
          if (!res.headersSent)
            send(
              res,
              {
                error: {
                  code: "PAIRED_NEST_UNAVAILABLE",
                  message: "Evidence helper unavailable",
                },
              },
              502,
            );
          else res.destroy();
        });
        outgoing.end(rawBody);
        return;
      }
      if (mode === "fixture") {
        if (url.pathname.endsWith("/subcategories"))
          return send(res, fixtures.subcategories);
        if (url.pathname.endsWith("/categories"))
          return send(res, fixtures.categories);
        if (url.pathname.endsWith(`/products/${mapped.outletProductId}`))
          return send(res, fixtures.detail);
        if (url.pathname.endsWith(`/products/${historical.outletProductId}`))
          return send(res, fixtures.legacyDetail);
        if (url.pathname.endsWith("/products"))
          return send(res, fixtures.filtered);
      }
      unexpected.push({
        boundary: mode,
        method: req.method,
        path: url.pathname,
      });
      send(
        res,
        {
          error: {
            code: "EVIDENCE_ROUTE_NOT_FOUND",
            message: "Synthetic boundary only",
          },
        },
        404,
      );
    } catch (error) {
      unexpected.push({ boundary: mode, message: error.message });
      if (!res.headersSent)
        send(
          res,
          {
            error: {
              code: "EVIDENCE_ASSERTION_FAILED",
              message: error.message,
            },
          },
          500,
        );
      else res.destroy();
    }
  });
  const target = await listen(server);
  const app = createCustomerServer({
    target,
    distDirectory: join(repository, "dist"),
  });
  return { origin: await listen(app), clock: clock(), mode };
}

async function newPage(width, boundary, label, initialHash = "") {
  activeScenario = `${boundary.mode}-${label}-${width}`;
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await context.addCookies([
    {
      name: paired.cookieName,
      value: paired.cookieValue,
      url: boundary.origin,
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  await page.clock.setFixedTime(new Date(boundary.clock));
  page.on("pageerror", (error) =>
    browserErrors.push({ scenario: activeScenario, message: error.message }),
  );
  page.on("response", async (response) => {
    if (boundary.mode !== "fixture") return;
    const pathname = new URL(response.url()).pathname;
    let source;
    if (pathname.endsWith(`/products/${mapped.outletProductId}`))
      source = "detail";
    else if (pathname.endsWith(`/products/${historical.outletProductId}`))
      source = "legacyDetail";
    else if (pathname.endsWith("/subcategories")) source = "subcategories";
    else if (pathname.endsWith("/categories")) source = "categories";
    else if (pathname.endsWith("/products")) source = "filtered";
    if (!source || response.status() !== 200) return;
    try {
      assert.deepEqual(
        await response.json(),
        fixtures[source],
        `Unchanged ${source} envelope`,
      );
      responseChecks.push({
        scenario: activeScenario,
        source,
        exactEnvelopeEquality: true,
      });
    } catch (error) {
      browserErrors.push({ scenario: activeScenario, message: error.message });
    }
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin === boundary.origin ||
      ["data:", "blob:"].includes(url.protocol)
    )
      return route.continue();
    blockedExternalOrigins.add(url.origin);
    return route.abort("blockedbyclient");
  });
  await page.addInitScript(() => {
    window.__align02NativeMessages = [];
    window.SavtCksGoBridge = {
      postMessage(raw) {
        window.__align02NativeMessages.push(JSON.parse(raw));
      },
    };
    window.open = () => {
      throw new Error("External window prohibited by bounded evidence");
    };
  });
  await page.goto(
    `${boundary.origin}/${initialHash ? `#${initialHash}` : ""}`,
    { waitUntil: "networkidle" },
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Close CKS Go", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.locator(".app-header__brand").count(), 0);
  return { page, context };
}

async function geometry(page, label) {
  const result = await page.evaluate(() => {
    const scroller = document.querySelector(".app-shell__scroll");
    const shellBox = document
      .querySelector(".app-shell")
      ?.getBoundingClientRect();
    const navBox = document
      .querySelector('nav[aria-label="Primary navigation"]')
      ?.getBoundingClientRect();
    const purchaseBox = document
      .querySelector(".catalogue-detail-purchase")
      ?.getBoundingClientRect();
    return {
      width: innerWidth,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      scrollerOverflow: scroller
        ? scroller.scrollWidth > scroller.clientWidth + 1
        : true,
      shellLeft: shellBox?.left,
      shellRight: shellBox?.right,
      navBottom: navBox?.bottom,
      purchaseBottom: purchaseBox?.bottom ?? null,
      navTop: navBox?.top,
      overflowingItemContent: [
        ...document.querySelectorAll(
          ".catalogue-tile, .catalogue-detail, .cart-line",
        ),
      ]
        .filter((item) => item.scrollWidth > item.clientWidth + 1)
        .map((item) => item.className),
    };
  });
  assert.equal(
    result.documentOverflow,
    false,
    `${label}: document horizontal overflow`,
  );
  assert.equal(
    result.scrollerOverflow,
    false,
    `${label}: app horizontal overflow`,
  );
  assert.deepEqual(
    result.overflowingItemContent,
    [],
    `${label}: item content horizontal overflow`,
  );
  assert(
    result.shellLeft >= -1 && result.shellRight <= result.width + 1,
    `${label}: shell clipped`,
  );
  assert(
    result.navBottom <= page.viewportSize().height + 1,
    `${label}: bottom navigation clipped`,
  );
  if (result.purchaseBottom !== null)
    assert(
      result.purchaseBottom <= result.navTop + 1,
      `${label}: purchase overlaps navigation`,
    );
  return result;
}

async function capture(page, width, boundary, label, focus) {
  if (focus) await focus.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const layout = await geometry(page, `${boundary.mode}-${width}-${label}`);
  const screenshot = `${boundary.mode}-${width}-${label}.png`;
  await page.screenshot({
    path: join(evidenceDirectory, screenshot),
    fullPage: false,
  });
  results.push({ boundary: boundary.mode, width, label, screenshot, layout });
}

async function assertIdentity(locator, product) {
  assert(
    (await locator.innerText()).includes(product.name),
    "Item name absent",
  );
  const barcodes = await locator.locator(".item-barcode").allTextContents();
  assert.deepEqual(
    barcodes,
    product.barcode === null ? [] : [`Barcode ${product.barcode}`],
    "Exact barcode text and leading zeros",
  );
  const labels = await locator.locator("dt").allInnerTexts();
  assert(
    !labels.some((label) =>
      /^(Brand|UOM|Unit|Pack size|Storage|Division|Department|Subdepartment|SKU)$/i.test(
        label.trim(),
      ),
    ),
    "Retired/source metadata displayed separately",
  );
}

async function assertDetail(page, product) {
  const detail = page.locator(".catalogue-detail");
  await detail.waitFor();
  await assertIdentity(detail, product);
  const labels = await detail.locator("dt").allInnerTexts();
  const values = await detail.locator("dd").allInnerTexts();
  const fields = Object.fromEntries(
    labels.map((label, index) => [label.trim(), values[index]?.trim()]),
  );
  assert.equal(
    fields["Item description"],
    product.description ?? "Not available",
    "Detail Item description",
  );
  assert.equal(
    fields.Category,
    product.category?.name ?? "Not available",
    "Approved category or truthful null",
  );
  assert.equal(
    fields.Subcategory,
    product.subcategory?.name ?? "Not available",
    "Approved subcategory or truthful null",
  );
  assert.equal(
    labels.length,
    3,
    "Only description and shopping classification metadata",
  );
  const purchase = page.locator(".catalogue-detail-purchase");
  assert(
    (await purchase.innerText()).includes(
      (product.sellingPriceMinor / 100).toFixed(2),
    ),
    "Selling price preserved",
  );
  const add = purchase.getByRole("button", {
    name: "Add to Basket",
    exact: true,
  });
  assert.equal(
    await add.isEnabled(),
    true,
    "Purchase preserved for available product",
  );
  assert.equal(
    await detail
      .getByRole("img", {
        name: `Image unavailable for ${product.name}`,
        exact: true,
      })
      .count(),
    1,
    "Null image preserves actual fallback",
  );
  checks.push({
    scenario: activeScenario,
    productId: product.productId,
    outletProductId: product.outletProductId,
    fields,
    exactBarcode: product.barcode,
    retiredMetadataAbsent: true,
    sellingPriceMinor: product.sellingPriceMinor,
    purchaseEnabled: true,
    nullImageFallback: true,
  });
  return detail;
}

async function mappedJourney(width, boundary, withBasket) {
  const { page, context } = await newPage(width, boundary, "mapped");
  try {
    await page.locator(".catalogue-tile").first().waitFor();
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    const categories = page.getByRole("region", {
      name: "Shop by category",
      exact: true,
    });
    await categories
      .getByRole("button", { name: mapped.category.name, exact: true })
      .click();
    const children = page.getByRole("region", {
      name: "Shop by subcategory",
      exact: true,
    });
    await children
      .getByRole("button", {
        name: `All in ${mapped.category.name}`,
        exact: true,
      })
      .waitFor();
    const filteredResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.endsWith("/products") &&
        url.searchParams.get("categoryId") === categoryId &&
        url.searchParams.get("subcategoryId") === subcategoryId &&
        response.status() === 200
      );
    });
    await children
      .getByRole("button", { name: mapped.subcategory.name, exact: true })
      .click();
    await filteredResponse;
    const childButton = children.getByRole("button", {
      name: mapped.subcategory.name,
      exact: true,
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector('.catalogue-subcategories button[aria-pressed="true"]')
          ?.textContent?.trim() === "Rice",
    );
    await page
      .getByRole("button", { name: `View ${mapped.name}`, exact: true })
      .waitFor();
    assert.equal(await childButton.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator(".catalogue-tile").count(),
      1,
      "Child filter excludes historical-null product",
    );
    const tile = page.locator(".catalogue-tile").filter({
      has: page.getByRole("button", {
        name: `View ${mapped.name}`,
        exact: true,
      }),
    });
    assert.equal(
      await tile.count(),
      1,
      "Mapped child contains exactly matching product",
    );
    await assertIdentity(tile, mapped);
    await capture(page, width, boundary, "selected-child", children);
    await tile
      .getByRole("button", { name: `View ${mapped.name}`, exact: true })
      .click();
    const detail = await assertDetail(page, mapped);
    await capture(page, width, boundary, "mapped-detail", detail.locator("dl"));
    // The embedded native host owns Back. Browser history emulates its return.
    await page.goBack();
    await childButton.waitFor();
    assert.equal(
      await childButton.getAttribute("aria-pressed"),
      "true",
      "Back retains selected child",
    );
    await tile.waitFor();
    await assertIdentity(tile, mapped);
    await capture(page, width, boundary, "back-selected-child", children);
    checks.push({
      scenario: activeScenario,
      backPreservesCategoryId: categoryId,
      backPreservesSubcategoryId: subcategoryId,
      matchingProduct: mapped.outletProductId,
    });
    if (withBasket) {
      await tile
        .getByRole("button", {
          name: `Add ${mapped.name} to basket`,
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: /^Basket(?:,|\s|$)/ })
        .last()
        .click();
      const line = page.locator(".cart-line").first();
      await line.waitFor();
      await assertIdentity(line, mapped);
      assert(
        (await line.innerText()).includes("12.99"),
        "Draft basket preserves selling price",
      );
      await capture(page, width, boundary, "mapped-basket", line);
    }
  } catch (error) {
    await page
      .screenshot({
        path: join(evidenceDirectory, `failure-${activeScenario}.png`),
      })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

async function historicalJourney(width, boundary) {
  const { page, context } = await newPage(
    width,
    boundary,
    "historical-null",
    `detail/${historical.outletProductId}`,
  );
  try {
    const detail = await assertDetail(page, historical);
    const visible = await detail.innerText();
    assert.equal(
      await detail.getByText("Not available", { exact: true }).count(),
      2,
      "Historical classification nulls remain explicit",
    );
    assert(
      !visible.includes("Other") &&
        !visible.includes(mapped.category.name) &&
        !visible.includes(mapped.subcategory.name),
      "Historical classification cannot be invented or borrowed",
    );
    await capture(
      page,
      width,
      boundary,
      "historical-null-detail",
      detail.locator("dl"),
    );
  } catch (error) {
    await page
      .screenshot({
        path: join(evidenceDirectory, `failure-${activeScenario}.png`),
      })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

try {
  await access(join(repository, "dist/index.html"));
  await mkdir(evidenceDirectory, { recursive: true });
  // A deliberately plain synthetic name works over loopback HTTP. Production
  // Secure/__Host cookie transport is outside this bounded screen proof.
  paired = await startPairedBackend({
    fixtures,
    cookieName: "cksgo_evidence_session",
  });
  const fixtureBoundary = await routingBoundary("fixture");
  const pairedBoundary = await routingBoundary("paired", paired);
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    ...(process.env.CKS_GO_TEST_BROWSER_CHANNEL
      ? { channel: process.env.CKS_GO_TEST_BROWSER_CHANNEL }
      : {}),
  });
  for (const width of widths) {
    await mappedJourney(width, fixtureBoundary, true);
    await historicalJourney(width, fixtureBoundary);
    await mappedJourney(width, pairedBoundary, false);
  }
  assert.deepEqual(
    browserErrors,
    [],
    "Browser errors or unchanged fixture equality failures",
  );
  assert.deepEqual(unexpected, [], "Unexpected synthetic boundary route/error");
  assert.equal(results.length, 16, "Bounded screenshot inventory");
  const productRequests = requests.filter((request) =>
    /\/products(?:$|\/)/.test(request.path),
  );
  assert(
    productRequests.length > 0 &&
      productRequests.every(
        (request) =>
          request.productContract === "cks-v1" &&
          request.assignmentContextPresent,
      ),
    "Product capability/context survived actual runtime proxy",
  );
  for (const boundary of ["fixture", "paired"]) {
    const childRequests = requests.filter(
      (request) =>
        request.boundary === boundary &&
        request.query.subcategoryId === subcategoryId,
    );
    assert(
      childRequests.length >= 2 &&
        childRequests.every(
          (request) => request.query.categoryId === categoryId,
        ),
      "Browse child uses persisted pair IDs",
    );
  }
  assert(
    ["detail", "legacyDetail", "categories", "subcategories", "filtered"].every(
      (source) => responseChecks.some((item) => item.source === source),
    ),
    "Every unchanged supplied screen envelope was consumed",
  );
  assert.equal(
    createHash("sha256")
      .update(await readFile(fixturePath))
      .digest("hex"),
    fixtureSha256,
    "Supplied handoff bytes changed",
  );
  await writeFile(
    join(evidenceDirectory, "results.json"),
    `${JSON.stringify(
      {
        result: "PASS",
        claimScope:
          "Bounded Chromium mobile viewport evidence for actual built React app, strict API parsers, navigation and same-origin runtime proxy. Paired catalogue uses pinned Nest controller/service with synthetic collaborators and repository. This is not full authenticated acceptance, a physical device run, or live operational data.",
        customerBaseCommit: "44e8098ec741cde47b5ca5074eb0b36136c0ffdc",
        handoffFixture: {
          path: fixturePath,
          sha256: fixtureSha256,
          bytesUnchanged: true,
        },
        actual: [
          "production built React app",
          "catalogue strict parsers and state controller",
          "same-origin runtime/server.mjs + runtime/proxy.mjs",
          "pinned Nest customer catalogue controller/service and serializers for paired journey",
        ],
        synthetic: [
          "authenticated session response and plain loopback-only cksgo_evidence_session cookie (production Secure/__Host cookie behavior not exercised)",
          "CSRF token",
          "member profile and saved address",
          "assignment/context/readiness collaborators",
          "native host bridge presence and browser-history Back emulation",
          "empty advertisements and support envelopes",
          "fixed browser clocks",
          "in-memory paired repository",
          "fixture-only HTTP catalogue responses at separate loopback boundary",
          "null product images; actual app image-unavailable fallback",
        ],
        routingScope:
          "Fixture boundary returns unchanged categories, subcategories, filtered, detail and legacyDetail envelopes. Its list is deliberately one supplied filtered envelope for all list queries. Paired boundary forwards catalogue HTTP to actual pinned Nest app and supplies only unrelated startup routes.",
        screenshotScope:
          "At each 390px and 320px: unchanged fixture selected child, mapped detail, back to child, draft basket, historical-null detail; paired selected child, mapped detail, back to child.",
        pairedProvenance: paired.provenance,
        pairedObservations: paired.observations,
        capabilityAssertions: {
          productContract: "cks-v1",
          productRequests: productRequests.length,
          assignmentContextPresent: true,
          childUsesParentAndChildIds: true,
        },
        browser: await browser.version(),
        widths,
        results,
        checks,
        responseChecks,
        requests,
        externalOriginsBlockedBeforeNetwork: [...blockedExternalOrigins],
        unexpected,
        browserErrors,
      },
      null,
      2,
    )}\n`,
  );
  await unlink(join(evidenceDirectory, "failure.json")).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  console.log(
    JSON.stringify({
      result: "PASS",
      output: evidenceDirectory,
      screenshots: results.length,
      widths,
    }),
  );
} catch (error) {
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    join(evidenceDirectory, "failure.json"),
    `${JSON.stringify({ result: "FAIL", message: error.message, stack: error.stack, scenario: activeScenario, completedScreenshots: results, requests, unexpected, browserErrors, pairedObservations: paired?.observations }, null, 2)}\n`,
  );
  throw error;
} finally {
  await browser?.close();
  for (const server of servers.reverse()) {
    if (!server.listening) continue;
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  await paired?.close();
}
