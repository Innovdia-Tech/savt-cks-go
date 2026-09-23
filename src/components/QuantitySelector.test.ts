import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuantitySelector } from "./QuantitySelector";

describe("QuantitySelector", () => {
  it("is a labelled group and disables decrement at the minimum", () => {
    const html = renderToStaticMarkup(
      createElement(QuantitySelector, {
        quantity: 1,
        minimum: 1,
        label: "Rice quantity",
        onIncrement: () => {},
        onDecrement: () => {},
      }),
    );

    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Rice quantity"');
    expect(html).toMatch(
      /<button[^>]+aria-label="Decrease quantity"[^>]+disabled/,
    );
    expect(html).toContain('aria-live="polite"');
  });

  it("disables increment at the maximum and both controls when frozen", () => {
    const maximum = renderToStaticMarkup(
      createElement(QuantitySelector, {
        quantity: 5,
        maximum: 5,
        onIncrement: () => {},
        onDecrement: () => {},
      }),
    );
    const frozen = renderToStaticMarkup(
      createElement(QuantitySelector, {
        quantity: 2,
        disabled: true,
        onIncrement: () => {},
        onDecrement: () => {},
      }),
    );

    expect(maximum).toMatch(
      /<button[^>]+aria-label="Increase quantity"[^>]+disabled/,
    );
    expect(frozen.match(/disabled/g)).toHaveLength(2);
  });

  it("can block additions while still allowing a permitted reduction", () => {
    const html = renderToStaticMarkup(
      createElement(QuantitySelector, {
        quantity: 2,
        minimum: 0,
        incrementDisabled: true,
        onIncrement: () => {},
        onDecrement: () => {},
      }),
    );

    expect(html).not.toMatch(
      /<button[^>]+aria-label="Decrease quantity"[^>]+disabled/,
    );
    expect(html).toMatch(
      /<button[^>]+aria-label="Increase quantity"[^>]+disabled/,
    );
  });
});
