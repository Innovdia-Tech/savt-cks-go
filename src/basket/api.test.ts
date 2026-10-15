import { describe, expect, it, vi } from "vitest";
import { DevelopmentCustomerApi } from "../api/development";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
import { BasketApi, type BasketDraft } from "./api";

const id = (part: string) =>
  `${part.repeat(8)}-${part.repeat(4)}-4${part.repeat(3)}-8${part.repeat(3)}-${part.repeat(12)}`;
const draft: BasketDraft = {
  revision: 4,
  mutationId: id("a"),
  outletId: id("2"),
  items: [
    { outletProductId: id("3"), quantity: 2, displayedUnitPriceMinor: 450 },
  ],
};
const line = () => ({
  outletId: id("2"),
  outletProductId: id("3"),
  product: {
    productId: id("4"),
    name: "Rice",
    imageUrl: null,
    barcode: null,
    packSize: "1 kg",
    uom: { code: "PACK", name: "Pack" },
  },
  quantity: 2,
  displayedUnitPriceMinor: 450,
  currency: "MYR",
  issue: null,
  priceChanged: false,
});
const envelope = () => ({
  data: {
    customerId: id("1"),
    revision: 5,
    outletId: id("2"),
    lines: [line()],
  },
});
async function setup(fetcher: typeof fetch, timeout = 100) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return { session, api: new BasketApi("", session, fetcher, timeout) };
}

describe("authenticated saved-basket HTTP boundary", () => {
  it("reads server ownership and current line evidence without creating checkout or payment", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(envelope()));
    const { api } = await setup(fetcher);
    expect(await api.get()).toEqual({
      customerId: id("1"),
      revision: 5,
      outletId: id("2"),
      lines: [line()],
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/customer/basket");
    expect(init).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    expect(init?.body).toBeUndefined();
    expect([...new Headers(init?.headers).keys()]).toEqual(["accept"]);
  });

  it("sends only the explicit basket revision, mutation identity and line draft with CSRF", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(envelope()));
    const { api } = await setup(fetcher);
    await api.save(draft);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/customer/basket");
    expect(init).toMatchObject({
      method: "PUT",
      keepalive: true,
      credentials: "include",
      cache: "no-store",
    });
    expect(JSON.parse(String(init?.body))).toEqual(draft);
    expect(String(init?.body)).not.toMatch(
      /customerId|quote|payment|token|assignment|csrf/,
    );
    const headers = new Headers(init?.headers);
    expect([...headers.keys()].sort()).toEqual([
      "accept",
      "content-type",
      "x-cks-csrf",
    ]);
    expect(headers.get("x-cks-csrf")).toMatch(/^[\w-]{43}$/);
  });

  it("accepts an empty account basket with no outlet", async () => {
    const { api } = await setup(async () =>
      Response.json({
        data: { customerId: id("1"), revision: 0, outletId: null, lines: [] },
      }),
    );
    expect(await api.get()).toMatchObject({
      revision: 0,
      outletId: null,
      lines: [],
    });
  });

  it.each([
    null,
    "UNAVAILABLE",
    "OUT_OF_STOCK",
    "PRICE_UNAVAILABLE",
    "QUANTITY_EXCEEDS_STOCK",
  ])("retains restorable quantities and the server issue %s", async (issue) => {
    const value = envelope();
    Object.assign(value.data.lines[0], { issue, priceChanged: true });
    const { api } = await setup(async () => Response.json(value));
    expect((await api.get()).lines[0]).toMatchObject({
      quantity: 2,
      issue,
      priceChanged: true,
    });
  });

  it("accepts null product metadata and only product-owned media paths", async () => {
    const value = envelope();
    Object.assign(value.data.lines[0].product, {
      uom: null,
      packSize: null,
      imageUrl: `/api/v1/product-media/${id("4")}/${id("5")}`,
    });
    const { api } = await setup(async () => Response.json(value));
    expect((await api.get()).lines[0].product.uom).toBeNull();
  });

  const malformed: Array<
    [string, (value: ReturnType<typeof envelope>) => void]
  > = [
    [
      "missing account owner",
      (v) => {
        delete (v.data as Partial<typeof v.data>).customerId;
      },
    ],
    [
      "invalid account owner",
      (v) => {
        v.data.customerId = "bad";
      },
    ],
    [
      "negative revision",
      (v) => {
        v.data.revision = -1;
      },
    ],
    [
      "unsafe revision",
      (v) => {
        v.data.revision = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "unknown authority",
      (v) => {
        Object.assign(v.data, { quoteToken: "private" });
      },
    ],
    [
      "mixed outlet",
      (v) => {
        v.data.lines[0].outletId = id("6");
      },
    ],
    [
      "unowned lines",
      (v) => {
        Object.assign(v.data, { outletId: null });
      },
    ],
    [
      "duplicate lines",
      (v) => {
        v.data.lines.push(line());
      },
    ],
    [
      "fractional quantity",
      (v) => {
        v.data.lines[0].quantity = 1.5;
      },
    ],
    [
      "too many units",
      (v) => {
        v.data.lines[0].quantity = 1_000_000_001;
      },
    ],
    [
      "negative price",
      (v) => {
        v.data.lines[0].displayedUnitPriceMinor = -1;
      },
    ],
    [
      "unsafe line subtotal",
      (v) => {
        Object.assign(v.data.lines[0], {
          quantity: 1_000_000_000,
          displayedUnitPriceMinor: 999_999_999_999,
        });
      },
    ],
    [
      "invalid product ID",
      (v) => {
        v.data.lines[0].product.productId = "bad";
      },
    ],
    [
      "unknown line secret",
      (v) => {
        Object.assign(v.data.lines[0], { csrfToken: "private" });
      },
    ],
    [
      "unknown product secret",
      (v) => {
        Object.assign(v.data.lines[0].product, { token: "private" });
      },
    ],
    [
      "unrecognised issue",
      (v) => {
        Object.assign(v.data.lines[0], { issue: "PRIVATE_INTERNAL_REASON" });
      },
    ],
    [
      "invalid price flag",
      (v) => {
        Object.assign(v.data.lines[0], { priceChanged: "yes" });
      },
    ],
    [
      "unsafe image protocol",
      (v) => {
        Object.assign(v.data.lines[0].product, {
          imageUrl: "javascript:alert(1)",
        });
      },
    ],
    [
      "credentialled image",
      (v) => {
        Object.assign(v.data.lines[0].product, {
          imageUrl: "https://name:password@example.test/rice.png",
        });
      },
    ],
    [
      "another product media path",
      (v) => {
        Object.assign(v.data.lines[0].product, {
          imageUrl: `/api/v1/product-media/${id("6")}/${id("5")}`,
        });
      },
    ],
  ];
  it.each(malformed)(
    "rejects a saved basket with %s",
    async (_name, change) => {
      const value = envelope();
      change(value);
      const { api } = await setup(async () => Response.json(value));
      await expect(api.get()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    },
  );

  it("rejects malformed drafts before sending a write", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const { api } = await setup(fetcher);
    for (const invalid of [
      { ...draft, revision: -1 },
      { ...draft, mutationId: "bad" },
      { ...draft, customerId: id("1") },
      { ...draft, outletId: null },
      { ...draft, items: [draft.items[0], draft.items[0]] },
      { ...draft, items: [{ ...draft.items[0], quantity: 0 }] },
      { ...draft, items: [{ ...draft.items[0], displayedUnitPriceMinor: -1 }] },
      {
        ...draft,
        items: [
          { ...draft.items[0], displayedUnitPriceMinor: 1_000_000_000_000 },
        ],
      },
      {
        ...draft,
        items: [
          {
            ...draft.items[0],
            quantity: 1_000_000_000,
            displayedUnitPriceMinor: 999_999_999_999,
          },
        ],
      },
      { ...draft, items: [{ ...draft.items[0], quoteId: id("8") }] },
    ])
      await expect(api.save(invalid as BasketDraft)).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
      });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    "BASKET_REVISION_CONFLICT",
    "BASKET_MUTATION_REUSED",
    "BASKET_OUTLET_PRODUCT_MISMATCH",
    "VALIDATION_FAILED",
  ])(
    "preserves safe error %s without exposing server text or replaying the write",
    async (code) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code, message: "private backend evidence" } },
            { status: 409 },
          ),
        );
      const { api } = await setup(fetcher);
      await expect(api.save(draft)).rejects.toMatchObject({
        code,
        message: code,
      });
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("discards unknown backend codes and private text", async () => {
    const { api } = await setup(async () =>
      Response.json(
        { error: { code: "SECRET_DATABASE_DETAIL", message: "private" } },
        { status: 500 },
      ),
    );
    await expect(api.get()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      message: "INVALID_RESPONSE",
    });
  });

  it.each(["get", "save"] as const)(
    "expires the session on unauthorized %s without replaying",
    async (method) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("private", { status: 401 }));
      const { api, session } = await setup(fetcher);
      await expect(
        method === "get" ? api.get() : api.save(draft),
      ).rejects.toMatchObject({ code: "CUSTOMER_SESSION_INVALID" });
      expect(session.getSnapshot().phase).toBe("expired");
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it("bounds fetch and body parsing while preserving network failure codes", async () => {
    for (const [fetcher, code] of [
      [
        async () => {
          throw new TypeError("private");
        },
        "NETWORK_ERROR",
      ],
      [() => new Promise(() => {}), "REQUEST_TIMEOUT"],
      [
        async () =>
          ({
            ok: true,
            status: 200,
            json: () => new Promise(() => {}),
          }) as Response,
        "REQUEST_TIMEOUT",
      ],
      [
        async () =>
          ({
            ok: false,
            status: 500,
            json: () => new Promise(() => {}),
          }) as Response,
        "REQUEST_TIMEOUT",
      ],
    ] as Array<[typeof fetch, string]>) {
      const { api } = await setup(fetcher, 5);
      await expect(api.get()).rejects.toMatchObject({ code });
    }
  });

  it("cancels an in-flight read even when the fetch ignores abort", async () => {
    const { api } = await setup(() => new Promise(() => {}));
    const abort = new AbortController();
    const pending = api.get(abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("does not fetch an already cancelled request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const { api } = await setup(fetcher);
    const abort = new AbortController();
    abort.abort();
    await expect(api.get(abort.signal)).rejects.toMatchObject({
      code: "CANCELLED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fences a late successful response after logout", async () => {
    let resolve!: (response: Response) => void;
    const { api, session } = await setup(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = api.get();
    await session.logout();
    resolve(Response.json(envelope()));
    await expect(pending).rejects.toMatchObject({
      code: "CUSTOMER_SESSION_INVALID",
    });
  });
});
