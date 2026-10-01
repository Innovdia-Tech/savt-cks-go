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
const capture = async (name) => {
  if (process.env.CKS_GO_VISUAL_CAPTURE)
    await page.screenshot({
      path: `${process.env.CKS_GO_VISUAL_CAPTURE}/${name}.png`,
      fullPage: true,
    });
};

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
    .getByRole("button", { name: /^Work.*Jalan Pintas Penampang/s })
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
  await page
    .getByRole("button", { name: "Save changes" })
    .scrollIntoViewIfNeeded();
  await capture("ux02-normal-edit");
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
    .getByRole("button", { name: /^Work.*Jalan Pintas Penampang/s })
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
  await page
    .getByText(/current delivery address and cart will stay unchanged/)
    .waitFor();
  await page
    .getByRole("button", { name: "Save as new address" })
    .scrollIntoViewIfNeeded();
  await capture("ux02-save-as-new");
  await page.getByRole("button", { name: "Save as new address" }).click();
  const movedHomeDialog = page.getByRole("dialog", {
    name: "Change delivery address?",
  });
  await movedHomeDialog.waitFor();
  await capture("ux02-duplicate-dialog");
  assert.ok(await movedHomeDialog.getByText("Jalan Pintas Penampang").count());
  assert.ok(await movedHomeDialog.getByText(/Penampang, Sabah/).count());
  await movedHomeDialog
    .getByRole("button", { name: "Keep current delivery address" })
    .click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  await page
    .getByText(
      "New address saved. Your current delivery address and cart remain unchanged.",
    )
    .waitFor();
  await page
    .getByText(
      "New address saved. Your current delivery address and cart remain unchanged.",
    )
    .scrollIntoViewIfNeeded();
  await capture("ux02-keep-feedback");
  const duplicateHomeEdits = await page
    .getByRole("button", { name: /^Edit Home, Jalan Pintas Penampang/ })
    .all();
  const duplicateHomeNames = await Promise.all(
    duplicateHomeEdits.map((button) => button.getAttribute("aria-label")),
  );
  assert.equal(duplicateHomeNames.length, 2);
  assert.equal(new Set(duplicateHomeNames).size, 2);
  assert.ok(
    duplicateHomeNames.every((name) => name.includes("Penampang, Sabah")),
  );
  assert.ok(
    duplicateHomeNames.every(
      (name) => !/[0-9]{8}-[0-9a-f-]{27}|5\.9186|116\.08/.test(name),
    ),
  );
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByPlaceholder("Search products…").waitFor();
  assert.ok(await page.getByRole("button", { name: "Cart, 1 item" }).count());
  console.log("UX02 browser selected-pin cart preservation passed.");

  await page.getByText("Deliver to", { exact: true }).click();
  await capture("ux02-duplicate-picker");
  await page.getByRole("button", { name: "＋ Add a new address" }).click();
  await confirmLocation({ moved: "west", label: "Work" });
  const outletDialog = page.getByRole("dialog", {
    name: "Clear cart and switch address?",
  });
  await outletDialog.waitFor();
  await outletDialog
    .getByRole("button", { name: "Keep current delivery address" })
    .click();
  await page.getByPlaceholder("Search products…").waitFor();
  await page
    .getByText(
      "New address saved. Your current delivery address and cart remain unchanged.",
    )
    .waitFor({ timeout: 5000 });
  assert.ok(await page.getByRole("button", { name: "Cart, 1 item" }).count());
  await page.getByText("Deliver to", { exact: true }).click();
  await page
    .getByRole("button", { name: /^Work.*Jalan Pintas Penampang/s })
    .click();
  await outletDialog.waitFor();
  await outletDialog
    .getByRole("button", { name: "Use this address & clear cart" })
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
      .getByRole("button", { name: /^Other.*Jalan Pintas Penampang/s })
      .count(),
  );
  await page
    .getByRole("button", { name: /^Other.*Jalan Pintas Penampang/s })
    .click();
  await coverageDialog.waitFor();
  await coverageDialog
    .getByRole("button", { name: "Use this address & clear cart" })
    .click();
  await page
    .getByRole("heading", { name: "We're not delivering here yet" })
    .waitFor();
  await page
    .getByText("Delivery address changed. Your cart was cleared.")
    .waitFor({ timeout: 5000 });
  assert.equal(
    await page.getByRole("button", { name: "Cart, 1 item" }).count(),
    0,
  );
  console.log("UX02 browser scenario I passed.");

  await page.getByRole("button", { name: "Choose another address" }).click();
  await page
    .getByRole("button", { name: /^Work.*Jalan Pintas Penampang/s })
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
    .getByRole("button", { name: "Use this address & clear cart" })
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
  await page.getByText("Synthetic development fixtures").click();
  await page.locator("#catalogue-scenario").selectOption("coordinates");
  await page.getByRole("heading", { name: "Set delivery location" }).waitFor();
  await page
    .getByRole("button", { name: /Search building, street or postcode/ })
    .click();
  await page.getByPlaceholder("Building, street or postcode").fill("ITCC");
  await page.getByText("ITCC Shopping Mall").click();
  await page.getByLabel("Centered delivery pin").waitFor();
  await page.getByRole("button", { name: "Confirm this location" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByPlaceholder("Search products…").waitFor();
  await page
    .getByRole("button", { name: /Add .* to cart/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Cart, 1 item" }).click();
  await page.getByRole("button", { name: "Review order" }).click();
  await page.getByRole("button", { name: /^Pay RM/ }).waitFor();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByText("Deliver to", { exact: true }).click();
  await page.getByRole("button", { name: "Manage all addresses" }).click();
  await page.getByRole("button", { name: "Edit Work" }).click();
  await page.getByRole("button", { name: "Delete address" }).click();
  await page
    .getByRole("dialog", { name: "Delete this address?" })
    .getByText(/without a confirmed location keeps your cart/)
    .waitFor();
  await page
    .getByRole("dialog", { name: "Delete this address?" })
    .getByRole("button", { name: "Delete address" })
    .click();
  await page.getByRole("heading", { name: "Saved addresses" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Edit Work" }).count(),
    0,
  );
  const unreadyFallback = page.locator("article.customer-card").filter({
    has: page.getByRole("button", { name: "Edit Demo home" }),
  });
  await unreadyFallback.getByText("Selected for delivery").waitFor();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("heading", { name: "Set delivery location" }).waitFor();
  await page.getByRole("button", { name: "Open cart" }).click();
  await page.getByRole("heading", { name: "Your Cart (1)" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Review order" }).isDisabled(),
    true,
  );
  assert.equal(await page.getByRole("button", { name: /^Pay RM/ }).count(), 0);
  assert.equal(await page.getByText(/From Outlet/).count(), 0);
  console.log("UX02 browser selected-delete unready fallback passed.");

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
