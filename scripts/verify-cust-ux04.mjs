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
  // Wait for navigation color transitions to finish before measuring/capturing.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const navigation = await page
    .locator(".bottom-navigation button")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        active: n.classList.contains("is-active"),
        icon: getComputedStyle(n.querySelector("svg")).color,
        label: getComputedStyle(n.querySelector(".bottom-navigation__label"))
          .color,
      })),
    );
  for (const item of navigation) {
    assert.equal(
      item.icon,
      item.active ? "rgb(229, 35, 41)" : "rgb(135, 135, 135)",
    );
    assert.equal(
      item.label,
      item.active ? "rgb(229, 35, 41)" : "rgb(102, 102, 102)",
    );
  }
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
    !/CKS (?:GO|go)\b/.test(withoutFixtures),
    `${name}: customer-facing casing`,
  );
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

async function refinedHome(page, width) {
  assert.equal(
    await page.locator('.app-header [aria-label^="Open basket"]').count(),
    0,
  );
  assert.equal(
    await page.locator('.catalogue-search button[type="submit"]').count(),
    0,
  );
  assert.equal(await page.locator(".advertising-carousel__arrow").count(), 0);
  assert.equal(
    await page.locator(".advertising-carousel__play").innerText(),
    "",
  );
  const metrics = await page.evaluate(() => {
    const style = (selector) =>
      getComputedStyle(document.querySelector(selector));
    const type = (selector) => {
      const s = style(selector);
      return [s.fontSize, s.fontWeight];
    };
    const rect = (selector) =>
      document.querySelector(selector).getBoundingClientRect();
    return {
      background: style(".app-shell").backgroundColor,
      field: style(".catalogue-search input").backgroundColor,
      input: type(".catalogue-search input"),
      headings: [
        ...document.querySelectorAll(".catalogue-section-heading h2"),
      ].map((n) => [
        getComputedStyle(n).fontSize,
        getComputedStyle(n).fontWeight,
      ]),
      seeAll: type(".catalogue-section-heading .catalogue-link"),
      categoryColumns: style(
        ".catalogue-category-tiles",
      ).gridTemplateColumns.split(" ").length,
      categoryArtwork: rect(".catalogue-category-tiles button > span").width,
      categoryLabel: type(".catalogue-category-tiles button > span:last-child"),
      unit: type(".catalogue-unit"),
      price: type(".catalogue-price"),
      productSurface: style(".catalogue-tile").backgroundColor,
      productShadow: style(".catalogue-tile").boxShadow,
      headerHeight: rect(".app-header").height,
      bannerHeight: rect(".advertising-carousel").height,
      slideHeight: rect(".advertising-carousel__slide").height,
      nav: [...document.querySelectorAll(".bottom-navigation button")].map(
        (n) => {
          const label = getComputedStyle(
            n.querySelector(".bottom-navigation__label"),
          );
          const icon = n.querySelector("svg").getBoundingClientRect();
          return {
            size: label.fontSize,
            weight: label.fontWeight,
            icon: [icon.width, icon.height],
            underline: getComputedStyle(n, "::after").content,
            decoration: label.textDecorationLine,
          };
        },
      ),
    };
  });
  assert.equal(metrics.background, "rgb(235, 243, 227)");
  assert.equal(metrics.field, "rgb(255, 255, 255)");
  assert.deepEqual(metrics.input, ["16px", "400"]);
  assert(metrics.headings.every((h) => h[0] === "20px" && h[1] === "700"));
  assert.deepEqual(metrics.seeAll, ["14px", "500"]);
  assert.equal(metrics.categoryColumns, 4);
  assert(metrics.categoryArtwork >= 64 && metrics.categoryArtwork <= 68);
  assert.deepEqual(metrics.categoryLabel, ["12px", "500"]);
  assert.deepEqual(metrics.unit, ["12px", "400"]);
  assert.deepEqual(metrics.price, ["16px", "700"]);
  assert.equal(metrics.productSurface, "rgb(255, 255, 255)");
  assert.equal(metrics.productShadow, "none");
  assert(metrics.headerHeight <= (width === 320 ? 110 : 96));
  assert(Math.abs(metrics.bannerHeight - metrics.slideHeight) < 1);
  assert.equal(metrics.nav.length, 4);
  for (const item of metrics.nav) {
    assert.equal(item.size, "12px");
    assert(["400", "500"].includes(item.weight));
    assert.deepEqual(item.icon, [24, 24]);
    assert(["none", "normal"].includes(item.underline));
    assert.equal(item.decoration, "none");
  }
  const dots = page.locator(".advertising-carousel__dots button");
  await dots.first().focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await dots.nth(1).getAttribute("aria-current"), "true");
  await page.locator(".advertising-carousel").evaluate((n) => {
    n.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        clientX: 240,
        clientY: 80,
      }),
    );
    n.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerType: "touch",
        clientX: 140,
        clientY: 82,
      }),
    );
  });
  assert.equal(await dots.nth(2).getAttribute("aria-current"), "true");
  await dots.first().click();
  assert(
    ["0s", "0.01ms", "1e-05s"].includes(
      await page
        .locator(".advertising-carousel__track")
        .evaluate((n) => getComputedStyle(n).transitionDuration),
    ),
  );
  const search = page.getByPlaceholder("Search products");
  await search.evaluate((n) => {
    window.__searchSubmissions = 0;
    n.form.addEventListener("submit", () => window.__searchSubmissions++);
  });
  await search.fill("Rice");
  await search.press("Enter");
  assert.equal(await page.evaluate(() => window.__searchSubmissions), 1);
  await page
    .getByRole("button", { name: /^View Rice/ })
    .first()
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /^View Apples/ }).count(),
    0,
  );
  await search.dispatchEvent("compositionstart", { data: "Ap" });
  await search.fill("Apples");
  await page.waitForTimeout(400);
  assert.equal(
    await page.getByRole("button", { name: /^View Apples/ }).count(),
    0,
  );
  await search.dispatchEvent("compositionend", { data: "Apples" });
  await page
    .getByRole("button", { name: /^View Apples/ })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page
    .getByRole("button", { name: /^View Rice/ })
    .first()
    .waitFor();
  assert.equal(await search.inputValue(), "");
  assert.equal(
    await search.evaluate((n) => document.activeElement === n),
    true,
  );
  await search.blur();
  await page
    .getByRole("button", { name: /^Add .* to basket$/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^View basket, / }).waitFor();
  await capture(page, width, "H-sticky-basket");
  await page
    .getByRole("button", { name: "Decrease quantity", exact: true })
    .first()
    .click();
  assert.equal(await page.locator(".basket-summary").count(), 0);
  await page.locator(".app-shell__scroll").evaluate((n) => n.scrollTo(0, 0));
  results.push({
    width,
    refinement: "C–G",
    metrics,
    keyboardSearch: "PASS",
    composition: "PASS",
    swipe: "PASS",
    keyboardCarousel: "PASS",
  });
}

async function verifyRotation() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.SavtCksGoBridge = { postMessage() {} };
  });
  await page.goto(`${origin}/?scenario=cust-shop01r`);
  await page.getByText("Featured products", { exact: true }).waitFor();
  const current = () =>
    page
      .locator('.advertising-carousel__dots button[aria-current="true"]')
      .getAttribute("aria-label");
  await page.mouse.move(0, 0);
  const first = await current();
  await page.waitForTimeout(6500);
  assert.notEqual(await current(), first);
  await page
    .getByRole("button", { name: "Pause banner rotation", exact: true })
    .click();
  const paused = await current();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(6500);
  assert.equal(await current(), paused);
  await page
    .getByRole("button", { name: "Play banner rotation", exact: true })
    .click();
  await page.getByPlaceholder("Search products").focus();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(6500);
  assert.notEqual(await current(), paused);
  await page.close();

  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  reduced.on("pageerror", (error) => errors.push(error.message));
  await reduced.addInitScript(() => {
    window.SavtCksGoBridge = { postMessage() {} };
  });
  await reduced.goto(`${origin}/?scenario=cust-shop01r`);
  await reduced.getByText("Featured products", { exact: true }).waitFor();
  assert.equal(
    await reduced.locator(".advertising-carousel__play").isDisabled(),
    true,
  );
  const staticSlide = await reduced
    .locator('.advertising-carousel__dots button[aria-current="true"]')
    .getAttribute("aria-label");
  await reduced.waitForTimeout(6500);
  assert.equal(
    await reduced
      .locator('.advertising-carousel__dots button[aria-current="true"]')
      .getAttribute("aria-label"),
    staticSlide,
  );
  await reduced
    .locator(".advertising-carousel__artwork")
    .first()
    .dispatchEvent("error");
  await reduced.waitForTimeout(100);
  assert.equal(
    await reduced.locator(".advertising-carousel__dots button").count(),
    2,
  );
  await reduced.close();

  const standalone = await browser.newPage({
    viewport: { width: 320, height: 844 },
    reducedMotion: "reduce",
  });
  await standalone.goto(`${origin}/?scenario=cust-shop01r`);
  // Existing local DEV adapter only: no SMS or external identity service.
  await standalone
    .getByLabel("Mobile number", { exact: true })
    .fill("0123456789");
  await standalone
    .getByRole("button", { name: "Send OTP", exact: true })
    .click();
  await standalone.getByLabel("One-time code", { exact: true }).fill("123456");
  await standalone
    .getByRole("button", { name: "Verify & continue", exact: true })
    .click();
  await standalone.getByText("Featured products", { exact: true }).waitFor();
  assert.equal(
    await standalone.locator('.app-header [aria-label^="Open basket"]').count(),
    1,
  );
  assert.equal(
    await standalone.locator(".advertising-carousel__arrow").count(),
    2,
  );
  assert.equal(
    await standalone.locator(".advertising-carousel__play").innerText(),
    "",
  );
  assert.deepEqual(
    await standalone
      .locator(".advertising-carousel__arrow svg")
      .first()
      .evaluate((n) => [
        n.getBoundingClientRect().width,
        n.getBoundingClientRect().height,
      ]),
    [28, 28],
  );
  await standalone.close();
  results.push({
    rotation: {
      autoplay: "PASS",
      pause: "PASS",
      resume: "PASS",
      reducedMotionNoAdvance: "PASS",
      failedSlide: "PASS",
      standaloneBasket: "PASS",
      restrainedStandaloneArrows: "PASS",
    },
  });
  console.log(
    "Carousel autoplay, pause/resume, reduced motion, failure and standalone controls PASS",
  );
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
    await refinedHome(page, width);
    await capture(page, width, "C-home");
    await page.locator(".catalogue-tile").first().scrollIntoViewIfNeeded();
    await capture(page, width, "F-product-cards");
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
    await capture(page, width, "I-browse");
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
    await capture(page, width, "H-basket");
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
    await capture(page, width, "J-orders");
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
    console.log(
      `${width}px: C–J refinements and shopping recovery states PASS`,
    );
  }
  await verifyRotation();
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ results, pageErrors: errors }, null, 2),
  );
} finally {
  await browser.close();
}
