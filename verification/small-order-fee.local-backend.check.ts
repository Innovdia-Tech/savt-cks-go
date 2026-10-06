// One bounded HTTP check using the pinned actual controller/service/serializer.
// Database, route and Savt dependencies are the backend's synthetic test ports.
// This does not qualify production auth, PostgreSQL persistence or a provider.
import { it, expect } from "vitest";
import { fixture, request } from "@small-order-backend-fixture";
import { CheckoutQuoteController } from "@small-order-backend-controller";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
import ts from "typescript";
import { QuoteApi } from "../src/checkout/api";
import { createCustomerServer } from "../runtime/server.mjs";

const backend = process.env.SMALL_ORDER_BACKEND_ROOT!;
const pinned = "5f73579305096680febaf5fc4f5c2bd3ba778c3e";
const git = (...args: string[]) =>
  execFileSync("git", ["-C", backend, `--work-tree=${backend}`, ...args], {
    encoding: "utf8",
  }).trim();
function oldParser() {
  const load = (file: string, imports: Record<string, unknown> = {}) => {
    const exports = {};
    const source = readFileSync(
      resolve(
        backend,
        `apps/api/src/test-support/consumer/savt-cks-go-30e027/${file}/contracts.ts.txt`,
      ),
      "utf8",
    );
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    runInNewContext(code, {
      exports,
      require: (name: string) => {
        if (!(name in imports)) throw new Error("Unexpected import");
        return imports[name];
      },
    });
    return exports as { parseQuote?: (body: unknown) => unknown };
  };
  return load("checkout", { "../customer/contracts": load("customer") })
    .parseQuote!;
}

it("qualifies a new-client quote and cached-old-client fence through local HTTP and the web proxy", async () => {
  expect(git("rev-parse", "HEAD")).toBe(pinned);
  expect(git("status", "--porcelain")).toBe("");
  const f = fixture();
  f.processingFee.resolveForCheckout.mockResolvedValue({
    id: "88888888-8888-4888-8888-888888888888",
    version: 4,
    enabled: true,
    feeType: "FIXED",
    rate: null,
    fixedAmountMinor: 0,
    minimumAmountMinor: null,
    policyKind: "SMALL_ORDER_TIERS",
    tiers: [
      { belowMinor: 1000, chargeMinor: 500 },
      { belowMinor: 2000, chargeMinor: 300 },
    ],
  });
  const controller = new CheckoutQuoteController(
    f.service,
    f.vouchers as never,
  );
  const received: Record<string, unknown>[] = [];
  const bodies: unknown[] = [];
  const apiServer = createServer(async (req, res) => {
    try {
      if (req.method !== "POST" || req.url !== "/api/v1/checkout/quote")
        throw new Error("Unexpected route");
      let raw = "";
      for await (const part of req) raw += part;
      const input = JSON.parse(raw);
      received.push({
        capability: req.headers["x-cks-fee-contract"] ?? null,
        csrf: Boolean(req.headers["x-cks-csrf"]),
        key: req.headers["idempotency-key"],
      });
      const body = await controller.create(
        { savtUserId: "savt-user-1" },
        input,
        req.headers["idempotency-key"] as string,
        req.headers["x-cks-fee-contract"] as string,
      );
      bodies.push(body);
      res
        .writeHead(201, { "content-type": "application/json" })
        .end(JSON.stringify(body));
    } catch (error: any) {
      res
        .writeHead(error.getStatus?.() ?? 500, {
          "content-type": "application/json",
        })
        .end(
          JSON.stringify(
            error.getResponse?.() ?? { error: { code: "LOCAL_TEST_FAILED" } },
          ),
        );
    }
  });
  await new Promise<void>((resolve) =>
    apiServer.listen(0, "127.0.0.1", resolve),
  );
  const target = `http://127.0.0.1:${(apiServer.address() as any).port}`;
  const proxy = createCustomerServer({
    target,
    distDirectory: resolve("dist"),
    timeoutMs: 10000,
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(proxy.address() as any).port}`;
  try {
    const session = {
      withCredentials: <T>(operation: (csrf: string) => Promise<T>) =>
        operation("C".repeat(43)),
    };
    const client = new QuoteApi(origin, session as never);
    const key = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const quote = await client.create(request(), key);
    expect(quote).toMatchObject({
      netItemsTotalMinor: 1000,
      finalDeliveryChargeMinor: 500,
      processingFeeMinor: 300,
      grandTotalMinor: 1800,
      processingFee: {
        feeType: "SMALL_ORDER_TIERS",
        qualifyingAmountMinor: 1000,
        outcome: "CHARGED",
      },
    });
    expect(received[0]).toMatchObject({
      capability: "small-order-fee-v1",
      csrf: true,
      key,
    });
    const sanitized = {
      data: {
        ...quote,
        quoteId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        quoteToken: "SYNTHETIC-NONFUNCTIONAL-QUOTE-TOKEN",
      },
    };
    expect(sanitized).toEqual(
      JSON.parse(
        readFileSync(
          "src/checkout/fixtures/small-order-fee01/small-charged.json",
          "utf8",
        ),
      ),
    );
    const old = oldParser();
    expect(() => old(bodies[0])).toThrow();
    for (const attemptKey of ["cccccccc-cccc-4ccc-8ccc-cccccccccccc", key]) {
      const response = await fetch(origin + "/api/v1/checkout/quote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attemptKey,
        },
        body: JSON.stringify(request()),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        error: { code: "CHECKOUT_FEE_CONTRACT_UPGRADE_REQUIRED" },
      });
    }
    expect(f.quotes).toHaveLength(1);
    f.processingFee.resolveForCheckout.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
      version: 4,
      enabled: true,
      feeType: "PERCENTAGE",
      rate: "0.0300",
      fixedAmountMinor: null,
      minimumAmountMinor: null,
    });
    const legacy = await client.create(
      request(),
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    );
    expect(legacy.processingFeeMinor).toBe(45);
    expect(() => old(bodies[1])).not.toThrow();
    expect(git("rev-parse", "HEAD")).toBe(pinned);
    expect(git("status", "--porcelain")).toBe("");
    mkdirSync("docs/verification/small-order-fee01", { recursive: true });
    writeFileSync(
      "docs/verification/small-order-fee01/local-api.json",
      JSON.stringify(
        {
          synthetic: true,
          backendHead: pinned,
          transport:
            "loopback HTTP -> actual web proxy -> pinned CheckoutQuoteController/Service/serializer; synthetic test ports",
          requests: received.length,
          smallQuotesCreated: 1,
          legacyQuotesCreated: 1,
          newClientAcceptedExactFixture: true,
          oldClientRejectsNewPayload: true,
          oldClientFreshAndReplay:
            "409 CHECKOUT_FEE_CONTRACT_UPGRADE_REQUIRED; no extra quote",
          oldAndNewClientsAcceptLegacy: true,
          money: { netItems: 1000, delivery: 500, fee: 300, total: 1800 },
          backendUnchanged: true,
          payments: 0,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  }
});
