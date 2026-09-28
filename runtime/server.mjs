import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { createApiProxy } from "./proxy.mjs";

/** @type {Record<string, string>} */
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/** @param {string} root @param {string} file */
const contained = (root, file) => {
  const path = relative(root, file);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

/**
 * @param {{ target?: string, distDirectory: string, timeoutMs?: number }} options
 */
export function createCustomerServer({ target, distDirectory, timeoutMs }) {
  const proxy = createApiProxy(target, timeoutMs);
  const root = resolve(distDirectory);
  const server = createServer(async (req, res) => {
    const raw = req.url ?? "/";
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
      res.writeHead(400).end();
      return;
    }
    const path = raw.split("?", 1)[0];
    if (path === "/api" || path.startsWith("/api/")) {
      proxy(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" }).end();
      return;
    }
    try {
      const decoded = decodeURIComponent(path);
      if (
        decoded.includes("\\") ||
        decoded.includes("\0") ||
        decoded
          .split("/")
          .some((part) => part.startsWith(".") || part.includes(":"))
      ) {
        res.writeHead(404).end();
        return;
      }
      let file = resolve(root, `.${decoded}`);
      if (!contained(root, file)) {
        res.writeHead(404).end();
        return;
      }
      let info = await stat(file).catch(() => undefined);
      if (!info?.isFile()) {
        if (extname(decoded) || decoded.startsWith("/assets/")) {
          res.writeHead(404).end();
          return;
        }
        file = resolve(root, "index.html");
        info = await stat(file);
      }
      // Also fence symlinks; lexical path checks alone are insufficient.
      if (!contained(await realpath(root), await realpath(file))) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": mime[extname(file)] ?? "application/octet-stream",
        "content-length": info.size,
        "cache-control": "no-cache",
        "x-content-type-options": "nosniff",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = createReadStream(file);
      stream.once("error", () => res.destroy());
      res.once("close", () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      res.writeHead(error instanceof URIError ? 400 : 404).end();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.timeout = 30_000;
  server.on("upgrade", (_req, socket) => socket.destroy());
  server.on("connect", (_req, socket) => socket.destroy());
  return server;
}
