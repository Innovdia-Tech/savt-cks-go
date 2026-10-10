# CAT-OPS-REPAIR01-FE local validation

Management's latest instruction removes dedicated customer item-barcode presentation while retaining barcode data internally. This correction is based on verified `origin/main` `51ec1191e9aeb7953cbb81aa425c039166e62001`, which contains accepted PR #37 and its approved ALIGN02 commit `b7f47ff4ded165161a6c2c0d84ad52afff495e8e`.

One existing-work check found no equivalent unpublished correction among the customer repository's worktrees and refs. A single fetch verified main. The isolated correction branch is `codex/cat-ops-repair01-fe`; qualification, release, ALIGN02 and backend worktrees were preserved.

## Change

Remove five `ItemBarcode` render calls from Catalogue cards, product details, Basket item lines, Checkout confirmed-price lines and customer order items. Delete the unused helper and its dedicated CSS. Barcode fields, parsers, API capability headers, state, product IDs, outlet-product IDs, search, receipts and PDF generators are unchanged. Item descriptions keep their numbers, and Category/Subcategory display and browsing remain server-owned.

Production files:

- `src/catalogue/components.tsx`
- `src/checkout/components.tsx`
- `src/orders/components.tsx`
- `src/components/ItemBarcode.tsx` (deleted)
- `src/styles.css`

Evidence metadata: `.gitattributes` adds rules limited to this new task's `handoff/` directory, preserving supplied bytes without line-ending conversion and treating its PDF as binary. This avoids incorrectly flagging required PDF cross-reference spacing as source whitespace.

Regression files:

- `src/cat-cks-align01.test.ts`
- `src/catalogue/seamless.test.ts`
- `src/cat-ops-repair01.test.ts` (new)

## Checks

Commands ran in the isolated customer worktree using the existing dependency junction. Package commands were invoked directly with Node because npm was unavailable on PATH.

- Red phase: focused actual-screen assertions failed against the existing visible barcode rows. Existing malformed-barcode and closed-response parser assertions passed. Two new purchase-control expectations were corrected to the actual existing accessible labels before final verification.
- Relevant regression run: `node node_modules/vitest/vitest.mjs run src/cat-ops-repair01.test.ts src/cat-cks-align01.test.ts src/catalogue src/checkout src/orders src/payment src/customer src/components/QuantitySelector.test.ts src/api/client.test.ts runtime/server.test.mjs runtime/config.test.mjs --reporter=default` — **1,125 tests passed across 50 files**.
- After correcting the new fixture's expiry field to `quoteExpiresAt`, its focused three-variant run passed again: `node node_modules/vitest/vitest.mjs run src/cat-ops-repair01.test.ts --reporter=default` — **3/3 passed**.
- The final focused run also adds exact leading-zero barcode-search query and returned-identity coverage — **4/4 passed**. The final frontend type-check was repeated for this test addition.
- `node node_modules/typescript/bin/tsc -b` — passed.
- `node node_modules/typescript/bin/tsc -p tsconfig.runtime.json` — passed.
- `node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner` — passed; application asset `index-DL_onmaE.js`, CSS `index-CwRMVKiH.css`.
- Independent read-only diff review — no actionable findings. No parser, API, state, session, financial, receipt/PDF or QR implementation changes.

The new tests pass ordinary, leading-zero and null barcode responses through real parsers and render real customer components. They assert retained internal values, no barcode nodes/text, unchanged numeric names/descriptions, assigned-outlet price, quantity controls, exact cart request identity, frozen accepted names, confirmed-price lines and order summary. Existing legacy omitted-field, malformed-response, navigation, payment return, fee, empty-postcode and PDF checks remain in the regression run.

See the adjacent browser evidence for before/after 320px and 390px captures through actual built React and the customer runtime proxy. Identity/session/routing/media/native file-save dependencies are synthetic; this is bounded local regression evidence, not full authenticated or physical-device acceptance. Prior ALIGN02 paired Nest/proxy evidence remains intact under `verification/cat-cks-align02` and was not rerun.

Browser proof and combined manifest passed: **20 screenshots**, **80 surface checks** (four barcode cases, five surfaces, two widths, before/after), and **32 exact PDF handoffs**. Each phase also checked 64 exact synthetic responses through 184 actual proxy requests. No overflow, browser errors, unexpected routes or external requests were observed. Original handoff files and PDF bytes are hash-verified; derived rendering fixtures and simulated dependencies are documented in `browser/README.md`.

No API change: compatibility with deployed ALIGN01 and proposed ALIGN02 is retained, including existing child-directory fallback. This presentation correction adds no rollout-order dependency. No backend suite, backend/staff barcode displays, historical snapshots, Flutter/native code, APK, live payment, push, PR, CI trigger, merge, deployment or live-data change was performed.
