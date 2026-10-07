// Focused local synthetic Home/Basket acceptance; no live payment provider.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.CKS_GO_ORIGIN ?? "http://127.0.0.1:5179";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output =
  process.env.CKS_GO_VISUAL_CAPTURE ??
  path.join(tmpdir(), "cks-go-cust-ux04r2");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
});
const results = [];
const errors = [];
const money = (minor) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(
    minor / 100,
  );

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function capture(page, width, name) {
  await settle(page);
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector(".app-shell__scroll");
    return {
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      scroll: shell.scrollWidth,
      shell: shell.clientWidth,
    };
  });
  assert(
    geometry.document <= geometry.viewport && geometry.scroll <= geometry.shell,
    `${width} ${name}: overflow`,
  );
  await page.screenshot({ path: path.join(output, `${width}-${name}.png`) });
}
async function navigation(page) {
  await settle(page);
  const nav = await page
    .locator(".bottom-navigation button")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const icon = n.querySelector("svg");
        const rect = icon.getBoundingClientRect();
        const target = n.getBoundingClientRect();
        return {
          label: n.getAttribute("aria-label"),
          active: n.classList.contains("is-active"),
          color: getComputedStyle(icon).color,
          icon: [rect.width, rect.height],
          height: target.height,
          decoration: getComputedStyle(
            n.querySelector(".bottom-navigation__label"),
          ).textDecorationLine,
          underline: getComputedStyle(n, "::after").content,
        };
      }),
    );
  assert.equal(nav.length, 4);
  for (const n of nav) {
    assert.deepEqual(n.icon, [24, 24]);
    assert(n.height >= 44);
    assert.equal(n.decoration, "none");
    assert(["none", "normal"].includes(n.underline));
    assert.equal(
      n.color,
      n.active ? "rgb(12, 116, 182)" : "rgb(135, 135, 135)",
    );
  }
  assert(nav.find((n) => n.active).label.startsWith("Basket"));
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
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.getByText("Featured products", { exact: true }).waitFor();
    await settle(page);
    const categories = await page
      .locator(".catalogue-category-tiles button")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const tile = n.firstElementChild;
          const label = n.lastElementChild;
          const image = tile.querySelector("img");
          const s = getComputedStyle(tile);
          const l = getComputedStyle(label);
          const rect = tile.getBoundingClientRect();
          return {
            name: label.textContent,
            tile: [rect.width, rect.height],
            radius: s.borderRadius,
            padding: s.padding,
            background: s.backgroundColor,
            shadow: s.boxShadow,
            fit: getComputedStyle(image).objectFit,
            position: getComputedStyle(image).objectPosition,
            loaded: image.complete && image.naturalWidth > 0,
            label: [
              l.fontSize,
              l.fontWeight,
              l.webkitLineClamp,
              label.getBoundingClientRect().height,
            ],
            tapHeight: n.getBoundingClientRect().height,
          };
        }),
      );
    assert.deepEqual(
      categories.map((c) => c.name),
      [
        "Fresh Fruits & Vegetables",
        "Household Essentials",
        "Frozen Food",
        "Beverages",
      ],
    );
    for (const c of categories) {
      assert.deepEqual(c.tile, width === 320 ? [64, 64] : [68, 68]);
      assert.equal(c.background, "rgb(255, 255, 255)");
      assert.equal(c.radius, "14px");
      assert.equal(c.padding, "6px");
      assert.equal(c.shadow, "none");
      assert.equal(c.fit, "contain");
      assert.equal(c.position, "50% 50%");
      assert(c.loaded && c.tapHeight >= 44);
      assert.deepEqual(c.label.slice(0, 3), ["12px", "500", "2"]);
      assert.equal(c.label[3], categories[0].label[3]);
    }
    const home = await page.evaluate(() => {
      const labels = [
        ...document.querySelectorAll(
          ".catalogue-category-tiles button > span:last-child",
        ),
      ];
      const heading = document.querySelector(".catalogue-products-heading h2");
      return {
        background: getComputedStyle(document.querySelector(".app-shell"))
          .backgroundColor,
        columns: getComputedStyle(
          document.querySelector(".catalogue-category-tiles"),
        ).gridTemplateColumns.split(" ").length,
        gap:
          heading.getBoundingClientRect().top -
          Math.max(...labels.map((n) => n.getBoundingClientRect().bottom)),
      };
    });
    assert.equal(home.background, "rgb(235, 243, 227)");
    assert.equal(home.columns, 4);
    assert(home.gap >= 20 && home.gap <= 24, `category gap ${home.gap}`);
    await capture(page, width, "A-D-home");
    for (const category of categories) {
      await page
        .getByRole("button", { name: category.name, exact: true })
        .click();
      await page
        .getByPlaceholder(`Search ${category.name}`, { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Home", exact: true }).click();
      await page.getByText("Featured products", { exact: true }).waitFor();
    }
    await page
      .locator(".catalogue-home-categories")
      .getByRole("button", { name: "See all", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Shop by category", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: /^View Apples 03/ }).click();
    await page
      .getByRole("button", { name: "Add to Basket", exact: true })
      .click();
    for (let i = 0; i < 5; i++)
      await page
        .getByRole("button", { name: "Increase quantity", exact: true })
        .click();
    await page.getByRole("button", { name: /^View basket, 6 items,/ }).click();
    await page
      .locator(".app-header")
      .getByText("Your basket (6)", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".cart-line-copy strong").innerText(),
      money(500),
    );
    assert.equal(
      await page.locator(".cart-line-subtotal").innerText(),
      `Item subtotal\n${money(3000)}`,
    );
    assert.equal(
      await page.locator(".cart-display-total strong").innerText(),
      money(3000),
    );
    await page
      .getByRole("heading", { name: "Your items", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Order summary", exact: true })
      .waitFor();
    const item = await page.locator(".cart-line").evaluate((n) => {
      const rect = (selector) =>
        n.querySelector(selector).getBoundingClientRect();
      return {
        quantityBottom: rect(".cart-quantity").bottom,
        subtotalTop: rect(".cart-line-subtotal").top,
        removeBottom: rect(".cart-remove").bottom,
        labelVisible:
          getComputedStyle(n.querySelector(".cart-line-subtotal span"))
            .display !== "none",
        targets: [...n.querySelectorAll("button")].map(
          (b) => b.getBoundingClientRect().height,
        ),
      };
    });
    assert(
      item.quantityBottom <= item.subtotalTop &&
        item.removeBottom <= item.subtotalTop &&
        item.labelVisible,
    );
    assert(item.targets.every((h) => h >= 44));
    await navigation(page);
    await capture(page, width, "E-F-J-basket");
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page
      .getByText("Prices and fees confirmed", { exact: true })
      .waitFor();
    const amounts = await page
      .locator(".quote-totals")
      .evaluate((n) =>
        [...n.querySelectorAll("dt")].map((dt) => [
          dt.textContent,
          dt.nextElementSibling.textContent,
        ]),
      );
    assert.deepEqual(amounts, [
      ["Items subtotal", money(3000)],
      ["Delivery fee", money(490)],
      ["Processing fee", money(50)],
      ["Total", money(3540)],
    ]);
    const summary = page.locator(".quote-evidence-details summary");
    const pay = page.getByRole("button", { name: /^Pay RM/ });
    await pay.scrollIntoViewIfNeeded();
    await page.locator(".app-shell__scroll").evaluate((n) => {
      n.scrollTop = n.scrollHeight;
    });
    const payTarget = await pay.evaluate((n) => ({
      bottom: n.getBoundingClientRect().bottom,
      height: n.getBoundingClientRect().height,
      navigationTop: document
        .querySelector(".bottom-navigation")
        .getBoundingClientRect().top,
    }));
    assert(
      payTarget.height >= 44 && payTarget.bottom <= payTarget.navigationTop,
    );
    await capture(page, width, "G-summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    assert(
      await page.locator(".quote-evidence-details").evaluate((n) => n.open),
    );
    await settle(page);
    const disclosure = await summary.evaluate((n) => ({
      height: n.getBoundingClientRect().height,
      marker: getComputedStyle(n, "::marker").content,
      rotation: getComputedStyle(n.querySelector("svg")).transform,
      decorative: n.querySelector("svg").getAttribute("aria-hidden"),
    }));
    assert(
      disclosure.height >= 44 &&
        disclosure.marker === '""' &&
        disclosure.decorative === "true",
    );
    assert.equal(disclosure.rotation, "matrix(-1, 0, 0, -1, 0, 0)");
    await pay.scrollIntoViewIfNeeded();
    await page.locator(".app-shell__scroll").evaluate((n) => {
      n.scrollTop = n.scrollHeight;
    });
    await capture(page, width, "H-delivery-details");
    await page.keyboard.press("Space");
    assert.equal(
      await page.locator(".quote-evidence-details").evaluate((n) => n.open),
      false,
    );
    await page.getByRole("button", { name: /^Pay RM/ }).click();
    await page
      .getByRole("heading", { name: "Payment pending", exact: true })
      .waitFor();
    await page.locator(".app-shell__scroll").evaluate((n) => {
      n.scrollTop = 0;
    });
    await page
      .getByText("We're checking your payment status.", { exact: true })
      .waitFor();
    await page
      .getByText("Your order will appear once payment is confirmed.", {
        exact: true,
      })
      .waitFor();
    assert.equal(
      await page.locator(".cart-stack > :first-child").getAttribute("class"),
      "payment-card payment-pending",
    );
    assert.equal(
      await page.getByText("Order confirmed", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "View order", exact: true })
        .count(),
      0,
    );
    const controls = await page
      .locator(".cart-change-address, .cart-remove, .cart-quantity button")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          disabled: n.disabled,
          opacity: getComputedStyle(n).opacity,
          color: getComputedStyle(n).color,
          cursor: getComputedStyle(n).cursor,
        })),
      );
    assert.equal(controls.length, 4);
    assert(
      controls.every(
        (c) =>
          c.disabled &&
          c.opacity === "0.6" &&
          c.color === "rgb(102, 102, 102)" &&
          c.cursor === "not-allowed",
      ),
    );
    await navigation(page);
    await capture(page, width, "I-pending");
    await page.locator(".cart-remove").scrollIntoViewIfNeeded();
    await capture(page, width, "I-frozen-items");
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--safe-area-bottom", "24px"),
    );
    await page.locator(".app-shell__scroll").evaluate((n) => {
      n.scrollTop = n.scrollHeight;
    });
    const clearance = await page.evaluate(
      () =>
        document.querySelector(".bottom-navigation").getBoundingClientRect()
          .top -
        document.querySelector(".cart-stack").getBoundingClientRect().bottom,
    );
    assert(clearance >= 20, `safe-area clearance ${clearance}`);
    await capture(page, width, "J-safe-area");
    results.push({
      viewport: [width, height],
      acceptance: Object.fromEntries(
        "ABCDEFGHIJ".split("").map((letter) => [letter, "PASS"]),
      ),
      home,
      categories,
      amounts,
      controls,
      clearance,
    });
    console.log(`${width}x${height}: Home A-D, Basket E-J PASS`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ status: "PASS", results, errors }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
