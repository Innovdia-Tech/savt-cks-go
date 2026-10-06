# SMALL-ORDER-FEE01-FE local checkpoint

7 October 2026, Asia/Singapore. Customer repository only; no publication.

## Baseline and authority

- Repository: Innovdia-Tech/savt-cks-go.
- Checkout: `C:/Users/isaac/Documents/ChatGPT/CKS GO/exports/fe-final01/savt-cks-go`.
- Starting branch: `qualification/fe-final01`, clean tracked/index status.
- Starting HEAD: `30e027ba403e2f81e7baf8f65c1d64aef405812f`.
- Local correction branch: `codex/small-order-fee01-fe`. The single commit containing
  this report is the frontend checkpoint; its full SHA is returned with the handoff.
- No equivalent unpublished correction was found in the local refs/worktree.
  No overlapping source edits existed. Qualification was preserved at the starting SHA.
- Compatible backend: `5f73579305096680febaf5fc4f5c2bd3ba778c3e`, at
  `C:/Users/isaac/.codex/worktrees/small-order-fee01/cks-go-m05b-clean`.
  HEAD and clean tracked/index status were independently checked before/after
  the bounded quote check. That worktree was read-only throughout this task.
- Governing change: approved `CKS_GO_SMALL_ORDER_FEE01_CODEX_TASK.md`, customer
  section, and the pinned backend `docs/handoffs/small-order-fee01/CONTRACT.md`.
  Existing DESIGN.md and UX-CONTRACT.md govern the unchanged visual system and
  checkout/native-return/receipt safeguards.

## Implemented behavior

The closed processing-fee union accepts legacy percentage/fixed rules (including
minimum absence/null/zero and frozen safe-integer money) and SMALL_ORDER_TIERS.
New evidence enforces exact keys, safe integer net eligibility, Int32 tier bounds,
matched inclusive/exclusive range, frozen charge equality, valid outcome/enable
combinations and a consistent fee-free point. Legacy fixed minima still reject
non-null values. The shared exact() and existing quote envelope, identity, token,
line arithmetic, total, currency and timing checks remain intact.

Quote and order-detail requests advertise `X-CKS-Fee-Contract: small-order-fee-v1`.
The same-origin web proxy explicitly forwards it. Order detail admits only the
documented optional frozen money.processingFee evidence; old exact order detail
and order list shapes remain supported. Upgrade/missing/corrupt configuration
conflicts remain non-paying errors, retain the basket and use safe recovery copy.

The existing Order summary displays one backend-supplied processingFeeMinor after
Delivery fee and before Total. New-policy quotes/orders use Small order processing
fee; legacy/historical quotes/orders retain Processing fee. Discounts are negative,
with the server's Items total after discounts shown where relevant. The persistent
basis helper, enabled-zero message and explicit disabled message are shared with
order detail. Existing native disclosure supports tap and keyboard; optional
threshold marketing copy is omitted. No commercial values are hard-coded in UI.

The fee and Pay amount use the accepted quote's processingFeeMinor/grandTotalMinor.
No pricing, tiers, fee calculation, HQ fetch, new checkout step or payment button
was introduced. Before an accepted quote, there is no final fee/Total/Pay action.
The existing CKS red action, Inter typography, spacing, shell and responsive rows
are reused. Labels may wrap; money stays aligned.

## Exact fixtures and compatibility

All seven files under `src/checkout/fixtures/small-order-fee01` match the backend
handoff byte-for-byte. Their quote token is explicitly synthetic/nonfunctional.
Every file passes the real parser, the actual CartScreen summary and 390px/320px
browser acceptance. Their evidence also passes capability order-detail parsing.

| Fixture                   | Fee (MYR) | Total (MYR) | Label                      |
| ------------------------- | --------: | ----------: | -------------------------- |
| legacy-percentage         |      0.45 |       15.45 | Processing fee             |
| legacy-percentage-minimum |      2.00 |       17.00 | Processing fee             |
| legacy-fixed              |      1.25 |       16.25 | Processing fee             |
| small-charged             |      3.00 |       18.00 | Small order processing fee |
| small-no-match            |      0.00 |       25.00 | Small order processing fee |
| small-zero-tier           |      0.00 |       15.00 | Small order processing fee |
| small-disabled            |      0.00 |       15.00 | Small order processing fee |

Boundary coverage accepts frozen 999/1000/1001/1999/2000/2001-cent responses.
Invalid bounds, fractions, negative/overflow values, unknown/private fields,
impossible outcomes, wrong eligibility and charge/total/identity/token mismatches
fail closed. Existing malformed legacy response coverage remains active.

The deployed/pinned old client at 30e027 accepts the three legacy payloads and
rejects the new variant. Adding optional fields is therefore not rollout proof.
The pinned backend's capability fence returns HTTP 409
CHECKOUT_FEE_CONTRACT_UPGRADE_REQUIRED to a cached old client for both a fresh
new-policy quote and a new-response replay. No cheaper legacy projection or extra
quote/payment is created. Old quote/replay/payment authority remains the backend's
frozen contract; this frontend does not reprice it.

Release order, after separate approval: publish/deploy this qualified frontend
against legacy pricing first, preserving the capability through the proxy. Qualify
the paired pinned backend and customer together before enabling new-policy emission.
Deploy backend/migrations with the upgrade fence retained; activate only after
explicit approval and remaining device/release acceptance. Cached old pages must
reopen/update; never remove the fence or downgrade pricing for them.

## Local HTTP and browser acceptance

[`small-order-fee01/local-api.json`](small-order-fee01/local-api.json) records one
bounded protocol through loopback HTTP → actual web proxy → pinned
CheckoutQuoteController/CheckoutQuoteService/serializer. The backend's existing
synthetic database, route, identity and Savt test ports were used. This is actual
backend quote code and HTTP transport, not production authentication, a PostgreSQL
acceptance run, live HQ or a provider call. The four requests cover one new quote,
two upgrade fences and one legacy quote. No payment was created.

The new response exactly matches the charged serializer fixture after only generated
ID/token sanitization: net items 1000, delivery 500, fee 300, total 1800 cents.
The real new QuoteApi accepts it; the exact vendored 30e027 parser rejects it.
Both parsers accept the subsequent legacy response. Backend HEAD/status remained
unchanged. The early runner setup error was an ESM/CommonJS Vitest alias, corrected
in the customer-only verification config; the final named check passed.

[`small-order-fee01/browser.json`](small-order-fee01/browser.json) records Chrome
154.0.8037.98 synthetic local acceptance, with actual AppShell, CartScreen,
QuoteApi, CartController, PaymentController, order parser and OrderDetailScreen.
All seven fixtures load on Basket/Checkout at 390×844 and 320×844. Charged, zero,
disabled and historical order detail retain correct labels/amounts. Screenshots
include viewport and complete summary captures in the same directory.

Browser checks verify explicit Checkout, no pre-quote total/payment action,
server fee/Total/Pay agreement, existing red payment action, enabled Pay, zero vs
disabled copy, native keyboard/tap disclosure, long product text and no horizontal
overflow. Additional cases cover legacy minimum omission, discounted eligibility,
malformed 201 evidence, all three fee conflicts, same-key network retry, address
invalidation and cart payment freeze. No page errors or payment/HQ/provider requests.
Visual review caught a missing shared button stylesheet in the synthetic harness;
it was corrected and all captures regenerated with production styles.

Physical Android/WebView, native keyboard and installed-APK acceptance remain
PENDING. The separate phone smoke last saw no ADB device. No rebuild/reinstall
was performed, and device availability was not an implementation prerequisite.

## Verification and preservation

- TDD baseline: six focused files, 27 expected failures and 133 passes before
  implementation; failures were new parsing/presentation/header boundaries.
- Focused parser/API/render/proxy gate: six files, 160 passed, zero failures/skips.
- New-policy state regressions: checkout/state.test.ts, 28 passed; covers cart
  invalidation, stale results, expiry, freeze and changed-total acceptance. Existing
  address/voucher/price/retry/payment behavior is retained in its original owners.
- Full customer gate, run once near completion:
  `node node_modules/vitest/vitest.mjs run`: 68 files, 1,134 passed, zero failed/skipped.
- `node node_modules/typescript/bin/tsc -b` and
  `node node_modules/typescript/bin/tsc -p tsconfig.runtime.json`: passed.
  Six older legacy-only field assertions were adapted for the union without
  dropping their checks; no type escape was added to the production union.
- `node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner`:
  passed, 116 transformed modules. No test fixtures/proof hooks in production assets.
- `node scripts/prove-small-order-fee.mjs`: passed. Requires existing Playwright
  runtime through NODE_PATH and the local Chrome path via CHROME_PATH.
- Dedicated joint check, using the pinned backend's installed Vitest:
  `node <backend>/node_modules/vitest/vitest.mjs run --config verification/small-order-fee.local-backend.config.mjs`:
  one file/test passed. Set SMALL_ORDER_BACKEND_ROOT to the pinned worktree.
  Its explicit `.check.ts` include keeps this backend-dependent check separate
  from the ordinary customer-only test command; it is not skipped or suppressed.
- Changed-file Prettier with the existing customer convention
  `--single-quote false --print-width 80`, `git diff --check`, strict premium UI
  audit and delta/secret-signature review: passed. Static audit has zero findings.
  The customer package has no standalone lint script or extra premium commands.
- Qualification local/cached remote refs remain at 30e027. FE-FINAL01 8149f80 and
  FE-RECEIPT01 2e6f3fe remain ancestors; original accepted receipt UX 8742978 remains.
- Production payment, webview/native recovery, document save, receipt download,
  session, catalogue, customer controllers, checkout state and order state sources
  are unchanged. Order presentation changes are confined to the fee summary.
  All adjacent native-return/receipt/payment tests pass in the full gate.
- Exact changed paths are recorded in
  [`small-order-fee01/CHANGED_FILES.txt`](small-order-fee01/CHANGED_FILES.txt).
  The local commit finishes with clean tracked/index/worktree status.

NO push, PR, CI/manual run, main merge, deployment, Railway changes, live policy
activation, backend/schema/HQ changes, real payment, provider calls, APK rebuild,
APK reinstall or Integration Pack update. Stop locally at this checkpoint.
