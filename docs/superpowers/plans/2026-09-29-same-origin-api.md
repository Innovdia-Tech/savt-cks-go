# Same-origin customer API implementation plan

**Goal:** Satisfy CKS-MEMBER-E2E04 by routing browser `/api/*` traffic through the customer web origin without changing the CKS session protocol.

**Authority:** User-supplied CKS-MEMBER-E2E04 request (approved architecture, security invariants, proxy requirements 1–16, tests A–J). Backend Phase 1 contract section 2 keeps customer UI in this separate Savt repository. No backend business rules change.

**Architecture:** Dependency-free Node HTTP/HTTPS reverse proxy plus static `dist` server. Keep the existing preview command's host/port interface. Use server-only `CKS_GO_API_PROXY_TARGET`, an origin-only HTTP(S) URL from trusted process configuration. Browser builds keep `VITE_CUSTOMER_API_ORIGIN` empty; reject explicit origins on production builds to prevent accidentally retaining cross-site deployment configuration. Preserve the API client's explicit-origin support.

**Constraints:** Local branch and one checkpoint only; no push, PR, CI, Railway or other repository changes. Preserve all cookie attributes, browser Origin, CSRF and conditional/idempotency headers. Never log request data. No new runtime dependencies. Implement inline; the approved request already authorizes this bounded work.

## Task 1: Runtime and regression proof

- [x] Add real HTTP fixture tests in `runtime/server.test.mjs` for A–J boundary behavior: exact raw query/body/headers, multiple unchanged cookies, fixed destination even with attacker-controlled Host/query/forwarding headers, response header filtering, safe 502/504, application fallback.
- [x] Add relative bootstrap/exchange assertions in `src/api/client.test.ts`; observe baseline tests pass and new runtime expectations fail before implementation.
- [x] Implement `createCustomerServer({ target, distDirectory, timeoutMs })` in `runtime/server.mjs`, with `createApiProxy(target, timeoutMs)` in `runtime/proxy.mjs`; `runtime/preview.mjs` reads trusted configuration and accepts `--host`/`--port`.
- [x] Wire `preview`, strict runtime type checking and focused test command in `package.json` / `tsconfig.runtime.json`. Validate production browser-origin configuration in `vite.config.js`.
- [x] Document configuration and timeout/failure behavior in `.env.example` and `README.md`.
- [x] Prove browser bootstrap → unchanged secure HttpOnly launch cookie → exchange with cookie NAME using a local fixture. No cookie values in evidence or logs.
- [x] Run format check (also explicitly check uncommitted changed files), typecheck, full tests, build, focused runtime tests, and diff checks. Review then create one local checkpoint.

## Review focus

- Absolute request targets, encoded traversal and attacker Host must never choose the upstream or escape the static directory.
- Upstream redirects must never cause browser API requests or server credentials to move to a different origin.
- Timeout must cover the full upstream response even if headers arrive and body stalls; partial streams must terminate.
- Client disconnect and upstream failures must release sockets and timers without logging secrets.
- Missing/invalid configuration fails closed; non-API routes still load assets and SPA paths.

## Execution notes

- Verified remote main at `8d26c35de877c8e13950824ed0c18c76604a280f`; inspected existing customer clones/worktrees/branches with no equivalent proxy work found.
- Managed worktree tool cannot target this separate repository (invalid reference in chat's backend repo). Created one isolated clone and branch instead; existing work preserved.
- Vite preview supports proxy configuration but its official deployment documentation says it is not a production server. Dedicated runtime avoids adding proxy hooks and custom error handling to a preview-only server.
- No persistence/domain/API-contract changes, so migrations and OpenAPI edits do not apply.

## Local verification and review record

- Focused baseline: 18 existing client/config tests passed. New runtime suite first failed because the runtime did not yet exist; production-origin guard first failed because a cross-origin build was accepted.
- Independent read-only review identified missing body framing for GET/DELETE/OPTIONS. Three regression cases reproduced HTTP 400, then passed after preserving validated Content-Length or regenerating chunked framing.
- Final client-contract inspection found safe proxy errors needed the existing envelope's message field to remain retryable. Two real-client regressions failed with INVALID_RESPONSE, then passed with generic compatible error envelopes.
- Final focused suite: 35/35 passed. Full suite: 518/518 across 42 files. Strict browser/runtime typecheck and production build passed.
- Browser proof: Edge 154.0.4258.37, actual preview entrypoint, local fixture API; bootstrap 200 and exchange 200. Only cookie NAME `__Host-cksgo_launch` reported. Browser inspection verified HttpOnly, Secure, SameSite=Lax, Path=/ and host-only domain; all browser API requests stayed same-origin and the upstream received the browser Origin.
- Formatting: explicit Prettier checks cover every supported changed/untracked file before checkpoint; the repository HEAD-based gate is also run after checkpoint. Diff and whitespace review completed.
- Review limitation: production Railway/Android behavior and backend enforcement remain outside this local proof. No remote runtime or other repository changed.
- Minor review follow-up deferred: add a dedicated client-disconnect regression; close/aborted cleanup handlers are implemented and were reviewed. No unresolved critical or important review findings.
- Dependency install reported 9 existing audit advisories (2 low, 3 moderate, 4 high); locked runtime dependency versions were not upgraded. Only development Node type definitions were added.
- Keep one local checkpoint on `codex/cks-member-e2e04-same-origin-api`; no push, PR, CI or deployment.
