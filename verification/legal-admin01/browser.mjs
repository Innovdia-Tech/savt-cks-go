// Local synthetic verification only. Uses the real app, reader, session controller
// and existing development commerce adapters; does not publish policy records.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const origin = process.env.CKS_LEGAL_ORIGIN ?? "http://127.0.0.1:5348";
const output = path.resolve("verification/legal-admin01");
await mkdir(output, { recursive: true });
const source = JSON.parse(
  await readFile(
    "src/legal/preview/CKSGO_LEGAL_POLICY_PREVIEW_v01.json",
    "utf8",
  ),
);
const documents = source.policies.map(({ id, title }) => ({
  slug: id === "refund" ? "cancellation-refund" : id,
  title,
  version: 2,
  effectiveAt: "2026-10-17T01:00:00.000Z",
  sections: Array.from({ length: 6 }, (_, index) => ({
    id: `section-${index + 1}`,
    heading:
      index === 0
        ? "1. About this local sample"
        : `${index + 1}. Reading and navigation sample`,
    blocks: [
      {
        type: "paragraph",
        text:
          index === 0
            ? "LOCAL SYNTHETIC PUBLICATION — technical reading test only. This is not approved legal wording."
            : "This sample checks the existing customer reader. Opening a policy keeps your Orders selection, basket and checkout quote. Back returns to the policy centre; Close returns to the page you were reading.",
      },
      {
        type: "list",
        ordered: index % 2 === 0,
        items: [
          "Read the section heading and paragraph.",
          "Use Jump to section to navigate the document.",
          "Return to the same customer page without losing its state.",
        ],
      },
    ],
  })),
}));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: "chrome" }),
});
const checks = [];
const errors = [];
const requests = [];
const capture = async (page, name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(output, name + ".png") });
};
try {
  for (const width of [320, 390, 430]) {
    let mode = "published";
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.SavtCksGoBridge = { postMessage() {} };
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/v1/customer/legal-policies") {
        requests.push({
          width,
          mode,
          method: route.request().method(),
          path: url.pathname,
        });
        return route.fulfill({
          status: mode === "error" ? 503 : 200,
          contentType: "application/json",
          body: JSON.stringify({ data: mode === "published" ? documents : [] }),
        });
      }
      if (url.pathname === "/api/v1/customer/support")
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { whatsapp: null } }),
        });
      return route.continue();
    });
    await page.goto(`${origin}/?scenario=cust-shop01r`);
    await page
      .getByRole("searchbox", { name: "Search products", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    const history = page.getByRole("button", { name: /^Order history/ });
    if (await history.count()) await history.click();
    const beforeRoute = await page.evaluate(() => location.hash);
    const beforeTab = (await history.count())
      ? await history.getAttribute("aria-pressed")
      : null;
    const entry = page.getByRole("button", {
      name: "Legal & Policies",
      exact: true,
    });
    await entry.click();
    await page.locator(".legal-policy-row:not(:disabled)").first().waitFor();
    await capture(page, `${width}-published-centre`);
    for (const document of documents) {
      await page
        .getByRole("button", {
          name: new RegExp(
            `^${document.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} Version`,
          ),
        })
        .click();
      await page
        .getByText("LOCAL SYNTHETIC PUBLICATION", { exact: false })
        .waitFor();
      assert.equal(
        await page.locator(".legal-body time").getAttribute("datetime"),
        document.effectiveAt,
      );
      assert.equal(await page.locator(".legal-section ol li").count(), 9);
      assert.equal(await page.locator(".legal-section ul li").count(), 9);
      assert.equal(
        await page
          .locator("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        true,
      );
      assert.equal(
        await page
          .locator(".legal-body")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        true,
      );
      if (document.slug === "terms")
        await capture(page, `${width}-published-reader`);
      await page.locator(".legal-toc summary").click();
      await page.locator(".legal-toc nav button").last().click();
      assert.equal(
        await page.evaluate(() => document.activeElement?.tagName),
        "H3",
      );
      assert.ok(
        (await page.locator(".legal-body").evaluate((el) => el.scrollTop)) > 0,
      );
      await page
        .getByRole("button", { name: "Back to Legal & Policies", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() =>
          document.activeElement?.classList.contains("legal-policy-row"),
        ),
        true,
      );
    }
    await page.keyboard.press("Escape");
    await page.locator("dialog").waitFor({ state: "detached" });
    assert.equal(
      await entry.evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(await page.evaluate(() => location.hash), beforeRoute);
    if (beforeTab !== null)
      assert.equal(await history.getAttribute("aria-pressed"), beforeTab);
    checks.push(
      `${width}px: all four published readers, lists, effective dates, section jumps, overflow, Orders selection and focus PASS`,
    );

    mode = "draft";
    await entry.click();
    await page
      .getByRole("button", { name: /^Terms & Conditions Using/ })
      .click();
    await page
      .getByText(source.policies[0].sections[0].paragraphs[0], { exact: true })
      .waitFor();
    assert.equal(await page.locator(".legal-body time").count(), 0);
    assert.equal(await page.locator("dialog footer").count(), 0);
    assert.equal(
      (await page.locator("dialog").innerText()).includes(
        "DRAFT · NOT EFFECTIVE",
      ),
      false,
    );
    await capture(page, `${width}-preview-draft-reader`);
    await page
      .getByRole("button", { name: "Close Legal & Policies", exact: true })
      .click();
    checks.push(
      `${width}px: authorized static preview fallback, no fabricated effective date or repeated footer PASS`,
    );

    mode = "error";
    await entry.click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".legal-policy-row:disabled").count(), 4);
    if (width === 390) await capture(page, "390-read-error");
    await page
      .getByRole("button", { name: "Close Legal & Policies", exact: true })
      .click();

    mode = "published";
    await page.getByRole("button", { name: "Browse", exact: true }).click();
    await page
      .locator('.catalogue-tile button[aria-label^="Add "]:not([disabled])')
      .first()
      .click();
    await page.getByRole("button", { name: /^View basket, / }).click();
    await page.getByRole("button", { name: "Checkout", exact: true }).click();
    const payment = page.getByRole("button", { name: /^Proceed to Payment/ });
    await payment.waitFor();
    const basket = await page.locator(".cart-lines").innerText();
    const paymentLabel = await payment.innerText();
    assert.equal(await payment.isDisabled(), true);
    await page
      .getByRole("button", { name: "Legal & Policies", exact: true })
      .click();
    await page
      .getByRole("button", { name: /^Terms & Conditions Version/ })
      .click();
    await page
      .getByText("LOCAL SYNTHETIC PUBLICATION", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Return to checkout", exact: true })
      .click();
    assert.equal(await page.locator(".cart-lines").innerText(), basket);
    assert.equal(await payment.innerText(), paymentLabel);
    assert.equal(await payment.isDisabled(), true);
    assert.equal(await page.getByRole("checkbox").count(), 0);
    assert.equal(
      await page
        .getByRole("button", { name: "Legal & Policies", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await capture(page, `${width}-checkout-return`);
    checks.push(
      `${width}px: populated basket/quote and checkout focus preserved; preview payment disabled; no acceptance checkbox PASS`,
    );
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.ok(requests.every((request) => request.method === "GET"));
  await writeFile(
    path.join(output, "browser-results.json"),
    JSON.stringify(
      {
        evidence:
          "LOCAL SYNTHETIC ONLY; no legal approval, live publication or deployment",
        at: new Date().toISOString(),
        checks,
        requests,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      { status: "PASS", checks: checks.length, screenshots: 13, errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
