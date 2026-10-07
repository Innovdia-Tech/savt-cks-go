# CKSGO-BRAND01-v1.1 clean replay on current customer main

7 October 2026, Asia/Singapore. LOCAL ONLY. No push, PR, CI dispatch, merge or deployment.

## Branch and scope

| Item                                   | Value                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| Repository                             | `Innovdia-Tech/savt-cks-go`                                                      |
| Worktree                               | `C:/Users/isaac/Documents/ChatGPT/CKS go frontend/merch-home01-clean-replay-web` |
| New branch                             | `codex/cksgo-brand01-v1-1-clean`                                                 |
| Verified remote main / new branch base | `30c7b0cd88da99e4ae4248d740f40e2e135a0b6e`                                       |
| Preserved original brand branch        | `codex/cksgo-brand01-customer`                                                   |
| Preserved original brand head          | `a43333decbbc150a111c56c0dc41b2f55b395c59`                                       |
| New brand head                         | Commit containing this report; exact SHA returned in the final handoff           |
| Master assets                          | `CKSGO-BRAND01-v1.1`                                                             |
| UI tokens                              | `CKSGO-BRAND01-tokens-v1`                                                        |

`git fetch origin` completed, but this checkout's fetch refspec covers only `qualification/fe-final01`. The remote main read matched the required SHA while the local main tracking ref was stale. `git fetch origin refs/heads/main:refs/remotes/origin/main` refreshed it explicitly, and both the fetched main and remote main were verified at the required SHA. Main did not move.

The exact requested diff `dbe097ca8cb21015e19e60a52f7c8a5684adf281..a43333decbbc150a111c56c0dc41b2f55b395c59` contains 55 files, all classified as CKSGO-BRAND01-v1.1 in [v1.1-file-classification.json](../../verification/cksgo-brand01-clean-replay/v1.1-file-classification.json): two corrected SVGs, six provenance/guidance/comment files, 41 after-evidence files, five reused baseline-evidence files and one inventory. No unrelated file is present.

The v1.1 correction depends on the preceding blue-identity foundation: current main contains MERCH-HOME01 but has no branding assets, BrandLogo component or blue tokens. The tree of current main equals the original branding prebase `c0ec4b1bcc5bd69c073ab3219eae446a2aade736` exactly: `0bd8d673f53ed89f36cbffbf7782d6c5ee7fb2d1`. Therefore the two existing branding-only commits were replayed without their unrelated ancestry:

```text
git switch -c codex/cksgo-brand01-v1-1-clean 30c7b0cd88da99e4ae4248d740f40e2e135a0b6e
git cherry-pick --no-commit dbe097ca8cb21015e19e60a52f7c8a5684adf281 a43333decbbc150a111c56c0dc41b2f55b395c59
```

No conflicts occurred and no conflict resolution was required. The staged replay tree, before adding this new verification package, equaled the accepted v1.1 tree exactly: `a7b2fe2967843acf75ac7efa4dfe73a7e04aa415`. The final source/artwork and historical evidence remain identical to that accepted head; additions for this replay are verification documentation and JSON only. No MERCH commit was replayed, no branch was reset and the original brand branch remains preserved. The single local replay checkpoint is based directly on current main.

The original v1/v1.1 reports and screenshots are retained as historical evidence. Their old cached-main, unpublished-MERCH and separate qualification references describe the earlier checkpoints, not the current replay. This report and the new inventory supersede those current-state claims. Current main is the authority for existing behavior.

## Preserved behavior and accepted branding

Protected source comparisons against main are empty for catalogue implementation excluding its approved brand CSS, customer implementation excluding its approved brand CSS, API/authentication/session, checkout, payment, Orders/receipts, bridge and main composition. This preserves advertisement requests and actions, featured products, Home reveal, category/product/external actions, native payment return, receipt handling, routing and backend contracts. Header component changes are the already-accepted standalone logo placement; embedded ownership remains unchanged and is verified by existing Layout/browser assertions.

Branding retains the exact corrected O/G fills, source geometry, full contain-fit logo, blue tokens and existing token decisions. All three SVG hashes match the accepted v1.1 manifest:

| Master                       | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `cks-go-logo-colour.svg`     | `3e9259474a6cd573816b8a61570dc29db1cbd018d02e863ca18b44171da13c2b` |
| `cks-go-logo-white-blue.svg` | `b1cb5424c7462b062074ee7abf5027b9e4eaf48a207cdae94a3194b944bda312` |
| `cks-go-logo-white.svg`      | `b3b4c508376ae6623db33ca43172c3d9f21efdce77a1f2f510cd95d5c2f001d7` |

The production-emitted colour SVG also has the exact accepted checksum. The upstream ZIP remains SHA-256 `c4eb6efcbb65e1fff6f4cb2b6b30c750c9ffa8162dbdc0204fc0f2d57accffc1`; its original PDF source remains SHA-256 `81541b975a401d0464eec18dad706cd43fd66bf8876f7c88c634b39681012ede`. Supplied metadata bytes and the known nonblocking path-order wording issue remain preserved.

Customer business behavior changed: **NO**. MERCH-HOME01 preserved: **YES**. Payment/receipt preserved: **YES**. Operational semantic colors and native header ownership remain as accepted.

## Fresh focused verification

```text
node node_modules/vitest/vitest.mjs run src/components/ui.test.ts src/components/Layout.test.ts src/components/session/SessionStatus.test.ts src/components/Icons.test.ts src/customer/components.test.ts src/catalogue/components.test.ts src/catalogue/seamless.test.ts src/catalogue/AdvertisingCarousel.test.tsx src/checkout/components.test.ts src/payment/components.test.ts src/orders/components.test.ts src/catalogue/api.test.ts src/catalogue/contracts.test.ts src/catalogue/advertisements.test.ts src/catalogue/HomeFeaturedProducts.test.ts src/catalogue/navigation.test.ts src/catalogue/state.test.ts
```

Result: **337/337 tests, 17/17 files, exit 0**. This retains the original 240 presentation checks and adds focused MERCH catalogue/API/contracts/advertisement/featured/navigation/state coverage. It does not expand into unchanged financial/database/provider suites. Ignored local log: `brand01-clean-focused.log`.

```text
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
```

Results: both TypeScript checks and production build **exit 0**, 118 modules transformed. Ignored local logs: `brand01-clean-typecheck.log`, `brand01-clean-build.log`. Existing dependencies were reused without installation or lockfile changes.

Fresh browser results:

- Production MERCH verifier: **11/11 acceptance records, exit 0**. At 320/390/430, reveal remains 6/12/18/24, Browse contains 30 products, request context is validated and there is no horizontal overflow. Search/Basket retention, delayed-ad fencing, category/product/external actions, unavailable-product handling, embedded external handoff, swipe non-activation, empty-section hiding, soft advertisement failure and refreshed-image retry all pass.
- Branding verifier: **6/6 acceptance cases, exit 0**, with `BRAND01_EXPECT_BLUE=true`. All three widths retain standalone/embedded header rules, shared palette and customer journeys through payment/receipt/help. The loading logo ratio, enlarged text, keyboard focus and simulated safe-area/keyboard-height conditions pass.
- Rendered Home and StoreLoading image sources: **accepted v1.1 SHA-256 PASS**, complete loading, 5,852 bytes each.
- Screenshots generated: **0**. Both local servers are stopped and disposable runners are removed.

Exact production/dev server and acceptance-runner commands are recorded in [no-capture-provenance.json](../../verification/cksgo-brand01-clean-replay/no-capture-provenance.json). Results are in [MERCH acceptance](../../verification/cksgo-brand01-clean-replay/merch/acceptance.json), [branding acceptance](../../verification/cksgo-brand01-clean-replay/brand/results.json) and [rendered logo checks](../../verification/cksgo-brand01-clean-replay/rendered-logo-checks.json).

Disposable copies were made outside the worktree from the existing proof scripts. The only transformation removes each complete screenshot statement:

```powershell
$pattern = '(?ms)^\s*await page\.screenshot\(\{\r?\n.*?^\s*\}\);\r?\n'
$copy = [regex]::Replace($source, $pattern, "`r`n")
```

Exactly three MERCH and two branding screenshot blocks were removed; zero `page.screenshot` calls remained and both copies passed `node --check`. Assertions and result-writing logic remained active. At execution, the MERCH script had LF checkout bytes, SHA-256 `430469b1eb4dd12a2d02c5c69d2819c447a9e7e9624062feb21c5044c026690d`, and the branding script had CRLF checkout bytes, SHA-256 `a9efd55fc54e3020051c851d248fad1e5aa5ad0258d3295ad698545a4e1e9bbb`. The final LF branding script is SHA-256 `48a7709c63e47d4571b59aae80cf13d3cd5322ae99c6b2e620e75db01ca8fb7a`. Both tracked Git blobs remain identical to the accepted head.

Changed-file formatting uses the repository checker after the local commit:

```powershell
$env:FORMAT_BASE_REF = '30c7b0cd88da99e4ae4248d740f40e2e135a0b6e'
node scripts/check-changed-format.mjs
```

Before commit, explicit Prettier verification passed for all **24 supported, non-ignored replay files**, exit 0. An initial formatting check rejected 18 files checked out with CRLF because `core.autocrlf=true`; a one-file LF-only experiment reproduced and cleared the failure without changing Git content. The supported working files were normalized to their accepted LF Git bytes, and the complete tracked-content comparison against the accepted head remains empty. Immutable upstream asset bytes and the baseline legacy formatting exclusions remain as accepted. This checkout has no configured ESLint/lint script. Git whitespace checks pass. All new non-runtime files are this report and replay verification JSON/inventory.

## Evidence reuse and limits

Conflict-free replay produced the exact accepted rendered source, so **no screenshots are regenerated**. The accepted 39 v1.1 after screenshots and their prior labeled baselines remain byte-identical in `verification/cksgo-brand01-v1.1/`; the original v1 verification package also remains intact. New browser runs retain their assertions and emit JSON only, using disposable copies of the proof scripts with screenshot calls disabled. Tracked proof scripts are unchanged.

Browser evidence is synthetic Chrome emulation at 320/390/430 CSS pixels, including standalone/embedded modes, enlarged root text, keyboard focus and simulated safe areas. It does not claim physical-device/WebView, real OS keyboard, real payment-provider, generated PDF, native receipt-save or joint Flutter build qualification. The replay introduces no new native or product scope.

Full brand-only main-to-checkpoint inventory: [changed-files.txt](../../verification/cksgo-brand01-clean-replay/changed-files.txt). The new file classification distinguishes the exact 55-file v1.1 correction from the complete branding foundation required on unbranded main.

Push: NO. PR: NO. CI: NO. Merge: NO. Deployment: NO. Stop locally after the clean checkpoint and final handoff.
