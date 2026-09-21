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
