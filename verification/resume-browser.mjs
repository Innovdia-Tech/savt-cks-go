import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/isaac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "http://127.0.0.1:5187/verification/resume.fixture.html#categories",
  );
  await page.locator("#content").waitFor();
  await page.locator("#draft").fill("unsaved delivery note");
  await page.locator("#add").click();
  assert.equal(await page.locator("#basket").textContent(), "Basket: 3");
  await page.evaluate(() => window.resumeFixture.expire());
  await page.getByText("Restoring CKS Go…").waitFor();
  assert.equal(await page.locator("#content").count(), 1);
  assert.equal(await page.locator("#content").isVisible(), false);
  assert.equal(
    await page.locator("#draft").inputValue(),
    "unsaved delivery note",
  );
  await page.evaluate(() => window.resumeFixture.release());
  await page.locator("#content").waitFor({ state: "visible" });
  assert.equal(await page.locator("#basket").textContent(), "Basket: 3");
  assert.equal(
    await page.locator("#draft").inputValue(),
    "unsaved delivery note",
  );
  assert.equal(new URL(page.url()).hash, "#categories");
  await page.evaluate(() => window.resumeFixture.offline());
  await page.getByText("You’re offline").waitFor();
  assert.equal(await page.locator("#content").isVisible(), false);
  await page.evaluate(() => window.resumeFixture.online());
  await page.locator("#content").waitFor({ state: "visible" });
  const tracker = await page.evaluate(() => window.resumeFixture.tracker);
  assert.deepEqual(tracker, {
    mounts: 1,
    unmounts: 0,
    grants: 1,
    exchanges: 1,
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "verification/resume-browser-result.json",
    JSON.stringify(
      {
        status: "PASS",
        viewport: "390x844",
        tracker,
        route: "#categories",
        draftPreserved: true,
        basketPreserved: true,
        offlinePreserved: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS mounted-tree recovery: one mount, zero unmounts; Basket, draft and route preserved; offline gates actions.",
  );
} finally {
  await browser.close();
}
