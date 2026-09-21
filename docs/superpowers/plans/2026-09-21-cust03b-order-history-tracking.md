# CUST03B Customer Order History and Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customer-safe order history, detail, tracking, server-authoritative cancellation, and stable receipt download without weakening CUST03A.

**Architecture:** A new `src/orders` vertical slice strictly parses the pinned backend projections and owns request/controller/presentation state. Existing CatalogueApp hash navigation hosts the two routes, while PaymentPanel only adds a link after its existing `PAID` plus valid Order gate.

**Tech Stack:** React 19, TypeScript strict mode, Vitest, Vite, CSS/Tailwind utilities.

**Spec:** `docs/superpowers/specs/2026-09-21-cust03b-order-history-tracking-design.md`

## Global Constraints

- Frontend base is exactly `8ff5fbf65938b5bab4d15b0fdac7cdf88c72b0fd`.
- Backend contract authority is read-only SHA `9f5b779e38eea447e0bf425e0489e70107231356`.
- No browser Order creation, provider calls, status invention, fulfilment derivation, operational-field exposure, credential persistence, or CUST03A finality weakening.
- No backend, Flutter, or node-savt edits; no push, PR, merge, or deployment.

## Review Focus

- Extra/missing/wrongly typed response fields must fail closed before entering UI state.
- A late response after logout, navigation, or superseding refresh must not restore customer data.
- A cancel retry after uncertain transport must reuse its UUIDv4 key and frozen `{}` request; a changed order gets a new operation.
- Receipt paths not exactly owned by the current order must be rejected and never fetched.
- `PENDING`, `FAILED`, `PAID_PROCESSING`, or malformed `PAID` payment results must never link to an order screen.

---

### Task 1: Strict order contracts and HTTP boundary

**Files:**

- Create: `src/orders/contracts.ts`
- Create: `src/orders/contracts.test.ts`
- Create: `src/orders/api.ts`
- Create: `src/orders/api.test.ts`

**Interfaces:**

- Produces: `parseOrderList`, `parseOrderDetail`, `parseCancellation`, `OrdersApi.list`, `OrdersApi.detail`, `OrdersApi.cancel`, and `OrdersApi.downloadReceipt`.

- [ ] Write parser tests with literal valid list/detail/cancel fixtures plus extra-key, internal-field, bad-stage, invalid-money, invalid-date, and mismatched receipt-path mutations.
- [ ] Run the focused test and confirm missing-module failures.
- [ ] Implement exact-key validators and customer projection types.
- [ ] Run parser tests green.
- [ ] Write API tests proving exact paths, cookies, no-store, deadline, CSRF, stable idempotency, safe error codes, PDF media type, and no Order POST/provider call.
- [ ] Run the API test and confirm the missing `OrdersApi` behavior fails.
- [ ] Implement the minimal HTTP boundary and run both files green.

### Task 2: Order lifecycle controller

**Files:**

- Create: `src/orders/state.ts`
- Create: `src/orders/state.test.ts`

**Interfaces:**

- Consumes: Task 1 `OrdersApi` results.
- Produces: `OrdersController` and immutable `OrdersState` for list/detail/paging/cancel/receipt workflows.

- [ ] Write controller tests for initial load, empty list, page navigation, detail, session expiry, malformed/error recovery, generation fencing, stable cancel retry, rejection refresh, receipt download, and dispose.
- [ ] Run focused state tests and verify the expected missing-controller failure.
- [ ] Implement the smallest generation-fenced controller and run focused tests green.

### Task 3: History/detail presentation and navigation

**Files:**

- Create: `src/orders/context.tsx`
- Create: `src/orders/components.tsx`
- Create: `src/orders/components.test.ts`
- Create: `src/orders/orders.css`
- Modify: `src/main.tsx`
- Modify: `src/catalogue/components.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/types.ts`

**Interfaces:**

- Consumes: `OrdersController`, existing AppShell, customer navigation guard, and payment state.
- Produces: `OrdersProvider`, `OrdersScreen`, `OrderDetailScreen`, `#orders`, and `#order/<uuid>`.

- [ ] Write rendered behavior tests for loading, empty, list, pagination, safe stage labels, detail evidence, cancel confirmation/focus, receipt capability, session expiry, and errors.
- [ ] Run focused component tests and verify missing components fail.
- [ ] Implement provider/components/routes with existing visual tokens and semantic controls.
- [ ] Run focused component and existing catalogue/navigation tests green.

### Task 4: CUST03A paid-order link and development acceptance fixtures

**Files:**

- Modify: `src/payment/components.tsx`
- Modify: `src/payment/components.test.ts`
- Modify: `src/checkout/components.tsx`
- Modify: `src/catalogue/development.ts`
- Modify: `src/catalogue/development-controls.tsx`
- Modify: `src/catalogue/development.test.ts`

**Interfaces:**

- Consumes: existing `PaymentPanel` paid state and development fetch adapter.
- Produces: `onViewOrder(orderId)` only after existing paid+valid-order finality; invented order list/detail/cancel/receipt fixture states.

- [ ] Add a failing PaymentPanel test proving only valid paid state renders “View order.”
- [ ] Implement the callback without changing finality decisions and run payment tests green.
- [ ] Add failing development adapter tests for order GET/detail/cancel/receipt and zero browser Order creation.
- [ ] Implement development-only fixtures and scenario controls, then run development tests green.

### Task 5: Durable context, verification, and checkpoint

**Files:**

- Modify: `DESIGN.md`
- Modify: `UX-CONTRACT.md`
- Modify: `README.md`
- Modify: `premium-ui.json`

**Interfaces:**

- Documents the `src/orders` owner and browser/security evidence.

- [ ] Update durable design/UX/runtime-owner documentation without changing tokens.
- [ ] Run focused tests, typecheck, full tests, production build, format check, strict premium audit, and `git diff --check`.
- [ ] Run browser acceptance at 390×844, 430×932, and 1280×900 across history, detail, tracking, back navigation, empty/error/session, cancel, and receipt states.
- [ ] Review the complete diff for security boundaries and accidental unrelated changes.
- [ ] Create one local checkpoint commit and verify the worktree is clean.
