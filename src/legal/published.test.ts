import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/client";
import * as published from "./published";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";

const document = {
  slug: "terms",
  title: "Terms & Conditions",
  version: 2,
  effectiveAt: "2026-10-17T00:00:00.000Z",
  sections: [
    {
      id: "about",
      heading: "About CKS Go",
      blocks: [
        { type: "paragraph", text: "Plain wording." },
        { type: "list", ordered: true, items: ["First", "Second"] },
      ],
    },
  ],
};

describe("HQ published policy projection", () => {
  it("accepts the exact published-only projection without inventing publication metadata", () => {
    expect(
      published.parsePublishedPolicyEnvelope({ data: [document] }),
    ).toEqual([document]);
    expect(published.parsePublishedPolicyEnvelope({ data: [] })).toEqual([]);
  });
  it.each([
    { data: [document], draft: true },
    { data: [{ ...document, status: "DRAFT" }] },
    { data: [{ ...document, publishedById: "staff" }] },
    { data: [{ ...document, version: "2" }] },
    { data: [{ ...document, version: 0 }] },
    { data: [{ ...document, slug: "refund" }] },
    { data: [document, document] },
    { data: [{ ...document, effectiveAt: "2026-02-30T00:00:00.000Z" }] },
    { data: [{ ...document, effectiveAt: null }] },
    { data: [{ ...document, sections: [] }] },
    {
      data: [
        { ...document, sections: [document.sections[0], document.sections[0]] },
      ],
    },
    {
      data: [
        {
          ...document,
          sections: [
            {
              ...document.sections[0],
              blocks: [{ type: "html", html: "<script>x</script>" }],
            },
          ],
        },
      ],
    },
    {
      data: [
        {
          ...document,
          sections: [
            {
              ...document.sections[0],
              blocks: [{ type: "list", ordered: false, items: [] }],
            },
          ],
        },
      ],
    },
    {
      data: [
        {
          ...document,
          sections: [{ ...document.sections[0], heading: "x".repeat(201) }],
        },
      ],
    },
  ])("rejects draft, internal or malformed wire data %#", (value) => {
    expect(() => published.parsePublishedPolicyEnvelope(value)).toThrow();
  });
});

describe("published policy HTTP reads", () => {
  afterEach(() => vi.useRealTimers());
  const session = {
    withCredentials: async <T>(operation: (token: string) => Promise<T>) =>
      operation("private-csrf"),
  };
  it("reads with the existing session and cookies, never sends acceptance or staff requests", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ data: [document] })));
    const api = new published.PublishedPolicyApi("", session, fetcher);
    expect(await api.listPublished(new AbortController().signal)).toEqual([
      document,
    ]);
    expect(fetcher.mock.calls[0]).toEqual([
      "/api/v1/customer/legal-policies",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        headers: { Accept: "application/json" },
      }),
    ]);
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
    expect("recordAcceptance" in api).toBe(false);
    expect("checkoutRequirement" in api).toBe(false);
  });
  it("rejects an expired session before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const expired = {
      withCredentials: async () => {
        throw new ApiClientError("expired", "CUSTOMER_SESSION_INVALID");
      },
    };
    const api = new published.PublishedPolicyApi("", expired, fetcher);
    await expect(
      api.listPublished(new AbortController().signal),
    ).rejects.toMatchObject({ category: "expired" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, "expired"],
    [403, "unrecoverable"],
    [503, "retryable"],
  ])("maps HTTP %s safely", async (status, category) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("private server details", { status: Number(status) }),
      );
    const api = new published.PublishedPolicyApi("", session, fetcher);
    await expect(
      api.listPublished(new AbortController().signal),
    ).rejects.toMatchObject({ category });
  });
  it("rejects malformed successful responses instead of treating them as unpublished", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ ...document, status: "DRAFT" }] }),
        ),
      );
    await expect(
      new published.PublishedPolicyApi("", session, fetcher).listPublished(
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("bounds a noncooperative request and cancels on navigation", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const api = new published.PublishedPolicyApi("", session, fetcher, 100);
    const timed = api.listPublished(new AbortController().signal);
    const rejected = expect(timed).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
    const controller = new AbortController();
    const cancelled = expect(
      api.listPublished(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await cancelled;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("passes a server 401 through the real session expiry boundary", async () => {
    const current = new CustomerSessionController(
      new DevelopmentCustomerApi(false),
      new DevelopmentBridgeAdapter(true, false),
    );
    await current.start();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      new published.PublishedPolicyApi("", current, fetcher).listPublished(
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ category: "expired" });
    expect(current.getSnapshot().phase).toBe("expired");
  });
  it("rejects a successful late response after logout", async () => {
    const current = new CustomerSessionController(
      new DevelopmentCustomerApi(false),
      new DevelopmentBridgeAdapter(true, false),
    );
    await current.start();
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const result = new published.PublishedPolicyApi(
      "",
      current,
      fetcher,
    ).listPublished(new AbortController().signal);
    await current.logout();
    resolve(Response.json({ data: [document] }));
    await expect(result).rejects.toMatchObject({ category: "expired" });
  });
  it("bounds stalled response body reads, not only the initial fetch", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(new ReadableStream()));
    const result = new published.PublishedPolicyApi(
      "",
      session,
      fetcher,
      100,
    ).listPublished(new AbortController().signal);
    const failed = expect(result).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(100);
    await failed;
  });
});
