# CKSGO-BRAND01 v1.1 combined customer-web local qualification

Authority: the user's 7 October 2026 combined customer-web qualification batch.
Attached briefs supply artwork references; they do not expand the authorized scope.

Repository: `Innovdia-Tech/savt-cks-go`, branch `qualification/fe-final01`.
Exact accepted parent: `3919f8cb928ad048ed2167553a1cb2570e3efcb1`.
Recorded remote qualification: `30e027ba403e2f81e7baf8f65c1d64aef405812f`.
Paired native reference: `c84f363aec7f8b0d2eef4142004bbb8404ae0ca1`.
This document belongs to the single combined local branding checkpoint above that parent.
The resulting HEAD and clean status are recorded in the external evidence report.

## Root cause and minimum repair

The root cause was recorded before implementation in the qualification evidence's
`PLAN-ROOT-CAUSE.md`.

| Existing source                            | Legacy mismatch                                                                                | Repair                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/styles.css`                           | Red CKS primary/hover/pressed/soft/focus values, green customer canvas, hardcoded outer canvas | Shared CKS blue action/light/ink and supporting surface/border values; preserve Savt reward and semantic colors         |
| `src/components/Layout.tsx`                | Standalone Home used a text-only CKS Go wordmark                                               | Approved white-blue logo on the light-blue header; preserve embedded header branch                                      |
| `src/components/session/SessionStatus.tsx` | Standalone entry badge and loading were text-only; loading ring used decorative pale red       | Approved colour logo and scoped CKS action/loading colors; preserve session controller and embedded loading suppression |
| Logo assets                                | Approved v1.1 masters absent                                                                   | Byte-identical SVGs, manifest, provenance and byte-preserving attributes copied from the native approved master set     |

No files under `src/checkout`, `src/orders`, `src/payment`, `src/session`,
`src/webview`, or `runtime` changed. Fee fixtures, backend contracts, totals,
Pay amounts, FE-FINAL01 recovery/finality and FE-RECEIPT01 document logic remain
identical to the accepted parent. Existing browser proof scripts only update
branding color expectations; the fee proof also accepts an external evidence
directory so its accepted historical screenshots are preserved.

## Identity and asset provenance

Manifest version: `CKSGO-BRAND01-v1.1`.
The three SVGs, manifest, `SHARED-ASSETS.md` and `.gitattributes` match the native
master export files byte for byte. Approved geometry and fills are preserved.
The existing Vite SVG URL loader and browser `<img>` render the artwork; no
rendering dependency was added.

| Asset                        | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `cks-go-logo-colour.svg`     | `3e9259474a6cd573816b8a61570dc29db1cbd018d02e863ca18b44171da13c2b` |
| `cks-go-logo-white-blue.svg` | `b1cb5424c7462b062074ee7abf5027b9e4eaf48a207cdae94a3194b944bda312` |
| `cks-go-logo-white.svg`      | `b3b4c508376ae6623db33ca43172c3d9f21efdce77a1f2f510cd95d5c2f001d7` |

Artwork CKS is `#94D2E4`; O/path 4 is `#3570BC`; G/path 5 is `#3470BC`.
Shared UI values are light `#8ECBE2`, action `#0C74B6`, hover `#09639C`,
pressed `#084F7C`, dark ink `#123D56`, canvas `#F3F8FB`, muted `#EAF2F6`,
and borders `#D9E6ED` / `#B7CBD6`. Action text remains white.
Savt reward/membership and semantic success/warning/danger values remain unchanged.

## Verification

Node `24.19.0` and the existing installed web dependencies were used.
Headless Chrome `154.0.8037.98` supplied desktop-browser mobile viewport evidence.
This is local browser evidence, not physical Android or iOS qualification.

| Check                          | Exact command or scope                                                                                                                                                                                                                                                                                                                                                  | Result                                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branding and receipt rendering | `node scripts/prove-brand01.mjs` with external evidence output; 320/390px header, loading, entry, offline error, embedded shell/loading and existing receipt fixture                                                                                                                                                                                                    | PASS: 14 cases, zero page errors, zero API/provider requests, no overflow, approved logo byte identity and contain fit                                                                     |
| SMALL-ORDER-FEE01              | `node scripts/prove-small-order-fee.mjs` with external evidence output                                                                                                                                                                                                                                                                                                  | PASS: 29 cases; legacy/new fee labels, backend totals, Pay amounts, zero/disabled cases, retries, address invalidation and material conflicts; zero page errors/provider requests          |
| Focused unit checks            | `node node_modules/vitest/vitest.mjs run src/components/Layout.test.ts src/components/session/SessionStatus.test.ts src/checkout/small-order-fee.test.ts src/checkout/components.test.ts src/orders/components.test.ts src/orders/documents.test.ts src/orders/download.test.ts src/webview/document-save.test.ts src/payment/recovery-flow.test.ts --reporter verbose` | PASS: 9 files, 182 tests                                                                                                                                                                   |
| Typecheck                      | `node node_modules/typescript/bin/tsc -b` then `node node_modules/typescript/bin/tsc -p tsconfig.runtime.json`                                                                                                                                                                                                                                                          | PASS                                                                                                                                                                                       |
| Production build               | The same two TypeScript commands, then `node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner` (the existing build script steps)                                                                                                                                                                                                       | PASS; both used SVG variants emitted                                                                                                                                                       |
| Formatting                     | `node node_modules/prettier/bin/prettier.cjs --no-config --check` on all changed supported files, honoring `.prettierignore`                                                                                                                                                                                                                                            | PASS; repository default formatting avoids inheriting the unrelated enclosing repository's configuration; existing Layout exclusion preserved; master exports exempt to retain exact bytes |
| Diff and preservation          | `git diff --check`, explicit protected-directory diff, native HEAD/status and existing APK hash                                                                                                                                                                                                                                                                         | PASS; no functional-source changes and native checkout clean                                                                                                                               |
| Paired source/visual review    | Independent read-only review of approved masters, native tokens, actual 320/390px screenshots and embedded header ownership                                                                                                                                                                                                                                             | `PAIRED_WEB_REVIEW_PASS`; no material contradictory identity                                                                                                                               |

The initial branding proof reproduced the legacy red primary token before the
repair. Local harness setup issues and one unstable loading snapshot were fixed
in test tooling; the final browser report passes. Sandbox-only loopback/worker
access denials were resolved by rerunning the same local checks outside the
sandbox. Diagnostic logs are retained separately from passing evidence.

Evidence is under the qualification directory
`../evidence/cksgo-brand01-web-combined/`: full command logs, master hashes,
`branding/browser.json`, `small-order-fee/browser.json`, and viewport screenshots.
The receipt capture uses the existing FE-RECEIPT01 local fixture and an inert
browser host; no receipt download, payment or real authentication is invoked.

## Expired-session preparation and remaining boundary

`EXPIRED_SESSION_TRIGGER_UNAVAILABLE`.

The installed native candidate has genuine expired-session boundaries:
`lib/features/cks_go/cks_go_launch_client.dart` rejects a missing Savt token or
an actual native-authorize HTTP 401; `cks_go_host_screen.dart` responds to a
real session-generation change. No documented safe trigger for these boundaries
in the installed qualification APK was found.

`integration_test/cks_go_native_test.dart` uses a separate debug fixture and
directly calls `lifecycle.changeSession`; the receipt fixture documentation
describes synthetic loopback authentication. Neither qualifies a real expired
session in the installed candidate. Logout/token replacement would mutate the
preserved Savt session, and no supported controllable expiry tool was found.
No synthetic expired-session UI was generated or claimed as acceptance.
The native expired-session gate remains pending and native final qualification
is not claimed complete.

Flutter and backend source: unchanged. APK: not rebuilt or reinstalled.
Existing APK SHA-256 remains
`85afe183dc83ea0189ee12b95d6be5979a257faf34edd47c200e5f7797035e6f`.
No Pay action, payment creation or GKash run occurred.
No push, PR, CI dispatch, merge, deployment or Integration Pack update occurred.
