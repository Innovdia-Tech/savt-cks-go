import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BottomSheet,
  Button,
  IconButton,
  SearchField,
  Skeleton,
  StatusBadge,
  SystemState,
  syncDialog,
} from "./ui";

describe("shared customer UI primitives", () => {
  it("keeps a busy primary action stable, disabled, and announced", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { busy: true, busyLabel: "Adding" }, "Add to cart"),
    );

    expect(html).toContain('type="button"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Adding");
    expect(html).toContain("Add to cart");
  });

  it("gives icon-only actions an explicit accessible name", () => {
    const html = renderToStaticMarkup(
      createElement(IconButton, { label: "Close sheet" }, "×"),
    );

    expect(html).toContain('aria-label="Close sheet"');
    expect(html).toContain('type="button"');
  });

  it.each([
    ["AVAILABLE", "Available"],
    ["UNAVAILABLE", "Unavailable"],
    ["ORDER_RECEIVED", "Order received"],
    ["PICK_AND_PACK", "Picking and packing"],
    ["OUT_FOR_DELIVERY", "Out for delivery"],
    ["DELIVERED", "Delivered"],
    ["CANCELLED", "Cancelled"],
    ["REJECTED", "Not fulfilled"],
  ] as const)("maps supported %s status copy", (status, label) => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status }));

    expect(html).toContain(label);
    expect(html).not.toContain(status);
  });

  it("renders a labelled search field with a clear action", () => {
    const html = renderToStaticMarkup(
      createElement(SearchField, {
        id: "products",
        label: "Search products",
        value: "rice",
        onChange: () => {},
        onClear: () => {},
      }),
    );

    expect(html).toContain('for="products"');
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="Clear search"');
  });

  it("announces system state without exposing raw error codes", () => {
    const html = renderToStaticMarkup(
      createElement(SystemState, {
        tone: "error",
        title: "Catalogue unavailable",
        description: "Please try again later.",
        actionLabel: "Try again",
        onAction: () => {},
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Try again");
  });

  it("renders a non-semantic loading skeleton", () => {
    const html = renderToStaticMarkup(
      createElement(Skeleton, { label: "Loading products" }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("Loading products");
  });

  it("renders an accessible bottom sheet dialog", () => {
    const html = renderToStaticMarkup(
      createElement(
        BottomSheet,
        { open: true, title: "Choose an address", onClose: () => {} },
        createElement("p", null, "Saved addresses"),
      ),
    );

    expect(html).toContain("<dialog");
    expect(html).not.toMatch(/<dialog[^>]*\sopen(?:=|\s|>)/);
    expect(html).toContain('aria-labelledby="bottom-sheet-title"');
    expect(html).toContain('aria-label="Close sheet"');
  });

  it("opens and closes the bottom sheet through the native modal API", () => {
    let showCalls = 0;
    let closeCalls = 0;
    const dialog = {
      open: false,
      showModal() {
        showCalls += 1;
        this.open = true;
      },
      close() {
        closeCalls += 1;
        this.open = false;
      },
    } as HTMLDialogElement;

    syncDialog(dialog, true);
    syncDialog(dialog, true);
    syncDialog(dialog, false);

    expect(showCalls).toBe(1);
    expect(closeCalls).toBe(1);
    expect(dialog.open).toBe(false);
  });
});
