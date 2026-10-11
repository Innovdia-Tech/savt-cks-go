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
const phase = process.argv[2] ?? "after",
  output = path.resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const server = await startFixtureServer(5251, true);
const browser = await playwright.chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const product = {
  productId: "66666666-6666-4666-8666-666666666666",
  outletProductId: "88888888-8888-4888-8888-888888888888",
  name: "Official Milk 500 ml",
  imageUrl: null,
  category: { id: "77777777-7777-4777-8777-777777777777", name: "Beverages" },
  subcategory: { id: "99999999-9999-4999-8999-999999999999", name: "Milk" },
  brand: {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Synthetic brand",
  },
  uom: { code: "BTL", name: "Bottle" },
  packSize: "500 ml",
  sellingPriceMinor: 850,
  currency: "MYR",
  availability: "AVAILABLE",
};
const results = [];
try {
  for (const width of process.argv[4] === "standalone"
    ? [390]
    : [320, 390, 430]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const result = { width, phase, status: "Fail" };
    try {
      await installEmbeddedFixture(page, {
        standalone: process.argv[4] === "standalone",
      });
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
          total: 1,
          hasNextPage: false,
        };
        if (url.pathname.endsWith("/categories"))
          return route.fulfill({
            json: { data: [{ ...product.category, code: "004" }], meta },
          });
        if (url.pathname.endsWith("/products"))
          return route.fulfill({ json: { data: [product], meta } });
        if (url.pathname.endsWith(product.outletProductId))
          return route.fulfill({
            json: {
              data: {
                ...product,
                description: "Official item description.",
                storageType: "CHILLED",
              },
              meta: {
                outlet: meta.outlet,
                assignmentContextExpiresAt: meta.assignmentContextExpiresAt,
                asOf: meta.asOf,
              },
            },
          });
        return route.fallback();
      });
      await page.goto(server.origin + "/");
      await page
        .getByRole("heading", { name: "Categories", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "View Official Milk 500 ml" })
        .first()
        .click();
      await page.locator(".catalogue-detail h2").waitFor();
      result.text = await page.locator(".catalogue-detail").innerText();
      result.route = await page.evaluate(() => location.hash);
      result.bounds = await page.locator(".catalogue-detail").boundingBox();
      await page.screenshot({
        path: path.join(output, `${phase}-product-${width}.png`),
        fullPage: true,
      });
      assert.ok(result.text.includes("Official Milk 500 ml"));
      assert.ok(result.text.includes("8.50"));
      assert.ok(result.text.includes("Official item description."));
      assert.ok(
        result.text.includes("Beverages") &&
          result.text.includes("Subcategory") &&
          result.text.includes("Milk"),
      );
      assert.equal(await page.locator(".catalogue-detail-unit").count(), 0);
      for (const field of ["Barcode", "Brand", "Unit", "Storage", "Pack Size"])
        assert.ok(!result.text.split("\n").includes(field), field);
      assert.ok(
        await page
          .getByRole("button", { name: "Add to Basket", exact: true })
          .isVisible(),
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      result.status = "Pass";
    } catch (error) {
      result.error = String(error);
    }
    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
  await stopFixtureServer(server);
}
await writeFile(
  path.join(output, `${phase}-product-results.json`),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.status !== "Pass")) process.exitCode = 1;
