import { describe, expect, it, vi } from "vitest";
import {
  buildOrderSupportUrl,
  openOrderSupport,
  buildGeneralSupportUrl,
  openGeneralSupport,
  parseSupportWhatsApp,
} from "./support";

describe("customer order support", () => {
  it("supports the current backend business number and rejects internal IDs or enquiry injection", () => {
    const url = buildOrderSupportUrl("60123456789", "CKSGO-20260904-00001");
    expect(url).not.toBeNull();
    expect(new URL(url!).searchParams.get("text")).toBe(
      "Hi CKS Go Support, I need help with my order CKSGO-20260904-00001.\n\nMy enquiry:",
    );
    for (const number of [
      "11111111-1111-4111-8111-111111111111",
      "CKS-20260921-0001\nsession=secret",
    ])
      expect(buildOrderSupportUrl("60123456789", number)).toBeNull();
  });
  it("builds only a wa.me URL with the displayed order number and encoded enquiry", () => {
    const url = buildOrderSupportUrl("60123456789", "CKS-20260921-0001");
    expect(url).toBe(
      "https://wa.me/60123456789?text=Hi%20CKS%20Go%20Support%2C%20I%20need%20help%20with%20my%20order%20CKS-20260921-0001.%0A%0AMy%20enquiry%3A",
    );
    expect(
      decodeURIComponent(new URL(url!).searchParams.get("text")!),
    ).not.toContain("1 Demo Street");
  });

  it("does not open a chat for absent or invalid recipient", () => {
    const open = vi.fn();
    for (const number of [
      "",
      "https://evil.example",
      "6012 345678",
      "0123456789",
    ]) {
      expect(openOrderSupport(number, "CKS-20260921-0001", open)).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });

  it("opens only the constructed URL externally while keeping this page", () => {
    const open = vi.fn();
    expect(openOrderSupport("60123456789", "CKS-20260921-0001", open)).toBe(
      true,
    );
    expect(open).toHaveBeenCalledExactlyOnceWith(
      "https://wa.me/60123456789?text=Hi%20CKS%20Go%20Support%2C%20I%20need%20help%20with%20my%20order%20CKS-20260921-0001.%0A%0AMy%20enquiry%3A",
      "_blank",
      "noopener,noreferrer",
    );
  });
  it("builds the exact general message with no customer fields", () => {
    expect(parseSupportWhatsApp(" +60123456789 ")).toBe("60123456789");
    const url = new URL(buildGeneralSupportUrl("60123456789")!);
    expect(url.pathname).toBe("/60123456789");
    expect(url.searchParams.get("text")).toBe(
      "Hi CKS Go Support, I need some help.\n\nMy enquiry:",
    );
  });
  it("uses the trusted native channel in embedded mode without navigating the WebView", () => {
    const postMessage = vi.fn(),
      open = vi.fn();
    vi.stubGlobal("window", { SavtCksGoBridge: { postMessage }, open });
    try {
      expect(openGeneralSupport("60123456789")).toBe(true);
      expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
        type: "support-handoff",
        payload: { whatsappUrl: buildGeneralSupportUrl("60123456789") },
      });
      expect(open).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("fails closed for arbitrary destinations and thrown external openers", () => {
    const open = vi.fn();
    for (const value of [
      "",
      "javascript:alert(1)",
      "https://evil.example",
      "0060123456789",
      "6012 3456789",
      "+60123456789",
    ])
      expect(openGeneralSupport(value, open)).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(
      openGeneralSupport("60123456789", () => {
        throw new Error("blocked");
      }),
    ).toBe(false);
  });
});
