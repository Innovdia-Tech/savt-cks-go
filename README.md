# SAVT CKS GO Mobile Prototype

React + TypeScript + TailwindCSS customer-web foundation for the CKS GO grocery delivery module inside the SAVT super app.

## What is included

- CKS GO Home
- Category / Product Listing
- Product Detail
- Cart
- Checkout
- Order Tracking
- Mock products, vouchers, rewards, cashback, cart state, and order flow
- Strict customer-session bootstrap, native handoff, exchange, restoration and logout
- Explicit loading, offline, expired-session, bridge-unavailable and error states

Catalogue, quote, payment, checkout, order tracking and receipt content remains mocked. Those real integrations are intentionally deferred to later packages.

## Business rules represented

- Users are already logged into SAVT.
- The nearest CKS branch is automatically selected.
- The UI shows `Delivering from CKS Lintas`.
- Users can change delivery address conceptually, but cannot choose a branch manually.

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

The delivery-address header opens **Profile & addresses**. Profile and saved-address data now use `/api/v1/customer/me` and `/api/v1/customer/me/addresses`; create, PATCH edit, default, deactivate and reactivate follow the current CKS Go DTOs. Checkout chooses an active saved address and keeps that choice in memory. It still uses mocked totals, delivery, payment, tracking and receipts.

The contract authority reviewed locally was the CKS integration checkout at `bac1f2f`: `customer.dtos.ts`, `customer.controller.ts`, `customer-address.service.ts` and the customer session/identity guards. No backend contracts were changed.

The same explicit development API/bridge flags also enable synthetic customer data. On the profile screen, **Synthetic development scenarios** supplies empty/default/mixed, stale/failed sync and read-only fixtures, plus next-request conflict, offline, retryable, lost-response, expiry and CSRF failures. These controls and fixtures cannot activate in a production build. Refresh resets synthetic fixtures; logout clears application profile/address/selection/draft/operation state. All fixture values are invented.

Mutations use in-memory CSRF through a session infrastructure callback. Create/transition operations hold an immutable request body, original quoted row version and UUIDv4 idempotency key for retries. Changed requests create new operations. Edits use PATCH with quoted If-Match and no idempotency header, as the backend specifies. After successful mutation, the client reloads the full address list to obtain versions changed by default reassignment. A failed list refresh never repeats a successful mutation. Conflicts require explicit reload and discard of the open form. An uncertain submission is locked to retrying its original operation.

`premium-ui.json` scopes the supplemental static design audit to the new customer/address modules. Legacy mocked action buttons and shell scrollbar styling remain outside CUST01B, consistent with the no-redesign scope. This audit is supplemental to the tests, TypeScript build and actual browser acceptance.
