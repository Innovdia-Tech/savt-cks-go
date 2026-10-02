// Local synthetic browser acceptance; no provider calls or production credentials.
// Start Vite with VITE_CKS_GO_DEVELOPMENT_API=true and
// VITE_CKS_GO_DEVELOPMENT_BRIDGE=true. Supply NODE_PATH for Playwright when needed.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.PAY06B_ORIGIN ?? "http://127.0.0.1:5286";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const output =
  process.env.PAY06B_EVIDENCE_DIR ?? join(tmpdir(), "pay06b-browser");
await mkdir(output, { recursive: true });
const oldIntent = "20000000-0000-4000-8000-000000000002";
const successor = "20000000-0000-4000-8000-000000000003";
const oldUrl = "https://payments.example.test/checkout/initial";
const newUrl = "https://payments.example.test/checkout/successor";
const order = {
  orderId: "40000000-0000-4000-8000-000000000004",
  orderNumber: "ORD-2026-0001",
  status: "NEW",
};
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
const results = [];

async function run(width, scenario) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
  });
  const errors = [];
  const requests = { creates: [], statuses: [], retries: [], handoffs: [] };
  let checkoutReference;
  let releaseRetry;
  let status = "PENDING";
  let rejectHandoff = scenario === "handoff-error";
  page.on("pageerror", (error) => errors.push(error.message));
  // Only the native interface is global. Payment/session/URL state stays in real controllers.
  await page.addInitScript(() => {
    window.SavtCksGoBridge = { postMessage() {} };
  });
  await page.route("**/src/main.tsx*", async (route) => {
    const response = await route.fetch();
    let source = await response.text();
    assert(
      source.includes(
        "new PaymentApi(config.apiOrigin, session, catalogueDevelopment?.fetch)",
      ),
    );
    source = source.replace(
      "new PaymentApi(config.apiOrigin, session, catalogueDevelopment?.fetch)",
      "new PaymentApi('', session)",
    );
    source = source.replace(
      "const payment = new PaymentController(",
      `
      const originalHandoff = bridge.requestPaymentHandoff.bind(bridge);
      bridge.requestPaymentHandoff = async (checkoutUrl) => {
        const response = await fetch('/__pay06b-handoff', { method: 'POST', body: JSON.stringify({ checkoutUrl }) });
        if (!response.ok) throw new Error('Synthetic bridge failure');
        await originalHandoff(checkoutUrl);
      };
      const payment = new PaymentController(`,
    );
    await route.fulfill({ response, body: source });
  });
  await page.route("**/__pay06b-handoff", async (route) => {
    requests.handoffs.push(route.request().postDataJSON().checkoutUrl);
    const fail = rejectHandoff;
    rejectHandoff = false;
    await route.fulfill({ status: fail ? 503 : 200, body: "" });
  });
  const json = (route, data, responseStatus = 200) =>
    route.fulfill({ status: responseStatus, json: { data } });
  await page.route("**/api/v1/customer/checkout/payments**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/retry")) {
      assert.equal(request.method(), "POST");
      assert.equal(request.postData(), null);
      assert(request.headers()["x-cks-csrf"]);
      assert.match(request.headers()["idempotency-key"], /^[0-9a-f-]{36}$/);
      requests.retries.push({
        path,
        key: request.headers()["idempotency-key"],
      });
      await new Promise((resolve) => {
        releaseRetry = resolve;
      });
      if (scenario === "voucher")
        return route.fulfill({
          status: 409,
          json: {
            error: {
              code: "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
              message: "private provider detail",
            },
          },
        });
      if (scenario === "uncertain" && requests.retries.length === 1)
        return route.abort("failed");
      if (
        ["processing", "paid", "failed", "no-url", "uncertain"].includes(
          scenario,
        )
      ) {
        const finalStatus =
          scenario === "processing"
            ? "PAID_PROCESSING"
            : scenario === "paid"
              ? "PAID"
              : scenario === "failed"
                ? "FAILED"
                : "PENDING";
        return json(route, {
          checkoutReference,
          status: finalStatus,
          order: finalStatus === "PAID" ? order : null,
        });
      }
      if (scenario === "invalid")
        return json(route, {
          checkoutReference,
          status: ["PENDING"],
          order: null,
        });
      return json(route, {
        checkoutReference,
        payment: {
          paymentIntentId: successor,
          status: "PENDING",
          checkoutUrl: newUrl,
        },
      });
    }
    if (request.method() === "POST") {
      checkoutReference = request.postDataJSON().quoteId;
      requests.creates.push(path);
      return json(
        route,
        {
          checkoutReference,
          payment: {
            paymentIntentId: oldIntent,
            status: "PENDING",
            checkoutUrl: oldUrl,
          },
        },
        201,
      );
    }
    requests.statuses.push(path.split("/").at(-1));
    if (scenario === "expired")
      return route.fulfill({
        status: 401,
        json: {
          error: {
            code: "CUSTOMER_SESSION_INVALID",
            message: "private session detail",
          },
        },
      });
    return json(route, {
      checkoutReference,
      status,
      order: status === "PAID" ? order : null,
    });
  });
  const panel = page.locator(".payment-card").last();
  const retry = () =>
    page.getByRole("button", { name: "Try Payment Again", exact: true });
  const check = () =>
    page.getByRole("button", { name: "Check Payment Status", exact: true });
  async function inspect(label) {
    await panel.scrollIntoViewIfNeeded();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${label}: page overflow`,
    );
    for (const button of await panel.getByRole("button").all()) {
      const box = await button.boundingBox();
      assert(
        box && box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 44,
        `${label}: clipped or small action`,
      );
    }
    assert.doesNotMatch(
      await panel.innerText(),
      /409|PENDING|paymentIntentId|provider reference|idempotency|private provider|20000000/,
    );
    await page.screenshot({
      path: join(output, `${width}-${scenario}-${label}.png`),
    });
  }
  try {
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page
      .getByRole("button", { name: "Add Apples 01 to basket", exact: true })
      .click();
    await page.getByRole("button", { name: /^Basket/ }).click();
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page.getByRole("button", { name: /^Pay (RM|MYR)/ }).click();
    if (scenario === "handoff-error") {
      await page
        .getByRole("button", { name: "Continue secure payment" })
        .click();
      assert.equal(requests.creates.length, 1);
      assert.deepEqual(requests.handoffs, [oldUrl, oldUrl]);
    }
    await page
      .getByRole("heading", {
        name: "Waiting for payment confirmation",
        exact: true,
      })
      .waitFor();
    assert.equal(await retry().count(), 0);
    await inspect("waiting");
    if (scenario === "return-paid") status = "PAID";
    if (scenario === "return-processing") status = "PAID_PROCESSING";
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
    });
    if (scenario === "expired") {
      await page
        .getByRole("heading", { name: "Your session has expired", exact: true })
        .waitFor();
      assert.equal(await retry().count(), 0);
      await page.screenshot({
        path: join(output, `${width}-${scenario}-result.png`),
      });
    } else if (scenario.startsWith("return-")) {
      await page
        .getByRole("heading", {
          level: 2,
          name:
            scenario === "return-paid"
              ? "Order confirmed"
              : "Payment received — finalising your order",
        })
        .waitFor();
      assert.equal(await retry().count(), 0);
      await inspect("return-finality");
    } else if (scenario !== "handoff-error") {
      await page
        .getByRole("heading", { name: "Payment not completed", exact: true })
        .waitFor();
      assert.equal(requests.statuses.length, 3);
      assert.equal(requests.retries.length, 0);
      await inspect("returned");
      await retry().focus();
      await page.mouse.move(0, 0);
      assert.equal(
        await retry().evaluate((element) => element === document.activeElement),
        true,
      );
      assert(
        ["rgb(229, 35, 41)", "rgb(201, 29, 35)"].includes(
          await retry().evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        ),
      );
      await retry().press("Enter");
      await page
        .getByRole("heading", { name: "Preparing a new payment" })
        .waitFor();
      assert(await retry().isDisabled());
      assert(await check().isDisabled());
      await retry().evaluate((element) => element.click());
      assert.equal(requests.retries.length, 1);
      await inspect("busy");
      releaseRetry();
      await page
        .getByRole("heading", { name: "Preparing a new payment", exact: true })
        .waitFor({ state: "hidden" });
      if (scenario === "successor") {
        await page
          .getByRole("heading", { name: "Waiting for payment confirmation" })
          .waitFor();
        assert.deepEqual(requests.handoffs, [oldUrl, newUrl]);
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await retry().waitFor();
        assert.deepEqual(requests.statuses.slice(-3), [
          successor,
          successor,
          successor,
        ]);
      } else if (scenario === "processing" || scenario === "paid") {
        await page
          .getByRole("heading", {
            level: 2,
            name:
              scenario === "paid"
                ? "Order confirmed"
                : "Payment received — finalising your order",
          })
          .waitFor();
        assert.equal(await retry().count(), 0);
        assert.equal(requests.handoffs.length, 1);
      } else if (scenario === "no-url") {
        await retry().waitFor();
        assert.equal(requests.handoffs.length, 1);
      } else if (scenario === "failed") {
        await page.getByRole("heading", { name: "Payment failed" }).waitFor();
        assert.equal(requests.handoffs.length, 1);
      } else if (scenario === "voucher") {
        await page
          .getByText(
            "This payment can't be restarted from this checkout. Please return to your basket and try again.",
          )
          .waitFor();
        assert.equal(await retry().count(), 0);
      } else if (scenario === "invalid") {
        await page
          .getByRole("heading", { name: "Payment unavailable" })
          .waitFor();
        assert.equal(await retry().count(), 0);
        assert.equal(requests.handoffs.length, 1);
      } else if (scenario === "uncertain") {
        await retry().waitFor();
        status = "FAILED";
        await check().click();
        await retry().waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Review basket", exact: true })
            .count(),
          0,
        );
        await retry().click();
        await page
          .getByRole("heading", { name: "Preparing a new payment" })
          .waitFor();
        assert.equal(requests.retries.length, 2);
        assert.equal(requests.retries[0].key, requests.retries[1].key);
        assert.equal(requests.retries[0].path, requests.retries[1].path);
        releaseRetry();
        await retry().waitFor();
      }
      await inspect("result");
    }
    assert.equal(requests.creates.length, 1);
    assert.deepEqual(errors, []);
    assert.deepEqual(
      await page.evaluate(() => [
        Object.keys(localStorage),
        Object.keys(sessionStorage),
      ]),
      [[], []],
    );
    assert(!page.url().includes(oldIntent) && !page.url().includes(successor));
    results.push({
      width,
      scenario,
      status: "passed",
      creates: requests.creates.length,
      statusChecks: requests.statuses.length,
      retries: requests.retries.length,
      handoffs: requests.handoffs.length,
    });
  } finally {
    await page.close();
  }
}

try {
  for (const width of [320, 390, 430]) await run(width, "successor");
  for (const scenario of [
    "no-url",
    "processing",
    "paid",
    "failed",
    "voucher",
    "invalid",
    "uncertain",
    "expired",
    "handoff-error",
    "return-paid",
    "return-processing",
  ])
    await run(390, scenario);
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify({
      scenarios: results.length,
      passed: results.length,
      output,
      results,
    }),
  );
} finally {
  await browser.close();
}
