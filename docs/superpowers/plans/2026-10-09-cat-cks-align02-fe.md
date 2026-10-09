# ALIGN02 customer delta execution plan

Goal: expose the existing server description, exact barcode and approved Category/Subcategory in product details, and browse the same assignments through a parent-scoped child directory.

Authority: the user's CAT-CKS-ALIGN02-FE instructions; pinned backend `fe89d6c620fbb6b1b811f423becd233a078072e1`, `docs/handoffs/cat-cks-align02/README.md` and its real serializer fixtures. Phase 1 v1.4 contract remains the backend boundary; customer work occurs only in Innovdia-Tech/savt-cks-go. Base: verified main `44e8098ec741cde47b5ca5074eb0b36136c0ffdc` (PR #35/#36).

Constraints: local only; no backend edits, schema/migration, new design, source-text mapping, financial/session/payment/receipt change, publication or live data. Reuse existing category chips and detail metadata CSS. Older customer checkouts have historical metadata rendering but no equivalent ALIGN02 child implementation. Native app worktree tooling targets the calling backend repository, so the customer worktree was created with Git at `exports/fe-final01/customer-cat-cks-align02`; existing worktrees were preserved.

1. [x] Tests first: actual handoff mapped/historical-null details; exact leading-zero barcode; only requested metadata; closed child parser and parent validation; API scope/header/query; ALIGN01 missing endpoint fallback; malformed successful response rejection; child selection, reset, expiry/race and navigation preservation.
2. [x] Implement minimal delta in `src/catalogue/contracts.ts`, `api.ts`, `state.ts`, `components.tsx` and existing CSS only if layout requires it. Child route is additive and unsupported 404 yields category-only browsing. No successful malformed response fallback. Optional port preserves existing development adapters.
3. [x] Run focused catalogue/navigation/proxy and adjacent checkout/session/payment/order/receipt tests, application/runtime typecheck, production build, touched formatting and diff checks. The customer repository has no `pnpm check` script; execute its existing constituent scripts instead of backend `pnpm check`.
4. [x] Bounded screen checks at 320px/390px with actual parsers and supplied fixture bytes; one pinned real Nest controller/service journey through the actual customer proxy. Explicitly identify synthetic identity/context/readiness/repository/media dependencies, reuse existing PostgreSQL import/save evidence, and do not claim full authenticated acceptance.
5. [x] Fresh read-only review, local checkpoint with path/branch/base/HEAD/changed files/tests/screens/compatibility/gaps; local commit only. Stop locally.

Review focus: nullable legacy classification; leading-zero text; renamed approved labels independent of source descriptions; wrong-parent and stale child responses; narrow 404 compatibility without weakening malformed-response rejection. These inputs belong in task 1 tests and paired evidence.

Execution notes: detail reads remain independent of a former child directory; valid empty product pages for inactive/wrong-parent pairs stay usable. Fresh read-only review found the inactive-child condition; its regression failed before the correction. Per-product parent/child validation and closed response parsing remain strict. No outstanding review findings.

Final local checkpoint manifest: `../evidence/cat-cks-align02-fe/CHECKPOINT.md`, written after the local commit to record its exact HEAD. No publication action is authorized in this run.
