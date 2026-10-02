// Start Vite with synthetic API/bridge adapters; uses an existing Playwright install.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
  headless: true,
});
const origin = process.env.SUPPORT_PREVIEW_ORIGIN ?? "http://127.0.0.1:5181";
const general = "Hi CKS Go Support, I need some help.\n\nMy enquiry:";
try {
  for (const width of [390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/customer/support", async (route) => {
      await pending;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: { whatsapp: "+60123456789" } }),
      });
    });
    // Replace only the synthetic order prefix to exercise production business numbers.
    await page.route("**/src/catalogue/development.ts", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()).replaceAll("SYNTH-ORDER-", "CKSGO-"),
      });
    });
    await page.addInitScript(() => {
      window.__supportMessages = [];
      window.__supportOpened = [];
      window.SavtCksGoBridge = {
        postMessage: (raw) => window.__supportMessages.push(JSON.parse(raw)),
      };
      window.open = (...args) => {
        window.__supportOpened.push(args);
        return null;
      };
    });
    await page.goto(origin);
    const help = page.getByRole("button", {
      name: "Open CKS Go support in WhatsApp",
      exact: true,
    });
    await help.waitFor();
    await page.getByRole("searchbox", { name: "Search products" }).waitFor();
    assert.match(
      await page.locator(".support-action").innerText(),
      /unavailable right now/,
    );
    assert.equal(
      await page.locator('nav[aria-label="Primary navigation"] button').count(),
      4,
    );
    release();
    await page
      .getByText("Opens WhatsApp to contact CKS Go support.", { exact: true })
      .waitFor();
    const box = await help.boundingBox();
    assert.ok(box.height >= 44 && box.width >= 44);
    await help.focus();
    await help.press("Enter");
    const handoff = await page.evaluate(() => window.__supportMessages.at(-1));
    assert.equal(handoff.type, "support-handoff");
    assert.equal(
      new URL(handoff.payload.whatsappUrl).searchParams.get("text"),
      general,
    );
    assert.equal(await page.evaluate(() => window.__supportOpened.length), 0);
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page
      .getByRole("button", { name: "View order CKSGO-0001", exact: true })
      .click();
    const orderHelp = page.getByRole("button", {
      name: "Open WhatsApp support for order CKSGO-0001",
      exact: true,
    });
    await orderHelp.waitFor();
    await orderHelp.click();
    const orderMessage = await page.evaluate(() =>
      window.__supportMessages.at(-1),
    );
    assert.equal(
      new URL(orderMessage.payload.whatsappUrl).searchParams.get("text"),
      "Hi CKS Go Support, I need help with my order CKSGO-0001.\n\nMy enquiry:",
    );
    assert.match(
      await page.locator("body").innerText(),
      /Get help with this order/,
    );
    assert.equal(new URL(page.url()).hash.includes("order/"), true);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await help.waitFor();
    await page.evaluate(() => {
      delete window.SavtCksGoBridge;
    });
    await help.click();
    const opened = await page.evaluate(() => window.__supportOpened.at(-1));
    assert.equal(new URL(opened[0]).searchParams.get("text"), general);
    assert.deepEqual(opened.slice(1), ["_blank", "noopener,noreferrer"]);
    await page.evaluate(() => {
      window.open = () => {
        throw new Error("unavailable");
      };
    });
    await help.click();
    await page
      .getByText("WhatsApp support is unavailable right now.", { exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS ${width}px: independent config, Home/order actions, four tabs, keyboard, 44px target, native/standalone opening and failure`,
    );
  }
  for (const response of [
    { data: { whatsapp: null } },
    { data: { whatsapp: "javascript:alert(1)" } },
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
    await page.route("**/api/v1/customer/support", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(response),
      }),
    );
    await page.goto(origin);
    await page
      .getByText("WhatsApp support is unavailable right now.", { exact: true })
      .waitFor();
    await page.getByRole("searchbox", { name: "Search products" }).waitFor();
    await page.close();
  }
  console.log("PASS missing/invalid backend support leaves shopping usable");
} finally {
  await browser.close();
}
