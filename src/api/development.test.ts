import { describe, expect, it } from "vitest";
import { ApiClientError } from "./client";
import { DevelopmentCustomerApi } from "./development";

const requestId = "36f34018-9c94-4b95-b4c8-608b32ae19c7";
const tokenValues = ["A".repeat(43), "B".repeat(43), "C".repeat(43)];

describe("DevelopmentCustomerApi", () => {
  it("runs an in-memory synthetic session without member identity or credentials", async () => {
    const api = new DevelopmentCustomerApi(
      false,
      () => requestId,
      () => tokenValues.shift()!,
    );
    await expect(api.status()).rejects.toMatchObject({ category: "expired" });

    const bootstrap = await api.bootstrap();
    expect(bootstrap).toEqual({
      protocolVersion: "1",
      launchRequestId: requestId,
      state: "A".repeat(43),
      codeChallenge: "B".repeat(43),
      codeChallengeMethod: "S256",
      expiresAt: expect.any(String),
    });
    expect(bootstrap).not.toHaveProperty("savtUserId");

    const session = await api.exchange({
      protocolVersion: "1",
      launchRequestId: requestId,
      state: bootstrap.state,
      code: "D".repeat(43),
    });
    expect(session).toEqual({
      authenticated: true,
      expiresAt: expect.any(String),
      csrfToken: "C".repeat(43),
    });
    expect(await api.status()).toEqual(session);

    await api.logout(session.csrfToken);
    await expect(api.status()).rejects.toMatchObject({ category: "expired" });
  });

  it("rejects use in production and rejects replayed or mismatched handoffs", async () => {
    expect(() => new DevelopmentCustomerApi(true)).toThrow(
      "unavailable in production",
    );
    const api = new DevelopmentCustomerApi(
      false,
      () => requestId,
      () => "A".repeat(43),
    );
    const bootstrap = await api.bootstrap();
    const invalid = api.exchange({
      protocolVersion: "1",
      launchRequestId: "81b0e2ce-d86f-4f60-8fd8-c995c55007b2",
      state: bootstrap.state,
      code: "D".repeat(43),
    });
    await expect(invalid).rejects.toEqual(
      new ApiClientError("expired", "CUSTOMER_LAUNCH_INVALID"),
    );
  });

  it("runs the standalone browser flow with a synthetic development OTP", async () => {
    const api = new DevelopmentCustomerApi(
      false,
      () => requestId,
      () => "A".repeat(43),
    );
    const bootstrap = await api.bootstrap();
    const request = await api.requestWebOtp({
      launchRequestId: requestId,
      mobileNumber: "+601100000001",
    });
    expect(request).toEqual({
      otpRequestId: "A".repeat(43),
      resendAfterSeconds: 60,
    });
    const authorization = await api.authorizeWebOtp({
      protocolVersion: "1",
      otpRequestId: request.otpRequestId,
      launchRequestId: requestId,
      state: bootstrap.state,
      codeChallenge: bootstrap.codeChallenge,
      codeChallengeMethod: "S256",
      otp: "123456",
    });
    expect(authorization).toMatchObject({
      protocolVersion: "1",
      code: "D".repeat(43),
    });
    expect(
      (
        await api.exchange({
          protocolVersion: "1",
          launchRequestId: requestId,
          state: bootstrap.state,
          code: authorization.code,
        })
      ).authenticated,
    ).toBe(true);
  });

  it("rejects malformed synthetic OTP and replay", async () => {
    const api = new DevelopmentCustomerApi(
      false,
      () => requestId,
      () => "A".repeat(43),
    );
    const bootstrap = await api.bootstrap();
    const request = await api.requestWebOtp({
      launchRequestId: requestId,
      mobileNumber: "+601100000001",
    });
    const body = {
      protocolVersion: "1" as const,
      otpRequestId: request.otpRequestId,
      launchRequestId: requestId,
      state: bootstrap.state,
      codeChallenge: bootstrap.codeChallenge,
      codeChallengeMethod: "S256" as const,
      otp: "000000",
    };
    await expect(api.authorizeWebOtp(body)).rejects.toMatchObject({
      code: "CUSTOMER_OTP_INVALID",
    });
    await api.authorizeWebOtp({ ...body, otp: "123456" });
    await expect(
      api.authorizeWebOtp({ ...body, otp: "123456" }),
    ).rejects.toMatchObject({ code: "CUSTOMER_OTP_INVALID" });
  });
});
