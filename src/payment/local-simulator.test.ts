import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSafeCheckoutUrl,
  parsePaymentCreate,
  parsePaymentRetry,
} from "./contracts";

const origin = "http://127.0.0.1:4312";
const path = "/api/integrations/cks-go/v1/payment-simulator/";
const reference = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";
const checkoutUrl = origin + path + reference;
const envelope = {
  data: {
    checkoutReference: "10000000-0000-4000-8000-000000000001",
    payment: {
      paymentIntentId: "20000000-0000-4000-8000-000000000002",
      status: "PENDING",
      checkoutUrl,
    },
  },
};

describe("explicit local payment simulator checkout allowance", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN", origin);
    vi.stubGlobal("window", { location: { href: "http://127.0.0.1:5173/" } });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts the exact simulator checkout for initial and retry response validation", () => {
    expect(isSafeCheckoutUrl(checkoutUrl)).toBe(true);
    expect(parsePaymentCreate(envelope)).toEqual(envelope.data);
    expect(parsePaymentRetry(envelope)).toEqual(envelope.data);
  });

  it.each(["", undefined])(
    "requires the explicit local origin setting %s",
    (setting) => {
      vi.stubEnv("VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN", setting);
      expect(isSafeCheckoutUrl(checkoutUrl)).toBe(false);
    },
  );

  it.each([
    { development: false, production: false },
    { development: true, production: true },
    { development: false, production: true },
  ])(
    "rejects local checkout outside development: %o",
    ({ development, production }) => {
      vi.stubEnv("DEV", development);
      vi.stubEnv("PROD", production);
      expect(isSafeCheckoutUrl(checkoutUrl)).toBe(false);
    },
  );

  it.each([
    "https://127.0.0.1:5173/",
    "http://localhost:5173/",
    "http://[::1]:5173/",
    "http://127.0.0.2:5173/",
    "http://customer.example.test/",
  ])(
    "rejects local checkout when the frontend is not direct HTTP 127.0.0.1: %s",
    (href) => {
      vi.stubGlobal("window", { location: { href } });
      expect(isSafeCheckoutUrl(checkoutUrl)).toBe(false);
    },
  );

  it("rejects local checkout without a browser location", () => {
    vi.stubGlobal("window", undefined);
    expect(isSafeCheckoutUrl(checkoutUrl)).toBe(false);
  });

  it.each([
    "https://127.0.0.1:4312",
    "http://localhost:4312",
    "http://127.0.0.1",
    "http://127.0.0.1:0",
    "http://127.0.0.1:65536",
    "http://127.0.0.1:04312",
    "http://127.0.0.1:4312/",
    "http://127.0.0.1:4312/path",
    "http://127.0.0.1:4312?",
    "http://127.0.0.1:4312#",
    "http://user:password@127.0.0.1:4312",
    "http://2130706433:4312",
    "http://127.1:4312",
    "http://127.0.0.1.evil.test:4312",
    " http://127.0.0.1:4312",
  ])("rejects malformed or noncanonical simulator origin: %s", (setting) => {
    vi.stubEnv("VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN", setting);
    expect(isSafeCheckoutUrl(checkoutUrl)).toBe(false);
  });

  it.each([
    "http://127.0.0.1:4313" + path + reference,
    "http://localhost:4312" + path + reference,
    "http://2130706433:4312" + path + reference,
    "http://127.1:4312" + path + reference,
    "http://127.0.0.1.evil.test:4312" + path + reference,
    "http://user:password@127.0.0.1:4312" + path + reference,
    "http://127.0.0.1:4312@evil.test" + path + reference,
    "http://127.0.0.1:04312" + path + reference,
    "http://127.0.0.1:4312/other/../api/integrations/cks-go/v1/payment-simulator/" +
      reference,
    origin + "/api/integrations/cks-go/v1/other/" + reference,
    checkoutUrl + "?status=PAID",
    checkoutUrl + "?",
    checkoutUrl + "#PAID",
    checkoutUrl + "#",
    checkoutUrl + "/",
    checkoutUrl + "A",
    origin + path + reference.slice(1),
    origin + path + "%41" + reference.slice(1),
    origin + path + ".".repeat(43),
    "http://127.0.0.1:4312\t" + path + reference,
    checkoutUrl + "\n",
  ])(
    "rejects any local URL outside the exact origin and opaque simulator path: %s",
    (value) => {
      expect(isSafeCheckoutUrl(value)).toBe(false);
      expect(() =>
        parsePaymentCreate({
          data: {
            ...envelope.data,
            payment: { ...envelope.data.payment, checkoutUrl: value },
          },
        }),
      ).toThrow("Invalid customer payment response.");
    },
  );

  it("preserves secure checkout validation even when the local setting is invalid", () => {
    vi.stubEnv("VITE_CKS_GO_LOCAL_PAYMENT_SIMULATOR_ORIGIN", "invalid");
    expect(
      isSafeCheckoutUrl("https://payments.example.test/checkout/approved"),
    ).toBe(true);
    expect(
      isSafeCheckoutUrl("https://user:password@payments.example.test/checkout"),
    ).toBe(false);
    expect(isSafeCheckoutUrl("http://payments.example.test/checkout")).toBe(
      false,
    );
  });
});
