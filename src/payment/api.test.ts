import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentApi, PaymentError } from "./api";

const quoteId = "10000000-0000-4000-8000-000000000001";
const paymentIntentId = "20000000-0000-4000-8000-000000000002";
const key = "30000000-0000-4000-8000-000000000003";
const quoteToken = "Q".repeat(43);
const csrf = "C".repeat(43);

const createEnvelope = {
  data: {
    checkoutReference: quoteId,
    payment: {
      paymentIntentId,
      status: "PENDING",
      checkoutUrl: "https://pay.example.test/checkout/approved",
    },
  },
};

const resultEnvelope = {
  data: { checkoutReference: quoteId, status: "PENDING", order: null },
};

const session = {
  withCredentials: <T>(operation: (token: string) => Promise<T>) =>
    operation(csrf),
};

describe("customer payment HTTP boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries with the exact bodyless credentialed POST, CSRF and caller key", async () => {
    const withCredentials = vi.fn(session.withCredentials);
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(createEnvelope),
    );
    const api = new PaymentApi(
      "https://cks.example",
      { withCredentials: withCredentials as typeof session.withCredentials },
      fetcher,
    );
    await expect(api.retry(paymentIntentId, key)).resolves.toEqual(
      createEnvelope.data,
    );
    expect(withCredentials).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      `https://cks.example/api/v1/customer/checkout/payments/${paymentIntentId}/retry`,
    );
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers)).toEqual(
      new Headers({
        Accept: "application/json",
        "Idempotency-Key": key,
        "x-cks-csrf": csrf,
      }),
    );
  });

  it.each([
    {
      checkoutReference: quoteId,
      payment: { paymentIntentId, status: "PENDING" },
    },
    {
      checkoutReference: quoteId,
      payment: { paymentIntentId, status: "FAILED" },
    },
    {
      ...createEnvelope.data,
      payment: {
        ...createEnvelope.data.payment,
        expiresAt: "2026-10-02T03:00:00.000Z",
      },
    },
    { checkoutReference: quoteId, status: "PENDING", order: null },
    { checkoutReference: quoteId, status: "FAILED", order: null },
    { checkoutReference: quoteId, status: "PAID_PROCESSING", order: null },
    {
      checkoutReference: quoteId,
      status: "PAID",
      order: { orderId: key, orderNumber: "ORD-2026-0001", status: "NEW" },
    },
  ])("parses the frozen retry union %#", async (data) => {
    const api = new PaymentApi(
      "",
      session,
      vi.fn(async () => Response.json({ data })),
    );
    await expect(api.retry(paymentIntentId, key)).resolves.toEqual(data);
  });

  it.each([
    { ...createEnvelope.data, status: "PAID", order: null },
    { ...createEnvelope.data, payment: { paymentIntentId, status: "PAID" } },
    {
      ...createEnvelope.data,
      payment: { paymentIntentId: "bad", status: "PENDING" },
    },
    {
      ...createEnvelope.data,
      payment: {
        paymentIntentId,
        status: "PENDING",
        checkoutUrl: "javascript:charge()",
      },
    },
    {
      ...createEnvelope.data,
      payment: { paymentIntentId, status: "PENDING", checkoutUrl: null },
    },
    {
      ...createEnvelope.data,
      payment: { paymentIntentId, status: "PENDING", expiresAt: "yesterday" },
    },
    {
      ...createEnvelope.data,
      payment: {
        paymentIntentId,
        status: "PENDING",
        providerReference: "secret",
      },
    },
    { checkoutReference: quoteId, status: "PAID", order: null },
    {
      checkoutReference: quoteId,
      status: "PAID_PROCESSING",
      order: { orderId: key, orderNumber: "ORDER", status: "NEW" },
    },
    { checkoutReference: "bad", status: "PENDING", order: null },
    { checkoutReference: quoteId, status: "PENDING" },
    { checkoutReference: quoteId, status: ["PENDING"], order: null },
    {
      checkoutReference: quoteId,
      payment: { paymentIntentId, status: ["PENDING"] },
    },
  ])("rejects malformed or inconsistent retry union %#", async (data) => {
    const api = new PaymentApi(
      "",
      session,
      vi.fn(async () => Response.json({ data })),
    );
    await expect(api.retry(paymentIntentId, key)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it.each([
    ["bad", key],
    [paymentIntentId, "bad"],
  ])(
    "validates retry UUIDs before credentials or fetch",
    async (intent, retryKey) => {
      const withCredentials = vi.fn(session.withCredentials);
      const fetcher = vi.fn();
      const api = new PaymentApi(
        "",
        { withCredentials: withCredentials as typeof session.withCredentials },
        fetcher,
      );
      await expect(api.retry(intent, retryKey)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
      expect(withCredentials).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([
    "CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED",
    "PAYMENT_ATTEMPT_STATE_CHANGED",
    "CHECKOUT_PAYMENT_CREATE_DISABLED",
    "SAVT_PAYMENT_RECOVERY_FAILED",
    "PAYMENT_ATTEMPT_IDENTITY_MISMATCH",
    "SAVT_PAYMENT_NOT_FOUND",
    "PAYMENT_ATTEMPT_NOT_PENDING",
    "CUSTOMER_ORGANISATION_FORBIDDEN",
    "SAVT_INTEGRATION_UNAVAILABLE",
  ])(
    "recognises merged retry error %s without backend messages",
    async (code) => {
      const api = new PaymentApi(
        "",
        session,
        vi.fn(async () =>
          Response.json(
            { error: { code, message: "private backend details" } },
            { status: 409 },
          ),
        ),
      );
      await expect(api.retry(paymentIntentId, key)).rejects.toEqual(
        new PaymentError(code),
      );
    },
  );

  it("keeps retry session-expiry and external abort handling", async () => {
    const expired = new PaymentApi(
      "",
      session,
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(expired.retry(paymentIntentId, key)).rejects.toMatchObject({
      code: "CUSTOMER_SESSION_INVALID",
    });
    const abort = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(init?.signal?.aborted).toBe(true);
      throw new Error("aborted");
    });
    abort.abort();
    await expect(
      new PaymentApi("", session, fetcher).retry(
        paymentIntentId,
        key,
        abort.signal,
      ),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("bounds and aborts an uncertain retry request", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const api = new PaymentApi(
      "",
      session,
      vi.fn((_url, init) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
      25,
    );
    const request = api.retry(paymentIntentId, key);
    const rejection = expect(request).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(signal?.aborted).toBe(true);
  });

  it("sends the exact create request only to the CKS Go backend", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(createEnvelope, { status: 201 }),
    );
    const api = new PaymentApi(
      "https://cks.example",
      session as never,
      fetcher,
    );

    await expect(api.create(quoteId, quoteToken, key)).resolves.toEqual(
      createEnvelope.data,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://cks.example/api/v1/customer/checkout/payments");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ quoteId, quoteToken }),
    });
    expect(new Headers(init?.headers)).toEqual(
      new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "x-cks-csrf": csrf,
      }),
    );
    expect(String(url)).not.toMatch(/savt|gkash|gateway/i);
  });

  it("sends the exact observational result GET without CSRF or provider traffic", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(resultEnvelope),
    );
    const api = new PaymentApi(
      "https://cks.example",
      session as never,
      fetcher,
    );

    await expect(api.result(paymentIntentId)).resolves.toEqual(
      resultEnvelope.data,
    );

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      `https://cks.example/api/v1/customer/checkout/payments/${paymentIntentId}`,
    );
    expect(init).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const headers = new Headers(init?.headers);
    expect(headers.get("x-cks-csrf")).toBeNull();
    expect(headers.get("Idempotency-Key")).toBeNull();
    expect(String(url)).not.toMatch(/orders|savt|gkash|gateway/i);
  });

  it("preserves the browser fetch receiver", async () => {
    const browserFetch = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(Response.json(createEnvelope, { status: 201 }));
    });
    vi.stubGlobal("fetch", browserFetch);
    const api = new PaymentApi("", session as never);
    await api.create(quoteId, quoteToken, key);
    expect(browserFetch).toHaveBeenCalledOnce();
  });

  it("rejects malformed input before fetch", async () => {
    const fetcher = vi.fn();
    const api = new PaymentApi("", session as never, fetcher);
    await expect(api.create("bad", quoteToken, key)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(api.result("bad")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps only allowlisted backend errors and discards raw provider details", async () => {
    const safe = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "CHECKOUT_QUOTE_PAYMENT_ALREADY_ATTEMPTED",
              message: "internal detail",
            },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "GKASH_PROVIDER_SECRET_FAILURE",
              message: "provider stack trace",
            },
          },
          { status: 502 },
        ),
      );
    const api = new PaymentApi("", session as never, safe);
    await expect(api.create(quoteId, quoteToken, key)).rejects.toEqual(
      new PaymentError("CHECKOUT_QUOTE_PAYMENT_ALREADY_ATTEMPTED"),
    );
    await expect(api.result(paymentIntentId)).rejects.toEqual(
      new PaymentError("INVALID_RESPONSE"),
    );
  });

  it("bounds a non-cooperative request and aborts it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const api = new PaymentApi("", session as never, fetcher, 25);
    const request = api.create(quoteId, quoteToken, key);
    const rejection = expect(request).rejects.toEqual(
      new PaymentError("REQUEST_TIMEOUT"),
    );
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(signal?.aborted).toBe(true);
  });
});
