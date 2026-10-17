import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ??
    "C:/Users/isaac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const origin = process.env.CKS_LEGAL_ORIGIN ?? "http://127.0.0.1:5341";
const output = path.resolve("verification/legal-ux01/screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ??
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const checks = [];
const errors = [];
const check = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function open(width, fixture = false) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(15_000);
  console.log(`Opening ${width}px ${fixture ? "fixture" : "app"}`);
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.log("PAGE ERROR " + error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.log("CONSOLE " + message.text());
  });
  page.on("requestfailed", (request) =>
    console.log(
      "REQUEST FAILED " + request.url() + " " + request.failure()?.errorText,
    ),
  );
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
  if (!fixture)
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
  await page.goto(
    fixture
      ? `${origin}/verification/legal-ux01/harness.html`
      : `${origin}/?scenario=cust-shop01r`,
  );
  console.log("Loaded " + (await page.title()));
  return page;
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, name + ".png") });
}
try {
  for (const width of [320, 390, 430]) {
    const page = await open(width);
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .waitFor();
    await page.evaluate(() => {
      location.hash = "profile";
    });
    await page
      .getByRole("button", { name: "Legal & Policies", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Legal & Policies", exact: true })
      .waitFor();
    await capture(page, `${width}-policy-centre`);
    assert.equal(
      await page
        .locator("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      location.hash = "categories";
    });
    await page
      .locator('.catalogue-tile button[aria-label^="Add "]:not([disabled])')
      .first()
      .click();
    await page.getByRole("button", { name: /^View basket, / }).click();
    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    const pay = page.getByRole("button", { name: /^Proceed to Payment/ });
    await pay.waitFor();
    assert.equal(await pay.isEnabled(), true);
    assert.equal(await page.getByRole("checkbox").count(), 0);
    await pay.scrollIntoViewIfNeeded();
    await capture(page, `${width}-checkout-inactive`);
    const before = await page.locator(".cart-lines").innerText();
    await page
      .getByRole("button", { name: "Legal & Policies", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Legal & Policies", exact: true })
      .waitFor();
    for (const title of [
      "Terms & Conditions",
      "Delivery Policy",
      "Cancellation & Refund Policy",
      "Privacy Notice",
    ]) {
      assert.equal(
        await page
          .getByRole("button", {
            name: `${title} Not published yet`,
            exact: true,
          })
          .isDisabled(),
        true,
      );
    }
    await page
      .getByRole("button", { name: "Return to checkout", exact: true })
      .click();
    assert.equal(await page.locator(".cart-lines").innerText(), before);
    assert.equal(await pay.isEnabled(), true);
    check(
      `${width}px: Profile entry, unpublished directory, no inactive checkbox, checkout state retained, no overflow`,
    );
    await page.close();
  }
  const page = await open(390, true);
  const pay = page.getByRole("button", { name: /^Proceed to Payment/ });
  const box = page.getByRole("checkbox");
  await page
    .getByText("Read the policies and tick the box to continue.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await box.isChecked(), false);
  assert.equal(await pay.isDisabled(), true);
  await page
    .getByRole("button", { name: "Terms & Conditions", exact: true })
    .click();
  await page
    .getByText("LOCAL TEST FIXTURE — NOT A LEGAL DOCUMENT.", { exact: false })
    .waitFor();
  await capture(page, "390-policy-reader-fixture");
  await page.evaluate(() =>
    window.dispatchEvent(
      new Event("cks-go-delivery-back", { cancelable: true }),
    ),
  );
  await page
    .getByRole("heading", { name: "Legal & Policies", exact: true })
    .waitFor();
  await page.evaluate(() =>
    window.dispatchEvent(
      new Event("cks-go-delivery-back", { cancelable: true }),
    ),
  );
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Terms & Conditions",
  );
  check("Savt native Back: reader → centre → checkout, focus restored");
  await capture(page, "390-checkout-required-fixture");
  await box.focus();
  await page.keyboard.press("Space");
  await page
    .getByText("Your agreement has been recorded for this checkout.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await pay.isEnabled(), true);
  await pay.dblclick();
  assert.equal(await page.evaluate(() => window.__legalFixture.initiations), 1);
  check(
    "Server-fixture receipt required before initiation; duplicate action suppressed",
  );
  await page.evaluate(() => {
    window.__legalFixture.version = "test-v2";
  });
  await pay.click();
  assert.equal(await box.isChecked(), false);
  assert.equal(await pay.isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__legalFixture.initiations), 1);
  check("Version change revokes consent and prevents payment");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByText("Read the policies and tick the box to continue.", {
      exact: true,
    })
    .waitFor();
  await page.evaluate(() => {
    window.__legalFixture.delay = 250;
  });
  await box.check();
  await box.uncheck();
  await page.waitForTimeout(350);
  assert.equal(await box.isChecked(), false);
  assert.equal(await pay.isDisabled(), true);
  check("Unchecking during save ignores stale acceptance response");
  await page.evaluate(() => {
    window.__legalFixture.delay = 0;
    window.__legalFixture.offline = true;
  });
  await box.check();
  await page.getByRole("alert").waitFor();
  assert.equal(await pay.isDisabled(), true);
  await page.evaluate(() => {
    window.__legalFixture.offline = false;
  });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByText("Read the policies and tick the box to continue.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await box.isChecked(), false);
  check(
    "Failed acceptance blocks payment; explicit retry does not auto-accept",
  );
  await page.close();
  assert.deepEqual(errors, []);
  await writeFile(
    path.resolve("verification/legal-ux01/browser-results.json"),
    JSON.stringify(
      {
        checks,
        errors,
        network: "loopback only; external requests blocked",
        device: "Chromium mobile viewport emulation, not physical Savt WebView",
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
