import { describe, expect, it } from "vitest";
import { OrdersApi, OrdersError } from "./api";

const orderId = "11111111-1111-4111-8111-111111111111";
const listResponse = {
  data: [],
  meta: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
};

const session = {
  withCredentials: <T>(operation: (csrf: string) => Promise<T>) =>
    operation("C".repeat(43)),
};

describe("OrdersApi", () => {
  it("lists the exact customer order page with cookies and no-store", async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const api = new OrdersApi(
      "https://cks.example",
      session,
      async (input, init) => {
        request = { url: String(input), init };
        return Response.json(listResponse);
      },
    );
    await expect(api.list(2, 10)).resolves.toEqual(listResponse);
    expect(request?.url).toBe(
      "https://cks.example/api/v1/customer/orders?page=2&pageSize=10",
    );
    expect(request?.init).toMatchObject({
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  });

  it("gets detail from the exact UUID route without query parameters", async () => {
    let url = "";
    const api = new OrdersApi("", session, async (input) => {
      url = String(input);
      return Response.json({ data: { invalid: true } });
    });
    await expect(api.detail(orderId)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(url).toBe(`/api/v1/customer/orders/${orderId}`);
  });

  it("does not expose an order cancellation mutation", () => {
    expect("cancel" in new OrdersApi("", session)).toBe(false);
  });

  it("downloads only the exact owned receipt PDF path", async () => {
    let url = "";
    const path = `/api/v1/orders/${orderId}/receipt/download`;
    const api = new OrdersApi("", session, async (input) => {
      url = String(input);
      return new Response(new Uint8Array([37, 80, 68, 70]), {
        headers: { "content-type": "application/pdf" },
      });
    });
    const result = await api.downloadReceipt(orderId, path);
    expect(result.type).toBe("application/pdf");
    expect(url).toBe(path);
    await expect(
      api.downloadReceipt(orderId, "https://evil.example/receipt.pdf"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("maps only allowlisted backend codes and collapses raw errors", async () => {
    const safe = new OrdersApi("", session, async () =>
      Response.json(
        {
          error: {
            code: "CUSTOMER_ORDER_NOT_FOUND",
            message: "internal",
          },
          meta: { requestId: "x" },
        },
        { status: 409 },
      ),
    );
    await expect(safe.list()).rejects.toMatchObject({
      code: "CUSTOMER_ORDER_NOT_FOUND",
    });
    const unsafe = new OrdersApi("", session, async () =>
      Response.json(
        { error: { code: "DATABASE_TABLE_MISSING", message: "secret" } },
        { status: 500 },
      ),
    );
    await expect(unsafe.list()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("maps 401 to session expiry", async () => {
    const api = new OrdersApi(
      "",
      session,
      async () => new Response(null, { status: 401 }),
    );
    await expect(api.list()).rejects.toMatchObject({
      code: "CUSTOMER_SESSION_INVALID",
    });
  });

  it("bounds a non-cooperative request and aborts it", async () => {
    let aborted = false;
    const api = new OrdersApi(
      "",
      session,
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
      5,
    );
    await expect(api.list()).rejects.toEqual(
      new OrdersError("REQUEST_TIMEOUT"),
    );
    expect(aborted).toBe(true);
  });

  it("never creates orders or calls provider hosts", async () => {
    const urls: string[] = [];
    const api = new OrdersApi("https://cks.example", session, async (input) => {
      urls.push(String(input));
      return Response.json(listResponse);
    });
    await api.list();
    expect(urls).toEqual([
      "https://cks.example/api/v1/customer/orders?page=1&pageSize=25",
    ]);
    expect(
      urls.every(
        (url) => !url.includes("/api/v1/orders") && !url.includes("payment"),
      ),
    ).toBe(true);
  });
});
