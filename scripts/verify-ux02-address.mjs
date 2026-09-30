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
const base = process.env.CKS_GO_LOCAL_URL || "http://127.0.0.1:5176";
let page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (error) => console.error("Browser error:", error.message));

async function login(query = "") {
  await page.goto(base + query, { waitUntil: "networkidle" });
  await page.getByLabel("Mobile number").fill("0123456789");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.getByText("Deliver to", { exact: true }).waitFor();
  await page.getByText("Deliver to", { exact: true }).click();
}

async function confirmLocation({ moved = null, label = "Home" } = {}) {
  await page
    .getByRole("button", { name: /Search building, street or postcode/ })
    .click();
  await page.getByPlaceholder("Building, street or postcode").fill("ITCC");
  await page.getByText("ITCC Shopping Mall").waitFor();
  await page.getByText("ITCC Shopping Mall").click();
  await page.getByLabel("Centered delivery pin").waitFor();
  if (moved)
    await page
      .getByRole("button", {
        name: moved === "west" ? "Pan map west" : "Pan map east",
      })
      .click();
  await page.getByRole("button", { name: "Confirm this location" }).click();
  await page.getByRole("heading", { name: "Delivery details" }).waitFor();
  assert.equal(
    await page.locator('[name="addressLine1"]').inputValue(),
    "Jalan Pintas Penampang",
  );
  assert.equal(await page.locator('[name="addressLine1"]').isEditable(), false);
  await page
    .getByRole("group", { name: "Save address as" })
    .getByRole("button", { name: label })
    .click();
  await page.getByRole("button", { name: "Save & use this address" }).click();
}

try {
  await login();
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await confirmLocation({ label: "Work" });
  await page.getByPlaceholder("Search products…").waitFor();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await confirmLocation({ moved: "east", label: "Other" });
  await page
    .getByRole("heading", { name: "We're not delivering here yet" })
    .waitFor();
  await page.screenshot({ path: "qa-ux02-no-service.png", fullPage: true });
  assert.equal(
    (await page.getByText("Other", { exact: true }).count()) > 0,
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: /Add .* to cart/ }).count(),
    0,
  );
  assert.equal(await page.getByPlaceholder("Search products…").count(), 0);
  await page.getByRole("button", { name: "+ Add new address" }).click();
  await page
    .getByRole("heading", { name: "Set delivery location" })
    .waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Go back" }).click();
  await page.getByRole("heading", { name: "Delivery address" }).waitFor();
  assert.ok(await page.getByText("Other", { exact: true }).count());
  await page
    .getByRole("button", { name: /Work.*Jalan Pintas Penampang/s })
    .click();
  await page.getByPlaceholder("Search products…").waitFor();
  console.log("UX02 browser scenarios A-C passed.");

  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  assert.equal(await page.getByText("Demo office", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Edit Work" }).click();
  await page.getByRole("button", { name: "Change delivery location" }).click();
  await page.getByLabel("Centered delivery pin").waitFor();
  await page.getByRole("button", { name: "Pan map east" }).click();
  await page.getByRole("button", { name: "Confirm this location" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .getByRole("heading", { name: "We're not delivering here yet" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Add .* to cart/ }).count(),
    0,
  );
  console.log("UX02 browser scenario D passed.");

  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  await page.getByRole("button", { name: "Edit Other" }).click();
  await page.getByRole("button", { name: "Delete address" }).click();
  await page.getByRole("dialog", { name: "Delete this address?" }).waitFor();
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent?.trim()),
    "Keep address",
  );
  for (const action of ["Keep address", "Delete address"]) {
    const box = await page
      .getByRole("dialog", { name: "Delete this address?" })
      .getByRole("button", { name: action })
      .boundingBox();
    assert.ok(box && box.height >= 44);
  }
  await page.screenshot({ path: "qa-ux02-delete-dialog.png", fullPage: true });
  await page.keyboard.press("Escape");
  assert.ok(await page.getByRole("button", { name: "Delete address" }).count());
  await page.getByRole("button", { name: "Delete address" }).click();
  await page
    .getByRole("dialog", { name: "Delete this address?" })
    .getByRole("button", { name: "Delete address" })
    .click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit Other" }).count(),
    0,
  );
  assert.ok(await page.getByRole("button", { name: "Edit Work" }).count());
  console.log("UX02 browser scenario E passed.");

  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "+ Add new address" }).click();
  await confirmLocation({ label: "Home" });
  await page.getByPlaceholder("Search products…").waitFor();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  const homeCard = page
    .locator("article.customer-card")
    .filter({ has: page.getByRole("button", { name: "Edit Home" }) });
  await homeCard.getByRole("button", { name: "Set default" }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByText("Deliver to", { exact: true }).click();
  await page
    .getByRole("button", { name: /Work.*Jalan Pintas Penampang/s })
    .click();
  await page
    .getByRole("heading", { name: "We're not delivering here yet" })
    .waitFor();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  await page.getByRole("button", { name: "Edit Work" }).click();
  await page.getByRole("button", { name: "Delete address" }).click();
  await page
    .getByRole("dialog", { name: "Delete this address?" })
    .getByRole("button", { name: "Delete address" })
    .click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit Work" }).count(),
    0,
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByPlaceholder("Search products…").waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "We're not delivering here yet" })
      .count(),
    0,
  );
  console.log("UX02 browser scenario F passed.");

  await page
    .getByRole("button", { name: /Add .* to cart/ })
    .first()
    .click();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  await page.getByRole("button", { name: "Edit Home" }).click();
  await page.getByRole("button", { name: "Change delivery location" }).click();
  await page.getByLabel("Centered delivery pin").waitFor();
  await page.getByRole("button", { name: "Pan map east" }).click();
  await page.getByRole("button", { name: "Confirm this location" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("dialog", { name: "Change delivery address?" })
    .getByRole("button", { name: "Keep current delivery address" })
    .click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit Home" }).count(),
    2,
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByPlaceholder("Search products…").waitFor();
  assert.ok(await page.getByRole("button", { name: "Cart, 1 item" }).count());
  console.log("UX02 browser selected-pin cart preservation passed.");

  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await confirmLocation({ moved: "west", label: "Work" });
  const outletDialog = page.getByRole("dialog", {
    name: "Clear cart and switch address?",
  });
  await outletDialog.waitFor();
  await outletDialog.getByRole("button", { name: "Keep current cart" }).click();
  await page.getByPlaceholder("Search products…").waitFor();
  assert.ok(await page.getByRole("button", { name: "Cart, 1 item" }).count());
  await page.getByText("Deliver to", { exact: true }).click();
  await page
    .getByRole("button", { name: /Work.*Jalan Pintas Penampang/s })
    .click();
  await outletDialog.waitFor();
  await outletDialog
    .getByRole("button", { name: "Clear cart and switch" })
    .click();
  await page.getByPlaceholder("Search products…").waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Cart, 1 item" }).count(),
    0,
  );
  console.log("UX02 browser scenario H passed.");

  await page
    .getByRole("button", { name: /Add .* to cart/ })
    .first()
    .click();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await confirmLocation({ moved: "east", label: "Other" });
  const coverageDialog = page.getByRole("dialog", {
    name: "Change delivery address?",
  });
  await coverageDialog.waitFor();
  await coverageDialog
    .getByRole("button", { name: "Keep current delivery address" })
    .click();
  await page.getByPlaceholder("Search products…").waitFor();
  assert.ok(await page.getByRole("button", { name: "Cart, 1 item" }).count());
  await page.getByText("Deliver to", { exact: true }).click();
  assert.ok(
    await page
      .getByRole("button", { name: /Other.*Jalan Pintas Penampang/s })
      .count(),
  );
  await page
    .getByRole("button", { name: /Other.*Jalan Pintas Penampang/s })
    .click();
  await coverageDialog.waitFor();
  await coverageDialog
    .getByRole("button", { name: "Change address and clear cart" })
    .click();
  await page
    .getByRole("heading", { name: "We're not delivering here yet" })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Cart, 1 item" }).count(),
    0,
  );
  console.log("UX02 browser scenario I passed.");

  await page.getByRole("button", { name: "Choose another address" }).click();
  await page
    .getByRole("button", { name: /Work.*Jalan Pintas Penampang/s })
    .click();
  await page.getByPlaceholder("Search products…").waitFor();
  await page
    .getByRole("button", { name: /Add .* to cart/ })
    .first()
    .click();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  const otherCard = page
    .locator("article.customer-card")
    .filter({ has: page.getByRole("button", { name: "Edit Other" }) });
  await otherCard.getByRole("button", { name: "Set default" }).click();
  await page.getByRole("button", { name: "Edit Work" }).click();
  await page.getByRole("button", { name: "Delete address" }).click();
  await page
    .getByRole("dialog", { name: "Delete this address?" })
    .getByRole("button", { name: "Delete address" })
    .click();
  await page
    .getByRole("dialog", { name: "Change delivery address?" })
    .getByRole("button", { name: "Change address and clear cart" })
    .click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit Work" }).count(),
    0,
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page
    .getByRole("heading", { name: "We're not delivering here yet" })
    .waitFor();
  console.log("UX02 browser selected-delete no-coverage fallback passed.");

  await page.getByRole("button", { name: "Choose another address" }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  await page.getByText("Synthetic development scenarios").click();
  await page.getByRole("button", { name: "empty", exact: true }).click();
  await page.getByText("No saved addresses yet.").waitFor();
  await page.getByRole("button", { name: "Add address" }).click();
  await confirmLocation({ label: "Home" });
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  await page.getByRole("button", { name: "Edit Home" }).click();
  await page.getByRole("button", { name: "Delete address" }).click();
  await page
    .getByRole("dialog", { name: "Delete this address?" })
    .getByRole("button", { name: "Delete address" })
    .click();
  await page.getByText("No saved addresses yet.").waitFor();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("heading", { name: "Set delivery location" }).waitFor();
  console.log("UX02 browser scenario G passed.");

  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login();
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await confirmLocation({ label: "Work" });
  await page
    .getByRole("button", { name: /Add .* to cart/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Cart, 1 item" }).click();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: /^Pay RM/ }).click();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByText("Deliver to", { exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "＋ Add a new address" })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Edit Work" }).isDisabled(),
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: "Add address" }).isDisabled(),
    true,
  );
  console.log("UX02 browser scenario J passed.");

  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login("?reverse-partial=1");
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await page
    .getByRole("button", { name: /Search building, street or postcode/ })
    .click();
  await page.getByPlaceholder("Building, street or postcode").fill("ITCC");
  await page.getByText("ITCC Shopping Mall").click();
  await page.getByRole("button", { name: "Confirm this location" }).click();
  await page.getByRole("button", { name: "Save & use this address" }).click();
  await page
    .getByRole("alert")
    .getByText("We couldn't confirm a complete street and area for this pin.")
    .waitFor({ timeout: 5000 });
  console.log("UX02 browser invalid-location save gate passed.");
} finally {
  await browser.close();
}
