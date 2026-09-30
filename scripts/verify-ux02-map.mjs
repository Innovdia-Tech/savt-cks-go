import assert from "node:assert/strict";
// Run against the Vite development fixtures. Playwright may be installed locally,
// or supplied with CKS_GO_PLAYWRIGHT_MODULE; no Google request is made.
const { chromium } = await import(
  process.env.CKS_GO_PLAYWRIGHT_MODULE || "playwright"
);

const browser = await chromium.launch({
  ...(process.env.CKS_GO_CHROME_PATH
    ? { executablePath: process.env.CKS_GO_CHROME_PATH }
    : {}),
  headless: true,
});
const directory = "docs/ux02-acceptance";
const newPage = async (width, options = {}) => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  await page.goto(
    `${process.env.CKS_GO_LOCAL_URL || "http://127.0.0.1:5176"}/${options.query ?? ""}`,
    { waitUntil: "networkidle" },
  );
  await page.getByLabel("Mobile number").fill("0123456789");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.getByText("Deliver to", { exact: true }).waitFor();
  if (options.scenario) {
    await page.getByText("Synthetic development fixtures").click();
    await page.locator("#catalogue-scenario").selectOption(options.scenario);
    await page.waitForTimeout(750);
  }
  if (options.scenario !== "coordinates")
    await page.getByText("Deliver to", { exact: true }).click();
  return page;
};
const searchMap = async (page, ready = true) => {
  await page
    .getByRole("button", { name: /Search building, street or postcode/ })
    .click();
  await page.getByPlaceholder("Building, street or postcode").fill("ITCC");
  await page.getByText("ITCC Shopping Mall").waitFor();
  await page.getByText("ITCC Shopping Mall").click();
  if (ready) await page.getByLabel("Centered delivery pin").waitFor();
};
const screenshot = async (page, file) => {
  const sizes = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  assert.ok(
    sizes.page <= sizes.viewport,
    `${file} overflows: ${JSON.stringify(sizes)}`,
  );
  await page.screenshot({ path: `${directory}/${file}.png`, fullPage: true });
};

const small = await newPage(320);
await small.evaluate(() => {
  window.__cksGoUx02MapCenters = [];
});
await searchMap(small);
const initialCenter = (
  await small.evaluate(() => window.__cksGoUx02MapCenters)
)[0];
assert.deepEqual(initialCenter, { latitude: 5.9186, longitude: 116.0818 });
assert.equal(
  await small
    .getByRole("button", { name: "Confirm this location" })
    .isEnabled(),
  true,
);
assert.equal(await small.getByText("Save & use this address").count(), 0);
assert.ok(!(await small.locator("body").innerText()).includes("5.9186"));
await screenshot(small, "map-search-320");
const pinBefore = await small.getByLabel("Centered delivery pin").boundingBox();
await small.getByRole("button", { name: "Pan map east" }).click();
const pinAfter = await small.getByLabel("Centered delivery pin").boundingBox();
assert.equal(pinAfter.x, pinBefore.x);
assert.equal(pinAfter.y, pinBefore.y);
const movedCenter = (
  await small.evaluate(() => window.__cksGoUx02MapCenters)
).at(-1);
assert.ok(Math.abs(movedCenter.longitude - 116.082) < 1e-12);
await screenshot(small, "map-moved-320");
await small.getByRole("button", { name: "Recenter" }).click();
assert.deepEqual(
  (await small.evaluate(() => window.__cksGoUx02MapCenters)).at(-1),
  initialCenter,
);
await small.getByRole("button", { name: "Pan map east" }).click();
await small.evaluate(() => {
  window.__cksGoUx02Pins = [];
});
assert.equal((await small.evaluate(() => window.__cksGoUx02Pins)).length, 0);
await small.getByRole("button", { name: "Confirm this location" }).click();
await small.getByRole("heading", { name: "Delivery details" }).waitFor();
const pins = await small.evaluate(() => window.__cksGoUx02Pins);
assert.equal(pins.length, 1);
assert.ok(Math.abs(pins[0].latitude - 5.9186) < 1e-12);
assert.ok(Math.abs(pins[0].longitude - 116.082) < 1e-12);
assert.equal(
  await small.locator('[name="addressLine1"]').inputValue(),
  "Jalan Pintas Penampang",
);
assert.equal(await small.locator('[name="postcode"]').inputValue(), "89500");
assert.equal(await small.getByText("Save & use this address").count(), 1);
await small.close();

const gps = await newPage(320);
await gps.evaluate(() => {
  window.__cksGoUx02MapCenters = [];
});
await gps.getByRole("button", { name: /Use my current location/ }).click();
await gps.getByLabel("Centered delivery pin").waitFor();
assert.deepEqual((await gps.evaluate(() => window.__cksGoUx02MapCenters))[0], {
  latitude: 5.9186,
  longitude: 116.0818,
});
assert.ok(
  (await gps.locator("body").innerText()).includes("Your current location"),
);
await screenshot(gps, "map-gps-320");
await gps.close();

const unavailable = await newPage(320, { query: "?map-unavailable=1" });
await searchMap(unavailable, false);
await unavailable.getByText("We couldn't load the map right now.").waitFor();
assert.equal(
  await unavailable
    .getByRole("button", { name: "Confirm this location" })
    .count(),
  0,
);
assert.equal(
  await unavailable.getByRole("button", { name: "Search again" }).count(),
  1,
);
assert.equal(
  await unavailable
    .getByRole("button", { name: "Try current location again" })
    .count(),
  1,
);
await screenshot(unavailable, "map-unavailable-320");
await unavailable.close();

const loading = await newPage(320, { query: "?map-loading=1" });
await searchMap(loading, false);
await loading
  .getByRole("status", { name: "" })
  .filter({ hasText: "Loading map…" })
  .waitFor();
assert.equal(
  await loading
    .getByRole("button", { name: "Confirm this location" })
    .isEnabled(),
  false,
);
await loading.close();

const partial = await newPage(390, { query: "?reverse-partial=1" });
await searchMap(partial);
await partial.getByRole("button", { name: "Confirm this location" }).click();
await partial.getByRole("heading", { name: "Delivery details" }).waitFor();
assert.equal(await partial.locator('[name="addressLine1"]').inputValue(), "");
assert.equal(await partial.locator('[name="postcode"]').inputValue(), "");
await partial.close();

const repair = await newPage(390, { scenario: "coordinates" });
await repair.getByRole("heading", { name: "Set delivery location" }).waitFor();
assert.ok((await repair.locator("body").innerText()).includes("Demo home"));
await repair
  .getByRole("button", { name: /Search building, street or postcode/ })
  .click();
await repair.getByPlaceholder("Building, street or postcode").fill("ITCC");
await repair.getByText("ITCC Shopping Mall").waitFor();
await repair.getByText("ITCC Shopping Mall").click();
await repair.getByLabel("Centered delivery pin").waitFor();
await repair.getByRole("button", { name: "Confirm this location" }).click();
await repair.getByRole("heading", { name: "Delivery details" }).waitFor();
assert.equal(
  await repair.getByRole("button", { name: "Save changes" }).count(),
  1,
);
await repair.getByRole("button", { name: "Save changes" }).click();
await repair.getByText("Deliver to", { exact: true }).waitFor();
await repair.getByText("Deliver to", { exact: true }).click();
await repair.getByRole("heading", { name: "Saved addresses" }).waitFor();
assert.equal(await repair.locator(".delivery-picker__card").count(), 3);
assert.equal(await repair.getByText("Demo home", { exact: true }).count(), 1);
await repair.close();

for (const width of [390, 430, 768]) {
  const page = await newPage(width);
  await searchMap(page);
  await screenshot(page, `map-confirm-${width}`);
  if (width === 390) {
    await page.evaluate(() => {
      window.__cksGoUx02Pins = [];
    });
    await page.getByRole("button", { name: "Confirm this location" }).click();
    await page.getByRole("heading", { name: "Delivery details" }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__cksGoUx02Pins), [
      { latitude: 5.9186, longitude: 116.0818 },
    ]);
    await screenshot(page, "map-details-390");
  }
  await page.close();
}

const largeText = await newPage(320);
await searchMap(largeText);
await largeText.evaluate(() => {
  document.documentElement.style.fontSize = "200%";
});
await screenshot(largeText, "map-text-200-percent");
assert.equal(
  await largeText
    .getByRole("button", { name: "Confirm this location" })
    .isVisible(),
  true,
);
await largeText.close();
await browser.close();
console.log("Synthetic map browser acceptance passed.");
