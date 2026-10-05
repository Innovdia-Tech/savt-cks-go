# Checkout processing-fee response compatibility checkpoint

Local correction, 5 October 2026. Repository: Innovdia-Tech/savt-cks-go.

## Execution plan and governing requirements

1. Preserve qualification/fe-final01 at deployed base
   b3a0f05eb2527f0cc5829743f9141f8398883b90, including FE-FINAL01 and
   FE-RECEIPT01. Check existing work for an equivalent repair before editing.
2. Follow the user's bounded checkout compatibility request and CKS Go Phase 1
   implementation contract section 4: fees and payable totals remain backend
   authority. No backend, HQ, schema, settings, native or payment changes.
3. Reproduce rejection with failing parser/screen tests, then extend only quote
   processing metadata validation. Keep shared exact(), identity, quote-token,
   arithmetic, assignment and expiry validation.
4. Verify checkout/adjacent tests, real browser checkout with local HTTP 201
   responses, application/runtime typechecks, production build and final diff.
5. Make one local correction commit on qualification/fe-final01 and stop locally.

Backend references inspected read-only: PROC-FEE-MIN01 approved decision
docs/decisions/0007-processing-fee-percentage-minimum.md (lines 5-13), quote
response OpenAPI in apps/api/src/modules/checkout/checkout-quote.controller.ts
(lines 72-84), and frozen quote validation in
packages/domain/src/orders/checkout-quote.ts (lines 80-90), from the existing
proc-fee-min01r backend worktree. Settings use 0..2,147,483,647; frozen quote
money uses 0..Number.MAX_SAFE_INTEGER. This response parser validates the frozen
quote bound. Historical absence/null means no minimum; zero is valid; Fixed must
omit the field or use null, including disabled rules.

## Root cause and correction

processing() previously accepted exactly four metadata fields. A successful
HTTP 201 quote carrying minimumAmountMinor failed local parsing even for null,
so the checkout controller entered INVALID_RESPONSE instead of showing totals.

CheckoutQuote.processingFee now has optional minimumAmountMinor: number | null.
The parser conditionally includes only that field in its exact key list, checks
non-null values using the existing non-negative safe-integer money validator,
and rejects non-null Fixed minimums regardless of enabled. Explicit undefined,
fractions, negatives, non-numbers, non-finite and unsafe integers are rejected.

The only production change is src/checkout/contracts.ts. CartScreen continues
to render processingFeeMinor and grandTotalMinor directly; no client fee formula
or production UI change was introduced. Test fixtures and the verification entry
are excluded from the production entry bundle.

The canonical customer checkout was clean before editing, with local and cached
origin/qualification/fe-final01 both at the deployed base. The preserved receipt
scratch clone also matched the base. The named quote-response-contract directory
contained only an empty marker and no implementation. No equivalent fix was found
in the inspected frontend refs/checkouts. No fetch or branch replacement occurred.

## Verification

- Red: 11 valid parser/screen cases failed at processing(), reproducing the defect.
  Separate response-bound tests failed against an Int32 cap before it was replaced
  with the documented frozen-quote safe-integer bound.
- Focused checkout, payment, API, session, bridge, addresses and catalogue:
  37 files, 748 tests passed.
- Full customer-web suite: 67 files, 1,076 tests passed.
- Application and runtime TypeScript checks passed.
- Production Vite build passed: 115 modules, 2.49 seconds.
- Local Chrome browser proof at 390 x 844: all nine scenarios passed through the
  real QuoteApi, CartController and CartScreen, with synthetic HTTP 201 replies
  and no page runtime errors.

| Response                     | Processing fee shown | Total shown | Result                          |
| ---------------------------- | -------------------- | ----------- | ------------------------------- |
| Legacy field absence         | RM0.42               | RM14.32     | Ready                           |
| Null minimum                 | RM0.42               | RM14.32     | Ready                           |
| Zero minimum                 | RM0.42               | RM14.32     | Ready                           |
| RM50 basis, 3%, RM2 minimum  | RM2.00               | RM52.00     | Ready                           |
| RM100 basis, 3%, RM2 minimum | RM3.00               | RM103.00    | Ready                           |
| Supplied fee 225, total 5225 | RM2.25               | RM52.25     | Ready; no fee recalculation     |
| Negative minimum             | None                 | None        | Invalid response; retry offered |
| Fixed with zero minimum      | None                 | None        | Invalid response; retry offered |
| Malformed grand total        | None                 | None        | Invalid response; retry offered |

The supplied-fee case deliberately differs from the metadata formula to prove
that the screen displays backend amounts while retaining basis/total consistency.
Browser checks also retain identifiers/quantities-only requests, CSRF and
idempotency headers, and no visible quote token. Existing adjacent tests retain
assignment, identity, request cancellation, session and payment-recovery coverage.

Commands used the already installed project executables directly because the
bundled pnpm wrapper attempted dependency bootstrap and Windows sandbox realpath
checks blocked it. No dependencies or lockfiles were changed:

```powershell
node node_modules/vitest/vitest.mjs run src/checkout src/payment src/api src/session src/webview src/addresses src/catalogue
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
# NODE_PATH points to an existing Playwright installation; CHROME_PATH to Chrome.
node scripts/prove-checkout-processing-fee.mjs
```

Synthetic local browser evidence establishes response compatibility, not live
Android/device or deployed acceptance. No APK was rebuilt and no payment ran.

## Compatible release target

The single correction commit recorded with this checkpoint is on the existing
qualification/fe-final01 branch, directly above b3a0f05. Its parent retains
FE-FINAL01 and FE-RECEIPT01. The compatible customer-web release target is that
qualification branch including this correction, paired with the existing accepted
native FE-FINAL01/FE-RECEIPT01 source. Main is not substituted as the target.

No backend/HQ/schema change, live fee-setting change, APK rebuild, payment,
push, PR, deployment or Railway mutation occurred. The deployed SHA remains the
user-confirmed b3a0f05 until a separately authorized release.
