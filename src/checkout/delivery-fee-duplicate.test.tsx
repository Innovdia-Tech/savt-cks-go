// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartScreen } from "./components";
import { biscuitCartState } from "./delivery-fee.test-fixtures";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
const renderQuote = async (quantity: 3 | 4, revision: number) => {
  const state = biscuitCartState(quantity, revision);
  await act(() =>
    root.render(
      createElement(CartScreen, {
        state,
        controller: {} as never,
        onBrowse() {},
      }),
    ),
  );
};
const assertSummary = (quantity: 3 | 4) => {
  const totals = host.querySelector(".quote-totals")!;
  expect(
    [...totals.querySelectorAll(":scope > dt")].filter((node) =>
      node.textContent?.startsWith("Delivery fee"),
    ),
  ).toHaveLength(1);
  expect(
    totals.querySelectorAll(":scope > .quote-delivery-charge"),
  ).toHaveLength(1);
  expect(
    totals.querySelectorAll('button[aria-label="About delivery fee"]'),
  ).toHaveLength(1);
  expect(totals.querySelector("s")?.textContent).toMatch(/5\.00/);
  expect(
    totals.querySelector(".quote-delivery-charge strong")?.textContent,
  ).toBe("FREE");
  expect(totals.querySelector("dd.quote-grand")?.textContent).toMatch(
    quantity === 3 ? /18\.50/ : /22\.00/,
  );
  expect(
    totals.querySelectorAll('button[aria-label="About small order fee"]'),
  ).toHaveLength(quantity === 3 ? 1 : 0);
  if (quantity === 3)
    expect(
      totals.querySelector(".small-order-fee-amount")?.textContent,
    ).toMatch(/2\.00/);
};

describe("delivery row identity during conditional small-order fees", () => {
  it("keeps one delivery row across quantity 3 → 4 → 3 and quote refreshes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [quantity, revision] of [
      [3, 1],
      [4, 2],
      [3, 3],
      [3, 4],
      [4, 5],
      [3, 6],
    ] as const) {
      await renderQuote(quantity, revision);
      assertSummary(quantity);
    }
  });
  it("does not reuse sibling identities when refreshing a charged-fee quote", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await renderQuote(3, 1);
    await renderQuote(3, 2);
    expect(
      errors.mock.calls.filter((args) =>
        args.some((value) => String(value).includes("same key")),
      ),
    ).toHaveLength(0);
    assertSummary(3);
  });
});
