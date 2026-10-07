// Synthetic browser-emulation evidence for CKSGO-BRAND01.
// This uses the repository's in-memory development adapters. It does not use a
// real account, create an order, contact a payment provider, or claim physical
// device coverage.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.BRAND01_ORIGIN ?? "http://127.0.0.1:5193";
const output =
  process.env.BRAND01_EVIDENCE_DIR ?? "verification/cksgo-brand01/after";
const expectBlue = process.env.BRAND01_EXPECT_BLUE === "true";
const chromePath = process.env.CHROME_PATH;
const parsedOrigin = new URL(origin);
assert(
  ["127.0.0.1", "localhost"].includes(parsedOrigin.hostname),
  "BRAND01_ORIGIN must be loopback-only",
);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});
const results = [];

async function installEmulation(page, { embedded, enlarged = false }) {
  if (!embedded) {
    await page.route("**/src/main.tsx*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      assert(source.includes("Boolean(window.SavtCksGoBridge)"));
      await route.fulfill({
        response,
        body: source.replace("Boolean(window.SavtCksGoBridge)", "false"),
      });
    });
  }
  await page.addInitScript(() => {
    window.__brand01Messages = [];
    window.__brand01Opened = [];
    window.open = (...args) => {
      window.__brand01Opened.push(args);
      return null;
    };
    window.SavtCksGoBridge = {
      postMessage(raw) {
        window.__brand01Messages.push(JSON.parse(raw));
      },
    };
  });
  await page.goto(`${origin}/?scenario=cust-shop01r`);
  if (!embedded) {
    // Repository-local development adapter only: no SMS or identity service.
    await page.getByLabel("Mobile number", { exact: true }).fill("0123456789");
    await page.getByRole("button", { name: "Send OTP", exact: true }).click();
    await page.getByLabel("One-time code", { exact: true }).fill("123456");
    await page
      .getByRole("button", { name: "Verify & continue", exact: true })
      .click();
  }
  await page.addStyleTag({
    content: `:root {
      --safe-area-top: 24px !important;
      --safe-area-bottom: 34px !important;
      ${enlarged ? "font-size: 200% !important;" : ""}
    }`,
  });
  await page.getByRole("searchbox", { name: "Search products" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function setFixture(page, label, value) {
  const control = page.getByLabel(label, { exact: true });
  await control.evaluate((element) => {
    const details = element.closest("details");
    if (details) details.open = true;
  });
  await control.selectOption(value);
  await control.evaluate((element) => {
    const details = element.closest("details");
    if (details) details.open = false;
  });
}

async function installOrderDocumentsFixture(page) {
  await page.route("**/src/catalogue/development.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const boundary = "const orderPathMatch = u.pathname.match(";
    assert(source.includes(boundary));
    const fixture = `
    const brandDocumentsMatch = u.pathname.match(
      /^\\/api\\/v1\\/customer\\/orders\\/([0-9a-f-]{36})\\/documents$/i,
    );
    if (brandDocumentsMatch && init?.method === "GET") {
      const orderId = brandDocumentsMatch[1];
      const issuedAt = new Date(this.fixtureTime).toISOString();
      return Response.json({ data: {
        orderId,
        paymentReceiptAvailable: true,
        finalSalesReceiptAvailable: true,
        paymentReceipt: {
          kind: "PAYMENT_RECEIPT",
          receiptReference: "SYNTH-PAYMENT-RECEIPT",
          issuedAt,
          metadataPath: \`/api/v1/orders/\${orderId}/payment-receipt\`,
          downloadPath: \`/api/v1/orders/\${orderId}/payment-receipt/download\`,
        },
        finalSalesReceipt: {
          kind: "FINAL_SALES_RECEIPT",
          receiptReference: "SYNTH-FINAL-SALES-RECEIPT",
          issuedAt,
          metadataPath: \`/api/v1/orders/\${orderId}/receipt\`,
          downloadPath: \`/api/v1/orders/\${orderId}/receipt/download\`,
        },
      } });
    }
    `;
    await route.fulfill({
      response,
      body: source
        .replaceAll("SYNTH-ORDER-", "CKSGO-SYNTH-ORDER-")
        .replace(boundary, `${fixture}${boundary}`),
    });
  });
}

async function assertPalette(page) {
  const palette = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return {
      light: css.getPropertyValue("--color-cks-light").trim(),
      onLight: css.getPropertyValue("--color-on-cks-light").trim(),
      action: css.getPropertyValue("--color-cks-primary").trim(),
      hover: css.getPropertyValue("--color-cks-primary-hover").trim(),
      pressed: css.getPropertyValue("--color-cks-primary-pressed").trim(),
      soft: css.getPropertyValue("--color-cks-primary-soft").trim(),
      focus: css.getPropertyValue("--focus-ring").trim(),
      background: css.getPropertyValue("--color-background").trim(),
      muted: css.getPropertyValue("--color-surface-muted").trim(),
      border: css.getPropertyValue("--color-border").trim(),
      borderStrong: css.getPropertyValue("--color-border-strong").trim(),
    };
  });
  if (expectBlue) {
    assert.deepEqual(palette, {
      light: "#8ecbe2",
      onLight: "#123d56",
      action: "#0c74b6",
      hover: "#09639c",
      pressed: "#084f7c",
      soft: "#e8f5fa",
      focus: "#0c74b6",
      background: "#f3f8fb",
      muted: "#eaf2f6",
      border: "#d9e6ed",
      borderStrong: "#b7cbd6",
    });
  }
  return palette;
}

async function assertGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const shell = document.querySelector(".app-shell");
    const scroller = document.querySelector(".app-shell__scroll");
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    const navBox = nav?.getBoundingClientRect();
    const shellBox = shell?.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth > innerWidth,
      scrollerOverflow: scroller
        ? scroller.scrollWidth > scroller.clientWidth + 1
        : true,
      shellLeft: shellBox?.left,
      shellRight: shellBox?.right,
      navBottom: navBox?.bottom,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      safeTop: getComputedStyle(document.documentElement)
        .getPropertyValue("--safe-area-top")
        .trim(),
      safeBottom: getComputedStyle(document.documentElement)
        .getPropertyValue("--safe-area-bottom")
        .trim(),
    };
  });
  assert.equal(geometry.documentOverflow, false, `${label}: document overflow`);
  assert.equal(geometry.scrollerOverflow, false, `${label}: scroller overflow`);
  assert(geometry.shellLeft >= -0.5, `${label}: shell clipped left`);
  assert(
    geometry.shellRight <= geometry.viewportWidth + 0.5,
    `${label}: shell clipped right`,
  );
  assert(
    geometry.navBottom <= geometry.viewportHeight + 0.5,
    `${label}: navigation clipped below viewport`,
  );
  assert.equal(geometry.safeTop, "24px");
  assert.equal(geometry.safeBottom, "34px");

  const visibleActions = page.locator(
    "button:visible, a[href]:visible, input:visible, select:visible, summary:visible",
  );
  for (let index = 0; index < (await visibleActions.count()); index += 1) {
    const action = visibleActions.nth(index);
    const box = await action.boundingBox();
    if (!box || box.y + box.height < 0 || box.y > geometry.viewportHeight)
      continue;
    const intentionallyScrollable = await action.evaluate((element) => {
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (
          parent.scrollWidth > parent.clientWidth + 1 &&
          (overflowX === "auto" || overflowX === "scroll")
        )
          return true;
      }
      return false;
    });
    if (intentionallyScrollable) continue;
    assert(box.x >= -1, `${label}: action clipped left`);
    assert(
      box.x + box.width <= geometry.viewportWidth + 1,
      `${label}: action clipped right`,
    );
  }
  return geometry;
}

async function capture(page, width, label) {
  const geometry = await assertGeometry(page, `${width}-${label}`);
  await page.screenshot({
    path: join(output, `${width}-${label}.png`),
    fullPage: false,
  });
  return geometry;
}

async function verifyKeyboardFocus(page, { submitSearch = true } = {}) {
  const search = page.getByRole("searchbox", { name: "Search products" });
  await page.evaluate(() => document.activeElement?.blur());
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    if (await search.evaluate((element) => document.activeElement === element))
      break;
  }
  const focus = await search.evaluate(async (element) => {
    // The reduced-motion stylesheet retains a 0.01ms transition. Two frames
    // ensure this samples the settled focus-visible style, not its start value.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const css = getComputedStyle(element);
    const wrapper = element
      .closest(".catalogue-search")
      ?.querySelector(":scope > div");
    const wrapperCss = wrapper ? getComputedStyle(wrapper) : null;
    return {
      active: document.activeElement === element,
      focusVisible: element.matches(":focus-visible"),
      outlineStyle: css.outlineStyle,
      outlineWidth: css.outlineWidth,
      outlineColor: css.outlineColor,
      focusRing: css.getPropertyValue("--focus-ring").trim(),
      wrapperOutlineStyle: wrapperCss?.outlineStyle ?? "missing",
      wrapperOutlineWidth: wrapperCss?.outlineWidth ?? "missing",
      wrapperOutlineColor: wrapperCss?.outlineColor ?? "missing",
      wrapperOutlineOffset: wrapperCss?.outlineOffset ?? "missing",
    };
  });
  assert.equal(focus.active, true);
  assert.equal(focus.focusVisible, true);
  assert.notEqual(focus.outlineStyle, "none");
  assert(parseFloat(focus.outlineWidth) >= 2);
  if (expectBlue) {
    assert.equal(focus.focusRing, "#0c74b6");
    assert.equal(focus.outlineColor, "rgb(12, 116, 182)");
    assert.equal(focus.wrapperOutlineStyle, "solid");
    assert.equal(focus.wrapperOutlineWidth, "3px");
    assert.equal(focus.wrapperOutlineColor, "rgb(12, 116, 182)");
    assert.equal(focus.wrapperOutlineOffset, "3px");
  }
  if (submitSearch) {
    await search.fill("Rice");
    await search.press("Enter");
    assert.equal(await search.inputValue(), "Rice");
  }
  return focus;
}

async function showOrderSupportAction(page) {
  const support = page.getByRole("button", {
    name: /^Open WhatsApp support for order/,
  });
  await support.waitFor();
  await support.evaluate((element) => {
    // Give the final help section enough scroll tail to clear the fixed nav in
    // the synthetic receipt fixture, then center the real support control.
    const section = element.closest(".support-action");
    if (section instanceof HTMLElement) section.style.marginBottom = "180px";
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(await support.isVisible(), true);
  return support;
}

async function verifyStandalone(width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/customer/support", (route) =>
    route.fulfill({ json: { data: { whatsapp: "+60123456789" } } }),
  );
  await page.route("**/src/catalogue/development.ts*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const boundary = "const orderPathMatch = u.pathname.match(";
    assert(source.includes(boundary));
    const documentsFixture = `
    const brandDocumentsMatch = u.pathname.match(
      /^\\/api\\/v1\\/customer\\/orders\\/([0-9a-f-]{36})\\/documents$/i,
    );
    if (brandDocumentsMatch && init?.method === "GET") {
      const orderId = brandDocumentsMatch[1];
      const issuedAt = new Date(this.fixtureTime).toISOString();
      return Response.json({ data: {
        orderId,
        paymentReceiptAvailable: true,
        finalSalesReceiptAvailable: true,
        paymentReceipt: {
          kind: "PAYMENT_RECEIPT",
          receiptReference: "SYNTH-PAYMENT-RECEIPT",
          issuedAt,
          metadataPath: \`/api/v1/orders/\${orderId}/payment-receipt\`,
          downloadPath: \`/api/v1/orders/\${orderId}/payment-receipt/download\`,
        },
        finalSalesReceipt: {
          kind: "FINAL_SALES_RECEIPT",
          receiptReference: "SYNTH-FINAL-SALES-RECEIPT",
          issuedAt,
          metadataPath: \`/api/v1/orders/\${orderId}/receipt\`,
          downloadPath: \`/api/v1/orders/\${orderId}/receipt/download\`,
        },
      } });
    }
    `;
    await route.fulfill({
      response,
      body: source.replace(boundary, `${documentsFixture}${boundary}`),
    });
  });
  try {
    await installEmulation(page, { embedded: false });
    assert.equal(
      await page.getByRole("button", { name: "Close CKS Go" }).count(),
      1,
      "Standalone keeps its app-owned close control",
    );
    assert.equal(
      await page.locator(".app-header__brand").count(),
      1,
      "Standalone keeps one app-owned brand",
    );
    const logo = await page
      .locator(".app-header__brand .cks-go-logo")
      .evaluate((image) => {
        const box = image.getBoundingClientRect();
        const css = getComputedStyle(image);
        return {
          alt: image.getAttribute("alt"),
          width: box.width,
          height: box.height,
          ratio: box.width / box.height,
          objectFit: css.objectFit,
        };
      });
    assert.equal(logo.alt, "CKS Go");
    assert.equal(logo.height, 44);
    assert(Math.abs(logo.ratio - 682.7768 / 363.8954) < 0.01);
    assert.equal(logo.objectFit, "contain");
    const palette = await assertPalette(page);
    await capture(page, width, "standalone-home");
    assert.deepEqual(errors, []);
    return { palette };
  } finally {
    await page.close();
  }
}

async function verifyEmbedded(width, height) {
  const page = await browser.newPage({
    viewport: { width, height },
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/customer/support", (route) =>
    route.fulfill({ json: { data: { whatsapp: "+60123456789" } } }),
  );
  await page.route("**/src/catalogue/components.tsx*", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const configured =
      "const supportWhatsApp = suppliedSupportWhatsApp ?? configuredSupportWhatsApp;";
    assert(source.includes(configured));
    await route.fulfill({
      response,
      body: source.replace(
        configured,
        'const supportWhatsApp = suppliedSupportWhatsApp || configuredSupportWhatsApp || "+60123456789";',
      ),
    });
  });
  await installOrderDocumentsFixture(page);
  try {
    await installEmulation(page, { embedded: true });
    assert.equal(
      await page.getByRole("button", { name: "Close CKS Go" }).count(),
      0,
      "Embedded host owns close chrome",
    );
    assert.equal(
      await page.locator(".app-header__brand").count(),
      0,
      "Embedded host owns app branding/title chrome",
    );
    const palette = await assertPalette(page);
    const focus = await verifyKeyboardFocus(page);
    await capture(page, width, "home-search-focus");

    await page.getByRole("button", { name: "Clear search" }).click();
    await page.getByRole("button", { name: "Browse all", exact: true }).click();
    await page
      .getByRole("heading", { name: "All products", exact: true })
      .waitFor();
    const selectedCategory = page.getByRole("button", {
      name: "Fresh Fruits & Vegetables",
      exact: true,
    });
    await selectedCategory.click();
    await page
      .getByRole("heading", {
        name: "Fresh Fruits & Vegetables",
        exact: true,
        level: 2,
      })
      .waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("button")].some(
        (button) =>
          button.textContent?.trim() === "Fresh Fruits & Vegetables" &&
          button.getAttribute("aria-pressed") === "true",
      ),
    );
    if (expectBlue) {
      const selected = await selectedCategory.evaluate(async (element) => {
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        const css = getComputedStyle(element);
        return { color: css.color, background: css.backgroundColor };
      });
      assert.deepEqual(selected, {
        color: "rgb(18, 61, 86)",
        background: "rgb(142, 203, 226)",
      });
    }
    await capture(page, width, "browse-category");

    await page.getByRole("button", { name: "All", exact: true }).click();
    const product = page.locator(".catalogue-tile").first();
    await product.waitFor();
    const productName = await product.locator(".catalogue-name").innerText();
    await product
      .getByRole("button", { name: `View ${productName}`, exact: true })
      .click();
    await page
      .locator(".catalogue-detail")
      .getByRole("heading", { name: productName, exact: true })
      .waitFor();
    await capture(page, width, "product-detail");

    await setFixture(page, "Backend payment result", "failed");
    await page
      .getByRole("button", { name: "Add to Basket", exact: true })
      .click();
    await page
      .getByRole("button", { name: /^Basket/ })
      .last()
      .click();
    await page
      .getByRole("heading", { name: "Your items", exact: true })
      .waitFor();
    await capture(page, width, "basket");

    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    const pay = page.getByRole("button", { name: /^Pay (RM|MYR)/ });
    await pay.waitFor();
    await pay.scrollIntoViewIfNeeded();
    await capture(page, width, "checkout");
    await pay.click();
    await page
      .getByRole("heading", { name: "Confirming your payment…", exact: true })
      .waitFor();
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
    const paymentFailed = page.getByRole("heading", {
      name: "Payment failed",
      exact: true,
    });
    await paymentFailed.waitFor();
    await paymentFailed.scrollIntoViewIfNeeded();
    await capture(page, width, "payment-result");

    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.addStyleTag({
      content:
        ":root { --safe-area-top: 24px !important; --safe-area-bottom: 34px !important; }",
    });
    await page.getByRole("searchbox", { name: "Search products" }).waitFor();
    await setFixture(page, "Customer orders", "active");
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page
      .getByRole("button", { name: /^View order/ })
      .first()
      .waitFor();
    await capture(page, width, "orders");
    await page
      .getByRole("button", { name: /^View order/ })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Need help with this order?", exact: true })
      .waitFor();
    await capture(page, width, "tracking");
    const orderHelp = page.getByRole("heading", {
      name: "Need help with this order?",
      exact: true,
    });
    await orderHelp.waitFor();
    await showOrderSupportAction(page);
    await capture(page, width, "order-help");

    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page.addStyleTag({
      content:
        ":root { --safe-area-top: 24px !important; --safe-area-bottom: 34px !important; }",
    });
    await page.getByRole("searchbox", { name: "Search products" }).waitFor();
    await setFixture(page, "Customer orders", "receipt-ready");
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page
      .getByRole("button", { name: "Refresh orders", exact: true })
      .click();
    await page.getByRole("button", { name: /^Order history/ }).click();
    await page
      .getByRole("button", { name: /^View order/ })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: /^View order/ })
      .first()
      .click();
    const finalReceipt = page.getByRole("heading", {
      name: "Final Sales Receipt",
      exact: true,
    });
    await finalReceipt.waitFor();
    await finalReceipt.scrollIntoViewIfNeeded();
    await capture(page, width, "receipt-documents");
    const receiptHelp = page.getByRole("heading", {
      name: "Need help with this order?",
      exact: true,
    });
    await receiptHelp.waitFor();
    await showOrderSupportAction(page);
    await capture(page, width, "receipt-help");

    assert.deepEqual(errors, []);
    return { palette, focus, productName };
  } finally {
    await page.close();
  }
}

async function verifyEnlargedText() {
  const page = await browser.newPage({
    viewport: { width: 320, height: 844 },
    reducedMotion: "reduce",
  });
  try {
    await page.route("**/api/v1/customer/support", (route) =>
      route.fulfill({ json: { data: { whatsapp: "+60123456789" } } }),
    );
    await installEmulation(page, { embedded: true, enlarged: true });
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).fontSize,
      ),
      "32px",
    );
    const geometry = await capture(page, 320, "enlarged-text-200pct");
    return geometry;
  } finally {
    await page.close();
  }
}

async function verifyStoreLoading() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  try {
    await page.route("**/src/main.tsx*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      assert(source.includes("Boolean(window.SavtCksGoBridge)"));
      await route.fulfill({
        response,
        body: source.replace("Boolean(window.SavtCksGoBridge)", "false"),
      });
    });
    await page.route("**/src/api/development.ts*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const signature = /async bootstrap\(\)(?:: Promise<BootstrapData>)? \{/;
      assert(signature.test(source));
      await route.fulfill({
        response,
        body: source.replace(
          signature,
          (match) =>
            `${match}\n    await new Promise((resolve) => setTimeout(resolve, 2000));`,
        ),
      });
    });
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    const loading = page.getByRole("status").filter({
      has: page.getByRole("heading", {
        name: "Getting CKS Go ready…",
        exact: true,
      }),
    });
    await loading.waitFor();
    const logo = await loading.locator(".cks-go-logo").evaluate((image) => {
      const box = image.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        ratio: box.width / box.height,
        objectFit: getComputedStyle(image).objectFit,
      };
    });
    assert.equal(logo.height, 44);
    assert(Math.abs(logo.ratio - 682.7768 / 363.8954) < 0.01);
    assert.equal(logo.objectFit, "contain");
    await page.screenshot({
      path: join(output, "390-store-loading.png"),
      fullPage: false,
    });
    return logo;
  } finally {
    await page.close();
  }
}

async function verifyKeyboardHeight() {
  const page = await browser.newPage({
    viewport: { width: 390, height: 480 },
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  try {
    await page.route("**/api/v1/customer/support", (route) =>
      route.fulfill({ json: { data: { whatsapp: "+60123456789" } } }),
    );
    await installEmulation(page, { embedded: true });
    const focus = await verifyKeyboardFocus(page, { submitSearch: false });
    const geometry = await capture(page, 390, "keyboard-height-480");
    return { focus, geometry };
  } finally {
    await page.close();
  }
}

try {
  const loadingLogo = await verifyStoreLoading();
  results.push({
    width: 390,
    height: 844,
    mode: "synthetic-browser-emulation",
    storeLoading: "PASS",
    logo: loadingLogo,
  });
  const keyboardHeight = await verifyKeyboardHeight();
  results.push({
    width: 390,
    height: 480,
    mode: "synthetic-browser-emulation",
    keyboardHeight:
      "Software keyboard condition simulated by viewport resize; no physical keyboard or WebView claim",
    focus: keyboardHeight.focus,
    overflow: false,
    simulatedSafeArea: {
      top: keyboardHeight.geometry.safeTop,
      bottom: keyboardHeight.geometry.safeBottom,
    },
  });
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [430, 932],
  ]) {
    const standalone = await verifyStandalone(width, height);
    const embedded = await verifyEmbedded(width, height);
    results.push({
      width,
      height,
      mode: "synthetic-browser-emulation",
      standaloneChrome: "PASS",
      embeddedChrome: "PASS",
      journey: [
        "home-search-focus",
        "browse-category",
        "product-detail",
        "basket",
        "checkout",
        "payment-result",
        "orders",
        "tracking",
        "order-help",
        "receipt-documents",
        "receipt-help",
      ],
      palette: embedded.palette,
      standalonePalette: standalone.palette,
    });
  }
  const enlarged = await verifyEnlargedText();
  results.push({
    width: 320,
    height: 844,
    mode: "synthetic-browser-emulation",
    rootTextScale: "200%",
    overflow: false,
    simulatedSafeArea: {
      top: enlarged.safeTop,
      bottom: enlarged.safeBottom,
    },
  });
  await writeFile(
    join(output, "results.json"),
    `${JSON.stringify(
      {
        claimScope:
          "Synthetic Chrome browser emulation only; no physical-device claim",
        origin,
        expectBlue,
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify({ output, widths: [320, 390, 430], checks: results.length }),
  );
} finally {
  await browser.close();
}
