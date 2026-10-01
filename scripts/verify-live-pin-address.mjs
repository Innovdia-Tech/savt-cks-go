import assert from "node:assert/strict";

const { chromium } = await import(
  process.env.CKS_GO_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  ...(process.env.CKS_GO_CHROME_PATH
    ? { executablePath: process.env.CKS_GO_CHROME_PATH }
    : {}),
  headless: true,
});

async function openPicker() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    window.__cksGoUx02Pins = [];
    window.__cksGoUx02MapCenters = [];
    window.__cksGoUx02ReverseHandler = (pin) => {
      const east = pin.longitude > 116.0818;
      const addressLine1 = east
        ? "Lorong Kobusak Perdana"
        : "Jalan Pintas Penampang";
      return Promise.resolve({
        ...pin,
        formattedAddress: `${addressLine1}, 89500 Penampang, Sabah, Malaysia`,
        addressLine1,
        city: "Penampang",
        state: "Sabah",
        postcode: "89500",
        countryCode: "MY",
      });
    };
  });
  await page.goto(process.env.CKS_GO_LOCAL_URL || "http://127.0.0.1:5176", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Mobile number").fill("0123456789");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.getByText("Deliver to", { exact: true }).click();
  await page
    .getByRole("button", { name: /Search building, street or postcode/ })
    .click();
  await page.getByPlaceholder("Building, street or postcode").fill("ITCC");
  await page.getByText("ITCC Shopping Mall").first().click();
  await page.getByLabel("Centered delivery pin").waitFor();
  return page;
}

const page = await openPicker();
const card = page.locator(".delivery-flow__location");
const confirm = page.getByRole("button", { name: "Confirm this location" });
await card.getByText("Jalan Pintas Penampang", { exact: false }).waitFor();
assert.equal(await confirm.isEnabled(), true, "A: initial pin is resolved");
assert.equal(await card.getByText("Selected delivery location").count(), 1);

await page.getByRole("button", { name: "Pan map east" }).click();
assert.equal(await confirm.isEnabled(), false, "B: movement disables confirm");
assert.equal(await card.getByText("Finding this address…").count(), 1);
assert.equal(await card.getByRole("status").count(), 1);
assert.equal(
  await card.getByText("Jalan Pintas Penampang", { exact: false }).count(),
  0,
);
assert.equal((await page.evaluate(() => window.__cksGoUx02Pins)).length, 1);
await page.waitForTimeout(350);
assert.equal(
  (await page.evaluate(() => window.__cksGoUx02Pins)).length,
  1,
  "reverse waits for idle debounce",
);
await card.getByText("Lorong Kobusak Perdana", { exact: false }).waitFor();
assert.equal(
  await confirm.isEnabled(),
  true,
  "C: latest address enables confirm",
);
assert.equal((await page.evaluate(() => window.__cksGoUx02Pins)).length, 2);

await page.evaluate(() => {
  window.__cksGoUx02Pins = [];
});
await page.getByRole("button", { name: "Pan map east" }).click();
await page.getByRole("button", { name: "Pan map west" }).click();
assert.equal(await confirm.isEnabled(), false);
await card.getByText("Lorong Kobusak Perdana", { exact: false }).waitFor();
assert.equal(
  (await page.evaluate(() => window.__cksGoUx02Pins)).length,
  1,
  "rapid movements within debounce produce one reverse request",
);

await page.evaluate(() => {
  window.__cksGoUx02Pins = [];
  window.__cksGoUx02ReverseHandler = (pin) =>
    new Promise((resolve) => {
      const east = pin.longitude > 116.0821;
      setTimeout(
        () =>
          resolve({
            ...pin,
            formattedAddress: east
              ? "Old East Address, Penampang"
              : "Final West Address, Penampang",
            addressLine1: east ? "Old East Address" : "Final West Address",
            city: "Penampang",
            state: "Sabah",
            postcode: "89500",
            countryCode: "MY",
          }),
        east ? 1000 : 20,
      );
    });
});
await page.getByRole("button", { name: "Pan map east" }).click();
await page.waitForTimeout(550);
await page.getByRole("button", { name: "Pan map west" }).click();
await card.getByText("Final West Address", { exact: false }).waitFor();
await page.waitForTimeout(1100);
assert.equal(
  await card.getByText("Old East Address", { exact: false }).count(),
  0,
);
assert.equal(
  await confirm.isEnabled(),
  true,
  "D: stale result cannot replace latest",
);

await page.evaluate(() => {
  window.__cksGoUx02ReverseHandler = () =>
    Promise.reject(Error("Synthetic failure"));
});
await page.getByRole("button", { name: "Pan map east" }).click();
await card.getByText("We couldn't identify this location yet.").waitFor();
assert.equal(await card.getByRole("alert").count(), 1);
assert.equal(
  await card
    .getByText("Move the pin slightly or search for another location.")
    .count(),
  1,
);
assert.equal(
  await card.getByText("Final West Address", { exact: false }).count(),
  0,
);
assert.equal(
  await confirm.isEnabled(),
  false,
  "E: failed reverse cannot confirm",
);
assert.equal(await page.locator("body").getByText("5.9186").count(), 0);

await page.evaluate(() => {
  window.__cksGoUx02ReverseHandler = (pin) =>
    Promise.resolve({
      ...pin,
      formattedAddress: "Current Device Address, Penampang",
      addressLine1: "Current Device Address",
      city: "Penampang",
      state: "Sabah",
      postcode: "89500",
      countryCode: "MY",
    });
});
await page.getByRole("button", { name: "Recenter" }).click();
assert.equal(await confirm.isEnabled(), false, "F: recenter enters pending");
await card.getByText("Current Device Address", { exact: false }).waitFor();
assert.equal(await confirm.isEnabled(), true);
assert.deepEqual(
  (await page.evaluate(() => window.__cksGoUx02MapCenters)).at(-1),
  { latitude: 5.9186, longitude: 116.0818 },
);

await page.getByRole("button", { name: "Search another location" }).click();
await page.getByPlaceholder("Building, street or postcode").fill("ITCC");
await page.getByText("ITCC Shopping Mall").first().click();
assert.equal(await confirm.isEnabled(), false, "G: search enters pending");
await card.getByText("Current Device Address", { exact: false }).waitFor();
assert.equal(await confirm.isEnabled(), true, "G: search pin synchronized");
await page.evaluate(() => {
  window.__cksGoUx02ReverseHandler = (pin) =>
    Promise.resolve({
      ...pin,
      formattedAddress: "Final Candidate Address, Penampang",
      addressLine1: "Final Candidate Address",
      city: "Penampang",
      state: "Sabah",
      postcode: "89500",
      countryCode: "MY",
    });
});
await page.getByRole("button", { name: "Pan map east" }).click();
await card.getByText("Final Candidate Address", { exact: false }).waitFor();
await page.screenshot({
  path: "docs/ux02-acceptance/live-pin-address-390.png",
  fullPage: true,
});
await confirm.click();
await page.getByRole("heading", { name: "Delivery details" }).waitFor();
assert.equal(
  await page.locator('[name="addressLine1"]').inputValue(),
  "Final Candidate Address",
);
const widths = await page.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  viewport: window.innerWidth,
}));
assert.ok(widths.scroll <= widths.viewport, "390px layout does not overflow");
await browser.close();
console.log("Live pin address browser acceptance A–G passed.");
