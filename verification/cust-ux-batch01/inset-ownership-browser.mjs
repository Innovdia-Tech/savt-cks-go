import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  playwright,
  installEmbeddedFixture,
  startFixtureServer,
  stopFixtureServer,
} from "./browser-fixtures.mjs";

// Catches consuming Android's safe-area a second time in a native-fitted
// viewport. CDP overrides the actual env() values, not our CSS custom property.
const phase = process.argv[2] ?? "green";
const output = path.resolve(
  fileURLToPath(new URL("../../../../evidence/", import.meta.url)),
);
await mkdir(output, { recursive: true });
const cases = [
  {
    name: "samsung-three-button",
    width: 384,
    height: 694,
    bottom: 48,
    scale: 1,
  },
  { name: "oppo-fitted", width: 360, height: 668, bottom: 0, scale: 1 },
  { name: "compact-short", width: 320, height: 480, bottom: 48, scale: 1 },
  { name: "gesture-navigation", width: 390, height: 764, bottom: 24, scale: 1 },
  { name: "large-tall", width: 430, height: 808, bottom: 44, scale: 1 },
  { name: "large-text", width: 412, height: 760, bottom: 48, scale: 1.5 },
  { name: "short-landscape", width: 756, height: 272, bottom: 16, scale: 1.5 },
  {
    name: "standalone-safe-area",
    width: 390,
    height: 764,
    bottom: 34,
    scale: 1,
    standalone: true,
  },
];
const server = await startFixtureServer(5243, true);
const browser = await playwright.chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const results = [];
try {
  for (const test of phase === "red" ? cases.slice(0, 1) : cases) {
    const context = await browser.newContext({
      viewport: { width: test.width, height: test.height },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, left: 0, right: 0, bottom: test.bottom },
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.hostname === "127.0.0.1" || url.pathname.startsWith("/api/v1/")
        ? route.fallback()
        : route.abort();
    });
    const fixture = await installEmbeddedFixture(page, {
      standalone: test.standalone,
    });
    const rendered = () =>
      page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }),
      );
    const measure = () =>
      page.evaluate(() => {
        const nav = document.querySelector(".bottom-navigation");
        const shell = document.querySelector(".app-shell");
        const scroll = document.querySelector(".app-shell__scroll");
        const css = getComputedStyle(nav);
        const probe = document.createElement("div");
        probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
        document.body.append(probe);
        const environmentBottom = getComputedStyle(probe).paddingBottom;
        probe.remove();
        return {
          environmentBottom,
          effectiveBottom: css.getPropertyValue("--safe-area-bottom").trim(),
          paddingBottom: css.paddingBottom,
          nav: nav.getBoundingClientRect().toJSON(),
          shell: shell.getBoundingClientRect().toJSON(),
          scroll: scroll.getBoundingClientRect().toJSON(),
          buttons: [...nav.querySelectorAll("button")].map((button) => ({
            name: button.textContent.trim(),
            ...button.getBoundingClientRect().toJSON(),
          })),
          documentWidth: document.documentElement.scrollWidth,
          route: location.hash,
        };
      });
    const checkBounds = (metrics, height) => {
      assert.ok(
        Math.abs(metrics.nav.bottom - metrics.shell.bottom) <= 1,
        "navigation reaches shell bottom",
      );
      assert.ok(
        metrics.shell.bottom <= height + 1,
        "shell fits available viewport",
      );
      assert.ok(
        metrics.scroll.height > 0,
        "shared content retains scroll space",
      );
      assert.ok(metrics.documentWidth <= test.width, "no horizontal overflow");
      assert.equal(metrics.buttons.length, 4);
      for (const button of metrics.buttons) {
        assert.ok(
          button.height >= 44 && button.width >= 44,
          "accessible targets",
        );
        assert.ok(
          button.top >= 0 && button.bottom <= height + 1,
          "navigation visible",
        );
      }
    };
    await page.goto(`${server.origin}/`);
    await page
      .getByRole("heading", { name: "CKS Go home", exact: true })
      .waitFor();
    if (test.scale !== 1)
      await page.addStyleTag({
        content: `html{font-size:${16 * test.scale}px}`,
      });
    await rendered();
    const before = await measure();
    results.push({
      name: test.name,
      phase,
      expectedEnvironmentBottom: test.bottom,
      before,
    });
    assert.equal(
      before.environmentBottom,
      `${test.bottom}px`,
      "real CSS env() fixture active",
    );
    await page.screenshot({
      path: path.join(output, `${phase}-${test.name}.png`),
    });
    assert.equal(
      parseFloat(before.paddingBottom),
      8 * test.scale + (test.standalone ? test.bottom : 0),
      "system clearance counted once",
    );
    assert.equal(
      before.nav.height,
      70 * test.scale + (test.standalone ? test.bottom : 0),
      "no duplicate strip below navigation",
    );
    checkBounds(before, test.height);
    for (const name of ["Browse", "Basket", "Orders", "Home"]) {
      await page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("button", { name, exact: true })
        .click();
      await rendered();
      const metrics = await measure();
      checkBounds(metrics, test.height);
      assert.equal(metrics.nav.height, before.nav.height);
    }
    const search = page.getByPlaceholder("Search products");
    await search.fill("QA-retained-input");
    await search.focus();
    await cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    });
    const keyboardHeight = Math.max(220, test.height - 200);
    await page.setViewportSize({ width: test.width, height: keyboardHeight });
    await rendered();
    const keyboard = await measure();
    checkBounds(keyboard, keyboardHeight);
    assert.equal(keyboard.nav.height, 70 * test.scale);
    await search.blur();
    await page.setViewportSize({ width: test.width, height: test.height });
    await cdp.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 0, left: 0, right: 0, bottom: test.bottom },
    });
    await rendered();
    const restored = await measure();
    checkBounds(restored, test.height);
    assert.equal(restored.nav.height, before.nav.height);
    assert.equal(await search.inputValue(), "QA-retained-input");
    assert.deepEqual(fixture.trace.errors, []);
    Object.assign(results.at(-1), {
      status: "Pass",
      keyboard,
      restored,
      physicalKeyboard: "Not tested",
    });
    await context.close();
  }
} catch (error) {
  results.push({ status: "Fail", error: String(error) });
  throw error;
} finally {
  await writeFile(
    path.join(output, `inset-${phase}-results.json`),
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
  await stopFixtureServer(server);
  console.log(
    JSON.stringify(
      results.map(({ name, status, error }) => ({ name, status, error })),
    ),
  );
}
