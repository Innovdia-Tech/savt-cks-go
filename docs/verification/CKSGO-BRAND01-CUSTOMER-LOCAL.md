# CKSGO-BRAND01 customer local checkpoint

7 October 2026, Asia/Singapore. LOCAL ONLY. The user's implementation request governs this customer package; the attached handoff, three-team brief, original PDF and operations asset record provide requirements and provenance. They do not authorize publication or changes to another team's repository.

## Repository and preserved baseline

| Item                     | Value                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| Repository               | `Innovdia-Tech/savt-cks-go`                                                      |
| Worktree                 | `C:/Users/isaac/Documents/ChatGPT/CKS go frontend/merch-home01-clean-replay-web` |
| Branch                   | `codex/cksgo-brand01-customer`                                                   |
| Branding base            | `c0ec4b1bcc5bd69c073ab3219eae446a2aade736`                                       |
| Cached main / merge base | `b0e8ba0de872a61ad6945a812ca383e46b79eb99`                                       |
| Final HEAD               | Commit containing this report; exact SHA returned with the handoff               |

The outer workspace repository has no commits and contains multiple independent historical checkouts. The selected clean customer replay worktree includes accepted purchase-journey polish, receipt UX, native payment-return recovery, native receipt saving and the two unpublished MERCH-HOME01 customer commits. Its tree was identical to the preserved `13154b1ad27ff991c0e7d6c23b95b97bafe80772` customer checkpoint before branding; the replay has integrated cached main ancestry. Existing branch pointers and all other checkouts remain preserved. No historical checkpoint was reset, and no remote fetch was performed in this local task.

There is a separate cached qualification checkpoint `30e027ba403e2f81e7baf8f65c1d64aef405812f` (`fix(checkout): accept optional processing fee minimum`) which is not an ancestor of this branding base. It remains preserved at `origin/qualification/fe-final01`. Its parser, fixtures and verification package were inspected, not replayed as a branding change. Resolve its compatibility/integration with the checkout owner when freezing the coherent customer publication batch. This branding checkpoint does not claim that separate contract qualification.

## Branding result

The shared runtime tokens and existing semantic aliases update Home, Browse/search, product detail, Basket/Checkout, payment results, Orders/tracking and receipt/help actions without changing their owners or wording. Existing white cards remain white. Selected category/address surfaces use light blue and dark ink; navigation, safe commerce actions, support links, focus rings and branded loading/empty/error decoration use action blue. Semantic success, warning, danger and Savt reward values are unchanged. Visual keyboard verification found that the existing rounded search container clipped the input's outward focus outline; the container now draws the same blue outline when an inner control is keyboard-focused, without changing its dimensions or search behavior.

The existing standalone Home title and store-loading text placement now use the original full color logo. `BrandLogo` imports the approved SVG directly and renders it with automatic width, bounded height and contain fitting. The existing embedded header branch and embedded loading suppression are unchanged; Flutter retains the single native CKS Go header, app title and Back/Close controls. Standalone web controls retain their behavior.

The existing HTML theme color is `#8ECBE2`. There was no customer `public/` icon pack, favicon reference or manifest in this baseline, so none was invented. Routes, installed identity and scope are unchanged. Product images, category artwork and merchant advertisement images are untouched. Generated receipt/PDF content stays with the backend renderer owner.

No API, strict parser, controller, amount/fee calculation, environment configuration, payment-finality, order-tracking, receipt-download or native bridge implementation changed. No HQ, Outlet, Rider or Flutter source changed.

## Shared assets and tokens

Asset version: `CKSGO-BRAND01-v1`. Token version: `CKSGO-BRAND01-tokens-v1`.

The local operations-approved ZIP `C:/Users/isaac/Downloads/CKSGO-BRAND01-v1-assets.zip` has SHA-256 `b18fdfb65ab339adde23ca1a6a1d31f6b51b457a31cebf684a6ee23e6ae8faf8`. Its three masters, manifest and handoff are copied byte for byte to `src/assets/brand/`. Original artwork colors intentionally differ from the UI tokens. `.gitattributes` prevents line-ending conversion and `.prettierignore` excludes this immutable upstream bundle from formatting.

| Master                       | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `cks-go-logo-colour.svg`     | `97fced87cfd359d24cfef21173f4c0e044f92c55b791a4f4aced8bb63fe01de8` |
| `cks-go-logo-white-blue.svg` | `17332295e7175259dbe0b0bfd26461294b7c6490114b4ffd5e709f75885ab299` |
| `cks-go-logo-white.svg`      | `b3b4c508376ae6623db33ca43172c3d9f21efdce77a1f2f510cd95d5c2f001d7` |

Original PDF SHA-256: `81541b975a401d0464eec18dad706cd43fd66bf8876f7c88c634b39681012ede`. Relevant logo/reference pages 1-3 were rendered and inspected. The supplied physical mockup's URLs and delivery claims were not adopted as application requirements.

| Role                             | Value                             |
| -------------------------------- | --------------------------------- |
| Brand light / selected ink       | `#8ECBE2` / `#123D56`             |
| Working action / hover / pressed | `#0C74B6` / `#09639C` / `#084F7C` |
| Canvas / soft / muted            | `#F3F8FB` / `#E8F5FA` / `#EAF2F6` |
| Cards                            | `#FFFFFF`                         |
| Border / strong border           | `#D9E6ED` / `#B7CBD6`             |
| Existing body ink                | `#231F20`                         |

Supporting shades match operations v1. The action blue remains an artwork-derived working digital choice, not a separately printed official dark-blue specification. Calculated opaque sRGB contrast is 5.01:1 for white/action, 6.45:1 for selected ink/light blue, 4.69:1 for action/canvas and 4.505:1 for action/soft. White/action hover and pressed are 6.41:1 and 8.68:1. These are pair checks, not a claim of full application accessibility certification.

## Exact checks and evidence

Focused existing presentation checks:

```text
node node_modules/vitest/vitest.mjs run src/components/ui.test.ts src/components/Layout.test.ts src/components/session/SessionStatus.test.ts src/components/Icons.test.ts src/customer/components.test.ts src/catalogue/components.test.ts src/catalogue/seamless.test.ts src/catalogue/AdvertisingCarousel.test.tsx src/checkout/components.test.ts src/payment/components.test.ts src/orders/components.test.ts
```

Result: **240/240 tests, 11/11 files, exit 0**. Ignored local log: `brand01-focused.log`.

```text
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
```

Results: both TypeScript checks and production Vite build **exit 0**; 118 modules transformed, original color SVG emitted unchanged. Logs: `brand01-typecheck.log`, `brand01-build.log`. This is the existing build script's application/runtime typecheck and bundling sequence.

Prettier checks use the existing changed-file conventions; the baseline already excludes legacy `Layout.tsx` and `App.tsx` from full-file formatting. Immutable master files are verified by source checksums instead of reformatting. There is no configured lint script or ESLint configuration in this customer checkout. Git whitespace and an explicit diff of authority paths are also checked.

The initial sandboxed `pnpm exec` tried to resolve the existing dependency junction and failed with EPERM. Sandboxed Vitest and TypeScript also encountered dependency access failures; a sandboxed browser run could not reach loopback. Direct installed CLI paths and elevated local verification completed successfully without dependency installation, source-contract repairs or lockfile changes. An initial Prettier invocation mistakenly included `.prettierignore`, which has no inferred parser; the supported-file check was corrected. These were tooling/check invocation failures, not application defects.

Before screenshots: `verification/cksgo-brand01/before/home/`, captured from the unchanged baseline production bundle using `scripts/prove-home-merchandising.mjs` and local synthetic HTTP responses. Widths: 320x844, 390x844, 430x932; initial and expanded Home, with acceptance JSON.

Production Home after evidence: `verification/cksgo-brand01/after/home/`, captured from the final production bundle. The existing `scripts/prove-home-merchandising.mjs` verifier passes at all three widths: no horizontal overflow; incremental reveal 6/12/18/24; Browse total 30; search and Basket context retained; delayed advertisement response cannot hijack Basket; category/product/external advertisement actions stay fenced; embedded external-link behavior, swipe, empty sections, soft advertisement failure and image retry pass. Both baseline and final runs produce 11 acceptance records and exit 0.

```powershell
$env:NODE_PATH = 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:MERCH_PREVIEW_ORIGIN = 'http://127.0.0.1:5194'
$env:MERCH_EVIDENCE_DIR = 'verification/cksgo-brand01/after/home'
node scripts/prove-home-merchandising.mjs
```

The preview serves the final `dist/` using `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5194 --strictPort`. The unchanged baseline was served separately on loopback port 43117 with the same Home verifier and its own output directory; no checkout reset was used.

The dedicated `scripts/prove-customer-branding.mjs` verifier uses the existing in-memory development adapters and browser-only fixture interception. No runtime source or saved environment configuration is changed for fixtures. It supplies available document metadata and a valid `CKSGO-SYNTH-ORDER-` sample number because the existing `SYNTH-ORDER-` development number correctly fails production support-link prefix validation. Support destinations are synthetic, and external handoffs are stubbed. It checks standalone and embedded layouts at 320x844, 390x844 and 430x932 through Home/search, selected category and empty state, product detail, Basket, Checkout/Pay, payment failure, Orders, tracking, order help and payment/final receipt interfaces. Its assertions cover shared palette values, selected light-blue/dark-ink colors, original logo ratio, no document/scroller overflow, visible-action horizontal bounds and native header ownership. Controls inside intentional horizontal scrollers are excluded from the action-clipping assertion; document and app bounds remain checked.

Additional cases inspect 200% root text at 320 pixels, top/bottom safe-area padding simulated as 24/34 pixels, and a 390x480 viewport to approximate reduced space while a software keyboard is visible. Real Tab traversal checks a settled 3px blue `:focus-visible` outline on the input and its outer container, with a 3px offset. The saved focus screenshots show the visible outer ring. The existing reduced-motion rule retains a 0.01ms transition, so the harness waits two animation frames before reading the rendered outline color. These are emulation conditions, not a real OS keyboard or physical safe-area measurement.

The final dedicated browser run returns **6/6 acceptance cases, exit 0**. There are 39 final journey/loading/focus/text PNGs, plus 6 production Home after PNGs and 6 baseline Home PNGs: **51 screenshots total**. Results are saved in `after/results.json`. Root review inspected selected-category, product, Basket, Checkout, payment, tracking, receipt/help, loading, enlarged-text and focus evidence.

Exact synthetic development server invocation (separate process):

```powershell
$env:VITE_CKS_GO_DEVELOPMENT_API = 'true'
$env:VITE_CKS_GO_DEVELOPMENT_BRIDGE = 'true'
& 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vite\bin\vite.js --host 127.0.0.1 --port 43118 --strictPort
```

Exact final verifier invocation:

```powershell
$env:NODE_PATH = 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:BRAND01_ORIGIN = 'http://127.0.0.1:43118'
$env:BRAND01_EVIDENCE_DIR = 'verification\cksgo-brand01\after'
$env:BRAND01_EXPECT_BLUE = 'true'
& 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\prove-customer-branding.mjs
```

Final syntax/whitespace checks: `node --check scripts/prove-customer-branding.mjs` and `git diff --check`, both **exit 0**. Supported changed-file Prettier checks are repeated using the existing repository checker after the local checkpoint:

```powershell
$env:FORMAT_BASE_REF = 'c0ec4b1bcc5bd69c073ab3219eae446a2aade736'
node scripts/check-changed-format.mjs
```

Pre-checkpoint explicit Prettier verification passed for all 14 supported, non-ignored files, exit 0. Generated Home acceptance JSON required whitespace formatting; parsed evidence values were checked unchanged. Immutable asset hashes and the legacy exclusions are described above. The repository checker above provides the same 14-file scope after commit. All task-created local preview/dev servers are stopped after verification. Full changed-file inventory: [changed-files.txt](../../verification/cksgo-brand01/changed-files.txt), 74 files including source, master bundle, report and evidence.

| Evidence                                   | Files                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comparable Home before/after at all widths | `before/home/home-initial-{320,390,430}.png`, `after/home/home-initial-{320,390,430}.png`                                                                                             |
| Expanded Home before/after                 | `before/home/home-{320,390,430}.png`, `after/home/home-{320,390,430}.png`                                                                                                             |
| Journey at each width                      | `after/{320,390,430}-{standalone-home,home-search-focus,browse-category,product-detail,basket,checkout,payment-result,orders,tracking,order-help,receipt-documents,receipt-help}.png` |
| Standalone branded loading                 | `after/390-store-loading.png`                                                                                                                                                         |
| Enlarged text                              | `after/320-enlarged-text-200pct.png`                                                                                                                                                  |
| Reduced keyboard viewport                  | `after/390-keyboard-height-480.png`                                                                                                                                                   |
| Machine-readable acceptance                | `before/home/acceptance.json`, `after/home/acceptance.json`, `after/results.json`                                                                                                     |

All evidence paths are under `verification/cksgo-brand01/`. Before evidence is Home-only; other screen captures are final-state visual checks rather than matched before/after comparisons. The main code diff retains layout declarations, copy and journey control logic. At 200% text the existing narrow-layout labels wrap across multiple lines; the document and actions remain horizontally contained. Further reflow refinements would be a separate UX change.

## Publication boundary and limitations

The coherent customer batch retains the approved MERCH-HOME01 changes beneath this branding checkpoint. Review the preserved processing-fee qualification checkpoint before freezing a publication head. The operations asset pack is available; logo export delivery is no longer a dependency. Native CKS Go branding and a jointly verified Flutter build remain with the native team.

Browser evidence is synthetic Chrome emulation, not a physical Android/iOS WebView. No physical native-to-web transition, real payment provider, live customer order, backend-generated PDF content or native receipt-save action was qualified here. Those established engineering/device gates remain separate. No unchanged financial/database/provider suite was rerun for this theme substitution.

Push: NO. PR: NO. CI dispatch: NO. Merge: NO. Deployment: NO. Stop locally for ChatGPT's evidence review and final publication recommendations.
