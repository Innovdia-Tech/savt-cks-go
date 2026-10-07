import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  directory,
  installEmbeddedFixture,
  playwright,
  startFixtureServer,
  stopFixtureServer,
} from "./browser-fixtures.mjs";

const nativeDirectory =
  "C:/Users/isaac/Documents/ChatGPT/CKS go frontend/merch-home01-native";
const nativeSource = path.join(
  nativeDirectory,
  "lib/features/cks_go/cks_go_host_screen.dart",
);
const report = {
  task: "CUST-UX-BATCH01 address native boundary diagnostic",
  startedAt: new Date().toISOString(),
  scope:
    "Actual production customer main.tsx and BrowserDeliveryLocationPort; native singleflight shim mirrors read-only Flutter host source. This is not a physical-device capture.",
  physicalWebView: "PENDING",
  outcome: "PENDING",
};
let browser, server;
try {
  const nativeText = await fs.readFile(nativeSource, "utf8");
  assert.ok(
    nativeText.includes(
      "if (_phase != _CksGoHostPhase.loaded || _locationInFlight) return;",
    ),
  );
  report.nativeBoundary = {
    source: nativeSource,
    head: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: nativeDirectory,
      encoding: "utf8",
      windowsHide: true,
    }).trim(),
    guardLine: 343,
    guard: "if (_phase != _CksGoHostPhase.loaded || _locationInFlight) return;",
    inFlightSetLine: 375,
    inFlightClearedLine: 394,
    interpretation:
      "The host silently drops a new request while its previous location operation is pending. Web port dispose removes the old listener/rejects its local promise and has no native cancellation message.",
  };
  process.env.CKS_GO_BROWSER_FIXTURE_CACHE = "address-native-boundary";
  server = await startFixtureServer(5212);
  browser = await playwright.chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fixture = await installEmbeddedFixture(page, { holdLocation: true });
  await page.goto(
    `${server.origin}/verification/cust-ux-batch01/address-fixture.html`,
  );
  await page.getByText("Fixture rice", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Change delivery address" }).click();
  await page
    .getByRole("button", { name: "Use my current location", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finding your location…", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("heading", { name: "Delivery address", exact: true })
    .waitFor();
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
    .getByRole("alert")
    .filter({ hasText: "We couldn’t get your current location." })
    .waitFor({ timeout: 25000 });
  const evidence = await fixture.snapshot();
  const requests = evidence.embedded.native.filter(
    ({ message }) => message.type === "location-current",
  );
  assert.equal(requests.length, 2);
  assert.notEqual(requests[0].message.requestId, requests[1].message.requestId);
  assert.equal(evidence.embedded.dropped.length, 1);
  assert.equal(
    evidence.embedded.dropped[0].requestId,
    requests[1].message.requestId,
  );
  assert.equal(evidence.embedded.replies.length, 1);
  assert.equal(
    evidence.embedded.replies[0].detail.requestId,
    requests[0].message.requestId,
  );
  assert.equal(evidence.embedded.maps.length, 0);
  assert.equal(evidence.errors.length, 0);
  assert.equal(evidence.unexpectedRequests.length, 0);
  report.outcome =
    "NATIVE FOLLOW-UP REQUIRED — modeled pre-existing unmount/reentry boundary";
  report.steps = [
    "Stable authenticated Home",
    "Open Delivery address",
    "Tap current location once",
    "Back out while the native request is still pending (location component unmounts)",
    "Reenter current location with one explicit tap",
    "Second request is dropped by the modeled host in-flight guard",
    "First reply uses the old requestId and cannot complete the new web request",
    "New request times out; no automatic retry was sent",
  ];
  report.evidence = evidence;
  report.requiredNativeRepair =
    "The host must handle a new request after web cancellation/navigation explicitly, with correlated cancellation or queued completion, instead of silently discarding it behind _locationInFlight. No Flutter/native change or frontend retry was added.";
  await page.screenshot({
    path: path.join(directory, "address-native-unmount-reentry-timeout.png"),
    fullPage: true,
  });
} catch (error) {
  report.outcome = "DIAGNOSTIC SETUP FAILED";
  report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  report.serverCleanedUp = server ? await stopFixtureServer(server) : true;
  if (!report.serverCleanedUp) {
    report.error = "Fixture server did not close within five seconds.";
    process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(
    path.join(directory, "address-native-boundary-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ outcome: report.outcome, error: report.error ?? null }),
  );
}
