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
const phase = process.argv[2] ?? "green",
  output = path.resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const server = await startFixtureServer(5252, true);
const browser = await playwright.chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const results = [];
try {
  for (const scenario of process.argv[4]
    ? [process.argv[4]]
    : phase === "red"
      ? ["expanded-home"]
      : ["expanded-home", "details", "failure", "outlet-change"]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(7000);
    const result = { scenario, status: "Fail", protocol: [] };
    try {
      await page.clock.install({ time: new Date() });
      await installEmbeddedFixture(page);
      let assignment,
        count = 0;
      const products = Array.from({ length: 8 }, (_, i) => ({
        productId: `6666666${i}-6666-4666-8666-666666666666`,
        outletProductId: `8888888${i}-8888-4888-8888-888888888888`,
        name: `Official Milk 500 ml ${i + 1}`,
        imageUrl: null,
        category: {
          id: "77777777-7777-4777-8777-777777777777",
          name: "Beverages",
        },
        subcategory: null,
        brand: null,
        uom: { code: "BTL", name: "Bottle" },
        packSize: "500 ml",
        sellingPriceMinor: 850,
        currency: "MYR",
        availability: "AVAILABLE",
      }));
      await page.route("**/api/v1/customer/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/outlet-assignment")) {
          count++;
          if (scenario === "failure" && count === 2)
            return route.abort("failed");
          const now = await page.evaluate(() => Date.now());
          assignment = {
            assignmentContextId: (count === 1 ? "A" : "B").repeat(42) + "A",
            customerAddressId: homeAddress.id,
            addressRowVersion: homeAddress.rowVersion,
            outlet: {
              id:
                scenario === "outlet-change" && count > 1
                  ? "33333333-3333-4333-8333-333333333333"
                  : "11111111-1111-4111-8111-111111111111",
              displayReference: "DEMO",
              displayName:
                count > 1 && scenario === "outlet-change"
                  ? "New synthetic outlet"
                  : "Synthetic outlet",
              status: "ACTIVE",
              operatingState: "ONLINE",
              availability: "AVAILABLE",
            },
            resolvedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 300000).toISOString(),
          };
          result.protocol.push({
            stage: "assignment",
            count,
            resolvedAt: assignment.resolvedAt,
            expiresAt: assignment.expiresAt,
          });
          return route.fulfill({
            json: { data: assignment, meta: { asOf: assignment.resolvedAt } },
          });
        }
        if (!url.pathname.includes("/outlets/")) return route.fallback();
        result.protocol.push({
          stage: url.pathname.endsWith("/categories")
            ? "categories"
            : "products/detail",
          context: route
            .request()
            .headers()
            ["x-cks-assignment-context"]?.slice(0, 1),
          count,
        });
        const meta = {
          outlet: assignment.outlet,
          assignmentContextExpiresAt: assignment.expiresAt,
          asOf: assignment.resolvedAt,
          page: Number(url.searchParams.get("page") ?? 1),
          pageSize: 24,
          total: 8,
          hasNextPage: false,
        };
        if (url.pathname.endsWith("/categories"))
          return route.fulfill({
            json: {
              data: [{ ...products[0].category, code: "004" }],
              meta: { ...meta, total: 1 },
            },
          });
        if (url.pathname.endsWith("/products"))
          return route.fulfill({
            json: {
              data: products.map((p) => ({
                ...p,
                sellingPriceMinor: count > 1 ? 875 : 850,
              })),
              meta,
            },
          });
        const p = products.find((p) =>
          url.pathname.endsWith(p.outletProductId),
        );
        if (p)
          return route.fulfill({
            json: {
              data: {
                ...p,
                sellingPriceMinor: count > 1 ? 875 : 850,
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
        .getByRole("heading", { name: "Featured products", exact: true })
        .waitFor();
      if (scenario === "expanded-home") {
        await page
          .getByRole("button", { name: "Show more products", exact: true })
          .click();
        assert.equal(
          await page
            .locator(".catalogue-home-featured .catalogue-tile")
            .count(),
          8,
        );
      } else {
        await page
          .getByRole("button", { name: "Browse all", exact: false })
          .first()
          .click();
        await page.getByPlaceholder("Search products").fill("milk");
        await page.clock.fastForward(301);
        await page
          .getByRole("button", {
            name: "View Official Milk 500 ml 1",
            exact: true,
          })
          .first()
          .click();
        await page.locator(".catalogue-detail h2").waitFor();
        if (scenario === "outlet-change")
          await page
            .getByRole("button", { name: "Add to Basket", exact: true })
            .click();
      }
      const before = await page.evaluate(() => location.hash);
      await page.clock.fastForward(270000);
      await page.waitForFunction(
        () => !document.querySelector(".catalogue-status[aria-busy='true']"),
      );
      // The real async API/parser must finish after the fake timer admission.
      if (scenario === "failure") {
        await page
          .getByRole("alert")
          .filter({ hasText: "refresh delivery availability" })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Add to Basket", exact: true })
            .isEnabled(),
          false,
        );
        await page.screenshot({
          path: path.join(output, "failure-try-again.png"),
        });
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "refresh delivery availability" })
          .waitFor({ state: "detached" });
        assert.equal(count, 3);
      } else if (scenario === "outlet-change") {
        await page
          .getByRole("heading", {
            name: "Delivery availability changed",
            exact: true,
          })
          .waitFor();
        await page.screenshot({
          path: path.join(output, "changed-outlet-review.png"),
        });
        await page
          .getByRole("button", { name: "Manage addresses", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Saved addresses", exact: true })
          .waitFor();
        await page.locator(".delivery-picker__card button").first().click();
        await page
          .getByRole("heading", {
            name: "Clear basket and switch address?",
            exact: true,
          })
          .waitFor();
        await page.screenshot({
          path: path.join(output, "changed-outlet-existing-confirmation.png"),
        });
        await page
          .getByRole("button", {
            name: "Keep current delivery address",
            exact: true,
          })
          .click();
        await page.getByRole("dialog").waitFor({ state: "detached" });
        result.destination = await page.evaluate(() => location.hash);
        assert.equal(
          result.destination,
          "#delivery-address",
          "Keep current must cancel the same-address outlet switch, not commit it",
        );
        assert.equal(
          await page
            .getByRole("heading", { name: "Saved addresses", exact: true })
            .count(),
          1,
        );
        assert.equal(count, 3, "cancel must not trigger assignment adoption");
        await page.locator(".delivery-picker__card button").first().click();
        await page
          .getByRole("heading", {
            name: "Clear basket and switch address?",
            exact: true,
          })
          .waitFor();
        await page
          .getByRole("button", {
            name: "Use this address & clear basket",
            exact: true,
          })
          .click();
        await page
          .getByText("From New synthetic outlet", { exact: true })
          .waitFor();
        assert.equal(await page.evaluate(() => location.hash), "#home");
        assert.ok(
          !(await page.locator("body").innerText()).includes("Basket · 1 item"),
        );
        result.confirmedDestination = "#home";
        await page.screenshot({
          path: path.join(
            output,
            "changed-outlet-explicit-confirmation-done.png",
          ),
        });
      }
      if (scenario !== "outlet-change") {
        await page
          .getByText(/RM\s*8\.75/)
          .first()
          .waitFor();
        await page.waitForFunction(
          () =>
            !document.querySelector(
              ".catalogue-detail-purchase button:disabled",
            ),
        );
        assert.equal(await page.evaluate(() => location.hash), before);
        if (scenario === "expanded-home") {
          result.visibleProducts = await page
            .locator(".catalogue-home-featured .catalogue-tile")
            .count();
          assert.equal(
            result.visibleProducts,
            8,
            "same-authority renewal must preserve expanded Home browsing",
          );
        } else {
          assert.equal(
            await page.locator(".catalogue-detail h2").innerText(),
            "Official Milk 500 ml 1",
          );
          await page.goBack();
          await page.getByPlaceholder("Search products").waitFor();
          assert.equal(
            await page.getByPlaceholder("Search products").inputValue(),
            "milk",
          );
          result.returnDestination = await page.evaluate(() => location.hash);
        }
      }
      result.assignments = count;
      await page.screenshot({
        path: path.join(output, `${phase}-${scenario}.png`),
        fullPage: true,
      });
      result.status = "Pass";
    } catch (error) {
      result.error = String(error);
      result.screen = await page.locator("body").innerText();
      await page
        .screenshot({
          path: path.join(output, `${phase}-${scenario}-failure.png`),
        })
        .catch(() => {});
    }
    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
  await stopFixtureServer(server);
}
await writeFile(
  path.join(output, `${phase}-renewal-ui-results.json`),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.status !== "Pass")) process.exitCode = 1;
