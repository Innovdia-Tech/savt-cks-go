import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { CustomerNotice } from "./CustomerNotice";
it("announces the compact success toast politely and removes its geometry when empty", () => {
  const html = renderToStaticMarkup(
    createElement(CustomerNotice, {
      notice: "Address saved",
      noticeKind: "success",
    }),
  );
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain('aria-atomic="true"');
  expect(html).toContain("customer-status-toast");
  expect(html).toContain('aria-hidden="true">✓');
  expect(html).toContain("Address saved");
  expect(
    renderToStaticMarkup(
      createElement(CustomerNotice, { notice: "", noticeKind: "persistent" }),
    ),
  ).toBe("");
});
it("keeps actionable recovery in the page instead of a disappearing toast", () => {
  const html = renderToStaticMarkup(
    createElement(CustomerNotice, {
      notice: "Address saved. Reload the list to see the current addresses.",
      noticeKind: "persistent",
    }),
  );
  expect(html).toContain("Reload the list");
  expect(html).toContain('class="catalogue-notice"');
  expect(html).not.toContain("customer-status-toast");
});
