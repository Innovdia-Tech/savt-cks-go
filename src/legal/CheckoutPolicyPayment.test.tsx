import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckoutPolicyPayment } from "./CheckoutPolicyPayment";
import { PolicyGatewayProvider } from "./context";
import type { PolicyGateway } from "./contracts";
import { PolicyPreviewProvider } from "./preview-context";
import { draftPolicyPreview } from "./preview/bundle";

const props = {
  quoteId: "quote-one",
  acceptedTotalMinor: 1432,
  onInitiate: async () => {},
};

describe("checkout policy agreement", () => {
  it("keeps draft preview reading available while consent and payment remain inactive", () => {
    const html = renderToStaticMarkup(
      createElement(
        PolicyPreviewProvider,
        { bundle: draftPolicyPreview },
        createElement(CheckoutPolicyPayment, props),
      ),
    );
    expect(html).toContain("Legal &amp; Policies");
    expect(html).toContain(
      "Shopping, delivery, refunds and privacy—explained clearly.",
    );
    expect(html).toContain("Payments are disabled in this restricted preview.");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("Policies are not available yet.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Proceed to Payment/);
  });
  it("offers the policy centre without a consent control or unavailable reading links when acceptance is inactive", () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutPolicyPayment, props),
    );
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Legal &amp; Policies");
    expect(html).toContain("Policies are not available yet.");
    expect(html).toMatch(/<button[^>]*>Proceed to Payment/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Proceed to Payment/);
    expect(html).toContain("RM");
    for (const name of [
      "Terms &amp; Conditions",
      "Delivery Policy",
      "Cancellation &amp; Refund Policy",
      "Privacy Notice",
    ])
      expect(html).not.toContain(name);
  });

  it("blocks the final action while an enabled gateway checks the required versions", () => {
    const gateway: PolicyGateway = {
      listPublished: async () => [],
      checkoutRequirement: async () => {
        throw new Error("offline");
      },
      recordAcceptance: async () => {
        throw new Error("offline");
      },
    };
    const html = renderToStaticMarkup(
      createElement(
        PolicyGatewayProvider,
        { gateway },
        createElement(CheckoutPolicyPayment, props),
      ),
    );
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Proceed to Payment/);
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Checking the policies for this order…");
    expect(html).toContain("Legal &amp; Policies");
  });
});
