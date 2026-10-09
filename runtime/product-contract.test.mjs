import { createServer } from "node:http";
import { once } from "node:events";
import { expect, it } from "vitest";
import { createApiProxy } from "./proxy.mjs";

it("forwards product capability only on the four implemented product routes", async () => {
  const upstream = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(req.headers));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const proxy = createServer(
    createApiProxy(`http://127.0.0.1:${upstream.address().port}`),
  );
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const origin = `http://127.0.0.1:${proxy.address().port}`;
  const id = "11111111-1111-4111-8111-111111111111";
  try {
    for (const [method, path, forwarded] of [
      ["GET", `/api/v1/customer/outlets/${id}/products?page=1`, true],
      ["GET", `/api/v1/customer/outlets/${id}/products/${id}`, true],
      ["POST", "/api/v1/checkout/quote", true],
      ["GET", `/api/v1/customer/orders/${id}`, true],
      [
        "GET",
        "/api/v1/customer/outlets/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA/products",
        true,
      ],
      [
        "GET",
        "/api/v1/customer/orders/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
        true,
      ],
      ["GET", `/api/v1/customer/outlets/${id}/categories`, false],
      ["GET", `/api/v1/customer/orders/${id}/documents`, false],
      ["GET", "/api/v1/customer/profile", false],
      ["POST", `/api/v1/customer/orders/${id}`, false],
    ]) {
      const response = await fetch(origin + path, {
        method,
        headers: {
          "X-CKS-Product-Contract": "cks-v1",
          "X-CKS-Fee-Contract": "small-order-fee-v1",
          "X-CKS-Assignment-Context": "synthetic-context",
          "Idempotency-Key": id,
          "x-cks-csrf": "synthetic-csrf",
        },
      });
      const headers = await response.json();
      expect(headers["x-cks-product-contract"]).toBe(
        forwarded ? "cks-v1" : undefined,
      );
      const feeForwarded =
        (method === "POST" && path === "/api/v1/checkout/quote") ||
        (method === "GET" &&
          /^\/api\/v1\/customer\/orders\/[0-9a-f-]{36}$/i.test(path));
      expect(headers["x-cks-fee-contract"]).toBe(
        feeForwarded ? "small-order-fee-v1" : undefined,
      );
      expect(headers["x-cks-assignment-context"]).toBe("synthetic-context");
      expect(headers["idempotency-key"]).toBe(id);
      expect(headers["x-cks-csrf"]).toBe("synthetic-csrf");
    }
  } finally {
    proxy.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([
      new Promise((resolve) => proxy.close(resolve)),
      new Promise((resolve) => upstream.close(resolve)),
    ]);
  }
});
