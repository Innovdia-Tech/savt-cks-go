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
const output = path.resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const server = await startFixtureServer(5253, true);
const browser = await playwright.chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const results = [];
try {
  for (const scenario of [
    "no-service-keep",
    "no-service-clear",
    "expired-add-home",
    "expired-add-browse",
    "expired-add-detail-failed-renewal",
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(7000);
    const result = { scenario, status: "Fail", errors: [] };
    page.on("pageerror", (e) => result.errors.push(String(e)));
    try {
      if (scenario.startsWith("no-service")) {
        await page.goto(
          server.origin +
            "/verification/cust-ux-batch01/review-fix01-fixture.html",
        );
        const state = async () =>
          JSON.parse(await page.getByTestId("decision-state").innerText());
        await page
          .getByRole("heading", { name: "Saved addresses", exact: true })
          .waitFor();
        const before = await state();
        assert.equal(before.selectedId, homeAddress.id);
        assert.equal(before.assignment, null);
        assert.equal(before.lines.length, 1);
        assert.equal(before.onDoneCount, 0);
        await page.locator(".delivery-picker__card button").first().click();
        await page
          .getByRole("heading", {
            name: "Change delivery address?",
            exact: true,
          })
          .waitFor();
        await page
          .getByRole("button", {
            name:
              scenario === "no-service-keep"
                ? "Keep current delivery address"
                : "Use this address & clear basket",
            exact: true,
          })
          .click();
        await page.getByRole("dialog").waitFor({ state: "detached" });
        // Wait for effects, not only the synchronously closed dialog.
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        const after = await state();
        result.destination = await page.evaluate(() => location.hash);
        result.before = before;
        result.after = after;
        assert.equal(after.selectedId, before.selectedId);
        assert.equal(after.assignment, null);
        assert.equal(after.transitionPhase, "idle");
        if (scenario === "no-service-keep") {
          assert.equal(
            after.onDoneCount,
            0,
            "cancellation must never complete the picker",
          );
          assert.equal(result.destination, "#delivery-address");
          assert.deepEqual(after.lines, before.lines);
        } else {
          assert.equal(
            after.onDoneCount,
            1,
            "explicit clearing must complete exactly once",
          );
          assert.equal(result.destination, "#home");
          assert.deepEqual(after.lines, []);
        }
      } else {
        await page.clock.install({ time: new Date() });
        await installEmbeddedFixture(page);
        let assignment,
          count = 0;
        await page.route(
          "**/api/v1/customer/outlet-assignment",
          async (route) => {
            count++;
            if (scenario.endsWith("failed-renewal") && count === 2)
              return route.abort("failed");
            const now = await page.evaluate(() => Date.now());
            assignment = {
              assignmentContextId: (count === 1 ? "A" : "B").repeat(42) + "A",
              customerAddressId: homeAddress.id,
              addressRowVersion: 1,
              outlet: {
                id: "11111111-1111-4111-8111-111111111111",
                displayName: "Synthetic store",
                displayReference: "DEMO",
                status: "ACTIVE",
                operatingState: "ONLINE",
                availability: "AVAILABLE",
              },
              resolvedAt: new Date(now).toISOString(),
              expiresAt: new Date(now + 300000).toISOString(),
            };
            return route.fulfill({
              json: { data: assignment, meta: { asOf: assignment.resolvedAt } },
            });
          },
        );
        await page.route("**/api/v1/customer/outlets/**", async (route) => {
          const url = new URL(route.request().url());
          const category = {
            id: "77777777-7777-4777-8777-777777777777",
            name: "Grocery",
          };
          const product = {
            productId: "66666666-6666-4666-8666-666666666666",
            outletProductId: "88888888-8888-4888-8888-888888888888",
            name: "Fixture rice",
            imageUrl: null,
            category,
            subcategory: null,
            brand: null,
            uom: { code: "PACK", name: "Pack" },
            packSize: "1 kg",
            sellingPriceMinor: count === 1 ? 850 : 875,
            currency: "MYR",
            availability: "AVAILABLE",
          };
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
              json: { data: [{ ...category, code: "001" }], meta },
            });
          if (url.pathname.endsWith("/products"))
            return route.fulfill({ json: { data: [product], meta } });
          return route.fulfill({
            json: {
              data: {
                ...product,
                description: "Synthetic description",
                storageType: "AMBIENT",
              },
              meta: {
                outlet: meta.outlet,
                assignmentContextExpiresAt: meta.assignmentContextExpiresAt,
                asOf: meta.asOf,
              },
            },
          });
        });
        await page.goto(server.origin + "/");
        await page
          .getByRole("heading", { name: "Featured products", exact: true })
          .waitFor();
        if (scenario !== "expired-add-home") {
          await page
            .getByRole("button", { name: "Browse all", exact: false })
            .first()
            .click();
          if (scenario.endsWith("failed-renewal")) {
            await page
              .getByRole("button", { name: "View Fixture rice", exact: true })
              .first()
              .click();
            await page.locator(".catalogue-detail h2").waitFor();
          }
        }
        const add = page
          .getByRole("button", {
            name: /^(Add to Basket|Add Fixture rice to basket)$/,
          })
          .first();
        await add.waitFor();
        assert.equal(await add.isEnabled(), true);
        const before = await page.evaluate(() => location.hash);
        // Move wall clock beyond expiry WITHOUT firing any scheduled timer.
        await page.clock.setSystemTime(
          new Date(Date.parse(assignment.expiresAt) + 1),
        );
        assert.equal(count, 1, "no timer renewal or expiry has run");
        assert.equal(
          await add.isEnabled(),
          true,
          "exercise the delayed-timer UI gap",
        );
        await add.click();
        if (scenario.endsWith("failed-renewal")) {
          await page
            .getByRole("button", { name: "Try again", exact: true })
            .waitFor();
          assert.equal(
            await page.locator(".catalogue-add:not(:disabled)").count(),
            0,
          );
          await page
            .getByRole("button", { name: "Try again", exact: true })
            .click();
        }
        await page
          .getByText(/RM\s*8\.75/)
          .first()
          .waitFor();
        await page.locator(".catalogue-add:not(:disabled)").first().waitFor();
        result.destination = await page.evaluate(() => location.hash);
        assert.equal(result.destination, before);
        assert.equal(count, scenario.endsWith("failed-renewal") ? 3 : 2);
        assert.ok(
          !(await page.locator("body").innerText()).includes("Basket · 1 item"),
          "expired Add does not add or replay a purchase",
        );
        await add.click();
        await page.getByText("Basket · 1 item", { exact: false }).waitFor();
        result.assignments = count;
        result.recoveredManualAdd = true;
      }
      assert.deepEqual(result.errors, [], "no unhandled browser exception");
      result.status = "Pass";
    } catch (error) {
      result.error = String(error);
    }
    await page.screenshot({
      path: path.join(output, scenario + ".png"),
      fullPage: true,
    });
    results.push(result);
    await page.close();
  }
} finally {
  await browser.close();
  await stopFixtureServer(server);
}
await writeFile(
  path.join(output, "results.json"),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.status !== "Pass")) process.exitCode = 1;
