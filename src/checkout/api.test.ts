import { describe, expect, it, vi } from "vitest";
import { DevelopmentCustomerApi } from "../api/development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { QuoteApi } from "./api";
import { id, quoteEnvelope } from "./test-fixtures";

const request = {
  outletId: id("a"),
  customerAddressId: id("b"),
  deliveryType: "NOW" as const,
  items: [{ outletProductId: id("2"), quantity: 2 }],
};

async function setup(fetcher: typeof fetch, timeout = 100) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return { session, api: new QuoteApi("", session, fetcher, timeout) };
}

describe("trusted quote HTTP boundary", () => {
  it("sends only authoritative identifiers and quantities with CSRF and the supplied stable key", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(quoteEnvelope()));
    const { api } = await setup(fetcher);
    const key = "12345678-1234-4234-8234-123456789012";
    await api.create(request, key);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/checkout/quote");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(String(init?.body)).not.toMatch(
      /price|subtotal|distance|fee|eta|total/i,
    );
    const headers = new Headers(init?.headers);
    expect([...headers.keys()].sort()).toEqual([
      "accept",
      "content-type",
      "idempotency-key",
      "x-cks-csrf",
    ]);
    expect(headers.get("Idempotency-Key")).toBe(key);
    expect(headers.get("x-cks-csrf")).toMatch(/^[\w-]{43}$/);
    expect(headers.has("X-CKS-Assignment-Context")).toBe(false);
    expect(String(url)).not.toMatch(/customerAddress|assignment|context|csrf/i);
  });

  it("rejects invalid, duplicate, over-limit, or cross-outlet request data before fetch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const { api } = await setup(fetcher);
    for (const value of [
      { ...request, outletId: "bad" },
      { ...request, items: [{ ...request.items[0], quantity: 0 }] },
      { ...request, items: [request.items[0], request.items[0]] },
      {
        ...request,
        items: Array.from({ length: 101 }, (_, index) => ({
          outletProductId: id(((index % 9) + 1).toString()),
          quantity: 1,
        })),
      },
    ])
      await expect(
        api.create(value as never, crypto.randomUUID()),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [409, "CHECKOUT_OUTLET_PRODUCT_UNAVAILABLE"],
    [409, "CHECKOUT_INSUFFICIENT_STOCK"],
    [409, "CHECKOUT_OUTLET_ASSIGNMENT_MISMATCH"],
    [409, "CUSTOMER_ADDRESS_CHANGED"],
    [503, "CUSTOMER_ASSIGNMENT_INCOMPLETE"],
    [422, "CUSTOMER_NO_SERVICEABLE_OUTLET"],
  ])("maps safe %s %s without exposing backend text", async (status, code) => {
    const { api } = await setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code, message: "private provider details" } },
            { status },
          ),
        ),
    );
    await expect(
      api.create(request, crypto.randomUUID()),
    ).rejects.toMatchObject({ code, message: code });
  });

  it("expires the customer session on 401 even with a malformed body", async () => {
    const { api, session } = await setup(
      async () => new Response("bad", { status: 401 }),
    );
    await expect(
      api.create(request, crypto.randomUUID()),
    ).rejects.toMatchObject({ code: "CUSTOMER_SESSION_INVALID" });
    expect(session.getSnapshot().phase).toBe("expired");
  });

  it("bounds network, timeout, and successful-body parsing failures", async () => {
    const cases: [typeof fetch, string][] = [
      [
        async () => {
          throw new TypeError("private");
        },
        "NETWORK_ERROR",
      ],
      [() => new Promise(() => {}), "REQUEST_TIMEOUT"],
      [
        async () => Response.json({ data: { unexpected: true } }),
        "INVALID_RESPONSE",
      ],
      [
        async () =>
          ({
            ok: true,
            status: 201,
            json: () => new Promise(() => {}),
          }) as Response,
        "REQUEST_TIMEOUT",
      ],
    ];
    for (const [fetcher, code] of cases) {
      const { api } = await setup(fetcher, 5);
      await expect(
        api.create(request, crypto.randomUUID()),
      ).rejects.toMatchObject({ code });
    }
  });
});
