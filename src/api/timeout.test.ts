import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, CustomerApiClient } from "./client";
import { CustomerSessionController } from "../session/controller";

const session = {
  authenticated: true,
  expiresAt: "2026-09-18T12:30:00.000Z",
  csrfToken: "C".repeat(43),
};
const handoff = {
  protocolVersion: "1" as const,
  launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
  state: "A".repeat(43),
  code: "D".repeat(43),
};
const operations = ["status", "bootstrap", "exchange", "logout"] as const;
const invoke = (
  client: CustomerApiClient,
  operation: (typeof operations)[number],
) => {
  if (operation === "exchange") return client.exchange(handoff);
  if (operation === "logout") return client.logout(session.csrfToken);
  return client[operation]();
};
const observe = (operation: Promise<unknown>) => {
  const result: { value?: unknown; error?: unknown } = {};
  void operation.then(
    (value) => {
      result.value = value;
    },
    (error: unknown) => {
      result.error = error;
    },
  );
  return result;
};
const successResponse = () => new Response(JSON.stringify({ data: session }));

describe("customer API operation deadlines", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(operations)(
    "bounds a never-settling %s fetch and aborts it",
    async (operation) => {
      const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
      const result = observe(
        invoke(new CustomerApiClient("", fetcher, 100), operation),
      );
      await vi.advanceTimersByTimeAsync(99);
      expect(result.error).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(result.error).toEqual(
        new ApiClientError("retryable", "REQUEST_TIMEOUT"),
      );
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      expect(fetcher.mock.calls[0]?.[1]?.credentials).toBe("include");
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("defaults to a 15-second deadline", async () => {
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const result = observe(new CustomerApiClient("", fetcher).status());
    await vi.advanceTimersByTimeAsync(14_999);
    expect(result.error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result.error).toEqual(
      new ApiClientError("retryable", "REQUEST_TIMEOUT"),
    );
  });

  it.each(["status", "bootstrap", "exchange"] as const)(
    "keeps the original %s deadline through successful body consumption",
    async (operation) => {
      const response = new Response(new ReadableStream());
      const fetcher = vi.fn<typeof fetch>(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(response), 50);
          }),
      );
      const result = observe(
        invoke(new CustomerApiClient("", fetcher, 100), operation),
      );
      await vi.advanceTimersByTimeAsync(99);
      expect(result.error).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      expect(result.error).toEqual(
        new ApiClientError("retryable", "REQUEST_TIMEOUT"),
      );
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each(operations)(
    "bounds stalled error-envelope parsing for %s",
    async (operation) => {
      const response = new Response(new ReadableStream(), { status: 503 });
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      const result = observe(
        invoke(new CustomerApiClient("", fetcher, 100), operation),
      );
      await vi.advanceTimersByTimeAsync(100);
      expect(result.error).toEqual(
        new ApiClientError("retryable", "REQUEST_TIMEOUT"),
      );
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("clears the deadline after successful JSON and logout responses", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new CustomerApiClient("", fetcher, 100);
    expect(await client.status()).toEqual(session);
    await client.logout(session.csrfToken);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(
      fetcher.mock.calls.every(([, init]) => init?.signal?.aborted === false),
    ).toBe(true);
  });

  it("preserves ordinary network rejection and clears its deadline", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      new CustomerApiClient("", fetcher, 100).status(),
    ).rejects.toEqual(new ApiClientError("offline", "NETWORK_ERROR"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("maps timeout to retryableError, ignores a late response, and authenticates on retry", async () => {
    let resolveLate!: (response: Response) => void;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLate = resolve;
          }),
      )
      .mockResolvedValueOnce(successResponse());
    const bridge = {
      requestLaunchCode: vi.fn(),
      requestPaymentHandoff: vi.fn(),
      notifyLoaded: vi.fn(),
      notifyError: vi.fn(),
    };
    const controller = new CustomerSessionController(
      new CustomerApiClient("", fetcher, 100),
      bridge,
    );
    const start = controller.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(controller.getSnapshot()).toEqual({ phase: "retryableError" });
    await start;
    resolveLate(successResponse());
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getSnapshot()).toEqual({ phase: "retryableError" });
    expect(bridge.notifyLoaded).not.toHaveBeenCalled();
    await controller.retry();
    expect(controller.getSnapshot()).toEqual({
      phase: "authenticated",
      expiresAt: session.expiresAt,
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(controller.getSnapshot().phase).toBe("authenticated");
    expect(vi.getTimerCount()).toBe(0);
  });
});
