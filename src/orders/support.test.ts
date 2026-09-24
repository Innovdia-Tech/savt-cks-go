import { describe, expect, it, vi } from "vitest";
import { buildOrderSupportUrl, openOrderSupport } from "./support";

describe("customer order support", () => {
  it("builds only a wa.me URL with the displayed order number and encoded enquiry", () => {
    const url = buildOrderSupportUrl("60123456789", "CKS-20260921-0001");
    expect(url).toBe(
      "https://wa.me/60123456789?text=Hi%20CKS%20Go%20Support%2C%20I%20need%20help%20with%20my%20order%20CKS-20260921-0001.%0AMy%20enquiry%3A",
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
      "https://wa.me/60123456789?text=Hi%20CKS%20Go%20Support%2C%20I%20need%20help%20with%20my%20order%20CKS-20260921-0001.%0AMy%20enquiry%3A",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
