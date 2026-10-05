// Local HTTP 201 fixtures through real QuoteApi, CartController and CartScreen.
// Uses the existing Playwright runtime via NODE_PATH; no dependency changes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = createRequire(import.meta.url)("playwright");
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
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  for (const [scenario, fee, total] of [
    ["legacy", "0.42", "14.32"],
    ["null", "0.42", "14.32"],
    ["zero", "0.42", "14.32"],
    ["rm50", "2.00", "52.00"],
    ["rm100", "3.00", "103.00"],
    ["authoritative", "2.25", "52.25"],
    ["invalid", null, null],
    ["fixed-minimum", null, null],
    ["malformed-total", null, null],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/v1/checkout/quote", async (route) => {
      const request = route.request();
      requests.push(request);
      const response = await page.evaluate(async (selected) => {
        const fixtures = await import("/src/checkout/test-fixtures.ts");
        const value =
          selected === "rm100"
            ? fixtures.minimumQuoteEnvelope(10000)
            : selected === "rm50" || selected === "authoritative"
              ? fixtures.minimumQuoteEnvelope(5000)
              : fixtures.quoteEnvelope();
        if (
          selected === "null" ||
          selected === "zero" ||
          selected === "invalid"
        )
          value.data.processingFee.minimumAmountMinor =
            selected === "null" ? null : selected === "zero" ? 0 : -1;
        if (selected === "fixed-minimum")
          Object.assign(value.data.processingFee, {
            feeType: "FIXED",
            rate: null,
            fixedAmountMinor: 42,
            minimumAmountMinor: 0,
          });
        if (selected === "malformed-total") value.data.grandTotalMinor = 999;
        if (selected === "authoritative") {
          value.data.processingFeeMinor = 225;
          value.data.grandTotalMinor = 5225;
        }
        return value;
      }, scenario);
      await route.fulfill({ status: 201, json: response });
    });
    await page.goto(
      `${origin}verification/checkout-processing-fee.html?scenario=${scenario}`,
    );
    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    if (fee !== null) {
      await page
        .getByText("Prices and fees confirmed", { exact: true })
        .waitFor();
      for (const [label, amount] of [
        ["Processing fee", fee],
        ["Total", total],
      ]) {
        const text = await page
          .locator(".quote-totals dt", { hasText: new RegExp(`^${label}$`) })
          .locator("xpath=following-sibling::dd[1]")
          .innerText();
        assert.match(text, new RegExp(`^RM\\s*${amount.replace(".", "\\.")}$`));
      }
    } else {
      await page.getByRole("button", { name: /try again/i }).waitFor();
      assert.equal(await page.locator(".quote-totals").count(), 0);
    }
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method(), "POST");
    const body = requests[0].postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), [
      "customerAddressId",
      "deliveryType",
      "items",
      "outletId",
    ]);
    assert.equal(body.deliveryType, "NOW");
    assert.deepEqual(Object.keys(body.items[0]).sort(), [
      "outletProductId",
      "quantity",
    ]);
    assert.ok(requests[0].headers()["x-cks-csrf"]);
    assert.ok(requests[0].headers()["idempotency-key"]);
    assert.deepEqual(errors, []);
    assert.equal(
      (await page.locator("body").innerText()).includes(
        "memory-only-quote-token",
      ),
      false,
    );
    results.push({ scenario, status: 201, fee, total, passed: true });
    await page.close();
  }
  console.log(
    JSON.stringify({ synthetic: true, width: 390, results }, null, 2),
  );
} finally {
  await browser?.close();
  await server.close();
}
