import { describe, expect, it, vi } from "vitest";
import { loadSupportWhatsApp, parseSupportConfig } from "./config";

describe("backend support configuration", () => {
  it("parses only the bounded backend contract", () => {
    expect(parseSupportConfig({ data: { whatsapp: " +60123456789 " } })).toBe(
      "60123456789",
    );
    for (const value of [
      null,
      {},
      { data: { whatsapp: null } },
      { data: { whatsapp: "0123456789" } },
      { data: { whatsapp: "+60123456789", secret: "hidden" } },
      { data: { whatsapp: "+60123456789" }, customerId: "hidden" },
    ])
      expect(parseSupportConfig(value)).toBe("");
  });
  it("fetches independently using the existing authenticated session", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { whatsapp: "+60123456789" } })),
      );
    expect(await loadSupportWhatsApp("", fetcher)).toBe("60123456789");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/customer/support",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        method: "GET",
      }),
    );
  });
  it("returns friendly unavailability on failure or timeout without hanging startup", async () => {
    expect(
      await loadSupportWhatsApp("", async () => {
        throw new Error("offline");
      }),
    ).toBe("");
    expect(
      await loadSupportWhatsApp(
        "",
        async () => new Response("{}", { status: 503 }),
      ),
    ).toBe("");
    expect(await loadSupportWhatsApp("", () => new Promise(() => {}), 5)).toBe(
      "",
    );
  });
});
