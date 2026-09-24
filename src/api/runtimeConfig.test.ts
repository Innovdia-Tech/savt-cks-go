import { describe, expect, it } from "vitest";
import { RuntimeConfigurationError, loadRuntimeConfig } from "./runtimeConfig";

describe("loadRuntimeConfig", () => {
  it("uses same-origin API requests when no origin is configured", () => {
    expect(loadRuntimeConfig({}, false)).toEqual({
      apiOrigin: "",
      developmentApi: false,
      developmentBridge: false,
      supportWhatsApp: "",
    });
  });

  it("accepts a secure origin without credentials, path, query or fragment", () => {
    expect(
      loadRuntimeConfig(
        { VITE_CUSTOMER_API_ORIGIN: "https://api.cks.example" },
        true,
      ).apiOrigin,
    ).toBe("https://api.cks.example");
  });

  it.each([
    "http://api.cks.example",
    "https://user:password@api.cks.example",
    "https://api.cks.example/customer",
    "https://api.cks.example?debug=true",
    "not-a-url",
  ])("rejects an invalid production API origin: %s", (apiOrigin) => {
    expect(() =>
      loadRuntimeConfig({ VITE_CUSTOMER_API_ORIGIN: apiOrigin }, true),
    ).toThrow(RuntimeConfigurationError);
  });

  it("allows insecure loopback only in development", () => {
    expect(
      loadRuntimeConfig(
        { VITE_CUSTOMER_API_ORIGIN: "http://127.0.0.1:3000" },
        false,
      ).apiOrigin,
    ).toBe("http://127.0.0.1:3000");
    expect(() =>
      loadRuntimeConfig(
        { VITE_CUSTOMER_API_ORIGIN: "http://127.0.0.1:3000" },
        true,
      ),
    ).toThrow(RuntimeConfigurationError);
  });

  it("selects the synthetic API and bridge independently in development", () => {
    expect(
      loadRuntimeConfig({ VITE_CKS_GO_DEVELOPMENT_API: "true" }, false),
    ).toMatchObject({
      developmentApi: true,
      developmentBridge: false,
    });
    expect(
      loadRuntimeConfig({ VITE_CKS_GO_DEVELOPMENT_BRIDGE: "true" }, false),
    ).toMatchObject({
      developmentApi: false,
      developmentBridge: true,
    });
  });

  it("accepts only an international support number without blocking startup", () => {
    expect(
      loadRuntimeConfig(
        { VITE_CKS_GO_SUPPORT_WHATSAPP: " +60123456789 " },
        true,
      ).supportWhatsApp,
    ).toBe("60123456789");
    for (const invalid of [
      "60123456789",
      "https://wa.me/60123456789",
      "+0123456789",
      "+6012 345 6789",
      "+123",
      "+1234567890123456",
    ]) {
      expect(
        loadRuntimeConfig({ VITE_CKS_GO_SUPPORT_WHATSAPP: invalid }, true)
          .supportWhatsApp,
      ).toBe("");
    }
  });

  it.each(["VITE_CKS_GO_DEVELOPMENT_API", "VITE_CKS_GO_DEVELOPMENT_BRIDGE"])(
    "fails closed when %s is requested in production",
    (name) => {
      expect(() => loadRuntimeConfig({ [name]: "true" }, true)).toThrow(
        RuntimeConfigurationError,
      );
    },
  );
});
