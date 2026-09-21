# SAVT CKS GO Mobile Prototype

React + TypeScript + TailwindCSS customer-web foundation for the CKS GO grocery delivery module inside the SAVT super app.

## What is included

- CKS GO Home
- Category / Product Listing
- Product Detail
- Assigned-outlet cart backed by real catalogue product identities
- Server-authoritative trusted checkout quotes
- Backend-owned payment initiation and observational payment results
- Strict customer-session bootstrap, native handoff, exchange, restoration and logout
- Explicit loading, offline, expired-session, bridge-unavailable and error states

Catalogue, saved addresses, cart, trusted checkout quotes and customer payment/result calls use their real customer-web contracts. Provider communication and paid Order materialization remain backend-owned; order history, tracking and receipts are intentionally not connected. The retained mock prototype cannot be reached from the exported real catalogue/cart flow.

## Business rules represented

- Users are already logged into SAVT.
- An outlet is assigned automatically from the active saved delivery address.
- One assigned outlet owns a cart; products are never remapped across outlets.
- A different-outlet address change clears a nonempty cart only after explicit confirmation.
- Prices, stock, fees and timing become authoritative only after an explicit trusted-quote request.
- Returning from external payment is navigation only; only backend `PAID` plus Order evidence confirms an order.

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

The synthetic API session is held in memory, contains no Savt member identity or credential, and both development adapters are rejected by production builds. The switches are independent so the native bridge fail-closed state can be tested locally. Without the bridge switch, the app requires the `SavtCksGoBridge` WebView channel. Without the API switch, it uses same-origin `/api/v1/customer/session` endpoints unless `VITE_CUSTOMER_API_ORIGIN` names a validated HTTPS origin.

If npm is blocked by a local certificate error such as `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, fix the machine's npm certificate configuration or explicitly approve a temporary project-scoped install workaround before running the commands above.

## Verification

Customer-session API operations have a 15-second deadline covering fetch and successful/error JSON body parsing, including logout handling. Deadline expiry is retryable (`REQUEST_TIMEOUT`); ordinary network rejection remains offline (`NETWORK_ERROR`).

Run `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build`.

`format:check` is a **changed-file formatting gate**, not a whole-repository Prettier-clean claim. It checks supported added/copied/modified/renamed files in `FORMAT_BASE_REF...HEAD`, defaulting to `origin/main`. Commit local additions before relying on this HEAD-based gate; uncommitted files are not included. It uses only the installed Prettier and never rewrites files.

CI runs on pull requests targeting `main` and manual dispatch, using Node.js 24 and the exact PR base SHA (or `origin/main` for manual runs). It cancels superseded runs and performs the commands above, with no deployment.

Pre-existing formatting debt remains. Only `src/App.tsx` and `src/components/Layout.tsx` are temporarily excluded for their previously reviewed narrow logout integration. The 12 other legacy files identified during review remain untouched and are outside this PR's changed-file set, not ignored. A dedicated future formatting package should remove the two exclusions.

## Customer profile and saved addresses (CUST01B)

The delivery-address header opens **Profile & addresses**. Profile and saved-address data now use `/api/v1/customer/me` and `/api/v1/customer/me/addresses`; create, PATCH edit, default, deactivate and reactivate follow the current CKS Go DTOs. Checkout chooses an active saved address and keeps that choice in memory. CUST02C uses that selection for the assigned-outlet cart and trusted quote; payment, tracking and receipts remain unavailable.

The contract authority reviewed locally was the CKS integration checkout at `bac1f2f`: `customer.dtos.ts`, `customer.controller.ts`, `customer-address.service.ts` and the customer session/identity guards. No backend contracts were changed.

The same explicit development API/bridge flags also enable synthetic customer data and backend-observational payment states. On the profile screen, **Synthetic development scenarios** supplies empty/default/mixed, stale/failed sync and read-only fixtures, plus next-request conflict, offline, retryable, lost-response, expiry and CSRF failures. The catalogue fixture panel supplies payment PENDING, PAID_PROCESSING, PAID, FAILED and malformed paid-without-Order states. These controls and fixtures cannot activate in a production build. Refresh resets synthetic fixtures; logout clears application profile/address/selection/draft/operation state. All fixture values are invented.

Mutations use in-memory CSRF through a session infrastructure callback. Create/transition operations hold an immutable request body, original quoted row version and UUIDv4 idempotency key for retries. Changed requests create new operations. Edits use PATCH with quoted If-Match and no idempotency header, as the backend specifies. After successful mutation, the client reloads the full address list to obtain versions changed by default reassignment. A failed list refresh never repeats a successful mutation. Conflicts require explicit reload and discard of the open form. An uncertain submission is locked to retrying its original operation.

`premium-ui.json` scopes the supplemental static design audit to customer/address, catalogue and checkout modules. The audit is supplemental to tests, TypeScript, production build and browser acceptance.

## Cart and trusted quote (CUST02C)

The memory-only cart stores its assigned outlet, exact outlet-product identity, product display snapshot, quantity and current displayed MYR price. It merges only the same `outletProductId`, enforces the backend line/quantity bounds and invalidates a quote after any cart or same-outlet address change.

The only commercial request is an explicit `POST /api/v1/checkout/quote`. Its body contains authoritative identifiers, quantities and delivery type; CSRF and a stable UUIDv4 idempotency key are headers. No displayed prices or client-calculated totals, distance, fees or ETA are sent. Returned lines, totals, currency, timing and expiry are parsed strictly. Changed prices require customer review and expired quotes require deliberate requote.

Assignment context, CSRF, quote token and credentials stay in memory and out of URLs, browser storage, logs and visible UI. The real-cart route cannot reach the retained mock success/tracking implementation.

## Payment initiation and result (CUST03A)

The customer web calls only CKS Go's `POST /api/v1/customer/checkout/payments` and `GET /api/v1/customer/checkout/payments/:paymentIntentId`. It never calls Savt Payment, GKash or another gateway and never creates an Order. The backend owns provider communication, authenticated finality and paid Order materialization.

An accepted quote is frozen before the explicit payment action. Uncertain initiation retries retain the same UUIDv4 idempotency key; successful initiation stores one PaymentIntent and a strictly validated HTTPS checkout URL in memory. Production requests external navigation through the small native `payment-handoff` bridge message and fails closed when that capability is absent.

External return, focus and visibility trigger backend observation only. PENDING, FAILED and PAID_PROCESSING remain non-confirming. The customer sees “Order Confirmed” only for PAID with strict backend-projected Order identity. Logout/session loss clears payment memory and fences late asynchronous completion. Receipt, history and tracking remain out of scope.
