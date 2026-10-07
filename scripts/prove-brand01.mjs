import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const { chromium } = createRequire(import.meta.url)("playwright");
const output = process.env.CKS_GO_VERIFICATION_OUTPUT;
assert.ok(
  output,
  "Set CKS_GO_VERIFICATION_OUTPUT to a fresh evidence directory",
);
mkdirSync(output, { recursive: true });
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
const errors = [];
const forbiddenRequests = [];
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  for (const width of [320, 390]) {
    for (const screen of [
      "header",
      "loading",
      "entry",
      "error",
      "embedded",
      "embedded-loading",
    ]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        reducedMotion: "reduce",
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
          forbiddenRequests.push(url.origin + url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(
        `${server.resolvedUrls.local[0]}verification/brand01.html?screen=${screen}`,
      );
      await page.waitForFunction(
        () => document.documentElement.dataset.brand01Ready === "true",
        undefined,
        { timeout: 5000 },
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/${screen}-${width}.png` });
      const tokens = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return Object.fromEntries(
          [
            "--color-cks-primary",
            "--color-cks-brand-light",
            "--color-cks-brand-ink",
            "--color-background",
            "--color-savt-reward",
            "--color-error",
            "--color-success",
            "--color-warning",
          ].map((key) => [key, style.getPropertyValue(key).trim()]),
        );
      });
      assert.equal(tokens["--color-cks-primary"], "#0c74b6");
      assert.equal(tokens["--color-cks-brand-light"], "#8ecbe2");
      assert.equal(tokens["--color-cks-brand-ink"], "#123d56");
      assert.equal(tokens["--color-background"], "#f3f8fb");
      assert.equal(tokens["--color-savt-reward"], "#4caf50");
      assert.equal(tokens["--color-error"], "#ef4444");
      assert.equal(tokens["--color-success"], "#3f8e1e");
      assert.equal(tokens["--color-warning"], "#f59e0b");
      if (["header", "loading", "entry"].includes(screen)) {
        const logo = page.getByRole("img", { name: "CKS Go", exact: true });
        await logo.waitFor();
        const fitted = await logo.evaluate((el) => {
          const image = el;
          const rect = image.getBoundingClientRect();
          return {
            loaded: image.complete && image.naturalWidth > 0,
            fit: getComputedStyle(image).objectFit,
            ratio: image.naturalWidth / image.naturalHeight,
            left: rect.left,
            right: rect.right,
          };
        });
        assert.equal(fitted.loaded, true);
        assert.equal(fitted.fit, "contain");
        assert.ok(fitted.ratio > 1.87 && fitted.ratio < 1.88);
        assert.ok(fitted.left >= 0 && fitted.right <= width);
        const source = await logo.getAttribute("src");
        const response = await page.request.get(
          new URL(source, page.url()).href,
        );
        const variant = screen === "header" ? "white-blue" : "colour";
        const master = readFileSync(
          `src/assets/branding/cksgo-brand01-v1.1/cks-go-logo-${variant}.svg`,
        );
        assert.deepEqual(await response.body(), master);
      }
      if (screen === "header") {
        assert.equal(
          await page
            .locator(".app-header")
            .evaluate((el) => getComputedStyle(el).backgroundColor),
          "rgb(142, 203, 226)",
        );
      }
      if (screen === "error" || screen === "entry") {
        const action = page.getByRole("button", {
          name: screen === "error" ? "Try again" : "Send OTP",
          exact: true,
        });
        const colors = await action.evaluate((el) => {
          const style = getComputedStyle(el);
          return { background: style.backgroundColor, text: style.color };
        });
        assert.equal(colors.background, "rgb(12, 116, 182)");
        assert.equal(colors.text, "rgb(255, 255, 255)");
      }
      if (screen.startsWith("embedded")) {
        assert.equal(
          await page.getByRole("img", { name: "CKS Go" }).count(),
          0,
        );
        assert.equal(
          await page.getByRole("button", { name: "Close CKS Go" }).count(),
          0,
        );
        assert.equal(
          await page.getByRole("button", { name: "Back", exact: true }).count(),
          0,
        );
        assert.equal(
          await page
            .getByText("Getting CKS Go ready…", { exact: true })
            .count(),
          0,
        );
      }
      assert.equal(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth + 1 ||
            document.body.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      await page.screenshot({ path: `${output}/${screen}-${width}.png` });
      results.push({ screen, width, tokens, overflow: false });
      await page.close();
    }
  }
  // Existing FE-RECEIPT01 fixture, with a local inert host. No download or payment is invoked.
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
        forbiddenRequests.push(url.origin + url.pathname);
        return route.abort();
      }
      if (url.pathname === "/event") return route.fulfill({ json: {} });
      if (url.pathname === "/command")
        return route.fulfill({ json: { command: null } });
      return route.continue();
    });
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
    await page.goto(
      `${server.resolvedUrls.local[0]}verification/receipt-native.html`,
    );
    await page
      .getByText("TEST/DEBUG · Current Orders / Order Detail", { exact: true })
      .waitFor();
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("savt-cks-go-handoff")),
    );
    const paymentReceipt = page.getByRole("button", {
      name: "Download Receipt",
      exact: true,
    });
    const finalReceipt = page.getByRole("button", {
      name: "Download Final Sales Receipt",
      exact: true,
    });
    await paymentReceipt.waitFor();
    await finalReceipt.waitFor();
    assert.equal(await paymentReceipt.isEnabled(), true);
    assert.equal(await finalReceipt.isEnabled(), true);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "html, body, .app-shell, .order-section",
          ),
        ].some((el) => el.scrollWidth > el.clientWidth + 1),
      ),
      false,
    );
    for (const action of [paymentReceipt, finalReceipt]) {
      const size = await action.boundingBox();
      assert.ok(
        size.height >= 44 && size.x >= 0 && size.x + size.width <= width,
      );
    }
    await finalReceipt.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/receipt-documents-${width}.png` });
    results.push({
      screen: "receipt-documents",
      width,
      overflow: false,
      downloadsInvoked: false,
    });
    await page.close();
  }
  const manifest = JSON.parse(
    readFileSync(
      "src/assets/branding/cksgo-brand01-v1.1/manifest.json",
      "utf8",
    ),
  );
  assert.equal(manifest.version, "CKSGO-BRAND01-v1.1");
  for (const [name, record] of Object.entries(manifest.assets)) {
    const bytes = readFileSync(
      `src/assets/branding/cksgo-brand01-v1.1/${name}`,
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      record.sha256,
    );
    if (name !== "cks-go-logo-white.svg") {
      assert.deepEqual(record.svgFills.slice(3), ["#3570bc", "#3470bc"]);
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(forbiddenRequests, []);
  const report = {
    syntheticLocalBrowser: true,
    expiredSessionAcceptance: "NOT_TESTED",
    browser: await browser.version(),
    results,
    errors,
    forbiddenRequests,
  };
  writeFileSync(
    `${output}/browser.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `BRAND01_BROWSER_PASS: ${results.length} mobile cases; no API/provider requests`,
  );
} catch (error) {
  writeFileSync(
    `${output}/failed.json`,
    JSON.stringify(
      { error: error.message, errors, forbiddenRequests },
      null,
      2,
    ),
  );
  console.error(JSON.stringify({ errors, forbiddenRequests }));
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
