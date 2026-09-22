# CKS Go Customer Figma Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the production customer design-token, primitive, and responsive app-shell foundation from the approved Figma system without changing business behavior.

**Architecture:** Keep the existing runtime token system canonical (Model B) and mirror the accepted values in `DESIGN.md`. Add a small shared primitive module, refactor the canonical live shell and catalogue presentation to consume it, and leave controller/API/state contracts untouched.

**Tech Stack:** React 19, TypeScript 5, Tailwind CSS 3, CSS custom properties, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-22-cust-figma01-design-system.md`

## Global Constraints

- Start from `b8f236904b56822cf8461ff37d9168ae417bf1a4` in `codex/cust-figma01-design-system`.
- Primary design authority is Figma file `ncty6c6YIPuFnHymP2nqos`, node `25:55`; generated code is reference only.
- Use CKS Red `#E52329` for commerce actions and active navigation; reserve Savt green for reward/savings/success meaning.
- Preserve all APIs, state machines, session/storage rules, idempotency, payment finality, order authority, request fencing, and WebView contracts.
- Do not add Account, Rating, Smart Swap, Replacement Approval, or Live Chat behavior.
- Do not add a UI framework or materially increase bundle/runtime work.
- Produce exactly one local commit; do not push, open a PR, merge, deploy, or modify backend/Flutter/Railway.

## Review Focus

- A disabled or busy commerce control must not trigger duplicate work and must remain visibly/semantically disabled.
- Unsupported Account navigation must not appear even though it exists in Figma.
- Product availability must remain the only source of Add-to-cart eligibility; presentation must not invent rewards, savings, or stock detail.
- Narrow and wide layouts must preserve the app scroller, safe-area padding, and visible bottom navigation without horizontal overflow.
- Loading/error copy must remain human-readable and must never expose backend codes.

---

### Task 1: Durable design tokens and contracts

**Files:**

- Modify: `DESIGN.md`
- Modify: `UX-CONTRACT.md`
- Modify: `premium-ui.json`
- Modify: `tailwind.config.js`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes: Figma node `25:55` plus the CKS-first brand override in the spec.
- Produces: semantic CSS variables and Tailwind aliases consumed by shared primitives and feature CSS.

- [ ] **Step 1: Update durable design documentation**

Record runtime-token ownership, exact brand/status/type/radius/spacing values, the supported navigation mapping, and the explicit Account gap in `DESIGN.md` and `UX-CONTRACT.md`.

- [ ] **Step 2: Add semantic runtime tokens**

Define CSS custom properties for CKS primary states, Savt rewards, surfaces, borders, text, status colors, typography, radii, shadows, safe areas, and overlay layers. Adapt Tailwind aliases to the same semantic roles; do not copy independent values into feature files.

- [ ] **Step 3: Verify token structure**

Run the DESIGN.md linter, TypeScript build CSS pipeline, and token/hardcoded-color searches. Expected: lint/build pass and changed shared components can consume semantic roles without new screen-local hex values.

### Task 2: Shared accessible primitives

**Files:**

- Create: `src/components/ui.tsx`
- Create: `src/components/ui.test.tsx`
- Modify: `src/components/QuantitySelector.tsx`
- Create: `src/components/QuantitySelector.test.tsx`

**Interfaces:**

- Consumes: semantic CSS/Tailwind tokens from Task 1.
- Produces: `Button`, `IconButton`, `StatusBadge`, `SearchField`, `SystemState`, `Skeleton`, `BottomSheet`, and the extended `QuantitySelector` API.

- [ ] **Step 1: Write failing primitive contract tests**

Test semantic button type/busy/disabled behavior, icon-button accessible naming, supported availability/order badge mappings, labelled search with clear control, human-readable state semantics, accessible modal labelling, and quantity min/max disabled semantics. Name the specific production break each test catches.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run src/components/ui.test.tsx src/components/QuantitySelector.test.tsx`

Expected: FAIL because the shared module/API does not yet exist.

- [ ] **Step 3: Implement the minimal primitives**

Use native semantic elements, stable busy geometry, visible focus, practical touch targets, `aria-current`/`aria-busy`/`aria-live` as applicable, and native dialog behavior for the sheet foundation. Expose only statuses already supported by catalogue/order contracts plus presentation-only promo labels already accepted by Figma.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 2 test command. Expected: all focused tests pass with no warnings.

### Task 3: Responsive shell and supported navigation

**Files:**

- Modify: `src/components/Layout.tsx`
- Create: `src/components/Layout.test.tsx`
- Modify: `src/components/Icons.tsx` only if an existing supported destination lacks a matching glyph.

**Interfaces:**

- Consumes: `IconButton` and semantic tokens from Tasks 1–2; existing `Screen` navigation callbacks.
- Produces: safe-area-aware `AppShell`, `AppHeader`, and four-destination `BottomNavigation` presentation.

- [ ] **Step 1: Write failing shell tests**

Test the navigation landmark, exactly Home/Categories/Cart/Orders, active `aria-current`, accessible cart count, absence of Account, and semantic header controls.

- [ ] **Step 2: Run focused shell tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run src/components/Layout.test.tsx`

Expected: FAIL because the current shell lacks the new semantic active/count contract.

- [ ] **Step 3: Refactor the shell presentation**

Keep the canonical app scroller and route behavior. Add fluid 390-reference containment, tablet/desktop centered framing, top/bottom safe areas, CKS active state, focus styles, and stable navigation geometry. Do not add Account or change navigation destinations.

- [ ] **Step 4: Run shell and adjacent navigation tests**

Run: `node_modules/.bin/vitest.cmd run src/components/Layout.test.tsx src/catalogue/navigation.test.ts src/customer/components.test.ts`

Expected: all pass.

### Task 4: Integrate the foundation into live catalogue and cart presentation

**Files:**

- Modify: `src/catalogue/components.tsx`
- Modify: `src/catalogue/components.test.ts`
- Modify: `src/catalogue/catalogue.css`
- Modify: `src/checkout/components.tsx`
- Modify: `src/checkout/components.test.ts`
- Modify: `src/checkout/checkout.css`
- Modify: `src/customer/customer.css`
- Modify: `src/orders/components.tsx`
- Modify: `src/orders/orders.css`

**Interfaces:**

- Consumes: shared primitives and semantic tokens from Tasks 1–3.
- Produces: CKS-first live cards/actions/states/search/quantity/order badges while retaining all existing callbacks and data authority.

- [ ] **Step 1: Add failing regression assertions**

Extend live component tests to require semantic availability/order badges, CKS-branded Add/checkout/payment/order action classes, shared state rendering that hides backend codes, and shared quantity labels/disabled bounds. Keep existing authority assertions unchanged.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run src/catalogue/components.test.ts src/checkout/components.test.ts src/payment/components.test.ts src/orders/components.test.ts`

Expected: new assertions fail while pre-existing behavior assertions remain green.

- [ ] **Step 3: Refactor presentation only**

Adapt `ProductTile`, catalogue search and status, cart quantity controls, customer buttons/forms, and order status presentation. Preserve props, event callbacks, disabled rules, strings that encode authority, and every controller/state owner.

- [ ] **Step 4: Run focused and adjacent tests**

Run the Task 4 focused command plus `src/catalogue/address-selection.test.ts`, `src/checkout/context.test.ts`, and `src/payment/context.test.ts`.

Expected: all pass.

### Task 5: Browser, accessibility, review, and final gate

**Files:**

- Create screenshots/evidence under the plan workspace only (not committed).
- Modify only files needed to resolve verified Critical/Important findings.

**Interfaces:**

- Consumes: completed foundation from Tasks 1–4.
- Produces: verified local commit and clean worktree.

- [ ] **Step 1: Run static and project gates**

Run DESIGN lint, premium strict audit, format check, full Vitest suite, TypeScript typecheck, production build, `git diff --check`, anti-pattern scans, and dependency/bundle comparison.

- [ ] **Step 2: Run real-browser acceptance**

Start the local Vite app and inspect 390×844, 430×932, 768×1024, and 1280×900. Exercise loading, empty, error, product/card, search, quantity, navigation, keyboard focus, reduced motion, and safe-area/overflow behavior. Capture screenshots in the plan workspace.

- [ ] **Step 3: Request bounded whole-diff review**

Review against the user brief, plan Review Focus, and the checklist for duplication, unsupported Figma behavior, hardcoded tokens, accessibility, behavior/API/state/WebView regressions, absolute positioning, and responsiveness. Resolve actual Critical/Important findings with RED→GREEN tests.

- [ ] **Step 4: Re-run the broad gate and commit once**

After all fixes, rerun the complete verification gate, stage the bounded diff, and create exactly one local commit: `feat(ui): add CKS Go customer Figma design system`. Confirm the worktree is clean.
