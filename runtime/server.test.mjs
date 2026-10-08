import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, request } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCustomerServer } from "./server.mjs";
import { CustomerApiClient } from "../src/api/client.ts";

const servers = [];
let directory;
async function listen(server) {
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function setup(handler, timeoutMs = 250) {
  const upstream = await listen(createServer(handler));
  const origin = await listen(
    createCustomerServer({
      target: upstream,
      distDirectory: directory,
      timeoutMs,
    }),
  );
  return { origin, upstream };
}
function raw(origin, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(origin, { path, headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "cks-proxy-"));
  await mkdir(join(directory, "assets"));
  await writeFile(
    join(directory, "index.html"),
    "<!doctype html><title>Customer web</title>",
  );
  await writeFile(
    join(directory, "assets", "app.js"),
    "window.customer = true;",
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        }),
    ),
  );
  await rm(directory, { recursive: true, force: true });
});

describe("same-origin customer runtime", () => {
  it.each(["timeout", "failure"])(
    "keeps proxy %s errors retryable for the real customer client",
    async (mode) => {
      const { origin } = await setup((req) => {
        if (mode === "failure") req.socket.destroy();
      }, 60);
      const client = new CustomerApiClient(origin);
      await expect(client.bootstrap()).rejects.toMatchObject({
        category: "retryable",
        code:
          mode === "timeout"
            ? "CUSTOMER_API_TIMEOUT"
            : "CUSTOMER_API_UNAVAILABLE",
      });
    },
  );

  it.each(["GET", "DELETE", "OPTIONS"])(
    "preserves a %s request body with fixed-length and chunked framing",
    async (method) => {
      const received = [];
      const { origin } = await setup(async (req, res) => {
        let body = "";
        for await (const chunk of req) body += chunk;
        received.push({ method: req.method, body });
        res.end("ok");
      });
      for (const framing of [
        { "content-length": "2" },
        { "transfer-encoding": "chunked" },
      ]) {
        const status = await new Promise((resolve, reject) => {
          const req = request(
            `${origin}/api/v1/fixture`,
            { method, headers: framing },
            (res) => {
              res.resume();
              res.on("end", () => resolve(res.statusCode));
            },
          );
          req.on("error", reject);
          req.end("{}");
        });
        expect(status).toBe(200);
      }
      expect(received).toEqual([
        { method, body: "{}" },
        { method, body: "{}" },
      ]);
    },
  );

  it("preserves method, raw body/query and security headers at the fixed upstream", async () => {
    let received;
    const { origin, upstream } = await setup(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      received = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      };
      res.writeHead(409, {
        "content-type": "application/json",
        "x-internal-host": "private",
        server: "private",
      });
      res.end('{"error":{"code":"CONFLICT"}}');
    });
    const body = '{ "address": "fixture only" }';
    const response = await fetch(
      `${origin}/api/v1/customer/me/addresses?search=a%2Fb&x=1&x=2`,
      {
        method: "PATCH",
        body,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Cookie: "__Host-cksgo_launch=synthetic",
          Origin: origin,
          "x-cks-csrf": "synthetic-csrf",
          "Idempotency-Key": "synthetic-key",
          "If-Match": '"3"',
          "X-Forwarded-Host": "attacker.invalid",
          "X-Forwarded-Proto": "http",
          Authorization: "synthetic",
        },
      },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "CONFLICT" } });
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.has("x-internal-host")).toBe(false);
    expect(response.headers.has("server")).toBe(false);
    expect(received).toMatchObject({
      method: "PATCH",
      url: "/api/v1/customer/me/addresses?search=a%2Fb&x=1&x=2",
      body,
    });
    // Boolean comparisons keep secret-shaped values out of assertion output.
    expect(received.headers.cookie === "__Host-cksgo_launch=synthetic").toBe(
      true,
    );
    expect(received.headers["x-cks-csrf"] === "synthetic-csrf").toBe(true);
    expect(received.headers).toMatchObject({
      origin,
      host: new URL(upstream).host,
      accept: "application/json",
      "content-type": "application/json",
      "idempotency-key": "synthetic-key",
      "if-match": '"3"',
    });
    for (const header of [
      "authorization",
      "x-forwarded-host",
      "x-forwarded-proto",
    ])
      expect(received.headers[header]).toBeUndefined();
  });

  it("forwards catalogue assignment context to the fixed upstream", async () => {
    let received;
    const { origin } = await setup((req, res) => {
      received = req.headers["x-cks-assignment-context"];
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
    const assignmentContext = "A".repeat(43);
    const response = await fetch(
      `${origin}/api/v1/customer/outlets/11111111-1111-4111-8111-111111111111/products?page=1&pageSize=24`,
      {
        headers: { "X-CKS-Assignment-Context": assignmentContext },
      },
    );
    expect(response.status).toBe(200);
    expect(received).toBe(assignmentContext);
  });

  it.each([
    ["POST", "/api/v1/checkout/quote", "small-order-fee-v1"],
    [
      "GET",
      "/api/v1/customer/orders/11111111-1111-4111-8111-111111111111",
      "small-order-fee-v1",
    ],
    ["GET", "/api/v1/customer/orders?page=1&pageSize=25", undefined],
    [
      "GET",
      "/api/v1/customer/orders/11111111-1111-4111-8111-111111111111/documents",
      undefined,
    ],
    [
      "GET",
      "/api/v1/orders/11111111-1111-4111-8111-111111111111/receipt/download",
      undefined,
    ],
    [
      "GET",
      "/api/v1/orders/11111111-1111-4111-8111-111111111111/payment-receipt/download",
      undefined,
    ],
    ["GET", "/api/v1/checkout/quote", undefined],
    [
      "POST",
      "/api/v1/customer/orders/11111111-1111-4111-8111-111111111111",
      undefined,
    ],
    ["GET", "/api/v1/customer/orders/not-a-uuid", undefined],
    [
      "GET",
      "/api/v1/customer/orders/11111111-1111-1111-8111-111111111111",
      undefined,
    ],
  ])("scopes the fee contract for %s %s", async (method, path, expected) => {
    let received;
    const { origin } = await setup(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      received = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
    });
    const body = method === "POST" ? '{"items":[]}' : undefined;
    const response = await fetch(origin + path, {
      method,
      body,
      headers: {
        Accept: "application/json",
        Cookie: "__Host-cksgo_launch=synthetic",
        "X-CKS-Fee-Contract": "small-order-fee-v1",
        "x-cks-csrf": "synthetic-csrf",
        "Idempotency-Key": "synthetic-key",
        Authorization: "synthetic",
        "X-Forwarded-Host": "attacker.invalid",
      },
    });
    expect(response.status).toBe(200);
    await response.text();
    expect(received).toMatchObject({ method, url: path, body: body ?? "" });
    expect(received.headers["x-cks-fee-contract"]).toBe(expected);
    expect(received.headers.cookie === "__Host-cksgo_launch=synthetic").toBe(
      true,
    );
    expect(received.headers["x-cks-csrf"] === "synthetic-csrf").toBe(true);
    expect(received.headers["idempotency-key"]).toBe("synthetic-key");
    expect(received.headers.authorization).toBeUndefined();
    expect(received.headers["x-forwarded-host"]).toBeUndefined();
  });

  it("returns multiple Set-Cookie headers byte-for-byte, including launch security and deletion", async () => {
    const cookies = [
      "__Host-cksgo_launch=synthetic; HttpOnly; Secure; SameSite=Lax; Path=/",
      "__Host-cksgo_session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/",
    ];
    const { origin } = await setup((_req, res) => {
      res.writeHead(200, { "set-cookie": cookies });
      res.end("{}");
    });
    const response = await fetch(
      `${origin}/api/v1/customer/session/bootstrap`,
      { method: "POST" },
    );
    expect(
      JSON.stringify(response.headers.getSetCookie()) ===
        JSON.stringify(cookies),
    ).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("cannot select a destination using query, Host, forwarding headers or path URLs", async () => {
    let calls = 0;
    const { origin } = await setup((_req, res) => {
      calls++;
      res.end("fixed upstream");
    });
    for (const path of [
      "/api/http://attacker.invalid/x",
      "/api//attacker.invalid/x",
      "/api/v1/x?url=https://attacker.invalid&target=https://attacker.invalid",
    ]) {
      expect(
        (
          await raw(origin, path, {
            Host: "attacker.invalid",
            "X-Forwarded-Host": "attacker.invalid",
          })
        ).body,
      ).toBe("fixed upstream");
    }
    expect(calls).toBe(3);
    expect((await raw(origin, "http://attacker.invalid/api/v1/x")).status).toBe(
      400,
    );
    expect((await raw(origin, "//attacker.invalid/api/v1/x")).status).toBe(400);
    expect(calls).toBe(3);
  });

  it.each([
    undefined,
    "",
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://example.com/base",
    "https://example.com?target=x",
    "https://example.com#x",
  ])("fails closed on invalid server target (%#)", (target) => {
    expect(() =>
      createCustomerServer({ target, distDirectory: directory }),
    ).toThrow("CKS_GO_API_PROXY_TARGET");
  });

  it("rejects upstream redirects without leaking Location or following them", async () => {
    let calls = 0;
    const { origin } = await setup((_req, res) => {
      calls++;
      res.writeHead(302, { location: "https://attacker.invalid/api" });
      res.end();
    });
    const response = await fetch(`${origin}/api/v1/x`, { redirect: "manual" });
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
    expect(calls).toBe(1);
  });

  it("returns a bounded safe 504 without logging request data", async () => {
    const logs = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "warn"),
    ];
    const { origin } = await setup(() => {}, 60);
    const start = Date.now();
    const response = await fetch(`${origin}/api/v1/x`, {
      method: "POST",
      body: "synthetic-body",
      headers: {
        Cookie: "synthetic",
        Authorization: "synthetic",
        "x-cks-csrf": "synthetic",
      },
    });
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({
      error: {
        code: "CUSTOMER_API_TIMEOUT",
        message: "Customer API is temporarily unavailable.",
      },
    });
    expect(Date.now() - start).toBeLessThan(1500);
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });

  it("terminates a stalled response after headers within the full deadline", async () => {
    const { origin } = await setup((_req, res) => {
      res.writeHead(200);
      res.write("partial");
    }, 60);
    const response = await fetch(`${origin}/api/v1/x`);
    const start = Date.now();
    await expect(response.text()).rejects.toThrow();
    expect(Date.now() - start).toBeLessThan(1500);
  });

  it("returns a safe 502 on upstream socket failure", async () => {
    const { origin } = await setup((req) => req.socket.destroy());
    const response = await fetch(`${origin}/api/v1/x`);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "CUSTOMER_API_UNAVAILABLE",
        message: "Customer API is temporarily unavailable.",
      },
    });
  });

  it("serves the SPA and assets outside /api without forwarding those routes", async () => {
    let calls = 0;
    const { origin } = await setup((_req, res) => {
      calls++;
      res.end("api");
    });
    for (const path of ["/", "/orders/fixture", "/apiary"]) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Customer web");
    }
    const asset = await fetch(`${origin}/assets/app.js`);
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(await asset.text()).toBe("window.customer = true;");
    expect((await fetch(`${origin}/assets/missing.js`)).status).toBe(404);
    expect((await fetch(`${origin}/orders`, { method: "POST" })).status).toBe(
      405,
    );
    expect(calls).toBe(0);
  });

  it.each([
    "/%2e%2e/package.json",
    "/assets/%2e%2e/%2e%2e/package.json",
    "/%5c..%5cpackage.json",
    "/.env",
    "/%zz",
  ])("rejects unsafe static path %s", async (path) => {
    const { origin } = await setup((_req, res) => res.end());
    expect([400, 404]).toContain((await raw(origin, path)).status);
  });
});
