// Local synthetic acceptance. No production catalogue, payment, or WhatsApp calls.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const engines = createRequire(import.meta.url)("playwright");
const origin = process.env.CKS_GO_ORIGIN ?? "http://127.0.0.1:5186";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const output =
  process.env.CKS_GO_VISUAL_CAPTURE ?? path.join(tmpdir(), "cks-go-cust-ux06");
await mkdir(output, { recursive: true });
const results = [];
async function capture(page, engine, width, label) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => {
    const scroller = document.querySelector(".app-shell__scroll");
    return (
      document.documentElement.scrollWidth > innerWidth ||
      scroller.scrollWidth > scroller.clientWidth
    );
  });
  assert.equal(overflow, false, `${label}: no horizontal overflow`);
  const nav = page.locator('nav[aria-label="Primary navigation"]');
  assert.equal(await nav.getByRole("button").count(), 4);
  const navBox = await nav.boundingBox();
  assert(navBox.y + navBox.height <= page.viewportSize().height + 1);
  const sticky = page.locator(".catalogue-detail-purchase");
  if (await sticky.count()) {
    const box = await sticky.boundingBox();
    assert(
      box.y + box.height <= navBox.y + 1,
      "Purchase controls cannot overlap bottom nav",
    );
  }
  await page.screenshot({
    path: path.join(output, `${engine}-${width}-${label}.png`),
  });
}
async function fixtures(page, label, option) {
  const controls = page
    .locator("details.catalogue-dev")
    .filter({ has: page.getByLabel(label, { exact: true }) });
  await controls.evaluate((el) => {
    el.open = true;
  });
  await page.getByLabel(label, { exact: true }).selectOption(option);
  await controls.evaluate((el) => {
    el.open = false;
  });
}
async function searchEvents(page) {
  return page.evaluate(() => window.__searchEvents.map((event) => event.query));
}
async function appleResults(page) {
  await page.waitForFunction(() => {
    const names = [
      ...document.querySelectorAll(".catalogue-tile .catalogue-name"),
    ];
    return (
      names.length > 0 && names.every((el) => /^Apples /.test(el.textContent))
    );
  });
}
for (const engine of (
  process.env.CKS_GO_BROWSER_ENGINES ?? "chromium,webkit"
).split(",")) {
  const browser = await engines[engine].launch({
    headless: true,
    ...(engine === "chromium" && process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    for (const [width, height] of [
      [320, 844],
      [390, 844],
      [430, 932],
    ]) {
      console.log(`Checking ${engine} ${width}x${height}`);
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
        ...(engine === "chromium"
          ? {
              userAgent:
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
            }
          : {}),
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/v1/customer/support", (route) =>
        route.fulfill({ json: { data: { whatsapp: "+60123456789" } } }),
      );
      // Observe the real search boundary while retaining all controller behavior.
      await page.route("**/src/catalogue/state.ts*", async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        assert(source.includes("search(q) {"));
        await route.fulfill({
          response,
          body: source.replace(
            "search(q) {",
            "search(q) { window.__searchEvents.push({query:q,time:performance.now()});",
          ),
        });
      });
      await page.addInitScript(() => {
        window.__searchEvents = [];
        window.__handoffs = [];
        window.SavtCksGoBridge = {
          postMessage(raw) {
            window.__handoffs.push(JSON.parse(raw));
          },
        };
      });
      await page.goto(`${origin}/?scenario=cust-shop01r`);
      const input = page.getByRole("searchbox", { name: "Search products" });
      const clear = page.getByRole("button", {
        name: "Clear search",
        exact: true,
      });
      await input.waitFor();
      await page
        .getByRole("heading", { name: "Featured products", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Browse all", exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page.getByRole("button", { name: /See all|Get help/ }).count(),
        0,
      );
      await capture(page, engine, width, "home");
      const allProducts = await page.locator(".catalogue-tile").count();
      assert.equal(await clear.count(), 0, "Empty search must have no clear X");
      await input.fill("Apple");
      assert.equal(
        await clear.count(),
        1,
        "Populated search must have one app-owned clear X",
      );
      const fieldBox = await input.boundingBox();
      const clearBox = await clear.boundingBox();
      assert(
        clearBox.width >= 44 && clearBox.height >= 44,
        "Clear needs a 44px touch target",
      );
      assert(
        clearBox.x >= fieldBox.x &&
          clearBox.x + clearBox.width <= fieldBox.x + fieldBox.width + 1,
        "Clear X must sit inside the input, never in a separate bubble",
      );
      assert(
        clearBox.y >= fieldBox.y &&
          clearBox.y + clearBox.height <= fieldBox.y + fieldBox.height + 1,
      );
      const style = await clear.evaluate((el) => {
        const css = getComputedStyle(el);
        const input = el.parentElement.querySelector("input");
        const inputStyle = getComputedStyle(input);
        return {
          background: css.backgroundColor,
          border: css.borderTopWidth,
          padding: parseFloat(inputStyle.paddingRight),
        };
      });
      assert.equal(style.background, "rgba(0, 0, 0, 0)");
      assert.equal(style.border, "0px");
      assert(style.padding >= clearBox.width + 4);
      assert.equal(await input.getAttribute("type"), "search");
      assert.equal(await input.getAttribute("enterkeyhint"), "search");
      // WebKit on Windows still paints/activates its native cancel control when
      // only appearance:none is set. Its hit area is just left of our button.
      // DOM button counts cannot detect that second control.
      const nativeCancelX = fieldBox.x + fieldBox.width - 60;
      assert(nativeCancelX < clearBox.x);
      await page.touchscreen.tap(
        nativeCancelX,
        fieldBox.y + fieldBox.height / 2,
      );
      await page.waitForTimeout(100);
      assert.equal(
        await input.inputValue(),
        "Apple",
        "The native search cancel hit area must be suppressed",
      );
      const started = await page.evaluate(() => performance.now());
      await input.press("Enter");
      await page.waitForFunction(() =>
        window.__searchEvents.some((event) => event.query === "Apple"),
      );
      const submitted = await page.evaluate(
        () =>
          window.__searchEvents.find((event) => event.query === "Apple").time,
      );
      assert(
        submitted - started < 300,
        "Keyboard Search must submit without waiting for debounce",
      );
      await appleResults(page);
      await capture(page, engine, width, "search");
      await page.locator(".ui-search-field").screenshot({
        path: path.join(output, `${engine}-${width}-search-field.png`),
      });
      await clear.tap();
      await page.waitForFunction(
        () => document.querySelector('input[type="search"]').value === "",
      );
      assert.equal(await input.inputValue(), "");
      assert.equal(await clear.count(), 0);
      assert(
        await input.evaluate((el) => document.activeElement === el),
        "Clear must retain input focus",
      );
      await page.waitForFunction(
        (count) =>
          document.querySelectorAll(".catalogue-tile").length === count,
        allProducts,
      );
      await page
        .getByRole("button", { name: /^View Rice / })
        .first()
        .waitFor();
      assert.equal((await searchEvents(page)).at(-1), "");

      // Clearing also cancels a query whose debounce has not fired yet.
      await page.evaluate(() => {
        window.__searchEvents = [];
      });
      await input.fill("Apple");
      await clear.tap();
      await page.waitForTimeout(400); // Deliberately exceed the production debounce.
      assert(!(await searchEvents(page)).includes("Apple"));
      assert.equal((await searchEvents(page)).at(-1), "");

      await page.getByRole("button", { name: "Browse all", exact: true }).tap();
      await page
        .getByRole("heading", { name: "All products", exact: true })
        .waitFor();
      assert.equal(await input.inputValue(), "");
      await input.fill("Apple");
      await input.press("Enter");
      await appleResults(page);
      await clear.tap();
      await page
        .getByRole("heading", { name: "All products", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Fresh Fruits & Vegetables", exact: true })
        .tap();
      await page
        .getByRole("heading", {
          name: "Fresh Fruits & Vegetables",
          exact: true,
          level: 2,
        })
        .waitFor();
      await input.fill("Apple");
      await input.press("Enter");
      await clear.tap();
      await page.waitForFunction(
        () => document.querySelector('input[type="search"]').value === "",
      );
      assert.equal(await input.inputValue(), "");
      assert(await input.evaluate((el) => document.activeElement === el));
      assert.equal(
        await page
          .getByRole("button", {
            name: "Fresh Fruits & Vegetables",
            exact: true,
          })
          .getAttribute("aria-pressed"),
        "true",
      );
      await capture(page, engine, width, "category-search");

      await page.evaluate(() => {
        window.__searchEvents = [];
      });
      await input.dispatchEvent("compositionstart");
      await input.fill("Apple");
      await input.press("Enter");
      await page.waitForTimeout(400);
      assert.deepEqual(
        await searchEvents(page),
        [],
        "Composition must not trigger search or keyboard submit",
      );
      await input.dispatchEvent("compositionend");
      await page.waitForFunction(() =>
        window.__searchEvents.some((event) => event.query === "Apple"),
      );
      await clear.tap();
      await page.getByRole("button", { name: "All", exact: true }).tap();
      const product = page.locator(".catalogue-tile").first();
      await product.waitFor();
      const name = await product.locator(".catalogue-name").innerText();
      const unit = await product.locator(".catalogue-unit").innerText();
      const price = await product.locator(".catalogue-price").innerText();
      await product
        .getByRole("button", { name: `View ${name}`, exact: true })
        .tap();
      const detail = page.locator(".catalogue-detail");
      await detail.waitFor();
      assert.equal(
        await detail.getByRole("heading", { name, exact: true }).innerText(),
        name,
      );
      assert.equal(
        await detail.locator(".catalogue-detail-unit").innerText(),
        unit,
      );
      assert.equal(await detail.locator("strong").innerText(), price);
      const media = await detail.locator(".catalogue-image").evaluate((el) => {
        const css = getComputedStyle(el);
        return {
          radius: parseFloat(css.borderTopLeftRadius),
          overflow: css.overflow,
          fit: getComputedStyle(el.querySelector("img")).objectFit,
        };
      });
      assert(media.radius >= 20 && media.radius <= 24);
      assert.equal(media.overflow, "hidden");
      assert.equal(media.fit, "contain");
      const inset = (await detail.boundingBox()).x;
      assert(inset >= 16 && inset <= 20);
      assert.deepEqual(await detail.locator("dt").allTextContents(), [
        "Category",
        "Unit",
        "Storage",
      ]);
      const add = page.getByRole("button", {
        name: "Add to Basket",
        exact: true,
      });
      await add.tap();
      await page.getByText("In your basket", { exact: true }).waitFor();
      assert.equal(
        await page
          .getByRole("group", { name: `Quantity for ${name}`, exact: true })
          .locator('span[aria-live="polite"]')
          .innerText(),
        "1",
      );
      await capture(page, engine, width, "product-detail");

      await fixtures(page, "Customer orders", "empty");
      await page.getByRole("button", { name: "Orders", exact: true }).tap();
      await page
        .getByRole("heading", { name: "No orders yet", exact: true })
        .waitFor();
      const refresh = page.getByRole("button", {
        name: "Refresh orders",
        exact: true,
      });
      assert.equal(await refresh.count(), 1);
      assert.equal(await refresh.locator("xpath=ancestor::header").count(), 1);
      const refreshBox = await refresh.boundingBox();
      assert(refreshBox.width >= 44 && refreshBox.height >= 44);
      assert.equal(
        await page
          .locator(".ui-system-state--empty .ui-system-state__mark svg")
          .count(),
        1,
      );
      const help = page.getByRole("button", {
        name: "Open CKS Go support in WhatsApp",
        exact: true,
      });
      await help.waitFor();
      assert.equal(await help.innerText(), "Get help");
      const helpBox = await help.boundingBox();
      assert(helpBox.height >= 44);
      assert(helpBox.y >= refreshBox.y + refreshBox.height);
      await help.tap();
      const handoff = await page.evaluate(() => window.__handoffs.at(-1));
      assert.equal(handoff.type, "support-handoff");
      assert.equal(
        new URL(handoff.payload.whatsappUrl).searchParams.get("text"),
        "Hi CKS Go Support, I need some help.\n\nMy enquiry:",
      );
      await capture(page, engine, width, "orders-empty");
      await refresh.tap();
      await page
        .getByRole("heading", { name: "No orders yet", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Browse products", exact: true })
        .tap();
      await page
        .getByRole("heading", { name: "Featured products", exact: true })
        .waitFor();
      assert.equal(await page.locator(".support-action--orders").count(), 0);

      await fixtures(page, "Customer orders", "active");
      await page.getByRole("button", { name: "Orders", exact: true }).tap();
      await refresh.tap();
      await page
        .getByRole("button", { name: /^View order/ })
        .first()
        .waitFor();
      assert.equal(await refresh.count(), 1);
      assert.equal(
        await page.getByRole("button", { name: /^Current orders/ }).count(),
        1,
      );
      assert.equal(
        await page.getByRole("button", { name: /^Order history/ }).count(),
        1,
      );
      await capture(page, engine, width, "orders-active");
      assert.deepEqual(errors, []);
      results.push({
        engine,
        width,
        height,
        search: "PASS",
        home: "PASS",
        productDetail: "PASS",
        ordersEmpty: "PASS",
        ordersActive: "PASS",
        help: "PASS",
        bottomNavigation: "PASS",
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  path.join(output, "acceptance.json"),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
