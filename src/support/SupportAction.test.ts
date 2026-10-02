import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupportAction } from "./SupportAction";

describe("customer support action", () => {
  it("renders the general utility action with an outline icon and descriptive accessible label", () => {
    const html = renderToStaticMarkup(
      createElement(SupportAction, { digits: "60123456789" }),
    );
    expect(html).toContain(">Get help</button>");
    expect(html).toContain("Open CKS Go support in WhatsApp");
    expect(html).toContain("Opens WhatsApp to contact CKS Go support.");
    expect(html).toContain('fill="none"');
    expect(html).toContain("ui-button--tertiary");
    expect(html).not.toContain("60123456789");
  });
  it("keeps missing and invalid support friendly and safely actionable", () => {
    for (const digits of ["", "javascript:alert(1)"]) {
      const html = renderToStaticMarkup(
        createElement(SupportAction, { digits }),
      );
      expect(html).toContain(">Get help</button>");
      expect(html).toContain('role="status"');
      expect(html).toContain("WhatsApp support is unavailable right now.");
      expect(html).not.toContain("wa.me");
    }
  });
  it("renders order help with only its displayed number in its accessible label", () => {
    const html = renderToStaticMarkup(
      createElement(SupportAction, {
        digits: "60123456789",
        orderNumber: "CKS-20260921-0001",
      }),
    );
    expect(html).toContain(">WhatsApp support</button>");
    expect(html).toContain("Open WhatsApp support for order CKS-20260921-0001");
  });
});
