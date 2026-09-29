import { describe, expect, it, vi } from "vitest";
import { ApiClientError, CustomerApiClient } from "./client";

const requestId = "36f34018-9c94-4b95-b4c8-608b32ae19c7";
const bootstrap = {
  protocolVersion: "1" as const,
  launchRequestId: requestId,
  state: "A".repeat(43),
  codeChallenge: "B".repeat(43),
  codeChallengeMethod: "S256" as const,
  expiresAt: "2026-09-18T12:30:00.000Z",
};
const session = {
  authenticated: true as const,
  expiresAt: "2026-09-18T12:30:00.000Z",
  csrfToken: "C".repeat(43),
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("CustomerApiClient", () => {
  it("uses relative bootstrap and exchange paths with no API origin", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: bootstrap }))
      .mockResolvedValueOnce(jsonResponse({ data: session }));
    const client = new CustomerApiClient("", fetcher);
    await client.bootstrap();
    await client.exchange({
      protocolVersion: "1",
      launchRequestId: requestId,
      state: bootstrap.state,
      code: "D".repeat(43),
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/customer/session/bootstrap",
      "/api/v1/customer/session/exchange",
    ]);
    expect(
      fetcher.mock.calls.every(([, init]) => init?.credentials === "include"),
    ).toBe(true);
  });

  it("bootstraps and exchanges with cookie credentials and the exact public fields", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: bootstrap }))
      .mockResolvedValueOnce(jsonResponse({ data: session }));
    const client = new CustomerApiClient("https://api.cks.example", fetcher);

    expect(await client.bootstrap()).toEqual(bootstrap);
    expect(
      await client.exchange({
        protocolVersion: "1",
        launchRequestId: requestId,
        state: "A".repeat(43),
        code: "D".repeat(43),
      }),
    ).toEqual(session);

    const [bootstrapUrl, bootstrapInit] = fetcher.mock.calls[0]!;
    expect(bootstrapUrl).toBe(
      "https://api.cks.example/api/v1/customer/session/bootstrap",
    );
    expect(bootstrapInit).toMatchObject({
      method: "POST",
      credentials: "include",
      body: "{}",
    });
    expect(bootstrapInit?.headers).not.toHaveProperty("Authorization");

    const [, exchangeInit] = fetcher.mock.calls[1]!;
    expect(JSON.parse(String(exchangeInit?.body))).toEqual({
      protocolVersion: "1",
      launchRequestId: requestId,
      state: "A".repeat(43),
      code: "D".repeat(43),
    });
  });

  it("restores status and logs out with the in-memory CSRF token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: session }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new CustomerApiClient("", fetcher);

    expect(await client.status()).toEqual(session);
    await client.logout(session.csrfToken);

    expect(fetcher.mock.calls[0]).toEqual([
      "/api/v1/customer/session",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    ]);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: expect.objectContaining({ "x-cks-csrf": session.csrfToken }),
      body: "{}",
    });
  });

  it("sends exact browser OTP requests through the credentialed CKS proxy", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: { otpRequestId: "O".repeat(43), resendAfterSeconds: 60 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              protocolVersion: "1",
              code: "D".repeat(43),
              expiresAt: bootstrap.expiresAt,
            },
          },
          201,
        ),
      );
    const client = new CustomerApiClient("", fetcher);
    expect(
      await client.requestWebOtp({
        launchRequestId: requestId,
        mobileNumber: "+60123456789",
      }),
    ).toEqual({ otpRequestId: "O".repeat(43), resendAfterSeconds: 60 });
    expect(
      await client.authorizeWebOtp({
        protocolVersion: "1",
        otpRequestId: "O".repeat(43),
        launchRequestId: requestId,
        state: bootstrap.state,
        codeChallenge: bootstrap.codeChallenge,
        codeChallengeMethod: "S256",
        otp: "123456",
      }),
    ).toEqual({
      protocolVersion: "1",
      code: "D".repeat(43),
      expiresAt: bootstrap.expiresAt,
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/customer/session/web-otp/request",
      "/api/v1/customer/session/web-otp/authorize",
    ]);
    expect(
      fetcher.mock.calls.every(([, init]) => init?.credentials === "include"),
    ).toBe(true);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      launchRequestId: requestId,
      mobileNumber: "+60123456789",
    });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      protocolVersion: "1",
      otpRequestId: "O".repeat(43),
      launchRequestId: requestId,
      state: bootstrap.state,
      codeChallenge: bootstrap.codeChallenge,
      codeChallengeMethod: "S256",
      otp: "123456",
    });
    expect(
      fetcher.mock.calls.every(
        ([, init]) => !JSON.stringify(init).includes("Authorization"),
      ),
    ).toBe(true);
  });

  it("retains bounded server retry timing without rendering its error message", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "CUSTOMER_OTP_RATE_LIMITED",
            message: "private upstream detail",
          },
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "Retry-After": "37",
          },
        },
      ),
    );
    const error = await new CustomerApiClient("", fetcher)
      .requestWebOtp({
        launchRequestId: requestId,
        mobileNumber: "+60123456789",
      })
      .catch((value: unknown) => value);
    expect(error).toMatchObject({
      code: "CUSTOMER_OTP_RATE_LIMITED",
      category: "retryable",
      retryAfterSeconds: 37,
    });
  });

  it.each([
    [new TypeError("Failed to fetch"), "offline"],
    [
      jsonResponse(
        {
          error: {
            code: "CUSTOMER_SESSION_INVALID",
            message: "Customer session is invalid.",
          },
          meta: { requestId: "request-123" },
        },
        401,
      ),
      "expired",
    ],
    [
      jsonResponse(
        {
          error: {
            code: "SAVT_IDENTITY_ADAPTER_UNAVAILABLE",
            message: "Unavailable",
          },
        },
        503,
      ),
      "retryable",
    ],
    [jsonResponse({ unexpected: true }, 400), "unrecoverable"],
  ])(
    "maps fetch and API failures to a safe category",
    async (failure, category) => {
      const fetcher = vi.fn<typeof fetch>();
      if (failure instanceof Response) fetcher.mockResolvedValue(failure);
      else fetcher.mockRejectedValue(failure);

      const error = await new CustomerApiClient("", fetcher)
        .status()
        .catch((value: unknown) => value);
      expect(error).toBeInstanceOf(ApiClientError);
      expect((error as ApiClientError).category).toBe(category);
    },
  );
});
