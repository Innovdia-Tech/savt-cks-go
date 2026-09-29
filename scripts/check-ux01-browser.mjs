// Optional local UX01 browser acceptance. Synthetic data only; never production acceptance.
// Run with UX01_ORIGIN pointing to a local DEV preview and NODE_PATH to Playwright.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const origin = process.env.UX01_ORIGIN ?? "http://127.0.0.1:5175";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
});
const results = [];
try {
  for (const scenario of process.env.UX01_FAST
    ? ["empty"]
    : ["empty", "default"])
    for (const width of process.env.UX01_FAST ? [390] : [320, 390, 430, 768])
      for (const scale of process.env.UX01_FAST ? [1] : [1, 2]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/src/main.tsx*", async (route) => {
          const response = await route.fetch();
          let source = await response.text();
          source = source
            .replace(
              /\.DevelopmentDataAdapter\(\s*production\s*,?\s*\)/,
              `.DevelopmentDataAdapter(production, "${scenario}")`,
            )
            .replace(
              "catalogueDevelopment.customerFetch(development.fetch)",
              "development.fetch",
            );
          source = source.replace(
            "const customer = new CustomerDataController(",
            `window.__mutations=[];window.__fixture=catalogueDevelopment;window.__data=development; const originalFetch=development.fetch; development.fetch=async (input,init)=>{ if(init?.method && init.method!=="GET") window.__mutations.push({path:String(input),method:init.method,body:JSON.parse(init.body)}); return originalFetch(input,init); }; const customer = new CustomerDataController(`,
          );
          await route.fulfill({ response, body: source });
        });
        await page.addInitScript(() => {
          window.__locations = [];
          window.SavtCksGoBridge = {
            postMessage(raw) {
              const request = JSON.parse(raw);
              if (!request.type.startsWith("location-")) return;
              window.__locations.push(request);
              const result = {
                protocolVersion: "1",
                requestId: request.requestId,
                status: request.type === "location-current" ? "denied" : "ok",
                latitude: null,
                longitude: null,
                formattedAddress: null,
                addressLine1: null,
                city: null,
                state: null,
                postcode: null,
              };
              if (result.status === "ok")
                Object.assign(result, {
                  latitude: 5.95,
                  longitude: 116.07,
                  formattedAddress: "Jalan Example, Penampang",
                  addressLine1: "Jalan Example",
                  city: "Penampang",
                  state: "Sabah",
                  postcode: "89500",
                });
              queueMicrotask(() =>
                window.dispatchEvent(
                  new CustomEvent("savt-cks-go-location", { detail: result }),
                ),
              );
            },
          };
        });
        await page.goto(origin);
        await page
          .getByRole("heading", {
            name: "Set your delivery location",
            exact: true,
          })
          .waitFor({ timeout: 10000 })
          .catch(async (error) => {
            console.log(
              "STARTUP",
              errors,
              await page.locator("body").innerText(),
            );
            throw error;
          });
        async function fits(label) {
          if (scale === 2)
            await page.evaluate(() => {
              window.__originalFonts ??= new WeakMap();
              const elements = [...document.querySelectorAll("body *")];
              for (const element of elements) {
                if (!window.__originalFonts.has(element))
                  window.__originalFonts.set(element, element.style.fontSize);
                element.style.fontSize = window.__originalFonts.get(element);
              }
              const sizes = elements.map((element) =>
                parseFloat(getComputedStyle(element).fontSize),
              );
              elements.forEach(
                (element, index) =>
                  (element.style.fontSize = `${sizes[index] * 2}px`),
              );
            });
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${label} overflow ${width}/${scale}`,
          );
          for (const button of await page.getByRole("button").all()) {
            if (!(await button.isVisible())) continue;
            const box = await button.boundingBox();
            assert(
              box.x >= -1 && box.x + box.width <= width + 1,
              `${label} clipped button ${await button.innerText()}`,
            );
          }
        }
        assert.equal(await page.evaluate(() => window.__locations.length), 0);
        assert.equal(
          await page.getByRole("button", { name: "Close CKS Go" }).count(),
          0,
        );
        await fits("onboarding");
        await page
          .getByRole("button", { name: "Use my current location", exact: true })
          .click();
        await page
          .getByText("Location access is off", { exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("textbox", { name: "Search address or building" })
            .evaluate((el) => el === document.activeElement),
          true,
        );
        await fits("denied");
        await page
          .getByRole("textbox", { name: "Search address or building" })
          .fill("Penampang");
        await page
          .getByRole("textbox", { name: "Search address or building" })
          .press("Enter");
        await page.getByRole("button", { name: "Confirm location" }).click();
        assert.equal(
          await page
            .getByRole("textbox", { name: "Recipient", exact: true })
            .inputValue(),
          scenario === "empty" ? "Synthetic member" : "Synthetic recipient",
        );
        if (scenario === "default") {
          assert.equal(
            await page
              .getByRole("textbox", { name: "Address / street", exact: true })
              .inputValue(),
            "1 Example Street",
          );
          assert.equal(
            await page
              .getByRole("textbox", { name: "City", exact: true })
              .inputValue(),
            "Demo City",
          );
        }
        assert.equal(
          await page
            .locator('input[name="latitude"], input[name="longitude"]')
            .count(),
          0,
        );
        if (scenario === "empty")
          assert.equal(
            await page
              .getByRole("checkbox", { name: "Set as default address" })
              .isChecked(),
            true,
          );
        await fits("details");
        await page
          .getByRole("button", {
            name:
              scenario === "empty" ? "Save & use this address" : "Save changes",
            exact: true,
          })
          .evaluate((button) => {
            button.form.requestSubmit();
            button.form.requestSubmit();
          });
        await page.getByText("Featured for You", { exact: true }).waitFor();
        await page
          .getByText("Fresh choices, closer to home", { exact: true })
          .waitFor({ timeout: 2000 });
        assert.equal(await page.evaluate(() => window.__mutations.length), 1);
        assert.deepEqual(
          await page.evaluate(() => ({
            method: window.__mutations[0].method,
            latitude: window.__mutations[0].body.latitude,
            longitude: window.__mutations[0].body.longitude,
          })),
          {
            method: scenario === "empty" ? "POST" : "PATCH",
            latitude: 5.95,
            longitude: 116.07,
          },
        );
        if (scenario === "default")
          assert.match(
            await page.evaluate(() => window.__mutations[0].path),
            /22222222-2222-4222-8222-222222222222$/,
          );
        await fits("home");
        if (scenario === "empty" && width === 390 && scale === 1) {
          await page
            .getByRole("navigation", { name: "Primary navigation" })
            .getByRole("button", { name: "Categories", exact: true })
            .click();
          await page
            .getByRole("button", { name: "View Apples 01", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Add to Cart", exact: true })
            .waitFor();
          await fits("product");
          await page
            .getByRole("button", { name: "Add to Cart", exact: true })
            .click();
          await page
            .getByRole("navigation", { name: "Primary navigation" })
            .getByRole("button", { name: /Cart/ })
            .click();
          await page
            .getByRole("button", { name: "Review order", exact: true })
            .click();
          await page.getByRole("button", { name: /^Pay RM/ }).click();
          await page
            .getByRole("heading", { name: "Payment pending", exact: true })
            .waitFor();
          await page.evaluate(() => {
            window.__fixture.setPaymentResult("paid");
            window.dispatchEvent(new Event("focus"));
          });
          await page
            .getByRole("heading", {
              name: "Order confirmed",
              exact: true,
              level: 2,
            })
            .waitFor();
          await page
            .getByRole("button", { name: "View order", exact: true })
            .click();
          await fits("order");
          assert.equal(
            await page.getByRole("button", { name: /Cancel order/i }).count(),
            0,
          );
          await page
            .getByRole("navigation", { name: "Primary navigation" })
            .getByRole("button", { name: "Home", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "Change delivery address",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: "Add address", exact: true })
            .click();
          await page
            .getByRole("textbox", { name: "Search address or building" })
            .fill("Penampang");
          await page
            .getByRole("textbox", { name: "Search address or building" })
            .press("Enter");
          await page
            .getByRole("button", { name: "Confirm location", exact: true })
            .click();
          await page
            .getByRole("textbox", { name: "Address / street", exact: true })
            .fill("Second Example Street");
          await page
            .getByRole("button", {
              name: "Save & use this address",
              exact: true,
            })
            .click();
          await page
            .getByRole("button", { name: "Add address", exact: true })
            .waitFor();
          await page
            .getByRole("navigation", { name: "Primary navigation" })
            .getByRole("button", { name: "Home", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "Change delivery address",
              exact: true,
            })
            .filter({ hasText: "Second Example Street" })
            .waitFor();
          results.push({
            downstream: "PASS",
            scope: "synthetic cart/quote/payment/order regression",
          });
        }
        assert.deepEqual(errors, []);
        results.push({
          scenario,
          width,
          textScale: scale,
          firstUse: "PASS",
          deniedSearch: "PASS",
          save: "PASS",
          homeAds: "PASS",
        });
        await page.close();
      }
  const standalone = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await standalone.goto(origin);
  await standalone.getByText("Featured for You", { exact: true }).waitFor();
  assert.equal(
    await standalone
      .getByRole("heading", { name: "Set your delivery location", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await standalone
      .getByRole("button", { name: "Close CKS Go", exact: true })
      .count(),
    1,
  );
  await standalone
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Categories", exact: true })
    .click();
  assert.equal(
    await standalone.getByRole("button", { name: "Back", exact: true }).count(),
    1,
  );
  await standalone.close();
  results.push({ validAddress: "PASS", standaloneControls: "PASS" });
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
