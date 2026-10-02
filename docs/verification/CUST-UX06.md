# CUST-UX06 local Android pilot verification

Verified locally on 2026-10-03 (+08:00). This package includes the final Home, product-detail and Orders polish and the shared SearchField double-clear repair. Payment diagnosis stopped at the physical-device boundary because no Android device was attached.

Payment lifecycle/recovery is OUT OF SCOPE for CUST-UX06 and is owned by a separate workstream. This PR makes no payment behavior changes.

Publication is limited to the existing customer-web UI changes and this verification update. Native/payment evidence below is historical context from the local checkpoint, not work requested or performed for this PR.

## Baselines and scope

| Repository   | Exact main baseline                        | Local result                                                               |
| ------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| Customer web | `2a33ab3b4bb519225c3a96517cff188d838d0570` | One local commit on `codex/cust-ux06-pilot-polish`, containing this record |
| Savt native  | `faa3642368ee45ab98db51cf1805c6d4f95222b0` | Fresh debug APK and focused tests; no source change or commit              |
| Backend      | `74ce70c5874e32ef3bcf1058bf17dc46d5df9002` | Read-only baseline inspection; no source change or commit                  |

At the original local checkpoint, no push, PR, CI, merge, production deployment or production-data mutation was performed. The publication follow-up authorizes one customer-web branch push, one PR and its normal PR CI. Payment, quote, stock, category, serviceability, address and WebView security authority remain unchanged.

## Historical payment/native evidence — separate workstream

| Required return                               | Result                                                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Latest native build compiled                  | YES, from the exact native baseline above                                                                                                     |
| Latest native build used on a physical device | NO; `adb devices -l` returned no attached devices                                                                                             |
| Payment-create request observed in this run   | NOT RETESTED                                                                                                                                  |
| Classification                                | Unclassified pending latest-device retest; no PAY-A/B/C/D/E assigned                                                                          |
| Root cause                                    | Not proven. The older reported screenshot differs from current source, test render and APK strings; installed binary identity was unavailable |
| Payment/native change required                | None proven; no speculative repair                                                                                                            |
| Native/backend files changed                  | None                                                                                                                                          |
| Latest compiled title                         | `cksGoRed` (`0xFFE52329`), Inter 18/600 in source and native test render                                                                      |
| Current native error copy                     | “Unable to open CKS Go” / “Try again”                                                                                                         |
| Old-binary conclusion                         | Presentation mismatch confirmed; stale installed binary and payment root cause remain unconfirmed                                             |

The APK kernel contains the current title identifier, error/retry strings, `payment-handoff`, `support-handoff` and `externalApplication`; the old “Unable to prepare CKS Go” string is absent. All four Inter font weights are packaged. Native tests cover the title/copy, current payment parser, validated external launcher, failed/throwing openers and host/browser-return behavior. No actual device handoff is claimed from those tests.

The existing native path remains `payment-handoff` → `CksGoPaymentHandoff.parse` → validated checkout URI → `LaunchMode.externalApplication`. URL validation and foreground/active-document trust checks were preserved. Payment is not routed inside the embedded WebView.

APK location: `C:\Users\isaac\Documents\ChatGPT\CKS go frontend\cust-help01-native\build\app\outputs\flutter-apk\app-debug.apk`.

- SHA256: `5B93107757E5D672490F2D56404121542606562F91896C8D32CE6F75E3E92159`
- Android debug, package `com.savt.flutter_savt_customer`, version 1.0.8, code 18; 197,882,951 bytes.
- Build used the established public pilot configuration; the original ignored local environment file was restored byte-for-byte.
- Detailed safe evidence and installation/retest steps: `C:\Users\isaac\Documents\ChatGPT\CKS go frontend\cust-ux06-evidence\native-diagnosis.md`.

The original physical payment-retest guidance belongs to the separate payment workstream: connect an authorized device, verify the checksum, install this APK without publishing, and record package identity and time. Follow Savt → CKS Go → product → Basket → valid quote → Pay. Observe payment-create status/code, web/native handoff and external launcher result. Record only safe boundary evidence, without tokens, cookies, quote tokens, customer data or checkout query secrets. Assign PAY-A/B/C/D/E only after that observation. No payment retest is part of this PR.

## Web behavior

- Home: Categories uses **Browse all**, preserving the all-categories destination. Featured products has no See all action. General help moved to Orders.
- Product detail: 16px horizontal inset; white media surface with 20px radius, hidden overflow and contained image; unboxed name/pack/price/description; one subtle Product details card with aligned metadata. All available fields, image association, price and Add-to-Basket/quantity behavior are preserved. Sticky purchase controls remain clear above bottom navigation.
- Orders: compact general help immediately below the header, with the existing fixed enquiry message and authoritative support configuration. Zero orders uses the existing receipt icon and centered Browse products action. One accessible 44px Refresh orders icon sits in the page header; detached refresh actions were removed from both empty and populated lists. Current/history, cards, paging and order detail remain unchanged.
- Contextual delivery, payment-error and individual-order help retain their existing owner, message and handoff.
- Product media mismatch: the user confirmed an incorrect uploaded picture and asked to ignore this diagnosis. No frontend placeholder swap, inferred record mapping or production-data correction was performed.

## SearchField repair

The shared component retains `type="search"`, `enterKeyHint="search"`, Search/Enter submission, existing debounce and composition handling, and its existing clear callback. Empty queries render no custom clear. Nonempty queries render one accessible **Clear search** button inside the input, with a transparent background, no border, a 44px target and 52px right padding. Clearing resets catalogue results and focuses the input without scrolling.

Native cancel/decoration suppression is scoped to `.ui-search-field input[type="search"]`. Both appearance properties and `display: none` are required: Windows WebKit still painted and activated its native cancel control with appearance suppression alone. A browser regression first failed when tapping that native area cleared “Apple”; it passes after hiding the native pseudo-element. DOM button counts alone did not detect the second control. No search input outside the shared component is restyled.

Touch testing also exposed that preventing `pointerdown` suppressed the WebKit click. The final focus guard prevents `mousedown` instead; touch click arrives, the clear callback runs and focus returns to the input. Browse/category search retains the same behavior and selected category.

## Mobile acceptance

All results below use local synthetic fixtures in touch-enabled mobile Chromium and WebKit. They are browser emulation, not physical Android screenshots or a device keyboard retest.

| Check                                                                                                                | 320×844 Chromium / WebKit | 390×844 Chromium / WebKit | 430×932 Chromium / WebKit |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- | ------------------------- |
| A: Home CTA/help                                                                                                     | PASS / PASS               | PASS / PASS               | PASS / PASS               |
| B: Product media, metadata and sticky purchase                                                                       | PASS / PASS               | PASS / PASS               | PASS / PASS               |
| C: Empty Orders, receipt, support, Browse and header refresh                                                         | PASS / PASS               | PASS / PASS               | PASS / PASS               |
| D: Populated Orders/current/history, one refresh                                                                     | PASS / PASS               | PASS / PASS               | PASS / PASS               |
| E: General and contextual help                                                                                       | PASS / PASS               | PASS / PASS               | PASS / PASS               |
| F: Four bottom-navigation items, no overlap                                                                          | PASS / PASS               | PASS / PASS               | PASS / PASS               |
| Search: zero/one X, native cancel suppressed, touch clear/focus, Search/Enter, composition/debounce, category parity | PASS / PASS               | PASS / PASS               | PASS / PASS               |

Every captured screen was checked for horizontal overflow. Search checks observe the real controller boundary, not a replacement controller: immediate Enter, no submission during composition, submission after composition, cancellation of pending debounce on clear and complete catalogue reset. Add-to-Basket updates the existing purchase quantity. Support checks retain the exact fixed enquiry and verify the canonical handoff.

Evidence directory: `C:\Users\isaac\Documents\ChatGPT\CKS go frontend\cust-ux06-evidence`.
`web/acceptance.json` records all six cases, with full-screen and SearchField screenshots under `web/`; `support/` holds the separate contextual support evidence; `native-visuals/` contains native test renders.

## Verification

- Before implementation, focused rendered regressions failed for the new Home/Orders/clear requirements; the browser regression failed for the detached clear placement. The later native WebKit hit-area regression also failed before its CSS correction.
- Full web suite: **61 files, 837 tests passed**, exit 0 (`web-final-tests.log`).
- Project and runtime TypeScript checks: passed. Production Vite build: passed, including a final rebuild after the native cancel CSS correction (`web-final-build.log`).
- `scripts/verify-cust-ux06.mjs`: all six mobile engine/size cases passed (`web-final-browser.log`, `web/acceptance.json`).
- Updated `scripts/prove-customer-support.mjs`: general Orders help and contextual delivery/payment/order help passed at all three sizes, including missing/invalid configuration handling.
- Native: **113 focused CKS Go tests passed**; Android debug build passed with release signing explicitly skipped. No native defect regression was invented without a reproduction.
- Strict premium UI audit: zero errors, violations, warnings or unresolved findings (`premium-audit.json`).
- Official DESIGN.md lint: exit 0, zero errors. Its 16 warnings are identical to the main baseline (existing schema aliases, unused tokens and reward-chip contrast); this package introduced no token warnings or reward styling changes (`design-baseline-lint.json`, `design-final-lint.json`).
- Independent read-only web review: no actionable findings. Runtime WebKit evidence drove the additional native-decoration correction described above.
- Changed-file Prettier and `git diff --check` passed. The repository's existing legacy formatter exclusions remain in effect.

The pnpm package-script wrapper attempted dependency-store reconciliation against the existing shared installation and stopped before running its commands. The exact installed package executables were used directly, without replacing dependencies:

```text
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
node scripts/verify-cust-ux06.mjs
node scripts/prove-customer-support.mjs
node scripts/check-changed-format.mjs
```

The browser scripts require a local development server with the existing synthetic API/bridge switches, Playwright on `NODE_PATH`, a configured WebKit browser installation, and an available Chromium executable. They reject a non-local acceptance origin and do not run a production payment or WhatsApp action.

## Final handoff

The web implementation from `a49a01c3e556caf91b96b1e718df7e4306579189` and this amended verification record form one CUST-UX06 publication commit. Native commit: **NONE**. Backend commit: **NONE**. The published head, PR link and CI run ID are returned after publication.

The prepublication check fetched origin and confirmed main remained `2a33ab3b4bb519225c3a96517cff188d838d0570`, the worktree was clean and no open PR existed. No rebase or implementation edit was required. The completed 837-test, TypeScript, production-build and mobile acceptance evidence above is retained; only the documentation formatting and diff checks are repeated for publication.

Publication: one branch push, one PR, and the existing `pull_request` CI trigger once. No CI polling, merge or deployment is authorized.

Physical-device Search keyboard acceptance remains distinct from the completed browser-emulation checks. Payment lifecycle, recovery and physical payment retest belong to the separate workstream.
