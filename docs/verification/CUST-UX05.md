# CUST-UX05 local recovery verification

## Scope and baseline

Local branch: `codex/cust-ux05-home-recovery-refresh`.
Verified remote customer main at task start: `9566e7d662d48c5a977c6dadb57040b96fcfd08e` (PAY06B merge), descendant of the brief's `507c33503e5c9dc76d13be6a63eb784c04292f83`.
Local implementation checkpoint: `e65c05e97f6701abc740b2f0930716e1c38a51ec`. The category correction continues on the same branch from that clean checkpoint.
No push, PR, CI, merge, deployment, backend edit, production-data edit, native-host edit or payment-controller edit.

## Category evidence — CASE B resolved from authoritative HQ master

On 2026-10-02 the user confirmed that HQ standardized the ACTIVE Phase-1 Home categories and explicitly classified the missing shortcuts as CASE B: production categories exist under different stable codes from the frontend's previous expectations.

| Code  | Current backend name | HQ sortOrder | Approved artwork     |
| ----- | -------------------- | ------------ | -------------------- |
| `001` | Fresh Produce        | 0            | `fresh-produce.webp` |
| `002` | Household            | 1            | `household.webp`     |
| `003` | Frozen               | 2            | `frozen.webp`        |
| `004` | Beverages            | 3            | `beverages.webp`     |

The previous frontend preferred `FRESH_PRODUCE`, `HOUSEHOLD`, `FROZEN`, `BEVERAGES`; those are not the current authoritative production codes. `shopping.ts` now selects exact `001` / `002` / `003` / `004` in fixed Phase-1 order and keys approved artwork only by code. The UI continues rendering `category.name` from the backend. No name-based Home fallback, hard-coded runtime customer-facing names, Browse authority change or backend change was introduced. Development acceptance data and tests use the standardized codes; synthetic IDs remain test-only and are not claimed as production IDs.

The authoritative code/name/sortOrder evidence was supplied by the user, rather than a newly captured authenticated response. Production IDs were not supplied or invented.

### Earlier evidence and unresolved record-count difference

Pilot: https://savt-cks-go-review-production.up.railway.app/.
The authenticated rendered Home lacked shortcuts. After the existing expired-assignment retry, Browse showed these safe catalogue labels:

- Fresh Produce
- M07A category OPS-RUNTIME-02-QUAL-A1B2C3
- Household
- Frozen
- Beverages
- 001
- Snacks & Instant Food
- Household Essentials
- Personal Care

Earlier, the user reported HTTP 200, page 1, pageSize 50, total 12, hasNextPage false. Both response examples then contained placeholder entries rather than actual id/code/name values. The current user-reported HQ screen shows 9 category records. The 9-versus-12 difference remains unexplained; no reconciliation or cause is inferred.

Read-only inspection of backend commit `7a4811263c2c532f958c9813d9002c0bf1f2237f` confirms `listCategories` counts/reads ACTIVE category master rows, selects id/code/name/sortOrder, and projects exactly id/code/name independently of outlet-product presence. No backend defect was proven.

### Later catalogue-governance review — document only

The following master-data observations are recorded exactly as supplied for later review, without modification or an inferred correction:

- `FOOD / 001`
- `M07A-OPS-RUNTIME-02-QUAL-A1B2C3`
- `PILOT-SNK / Snacks & Instant Food`
- `PILOT-HOU / Household Essentials`
- `PILOT-PER / Personal Care`

## Reproductions and behavior

- Before implementation, focused notice tests failed on persistent clean-save feedback, absent transient type and missing disposal cleanup. The unsupported-state test failed on its old wording/icon.
- Clean save and successful list refresh: `✓ Address saved`, explicitly transient for 2800ms. New notice/timer replacement, full reload, session loss and disposal are covered. Failed list refresh retains exactly `Address saved. Reload the list to see the current addresses.`
- Background customer read commits profile/address evidence after both reads; existing usable screen stays ready on transport failure. Coordinator suppresses duplicate binding during that read and performs one catalogue load afterward. A valid assignment is reused; changed rowVersion and expired/stale assignment use existing authoritative assignment paths.
- Touch listener tests exercise real EventTarget dispatch: scrollTop > 0, short pulls, horizontal swipes, 68px vertical release, cancellation, multitouch, modal blocking, cleanup and duplicate prevention. Gesture policy rejects forms, pin setup, Basket, active payment/freeze, pending address transition and other routes.
- Real CartController/PaymentController integration verifies preserved Basket lines, no quote/payment requests, and retained original Basket outlet when refreshed address authority resolves elsewhere. Existing mismatch recovery receives the incompatible assignment.
- Review found and reproduced a changed-rowVersion → failed assignment refresh → different-outlet retry hole. `syncAssignment` now derives the original outlet from retained Basket lines when an incomplete binding has cleared its assignment. A retry triggers the existing mismatch state, preserving quantities and preventing quote generation. Basket arithmetic and payment logic are unchanged.
- The shell owns transient notices on Profile to avoid duplicate live regions. A compact neutral Refresh icon provides keyboard/click access to the same guarded coordinator. No-service pull education appears only where refresh is enabled.
- No-service retries backend assignment and can stay unsupported or become ready. Connectivity failure retains the prior safe state and announces a compact transient retry message.

## Local verification

Equivalent repository commands are run using the installed Node executables directly. The pnpm wrapper attempted dependency-store reconciliation when using a shared node_modules junction; direct package executables avoid changing that dependency installation.

- Checkpoint gate: `node node_modules/vitest/vitest.mjs run src/customer src/addresses src/catalogue src/components src/checkout src/payment`: 37 test files passed, 550 tests after review fixes. Includes notice, address, category pagination/code/rename, refresh integration, gesture, Layout, carousel, checkout and payment regressions.
- TypeScript project and runtime checks: passed.
- Production Vite build: passed.
- Strict premium UI audit: no findings. Machine evidence: `cust-ux05/ui-audit.json`.
- Touched-file Prettier and `git diff --check`: passed. Layout's temporary legacy exclusion was explicitly overridden for the touched file.
- Read-only review: all four findings resolved; independent failure/retry reproduction confirms Basket mismatch protection. No remaining Critical or Important findings in the reviewed fixes.

### Category correction final gate

- Before changing the mapping, seven focused assertions failed with the supplied numeric codes: Home selection/order, image identity, legacy fallback rejection, later-page Home selection and rendered shortcuts/rename. After correction the initial focused category gate passed 103 tests across 5 files.
- Final focused command: `node node_modules/vitest/vitest.mjs run src/catalogue src/customer src/addresses src/components/pull-refresh.test.ts src/components/pull-refresh-events.test.ts src/components/Layout.test.ts`: **295 tests passed across 23 files**. This includes all seven requested category regressions plus the existing refresh/address/notice, gesture, Layout and carousel coverage.
- Project and runtime TypeScript, production Vite build, strict UI audit, touched-file Prettier and `git diff --check`: passed.
- Read-only mapping review: no Critical or Important findings. Exact order, renamed labels, approved artwork, unchanged category inputs and rejection of unrelated/legacy/near codes were independently confirmed.
- Production runtime change is confined to the preferred-code list and artwork lookup in `src/catalogue/shopping.ts`. Controller/Browse authority, rendering, CSS, payment and refresh implementation remain unchanged from the checkpoint.

## Browser acceptance

Local synthetic fixtures only; production catalogue evidence is kept separate.
The browser was inspected at 320×844, 390×844 and 430×932. The delivery-unavailable screen had no document horizontal overflow, retained four bottom navigation actions, and exposed the correct decorative icon. Both CTAs opened their original flows. The clean new-address flow returned Home with Address saved; later inspection showed it gone with no banner space. A different-outlet save retained the original Basket when its existing confirmation was cancelled.

Final keyboard acceptance: pressing Enter on Refresh Home showed Refreshing… and returned Home with Basket 1 item / RM 4.50 unchanged. No-service keyboard refresh stayed unsupported; Browse exposed neither the Refresh action nor pull guidance. The new control measured 44×44px. Final no-service geometry was rechecked at all three required widths. Local screenshot: `C:\Users\isaac\.codex\visualizations\2026\10\02\01a0fb1d-3719-7f40-ac9f-c4b4cdd12ee9\cust-ux05-no-service-390.jpg`.

| Flow | Result                                      | Evidence / limitation                                                                                                                        |
| ---- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| A    | PASS                                        | Local new-address save returned Home, transient status then disappeared. Timer and rendered accessibility regressions passed.                |
| B    | FAIL — visual touch verification incomplete | Gesture event and coordinator/Basket tests pass. Browser control provides mouse dragging; a real mobile touch pull/spinner was not observed. |
| C    | FAIL — visual touch verification incomplete | Existing carousel regression and horizontal touch-listener tests pass; real mobile swipe was not observed.                                   |
| D    | PASS                                        | Copy, icon, both CTAs and navigation inspected at all three sizes.                                                                           |
| E    | FAIL — visual touch verification incomplete | No-service retry/remain/become-ready and failure preservation are proven by coordinator tests; a real mobile touch pull was not observed.    |
| F    | PASS — local category correction            | Supplied authoritative codes select all four intended shortcuts and approved artwork at all three required sizes. No deployment performed.   |

The table retains checkpoint acceptance for flows A–E and updates F following the supplied CASE B evidence. The four intended shortcuts, matching images, backend labels, Categories heading and See all action were inspected at 320×844, 390×844 and 430×932. All four images loaded, with no horizontal overflow. Artwork regions remain 64px at 320px and 68px at 390/430px; existing four-column, white rounded-tile styling was unchanged. See all opened Browse with every synthetic ACTIVE category, including Pantry outside Home's four fixed slots. Production deployment was not changed or claimed. Physical touch flows B/C/E remain pending.

Local category screenshots are saved under `C:\Users\isaac\.codex\visualizations\2026\10\02\01a0fb1d-3719-7f40-ac9f-c4b4cdd12ee9\` as `cust-ux05-home-categories-320.jpg`, `cust-ux05-home-categories-390.jpg`, and `cust-ux05-home-categories-430.jpg`.

## Files changed

The checkpoint includes the following files:

- `DESIGN.md`, `UX-CONTRACT.md`, this verification record, `docs/verification/cust-ux05/ui-audit.json`.
- Catalogue: `components.tsx`, `components.test.ts`, `context.tsx`, `state.ts`, new `refresh.ts` / `refresh.test.ts`.
- Checkout: `context.tsx`, `state.ts` (binding outlet guard only).
- Shared components: `Icons.tsx`, `Layout.tsx`, `Layout.test.ts`, `ui.tsx`, new `pull-refresh.ts` / `pull-refresh.test.ts`, `pull-refresh-events.ts` / `pull-refresh-events.test.ts`, `usePullToRefresh.ts`.
- Customer: `components.tsx`, `components.test.ts`, `context.tsx`, `state.ts`, `state.test.ts`, new `CustomerNotice.tsx` / `CustomerNotice.test.ts`.
- `src/styles.css`.

The category correction changes only `src/catalogue/shopping.ts`, the acceptance data in `src/catalogue/development.ts`, category regressions in `shopping.test.ts`, `components.test.ts`, `state.test.ts`, `seamless.test.ts`, `development.test.ts`, and the two contract/evidence documents `UX-CONTRACT.md` and this record.

## Handoff status

The verified implementation was saved in local checkpoint `e65c05e97f6701abc740b2f0930716e1c38a51ec`. The supplied authoritative codes resolve the category issue as CASE B, and this mapping correction continues on the same branch. Physical pull/swipe/recheck acceptance remains pending. No publication or production mutation occurred.
