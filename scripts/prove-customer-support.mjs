// Start Vite with the synthetic API/bridge adapters. Never contacts WhatsApp.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
  headless: true,
});
const origin = process.env.SUPPORT_PREVIEW_ORIGIN ?? "http://127.0.0.1:5181";
const evidence = process.env.SUPPORT_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const general = "Hi CKS Go Support, I need some help.\n\nMy enquiry:";
const supportName = "Open CKS Go support in WhatsApp";
const support = (page) =>
  page.getByRole("button", { name: supportName, exact: true });
const nav = (page) =>
  page.locator('nav[aria-label="Primary navigation"] button');
async function makePage(
  viewport,
  config = { data: { whatsapp: "+60123456789" } },
) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/v1/customer/support", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(await config),
    }),
  );
  // Only the synthetic order prefix is replaced with a supported business number.
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
  await page.getByRole("searchbox", { name: "Search products" }).waitFor();
  return { page, errors };
}
async function checkUtility(page, action) {
  await action.scrollIntoViewIfNeeded();
  const box = await action.boundingBox();
  assert.ok(box.height >= 44 && box.width >= 44);
  const style = await action.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      font: s.fontSize,
      weight: s.fontWeight,
      background: s.backgroundColor,
      color: s.color,
      position: getComputedStyle(el.closest(".support-action")).position,
    };
  });
  assert.equal(style.font, "14px");
  assert.equal(style.weight, "600");
  assert.equal(style.background, "rgba(0, 0, 0, 0)");
  assert.equal(style.color, "rgb(229, 35, 41)");
  assert.ok(!["fixed", "sticky", "absolute"].includes(style.position));
  const navigation = page.locator('nav[aria-label="Primary navigation"]');
  const navBox = (await navigation.count())
    ? await navigation.boundingBox()
    : null;
  if (navBox)
    assert.ok(
      box.y + box.height <= navBox.y || box.y >= navBox.y + navBox.height,
    );
  const basket = page.locator(".basket-summary");
  const basketBox = (await basket.count()) ? await basket.boundingBox() : null;
  if (basketBox)
    assert.ok(
      box.y + box.height <= basketBox.y ||
        box.y >= basketBox.y + basketBox.height,
    );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
async function capture(page, name, viewport) {
  if (evidence)
    await page.screenshot({
      path: join(evidence, `${name}-${viewport.width}.png`),
    });
}
async function generalHandoff(page, action = support(page)) {
  const before = page.url();
  await action.click();
  const handoff = await page.evaluate(() => window.__supportMessages.at(-1));
  assert.equal(handoff.type, "support-handoff");
  const url = new URL(handoff.payload.whatsappUrl);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/60123456789");
  assert.equal(url.searchParams.get("text"), general);
  assert.equal(page.url(), before);
}
async function fixtures(page) {
  await page
    .getByText("Synthetic development fixtures", { exact: true })
    .click();
}
async function afterControls(page, selector, controls) {
  const help = page.locator(selector);
  for (const name of controls) {
    const control = page.getByRole("button", { name, exact: true });
    assert.equal(await control.count(), 1);
    assert.equal(
      await control.evaluate(
        (el, supportSelector) =>
          Boolean(
            el.compareDocumentPosition(
              document.querySelector(supportSelector),
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        selector,
      ),
      true,
    );
  }
  await checkUtility(page, help.getByRole("button"));
}
try {
  for (const viewport of [
    { width: 320, height: 844 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const { page, errors } = await makePage(viewport, pending);
    assert.equal(await support(page).count(), 0); // shopping usable while config loads
    assert.equal(await nav(page).count(), 4);
    release({ data: { whatsapp: "+60123456789" } });
    await support(page).waitFor();
    assert.match(
      await page.locator(".support-action--home").innerText(),
      /Need help\?\s*Get help/,
    );
    assert.equal(await nav(page).filter({ hasText: /help/i }).count(), 0);
    await checkUtility(page, support(page));
    await capture(page, "home", viewport);
    await support(page).focus();
    await support(page).press("Enter");
    assert.equal(
      new URL(
        (await page.evaluate(() => window.__supportMessages.at(-1))).payload
          .whatsappUrl,
      ).searchParams.get("text"),
      general,
    );
    assert.equal(await page.evaluate(() => window.__supportOpened.length), 0);
    await page
      .getByRole("button", { name: /^Add .+ to basket$/ })
      .first()
      .click();
    await page.locator(".basket-summary").waitFor();
    const basketSummary = await page.locator(".basket-summary").innerText();
    await checkUtility(page, support(page));
    await capture(page, "home-with-basket", viewport);
    await generalHandoff(page);
    assert.equal(
      await page.locator(".basket-summary").innerText(),
      basketSummary,
    );
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page
      .getByRole("button", { name: "View order CKSGO-0001", exact: true })
      .click();
    const orderHelp = page.getByRole("button", {
      name: "Open WhatsApp support for order CKSGO-0001",
      exact: true,
    });
    await orderHelp.waitFor();
    await page
      .getByRole("heading", { name: "Need help with this order?", exact: true })
      .waitFor();
    assert.equal(await orderHelp.innerText(), "Get help on WhatsApp");
    await checkUtility(page, orderHelp);
    await capture(page, "order", viewport);
    await orderHelp.click();
    assert.equal(
      new URL(
        (await page.evaluate(() => window.__supportMessages.at(-1))).payload
          .whatsappUrl,
      ).searchParams.get("text"),
      "Hi CKS Go Support, I need help with my order CKSGO-0001.\n\nMy enquiry:",
    );
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await support(page).waitFor();
    await page.evaluate(() => {
      delete window.SavtCksGoBridge;
    });
    await support(page).click();
    const opened = await page.evaluate(() => window.__supportOpened.at(-1));
    assert.equal(new URL(opened[0]).searchParams.get("text"), general);
    assert.deepEqual(opened.slice(1), ["_blank", "noopener,noreferrer"]);
    await page.evaluate(() => {
      window.open = () => {
        throw Error("unavailable");
      };
    });
    await support(page).click();
    await page
      .getByText("We couldn't open WhatsApp. Please try again.", {
        exact: true,
      })
      .waitFor();
    assert.deepEqual(errors, []);
    await page.close();

    for (const scenario of ["no-service", "no-address"]) {
      const { page, errors } = await makePage(viewport);
      await fixtures(page);
      await page
        .getByLabel("Catalogue and quote scenario", { exact: true })
        .selectOption(scenario);
      const delivery = ".support-action--delivery";
      await page.locator(delivery).waitFor();
      assert.equal(await page.locator(".support-action--home").count(), 0);
      assert.match(
        await page.locator(delivery).innerText(),
        /Need help with your delivery address\?\s*Get help on WhatsApp/,
      );
      if (scenario === "no-service") {
        await page
          .getByText("Delivery isn't available for this address", {
            exact: true,
          })
          .waitFor();
        await afterControls(page, delivery, [
          "Choose another address",
          "+ Add new address",
        ]);
        assert.equal(await nav(page).count(), 4);
        await capture(page, "delivery-unavailable", viewport);
      } else {
        await page
          .getByRole("heading", { name: "Set delivery location", exact: true })
          .waitFor();
        await afterControls(page, delivery, [
          "Search building, street or postcode",
          "Use my current location",
        ]);
        await capture(page, "delivery-setup", viewport);
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByRole("heading", {
            name: "Confirm delivery location",
            exact: true,
          })
          .waitFor();
        await afterControls(page, delivery, [
          "Search another location",
          "Confirm this location",
        ]);
        await capture(page, "delivery-confirm", viewport);
      }
      await generalHandoff(page);
      assert.deepEqual(errors, []);
      await page.close();
    }

    for (const result of ["failed", "status-error", "paid", "pending"]) {
      const { page, errors } = await makePage(viewport);
      await fixtures(page);
      await page
        .getByLabel("Backend payment result", { exact: true })
        .selectOption(result);
      await page
        .getByRole("button", { name: /^Add .+ to basket$/ })
        .first()
        .click();
      await nav(page).filter({ hasText: "Basket" }).click();
      await page
        .getByRole("button", { name: "Review order", exact: true })
        .click();
      const pay = page.getByRole("button", { name: /^Pay (RM|MYR)/ });
      await pay.waitFor();
      assert.equal(await support(page).count(), 0);
      await pay.click();
      await page
        .getByRole("heading", { name: "Payment pending", exact: true })
        .waitFor();
      assert.equal(await support(page).count(), 0);
      // Exercise the accepted visibility return observer with synthetic lifecycle events.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value: "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value: "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      if (result === "failed" || result === "status-error") {
        await page
          .getByRole("heading", {
            name:
              result === "failed" ? "Payment failed" : "Payment unavailable",
            exact: true,
          })
          .waitFor();
        await support(page).waitFor();
        await afterControls(page, ".support-action--payment", [
          result === "failed" ? "Review basket" : "Check payment again",
        ]);
        const basket = await page.locator(".cart-stack").innerText();
        const frozen = await page
          .locator(".cart-stack button:disabled")
          .count();
        await page
          .locator(".payment-card")
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
        await capture(page, `payment-${result}`, viewport);
        await generalHandoff(page);
        assert.equal(await page.locator(".cart-stack").innerText(), basket);
        assert.equal(
          await page.locator(".cart-stack button:disabled").count(),
          frozen,
        );
      } else {
        await page
          .getByRole("heading", {
            name:
              result === "paid" ? "Order confirmed" : "Payment not completed",
            exact: true,
            level: 2,
          })
          .waitFor();
        assert.equal(await support(page).count(), 0);
      }
      assert.equal(await nav(page).count(), 4);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(
      `PASS ${viewport.width}x${viewport.height}: A–G; Home, delivery/setup/confirm, order, failed/unavailable payment; ready/pending/paid excluded; basket preserved; external handoff/failure`,
    );
  }
  for (const response of [
    { data: { whatsapp: null } },
    { data: { whatsapp: "javascript:alert(1)" } },
  ]) {
    const { page, errors } = await makePage(
      { width: 390, height: 844 },
      response,
    );
    await page.waitForLoadState("networkidle");
    assert.equal(await support(page).count(), 0);
    assert.equal(await page.locator(".support-action").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("PASS missing/invalid config: no dead action; shopping usable");
} finally {
  await browser.close();
}
