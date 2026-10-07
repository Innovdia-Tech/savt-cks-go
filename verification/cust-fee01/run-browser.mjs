import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";

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
const unknownOnly = process.argv.includes("--unknown-only");
const typographyRed = process.argv.includes("--typography-red");
const report = {
  task: "CUST-FEE01",
  phase: red || unknownOnly || typographyRed ? "RED" : "GREEN",
  startedAt: new Date().toISOString(),
  scope:
    "Real CartScreen with synthetic quoteEnvelope; Chrome browser emulation only",
  physicalWebView:
    "PENDING: Android/iOS WebView, VoiceOver/TalkBack and actual device text scaling",
  fixtureParsing: red
    ? "raw fixture before contract support"
    : "parseQuote applied to all fixture scenarios",
  checks: [],
  screenshots: [],
  errors: [],
  externalRequests: [],
  apiRequests: [],
};
let browser;
let currentPage;
let vite;
let viteOutput = "";
const base = "http://127.0.0.1:5197";
const baselineRevision = "5b4d17dd4657a64bf63263d7e02f761dafca8c2b";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = async (name, run) => {
  try {
    const evidence = await run();
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
const sheet = (page) =>
  page.getByRole("dialog", { name: "Small order fee", exact: true });
const trigger = (page) =>
  page.getByRole("button", { name: "About small order fee", exact: true });
const screenshot = async (page, name) => {
  const filename = `${red ? "red-" : ""}${name}.png`;
  await page.screenshot({
    path: path.join(directory, filename),
    fullPage: (await sheet(page).count()) === 0,
  });
  report.screenshots.push(filename);
};
const load = async (page, scenario = "charged") => {
  await page.goto(
    `${base}/verification/cust-fee01/fixture.html?scenario=${scenario}${red ? "&baseline=1" : "&parse=1"}`,
  );
  await page
    .getByRole("heading", { name: "Order summary", exact: true })
    .waitFor({ timeout: 10000 });
};
const open = async (page) => {
  await trigger(page).click();
  await sheet(page).waitFor();
};
const normalizedText = async (locator) =>
  (await locator.innerText()).replace(/\s+/g, " ");
const amount = (value) => new RegExp(`RM\\s*${value.replace(".", "\\.")}`);
const noOverflow = async (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector(".small-order-fee-sheet");
    return {
      pageScroll: document.documentElement.scrollWidth,
      pageClient: document.documentElement.clientWidth,
      dialogScroll: dialog?.scrollWidth,
      dialogClient: dialog?.clientWidth,
      viewport: window.innerWidth,
      outliers: dialog
        ? [...dialog.querySelectorAll("*")]
            .filter((el) => {
              const box = el.getBoundingClientRect();
              const outer = dialog.getBoundingClientRect();
              return (
                box.width > 0 &&
                (box.left < outer.left - 1 || box.right > outer.right + 1)
              );
            })
            .map((el) => `${el.tagName}.${el.className}`)
        : [],
    };
  });

try {
  if (red) {
    const original = execFileSync(
      "git",
      ["show", `${baselineRevision}:src/checkout/components.tsx`],
      { cwd: project, encoding: "utf8", windowsHide: true },
    );
    const rewritten = original
      .replace(/from "\.\.\//g, 'from "../../../src/')
      .replace(/from "\.\//g, 'from "../../../src/checkout/');
    await fs.mkdir(path.join(directory, ".cache"), { recursive: true });
    await fs.writeFile(
      path.join(directory, ".cache/baseline-components.tsx"),
      rewritten,
    );
    report.baseline = {
      source: `git ${baselineRevision}:src/checkout/components.tsx`,
      revision: baselineRevision,
      timing:
        "Regression baseline captured after current UI implementation; original component used without modifying production",
    };
  }
  await fs.access("C:/Program Files/Google/Chrome/Application/chrome.exe");
  vite = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--config",
      "verification/cust-fee01/vite.fixture.config.mjs",
      "--configLoader",
      "runner",
      "--host",
      "127.0.0.1",
      "--port",
      "5197",
      "--strictPort",
      "--force",
    ],
    { cwd: project, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  vite.stdout.on("data", (chunk) => {
    viteOutput += chunk;
  });
  vite.stderr.on("data", (chunk) => {
    viteOutput += chunk;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (vite.exitCode !== null)
      throw new Error(`Vite exited ${vite.exitCode}: ${viteOutput}`);
    try {
      if ((await fetch(`${base}/verification/cust-fee01/fixture.html`)).ok)
        break;
    } catch {}
    if (attempt === 99)
      throw new Error(`Vite did not become ready: ${viteOutput}`);
    await pause(150);
  }
  browser = await playwright.chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  report.browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      report.apiRequests.push(route.request().url());
      return route.abort();
    }
    if (url.hostname !== "127.0.0.1") {
      report.externalRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  currentPage = page;
  page.on("pageerror", (error) => report.errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error")
      report.errors.push(`Console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      report.errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  if (red) {
    await load(page);
    await check(
      "A small order fee quote exposes its explanation trigger",
      async () => {
        assert.equal(
          await trigger(page).count(),
          1,
          "Missing About small order fee trigger on SMALL_ORDER_TIERS quote",
        );
      },
    );
    await screenshot(page, "charged-390-baseline");
  } else if (unknownOnly) {
    await load(page, "unknown-threshold");
    await open(page);
    await check(
      "Null fee-free threshold is not described as present",
      async () => {
        const text = await normalizedText(sheet(page));
        assert.doesNotMatch(
          text,
          /no-fee threshold|this threshold|to go/i,
          "A null fee-free threshold must not be described as present",
        );
        assert.match(
          text,
          /Delivery charges are excluded from the items total after discounts\./,
        );
        return text;
      },
    );
    await screenshot(page, "null-threshold-before-fix");
  } else {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await load(page);
      await check(
        `${width}x844: sheet stays closed until explicitly opened`,
        async () => {
          assert.equal(await sheet(page).count(), 0);
          assert.equal(await trigger(page).count(), 1);
          assert.equal(
            await page.evaluate(() => window.__feeFixtureMeta.parsed),
            true,
          );
        },
      );
      await check(
        `${width}x844: trigger has accessible name and 44px target`,
        async () => {
          const bounds = await trigger(page).boundingBox();
          assert.ok(
            bounds.width >= 44 && bounds.height >= 44,
            JSON.stringify(bounds),
          );
          return bounds;
        },
      );
      await screenshot(page, `charged-${width}-inline`);
      await open(page);
      await check(
        `${width}x844: charged sheet uses the actual fee and remaining qualifying amount`,
        async () => {
          const text = await normalizedText(sheet(page));
          assert.match(text, amount("2.00"));
          assert.doesNotMatch(
            text,
            amount("9.00"),
            "Matched charge must not replace authoritative processingFeeMinor",
          );
          assert.match(text, amount("7.80"));
          assert.match(
            text,
            /delivery.*(?:excluded|not included|doesn.t count|do not count)|(?:exclude|excluding|doesn.t include).*delivery/i,
          );
          const helper = await normalizedText(
            page.locator(".small-order-fee-helper"),
          );
          assert.match(helper, amount("7.80"));
          return {
            sheet: text,
            helper,
            fixture: await page.evaluate(() => window.__feeFixtureMeta),
          };
        },
      );
      await check(
        `${width}x844: sheet is bottom anchored and fits viewport`,
        async () => {
          const box = await sheet(page).boundingBox();
          assert.ok(
            Math.abs(box.y + box.height - 844) <= 2,
            JSON.stringify(box),
          );
          assert.ok(
            box.x >= -1 && box.x + box.width <= width + 1,
            JSON.stringify(box),
          );
          const dimensions = await noOverflow(page);
          assert.ok(
            dimensions.pageScroll <= dimensions.pageClient,
            JSON.stringify(dimensions),
          );
          assert.ok(
            dimensions.dialogScroll <= dimensions.dialogClient,
            JSON.stringify(dimensions),
          );
          assert.deepEqual(dimensions.outliers, []);
          return { box, dimensions };
        },
      );
      await screenshot(page, `charged-${width}-sheet`);
      await check(
        `${width}x844: Got it receives initial focus, then closes and restores trigger focus`,
        async () => {
          assert.equal(
            await page.evaluate(() =>
              document.activeElement?.textContent?.trim(),
            ),
            "Got it",
          );
          await sheet(page)
            .getByRole("button", { name: "Got it", exact: true })
            .click();
          assert.equal(await sheet(page).count(), 0);
          assert.equal(
            await trigger(page).evaluate((el) => el === document.activeElement),
            true,
          );
        },
      );
      await check(
        `${width}x844: 200% inline fee label, amount and helper have no horizontal overflow`,
        async () => {
          const requestedFonts = await page.evaluate(() => {
            const elements = [
              ...document.querySelectorAll(
                ".small-order-fee-label, .small-order-fee-amount, .small-order-fee-helper > p",
              ),
            ];
            const sizes = elements.map((el) => [
              el,
              parseFloat(getComputedStyle(el).fontSize),
            ]);
            for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
            return sizes.map(([el, size]) => ({
              selector: el.className || el.tagName,
              expected: size * 2,
            }));
          });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const actualFonts = await page.evaluate(() =>
            [
              ...document.querySelectorAll(
                ".small-order-fee-label, .small-order-fee-amount, .small-order-fee-helper > p",
              ),
            ].map((el) => parseFloat(getComputedStyle(el).fontSize)),
          );
          assert.deepEqual(
            actualFonts,
            requestedFonts.map((item) => item.expected),
            "Inline font scaling was lost before rendering",
          );
          const dimensions = await noOverflow(page);
          assert.ok(
            dimensions.pageScroll <= dimensions.pageClient,
            JSON.stringify(dimensions),
          );
          const bounds = await trigger(page).boundingBox();
          assert.ok(
            bounds.width >= 44 && bounds.height >= 44,
            JSON.stringify(bounds),
          );
          assert.equal(await trigger(page).isVisible(), true);
          await screenshot(page, `text200-${width}-inline`);
          return {
            dimensions,
            bounds,
            requestedFonts,
            actualFonts,
            textScale:
              "Computed font sizes doubled for fee label, amount and inline helper",
          };
        },
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await load(page);
    await check(
      "Keyboard activation and native modal keep background page controls inert",
      async () => {
        await trigger(page).focus();
        await page.keyboard.press("Enter");
        await sheet(page).waitFor();
        assert.equal(
          await page.evaluate(() =>
            document.activeElement?.textContent?.trim(),
          ),
          "Got it",
        );
        assert.equal(
          await sheet(page).evaluate((el) => el.matches(":modal")),
          true,
          "Explanation must be a native modal dialog",
        );
        const sequence = [];
        for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab"]) {
          await page.keyboard.press(key);
          const focus = await sheet(page).evaluate((el) => ({
            withinDialog: el.contains(document.activeElement),
            body: document.activeElement === document.body,
            tag: document.activeElement?.tagName,
            text:
              document.activeElement === document.body
                ? "browser chrome / BODY"
                : document.activeElement?.textContent?.trim(),
          }));
          assert.ok(
            focus.withinDialog || focus.body,
            `${key} focused a background page control: ${JSON.stringify(focus)}`,
          );
          sequence.push({ key, ...focus });
        }
        await sheet(page)
          .getByRole("button", { name: "Got it", exact: true })
          .focus();
        await page.locator(".cart-remove").evaluate((el) => el.focus());
        assert.equal(
          await page
            .locator(".cart-remove")
            .evaluate((el) => el === document.activeElement),
          false,
          "Background cart remove button accepted focus while modal open",
        );
        assert.equal(
          await sheet(page)
            .getByRole("button", { name: "Got it", exact: true })
            .evaluate((el) => el === document.activeElement),
          true,
          "Programmatic background focus displaced modal Got it button",
        );
        return {
          sequence,
          note: "Native dialog allows browser chrome / BODY between tab cycles; background page controls remain inert",
        };
      },
    );
    await check(
      "Escape closes and restores explanation trigger focus",
      async () => {
        await page.keyboard.press("Escape");
        assert.equal(await sheet(page).count(), 0);
        assert.equal(
          await trigger(page).evaluate((el) => el === document.activeElement),
          true,
        );
      },
    );
    await open(page);
    await check(
      "Backdrop click closes and restores explanation trigger focus",
      async () => {
        const box = await sheet(page).boundingBox();
        assert.ok(box.y > 20, `No visible backdrop: ${JSON.stringify(box)}`);
        await page.mouse.click(10, Math.max(10, box.y - 20));
        assert.equal(await sheet(page).count(), 0);
        assert.equal(
          await trigger(page).evaluate((el) => el === document.activeElement),
          true,
        );
      },
    );
    for (const scenario of ["zero", "no-match", "disabled"]) {
      await load(page, scenario);
      await check(
        `${scenario}: explicit small order fee quote keeps RM0.00 explanation available`,
        async () => {
          assert.equal(await trigger(page).count(), 1);
          assert.equal(await sheet(page).count(), 0);
          assert.equal(
            await page
              .locator(".quote-totals > .small-order-fee-label")
              .count(),
            1,
          );
          assert.equal(
            await page
              .locator(".quote-totals > .small-order-fee-amount")
              .count(),
            1,
          );
          assert.match(
            await page.locator(".small-order-fee-amount").innerText(),
            amount("0.00"),
          );
          assert.doesNotMatch(
            await page.locator(".quote-totals").innerText(),
            /Processing fee/,
          );
          assert.equal(
            await normalizedText(page.locator(".small-order-fee-helper > p")),
            scenario === "disabled"
              ? "Small order fee is currently not applied."
              : "No small order fee for this order.",
          );
          await open(page);
          const text = await normalizedText(sheet(page));
          assert.match(text, amount("0.00"));
          assert.match(
            text,
            /no small order fee|not charged|no fee|fee.*(?:does not apply|doesn.t apply|not apply|not applied)/i,
          );
          assert.doesNotMatch(text, /add\s+RM\s*7\.80/i);
          await screenshot(page, `${scenario}-390-sheet`);
          return text;
        },
      );
    }
    for (const scenario of [
      "unknown-threshold",
      "equal-threshold",
      "lower-threshold",
    ]) {
      await load(page, scenario);
      await check(
        `${scenario}: no invented fee-free spend advice`,
        async () => {
          await open(page);
          const text = `${await normalizedText(sheet(page))} ${await normalizedText(page.locator(".small-order-fee-helper"))}`;
          assert.doesNotMatch(text, /add\s+RM|avoid.*fee|fee.free|free.*fee/i);
          assert.match(text, amount("2.00"));
          if (scenario === "unknown-threshold") {
            assert.doesNotMatch(
              text,
              /no-fee threshold|this threshold|to go/i,
              "A null fee-free threshold must not be described as present",
            );
            assert.match(
              text,
              /Delivery charges are excluded from the items total after discounts\./,
            );
          }
          return text;
        },
      );
    }
    for (const scenario of ["legacy-percentage", "legacy-fixed"]) {
      await load(page, scenario);
      await check(
        `${scenario}: legacy processing fee remains free of small-order explanation`,
        async () => {
          assert.equal(await trigger(page).count(), 0);
          assert.equal(
            await page.locator(".small-order-fee-helper").count(),
            0,
          );
          assert.match(
            await page.locator(".quote-totals").innerText(),
            /Processing fee/,
          );
          assert.equal(await sheet(page).count(), 0);
        },
      );
    }
    await load(page);
    await open(page);
    await check(
      "Quote invalidation while sheet is open removes stale explanation",
      async () => {
        await page.evaluate(() => window.__setFeeScenario("invalidated"));
        await page
          .getByRole("button", { name: "Checkout", exact: true })
          .waitFor();
        assert.equal(await sheet(page).count(), 0);
        assert.equal(await trigger(page).count(), 0);
      },
    );
    await load(page);
    await open(page);
    await check(
      "34px safe-area inset keeps Got it above the home indicator",
      async () => {
        const method =
          "CSS simulation: shared --safe-area-bottom token set to 34px; physical WebView env inset remains pending";
        await page.evaluate(() =>
          document.documentElement.style.setProperty(
            "--safe-area-bottom",
            "34px",
          ),
        );
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const geometry = await page.evaluate(() => {
          const probe = document.createElement("div");
          probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
          document.body.append(probe);
          const inset = parseFloat(getComputedStyle(probe).paddingBottom);
          probe.remove();
          const dialog = document.querySelector(".small-order-fee-sheet");
          const button = [...dialog.querySelectorAll("button")].find(
            (el) => el.textContent.trim() === "Got it",
          );
          const box = button.getBoundingClientRect();
          return {
            inset,
            sharedToken: getComputedStyle(document.documentElement)
              .getPropertyValue("--safe-area-bottom")
              .trim(),
            gap: window.innerHeight - box.bottom,
            buttonBottom: box.bottom,
            viewportHeight: window.innerHeight,
          };
        });
        assert.ok(
          geometry.inset === 34 || geometry.sharedToken === "34px",
          "Safe-area emulation did not activate",
        );
        assert.ok(geometry.gap >= 34, JSON.stringify(geometry));
        await screenshot(page, "safe-area34-390-sheet");
        return { ...geometry, method };
      },
    );
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await load(page);
      await open(page);
      await check(
        `${width}x844: 200% dialog text and long wrapping stay within viewport`,
        async () => {
          const requestedFonts = await sheet(page).evaluate((el) => {
            const textElements = [
              ...el.querySelectorAll("h2, h3, p, strong, span, button, dt, dd"),
            ];
            const sizes = textElements.map((node) => [
              node,
              parseFloat(getComputedStyle(node).fontSize),
            ]);
            for (const [node, size] of sizes)
              node.style.fontSize = `${size * 2}px`;
            const paragraph = el.querySelector("p");
            if (paragraph)
              paragraph.append(
                " Delivery charges do not count towards the qualifying amount. Supercalifragilisticexpialidociouslongunbrokentestword1234567890. ".repeat(
                  4,
                ),
              );
            return sizes.map(([node, size]) => ({
              tag: node.tagName,
              expected: size * 2,
            }));
          });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const actualFonts = await sheet(page).evaluate((el) =>
            [
              ...el.querySelectorAll("h2, h3, p, strong, span, button, dt, dd"),
            ].map((node) => parseFloat(getComputedStyle(node).fontSize)),
          );
          assert.deepEqual(
            actualFonts,
            requestedFonts.map((item) => item.expected),
            "Dialog font scaling was lost before rendering",
          );
          const dimensions = await noOverflow(page);
          assert.ok(
            dimensions.pageScroll <= dimensions.pageClient,
            JSON.stringify(dimensions),
          );
          assert.ok(
            dimensions.dialogScroll <= dimensions.dialogClient,
            JSON.stringify(dimensions),
          );
          assert.deepEqual(dimensions.outliers, []);
          const box = await sheet(page).boundingBox();
          assert.ok(
            box.y >= -1 && box.y + box.height <= 845,
            JSON.stringify(box),
          );
          await page
            .locator(".small-order-fee-sheet .ui-bottom-sheet__panel")
            .evaluate((el) => {
              el.scrollTop = 0;
            });
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          await screenshot(page, `text200-long-${width}-sheet-top`);
          const capturedFonts = await sheet(page).evaluate((el) =>
            [
              ...el.querySelectorAll("h2, h3, p, strong, span, button, dt, dd"),
            ].map((node) => parseFloat(getComputedStyle(node).fontSize)),
          );
          assert.deepEqual(
            capturedFonts,
            requestedFonts.map((item) => item.expected),
            "Dialog font scaling changed during screenshot capture",
          );
          const headingTypography = await sheet(page)
            .locator("header h2")
            .evaluate((el) => ({
              fontSize: parseFloat(getComputedStyle(el).fontSize),
              lineHeight: parseFloat(getComputedStyle(el).lineHeight),
            }));
          assert.ok(
            headingTypography.lineHeight >= headingTypography.fontSize,
            `Enlarged sheet title lines overlap: ${JSON.stringify(headingTypography)}`,
          );
          await sheet(page)
            .getByRole("button", { name: "Got it", exact: true })
            .scrollIntoViewIfNeeded();
          assert.equal(
            await sheet(page)
              .getByRole("button", { name: "Got it", exact: true })
              .isVisible(),
            true,
          );
          await screenshot(page, `text200-long-${width}-sheet`);
          return {
            dimensions,
            box,
            headingTypography,
            requestedFonts,
            actualFonts,
            capturedFonts,
            textScale:
              "Each dialog text element computed font size doubled; injected long prose and unbroken word",
          };
        },
      );
    }
    await check(
      "Fixture has no browser errors, external requests or native bridge",
      async () => {
        assert.deepEqual(report.errors, []);
        assert.deepEqual(report.externalRequests, []);
        assert.deepEqual(report.apiRequests, []);
        assert.equal(
          await page.evaluate(() => Boolean(window.SavtCksGoBridge)),
          false,
        );
      },
    );
  }
} catch (error) {
  report.errors.push(String(error.stack || error));
  report.viteOutput = viteOutput;
  if (currentPage) {
    report.failurePageText = await currentPage
      .locator("body")
      .innerText()
      .catch(() => "unavailable");
    await screenshot(currentPage, "runtime-failure").catch(() => {});
  }
} finally {
  if (red)
    await fs.rm(path.join(directory, ".cache/baseline-components.tsx"), {
      force: true,
    });
  await browser?.close();
  if (vite && vite.exitCode === null) {
    vite.kill();
    await Promise.race([
      new Promise((resolve) => vite.once("exit", resolve)),
      pause(3000),
    ]);
  }
  report.serverCleanedUp =
    !vite || vite.exitCode !== null || vite.signalCode !== null;
  report.finishedAt = new Date().toISOString();
  report.summary = {
    passed: report.checks.filter((result) => result.status === "PASS").length,
    failed: report.checks.filter((result) => result.status === "FAIL").length,
    runtimeErrors: report.errors.length,
  };
  const reportName = red
    ? "red-report.json"
    : unknownOnly
      ? "null-threshold-red-report.json"
      : typographyRed
        ? "typography-red-report.json"
        : "browser-report.json";
  await fs.writeFile(
    path.join(directory, reportName),
    await require("prettier").format(JSON.stringify(report, null, 2), {
      parser: "json",
    }),
  );
  console.log(
    JSON.stringify({
      phase: report.phase,
      ...report.summary,
      report: path.join(directory, reportName),
      serverCleanedUp: report.serverCleanedUp,
    }),
  );
  for (const failure of report.checks.filter(
    (result) => result.status === "FAIL",
  ))
    console.log(`FAIL ${failure.name}: ${failure.error}`);
  for (const error of report.errors) console.log(error);
  process.exitCode =
    report.summary.failed || report.summary.runtimeErrors ? 1 : 0;
}
