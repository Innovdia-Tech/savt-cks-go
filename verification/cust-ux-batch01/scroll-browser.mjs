import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require("C:/Users/isaac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
}
const directory = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(directory, "../..");
const red = process.argv.includes("--red");
const base = "http://127.0.0.1:5201";
const report = {
  task: "CUST-UX-BATCH01: scrollbar",
  phase: red ? "RED" : "GREEN",
  startedAt: new Date().toISOString(),
  scope:
    "Actual AppShell and CartScreen; local Chrome emulation with synthetic data",
  physicalWebView: "PENDING",
  checks: [],
  errors: [],
  externalRequests: [],
};
let vite;
let browser;
let serverOutput = "";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = async (name, work) => {
  try {
    const evidence = await work();
    report.checks.push({
      name,
      status: "PASS",
      ...(evidence ? { evidence } : {}),
    });
  } catch (error) {
    report.checks.push({
      name,
      status: "FAIL",
      error: String(error.message || error),
    });
    console.log(`FAIL ${name}: ${error.message || error}`);
  }
};
try {
  vite = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "verification/cust-ux-batch01/scroll-vite.config.mjs",
      "--configLoader",
      "runner",
      "--host",
      "127.0.0.1",
      "--port",
      "5201",
      "--strictPort",
      "--force",
    ],
    { cwd: project, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  vite.stdout.on("data", (data) => {
    serverOutput += data;
  });
  vite.stderr.on("data", (data) => {
    serverOutput += data;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverOutput.includes("127.0.0.1:5201")) break;
    if (vite.exitCode !== null) throw new Error(serverOutput);
    await pause(100);
  }
  assert.ok(serverOutput.includes("127.0.0.1:5201"), serverOutput);
  browser = await playwright.chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/")) {
        report.externalRequests.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(String(error)));
    const owner = page.locator(".app-shell__scroll");
    const top = () => owner.evaluate((node) => node.scrollTop);
    await page.goto(`${base}/verification/cust-ux-batch01/scroll-fixture.html`);
    await page
      .getByRole("heading", { name: "Your items", exact: true })
      .waitFor();
    const navBefore = await page
      .getByRole("navigation", { name: "Primary navigation" })
      .boundingBox();
    await check(
      `${width}: only actual customer owner visually suppresses scrollbar`,
      async () => {
        const metrics = await owner.evaluate((node) => ({
          overflowY: getComputedStyle(node).overflowY,
          scrollbarWidth: getComputedStyle(node).scrollbarWidth,
          webkitDisplay: getComputedStyle(node, "::-webkit-scrollbar").display,
          gutter: node.offsetWidth - node.clientWidth,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: innerHeight,
          bodyScrollbar: getComputedStyle(document.body).scrollbarWidth,
        }));
        assert.equal(metrics.overflowY, "auto");
        assert.ok(metrics.scrollHeight > metrics.clientHeight);
        assert.equal(metrics.scrollbarWidth, "none");
        assert.equal(metrics.webkitDisplay, "none");
        assert.equal(metrics.gutter, 0);
        assert.equal(metrics.bodyScrollbar, "thin");
        assert.ok(metrics.documentHeight <= metrics.viewportHeight);
        return metrics;
      },
    );
    await check(
      `${width}: mouse wheel scrolling remains functional`,
      async () => {
        await owner.evaluate((node) => {
          node.scrollTop = 0;
        });
        await page.mouse.move(width / 2, 350);
        await page.mouse.wheel(0, 400);
        await page.waitForFunction(
          () => document.querySelector(".app-shell__scroll").scrollTop > 0,
        );
        return { scrollTop: await top() };
      },
    );
    await check(
      `${width}: keyboard PageDown scrolls the focused customer content`,
      async () => {
        await owner.evaluate((node) => {
          node.scrollTop = 0;
        });
        await owner.getByRole("button").first().focus();
        await page.keyboard.press("PageDown");
        await page.waitForFunction(
          () => document.querySelector(".app-shell__scroll").scrollTop > 0,
        );
        return { scrollTop: await top() };
      },
    );
    await check(
      `${width}: native touch gesture scrolls the customer owner`,
      async () => {
        await owner.evaluate((node) => {
          node.scrollTop = 0;
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.synthesizeScrollGesture", {
          x: width / 2,
          y: 500,
          yDistance: -350,
          xDistance: 0,
          gestureSourceType: "touch",
        });
        await page.waitForFunction(
          () => document.querySelector(".app-shell__scroll").scrollTop > 0,
        );
        await cdp.detach();
        return { scrollTop: await top() };
      },
    );
    await check(
      `${width}: navigation stays fixed and content has no horizontal overflow`,
      async () => {
        const navAfter = await page
          .getByRole("navigation", { name: "Primary navigation" })
          .boundingBox();
        assert.equal(navAfter.y, navBefore.y);
        assert.equal(navAfter.height, navBefore.height);
        const sizes = await owner.evaluate((node) => ({
          page: document.documentElement.scrollWidth,
          viewport: innerWidth,
          owner: node.scrollWidth,
          client: node.clientWidth,
        }));
        assert.ok(sizes.page <= sizes.viewport);
        assert.ok(sizes.owner <= sizes.client);
        await page.screenshot({
          path: path.join(directory, `scroll-${red ? "red-" : ""}${width}.png`),
        });
        return { navBefore, navAfter, ...sizes };
      },
    );
    await check(
      `${width}: fee sheet preserves internal scrolling, safe area and dismissal`,
      async () => {
        const info = page.getByRole("button", {
          name: "About small order fee",
          exact: true,
        });
        await info.click();
        const dialog = page.getByRole("dialog", {
          name: "Small order fee",
          exact: true,
        });
        await dialog.waitFor();
        assert.match(await dialog.innerText(), /RM\s*2\.00/);
        await page.evaluate(() => {
          document.documentElement.style.setProperty(
            "--safe-area-bottom",
            "34px",
          );
          const description = document.querySelector(
            ".small-order-fee-sheet > .ui-bottom-sheet__panel > p",
          );
          description.textContent +=
            " Long text wrapping and internal scrolling. ".repeat(35);
          const panel = document.querySelector(
            ".small-order-fee-sheet .ui-bottom-sheet__panel",
          );
          panel.scrollTop = 0;
        });
        const panel = dialog.locator(".ui-bottom-sheet__panel");
        const bounds = await panel.boundingBox();
        await page.mouse.move(width / 2, bounds.y + 90);
        await page.mouse.wheel(0, 350);
        await page.waitForFunction(
          () =>
            document.querySelector(
              ".small-order-fee-sheet .ui-bottom-sheet__panel",
            ).scrollTop > 0,
        );
        const metrics = await panel.evaluate((node) => ({
          overflow: getComputedStyle(node).overflowY,
          scrollTop: node.scrollTop,
          width: node.clientWidth,
          contentWidth: node.scrollWidth,
          paddingBottom: parseFloat(getComputedStyle(node).paddingBottom),
        }));
        assert.equal(metrics.overflow, "auto");
        assert.ok(metrics.contentWidth <= metrics.width);
        assert.equal(metrics.paddingBottom, 54);
        await dialog
          .getByRole("button", { name: "Got it", exact: true })
          .click();
        await dialog.waitFor({ state: "detached" });
        assert.equal(
          await info.evaluate((node) => document.activeElement === node),
          true,
        );
        return {
          ...metrics,
          safeAreaSimulation: "--safe-area-bottom: 34px",
          focusReturned: true,
        };
      },
    );
    await context.close();
  }
} catch (error) {
  report.errors.push(String(error.stack || error));
} finally {
  await browser?.close();
  if (vite && vite.exitCode === null && vite.signalCode === null) {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      vite.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      vite.kill();
    });
  }
  report.serverCleanedUp =
    !vite || vite.exitCode !== null || vite.signalCode !== null;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: report.checks.filter((check) => check.status === "PASS").length,
    failed: report.checks.filter((check) => check.status === "FAIL").length,
    runtimeErrors: report.errors.length,
  };
  const filename = path.join(
    directory,
    `scroll-${red ? "red-" : ""}report.json`,
  );
  await fs.writeFile(filename, JSON.stringify(report, null, 2) + "\n");
  execFileSync(
    process.execPath,
    ["node_modules/prettier/bin/prettier.cjs", "--write", filename],
    { cwd: project, stdio: "ignore" },
  );
  console.log(JSON.stringify(report.summary));
  process.exitCode =
    report.summary.failed ||
    report.summary.runtimeErrors ||
    report.externalRequests.length ||
    !report.serverCleanedUp
      ? 1
      : 0;
}
