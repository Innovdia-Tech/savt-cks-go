import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  directory,
  installEmbeddedFixture,
  playwright,
  startFixtureServer,
} from "./browser-fixtures.mjs";

const red = process.argv.includes("--red");
const report = {
  task: "CUST-UX-BATCH01 embedded startup",
  phase: red ? "RED" : "GREEN",
  ...(red
    ? {
        baseline:
          "094a78e96851462b7c02cf147081a4642b16b2eb:src/catalogue/components.tsx",
      }
    : {}),
  scope:
    "Actual src/main.tsx, production React, real web session/data/catalogue controllers; loopback native/API shims",
  physicalWebView: "PENDING",
  startedAt: new Date().toISOString(),
  checks: [],
  screenshots: [],
  traces: [],
};
let server;
let browser;
const check = async (name, run) => {
  try {
    const evidence = await run();
    report.checks.push({
      name,
      status: "PASS",
      ...(evidence ? { evidence } : {}),
    });
  } catch (error) {
    report.checks.push({
      name,
      status: "FAIL",
      error: String(error.message ?? error),
    });
  }
};
const waiting = async (_page, fixture, stage) => {
  const endpoint = {
    profile: "/api/v1/customer/me",
    addresses: "/api/v1/customer/me/addresses",
    assignment: "/api/v1/customer/outlet-assignment",
    sessionExchange: "/api/v1/customer/session/exchange",
  }[stage];
  await assertEventually(() =>
    fixture.trace.requests.some((request) => request.path === endpoint),
  );
};
async function assertEventually(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("Expected startup request did not arrive");
}
const paint = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const geometry = (page) =>
  page.evaluate(() => ({
    viewport: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    webLogoCount: document.querySelectorAll(".cks-go-logo").length,
    shellCount: document.querySelectorAll(".app-shell__scroll").length,
    navigationCount: document.querySelectorAll(
      '[aria-label="Primary navigation"]',
    ).length,
    startupShellRetained:
      document.querySelector(".app-shell__scroll")?.dataset.startupShell ===
      "initial",
  }));
async function screenshot(page, filename) {
  const name = `${red ? "startup-red" : "startup"}-${filename}.png`;
  await page.screenshot({ path: path.join(directory, name) });
  report.screenshots.push(name);
}
const paths = (fixture, pathname) =>
  fixture.trace.requests.filter((request) => request.path === pathname);
const sanitize = (snapshot) => ({
  requests: snapshot.requests.map(
    ({ method, path, status, at, completedAt, body }) => ({
      method,
      path,
      status,
      at,
      completedAt,
      bodyKeys: body ? Object.keys(body) : [],
    }),
  ),
  unexpectedRequests: snapshot.unexpectedRequests.map(({ method, path }) => ({
    method,
    path,
  })),
  errors: snapshot.errors,
  native: snapshot.embedded.native.map(({ message, at }) => ({
    type: message.type,
    at,
    keys: Object.keys(message),
    ...(message.payload ? { payloadKeys: Object.keys(message.payload) } : {}),
  })),
});

try {
  const previousBaseline = process.env.CKS_GO_STARTUP_BASELINE;
  const previousCache = process.env.CKS_GO_BROWSER_FIXTURE_CACHE;
  try {
    if (red) process.env.CKS_GO_STARTUP_BASELINE = "1";
    else delete process.env.CKS_GO_STARTUP_BASELINE;
    process.env.CKS_GO_BROWSER_FIXTURE_CACHE = red
      ? "startup-red"
      : "startup-green";
    server = await startFixtureServer(5209);
  } finally {
    if (previousBaseline === undefined)
      delete process.env.CKS_GO_STARTUP_BASELINE;
    else process.env.CKS_GO_STARTUP_BASELINE = previousBaseline;
    if (previousCache === undefined)
      delete process.env.CKS_GO_BROWSER_FIXTURE_CACHE;
    else process.env.CKS_GO_BROWSER_FIXTURE_CACHE = previousCache;
  }
  browser = await playwright.chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  for (const width of [320, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const fixture = await installEmbeddedFixture(page, {
      sessionMode: "fresh",
      delaySessionExchange: true,
      delayProfile: true,
      delayAddresses: true,
      delayAssignment: true,
      advertisements: "live",
    });
    await page.goto(
      `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
    );
    await waiting(page, fixture, "sessionExchange");
    await paint(page);
    await check(
      `${width}: no authenticated UI or loaded acknowledgement before exchange`,
      async () => {
        assert.equal(await page.locator(".app-shell__scroll").count(), 0);
        assert.equal(
          await page
            .getByText("Getting CKS Go ready…", { exact: true })
            .count(),
          0,
        );
        const snapshot = await fixture.snapshot();
        assert.deepEqual(
          snapshot.embedded.native.map(({ message }) => message.type),
          ["bootstrap"],
        );
        assert.equal(paths(fixture, "/api/v1/customer/me").length, 0);
        assert.equal(
          paths(fixture, "/api/v1/customer/outlet-assignment").length,
          0,
        );
      },
    );
    fixture.release("sessionExchange");
    await waiting(page, fixture, "profile");
    await paint(page);
    await check(
      `${width}: native acknowledged once, profile pending uses lightweight shell`,
      async () => {
        const snapshot = await fixture.snapshot();
        assert.deepEqual(
          snapshot.embedded.native.map(({ message }) => message.type),
          ["bootstrap", "loaded"],
        );
        assert.equal(
          paths(fixture, "/api/v1/customer/session/exchange")[0].status,
          200,
        );
        assert.equal(
          await page
            .getByText("Getting CKS Go ready…", { exact: true })
            .count(),
          0,
        );
        assert.equal(await page.locator(".app-shell__scroll").count(), 1);
        await page
          .getByRole("heading", { name: "Loading your address", exact: true })
          .waitFor();
        await page.locator(".app-shell__scroll").evaluate((element) => {
          element.dataset.startupShell = "initial";
        });
        const measurement = await geometry(page);
        assert.equal(measurement.webLogoCount, 0);
        assert.equal(measurement.navigationCount, 1);
        assert.ok(measurement.scrollWidth <= measurement.clientWidth);
        return measurement;
      },
    );
    await screenshot(page, `${width}-profile-pending`);
    fixture.release("profile");
    await waiting(page, fixture, "addresses");
    await paint(page);
    await check(
      `${width}: address pending retains lightweight shell`,
      async () => {
        assert.equal(
          await page
            .getByText("Getting CKS Go ready…", { exact: true })
            .count(),
          0,
        );
        assert.equal(await page.locator(".app-shell__scroll").count(), 1);
        assert.equal((await geometry(page)).startupShellRetained, true);
        assert.equal(
          paths(fixture, "/api/v1/customer/outlet-assignment").length,
          0,
        );
      },
    );
    await screenshot(page, `${width}-address-pending`);
    fixture.release("addresses");
    await waiting(page, fixture, "assignment");
    await page
      .getByRole("heading", {
        name: "Checking delivery availability…",
        exact: true,
      })
      .waitFor();
    await check(
      `${width}: authenticated saved coordinates start one assignment`,
      async () => {
        assert.equal(
          paths(fixture, "/api/v1/customer/outlet-assignment").length,
          1,
        );
        assert.equal(
          paths(fixture, "/api/v1/customer/advertisements?placement=HOME_HERO")
            .length,
          0,
        );
        assert.equal(
          await page
            .getByText("Getting CKS Go ready…", { exact: true })
            .count(),
          0,
        );
      },
    );
    fixture.release("assignment");
    await page.getByText("Fixture rice", { exact: true }).first().waitFor();
    await page
      .getByAltText("HQ weekend grocery promotion", { exact: true })
      .waitFor();
    await paint(page);
    await check(
      `${width}: Home keeps shell, native header ownership and backend NONE banner`,
      async () => {
        const image = page.getByAltText("HQ weekend grocery promotion", {
          exact: true,
        });
        assert.equal(
          await image.evaluate(
            (element) => element.complete && element.naturalWidth > 0,
          ),
          true,
        );
        assert.match(
          await image.getAttribute("src"),
          /^\/api\/v1\/advertisement-media\//,
        );
        assert.equal(
          await image.evaluate(
            (element) => element.closest("button,a") !== null,
          ),
          false,
        );
        assert.equal(
          paths(fixture, "/api/v1/customer/advertisements?placement=HOME_HERO")
            .length,
          1,
        );
        const measurement = await geometry(page);
        assert.equal(measurement.webLogoCount, 0);
        assert.equal(measurement.navigationCount, 1);
        if (!red) assert.equal(measurement.startupShellRetained, true);
        assert.ok(measurement.scrollWidth <= measurement.clientWidth);
        assert.equal(fixture.trace.unexpectedRequests.length, 0);
        assert.equal(fixture.trace.errors.length, 0);
        return measurement;
      },
    );
    await screenshot(page, `${width}-home`);
    report.traces.push({
      width,
      session: "fresh",
      ...sanitize(await fixture.snapshot()),
    });
    await page.close();

    const restored = await browser.newPage({
      viewport: { width, height: 844 },
    });
    const empty = await installEmbeddedFixture(restored, {
      sessionMode: "restored",
      advertisements: [],
    });
    await restored.goto(
      `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
    );
    await restored.getByText("Fixture rice", { exact: true }).first().waitFor();
    await paint(restored);
    await check(
      `${width}: restored Home with zero advertisements has no fallback`,
      async () => {
        assert.equal(
          paths(empty, "/api/v1/customer/advertisements?placement=HOME_HERO")
            .length,
          1,
        );
        assert.equal(
          await restored
            .getByAltText("HQ weekend grocery promotion", { exact: true })
            .count(),
          0,
        );
        assert.equal(
          await restored.locator(".advertising-carousel").count(),
          0,
        );
        assert.equal(
          await restored
            .getByText("Getting CKS Go ready…", { exact: true })
            .count(),
          0,
        );
        assert.equal(
          paths(empty, "/api/v1/customer/session/bootstrap").length,
          0,
        );
        assert.deepEqual(
          (await empty.snapshot()).embedded.native.map(
            ({ message }) => message.type,
          ),
          ["loaded"],
        );
        assert.equal(empty.trace.unexpectedRequests.length, 0);
        assert.equal(empty.trace.errors.length, 0);
      },
    );
    report.traces.push({
      width,
      session: "restored",
      ...sanitize(await empty.snapshot()),
    });
    await restored.close();
  }
} catch (error) {
  report.fatalError = String(error.stack ?? error);
} finally {
  await browser?.close();
  server?.process.kill();
  report.serverCleanedUp = Boolean(server?.process.killed);
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: report.checks.filter((entry) => entry.status === "PASS").length,
    failed: report.checks.filter((entry) => entry.status === "FAIL").length,
    fatal: Boolean(report.fatalError),
  };
  await fs.writeFile(
    path.join(
      directory,
      red ? "startup-red-report.json" : "startup-browser-report.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed || report.summary.fatal) process.exitCode = 1;
}
