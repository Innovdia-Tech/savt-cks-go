import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  playwright,
  installEmbeddedFixture,
  startFixtureServer,
  stopFixtureServer,
  homeAddress,
} from "./browser-fixtures.mjs";

const phase = process.argv[2] ?? "after";
const output = path.resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const server = await startFixtureServer(5261, true);
const browser = await playwright.chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const names = [
  "Body Wash 500ml",
  "Gentle Daily Care Body Wash 500ml",
  "Dishwashing Liquid 900ml",
];
const product = {
  productId: "66666666-6666-4666-8666-666666666666",
  outletProductId: "88888888-8888-4888-8888-888888888888",
  name: names[0],
  imageUrl:
    "/api/v1/product-media/66666666-6666-4666-8666-666666666666/44444444-4444-4444-8444-444444444444",
  category: {
    id: "77777777-7777-4777-8777-777777777777",
    name: "Personal care",
  },
  subcategory: null,
  brand: null,
  uom: { code: "BTL", name: "Bottle" },
  packSize: "500 ml",
  sellingPriceMinor: 1090,
  currency: "MYR",
  availability: "AVAILABLE",
};
const products = [
  product,
  {
    ...product,
    outletProductId: "88888888-8888-4888-8888-888888888889",
    name: names[1],
    packSize: null,
  },
  {
    ...product,
    outletProductId: "88888888-8888-4888-8888-888888888880",
    name: names[2],
    availability: "UNAVAILABLE",
  },
];
const results = [];
async function check(page, width, presentation, selector) {
  const result = { width, presentation, phase, status: "Fail" };
  try {
    const cards = page.locator(selector);
    await cards.nth(2).waitFor();
    await page
      .locator(selector + " img")
      .first()
      .evaluate((img) => img.decode());
    result.names = await cards.locator(".catalogue-name").allTextContents();
    result.units = await cards.locator(".catalogue-unit").allTextContents();
    result.route = await page.evaluate(() => location.hash);
    result.geometry = await cards.evaluateAll((elements) =>
      elements.map((card) => {
        const rect = (selector) => {
          const r = card.querySelector(selector).getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            height: r.height,
          };
        };
        return {
          card: rect(".catalogue-open"),
          name: rect(".catalogue-name"),
          price: rect(".catalogue-price-row"),
          action: rect(".catalogue-add, .catalogue-tile-quantity"),
        };
      }),
    );
    await page.screenshot({
      path: path.join(output, `${phase}-${presentation}-${width}.png`),
      fullPage: true,
    });
    assert.deepEqual(
      result.names,
      names,
      "official backend names retained exactly",
    );
    assert.deepEqual(result.units, [], "no Pack Size or UOM subtitle");
    for (let i = 0; i < 3; i++) {
      assert.ok((await cards.nth(i).innerText()).includes("10.90"));
      assert.equal(await cards.nth(i).locator("img").count(), 1);
      assert.ok(
        result.geometry[i].price.top >= result.geometry[i].name.bottom - 1,
      );
    }
    if (presentation !== "home")
      assert.ok(
        await cards
          .nth(2)
          .getByRole("button", { name: names[2] + " unavailable" })
          .isDisabled(),
      );
    assert.ok(
      result.geometry[1].name.height > 30,
      "long official name wraps cleanly",
    );
    if (presentation !== "list") {
      assert.ok(
        Math.abs(result.geometry[0].price.top - result.geometry[1].price.top) <
          1,
      );
      assert.ok(
        Math.abs(
          result.geometry[0].action.bottom - result.geometry[1].action.bottom,
        ) < 1,
      );
      assert.ok(
        await cards
          .first()
          .getByRole("button", { name: "Add Body Wash 500ml to basket" })
          .isEnabled(),
      );
    } else {
      for (const row of result.geometry)
        assert.ok(
          row.price.top - row.name.bottom <= 16,
          "no reserved subtitle row gap",
        );
      await cards
        .first()
        .getByRole("button", { name: "Add Body Wash 500ml to basket" })
        .click();
      assert.equal(
        await cards.first().locator('[aria-live="polite"]').innerText(),
        "1",
      );
      await cards
        .first()
        .getByRole("button", { name: "Increase quantity" })
        .click();
      assert.equal(
        await cards.first().locator('[aria-live="polite"]').innerText(),
        "2",
      );
      await cards
        .first()
        .getByRole("button", { name: "Decrease quantity" })
        .click();
      assert.equal(
        await cards.first().locator('[aria-live="polite"]').innerText(),
        "1",
      );
      assert.equal(
        await cards.nth(1).locator('[aria-live="polite"]').innerText(),
        "2",
      );
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "product names and controls stay within the mobile viewport",
    );
    result.status = "Pass";
  } catch (error) {
    result.error = String(error);
    result.stack = error.stack;
  }
  results.push(result);
  console.log(
    JSON.stringify({
      width,
      presentation,
      status: result.status,
      error: result.error,
    }),
  );
}
try {
  for (const width of [320, 390, 430]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const fixture = await installEmbeddedFixture(page);
    await page.route("**/api/v1/product-media/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: Buffer.from(
          "R0lGODlhAQABAIAAAMjIyAAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
          "base64",
        ),
      }),
    );
    let assignment;
    await page.route("**/api/v1/customer/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/outlet-assignment")) {
        assignment = {
          assignmentContextId: "A".repeat(43),
          customerAddressId: homeAddress.id,
          addressRowVersion: homeAddress.rowVersion,
          outlet: {
            id: "11111111-1111-4111-8111-111111111111",
            displayReference: "DEMO",
            displayName: "Synthetic outlet",
            status: "ACTIVE",
            operatingState: "ONLINE",
            availability: "AVAILABLE",
          },
          resolvedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        };
        return route.fulfill({
          json: { data: assignment, meta: { asOf: assignment.resolvedAt } },
        });
      }
      if (!url.pathname.includes("/outlets/")) return route.fallback();
      const meta = {
        outlet: assignment.outlet,
        assignmentContextExpiresAt: assignment.expiresAt,
        asOf: assignment.resolvedAt,
        page: 1,
        pageSize: 24,
        total: 3,
        hasNextPage: false,
      };
      if (url.pathname.endsWith("/categories"))
        return route.fulfill({
          json: {
            data: [{ ...product.category, code: "004" }],
            meta: { ...meta, total: 1 },
          },
        });
      if (url.pathname.endsWith("/products"))
        return route.fulfill({
          json: {
            data:
              url.searchParams.get("featured") === "true"
                ? products.map((p) => ({ ...p, availability: "AVAILABLE" }))
                : products,
            meta,
          },
        });
      return route.fallback();
    });
    await page.goto(server.origin + "/");
    await check(
      page,
      width,
      "home",
      ".catalogue-home-featured .catalogue-tile",
    );
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("button", { name: "Browse", exact: true })
      .click();
    await page
      .locator(".catalogue-home-featured")
      .waitFor({ state: "detached" });
    await check(page, width, "browse-grid", ".catalogue-grid .catalogue-tile");
    assert.deepEqual(fixture.trace.errors, []);
    assert.deepEqual(fixture.trace.unexpectedRequests, []);
    await page.goto(
      server.origin +
        "/verification/cust-ux-batch01/product-card-size-fixture.html",
    );
    await check(
      page,
      width,
      "list",
      '[data-presentation="list"] .catalogue-tile',
    );
    await page.close();
  }
} finally {
  await browser.close();
  await stopFixtureServer(server);
}
await writeFile(
  path.join(output, `${phase}-results.json`),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    results.map(({ width, presentation, status, error }) => ({
      width,
      presentation,
      status,
      error,
    })),
    null,
    2,
  ),
);
if (results.some((r) => r.status !== "Pass")) process.exitCode = 1;
