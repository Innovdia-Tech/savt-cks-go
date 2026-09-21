import { describe, it, expect, vi } from "vitest";
import { CatalogueApi } from "./api";
import { CustomerSessionController } from "../session/controller";
import { DevelopmentCustomerApi } from "../api/development";
import { DevelopmentBridgeAdapter } from "../webview/bridge";
const id = "11111111-1111-4111-8111-111111111111",
  handle = "A".repeat(43);
const outlet = {
  id,
  displayReference: "DEMO",
  displayName: "Demo",
  status: "ACTIVE",
  operatingState: "ONLINE",
  availability: "AVAILABLE",
};
const time = "2026-09-19T00:00:00.000Z",
  expiry = "2026-09-19T00:05:00.000Z";
const assignment = {
  data: {
    assignmentContextId: handle,
    customerAddressId: id,
    addressRowVersion: 7,
    outlet,
    resolvedAt: time,
    expiresAt: expiry,
  },
  meta: { asOf: time },
};
const empty = {
  data: [],
  meta: {
    page: 1,
    pageSize: 24,
    total: 0,
    hasNextPage: false,
    asOf: time,
    outlet,
    assignmentContextExpiresAt: expiry,
  },
};
async function setup(fetcher: typeof fetch, timeout = 100) {
  const session = new CustomerSessionController(
    new DevelopmentCustomerApi(false),
    new DevelopmentBridgeAdapter(true, false),
  );
  await session.start();
  return { session, api: new CatalogueApi("", session, fetcher, timeout) };
}
describe("catalogue HTTP boundary", () => {
  it("sends exact assignment body, credentials and memory CSRF", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(assignment));
    const { api } = await setup(fetcher);
    await api.assign({ id, rowVersion: 7 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/customer/outlet-assignment");
    expect(JSON.parse(String(init?.body))).toEqual({
      customerAddressId: id,
      addressRowVersion: 7,
    });
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect([...new Headers(init?.headers).keys()].sort()).toEqual([
      "accept",
      "content-type",
      "x-cks-csrf",
    ]);
    expect(new Headers(init?.headers).get("x-cks-csrf")).toMatch(/^[\w-]{43}$/);
  });
  it.each(["categories", "products", "detail"] as const)(
    "uses context only in %s request header",
    async (route) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(empty));
      const { api } = await setup(fetcher);
      await api[route](
        assignment.data as never,
        route === "detail"
          ? (id as never)
          : ({ page: 1, q: "rice & 50%", categoryId: id } as never),
      ).catch(() => {});
      const [url, init] = fetcher.mock.calls[0];
      const h = new Headers(init?.headers);
      expect(init?.credentials).toBe("include");
      expect(init?.method).toBe("GET");
      expect(h.get("X-CKS-Assignment-Context")).toBe(handle);
      expect([...h.keys()].sort()).toEqual([
        "accept",
        "x-cks-assignment-context",
      ]);
      expect(String(url)).not.toContain(handle);
      expect(String(url)).not.toMatch(/customerAddress|addressRowVersion/);
      expect(init?.body).toBeUndefined();
      if (route === "products")
        expect(String(url)).toContain("q=rice+%26+50%25");
    },
  );
  it("expires the existing session on HTTP 401", async () => {
    const { api, session } = await setup(
      async () => new Response(null, { status: 401 }),
    );
    await expect(api.assign({ id, rowVersion: 7 })).rejects.toMatchObject({
      code: "CUSTOMER_SESSION_INVALID",
    });
    expect(session.getSnapshot().phase).not.toBe("authenticated");
  });
  it("maps offline, timeout, malformed and safe provider failures", async () => {
    const cases: [typeof fetch, string][] = [
      [
        async () => {
          throw new TypeError("private details");
        },
        "NETWORK_ERROR",
      ],
      [() => new Promise(() => {}), "REQUEST_TIMEOUT"],
      [async () => Response.json({ secret: "private" }), "INVALID_RESPONSE"],
      [
        async () =>
          Response.json(
            {
              error: {
                code: "CUSTOMER_ASSIGNMENT_INCOMPLETE",
                message: "private",
              },
              meta: { requestId: "demo" },
            },
            { status: 503 },
          ),
        "CUSTOMER_ASSIGNMENT_INCOMPLETE",
      ],
    ];
    for (const [f, code] of cases) {
      const { api } = await setup(f, 5);
      await expect(api.assign({ id, rowVersion: 7 })).rejects.toMatchObject({
        code,
        message: code,
      });
    }
  });
});
