import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  playwright,
  homeAddress,
  installEmbeddedFixture,
  startFixtureServer,
  stopFixtureServer,
} from "./browser-fixtures.mjs";

const phase = process.argv[2] ?? "green";
const output = path.resolve(process.argv[3]);
await mkdir(output, { recursive: true });
const cases = [
  { name: "samsung", width: 384, height: 694 },
  { name: "oppo", width: 360, height: 668 },
  { name: "compact", width: 320, height: 480 },
];
const addresses = Array.from({ length: 8 }, (_, index) => ({
  ...homeAddress,
  id:
    index === 0
      ? homeAddress.id
      : String(index).padStart(8, "0") + "-2222-4222-8222-222222222222",
  isDefault: index === 0,
  label: index === 0 ? "Home" : "Other",
  addressLine1: String(index + 1) + " Synthetic Example Street",
}));
const results = [];
const server = await startFixtureServer(5244, true);
const browser = await playwright.chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  for (const size of phase === "red" ? cases.slice(0, 1) : cases) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const result = { name: size.name, status: "Fail", viewport: size };
    try {
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.hostname === "127.0.0.1" ||
          url.pathname.startsWith("/api/v1/")
          ? route.fallback()
          : route.abort();
      });
      const fixture = await installEmbeddedFixture(page, {
        addresses,
        locationStatus: "unavailable",
        locationDelay: 50,
      });
      await page.goto(server.origin + "/");
      await page
        .getByRole("button", { name: "Change delivery address" })
        .click();
      await page
        .getByRole("heading", { name: "Saved addresses", exact: true })
        .waitFor();
      assert.equal(await page.locator(".delivery-picker__card").count(), 8);
      await page
        .getByRole("button", { name: "Use my current location", exact: true })
        .click();
      const alert = page.getByRole("alert").filter({
        hasText:
          "We couldn’t get your current location. Try again or search for an address.",
      });
      await alert.waitFor();
      result.feedback = await alert.boundingBox();
      result.current = await page
        .getByRole("button", {
          name: "Use my current location",
          exact: true,
        })
        .boundingBox();
      result.route = await page.evaluate(() => location.hash);
      await page.screenshot({
        path: path.join(output, phase + "-" + size.name + "-failure.png"),
      });
      assert.ok(
        result.feedback.y >= 0 &&
          result.feedback.y + result.feedback.height <= size.height,
        "GPS error must be visible beside recovery controls without scrolling the saved-address list",
      );
      assert.equal(result.route, "#delivery-address");
      assert.equal(
        await page
          .getByRole("heading", { name: "Set delivery location", exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .isEnabled(),
        true,
      );
      const search = page.getByRole("button", {
        name: "Search building, street or postcode",
        exact: true,
      });
      assert.equal(await search.isEnabled(), true);
      await search.click();
      await page
        .getByRole("heading", { name: "Search location", exact: true })
        .waitFor();
      const query = page.getByPlaceholder("Building, street or postcode");
      await query.fill("R4-QA-recovery");
      assert.equal(await query.inputValue(), "R4-QA-recovery");
      await page.getByRole("button", { name: "Go back", exact: true }).click();
      await page
        .getByRole("heading", { name: "Saved addresses", exact: true })
        .waitFor();
      await page.evaluate(() => window.__setLocationStatus("ok"));
      await page
        .getByRole("button", { name: "Use my current location", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "Confirm delivery location",
          exact: true,
        })
        .waitFor();
      await page.getByRole("button", { name: "Go back", exact: true }).click();
      await page
        .getByRole("heading", { name: "Saved addresses", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("heading", { name: "Set delivery location", exact: true })
          .count(),
        0,
      );
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(await page.locator(".delivery-picker__card").count(), 8);
      assert.equal(fixture.trace.errors.length, 0);
      assert.equal(fixture.trace.unexpectedRequests.length, 0);
      result.status = "Pass";
      result.assertions = [
        "exact error visible with eight saved addresses",
        "picker retained; no generic chooser",
        "retry and Search enabled",
        "Search accepts disposable input",
        "retry enters map; Back returns to picker",
        "old error cleared; eight saved addresses unchanged",
      ];
    } catch (error) {
      result.error = String(error);
    } finally {
      results.push(result);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await stopFixtureServer(server);
}
await writeFile(
  path.join(output, phase + "-results.json"),
  JSON.stringify(results, null, 2) + "\n",
);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => result.status !== "Pass")) process.exitCode = 1;
