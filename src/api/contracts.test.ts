import { describe, expect, it } from "vitest";
import {
  parseApiErrorEnvelope,
  parseBootstrapEnvelope,
  parseSessionEnvelope,
  parseWebOtpAuthorizeEnvelope,
  parseWebOtpRequestEnvelope,
} from "./contracts";

const bootstrapData = {
  protocolVersion: "1",
  launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256",
  expiresAt: "2026-09-18T12:30:00.000Z",
};

describe("API response envelope validation", () => {
  it("accepts the exact bootstrap success envelope", () => {
    expect(parseBootstrapEnvelope({ data: bootstrapData })).toEqual(
      bootstrapData,
    );
  });

  it.each([
    { data: bootstrapData, extra: true },
    { data: { ...bootstrapData, savtUserId: "900001" } },
    { data: { ...bootstrapData, protocolVersion: "2" } },
    { data: { ...bootstrapData, launchRequestId: "not-a-uuid" } },
    { data: { ...bootstrapData, state: "short" } },
    { data: { ...bootstrapData, expiresAt: "2026" } },
  ])("rejects malformed or expanded bootstrap envelopes", (value) => {
    expect(() => parseBootstrapEnvelope(value)).toThrow(
      "Invalid customer API response",
    );
  });

  it("accepts only an authenticated session with an opaque CSRF token", () => {
    const data = {
      authenticated: true,
      expiresAt: "2026-09-18T12:30:00.000Z",
      csrfToken: "C".repeat(43),
    };
    expect(parseSessionEnvelope({ data })).toEqual(data);
    expect(() =>
      parseSessionEnvelope({ data: { ...data, csrfToken: "short" } }),
    ).toThrow("Invalid customer API response");
  });

  it("accepts the strict public error envelope without trusting extra shapes", () => {
    expect(
      parseApiErrorEnvelope({
        error: {
          code: "CUSTOMER_SESSION_INVALID",
          message: "Customer session is invalid.",
        },
        meta: { requestId: "request-123" },
      }),
    ).toEqual({
      code: "CUSTOMER_SESSION_INVALID",
      message: "Customer session is invalid.",
      requestId: "request-123",
    });
    expect(
      parseApiErrorEnvelope({ error: { message: "missing code" } }),
    ).toBeNull();
    expect(
      parseApiErrorEnvelope({
        error: {
          code: "CUSTOMER_SESSION_INVALID",
          message: "Invalid",
          credential: "must-not-pass",
        },
        meta: { requestId: "request-123" },
      }),
    ).toBeNull();
    expect(
      parseApiErrorEnvelope({
        error: { code: "CUSTOMER_SESSION_INVALID", message: "Invalid" },
        meta: { requestId: "request-123" },
        extra: true,
      }),
    ).toBeNull();
  });

  it("accepts only an exact web OTP request envelope", () => {
    const data = { otpRequestId: "O".repeat(43), resendAfterSeconds: 60 };
    expect(parseWebOtpRequestEnvelope({ data })).toEqual(data);
    for (const value of [
      { data: { ...data, mobileNumber: "+60123456789" } },
      { data: { ...data, otpRequestId: "short" } },
      { data: { ...data, resendAfterSeconds: "60" } },
      { data, token: "hidden" },
    ])
      expect(() => parseWebOtpRequestEnvelope(value)).toThrow();
  });

  it("accepts only the standard one-use authorize result", () => {
    const data = {
      protocolVersion: "1",
      code: "C".repeat(43),
      expiresAt: "2026-09-18T12:30:00.000Z",
    };
    expect(parseWebOtpAuthorizeEnvelope({ data })).toEqual(data);
    for (const value of [
      { data: { ...data, accessToken: "hidden" } },
      { data: { ...data, protocolVersion: 1 } },
      { data: { ...data, code: "short" } },
      { data: { ...data, expiresAt: "tomorrow" } },
    ])
      expect(() => parseWebOtpAuthorizeEnvelope(value)).toThrow();
  });
});
