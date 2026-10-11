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

const outputDirectory = path.join(directory, "followup");
const report = {
  task: "CUST-UX-BATCH01 address lifecycle follow-up",
  scope: "Actual main.tsx mounted under React StrictMode",
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
};

let server;
let browser;
let page;
let fixture;

try {
  await fs.mkdir(outputDirectory, { recursive: true });
  process.env.CKS_GO_BROWSER_FIXTURE_CACHE = "address-followup";
  server = await startFixtureServer(5213, false);
  browser = await playwright.chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  fixture = await installEmbeddedFixture(page, { holdLocation: true });
  await page.goto(
    `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
  );
  await page
    .getByRole("button", { name: "Change delivery address" })
    .waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Change delivery address" }).click();
  await page
    .getByRole("button", { name: "Use my current location", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.__embeddedTrace.native.filter(
        ({ message }) => message.type === "location-current",
      ).length === 1,
  );
  await fixture.release("location");
  await page
    .getByRole("button", { name: "Confirm this location", exact: true })
    .waitFor({ timeout: 2_000 });
  await page.screenshot({
    path: path.join(outputDirectory, "strictmode-location-map.png"),
    fullPage: true,
  });
  const evidence = await fixture.snapshot();
  assert.equal(
    evidence.embedded.native.filter(
      ({ message }) => message.type === "location-current",
    ).length,
    1,
  );
  assert.ok(evidence.embedded.maps.length > 0);
  assert.equal(evidence.embedded.dropped.length, 0);
  report.checks.push({
    name: "StrictMode replay retains one live direct-GPS request through map entry",
    status: "PASS",
    evidence,
  });

  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  fixture = await installEmbeddedFixture(page, {
    holdLocation: true,
    nativeNullAddress: true,
    holdReverse: true,
  });
  await page.goto(
    `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
  );
  await page
    .getByRole("button", { name: "Change delivery address" })
    .waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Change delivery address" }).click();
  await page
    .getByRole("button", { name: "Use my current location", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.__embeddedTrace.native.filter(
        ({ message }) => message.type === "location-current",
      ).length === 1,
  );
  await fixture.release("location");
  const confirm = page.getByRole("button", {
    name: "Confirm this location",
    exact: true,
  });
  await confirm.waitFor();
  await page.waitForFunction(
    () => document.querySelector(".delivery-setup__primary")?.disabled,
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      fixture.trace.requests.some(
        ({ path }) => path === "/api/v1/customer/location/reverse",
      )
    )
      break;
    await page.waitForTimeout(25);
  }
  const pendingEvidence = await fixture.snapshot();
  const reply = pendingEvidence.embedded.replies[0].detail;
  assert.deepEqual(
    Object.keys(reply).sort(),
    [
      "protocolVersion",
      "requestId",
      "status",
      "latitude",
      "longitude",
      "formattedAddress",
      "addressLine1",
      "city",
      "state",
      "postcode",
    ].sort(),
  );
  assert.equal(reply.status, "ok");
  assert.equal(reply.latitude, 5.92);
  assert.equal(reply.longitude, 116.08);
  assert.deepEqual(
    [
      reply.formattedAddress,
      reply.addressLine1,
      reply.city,
      reply.state,
      reply.postcode,
    ],
    [null, null, null, null, null],
  );
  assert.ok(pendingEvidence.embedded.maps.length > 0);
  assert.equal(await confirm.isDisabled(), true);
  assert.equal(
    pendingEvidence.requests.filter(
      ({ path }) => path === "/api/v1/customer/location/reverse",
    ).length,
    1,
  );
  assert.deepEqual(pendingEvidence.embedded.maps[0].center, {
    lat: 5.92,
    lng: 116.08,
  });
  const reverseRequest = pendingEvidence.requests.find(
    ({ path }) => path === "/api/v1/customer/location/reverse",
  );
  assert.deepEqual(reverseRequest.body, {
    latitude: 5.92,
    longitude: 116.08,
  });
  await page.screenshot({
    path: path.join(outputDirectory, "null-address-parser-pending.png"),
    fullPage: true,
  });
  await fixture.release("reverse");
  await page.waitForFunction(
    () => !document.querySelector(".delivery-setup__primary")?.disabled,
  );
  await page
    .getByText("1 Example Street, Kota Kinabalu, Sabah", { exact: true })
    .waitFor();
  await confirm.click();
  await page
    .getByRole("heading", { name: "Delivery details", exact: true })
    .waitFor();
  await page
    .getByText("1 Example Street, Kota Kinabalu, Sabah", { exact: true })
    .waitFor();
  const detailPrefill = {
    addressLine1: await page
      .getByLabel("Building / Residence / Street", { exact: true })
      .inputValue(),
    city: await page.getByLabel("City", { exact: true }).inputValue(),
    state: await page.getByLabel("State", { exact: true }).inputValue(),
    postcode: await page
      .getByLabel("Postcode (optional)", { exact: true })
      .inputValue(),
  };
  assert.deepEqual(detailPrefill, {
    addressLine1: "1 Example Street",
    city: "Kota Kinabalu",
    state: "Sabah",
    postcode: "88000",
  });
  await page.screenshot({
    path: path.join(outputDirectory, "null-address-parser-details.png"),
    fullPage: true,
  });
  const resolvedEvidence = await fixture.snapshot();
  assert.equal(resolvedEvidence.errors.length, 0);
  assert.equal(resolvedEvidence.unexpectedRequests.length, 0);
  report.checks.push({
    name: "Ten-key native null-address payload enters map and waits for authoritative reverse address",
    status: "PASS",
    evidence: {
      pending: pendingEvidence,
      resolved: resolvedEvidence,
      resolvedSummary: "1 Example Street, Kota Kinabalu, Sabah",
      detailPrefill,
    },
  });

  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  fixture = await installEmbeddedFixture(page, {
    holdLocation: true,
    locationStatus: "unavailable",
  });
  await page.goto(
    `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
  );
  await page
    .getByRole("button", { name: "Change delivery address" })
    .waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Change delivery address" }).click();
  await page
    .getByRole("button", { name: "Use my current location", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.__embeddedTrace.native.filter(
        ({ message }) => message.type === "location-current",
      ).length === 1,
  );
  await page.evaluate(() => {
    window.__releaseLocation();
    document.querySelector(".delivery-flow__back")?.click();
  });
  await page
    .getByRole("heading", { name: "Delivery address", exact: true })
    .waitFor({ timeout: 2_000 });
  assert.equal(await page.getByRole("alert").count(), 0);
  await page
    .getByRole("button", { name: /Search building, street or postcode/ })
    .click();
  await page
    .getByRole("heading", { name: "Search location", exact: true })
    .waitFor({ timeout: 2_000 });
  const abandonmentEvidence = await fixture.snapshot();
  assert.equal(abandonmentEvidence.errors.length, 0);
  report.checks.push({
    name: "An abandoned GPS rejection cannot close a newer Search instance",
    status: "PASS",
    evidence: abandonmentEvidence,
  });

  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  fixture = await installEmbeddedFixture(page, {
    locationStatus: "unavailable",
  });
  await page.goto(
    `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
  );
  await page
    .getByRole("button", { name: "Change delivery address" })
    .waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Change delivery address" }).click();
  await page
    .getByRole("button", { name: "Use my current location", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({
      hasText:
        "We couldn’t get your current location. Try again or search for an address.",
    })
    .waitFor({ timeout: 2_000 });
  await page
    .getByRole("heading", { name: "Delivery address", exact: true })
    .waitFor();
  const errorEvidence = await fixture.snapshot();
  assert.equal(errorEvidence.embedded.maps.length, 0);
  assert.equal(errorEvidence.errors.length, 0);
  report.checks.push({
    name: "A genuine direct-GPS failure returns to the picker error state",
    status: "PASS",
    evidence: errorEvidence,
  });
} catch (error) {
  const evidence = fixture ? await fixture.snapshot() : undefined;
  report.checks.push({
    name: "Address follow-up browser flow",
    status: "FAIL",
    error: String(error.message ?? error),
    ...(evidence ? { evidence } : {}),
  });
  if (page && !page.isClosed())
    await page.screenshot({
      path: path.join(outputDirectory, "strictmode-location-failure.png"),
      fullPage: true,
    });
} finally {
  if (browser) await browser.close();
  report.serverCleanedUp = server ? await stopFixtureServer(server) : true;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    pass: report.checks.filter((check) => check.status === "PASS").length,
    fail: report.checks.filter((check) => check.status === "FAIL").length,
    errors: report.errors.length,
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(
    path.join(outputDirectory, "address-followup-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report.summary));
  if (report.summary.fail || report.errors.length) process.exitCode = 1;
}
