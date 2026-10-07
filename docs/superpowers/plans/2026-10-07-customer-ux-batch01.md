# Customer UX batch01 implementation plan

> **For agentic workers:** Use focused TDD and independent subagents for investigation. The controller reviews changes and serializes local commits.

**Goal:** Apply four local customer-web amendments while preserving CUST-FEE01.

**Architecture:** Preserve existing scroll, customer, catalogue, session and bridge owners. Reproduce failures at their boundaries before selecting the smallest web fix. Keep native startup ownership and backend data authority intact.

**Tech stack:** React 19, TypeScript, Vite, Vitest, local Playwright browser emulation.

**Spec:** `C:/Users/isaac/.codex/attachments/73f3cc57-8b71-4e3c-aded-4eb179f9fb93/Pasted text.txt`

## Global constraints

- Continue `codex/cust-fee01-small-order-explainer` from `094a78e96851462b7c02cf147081a4642b16b2eb`.
- Preserve original base `5b4d17dd4657a64bf63263d7e02f761dafca8c2b` and completed CUST-FEE01.
- LOCAL ONLY: no push, PR, CI, merge, deployment, Railway, backend or Flutter modifications.
- Focused tests only, including the final combined regression. Do not run the broad suite, build or full typecheck gate in this checkpoint.
- No frontend location retry workaround; stop the affected subtask if evidence proves a native repair is required.
- No premature loaded handshake, unauthenticated customer UI, session cleanup bypass or native header changes.
- No advertisement rewrite or fake production fallback without a reproduced current-code defect.
- Policy UI/content/links remain deferred until the backend/HQ API.
- Browser widths 320, 390×844 and 430; physical WebView remains PENDING.

## Review focus

- Hiding a scrollbar must preserve wheel, keyboard and touch scrolling, nested modal scrolling and fixed navigation.
- Genuine location failures must remain visible; a prior checkout transition failure must not masquerade as a new address failure.
- Saved coordinates must survive change-address entry; absent coordinates must lead to normal location setup.
- Embedded pending customer reads must not reintroduce the branded full-screen loader after the authenticated loaded message.
- Advertisement failure/zero results and assignment changes must remain fail-closed without fallback artwork or stale slides.

## Task 1: Scoped scrollbar suppression

**Files:** `src/styles.css`; `verification/cust-ux-batch01/scroll-*` fixture, runner and evidence.

**Interfaces:** Existing `AppShell` owns `.app-shell__scroll`; the existing modal panel independently owns internal scrolling. Do not change these ownership relationships.

- [x] Mount actual AppShell and a real Small Order Fee summary with long synthetic content.
- [x] Run a browser assertion that the owner has `scrollbar-width: none` and no visible WebKit scrollbar; observe failure on starting code.
- [x] Add only owner-scoped cross-browser visual scrollbar suppression, preserving `overflow-y: auto`.
- [x] At 320/390/430 verify wheel, keyboard and touch deltas, navigation stability, no horizontal overflow, fee dialog scrolling and simulated safe area.
- [x] Review and commit locally as `style(customer): hide visible app scrollbar`.

## Task 2: Address first entry

**Files:** Existing customer picker/setup and location boundary modules; focused tests; `verification/cust-ux-batch01/address-*` evidence.

**Interfaces:** Actual CatalogueApp/Home navigation, customer provider, checkout transition state, current-location port and native location message/reply contract. Coordinate any catalogue integration with Task 3.

- [x] Reproduce Home→Change Address, one location click, saved-coordinate reuse and missing-coordinate setup in the actual embedded web flow with recorded shim boundaries.
- [x] Trace prior transition errors, lifecycle/StrictMode, pending/stale requests and map readiness; distinguish production behavior from development-only replay.
- [x] Add a focused regression that fails for each proven web cause, or record the exact native boundary if native repair is proven.
- [x] Implement the smallest web fix without retries or blanket error clearing; verify genuine errors and stale-response fences.
- [x] Review and commit locally as `fix(address): make first location entry reliable`, or record native follow-up evidence.

## Task 3: Embedded startup ownership

**Files:** Narrow `src/catalogue/components.tsx` startup branch, session presentation/tests as required; `verification/cust-ux-batch01/startup-*` evidence.

**Interfaces:** Existing authenticated session loaded handshake, customer profile/address phases and CatalogueApp shell/status rendering. The native bridge contract remains unchanged.

- [x] Trace document→bootstrap→session→loaded→profile/address→assignment/catalogue→Home, including read-only host code if accessible.
- [x] Reproduce the second branded loader after the unchanged authenticated loaded message using deferred real-provider reads.
- [x] Add a focused failing test for embedded pending reads; pin standalone/setup/error behavior too.
- [x] Use existing in-shell loading states when safe; do not advance the loaded handshake or hide genuine failures.
- [x] Review and commit locally as `refactor(shell): avoid duplicate embedded loading state`, or record the exact native follow-up requirement.

## Task 4: Advertisement current-code regression

**Files:** Focused catalogue advertisement integration test; `verification/cust-ux-batch01/ads-*` evidence. Production ad changes only for a reproduced defect.

**Interfaces:** `CatalogueApi`→`CatalogueController`→strict advertisement parser→CatalogueApp/HomeCarousel. Query remains `placement=HOME_HERO`.

- [x] Audit existing strict parser, all four actions, valid assignment loading and empty/error behavior.
- [x] Strengthen missing real API/controller/render coverage; verify returned HQ artwork and zero results in the shared actual-App browser harness.
- [x] Run only affected advertisement tests and preserve absence of a production fallback.
- [x] Review and commit locally as `test(home): preserve backend advertisement rendering` if tests are added.

## Final focused checkpoint

- [x] Run one combined focused selection covering fee contracts/API/UI/proxy, scrolling, address entry/location bridge, embedded startup and Home advertisements.
- [x] Check changed-file formatting and diff scope; obtain a fresh read-only review without another test run.
- [x] Commit the batch evidence; verify clean worktree, exact ancestry and local commit list.
- [x] Return requested statuses/root causes/counts, physical PENDING and all remote actions NO, then stop.
