import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyCentre, PolicyLink } from "./PolicyCentre";
import { parsePublishedPolicies } from "./contracts";

describe("policy centre presentation", () => {
  it("keeps all four policy titles visible without inventing publication evidence", () => {
    const html = renderToStaticMarkup(
      createElement(PolicyCentre, { onClose: () => {} }),
    );

    expect(html).toContain("Terms &amp; Conditions");
    expect(html).toContain("Delivery Policy");
    expect(html).toContain("Cancellation &amp; Refund Policy");
    expect(html).toContain("Privacy Notice");
    expect(html.match(/Not published yet/g)).toHaveLength(4);
    expect(html).not.toContain("<time");
    expect(html).not.toContain("Version");
    expect(html).not.toContain("<a ");
    expect(html).toMatch(/<dialog[^>]+aria-labelledby="[^"]+"/);
  });

  it("opens a checkout policy directly and retains a named return action when unpublished", () => {
    const html = renderToStaticMarkup(
      createElement(PolicyCentre, {
        initialPolicy: "cancellation-refund",
        returnLabel: "Return to checkout",
        onClose: () => {},
      }),
    );

    expect(html).toContain("Cancellation &amp; Refund Policy");
    expect(html).toContain("Not published yet");
    expect(html).toContain("Back to Legal &amp; Policies");
    expect(html).toContain("Return to checkout");
    expect(html).not.toContain("<time");
    expect(html).not.toContain("Version");
  });

  it("distinguishes a configured pending read from an unpublished response", () => {
    const html = renderToStaticMarkup(
      createElement(PolicyCentre, {
        gateway: {
          listPublished: async () => [],
          checkoutRequirement: async () => ({ mode: "inactive" }),
          recordAcceptance: async () => null,
        },
        onClose: () => {},
      }),
    );

    expect(html).toContain("Loading policies");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Not published yet");
    expect(html).not.toContain("<time");
  });

  it("uses an in-app dialog button for the persistent policy entry", () => {
    const html = renderToStaticMarkup(createElement(PolicyLink));

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("Legal &amp; Policies");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<dialog");
  });

  it("renders published content as plain text and preserves its authoritative version", () => {
    const [policy] = parsePublishedPolicies(
      [
        {
          kind: "terms",
          version: "release-7",
          effectiveAt: "2026-10-16T16:30:00.000Z",
          publishedAt: "2026-10-15T16:30:00.000Z",
          status: "published",
          content:
            "First paragraph.\n\n<script>alert('unsafe')</script>\n**Plain text**",
        },
      ],
      Date.parse("2026-10-17T01:00:00.000Z"),
    );
    const html = renderToStaticMarkup(
      createElement(PolicyCentre, {
        policies: [policy],
        initialPolicy: "terms",
        onClose: () => {},
      }),
    );

    expect(html).toContain("release-7");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("**Plain text**");
    expect(html).not.toContain("<strong>Plain text</strong>");
    expect(html).toContain('dateTime="2026-10-16T16:30:00.000Z"');
    expect(html).toContain("17 Oct 2026");
    expect(html).toContain("16 Oct 2026");
  });

  it("does not display malformed or unpublished supplied content", () => {
    const html = renderToStaticMarkup(
      createElement(PolicyCentre, {
        policies: [
          {
            kind: "terms",
            version: "draft-version",
            effectiveAt: "2026-10-16T16:30:00.000Z",
            publishedAt: "2026-10-15T16:30:00.000Z",
            status: "draft",
            content: "Private draft wording",
          },
        ] as never,
        initialPolicy: "terms",
        onClose: () => {},
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Private draft wording");
    expect(html).not.toContain("draft-version");
    expect(html).not.toContain("<time");
  });
});
