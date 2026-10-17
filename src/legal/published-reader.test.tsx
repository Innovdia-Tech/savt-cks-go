// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyCentre, PolicyLink } from "./PolicyCentre";
import { PublishedPolicyProvider } from "./published-context";
import {
  PublishedPolicyApi,
  type PublishedPolicyDocument,
  type PublishedPolicyGateway,
} from "./published";
import { PolicyPreviewProvider } from "./preview-context";
import { draftPolicyPreview } from "./preview/bundle";
import { CheckoutPolicyPayment } from "./CheckoutPolicyPayment";

const policy: PublishedPolicyDocument = {
  slug: "terms",
  title: "Terms & Conditions",
  version: 4,
  effectiveAt: "2026-10-17T00:00:00.000Z",
  sections: [
    {
      id: "about",
      heading: "About our service",
      blocks: [
        {
          type: "paragraph",
          text: "Published text <script>alert('unsafe')</script>",
        },
        { type: "list", ordered: true, items: ["First step", "Second step"] },
        { type: "list", ordered: false, items: ["One item", "Another item"] },
      ],
    },
  ],
};
const session = {
  withCredentials: async <T,>(operation: (token: string) => Promise<T>) =>
    operation("private"),
};
let host: HTMLDivElement;
let root: Root;
const button = (label: string): HTMLButtonElement => {
  const found = [...host.querySelectorAll("button")].find(
    (node) =>
      node.textContent?.includes(label) ||
      node.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
};
const click = async (label: string) => act(async () => button(label).click());
const tree = (
  gateway: PublishedPolicyGateway,
  preview = false,
  centre = false,
) => {
  const child = createElement(
    PublishedPolicyProvider,
    { gateway },
    centre
      ? createElement(PolicyCentre, {
          onClose: () => {},
          initialPolicy: "terms",
        })
      : createElement(PolicyLink),
  );
  return preview
    ? createElement(
        PolicyPreviewProvider,
        { bundle: draftPolicyPreview },
        child,
      )
    : child;
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {},
  });
  host = document.createElement("div");
  host.className = "app-shell__scroll";
  host.style.overflow = "auto";
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("HQ-published customer reader", () => {
  it("loads structured server text, preserves section navigation, Orders context and return focus", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [policy] }));
    await act(async () =>
      root.render(tree(new PublishedPolicyApi("", session, fetcher))),
    );
    window.location.hash = "orders";
    host.scrollTop = 321;
    button("Legal & Policies").focus();
    await click("Legal & Policies");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(host.style.overflow).toBe("hidden");
    await click("Terms & Conditions");
    expect(host.querySelector("h3")?.textContent).toBe("About our service");
    expect(host.textContent).toContain("<script>alert('unsafe')</script>");
    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelectorAll("ol li")).toHaveLength(2);
    expect(host.querySelectorAll(".legal-section ul li")).toHaveLength(2);
    expect(host.querySelector("time")?.getAttribute("datetime")).toBe(
      policy.effectiveAt,
    );
    expect(host.textContent).toContain("Effective");
    expect(host.textContent).not.toContain("DRAFT");
    expect(host.querySelector("footer")).toBeNull();
    expect(host.querySelector('[type="checkbox"]')).toBeNull();
    await click("About our service");
    expect(document.activeElement).toBe(host.querySelector("h3"));
    await click("Back to Legal & Policies");
    expect(document.activeElement).toBe(button("Terms & Conditions"));
    await click("Close Legal & Policies");
    expect(document.activeElement).toBe(button("Legal & Policies"));
    expect(host.scrollTop).toBe(321);
    expect(host.style.overflow).toBe("auto");
    expect(window.location.hash).toBe("#orders");
  });
  it("shows loading then unavailable after an empty server response without fabricated metadata", async () => {
    let resolve!: (value: PublishedPolicyDocument[]) => void;
    const gateway = {
      listPublished: () =>
        new Promise<PublishedPolicyDocument[]>((done) => {
          resolve = done;
        }),
    };
    await act(async () => root.render(tree(gateway)));
    await click("Legal & Policies");
    expect(host.textContent).toContain("Loading policies");
    await act(async () => resolve([]));
    expect(host.textContent).toContain(
      "Policies will appear here when available",
    );
    expect(host.querySelectorAll(".legal-policy-row:disabled")).toHaveLength(4);
    expect(host.querySelector("time")).toBeNull();
  });
  it("retains a recoverable error, and never substitutes preview drafts for a failed request", async () => {
    const gateway = {
      listPublished: vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce([]),
    };
    await act(async () => root.render(tree(gateway, true)));
    await click("Legal & Policies");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "couldn't load",
    );
    expect(host.querySelectorAll(".legal-policy-row:disabled")).toHaveLength(4);
    await click("Retry");
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(
      host.querySelectorAll(".legal-policy-row:not(:disabled)"),
    ).toHaveLength(4);
    await click("Terms & Conditions");
    expect(host.textContent).toContain(
      draftPolicyPreview.policies[0].sections[0].paragraphs[0],
    );
    expect(host.querySelector("time")).toBeNull();
  });
  it("prefers an effective publication over the restricted preview fixture", async () => {
    await act(async () =>
      root.render(tree({ listPublished: async () => [policy] }, true, true)),
    );
    expect(host.textContent).toContain("Published text");
    expect(host.textContent).not.toContain(
      draftPolicyPreview.policies[0].sections[0].paragraphs[0],
    );
    expect(host.querySelector("time")?.getAttribute("datetime")).toBe(
      policy.effectiveAt,
    );
  });
  it("discards a late response from a replaced reader source", async () => {
    let resolve!: (value: PublishedPolicyDocument[]) => void;
    let firstSignal!: AbortSignal;
    const stale = {
      listPublished: (signal: AbortSignal) => {
        firstSignal = signal;
        return new Promise<PublishedPolicyDocument[]>((done) => {
          resolve = done;
        });
      },
    };
    await act(async () => root.render(tree(stale, false, true)));
    await act(async () =>
      root.render(tree({ listPublished: async () => [] }, false, true)),
    );
    expect(firstSignal.aborted).toBe(true);
    await act(async () => resolve([policy]));
    expect(host.textContent).toContain("Not available yet");
    expect(host.textContent).not.toContain("Published text");
  });
  it("keeps the checkout acceptance gateway absent and the preview payment guard intact", async () => {
    const initiate = vi.fn();
    const gateway = { listPublished: vi.fn().mockResolvedValue([policy]) };
    await act(async () =>
      root.render(
        createElement(
          PublishedPolicyProvider,
          { gateway },
          createElement(
            PolicyPreviewProvider,
            { bundle: draftPolicyPreview },
            createElement(CheckoutPolicyPayment, {
              quoteId: "quote",
              onInitiate: initiate,
            }),
          ),
        ),
      ),
    );
    expect(host.querySelector('[type="checkbox"]')).toBeNull();
    expect(button("Proceed to Payment").disabled).toBe(true);
    button("Legal & Policies").focus();
    await click("Legal & Policies");
    await click("Terms & Conditions");
    expect(host.textContent).toContain("Published text");
    await click("Return to checkout");
    expect(document.activeElement).toBe(button("Legal & Policies"));
    expect(initiate).not.toHaveBeenCalled();
  });
  it("keeps ordinary payment initiation independent of read-only policy availability", async () => {
    const initiate = vi.fn().mockResolvedValue(undefined);
    const gateway = {
      listPublished: vi.fn().mockRejectedValue(new Error("unavailable")),
    };
    await act(async () =>
      root.render(
        createElement(
          PublishedPolicyProvider,
          { gateway },
          createElement(CheckoutPolicyPayment, {
            quoteId: "quote",
            onInitiate: initiate,
          }),
        ),
      ),
    );
    expect(host.querySelector('[type="checkbox"]')).toBeNull();
    expect(host.textContent).toContain("View available policies.");
    expect(gateway.listPublished).not.toHaveBeenCalled();
    await click("Proceed to Payment");
    expect(initiate).toHaveBeenCalledTimes(1);
  });
});
