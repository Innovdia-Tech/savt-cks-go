import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const requestHeaders = [
  "accept",
  "content-type",
  "cookie",
  "origin",
  "x-cks-csrf",
  "x-cks-assignment-context",
  "idempotency-key",
  "if-match",
  "if-none-match",
  "accept-language",
];
const responseHeaders = [
  "content-type",
  "content-encoding",
  "content-disposition",
  "set-cookie",
  "etag",
  "last-modified",
  "retry-after",
  "www-authenticate",
];

/** @param {import('node:http').ServerResponse} res @param {number} status @param {string} code */
export function proxyError(res, status, code) {
  if (res.destroyed) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(
    JSON.stringify({
      error: { code, message: "Customer API is temporarily unavailable." },
    }),
  );
}

/**
 * Fixed upstream origin from server configuration only. Never use request URLs,
 * Host, forwarded headers, redirects or query parameters to select a destination.
 * @param {string | undefined} target
 * @param {number} [timeoutMs]
 * @returns {import('node:http').RequestListener}
 */
export function createApiProxy(target, timeoutMs = 12_000) {
  let upstream;
  try {
    upstream = new URL(target ?? "");
  } catch {
    /* safe config error below */
  }
  if (
    !upstream ||
    !["http:", "https:"].includes(upstream.protocol) ||
    upstream.username ||
    upstream.password ||
    upstream.pathname !== "/" ||
    upstream.search ||
    upstream.hash
  ) {
    throw new Error(
      "CKS_GO_API_PROXY_TARGET must be an HTTP(S) origin without credentials, path, query or fragment.",
    );
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) {
    throw new Error("Invalid proxy deadline.");
  }
  const destination = upstream;
  const send = upstream.protocol === "https:" ? httpsRequest : httpRequest;
  return (req, res) => {
    /** @type {import('node:http').OutgoingHttpHeaders} */
    const headers = {};
    for (const name of requestHeaders) {
      if (req.headers[name] !== undefined) headers[name] = req.headers[name];
    }
    // Node's request parser validates framing before this handler. Preserve the
    // validated length or explicitly reframe its decoded chunk stream: Node does
    // not infer chunked framing for methods such as DELETE, GET and OPTIONS.
    if (req.headers["content-length"] !== undefined) {
      headers["content-length"] = req.headers["content-length"];
    } else if (req.headers["transfer-encoding"] !== undefined) {
      headers["transfer-encoding"] = "chunked";
    }
    // Node generates Host; client forwarding and other hop headers stay stripped.
    const outgoing = send(destination, {
      method: req.method,
      path: req.url,
      headers,
    });
    const timer = setTimeout(() => {
      proxyError(res, 504, "CUSTOMER_API_TIMEOUT");
      outgoing.destroy();
    }, timeoutMs);
    const cleanup = () => clearTimeout(timer);
    res.once("close", () => {
      cleanup();
      outgoing.destroy();
    });
    req.once("aborted", () => {
      cleanup();
      outgoing.destroy();
    });
    req.once("error", () => outgoing.destroy());
    outgoing.once("error", () => {
      cleanup();
      proxyError(res, 502, "CUSTOMER_API_UNAVAILABLE");
    });
    outgoing.once("response", (incoming) => {
      const status = incoming.statusCode ?? 502;
      // API contracts return data, not redirects. Do not leak an internal Location
      // or let the browser leave the same-origin API boundary.
      if (status >= 300 && status < 400 && status !== 304) {
        cleanup();
        proxyError(res, 502, "CUSTOMER_API_UNAVAILABLE");
        incoming.destroy();
        return;
      }
      /** @type {import('node:http').OutgoingHttpHeaders} */
      const safeHeaders = {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      };
      for (const name of responseHeaders) {
        if (incoming.headers[name] !== undefined)
          safeHeaders[name] = incoming.headers[name];
      }
      res.writeHead(status, safeHeaders);
      incoming.once("end", cleanup);
      incoming.once("error", () => {
        cleanup();
        proxyError(res, 502, "CUSTOMER_API_UNAVAILABLE");
      });
      incoming.pipe(res);
    });
    req.pipe(outgoing);
  };
}
