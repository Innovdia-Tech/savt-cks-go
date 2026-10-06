import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = createRequire(import.meta.url)("playwright");
const fixtures = [
  "legacy-percentage",
  "legacy-percentage-minimum",
  "legacy-fixed",
  "small-charged",
  "small-no-match",
  "small-zero-tier",
  "small-disabled",
];
const load = (name) =>
  JSON.parse(
    readFileSync(
      `src/checkout/fixtures/small-order-fee01/${name}.json`,
      "utf8",
    ),
  );
const output = "docs/verification/small-order-fee01";
mkdirSync(output, { recursive: true });
const server = await createServer({
  configFile: false,
  plugins: [react()],
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom/client", "react/jsx-dev-runtime"],
  },
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
const results = [];
const errors = [];
let forbiddenRequests = 0;
async function summary(page, selector, label, expected) {
  const amount = await page
    .locator(`${selector} dt`, { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd[1]")
    .innerText();
  assert.equal(amount.replace(/\s/g, ""), `RM${(expected / 100).toFixed(2)}`);
}
async function layout(page) {
  assert.equal(
    await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          "html, body, .app-shell, .app-shell__scroll, .quote-card, .order-section",
        ),
      ).some((el) => el.scrollWidth > el.clientWidth + 1),
    ),
    false,
  );
  const amounts = await page
    .locator(
      ".quote-totals > dd:not(.processing-fee-notes), .order-money > dd:not(.processing-fee-notes)",
    )
    .evaluateAll((els) =>
      els.map((el) => ({
        width: el.clientWidth,
        scroll: el.scrollWidth,
        right: el.getBoundingClientRect().right,
      })),
    );
  assert.ok(amounts.every((a) => a.scroll <= a.width + 1));
  assert.ok(amounts.every((a) => Math.abs(a.right - amounts[0].right) <= 1));
}
async function open(name, width, screen = "basket", handler) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/.*(?:payment|settings)|gkash/i.test(r.url()))
      forbiddenRequests++;
  });
  const requests = [];
  await page.route("**/api/v1/checkout/quote", async (route) => {
    requests.push(route.request());
    if (handler) return handler(route, requests.length);
    return route.fulfill({ status: 201, json: load(name) });
  });
  await page.goto(
    `${server.resolvedUrls.local[0]}verification/small-order-fee.html?fixture=${name}&screen=${screen}`,
  );
  return { page, requests };
}
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  for (const width of [390, 320]) {
    for (const name of fixtures) {
      const { page, requests } = await open(name, width);
      assert.equal(requests.length, 0);
      assert.equal(await page.locator(".quote-totals").count(), 0);
      assert.equal(await page.getByRole("button", { name: /^Pay/ }).count(), 0);
      await page.getByRole("button", { name: "Checkout", exact: true }).click();
      await page
        .getByText("Prices and fees confirmed", { exact: true })
        .waitFor();
      const d = load(name).data;
      const label = name.startsWith("small-")
        ? "Small order processing fee"
        : "Processing fee";
      await summary(page, ".quote-totals", label, d.processingFeeMinor);
      await summary(page, ".quote-totals", "Total", d.grandTotalMinor);
      assert.equal(
        await page.getByRole("button", { name: /^Pay/ }).isEnabled(),
        true,
      );
      assert.equal(
        await page
          .getByRole("button", { name: /^Pay/ })
          .evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgb(229, 35, 41)",
      );
      assert.equal(
        (await page.getByRole("button", { name: /^Pay/ }).innerText()).replace(
          /\s/g,
          "",
        ),
        `PayRM${(d.grandTotalMinor / 100).toFixed(2)}`,
      );
      assert.equal(requests.length, 1);
      assert.equal(
        requests[0].headers()["x-cks-fee-contract"],
        "small-order-fee-v1",
      );
      if (name.startsWith("small-")) {
        const labels = await page.locator(".quote-totals dt").allTextContents();
        assert.deepEqual(labels, [
          "Items subtotal",
          "Delivery fee",
          label,
          "Total",
        ]);
        assert.equal(
          await page
            .getByText("No small order fee for this order.", { exact: true })
            .count(),
          name === "small-no-match" || name === "small-zero-tier" ? 1 : 0,
        );
        const disclosure = page.locator(".processing-fee-notes summary");
        await disclosure.focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page
            .locator(".processing-fee-notes details")
            .getAttribute("open"),
          "",
        );
        await disclosure.click();
        assert.equal(
          await page
            .locator(".processing-fee-notes details")
            .getAttribute("open"),
          null,
        );
      }
      await layout(page);
      if (
        [
          "small-charged",
          "small-zero-tier",
          "small-disabled",
          "legacy-percentage-minimum",
        ].includes(name)
      ) {
        await page.evaluate(() => document.activeElement?.blur());
        await page.locator(".quote-card").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${output}/basket-${name}-${width}.png`,
        });
        await page
          .locator(".quote-card")
          .screenshot({ path: `${output}/summary-${name}-${width}.png` });
      }
      results.push({
        screen: "Basket/Checkout",
        fixture: name,
        width,
        fee: d.processingFeeMinor,
        total: d.grandTotalMinor,
        paymentEnabled: true,
        overflow: false,
      });
      await page.close();
    }
    for (const name of [
      "legacy-percentage",
      "small-charged",
      "small-zero-tier",
      "small-disabled",
    ]) {
      const { page } = await open(name, width, "order");
      await page.getByText("Payment summary", { exact: true }).waitFor();
      await summary(
        page,
        ".order-money",
        name.startsWith("small-")
          ? "Small order processing fee"
          : "Processing fee",
        load(name).data.processingFeeMinor,
      );
      await summary(
        page,
        ".order-money",
        "Grand total",
        load(name).data.grandTotalMinor,
      );
      await layout(page);
      await page.locator("#order-total-title").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${output}/order-${name}-${width}.png` });
      await page
        .locator(".order-section", { has: page.locator("#order-total-title") })
        .screenshot({ path: `${output}/order-summary-${name}-${width}.png` });
      results.push({
        screen: "Order detail",
        fixture: name,
        width,
        overflow: false,
      });
      await page.close();
    }
  }

  // Existing controller recovery exercised with the new server shape.
  const retry = await open("small-charged", 390, "basket", (route, count) =>
    count === 1
      ? route.abort("failed")
      : route.fulfill({ status: 201, json: load("small-charged") }),
  );
  await retry.page
    .getByRole("button", { name: "Checkout", exact: true })
    .click();
  await retry.page
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await retry.page.getByRole("button", { name: /^Pay/ }).waitFor();
  assert.equal(
    retry.requests[0].headers()["idempotency-key"],
    retry.requests[1].headers()["idempotency-key"],
  );
  await retry.page.evaluate(() => window.smallFeeProof.changeAddress());
  assert.equal(await retry.page.locator(".quote-totals").count(), 0);
  assert.equal(
    await retry.page.getByRole("button", { name: /^Pay/ }).count(),
    0,
  );
  await retry.page
    .getByRole("button", { name: "Checkout", exact: true })
    .click();
  await retry.page.getByRole("button", { name: /^Pay/ }).waitFor();
  assert.equal(
    await retry.page.evaluate(() => window.smallFeeProof.freeze()),
    true,
  );
  assert.equal(
    await retry.page
      .getByRole("button", { name: "Increase quantity" })
      .first()
      .isDisabled(),
    true,
  );
  assert.equal(
    await retry.page
      .getByRole("button", { name: "Change delivery address" })
      .isDisabled(),
    true,
  );
  results.push({
    recovery: "same-key network retry, address invalidation, payment freeze",
    passed: true,
  });
  await retry.page.close();
  for (const scenario of ["legacy-absence", "discounted", "invalid-evidence"]) {
    const { page } = await open(
      scenario === "legacy-absence" ? "legacy-percentage" : "small-charged",
      320,
      "basket",
      (route) => {
        const response = load(
          scenario === "legacy-absence" ? "legacy-percentage" : "small-charged",
        );
        if (scenario === "legacy-absence")
          delete response.data.processingFee.minimumAmountMinor;
        if (scenario === "discounted") {
          Object.assign(response.data, {
            discountAmountMinor: 200,
            netItemsTotalMinor: 800,
            processingFeeBasisMinor: 1300,
            processingFeeMinor: 500,
            grandTotalMinor: 1800,
          });
          Object.assign(response.data.processingFee, {
            qualifyingAmountMinor: 800,
            matchedTier: { fromMinor: 0, belowMinor: 1000, chargeMinor: 500 },
          });
        }
        if (scenario === "invalid-evidence")
          response.data.processingFee.qualifyingAmountMinor = 1500;
        return route.fulfill({ status: 201, json: response });
      },
    );
    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    if (scenario === "invalid-evidence") {
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .waitFor();
      assert.equal(await page.locator(".quote-totals").count(), 0);
      assert.equal(await page.getByRole("button", { name: /^Pay/ }).count(), 0);
    } else {
      await page.getByRole("button", { name: /^Pay/ }).waitFor();
      if (scenario === "discounted") {
        await summary(
          page,
          ".quote-totals",
          "Items total after discounts",
          800,
        );
        await summary(page, ".quote-totals", "Small order processing fee", 500);
        assert.equal(
          (
            await page
              .locator(".quote-totals dt", { hasText: /^Discounts$/ })
              .locator("xpath=following-sibling::dd[1]")
              .innerText()
          ).replace(/\s/g, ""),
          "−RM2.00",
        );
        await page
          .locator(".quote-card")
          .screenshot({ path: `${output}/summary-discounted-320.png` });
      } else await summary(page, ".quote-totals", "Processing fee", 45);
    }
    await layout(page);
    results.push({ scenario, width: 320, passed: true });
    await page.close();
  }
  for (const code of [
    "CHECKOUT_FEE_CONTRACT_UPGRADE_REQUIRED",
    "CHECKOUT_PROCESSING_FEE_UNCONFIGURED",
    "CHECKOUT_PROCESSING_FEE_INVALID",
  ]) {
    const { page } = await open("small-charged", 320, "basket", (route) =>
      route.fulfill({
        status: 409,
        json: { error: { code, message: "private backend details" } },
      }),
    );
    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".cart-line").count(), 1);
    assert.equal(await page.locator(".quote-totals").count(), 0);
    assert.equal(await page.getByRole("button", { name: /^Pay/ }).count(), 0);
    assert.equal(
      (await page.locator("body").innerText()).includes(code),
      false,
    );
    await layout(page);
    results.push({
      conflict: code,
      basketRetained: true,
      noFinalFeeOrPaymentAction: true,
    });
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.equal(forbiddenRequests, 0);
  const report = {
    synthetic: true,
    physicalAndroid: "pending",
    browser: await browser.version(),
    results,
    errors,
    forbiddenRequests,
  };
  writeFileSync(
    `${output}/browser.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
