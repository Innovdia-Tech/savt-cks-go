# SAVT CKS GO Mobile Prototype

React + TypeScript + TailwindCSS customer-web foundation for the CKS GO grocery delivery module inside the SAVT super app.

## What is included

- CKS GO Home
- Category / Product Listing
- Product Detail
- Assigned-outlet cart backed by real catalogue product identities
- Server-authoritative trusted checkout quotes
- Backend-owned payment initiation and observational payment results
- Customer order history, detail, backend-projected tracking, receipt download and optional WhatsApp help
- Strict customer-session bootstrap, native or browser OTP authorization, shared exchange, restoration and logout
- Explicit loading, offline, expired-session, pilot-denied and error states

Catalogue, saved addresses, cart, trusted checkout quotes, payment results and customer orders use their real customer-web contracts. Provider communication, paid Order materialization and fulfilment authority remain backend-owned. The retained mock prototype cannot be reached from the exported real catalogue/cart flow.

## Business rules represented

- Embedded users arrive through Savt's trusted native handoff; standalone browser users prove their Savt mobile with a one-time code before the same CKS Go session exchange.
- An outlet is assigned automatically from the active saved delivery address.
- One assigned outlet owns a cart; products are never remapped across outlets.
- A different-outlet address change clears a nonempty cart only after explicit confirmation.
- Prices, stock, fees and timing become authoritative only after an explicit trusted-quote request.
- Returning from external payment is navigation only; only backend `PAID` plus Order evidence confirms an order.
- History and tracking display only customer-safe backend projections; the browser never creates Orders or derives fulfilment state.
- Once payment is confirmed and an Order is created, customers can view and track it but cannot edit or cancel it in the app. Receipt availability and historical cancellation/refund information remain backend-projected.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL on desktop or phone.

For an explicit local-only synthetic session, copy `.env.example` to `.env.local` and set:

```text
VITE_CKS_GO_DEVELOPMENT_API=true
VITE_CKS_GO_DEVELOPMENT_BRIDGE=true
```

The synthetic API session is held in memory, contains no Savt member identity or credential, and both development adapters are rejected by production builds. The switches are independent so the native bridge fail-closed state can be tested locally. With no `SavtCksGoBridge` WebView channel, the customer web uses the standalone mobile and OTP entry. The development API accepts the synthetic OTP `123456` only when its development switch is enabled. Without the API switch, the app uses same-origin `/api/v1/customer/session` endpoints unless `VITE_CUSTOMER_API_ORIGIN` names a validated HTTPS origin.

Optional public support setting: `VITE_CKS_GO_SUPPORT_WHATSAPP=`. It defaults to empty. Configure an approved E.164-style international number with a leading `+`; missing or invalid values leave WhatsApp help inactive without blocking startup. The app constructs an HTTPS `wa.me` link with only the displayed Order number in the prefilled enquiry. Support activation remains pending until an approved number is configured and native external-opening behavior is accepted in Flutter.

If npm is blocked by a local certificate error such as `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, fix the machine's npm certificate configuration or explicitly approve a temporary project-scoped install workaround before running the commands above.

## Verification

### Same-origin customer API runtime (CKS-MEMBER-E2E04)

Deployable builds require `VITE_CUSTOMER_API_ORIGIN` to be empty or unset. The API client still supports an explicit origin for development, and its empty-origin behavior remains relative `/api/v1/...`. A build with a nonempty browser API origin fails instead of silently retaining cross-site traffic.

`npm run preview` now runs a small Node static + reverse-proxy server with no runtime dependencies beyond Node (use the project's Node 24 baseline). It serves `dist` and forwards `/api` and `/api/*` to the fixed server-only `CKS_GO_API_PROXY_TARGET` origin. This replaces Vite preview because [Vite documents preview as a local preview tool, not a production server](https://vite.dev/guide/static-deploy). The existing runtime command remains compatible:

```bash
npm run build
CKS_GO_API_PROXY_TARGET=https://cks-api.example.com npm run preview -- --host 0.0.0.0 --port "$PORT"
```

The target must be an HTTP(S) origin without credentials, path, query or fragment. HTTP permits private service networking and local fixtures; use HTTPS for a public upstream. Supply this variable in the server process environment; the runtime does not load Vite `.env` files. A missing or invalid target prevents startup. `--port` takes precedence over `PORT`, then defaults to 4173; host defaults to loopback. Hosting TLS terminates in front of the runtime. No Railway configuration is changed by this local patch; a later authorized rollout must clear the old browser-origin build variable, set the server target, rebuild and restart.

Browser-visible requests stay on the customer web origin. The proxy preserves method, raw body/query, Content-Type, Accept, Cookie, browser Origin, `x-cks-csrf`, `Idempotency-Key` and `If-Match`. It forwards each Set-Cookie unchanged: no Domain rewriting, no JavaScript cookie access, no change to HttpOnly, Secure, SameSite=Lax, Path=/ or the `__Host-` prefix. Backend Origin validation and CSRF enforcement remain authoritative.

Request and response headers are allowlisted. Client Authorization/forwarding headers and upstream infrastructure headers are not propagated. API responses are `no-store`. API redirects fail with safe 502 rather than leaking an upstream Location or following another destination. The runtime logs startup status only, never request URLs, bodies, cookies, Authorization or CSRF. A fixed 12-second deadline covers the entire upstream response: failures return a generic 502, deadline expiry returns 504, and an already-started partial response is terminated. There are no automatic mutation retries. WebSocket/CONNECT tunneling is unsupported.

Focused proof: `npm run test:proxy` exercises the real HTTP runtime against local fixture APIs, plus the relative API client and production build configuration. After building, run `npm run test:proxy:browser` with an existing Playwright installation available through Node module resolution (or `NODE_PATH`). Set `CKS_GO_TEST_BROWSER_CHANNEL=msedge` to use installed Edge, or omit it for Playwright Chromium. This optional acceptance harness starts the actual preview entrypoint and a local fixture, proves bootstrap stores the secure HttpOnly launch cookie and exchange sends its name through the same-origin runtime, and closes its processes. It prints only statuses, cookie names and security flags. Loopback is a browser-trusted context for this local Secure-cookie proof; production still requires HTTPS. This proves the proxy/browser boundary, not the native Savt handoff or a production WebView rollout.

Customer-session API operations have a 15-second deadline covering fetch and successful/error JSON body parsing, including logout handling. Deadline expiry is retryable (`REQUEST_TIMEOUT`); ordinary network rejection remains offline (`NETWORK_ERROR`).

Run `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build`.

`format:check` is a **changed-file formatting gate**, not a whole-repository Prettier-clean claim. It checks supported added/copied/modified/renamed files in `FORMAT_BASE_REF...HEAD`, defaulting to `origin/main`. Commit local additions before relying on this HEAD-based gate; uncommitted files are not included. It uses only the installed Prettier and never rewrites files.

CI runs on pull requests targeting `main` and manual dispatch, using Node.js 24 and the exact PR base SHA (or `origin/main` for manual runs). It cancels superseded runs and performs the commands above, with no deployment.

Pre-existing formatting debt remains. Only `src/App.tsx` and `src/components/Layout.tsx` are temporarily excluded for their previously reviewed narrow logout integration. The 12 other legacy files identified during review remain untouched and are outside this PR's changed-file set, not ignored. A dedicated future formatting package should remove the two exclusions.

## Customer profile and saved addresses (CUST01B)

The delivery-address header opens **Profile & addresses**. Profile and saved-address data now use `/api/v1/customer/me` and `/api/v1/customer/me/addresses`; create, PATCH edit, default, deactivate and reactivate follow the current CKS Go DTOs. Checkout chooses an active saved address and keeps that choice in memory. CUST02C uses that selection for the assigned-outlet cart and trusted quote; payment, tracking and receipts remain unavailable.

The contract authority reviewed locally was the CKS integration checkout at `bac1f2f`: `customer.dtos.ts`, `customer.controller.ts`, `customer-address.service.ts` and the customer session/identity guards. No backend contracts were changed.

The same explicit development API/bridge flags also enable synthetic customer data, backend-observational payment states and customer-order states. On the profile screen, **Synthetic development scenarios** supplies empty/default/mixed, stale/failed sync and read-only fixtures, plus next-request conflict, offline, retryable, lost-response, expiry and CSRF failures. The catalogue fixture panel supplies payment PENDING, PAID_PROCESSING, PAID, FAILED and malformed paid-without-Order states, plus active, empty, delivered, receipt-ready, error and malformed customer-order scenarios. These controls and fixtures cannot activate in a production build. Refresh resets synthetic fixtures; logout clears application profile/address/selection/draft/operation state. All fixture values are invented.

Mutations use in-memory CSRF through a session infrastructure callback. Create/transition operations hold an immutable request body, original quoted row version and UUIDv4 idempotency key for retries. Changed requests create new operations. Edits use PATCH with quoted If-Match and no idempotency header, as the backend specifies. After successful mutation, the client reloads the full address list to obtain versions changed by default reassignment. A failed list refresh never repeats a successful mutation. Conflicts require explicit reload and discard of the open form. An uncertain submission is locked to retrying its original operation.

`premium-ui.json` scopes the supplemental static design audit to customer/address, catalogue and checkout modules. The audit is supplemental to tests, TypeScript, production build and browser acceptance.

## Cart and trusted quote (CUST02C)

The memory-only cart stores its assigned outlet, exact outlet-product identity, product display snapshot, quantity and current displayed MYR price. It merges only the same `outletProductId`, enforces the backend line/quantity bounds and invalidates a quote after any cart or same-outlet address change.

The only commercial request is an explicit `POST /api/v1/checkout/quote`. Its body contains authoritative identifiers, quantities and delivery type; CSRF and a stable UUIDv4 idempotency key are headers. No displayed prices or client-calculated totals, distance, fees or ETA are sent. Returned lines, totals, currency, timing and expiry are parsed strictly. Changed prices require customer review and expired quotes require deliberate requote.

Assignment context, CSRF, quote token and credentials stay in memory and out of URLs, browser storage, logs and visible UI. The real-cart route cannot reach the retained mock success/tracking implementation.

## Payment initiation and result (CUST03A)

The customer web calls only CKS Go's `POST /api/v1/customer/checkout/payments` and `GET /api/v1/customer/checkout/payments/:paymentIntentId`. It never calls Savt Payment, GKash or another gateway and never creates an Order. The backend owns provider communication, authenticated finality and paid Order materialization.

An accepted quote is frozen before the explicit payment action. Uncertain initiation retries retain the same UUIDv4 idempotency key; successful initiation stores one PaymentIntent and a strictly validated HTTPS checkout URL in memory. Embedded production requests external navigation through the native `payment-handoff` bridge message. Standalone browser entry navigates to that validated HTTPS checkout URL in the browser.

External return, focus and visibility trigger backend observation only. PENDING, FAILED and PAID_PROCESSING remain non-confirming. The customer sees “Order Confirmed” only for PAID with strict backend-projected Order identity. Logout/session loss clears payment memory and fences late asynchronous completion. CUST03B adds a link from that exact confirmed state to backend-backed order detail without changing this finality rule.

## Customer order history and tracking (CUST03B)

The customer web calls CKS Go's `GET /api/v1/customer/orders` and `GET /api/v1/customer/orders/:orderId`. It uses the customer-safe receipt download path returned by the strict order-detail contract. The browser never creates or cancels an Order, invents a customer stage, derives fulfilment authority, calls a payment provider, or presents internal operational fields.

History is paginated and includes explicit loading, empty, error, expired-session and refresh states. Detail renders the backend order stage, returned milestones, customer-safe items and totals, delivery destination and refund requirement. Raw delivery state, rider data, SKU snapshots, payment-provider data and internal identifiers are not presented.

The frontend does not offer cancellation or retries even if an older backend projects `canCancel: true`; parsing keeps that field for response compatibility. Historical cancelled Orders and refund obligations remain visible. Receipt download is available only when the detail contract declares it and the exact current-order path returns a PDF. Order state and receipt blobs are not persisted. Backend cancellation enforcement is handled separately in CUST-CANCEL01-BE.

The read-only backend contract authority reviewed for CUST03B was `Innovdia-Tech/cks-go` at `9f5b779e38eea447e0bf425e0489e70107231356`. No backend code was changed.
