import { describe, it, expect, vi } from "vitest";
import { CustomerDataApi } from "./api";
import { createOperation } from "../addresses/operation";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
const row = {
  id: "22222222-2222-4222-8222-222222222222",
  label: "Demo",
  recipientName: "Synthetic",
  recipientPhoneE164: null,
  addressLine1: "Example",
  addressLine2: null,
  city: "Demo",
  state: "Sabah",
  postcode: null,
  countryCode: "MY",
  deliveryInstructions: null,
  latitude: null,
  longitude: null,
  isDefault: false,
  status: "ACTIVE",
  rowVersion: 7,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const input = {
  label: "Demo",
  recipientName: "Synthetic",
  addressLine1: "Example",
  city: "Demo",
  state: "Sabah",
  countryCode: "MY" as const,
};
async function setup(fetcher: typeof fetch, timeout = 100) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return { session, api: new CustomerDataApi("", session, fetcher, timeout) };
}
describe("customer requests", () => {
  it.each(["create", "edit", "default", "deactivate", "reactivate"] as const)(
    "sends safe credentialed %s headers",
    async (kind) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ data: row }));
      const { api } = await setup(fetcher);
      const op = createOperation(
        kind,
        kind === "create" ? undefined : (row as never),
        kind === "create" || kind === "edit" ? input : undefined,
      );
      await api.mutate(op);
      const [url, init] = fetcher.mock.calls[0];
      const h = new Headers(init?.headers);
      expect(init?.credentials).toBe("include");
      expect(h.get("x-cks-csrf")).toMatch(/^[\w-]{43}$/);
      expect(h.has("Authorization")).toBe(false);
      expect([...h.keys()].sort()).toEqual(
        [
          "accept",
          "content-type",
          "x-cks-csrf",
          ...(kind !== "edit" ? ["idempotency-key"] : []),
          ...(kind !== "create" ? ["if-match"] : []),
        ].sort(),
      );
      expect(h.get("If-Match")).toBe(kind === "create" ? null : '"7"');
      expect(h.get("Idempotency-Key")).toBe(kind === "edit" ? null : op.key);
      expect(url).toBe(
        "/api/v1/customer/me/addresses" +
          (kind === "create"
            ? ""
            : "/" + row.id + (kind === "edit" ? "" : "/" + kind)),
      );
      expect(init?.method).toBe(kind === "edit" ? "PATCH" : "POST");
    },
  );
  it("keeps an immutable UUIDv4 operation across retries and allocates new keys for new actions", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError())
      .mockResolvedValue(Response.json({ data: row }));
    const { api } = await setup(fetcher);
    const body = { ...input };
    const op = createOperation("create", undefined, body);
    body.label = "Changed";
    await expect(api.mutate(op)).rejects.toMatchObject({ category: "offline" });
    await api.mutate(op);
    expect(op.key).toMatch(
      /^[0-9a-f-]{14}4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"),
    ).toBe(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("Idempotency-Key"),
    );
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).label).toBe(
      "Demo",
    );
    expect(createOperation("create", undefined, input).key).not.toBe(op.key);
  });
  it.each([
    [412, "CUSTOMER_ADDRESS_VERSION_CONFLICT", "conflict"],
    [428, "PRECONDITION_REQUIRED", "conflict"],
    [409, "CUSTOMER_ADDRESS_INACTIVE", "conflict"],
    [409, "CUSTOMER_ADDRESS_LIMIT", "limit"],
    [409, "IDEMPOTENCY_KEY_REUSED", "conflict"],
    [409, "IDEMPOTENCY_REQUEST_IN_PROGRESS", "retryable"],
    [404, "CUSTOMER_ADDRESS_NOT_FOUND", "notFound"],
    [403, "CUSTOMER_ADDRESS_READ_ONLY", "readOnly"],
    [503, "PROVIDER_UNAVAILABLE", "retryable"],
    [400, "CUSTOMER_ADDRESS_INVALID", "validation"],
  ])("maps %s %s", async (status, code, category) => {
    const { api } = await setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code, message: "safe" } },
            { status: Number(status) },
          ),
        ),
    );
    await expect(api.addresses()).rejects.toMatchObject({ category });
  });
  it.each([
    [401, "CUSTOMER_SESSION_INVALID"],
    [403, "CUSTOMER_CSRF_INVALID"],
  ])("clears the session for %s %s", async (status, code) => {
    const { api, session } = await setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { code, message: "safe" } },
            { status: Number(status) },
          ),
        ),
    );
    await expect(
      api.mutate(createOperation("create", undefined, input)),
    ).rejects.toMatchObject({ category: "expired" });
    expect(session.getSnapshot().phase).toBe("expired");
  });
  it("expires even when a 401 body is malformed", async () => {
    const { api, session } = await setup(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("invalid", { status: 401 })),
    );
    await expect(api.addresses()).rejects.toMatchObject({
      category: "expired",
    });
    expect(session.getSnapshot().phase).toBe("expired");
  });
  it("bounds non-cooperative fetch and JSON body reads", async () => {
    for (const fetcher of [
      vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {})),
      vi.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: () => new Promise(() => {}),
      } as Response),
    ]) {
      const { api } = await setup(fetcher, 5);
      await expect(api.addresses()).rejects.toMatchObject({
        code: "REQUEST_TIMEOUT",
        category: "retryable",
      });
    }
  });
  it("does not send CSRF on a credentialed GET", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: [] }));
    const { api } = await setup(fetcher);
    await expect(api.addresses()).resolves.toEqual([]);
    expect(fetcher.mock.calls[0][1]?.credentials).toBe("include");
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).has("x-cks-csrf"),
    ).toBe(false);
  });
  it("refuses a mutation after logout", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const { api, session } = await setup(fetcher);
    await session.logout();
    await expect(
      api.mutate(createOperation("create", undefined, input)),
    ).rejects.toMatchObject({ category: "expired" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it("retains retryability when a mutation response is malformed after possible commit", async () => {
  const { api } = await setup(
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: { unexpected: true } })),
  );
  await expect(
    api.mutate(createOperation("create", undefined, input)),
  ).rejects.toMatchObject({ category: "retryable", code: "INVALID_RESPONSE" });
});
it("rejects expanded profile responses and uses the exact profile route", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ data: { unexpected: true } }));
  const { api } = await setup(fetcher);
  await expect(api.profile()).rejects.toMatchObject({ category: "invalid" });
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/customer/me");
});
