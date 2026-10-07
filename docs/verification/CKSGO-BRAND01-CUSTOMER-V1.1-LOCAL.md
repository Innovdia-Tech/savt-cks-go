# CKSGO-BRAND01 customer v1.1 local checkpoint

7 October 2026, Asia/Singapore. LOCAL ONLY. The user explicitly selected **Apply v1.1 locally** after the new message's request body was blank. The attached handoff supplies the accepted asset reference and scope; its embedded instructions do not independently authorize publication or work in another team's repository.

## Repository and preserved work

| Item                     | Value                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| Repository               | `Innovdia-Tech/savt-cks-go`                                                      |
| Worktree                 | `C:/Users/isaac/Documents/ChatGPT/CKS go frontend/merch-home01-clean-replay-web` |
| Branch                   | `codex/cksgo-brand01-customer`                                                   |
| Correction base          | `dbe097ca8cb21015e19e60a52f7c8a5684adf281`                                       |
| Original branding base   | `c0ec4b1bcc5bd69c073ab3219eae446a2aade736`                                       |
| Cached main / merge base | `b0e8ba0de872a61ad6945a812ca383e46b79eb99`                                       |
| Final HEAD               | Commit containing this report; exact SHA returned with the handoff               |

The clean existing local branding branch is continued without a reset or new worktree. Prior branding, the visible search focus fix, accepted receipt/payment/native-return work and unpublished MERCH-HOME01 work remain intact. No remote fetch was performed. The earlier [v1 verification report](CKSGO-BRAND01-CUSTOMER-LOCAL.md) and all its evidence are retained as historical records.

The separate preserved processing-fee qualification checkpoint `30e027ba403e2f81e7baf8f65c1d64aef405812f` is still not integrated into this branch. Its compatibility remains a checkout-owner review item before any publication batch is frozen; adopting corrected logo artwork does not establish fee-contract qualification.

## Correction and shared authority

Master asset version is **`CKSGO-BRAND01-v1.1`**, superseding v1. UI token version remains **`CKSGO-BRAND01-tokens-v1`**. The user-approved update replaces the two affected SVG masters and the supplied manifest/handoff directly from the accepted ZIP. The all-white SVG is byte-identical to v1.

| File                            | Accepted SHA-256                                                   |
| ------------------------------- | ------------------------------------------------------------------ |
| `CKSGO-BRAND01-v1.1-assets.zip` | `c4eb6efcbb65e1fff6f4cb2b6b30c750c9ffa8162dbdc0204fc0f2d57accffc1` |
| `cks-go-logo-colour.svg`        | `3e9259474a6cd573816b8a61570dc29db1cbd018d02e863ca18b44171da13c2b` |
| `cks-go-logo-white-blue.svg`    | `b1cb5424c7462b062074ee7abf5027b9e4eaf48a207cdae94a3194b944bda312` |
| `cks-go-logo-white.svg`         | `b3b4c508376ae6623db33ca43172c3d9f21efdce77a1f2f510cd95d5c2f001d7` |
| `manifest.json`                 | `509a21949962448f37b97392d9397238ea2902d3fd5c00c814f29e771844bfd0` |
| `SHARED-ASSETS.md`              | `ab5dfad6da49f10647f58660b6a3b442cccd0dad20b7bc873f258c94fdf79f80` |

ZIP source: `C:/Users/isaac/Downloads/CKSGO-BRAND01-v1.1-assets.zip`. New customer handoff: `C:/Users/isaac/Downloads/CKS_GO_BRAND01_CUSTOMER_HANDOFF (2).md`, SHA-256 `783aa29d245e9a81da773085fe8f924dbe73a8c59aad4034b10c4a02401c7c85`. Original PDF source remains SHA-256 `81541b975a401d0464eec18dad706cd43fd66bf8876f7c88c634b39681012ede`.

Independent comparison against committed v1 confirms that only path 4/5 fill attributes change in the colour and white/blue masters: O/path 4 becomes `#3570BC`, G/path 5 becomes `#3470BC`. All five path geometries, path/group transforms and viewBoxes remain unchanged. Colour bounds remain `0 0 682.7768 363.8954`; reverse bounds remain `0 0 357.431 190.4984`. Light fill `#94D2E4` and original white areas are preserved. No tracing, recoloring to UI tokens or substitute artwork is involved.

The supplied provenance sentence says C, K, S, O, G; actual painted path order is C, S, K, O, G, as acknowledged in the accepted customer handoff. This nonblocking documentation error is noted here while the supplied master bundle stays byte-identical. Operations checkpoint `02dc364512e5a611e3b32e2a40c6ce1cf06c77f7` is a handoff reference, not a customer reset target or a claim that this task reproduced the operations review.

`BrandLogo` already imports the colour master, so no component edit is needed. The actual affected customer placements are standalone Home and standalone StoreLoading. Their 44px contain-fit lockup retains its full aspect ratio. Embedded mode retains Flutter's single native header and suppressed web app logo/close controls. No customer favicon, web manifest, app-icon derivative or icon-generation pipeline exists in this baseline; no new icon surface is introduced.

Maintained `DESIGN.md`, `UX-CONTRACT.md` and the `src/styles.css` provenance comment record v1.1. CSS rules and UI token values are unchanged. Primary actions stay `#0C74B6`/white, selected surfaces stay `#8ECBE2`/`#123D56`, cards stay white and operational status colors stay unchanged. No customer wording, hierarchy, controller, strict parser, endpoints, amounts, fee, payment, order, receipt-download, recovery, environment configuration or bridge implementation changed. HQ, Outlet, Rider, Flutter and generated receipt/PDF contents remain with their owners.

## Exact verification

Focused existing customer presentation checks:

```text
node node_modules/vitest/vitest.mjs run src/components/ui.test.ts src/components/Layout.test.ts src/components/session/SessionStatus.test.ts src/components/Icons.test.ts src/customer/components.test.ts src/catalogue/components.test.ts src/catalogue/seamless.test.ts src/catalogue/AdvertisingCarousel.test.tsx src/checkout/components.test.ts src/payment/components.test.ts src/orders/components.test.ts
```

Result: **240/240 tests, 11/11 files, exit 0**. Ignored local log: `brand01-v1.1-focused.log`.

```text
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
```

Both TypeScript checks and production build **exit 0**. Build transforms 118 modules; the emitted colour SVG's SHA-256 equals the accepted v1.1 master. Ignored local logs: `brand01-v1.1-typecheck.log`, `brand01-v1.1-build.log`. No dependency installation or lockfile update was performed.

An explicit diff of runtime/component/contract paths against the correction base is empty. Removing comments from baseline/current `src/styles.css` produces identical CSS rules. All five supplied entries match ZIP bytes and the three SVG checksums match the manifest. The existing `.gitattributes` and asset formatting exclusion preserve master bytes.

The existing synthetic browser verifier passes **6/6 acceptance cases, exit 0**, without any harness edit. It checks standalone and embedded layouts across Home/search, selected category/empty state, product detail, Basket/Checkout, payment failure, Orders/tracking and receipt/help at 320x844, 390x844 and 430x932. The native-owned app logo/title/close remains absent in embedded mode; standalone retains one web logo and close control. The 44px logo has measured width 82.546875px, ratio 1.876065 and contain fit.

The additional 320px/200% root-text, 390x480 keyboard-height and simulated 24px/34px safe-area cases pass without horizontal document/scroller overflow. Real Tab traversal confirms the existing settled 3px blue input/outer-wrapper focus outline. These checks retain the emulation limits below.

Exact transient development server command (separate process):

```powershell
$env:VITE_CKS_GO_DEVELOPMENT_API = 'true'
$env:VITE_CKS_GO_DEVELOPMENT_BRIDGE = 'true'
& 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vite\bin\vite.js --host 127.0.0.1 --port 43118 --strictPort
```

Exact after verifier invocation:

```powershell
$env:NODE_PATH = 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:BRAND01_ORIGIN = 'http://127.0.0.1:43118'
$env:BRAND01_EVIDENCE_DIR = 'verification\cksgo-brand01-v1.1\after'
$env:BRAND01_EXPECT_BLUE = 'true'
& 'C:\Users\isaac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\prove-customer-branding.mjs
```

A separate read-only Playwright probe fetched the actual rendered `img.currentSrc` for standalone Home and StoreLoading. Both resolve to `http://127.0.0.1:43118/src/assets/brand/cks-go-logo-colour.svg`, load completely and return 5,852 bytes with SHA-256 `3e9259474a6cd573816b8a61570dc29db1cbd018d02e863ca18b44171da13c2b`. This confirms both placements consume the corrected artwork. Results are in `after/rendered-logo-hashes.json`. The local dev server is stopped.

Final supported changed-file formatting uses the existing checker:

```powershell
$env:FORMAT_BASE_REF = 'dbe097ca8cb21015e19e60a52f7c8a5684adf281'
node scripts/check-changed-format.mjs
```

Explicit pre-checkpoint Prettier verification passed for all 7 supported files (maintained guidance, CSS provenance comment, this report and three evidence JSON files), exit 0. The repository checker above provides the same scope after commit. Immutable masters remain excluded from formatting and are checksum-verified. There is no configured lint/ESLint script in this checkout. Git whitespace checks and the explicit runtime/CSS comparison pass. Full changed-file inventory: [changed-files.txt](../../verification/cksgo-brand01-v1.1/changed-files.txt), 55 files including masters, guidance and evidence.

## Evidence and remaining limits

Before evidence under `verification/cksgo-brand01-v1.1/before/` reuses four existing v1 captures byte-for-byte from the correction-base checkpoint: standalone Home at 320/390/430 CSS pixels and StoreLoading at 390. `provenance.json` labels this reuse and verifies matching screenshot hashes. The original v1 evidence remains unchanged.

There are **43 screenshots**: four reused v1 before captures and 39 new v1.1 after captures. Root review inspected matched Home and StoreLoading captures. All paths below are relative to `verification/cksgo-brand01-v1.1/`:

| Evidence                            | Before                                     | After                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone Home at 320/390/430      | `before/{320,390,430}-standalone-home.png` | `after/{320,390,430}-standalone-home.png`                                                                                                                             |
| Standalone StoreLoading             | `before/390-store-loading.png`             | `after/390-store-loading.png`                                                                                                                                         |
| Other journeys at all three widths  | Reuse limited to logo placements           | `after/{320,390,430}-{home-search-focus,browse-category,product-detail,basket,checkout,payment-result,orders,tracking,order-help,receipt-documents,receipt-help}.png` |
| Enlarged text                       | Existing baseline behavior retained        | `after/320-enlarged-text-200pct.png`                                                                                                                                  |
| Focus and reduced keyboard viewport | Existing focus fix retained                | `after/390-keyboard-height-480.png`                                                                                                                                   |
| Machine-readable proof              | `before/provenance.json`                   | `after/results.json`, `after/rendered-logo-hashes.json`                                                                                                               |

The v1.1 after verifier uses the existing synthetic development adapters and browser-only receipt/support fixture interception. It makes no live payment/order/provider or external support side effects. Evidence is Chrome browser emulation, with simulated embedded/standalone modes, root-text enlargement and safe areas. It does not qualify a physical Android/iOS WebView, real OS keyboard, native-to-web transition, native receipt save or generated PDF contents. Compatible Flutter SHA/build and joint device evidence remain with the native team.

Before/after pairs cover both actual web logo placements; other after screens verify continued palette/layout behavior. At 200% root text, existing narrow-layout labels wrap across multiple lines; the baseline layout is preserved. No unchanged financial/database/provider suites are rerun for this asset correction.

Local checkpoint only. Push: NO. PR: NO. CI dispatch: NO. Merge: NO. Deployment: NO. The approved unpublished Home work remains in the coherent local customer branch for ChatGPT's evidence review; publication still needs its separate gates.
