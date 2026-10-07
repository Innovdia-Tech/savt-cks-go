import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  directory,
  installEmbeddedFixture,
  playwright,
  startFixtureServer,
  stopFixtureServer,
} from "./browser-fixtures.mjs";

const baseline = process.argv.includes("--baseline");
const firstOnly = process.argv.includes("--first-only");
const development = process.argv.includes("--development");
const report = {
  task: "CUST-UX-BATCH01 address",
  phase: baseline ? "BASELINE" : "GREEN",
  scope:
    "Actual main.tsx, authenticated customer session, API fixture, native location event shim, Google Map boundary shim; browser evidence only",
  physicalWebView: "PENDING",
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
};
let server, browser, currentPage, currentFixture;
const check = async (name, run) => {
  try {
    report.checks.push({ name, status: "PASS", evidence: await run() });
  } catch (error) {
    report.checks.push({
      name,
      status: "FAIL",
      error: String(error.message ?? error),
      ...(currentFixture ? { evidence: await currentFixture.snapshot() } : {}),
    });
    if (currentPage && !currentPage.isClosed())
      await currentPage.screenshot({
        path: path.join(
          directory,
          `address-${development ? "development-" : ""}${baseline ? "baseline-" : ""}failure-${report.checks.length}.png`,
        ),
        fullPage: true,
      });
  } finally {
    if (currentPage && !currentPage.isClosed()) await currentPage.close();
    currentPage = currentFixture = undefined;
  }
};
const home = (page) =>
  page.getByRole("button", { name: "Change delivery address" });
const setup = async (options = {}, width = 390) => {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  const fixture = await installEmbeddedFixture(page, options);
  currentPage = page;
  currentFixture = fixture;
  await page.goto(
    `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
  );
  await home(page).waitFor({ timeout: 10000 });
  await page
    .getByText("Fixture rice", { exact: true })
    .first()
    .waitFor({ timeout: 10000 });
  return { page, fixture };
};
const snapshot = async (page, fixture, name) => {
  await page.screenshot({
    path: path.join(
      directory,
      `address-${baseline ? "baseline-" : ""}${name}.png`,
    ),
    fullPage: true,
  });
  const evidence = await fixture.snapshot();
  assert.equal(evidence.errors.length, 0);
  assert.equal(evidence.unexpectedRequests.length, 0);
  await page.close();
  return evidence;
};
try {
  process.env.CKS_GO_BROWSER_FIXTURE_CACHE = development
    ? "address-development"
    : "address-production";
  if (baseline) process.env.CKS_GO_ADDRESS_BASELINE = "1";
  server = await startFixtureServer(
    process.argv.includes("--development") ? 5211 : 5207,
    !process.argv.includes("--development"),
  );
  browser = await playwright.chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  for (const width of firstOnly ? [390] : [320, 390, 430])
    await check(
      `Home address entry and one successful location request at ${width}`,
      async () => {
        const { page, fixture } = await setup({}, width);
        await home(page).click();
        await page
          .getByRole("heading", { name: "Delivery address", exact: true })
          .waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(
          (await fixture.snapshot()).embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          0,
        );
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Confirm this location", exact: true })
          .waitFor();
        await page.waitForFunction(
          () => !document.querySelector(".delivery-setup__primary")?.disabled,
        );
        assert.equal(await page.getByRole("alert").count(), 0);
        const evidence = await fixture.snapshot();
        assert.equal(
          evidence.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          1,
        );
        if (development) assert.ok(evidence.embedded.maps.length >= 1);
        else assert.equal(evidence.embedded.maps.length, 1);
        assert.ok(
          evidence.requests.some(
            (request) =>
              request.path === "/api/v1/customer/location/reverse" &&
              request.status === 200,
          ),
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        );
        return snapshot(page, fixture, `one-request-${width}`);
      },
    );
  if (!firstOnly) {
    await check(
      "Previously failed checkout address check does not appear on fresh address entry",
      async () => {
        const { page, fixture } = await setup({ failWorkAssignment: true });
        await home(page).click();
        await page
          .getByRole("button", { name: /^Work 2 Example Street/ })
          .click();
        await page
          .getByText(
            "We couldn’t check delivery for this address. Your current address is still selected.",
            { exact: true },
          )
          .waitFor();
        assert.ok(await page.getByRole("alert").count());
        await page.evaluate(() => {
          window.location.hash = "home";
        });
        await home(page).waitFor();
        await home(page).click();
        await page
          .getByRole("heading", { name: "Delivery address", exact: true })
          .waitFor();
        const text = await page.locator("main.delivery-picker").innerText();
        await page.screenshot({
          path: path.join(
            directory,
            `address-${baseline ? "baseline-" : ""}fresh-entry-after-error.png`,
          ),
          fullPage: true,
        });
        assert.equal(await page.getByRole("alert").count(), 0, text);
        return snapshot(page, fixture, "fresh-entry-clean");
      },
    );
    await check(
      "Saved address coordinates can open a map without GPS",
      async () => {
        const { page, fixture } = await setup();
        await home(page).click();
        await page.getByRole("button", { name: /^Edit Home,/ }).click();
        await page
          .getByRole("button", {
            name: "Change delivery location",
            exact: true,
          })
          .click();
        await page
          .getByRole("heading", {
            name: "Confirm delivery location",
            exact: true,
          })
          .waitFor();
        await page.waitForFunction(
          () => !document.querySelector(".delivery-setup__primary")?.disabled,
        );
        const evidence = await fixture.snapshot();
        assert.equal(
          evidence.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          0,
        );
        assert.deepEqual(evidence.embedded.maps[0].center, {
          lat: 5.92,
          lng: 116.08,
        });
        return snapshot(page, fixture, "saved-coordinates");
      },
    );
    await check(
      "Saved address without coordinates opens normal setup",
      async () => {
        const { page, fixture } = await setup({ workCoordinates: false });
        await home(page).click();
        await page
          .getByRole("button", { name: /^Work 2 Example Street/ })
          .click();
        await page
          .getByRole("heading", { name: "Set delivery location", exact: true })
          .waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
        const evidence = await fixture.snapshot();
        assert.equal(
          evidence.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          0,
        );
        assert.equal(
          evidence.requests.filter(
            (request) => request.path === "/api/v1/customer/outlet-assignment",
          ).length,
          1,
        );
        return snapshot(page, fixture, "missing-coordinates");
      },
    );
    for (const locationStatus of ["ok", "unavailable", "denied"])
      await check(
        `A late ${locationStatus} GPS reply cannot replace a customer's newer Search location action`,
        async () => {
          const { page, fixture } = await setup({
            holdLocation: true,
            locationStatus,
          });
          await home(page).click();
          await page
            .getByRole("button", {
              name: "Use my current location",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", {
              name: /Search building, street or postcode/,
            })
            .click();
          await page
            .getByRole("heading", { name: "Search location", exact: true })
            .waitFor();
          await fixture.release("location");
          await page.waitForFunction(
            () => window.__embeddedTrace.replies.length === 1,
          );
          await page.waitForTimeout(60);
          assert.equal(
            await page
              .getByRole("heading", { name: "Search location", exact: true })
              .count(),
            1,
          );
          assert.equal(
            await page
              .getByRole("heading", {
                name: "Confirm delivery location",
                exact: true,
              })
              .count(),
            0,
          );
          assert.equal(await page.getByRole("alert").count(), 0);
          assert.equal(
            await page
              .getByRole("button", {
                name: "Use my current location",
                exact: true,
              })
              .isEnabled(),
            true,
          );
          return snapshot(
            page,
            fixture,
            `late-${locationStatus}-reply-ignored`,
          );
        },
      );
    await check(
      "A genuine current-location failure remains visible without an automatic retry",
      async () => {
        const { page, fixture } = await setup({
          locationStatus: "unavailable",
        });
        await home(page).click();
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByRole("alert")
          .filter({ hasText: "We couldn’t get your current location." })
          .waitFor();
        const evidence = await fixture.snapshot();
        assert.equal(
          evidence.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          1,
        );
        assert.equal(evidence.embedded.maps.length, 0);
        assert.equal(
          await page
            .getByRole("button", {
              name: "Use my current location",
              exact: true,
            })
            .isEnabled(),
          true,
        );
        return snapshot(page, fixture, "genuine-current-error");
      },
    );
    await check(
      "Typing a newer search during a GPS request keeps search usable",
      async () => {
        const { page, fixture } = await setup({ holdLocation: true });
        await home(page).click();
        await page
          .getByRole("button", { name: /Search building, street or postcode/ })
          .click();
        await page
          .getByRole("heading", { name: "Search location", exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByRole("textbox", {
            name: "Search building, street or postcode",
            exact: true,
          })
          .fill("New address");
        await page
          .getByText(
            "We couldn't find that location. Try a building name, street or postcode.",
            { exact: false },
          )
          .waitFor();
        await fixture.release("location");
        await page.waitForFunction(
          () => window.__embeddedTrace.replies.length === 1,
        );
        await page.waitForTimeout(60);
        assert.equal(
          await page
            .getByRole("heading", { name: "Search location", exact: true })
            .count(),
          1,
        );
        assert.equal(
          await page
            .getByRole("button", {
              name: "Use my current location",
              exact: true,
            })
            .isEnabled(),
          true,
        );
        const evidence = await fixture.snapshot();
        assert.ok(
          evidence.requests.some(
            (request) =>
              request.path === "/api/v1/customer/location/search" &&
              request.status === 200,
          ),
        );
        assert.equal(await page.getByRole("alert").count(), 0);
        return snapshot(page, fixture, "newer-search-usable");
      },
    );
    await check(
      "Search stays available while only one native GPS request is outstanding",
      async () => {
        const { page, fixture } = await setup({ holdLocation: true });
        await home(page).click();
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByRole("button", { name: /Search building, street or postcode/ })
          .click();
        await page
          .getByRole("heading", { name: "Search location", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", {
              name: "Use my current location",
              exact: true,
            })
            .isDisabled(),
          true,
        );
        await page
          .getByRole("textbox", {
            name: "Search building, street or postcode",
            exact: true,
          })
          .fill("New address");
        assert.equal(
          await page
            .getByRole("button", {
              name: "Use my current location",
              exact: true,
            })
            .isDisabled(),
          true,
        );
        await fixture.release("location");
        await page.waitForFunction(
          () => window.__embeddedTrace.replies.length === 1,
        );
        await page.waitForFunction(
          () => !document.querySelector(".delivery-flow__current")?.disabled,
        );
        const first = await fixture.snapshot();
        assert.equal(
          first.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          1,
        );
        assert.equal(first.embedded.dropped.length, 0);
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page.waitForFunction(
          () =>
            window.__embeddedTrace.native.filter(
              ({ message }) => message.type === "location-current",
            ).length === 2,
        );
        await fixture.release("location");
        await page
          .getByRole("heading", {
            name: "Confirm delivery location",
            exact: true,
          })
          .waitFor();
        await page.waitForFunction(
          () => !document.querySelector(".delivery-setup__primary")?.disabled,
        );
        const evidence = await fixture.snapshot();
        assert.equal(
          evidence.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          2,
        );
        assert.equal(evidence.embedded.replies.length, 2);
        assert.equal(evidence.embedded.dropped.length, 0);
        return snapshot(page, fixture, "singleflight-current-location");
      },
    );
    await check(
      "Recenter shares the outstanding GPS coordinate lookup after a newer search",
      async () => {
        const { page, fixture } = await setup({
          holdLocation: true,
          searchSuggestions: true,
        });
        await home(page).click();
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByRole("button", { name: /Search building, street or postcode/ })
          .click();
        await page
          .getByRole("textbox", {
            name: "Search building, street or postcode",
            exact: true,
          })
          .fill("New address");
        await page
          .getByRole("button", { name: /Fixture search location/ })
          .click();
        await page
          .getByRole("button", { name: "Recenter", exact: true })
          .click();
        const pending = await fixture.snapshot();
        assert.equal(
          pending.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          1,
        );
        assert.equal(pending.embedded.dropped.length, 0);
        await fixture.release("location");
        await page.waitForFunction(
          () => window.__embeddedTrace.recenters.length === 1,
        );
        await page.waitForFunction(
          () => !document.querySelector(".delivery-setup__primary")?.disabled,
        );
        const evidence = await fixture.snapshot();
        assert.equal(
          evidence.embedded.native.filter(
            ({ message }) => message.type === "location-current",
          ).length,
          1,
        );
        assert.equal(evidence.embedded.replies.length, 1);
        assert.equal(evidence.embedded.dropped.length, 0);
        assert.deepEqual(evidence.embedded.recenters[0], {
          lat: 5.92,
          lng: 116.08,
        });
        return snapshot(page, fixture, "singleflight-recenter");
      },
    );
  }
} catch (error) {
  report.errors.push(String(error.stack ?? error));
} finally {
  if (browser) await browser.close();
  report.serverCleanedUp = server ? await stopFixtureServer(server) : true;
  if (!report.serverCleanedUp)
    report.errors.push("Fixture server did not close within five seconds.");
  report.finishedAt = new Date().toISOString();
  report.summary = {
    pass: report.checks.filter((check) => check.status === "PASS").length,
    fail: report.checks.filter((check) => check.status === "FAIL").length,
    errors: report.errors.length,
  };
  await fs.writeFile(
    path.join(
      directory,
      `address-${process.argv.includes("--development") ? "development-" : ""}${baseline ? "baseline-" : ""}report.json`,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail || report.errors.length) process.exitCode = 1;
}
