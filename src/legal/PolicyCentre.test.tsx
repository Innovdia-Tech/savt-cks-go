import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyCentre, PolicyLink } from "./PolicyCentre";
import { parsePublishedPolicies } from "./contracts";
import { PolicyPreviewProvider, usePolicyPreview } from "./preview-context";
import { draftPolicyPreview } from "./preview/bundle";
import sourceDrafts from "./preview/CKSGO_LEGAL_POLICY_PREVIEW_v01.json";
import { CheckoutPolicyPayment } from "./CheckoutPolicyPayment";

describe("policy centre presentation", () => {
  it("keeps all four policy titles visible without inventing publication evidence", () => {
    const html = renderToStaticMarkup(
      createElement(PolicyCentre, { onClose: () => {} }),
    );

    expect(html).toContain("Terms &amp; Conditions");
    expect(html).toContain("Delivery Policy");
    expect(html).toContain("Cancellation &amp; Refund Policy");
    expect(html).toContain("Privacy Notice");
    expect(html.match(/Not available yet/g)).toHaveLength(4);
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
    expect(html).toContain("Not available yet");
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
    expect(html).not.toContain("Not available yet");
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

describe("restricted policy preview", () => {
  const escaped = (text: string) =>
    renderToStaticMarkup(createElement("span", null, text)).slice(6, -7);
  const preview = (child: ReturnType<typeof createElement>) =>
    renderToStaticMarkup(
      createElement(
        PolicyPreviewProvider,
        { bundle: draftPolicyPreview },
        child,
      ),
    );

  it("has no draft content without an explicitly supplied preview provider", () => {
    function Probe() {
      return createElement("span", null, usePolicyPreview() ? "draft" : "none");
    }
    expect(renderToStaticMarkup(createElement(Probe))).toBe(
      "<span>none</span>",
    );
    expect(preview(createElement(Probe))).toBe("<span>draft</span>");
  });

  it("preserves the supplied JSON wording and maps only the refund identifier", () => {
    expect(draftPolicyPreview.status).toBe("DRAFT_PREVIEW_ONLY");
    expect(draftPolicyPreview.effectiveDate).toBeNull();
    expect(draftPolicyPreview.policies).toEqual(
      sourceDrafts.policies.map(({ id, ...policy }) => ({
        kind: id === "refund" ? "cancellation-refund" : id,
        ...policy,
      })),
    );
    expect(
      draftPolicyPreview.policies.map((policy) => policy.sections.length),
    ).toEqual([7, 6, 6, 6]);
    expect(
      draftPolicyPreview.policies.map((policy) =>
        policy.sections.reduce(
          (count, section) => count + section.paragraphs.length,
          0,
        ),
      ),
    ).toEqual([14, 12, 12, 11]);
  });

  it("shows four selectable draft rows without showing the document bodies", () => {
    const html = preview(createElement(PolicyCentre, { onClose: () => {} }));
    expect(
      html.match(/class="customer-button legal-policy-row"/g),
    ).toHaveLength(4);
    expect(html).not.toContain("disabled=");
    expect(html).not.toContain("DRAFT");
    expect(html).not.toContain("Restricted preview");
    expect(html).not.toContain("<footer");
    for (const policy of draftPolicyPreview.policies) {
      expect(html).toContain(escaped(policy.title));
      expect(html).toContain(escaped(policy.subtitle));
      expect(html).not.toContain(escaped(policy.sections[0].paragraphs[0]));
    }
  });

  it.each(draftPolicyPreview.policies)(
    "renders every exact section and paragraph of $kind in its own reader",
    (policy) => {
      const html = preview(
        createElement(PolicyCentre, {
          initialPolicy: policy.kind,
          returnLabel: "Return to checkout",
          onClose: () => {},
        }),
      );
      expect(html).toContain(escaped(policy.title));
      expect(html).toContain(escaped(policy.subtitle));
      expect(html).toContain(escaped(policy.time));
      expect(html).toContain("Back to Legal &amp; Policies");
      expect(html).toContain("Return to checkout");
      expect(html).toContain("Jump to section");
      expect(html).not.toContain("DRAFT · NOT EFFECTIVE");
      expect(html).not.toContain("policies are not published");
      for (const section of policy.sections) {
        expect(html).toContain(escaped(section.heading));
        for (const paragraph of section.paragraphs) {
          expect(html).toContain(`<p>${escaped(paragraph)}</p>`);
        }
      }
      for (const other of draftPolicyPreview.policies.filter(
        (entry) => entry.kind !== policy.kind,
      )) {
        expect(html).not.toContain(escaped(other.sections[0].paragraphs[0]));
      }
      expect(html).not.toContain("legal-metadata");
      expect(html).not.toContain("<time");
      expect(html).not.toContain('type="checkbox"');
    },
  );

  it("does not replace supplied published versions or an explicit empty publication list", () => {
    const [published] = parsePublishedPolicies([
      {
        kind: "terms",
        version: "release-authoritative",
        effectiveAt: "2026-10-16T00:00:00.000Z",
        publishedAt: "2026-10-15T00:00:00.000Z",
        status: "published",
        content: "Authoritative published policy body",
      },
    ]);
    const html = preview(
      createElement(PolicyCentre, {
        initialPolicy: "terms",
        policies: [published],
        onClose: () => {},
      }),
    );
    expect(html).toContain("Authoritative published policy body");
    expect(html).toContain("release-authoritative");
    expect(html).not.toContain(
      escaped(draftPolicyPreview.policies[0].sections[0].paragraphs[0]),
    );
    const empty = preview(
      createElement(PolicyCentre, {
        initialPolicy: "terms",
        policies: [],
        onClose: () => {},
      }),
    );
    expect(empty).toContain("Not available yet");
    expect(empty).not.toContain(
      escaped(draftPolicyPreview.policies[0].sections[0].paragraphs[0]),
    );
  });

  it("does not replace a configured gateway's pending publication read with drafts", () => {
    const html = preview(
      createElement(PolicyCentre, {
        initialPolicy: "terms",
        onClose: () => {},
        gateway: {
          listPublished: async () => [],
          checkoutRequirement: async () => ({ mode: "inactive" }),
          recordAcceptance: async () => null,
        },
      }),
    );
    expect(html).toContain("Loading policies");
    expect(html).not.toContain(
      escaped(draftPolicyPreview.policies[0].sections[0].paragraphs[0]),
    );
  });

  it("keeps checkout acceptance inactive when preview documents are provided", () => {
    const html = preview(
      createElement(CheckoutPolicyPayment, {
        quoteId: "preview-quote",
        onInitiate: async () => {},
      }),
    );
    expect(html).toContain("Legal &amp; Policies");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("I agree");
    expect(html).not.toContain("Saving your agreement");
  });
});
