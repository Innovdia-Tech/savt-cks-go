// Optional local browser acceptance harness. Uses an existing Playwright install
// (normal Node resolution / NODE_PATH) without adding a production dependency.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const observed = [];
const fixture = createServer((req, res) => {
  const names = (req.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim().split("=", 1)[0])
    .filter(Boolean);
  observed.push({
    path: req.url,
    method: req.method,
    origin: req.headers.origin,
    cookieNames: names,
  });
  req.resume();
  res.setHeader("content-type", "application/json");
  if (req.url === "/api/v1/customer/session/bootstrap") {
    res.setHeader(
      "set-cookie",
      "__Host-cksgo_launch=local-fixture; HttpOnly; Secure; SameSite=Lax; Path=/",
    );
    res.end(
      JSON.stringify({
        data: {
          protocolVersion: "1",
          launchRequestId: "36f34018-9c94-4b95-b4c8-608b32ae19c7",
          state: "A".repeat(43),
          codeChallenge: "B".repeat(43),
          codeChallengeMethod: "S256",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      }),
    );
  } else if (req.url === "/api/v1/customer/session/exchange") {
    res.statusCode = names.includes("__Host-cksgo_launch") ? 200 : 400;
    res.end(JSON.stringify({ cookieNames: names }));
  } else {
    res.writeHead(401).end('{"error":{"code":"CUSTOMER_SESSION_INVALID"}}');
  }
});
let runtime;
let browser;
try {
  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  runtime = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("../runtime/preview.mjs", import.meta.url)),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        CKS_GO_API_PROXY_TARGET: `http://127.0.0.1:${fixture.address().port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error("Preview startup timed out")),
      10_000,
    );
    runtime.once("error", () => {
      clearTimeout(deadline);
      reject(new Error("Preview startup failed"));
    });
    runtime.once("exit", () => {
      clearTimeout(deadline);
      reject(new Error("Preview exited before proof"));
    });
    runtime.stdout.on("data", (data) => {
      if (String(data).includes("Customer runtime listening.")) {
        clearTimeout(deadline);
        resolve();
      }
    });
    // Deliberately do not print child stderr or any request/response payload.
    runtime.stderr.resume();
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CKS_GO_TEST_BROWSER_CHANNEL
      ? { channel: process.env.CKS_GO_TEST_BROWSER_CHANNEL }
      : {}),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiOrigins = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) apiOrigins.push(url.origin);
  });
  await page.goto(origin, { waitUntil: "networkidle" });
  const result = await page.evaluate(async () => {
    const bootstrap = await fetch("/api/v1/customer/session/bootstrap", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    await bootstrap.json();
    const exchange = await fetch("/api/v1/customer/session/exchange", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return {
      bootstrapStatus: bootstrap.status,
      exchangeStatus: exchange.status,
      cookieNames: (await exchange.json()).cookieNames,
    };
  });
  assert.equal(result.bootstrapStatus, 200);
  assert.equal(result.exchangeStatus, 200);
  assert.ok(result.cookieNames.includes("__Host-cksgo_launch"));
  assert.ok(
    apiOrigins.length >= 2 && apiOrigins.every((value) => value === origin),
  );
  assert.ok(
    observed.some(
      (request) =>
        request.path === "/api/v1/customer/session/exchange" &&
        request.method === "POST" &&
        request.origin === origin &&
        request.cookieNames.includes("__Host-cksgo_launch"),
    ),
  );
  const cookie = (await context.cookies()).find(
    (entry) => entry.name === "__Host-cksgo_launch",
  );
  assert.ok(cookie);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, "Lax");
  assert.equal(cookie.path, "/");
  assert.equal(cookie.domain, "127.0.0.1");
  console.log(
    JSON.stringify({
      result: "PASS",
      browser: await browser.version(),
      bootstrapStatus: 200,
      exchangeStatus: 200,
      cookieNames: ["__Host-cksgo_launch"],
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      sameOriginRequests: true,
      browserOriginPreserved: true,
    }),
  );
} finally {
  await browser?.close();
  if (runtime && runtime.exitCode === null) {
    const stopped = once(runtime, "exit");
    runtime.kill();
    await stopped;
  }
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
}
