// Production-bundle acceptance with local synthetic HTTP responses. No live accounts or external destinations.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.MERCH_PREVIEW_ORIGIN ?? "http://127.0.0.1:5190";
const evidence = process.env.MERCH_EVIDENCE_DIR ?? "verification/merch-home01";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
});
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const category = { id: id(10), name: "Fresh Produce" };
const products = Array.from({ length: 30 }, (_, i) => ({
  productId: id(100 + i),
  outletProductId: id(200 + i),
  name: `Product ${String(i + 1).padStart(2, "0")}`,
  imageUrl: null,
  category,
  subcategory: null,
  brand: null,
  uom: { code: "PACK", name: "Pack" },
  packSize: "1 kg",
  sellingPriceMinor: 450 + i * 25,
  currency: "MYR",
  availability: "AVAILABLE",
}));
const results = [];
await mkdir(evidence, { recursive: true });
async function fixture(viewport, options = {}) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const requests = [],
    errors = [],
    opened = [],
    messages = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const asOf = Date.now();
  // Assignment authority caps TTL at exactly five minutes. Use one clock read.
  const now = new Date(asOf).toISOString(),
    expiry = new Date(asOf + 300000).toISOString();
  const outlet = {
    id: id(1),
    displayReference: "LOCAL",
    displayName: "Local fixture store",
    status: "ACTIVE",
    operatingState: "ONLINE",
    availability: "AVAILABLE",
  };
  const meta = { outlet, assignmentContextExpiresAt: expiry, asOf: now };
  const address = {
    id: id(2),
    label: "Local home",
    recipientName: "Fixture customer",
    recipientPhoneE164: null,
    addressLine1: "1 Example Street",
    addressLine2: null,
    city: "Demo City",
    state: "Sabah",
    postcode: null,
    countryCode: "MY",
    deliveryInstructions: null,
    latitude: 5,
    longitude: 116,
    isDefault: true,
    status: "ACTIVE",
    rowVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  let adsFail = options.adsFail ?? false;
  let imageFail = options.imageFail ?? false;
  let releaseProduct;
  const productHold = options.holdProduct
    ? new Promise((resolve) => {
        releaseProduct = resolve;
      })
    : null;
  const action = options.action ?? { type: "NONE" };
  const ad = {
    id: id(500),
    placement: "HOME_HERO",
    displayOrder: 1,
    altText: "HQ uploaded fixture banner",
    imageUrl: `/api/v1/advertisement-media/${id(500)}/${id(501)}`,
    startsAt: null,
    endsAt: null,
    action,
  };
  await page.exposeFunction("recordExternal", (args) => opened.push(args));
  await page.exposeFunction("recordBridge", (message) =>
    messages.push(JSON.parse(message)),
  );
  await page.addInitScript(
    ({ embedded }) => {
      window.open = (...args) => {
        window.recordExternal(args);
        return null;
      };
      if (embedded)
        window.SavtCksGoBridge = {
          postMessage: (raw) => window.recordBridge(raw),
        };
    },
    { embedded: options.embedded ?? false },
  );
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    requests.push({
      path: u.pathname + u.search,
      context: req.headers()["x-cks-assignment-context"],
    });
    let body;
    if (u.pathname.includes("/advertisement-media/")) {
      if (imageFail)
        return route.fulfill({
          status: 503,
          headers: { "cache-control": "no-store" },
          body: "",
        });
      return route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500"><rect width="1200" height="500" fill="#f3e8d3"/><text x="80" y="270" font-family="sans-serif" font-size="64" fill="#74301e">HQ creative fixture</text></svg>',
      });
    }
    if (u.pathname === "/api/v1/customer/session")
      body = {
        data: {
          authenticated: true,
          expiresAt: new Date(Date.now() + 1800000).toISOString(),
          csrfToken: "A".repeat(43),
        },
      };
    else if (u.pathname === "/api/v1/customer/me")
      body = {
        data: {
          id: id(3),
          savtMemberId: null,
          nameSnapshot: "Fixture customer",
          phoneE164Snapshot: null,
          membershipTier: "BASIC",
          savtMemberStatus: "ACTIVE",
          accountStatus: "ACTIVE",
          savtSyncStatus: "SYNCED",
          savtSyncedAt: now,
        },
      };
    else if (u.pathname === "/api/v1/customer/me/addresses")
      body = { data: [address] };
    else if (u.pathname === "/api/v1/customer/outlet-assignment")
      body = {
        data: {
          assignmentContextId: "A".repeat(43),
          customerAddressId: address.id,
          addressRowVersion: 1,
          outlet,
          resolvedAt: now,
          expiresAt: expiry,
        },
        meta: { asOf: now },
      };
    else if (u.pathname === "/api/v1/customer/advertisements") {
      if (adsFail)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: "{}",
        });
      body = {
        data: options.zeroAds
          ? []
          : options.swipe
            ? [
                ad,
                {
                  ...ad,
                  id: id(502),
                  displayOrder: 2,
                  imageUrl: `/api/v1/advertisement-media/${id(502)}/${id(503)}`,
                },
              ]
            : [ad],
      };
    } else if (u.pathname.endsWith("/categories"))
      body = {
        data: [{ ...category, code: "001" }],
        meta: { ...meta, page: 1, pageSize: 50, total: 1, hasNextPage: false },
      };
    else if (/\/products\/[a-f0-9-]+$/.test(u.pathname)) {
      const product = products.find((p) =>
        u.pathname.endsWith(p.outletProductId),
      );
      assert.ok(product);
      body = {
        data: {
          ...product,
          description: "Local fixture description",
          storageType: "AMBIENT",
        },
        meta,
      };
    } else if (u.pathname.endsWith("/products")) {
      assert.equal(req.headers()["x-cks-assignment-context"], "A".repeat(43));
      const featured = u.searchParams.get("featured") === "true";
      const master = u.searchParams.get("productId");
      if (master && productHold) await productHold;
      const q = u.searchParams.get("q");
      const data = featured
        ? products.slice(0, options.featuredCount ?? 24).reverse()
        : master
          ? products.filter((p) => p.productId === master)
          : q
            ? products.filter((p) =>
                p.name.toLowerCase().includes(q.toLowerCase()),
              )
            : products;
      const pageNo = Number(u.searchParams.get("page")),
        pageSize = Number(u.searchParams.get("pageSize"));
      body = {
        data: data.slice((pageNo - 1) * pageSize, pageNo * pageSize),
        meta: {
          ...meta,
          page: pageNo,
          pageSize,
          total: data.length,
          hasNextPage: pageNo * pageSize < data.length,
        },
      };
    } else if (u.pathname === "/api/v1/customer/support")
      body = { data: { whatsapp: null } };
    else
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: "{}",
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto(origin);
  try {
    await page.getByRole("searchbox", { name: "Search products" }).waitFor();
    await page.waitForFunction(() =>
      document.querySelector(".catalogue-home-categories"),
    );
  } catch (error) {
    await page.screenshot({
      path: join(evidence, "fixture-failure.png"),
      fullPage: true,
    });
    console.error(
      JSON.stringify(
        {
          url: page.url(),
          errors,
          requests,
          body: await page.locator("body").innerText(),
        },
        null,
        2,
      ),
    );
    throw error;
  }
  return {
    page,
    requests,
    errors,
    opened,
    messages,
    releaseProduct,
    retryImages: () => {
      imageFail = false;
    },
    retryAds: () => {
      adsFail = false;
    },
  };
}
try {
  for (const viewport of [
    { width: 320, height: 844 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    const f = await fixture(viewport),
      { page } = f;
    await page
      .locator(".catalogue-home-featured .catalogue-tile")
      .first()
      .waitFor();
    const cards = page.locator(".catalogue-home-featured .catalogue-tile");
    assert.equal(await cards.count(), 6);
    assert.match(await cards.first().innerText(), /Product 24/);
    assert.equal(
      await page.locator(".advertising-carousel__banner-button").count(),
      0,
    );
    assert.equal(
      await page.locator(".advertising-carousel__content").count(),
      0,
    );
    assert.equal(
      await page.locator('img[alt="HQ uploaded fixture banner"]').count(),
      1,
    );
    await page.screenshot({
      path: join(evidence, `home-initial-${viewport.width}.png`),
      fullPage: true,
    });
    const featuredReads = f.requests.filter((r) =>
      r.path.includes("featured=true"),
    ).length;
    for (const count of [12, 18, 24]) {
      const more = page.getByRole("button", {
        name: "Show more products",
        exact: true,
      });
      await more.scrollIntoViewIfNeeded();
      const box = await more.boundingBox();
      assert.ok(box.height >= 44 && box.width >= 44);
      const navBox = await page
        .locator('nav[aria-label="Primary navigation"]')
        .boundingBox();
      assert.ok(
        box.y + box.height <= navBox.y + 1,
        "Show more overlaps bottom navigation",
      );
      await more.click();
      assert.equal(await cards.count(), count);
      assert.equal(
        f.requests.filter((r) => r.path.includes("featured=true")).length,
        featuredReads,
        "Show more must expand locally",
      );
    }
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth > window.innerWidth ||
        document.body.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false);
    await page.screenshot({
      path: join(evidence, `home-${viewport.width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Browse all products", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "All products", exact: true })
      .waitFor();
    assert.equal(await page.locator(".catalogue-tile").count(), 24);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelectorAll(".catalogue-tile").length === 6,
    );
    assert.equal(await page.locator(".catalogue-tile").count(), 6);
    assert.ok(f.requests.some((r) => r.path.endsWith("featured=true")));
    assert.deepEqual(f.errors, []);
    results.push({
      viewport,
      reveal: [6, 12, 18, 24],
      overflow: false,
      browseTotal: 30,
      requestContext: "validated",
    });
    await page.close();
  }
  const shopping = await fixture({ width: 390, height: 844 });
  await shopping.page
    .getByRole("button", { name: "Browse", exact: true })
    .click();
  const search = shopping.page.getByRole("searchbox", {
    name: "Search products",
  });
  await search.fill("Product 01");
  await shopping.page.waitForFunction(
    () => document.querySelectorAll(".catalogue-tile").length === 1,
  );
  assert.ok(shopping.requests.some((r) => r.path.includes("q=Product+01")));
  await shopping.page
    .getByRole("button", { name: "Add Product 01 to basket", exact: true })
    .click();
  await shopping.page
    .getByRole("button", { name: /^Basket/ })
    .last()
    .click();
  await shopping.page
    .getByRole("heading", { name: "Your items", exact: true })
    .waitFor();
  await shopping.page.getByText("Product 01", { exact: true }).waitFor();
  assert.deepEqual(shopping.errors, []);
  results.push({ browseSearch: true, basketRetainsOutletProduct: true });
  await shopping.page.close();
  const delayed = await fixture(
    { width: 390, height: 844 },
    {
      action: { type: "PRODUCT", productId: products[1].productId },
      holdProduct: true,
    },
  );
  await delayed.page.locator(".advertising-carousel__banner-button").click();
  await delayed.page
    .getByRole("button", { name: /^Basket/ })
    .last()
    .click();
  await delayed.page
    .getByRole("heading", { name: "Your basket is empty", exact: true })
    .waitFor();
  delayed.releaseProduct();
  await delayed.page.waitForLoadState("networkidle");
  assert.match(delayed.page.url(), /#cart$/);
  await delayed.page
    .getByRole("heading", { name: "Your basket is empty", exact: true })
    .waitFor();
  results.push({ delayedAdvertisementCannotHijackBasket: true });
  await delayed.page.close();
  for (const action of [
    { type: "CATEGORY", categoryId: category.id },
    { type: "PRODUCT", productId: products[1].productId },
    { type: "PRODUCT", productId: id(999) },
    { type: "EXTERNAL_URL", url: "https://cks.example/promo" },
  ]) {
    const f = await fixture({ width: 390, height: 844 }, { action });
    await f.page.locator(".advertising-carousel__banner-button").click();
    if (action.type === "CATEGORY") {
      await f.page
        .getByRole("heading", { name: "Fresh Produce", level: 2, exact: true })
        .waitFor();
      assert.ok(
        f.requests.some((r) => r.path.includes(`categoryId=${category.id}`)),
      );
    } else if (action.type === "PRODUCT" && action.productId !== id(999)) {
      await f.page
        .getByRole("heading", { name: products[1].name, exact: true })
        .waitFor();
      assert.match(f.page.url(), new RegExp(products[1].outletProductId));
      assert.ok(
        f.requests.some((r) =>
          r.path.includes(`productId=${action.productId}`),
        ),
      );
    } else if (action.type === "PRODUCT")
      await f.page
        .getByText("This product isn't available from your delivery store.", {
          exact: true,
        })
        .waitFor();
    else {
      await f.page.waitForTimeout(100);
      assert.deepEqual(f.opened, [
        [action.url, "_blank", "noopener,noreferrer"],
      ]);
    }
    results.push({
      action: action.type,
      unavailable: action.productId === id(999),
      safe: true,
    });
    await f.page.close();
  }
  const embedded = await fixture(
    { width: 390, height: 844 },
    {
      action: { type: "EXTERNAL_URL", url: "https://cks.example/promo" },
      embedded: true,
    },
  );
  await embedded.page.locator(".advertising-carousel__banner-button").click();
  await embedded.page.waitForTimeout(100);
  assert.ok(
    embedded.messages.some(
      (m) =>
        m.type === "external-link-handoff" &&
        m.payload.url === "https://cks.example/promo",
    ),
  );
  assert.deepEqual(embedded.opened, []);
  assert.equal(new URL(embedded.page.url()).origin, origin);
  await embedded.page.close();
  const swipe = await fixture(
    { width: 390, height: 844 },
    {
      action: { type: "EXTERNAL_URL", url: "https://cks.example/promo" },
      swipe: true,
    },
  );
  const banner = swipe.page.locator(".advertising-carousel__banner-button");
  await banner.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 300,
    clientY: 100,
  });
  await banner.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 100,
    clientY: 103,
  });
  await banner.dispatchEvent("click", { detail: 1 });
  assert.deepEqual(swipe.opened, []);
  await swipe.page.close();
  const empty = await fixture(
    { width: 320, height: 844 },
    { zeroAds: true, featuredCount: 0 },
  );
  await empty.page.waitForLoadState("networkidle");
  assert.equal(await empty.page.locator(".advertising-carousel").count(), 0);
  assert.equal(await empty.page.locator(".catalogue-home-featured").count(), 0);
  await empty.page.close();
  const failed = await fixture({ width: 390, height: 844 }, { adsFail: true });
  await failed.page.locator(".catalogue-home-featured").waitFor();
  assert.equal(await failed.page.locator(".advertising-carousel").count(), 0);
  results.push({
    embeddedExternal: true,
    swipeDoesNotActivate: true,
    emptySectionsHidden: true,
    advertisementFailureSoft: true,
  });
  await failed.page.close();
  const recoveredImage = await fixture(
    { width: 390, height: 844 },
    { imageFail: true },
  );
  await recoveredImage.page.waitForLoadState("networkidle");
  assert.equal(
    await recoveredImage.page.locator(".advertising-carousel").count(),
    0,
  );
  recoveredImage.retryImages();
  await recoveredImage.page
    .getByRole("button", { name: "Refresh Home", exact: true })
    .click();
  await recoveredImage.page
    .locator('img[alt="HQ uploaded fixture banner"]')
    .waitFor();
  results.push({ refreshedArtworkRetriesAfterImageFailure: true });
  await recoveredImage.page.close();
  await writeFile(
    join(evidence, "acceptance.json"),
    JSON.stringify(results, null, 2) + "\n",
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
