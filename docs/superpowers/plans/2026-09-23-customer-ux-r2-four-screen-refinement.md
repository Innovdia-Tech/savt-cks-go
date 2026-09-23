# CKS Go Customer UX R2 Four-Screen Refinement Plan

> **Execution note:** Implement in this existing worktree and branch only. Preserve the customer API, session, bridge, quote, payment, order, pagination, and commerce contracts.

**Goal:** Refine the real customer Home, Categories, Cart, and Orders journeys, including product detail, address/review checkout, and order detail, to match the approved R2 direction without fabricating unavailable data.

**Architecture:** Keep the existing catalogue, checkout, payment, customer, and orders controllers authoritative. Reshape only their React presentation, route-memory behavior, and shared CSS. Orders remain a single complete server page; Current and History are honest visual groups within that page because the customer API has no status filter. Order progress derives only from `customerStage` and published milestones, and ETA remains explicitly unavailable because the customer projection does not provide one.

**Tech stack:** React 19, TypeScript, CSS/Tailwind layers, Vitest, Vite, browser acceptance with the local development adapter.

---

### Task 1: Lock the R2 presentation contracts in focused tests

**Files:** `src/catalogue/components.test.ts`, `src/components/Layout.test.ts`, `src/checkout/components.test.ts`, `src/payment/components.test.ts`, `src/orders/components.test.ts`

- Add failing assertions for the shared two-column card treatment, product-detail add-without-navigation behavior support, customer-facing cart/review/payment copy, Current/History page semantics, four-stage order progress, and ETA-unavailable copy.
- Run only the changed test files and confirm the new expectations fail for presentation reasons.

### Task 2: Refine Home, Categories, product detail, and navigation memory

**Files:** `src/catalogue/components.tsx`, `src/catalogue/catalogue.css`, `src/components/Layout.tsx`, `src/components/Layout.test.ts`

- Use the shared image-led two-column product card on Home and Categories, with a 320px single-column fallback.
- Add selected-category context without introducing a second taxonomy or hidden Home filter.
- Keep Add on product detail in browsing context and expose quantity controls when the item is in Cart.
- Restore the originating Home/Categories route and scroll position after product detail; make Continue shopping return to the relevant browsing route.
- Keep the R1 advertising carousel unchanged and preserve the production no-feed empty state.

### Task 3: Refine Cart, review, and payment presentation

**Files:** `src/checkout/components.tsx`, `src/checkout/checkout.css`, `src/payment/components.tsx`

- Add product imagery/fallback, unit price, quantity, line subtotal, remove, address, and assigned-outlet context.
- Rename the quote action/state to `Review order` / `Checking prices and delivery…` while preserving quote behavior.
- Present the accepted quote as checkout review, remove internal IDs, retain exact totals, fees, address, outlet, expiry, and customer timing.
- Label the ready action `Pay RM…`; retain safe pending, failure, and paid/no-order handling.

### Task 4: Refine Orders and Order detail

**Files:** `src/orders/components.tsx`, `src/orders/orders.css`

- Group every item in the loaded page into Current or History while retaining complete page controls and explicit page-scoped empty messages.
- Flag the missing server-side status-filter dependency in customer-safe copy; never claim page filtering is complete history.
- Replace the backend-oriented timeline with four customer stages derived from `customerStage` and published milestone timestamps only.
- Add stage explanations, intentional ETA-unavailable presentation, item/total/address priorities, and history-first receipt/refund treatment.

### Task 5: Verify and package visual evidence

**Files:** focused tests above, browser evidence under the task artifact directory

- Run focused tests, full adjacent tests, typecheck, build, formatting check, and premium static audit.
- Browser-check 390px, 320px, and desktop shell widths; Home/Categories/Cart/Orders connections; product back/quantity; quote review; Current/History pagination semantics; order detail; keyboard and reduced motion regressions.
- Capture matching after images, a four-screen contact sheet, journey evidence, manifest, and ZIP; keep the local preview URL available.
- Create exactly one additional local UI commit. Do not push, open a PR, run CI, merge, or deploy.
