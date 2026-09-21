# CUST03B Customer Order History, Detail, Tracking, Cancellation, and Receipt

## Authority and outcome

Implement the customer continuation after CUST03A in `Innovdia-Tech/savt-cks-go` from `8ff5fbf65938b5bab4d15b0fdac7cdf88c72b0fd`. The CKS Go backend at `9f5b779e38eea447e0bf425e0489e70107231356` remains authoritative for order identity, payment finality, customer stage, fulfilment, cancellation eligibility, refund obligation, and receipt availability.

The flow is: backend-confirmed `PAID` plus a valid Order → order history → order detail → customer-safe tracking/status. The browser never creates an Order, calls a payment provider, invents status, derives fulfilment authority, or exposes operational-only fields.

## Exact backend contracts

- `GET /api/v1/customer/orders?page=<n>&pageSize=<n>` returns a closed `{ data, meta }` page of owned confirmed-paid order summaries. Page defaults are 1 and 25; bounds are page ≥ 1 and pageSize 1–100.
- `GET /api/v1/customer/orders/:orderId` accepts a UUIDv4 and no query parameters. It returns a closed `{ data }` customer detail projection.
- `POST /api/v1/customer/orders/:orderId/cancel` accepts an empty `{}` body, customer cookies, `X-CKS-CSRF`, and a stable `Idempotency-Key`. `canCancel` is a hint only; the server transactionally rechecks ownership, confirmed payment, `NEW` state, and unsupported voucher-backed cases.
- `GET /api/v1/orders/:orderId/receipt/download` is a stable customer-owned PDF endpoint guarded by the trusted Savt customer identity. It is available only after completion and asynchronous receipt issuance. The detail projection’s exact download path is treated as a capability; arbitrary returned URLs are rejected.

## Frontend architecture

Create an isolated `src/orders` module:

- `contracts.ts`: exact-key, fail-closed parsers for list/detail/cancel responses and the six customer stages.
- `api.ts`: bounded credentialed requests, safe error mapping, exact order paths, CSRF/idempotency for cancel, and bounded PDF download.
- `state.ts`: generation-fenced list/detail loading, paging, refresh, session clearing, stable cancellation retry identity, and receipt download state.
- `context.tsx`: controller subscription and provider.
- `components.tsx` / `orders.css`: responsive history, empty/loading/error states, detail, backend milestone evidence, cancellation dialog, and receipt action.

Extend the existing hash navigation with `#orders` and `#order/<uuid>`. Bottom navigation remains canonical. A CUST03A paid Order gains a “View order” action that navigates to its backend Order identity; payment finality logic remains untouched.

## Presentation and safety

Preserve the established green palette, Inter/system typography, rounded white cards, 430px shell, native buttons, visible focus, and inline status patterns. Do not redesign shared screens or alter durable visual tokens.

Display the backend `customerStage` using a fixed customer-language label. Never transform internal order or delivery states into new fulfilment claims. Tracking uses only the projected customer stage and non-null returned customer-safe timestamps. Do not render raw UUIDs, SKU codes, delivery-attempt state codes, operational reason codes, or backend error messages.

Cancellation is destructive and receives an app-owned modal confirmation whose initial focus is “Keep order.” The interface explains that cancellation creates a refund requirement and is not evidence of a completed refund. A rejected cancel remains authoritative and offers a detail refresh.

Receipt download is shown only when `receiptAvailable` is true and `downloadPath` exactly matches the owned order’s stable backend path. The PDF is fetched with cookies and downloaded through a temporary object URL; the path, credentials, and object URL are never persisted.

## State and recovery

- History covers loading, empty, list, bounded paging, refresh, malformed response, offline/timeout, and session expiry.
- Detail covers loading, not found/foreign collapse, safe retry, back to history, cancellation pending/success/rejection, and receipt pending/download failure.
- Every request is abortable and bounded to 15 seconds.
- Logout or session loss clears all order projections, pending cancellation identity, receipt blobs, and fences late completions.
- Development fixtures remain dynamically imported behind the existing DEV plus development-API gates and add only invented order examples/scenarios.

## Verification

Use TDD for parsers, API calls, controller behavior, and rendered states. Run focused tests, typecheck, the full test suite, production build, changed-file format check, `git diff --check`, strict premium UI audit, security/diff review, and browser acceptance at 390×844, 430×932, and 1280×900. Create one local checkpoint commit and leave the worktree clean. No push, PR, merge, deployment, Flutter edit, node-savt edit, or backend edit.
