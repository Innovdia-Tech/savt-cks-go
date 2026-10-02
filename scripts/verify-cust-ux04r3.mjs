// Local synthetic Basket-row acceptance; no production APIs or payment provider.
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
  path.join(tmpdir(), "cks-go-cust-ux04r3");
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
const minor = (value) => Math.round(Number(value.replace(/[^\d.]/g, "")) * 100);

async function open(width, height, scenario = "cust-shop01r") {
  const page = await browser.newPage({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.SavtCksGoBridge = { postMessage() {} };
  });
  await page.goto(`${origin}/?scenario=${scenario}`);
  await page.getByText("Featured products", { exact: true }).waitFor();
  if (scenario === "card-alignment") {
    await page
      .locator(".catalogue-dev")
      .first()
      .evaluate((n) => {
        n.open = true;
      });
    await page.locator("#catalogue-scenario").selectOption(scenario);
    await page
      .getByRole("button", {
        name: "Add Synthetic long-name apples sample pack to basket",
        exact: true,
      })
      .waitFor();
    await page
      .locator(".catalogue-dev")
      .first()
      .evaluate((n) => {
        n.open = false;
      });
  }
  return page;
}
async function basket(page) {
  await page.getByRole("button", { name: /^View basket, / }).click();
  await page
    .getByRole("heading", { name: "Your items", exact: true })
    .waitFor();
}
async function addFirstAvailable(page) {
  await page
    .locator('.catalogue-tile button[aria-label^="Add "]:not([disabled])')
    .first()
    .click();
}
async function capture(page, width, label) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const overflow = await page.evaluate(() => {
    const scroller = document.querySelector(".app-shell__scroll");
    return (
      document.documentElement.scrollWidth > innerWidth ||
      scroller.scrollWidth > scroller.clientWidth
    );
  });
  assert.equal(overflow, false, `${width} ${label}: horizontal overflow`);
  await page.screenshot({ path: path.join(output, `${width}-${label}.png`) });
}
async function rows(page, width, label, count) {
  const metrics = await page.locator(".cart-line").evaluateAll((nodes) =>
    nodes.map((n) => {
      const rect = (selector) => {
        const r = n.querySelector(selector).getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      const s = getComputedStyle(n);
      const image = n.querySelector(".cart-line-image img");
      return {
        name: n.querySelector("h3").textContent,
        height: n.getBoundingClientRect().height,
        image: rect(".cart-line-image"),
        copy: rect(".cart-line-copy"),
        quantity: rect(".cart-quantity"),
        remove: rect(".cart-remove"),
        unitPrice: n.querySelector(".cart-line-copy strong").textContent,
        units: Number(n.querySelector(".cart-quantity > span").textContent),
        subtotal:
          n.querySelector(".cart-line-subtotal strong")?.textContent ?? null,
        divider: s.borderTopWidth,
        borderColor: s.borderTopColor,
        shadow: s.boxShadow,
        radius: s.borderRadius,
        nameClamp: getComputedStyle(n.querySelector("h3")).webkitLineClamp,
        nameType: [
          getComputedStyle(n.querySelector("h3")).fontSize,
          getComputedStyle(n.querySelector("h3")).fontWeight,
        ],
        priceType: [
          getComputedStyle(n.querySelector(".cart-line-copy strong")).fontSize,
          getComputedStyle(n.querySelector(".cart-line-copy strong"))
            .fontWeight,
        ],
        fit: image ? getComputedStyle(image).objectFit : "fallback",
        targets: [...n.querySelectorAll("button")].map((b) => ({
          height: b.getBoundingClientRect().height,
          disabled: b.disabled,
          name: b.getAttribute("aria-label"),
          opacity: getComputedStyle(b).opacity,
        })),
      };
    }),
  );
  assert.equal(metrics.length, count);
  await capture(page, width, label);
  console.log(
    `${width} ${label} row heights: ${metrics.map((m) => Math.round(m.height)).join(", ")}`,
  );
  for (const [index, m] of metrics.entries()) {
    assert(
      m.height <= (width === 320 ? 165 : 125),
      `${width} ${m.name}: row height ${m.height}`,
    );
    assert.deepEqual([m.image.width, m.image.height], [64, 64]);
    assert(["contain", "fallback"].includes(m.fit));
    assert.equal(m.nameClamp, "2");
    assert.deepEqual(m.nameType, ["14px", "600"]);
    assert.deepEqual(m.priceType, ["16px", "700"]);
    assert(m.targets.every((t) => t.height >= 44));
    assert.equal(m.targets[2].name, `Remove ${m.name}`);
    assert.equal(m.shadow, "none");
    assert.equal(m.radius, "0px");
    assert.equal(m.divider, index === 0 ? "0px" : "1px");
    if (index > 0) assert.equal(m.borderColor, "rgb(233, 233, 233)");
    if (width === 320) {
      assert(m.copy.bottom <= m.quantity.top + 1);
      assert(m.quantity.right <= m.remove.left);
    } else {
      assert(m.copy.right <= m.quantity.left && m.copy.right <= m.remove.left);
      assert(m.quantity.bottom <= m.remove.top + 1);
    }
    assert.equal(
      m.subtotal,
      m.units > 1 ? money(minor(m.unitPrice) * m.units) : null,
    );
  }
  const summaryGap = await page.evaluate(
    () =>
      document.querySelector(".quote-card").getBoundingClientRect().top -
      document.querySelector(".cart-lines").getBoundingClientRect().bottom,
  );
  assert.equal(summaryGap, 16);
  return metrics;
}

try {
  for (const [width, height] of [
    [390, 844],
    [430, 932],
    [320, 844],
  ]) {
    const page = await open(width, height);
    await addFirstAvailable(page);
    await basket(page);
    const single = await rows(page, width, "A-C-single-unit", 1);
    assert.equal(single[0].units, 1);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    for (let i = 0; i < 4; i++) await addFirstAvailable(page);
    await basket(page);
    const many = await rows(page, width, "B-many-items", 5);
    assert.equal(new Set(many.map((m) => m.name)).size, 5);
    await page.locator(".cart-line").last().scrollIntoViewIfNeeded();
    await capture(page, width, "B-many-items-end");
    const first = page.locator(".cart-line").first();
    for (let i = 0; i < 5; i++)
      await first
        .getByRole("button", { name: "Increase quantity", exact: true })
        .click();
    await first
      .getByRole("button", { name: "Decrease quantity", exact: true })
      .click();
    assert.equal(await first.locator(".cart-quantity > span").innerText(), "5");
    await first
      .getByRole("button", { name: "Increase quantity", exact: true })
      .click();
    const multipleUnits = await rows(page, width, "D-multiple-units", 5);
    assert.equal(multipleUnits[0].units, 6);
    assert.deepEqual(
      multipleUnits.map((m) => m.unitPrice),
      many.map((m) => m.unitPrice),
    );
    await page
      .locator(".app-header")
      .getByText("Your basket (10)", { exact: true })
      .waitFor();
    const itemsSubtotal = multipleUnits.reduce(
      (sum, m) => sum + minor(m.unitPrice) * m.units,
      0,
    );
    assert.equal(
      await page.locator(".cart-display-total strong").innerText(),
      money(itemsSubtotal),
    );
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page
      .getByText("Prices and fees confirmed", { exact: true })
      .waitFor();
    const totals = await page.locator(".quote-totals dd").allTextContents();
    assert.deepEqual(totals, [
      money(itemsSubtotal),
      money(490),
      money(50),
      money(itemsSubtotal + 540),
    ]);
    await page.locator(".quote-card").scrollIntoViewIfNeeded();
    await capture(page, width, "J-summary");
    await page.getByRole("button", { name: /^Pay RM/ }).click();
    await page
      .getByRole("heading", { name: "Payment pending", exact: true })
      .waitFor();
    await page.locator(".app-shell__scroll").evaluate((n) => {
      n.scrollTop = 0;
    });
    const frozen = await rows(page, width, "F-frozen", 5);
    assert(
      frozen.every((m) =>
        m.targets.every((t) => t.disabled && t.opacity === "0.6"),
      ),
    );
    assert.equal(await page.locator(".cart-change-address").isDisabled(), true);
    assert.equal(
      await page.getByText("Order confirmed", { exact: true }).count(),
      0,
    );
    await page
      .locator(".cart-line")
      .last()
      .getByRole("button", { name: /^Remove / })
      .scrollIntoViewIfNeeded();
    await capture(page, width, "F-frozen-end");
    await page.close();

    const long = await open(width, height, "card-alignment");
    await addFirstAvailable(long);
    await basket(long);
    const longName = await rows(long, width, "E-long-name", 1);
    assert.equal(longName[0].name, "Synthetic long-name apples sample pack");
    await long
      .getByRole("button", { name: `Remove ${longName[0].name}`, exact: true })
      .focus();
    assert.equal(
      await long.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      `Remove ${longName[0].name}`,
    );
    await long.keyboard.press("Enter");
    await long
      .getByRole("heading", { name: "Your basket is empty", exact: true })
      .waitFor();
    await long.close();
    results.push({
      viewport: [width, height],
      acceptance: Object.fromEntries(
        "ABCDEFGHIJ".split("").map((k) => [k, "PASS"]),
      ),
      single,
      many,
      multipleUnits,
      frozen,
      longName,
      totals,
    });
    console.log(`${width}x${height}: Basket A-J PASS`);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify({ status: "PASS", results, errors }, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
