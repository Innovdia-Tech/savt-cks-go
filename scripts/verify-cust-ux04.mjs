// Local synthetic presentation acceptance; never contacts a payment provider.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.CKS_GO_ORIGIN ?? "http://127.0.0.1:5179";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output =
  process.env.CKS_GO_VISUAL_CAPTURE ?? path.join(tmpdir(), "cks-go-cust-ux04");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
const results = [];
const errors = [];

async function capture(page, width, name) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".catalogue-dev")
    .evaluateAll((nodes) => nodes.forEach((n) => (n.open = false)));
  const metrics = await page.evaluate(() => {
    const rgba = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      if (value.startsWith("color(srgb")) {
        return channels.map((channel, i) => (i < 3 ? channel * 255 : channel));
      }
      return channels;
    };
    const composite = (front, back) => {
      const alpha = front[3] ?? 1;
      return front
        .slice(0, 3)
        .map((channel, i) => channel * alpha + back[i] * (1 - alpha));
    };
    const luminance = (channels) =>
      channels.reduce((sum, channel, i) => {
        const value = channel / 255;
        return (
          sum +
          (value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4) *
            [0.2126, 0.7152, 0.0722][i]
        );
      }, 0);
    const contrast = [...document.querySelectorAll("*")].flatMap((el) => {
      if (
        !el.getClientRects().length ||
        el.closest(
          '.catalogue-dev, [aria-hidden="true"], button:disabled, input:disabled, svg',
        )
      )
        return [];
      const text = [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .join(" ")
        .trim();
      if (!text) return [];
      const layers = [];
      for (let parent = el; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.backgroundImage !== "none" || Number(style.opacity) < 1)
          return [];
        const fill = rgba(style.backgroundColor);
        layers.unshift(fill);
        if ((fill[3] ?? 1) === 1) break;
      }
      const background = layers.reduce(
        (back, front) => composite(front, back),
        [255, 255, 255],
      );
      const style = getComputedStyle(el);
      const foreground = composite(rgba(style.color), background);
      const light = luminance(foreground),
        dark = luminance(background);
      const ratio =
        (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
      const large =
        parseFloat(style.fontSize) >= 24 ||
        (parseFloat(style.fontSize) >= 18.66 &&
          Number(style.fontWeight) >= 700);
      return [{ text, ratio, minimum: large ? 3 : 4.5 }];
    });
    const controls = [...document.querySelectorAll("button, input, summary")]
      .filter(
        (el) =>
          el.getClientRects().length &&
          !el.closest(".catalogue-dev") &&
          !el.closest("[hidden]"),
      )
      .map((el) => ({
        name:
          el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "input",
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }));
    return { width: document.documentElement.scrollWidth, controls, contrast };
  });
  assert(
    metrics.width <= width,
    `${name}: horizontal overflow ${metrics.width}`,
  );
  for (const control of metrics.controls) {
    assert(
      control.width >= 43.9 && control.height >= 43.9,
      `${name}: small target ${JSON.stringify(control)}`,
    );
  }
  assert.deepEqual(
    metrics.contrast.filter((sample) => sample.ratio < sample.minimum),
    [],
    `${name}: text contrast`,
  );
  const customer = await page.locator("body").innerText();
  const withoutFixtures = customer.split("Synthetic development fixtures")[0];
  assert(
    !/\b(?:assignment|serviceable|trusted quote|quote request|projection|Order identity|payment intent|idempotency)\b/i.test(
      withoutFixtures,
    ),
    name,
  );
  await page.screenshot({ path: path.join(output, `${width}-${name}.png`) });
  results.push({
    width,
    screen: name,
    overflow: false,
    targets: "PASS",
    solidTextContrast: "PASS",
  });
}

async function scenario(page, value) {
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .locator(".catalogue-dev")
    .first()
    .evaluate((n) => (n.open = true));
  await page.locator("#catalogue-scenario").selectOption(value);
  await page.waitForTimeout(450);
  await page
    .locator(".catalogue-dev")
    .first()
    .evaluate((n) => (n.open = false));
}
async function ordersScenario(page, value) {
  await home(page);
  await page
    .locator(".catalogue-dev")
    .first()
    .evaluate((n) => (n.open = true));
  await page.locator("#order-result").selectOption(value);
  await page
    .locator(".catalogue-dev")
    .first()
    .evaluate((n) => (n.open = false));
  await page.getByRole("button", { name: "Orders", exact: true }).click();
}
async function home(page) {
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByText("Featured products", { exact: true }).waitFor();
}
async function basketWithItem(page) {
  await home(page);
  await page
    .getByRole("button", { name: /^Add .* to basket$/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^View basket, / }).click();
}

try {
  for (const [width, height] of [
    [390, 844],
    [430, 932],
    [320, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    // Existing DEV bridge handles synthetic authentication. This flag exercises
    // embedded shell ownership without changing production bridge behavior.
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.getByText("Featured products", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Back", exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Close CKS Go", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(".app-header")
        .getByText("CKS Go", { exact: true })
        .count(),
      0,
    );
    await capture(page, width, "A-home");
    await page.locator(".catalogue-tile").first().scrollIntoViewIfNeeded();
    await capture(page, width, "C-product-cards");
    const nameStyle = await page
      .locator(".catalogue-name")
      .first()
      .evaluate((n) => {
        const s = getComputedStyle(n);
        return {
          lines: s.webkitLineClamp,
          size: s.fontSize,
          weight: s.fontWeight,
        };
      });
    assert.deepEqual(nameStyle, { lines: "2", size: "14px", weight: "600" });
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await page
      .getByRole("heading", { name: "Shop by category", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /Previous categories|More categories/ })
        .count(),
      0,
    );
    await capture(page, width, "B-browse");
    await page
      .getByRole("button", { name: "Frozen Food", exact: true })
      .click();
    await page.getByPlaceholder("Search Frozen Food").waitFor();
    await page.getByRole("heading", { name: "No products here yet" }).waitFor();
    await capture(page, width, "I-empty-category");
    await page
      .getByRole("button", { name: "View all products", exact: true })
      .click();
    await page
      .getByRole("button", { name: /^View Apples/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Add to Basket", exact: true })
      .waitFor();
    await capture(page, width, "D-product-detail");
    await page
      .getByRole("button", { name: "Add to Basket", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Increase quantity", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: /^View basket, 2 items, merchandise subtotal/,
      })
      .waitFor();
    await page.getByRole("button", { name: /^View basket, / }).click();
    await capture(page, width, "E-basket");
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page.getByText("Prices and fees are confirmed.").waitFor();
    await capture(page, width, "F-review-total");
    await page.getByRole("button", { name: /^Pay RM/ }).click();
    await page
      .getByRole("heading", { name: "Payment pending", exact: true })
      .waitFor();
    await capture(page, width, "payment-pending");
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page
      .getByRole("button", { name: /^View order / })
      .first()
      .waitFor();
    await capture(page, width, "G-orders");
    await page
      .getByRole("button", { name: /^View order / })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Where your order is", exact: true })
      .waitFor();
    await capture(page, width, "H-order-detail");
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await ordersScenario(page, "empty");
    await page
      .getByRole("button", { name: "Refresh orders", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "No orders yet", exact: true })
      .waitFor();
    await capture(page, width, "I-empty-orders");
    await ordersScenario(page, "error");
    await page
      .getByRole("button", { name: "Refresh orders", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Orders unavailable", exact: true })
      .waitFor();
    await capture(page, width, "J-orders-error");

    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.getByText("Featured products", { exact: true }).waitFor();
    await scenario(page, "quote-price-changed");
    await basketWithItem(page);
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page.getByRole("button", { name: /^Continue with RM/ }).waitFor();
    await capture(page, width, "F-updated-total");
    await page.getByRole("button", { name: /^Continue with RM/ }).click();
    await page.getByRole("button", { name: /^Pay RM/ }).waitFor();
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.getByText("Featured products", { exact: true }).waitFor();
    await scenario(page, "quote-expiry");
    await basketWithItem(page);
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Prices need refreshing", exact: true })
      .waitFor();
    await capture(page, width, "F-expired-total");
    await page
      .getByRole("button", { name: "Refresh total", exact: true })
      .click();
    await page.getByText("Prices and fees are confirmed.").waitFor();
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.getByText("Featured products", { exact: true }).waitFor();
    await scenario(page, "quote-unavailable");
    await basketWithItem(page);
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page.locator(".quote-error").waitFor();
    await capture(page, width, "J-review-error");
    await scenario(page, "cust-shop01r");
    await home(page);
    await page
      .getByRole("button", { name: "Change delivery address", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Delivery address", exact: true })
      .waitFor();
    await capture(page, width, "address-picker");
    assert.equal(
      await page.getByRole("button", { name: /Back to Home/ }).count(),
      0,
    );
    await page.goBack();
    await page.getByText("Featured products", { exact: true }).waitFor();
    const search = page.getByPlaceholder("Search products");
    await search.fill("Apples");
    await page.waitForTimeout(400);
    await page
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    assert.equal(await search.inputValue(), "");
    await search.focus();
    const focus = await search.evaluate((n) => ({
      active: document.activeElement === n,
      size: getComputedStyle(n).fontSize,
    }));
    assert.deepEqual(focus, { active: true, size: "16px" });
    const nav = page.getByRole("button", { name: "Browse", exact: true });
    await nav.focus();
    await page.keyboard.press("Enter");
    assert.equal(await nav.getAttribute("aria-current"), "page");
    const motion = await page
      .locator(".catalogue-tile")
      .first()
      .evaluate((n) => getComputedStyle(n).animationDuration);
    assert(["0s", "0.01ms", "1e-05s"].includes(motion));
    await page.route("**/src/api/runtimeConfig.ts", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'export const loadRuntimeConfig = () => { throw new Error("Synthetic invalid configuration"); };',
      }),
    );
    await page.goto(origin);
    await page
      .getByRole("heading", { name: "Unable to open CKS Go", exact: true })
      .waitFor();
    assert.equal(await page.locator(".ui-system-state--error").count(), 1);
    assert(!(await page.locator("body").innerText()).includes("configuration"));
    await capture(page, width, "J-startup-error");
    await page.close();
    console.log(`${width}px: A–J and recovery states PASS`);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ results, pageErrors: errors }, null, 2),
  );
} finally {
  await browser.close();
}
