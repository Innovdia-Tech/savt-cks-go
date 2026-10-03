# CUSTOMER-UX-POLISH01 — local customer journey refinement

3 October 2026, Asia/Singapore. Scope: the supplied CUSTOMER-UX-POLISH01 brief, from accepted frontend HEAD `c6e351cc253b1a46b6a1595aa09c8831f6d6b5d5`. One isolated local checkout was created at `C:/Users/isaac/Documents/ChatGPT/CKS go frontend/customer-ux-polish01` because the available checkout was newer than the specified baseline. No network fetch was needed.

## USER JOURNEY

| Surface              | Rating         | Explanation for non-CLEAR items                                                                                              |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CKS Go entry         | MINOR FRICTION | The standalone local harness requires OTP sign-in; authenticated native Savt entry remains physical-device acceptance work.  |
| Address              | MINOR FRICTION | Local location search returns unavailable, while the selected saved address supports the complete purchase.                  |
| Catalogue            | MINOR FRICTION | Protected fixture data uses synthetic category/product names and missing images; authoritative data was preserved.           |
| Product              | CLEAR          |                                                                                                                              |
| Basket               | CLEAR          |                                                                                                                              |
| Checkout             | CLEAR          |                                                                                                                              |
| Payment              | MINOR FRICTION | The protected simulator return link reaches a local 404, requiring the original customer tab and its existing status action. |
| Payment confirmation | CLEAR          |                                                                                                                              |
| Order Confirmed      | CLEAR          |                                                                                                                              |
| Current Orders       | CLEAR          |                                                                                                                              |
| Tracking             | CLEAR          |                                                                                                                              |
| Payment Receipt      | CLEAR          |                                                                                                                              |

## REFINEMENTS

| Refinement                   | Outcome           | Reason                                                                                                                                                                              |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment wording              | CHANGED           | Pending/checking/paid-processing now say Confirming your payment… without claiming payment received; success requires existing PAID plus valid Order evidence.                      |
| Ambient wording              | CHANGED           | It is storage temperature, so AMBIENT displays Room temperature; wire enums and taxonomy are unchanged.                                                                             |
| Basket duplication           | CHANGED           | Removed only the redundant standalone Home header shortcut; persistent navigation/count and the contextual merchandise subtotal CTA remain.                                         |
| Order Confirmed hierarchy    | CHANGED           | Confirmation/checkmark, useful order number, concise acknowledgement and Track order lead the existing screen; the callback still opens order detail.                               |
| Tracking wording             | PRESERVED         | Existing stages already read Order received, Preparing your order, Out for delivery and Delivered.                                                                                  |
| Orders terminology           | PRESERVED         | Current orders contains active stages; Order history contains terminal stages; backend lifecycle is untouched.                                                                      |
| Error/recovery wording       | CHANGED/PRESERVED | Handoff/status/uncertain-create copy is plain and actionable; uncertain initiation stays uncertain and retains its safe retry; catalogue/quote/Orders/receipt already redact codes. |
| Primary action               | CHANGED           | Basket's existing quote action now says Checkout; reviewed total leads to the existing Pay amount action.                                                                           |
| Receipt/loading              | PRESERVED         | Protected receipt action remains secondary below tracking, with busy/disabled download and explicit retry.                                                                          |
| Browse search-clear controls | PRESERVED         | Explicitly excluded; no search-control source or styles changed.                                                                                                                    |

No token, global colour, API, outlet assignment, price, payment controller, receipt arithmetic, cancellation or navigation architecture changed. Developer error state and diagnostics remain available.

## CLICK / DECISION FRICTION

**Seven meaningful actions** with an existing session and selected saved address: Add, increase to two, View basket, Checkout, Pay RM15.45, mock SUCCESS, Check payment status. Product/address inspection, keyboard testing and exception probes are excluded from this comparison. The standalone OTP harness adds Send OTP and Verify before Home.

No new step was introduced. The local-only manual status action remains necessary because of the protected return fixture. Remaining Basket actions serve distinct purposes: persistent navigation/count versus contextual subtotal feedback after adding. Customer payment screens expose no webhook, finality, provider callback, attempt, intent, HTTP or API wording. Technical fixture names and the simulator's diagnostic copy belong to protected local data/services.

## MOBILE ACCEPTANCE

| Check                 | Result                                                  | Evidence/limit                                                                                                                                    |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 390×844               | PASS                                                    | Saved-address purchase, product, Basket, Pay, confirmation, Current Orders, tracking and receipt inspected in the browser.                        |
| Keyboard states       | PASS for desktop keyboard and reduced-height simulation | Focused catalogue/location input and long address draft tested at 390×500; Save remained reachable. Physical mobile OS keyboard is NOT VERIFIED.  |
| Primary CTA hierarchy | PASS                                                    | Checkout → Pay RM15.45 → Track order; receipt is neutral and secondary.                                                                           |
| Navigation/back       | PASS for frontend                                       | Product Back, delivery search/setup Back and detail → Orders verified; protected mock-provider return remains 404.                                |
| Overflow/clipping     | PASS                                                    | No page/content horizontal overflow or clipped money; address and order references wrap; category strip retains intentional horizontal scrolling. |

Purchase proof: order **CKSGO-20261003-00004**, RM15.45, authoritative PAID/Order received. The new order appears first in Current orders; real fixture history is empty, with completed/terminal mapping covered by regression tests. No fulfilment lifecycle was advanced.

Payment Receipt: authenticated download returned `application/pdf`, `%PDF-`, **6,680 bytes**. Browser-saved bytes match API bytes, SHA-256 `55a58af1f34820f825fea6c5681d07d5ef0239faea8a29d8fe302490a30973cc`. A delayed download disabled repeat action; injected 503 showed safe retry without private diagnostics; retry recovered. Receipt target is 44px. Final Receipt stays unavailable before completion.

Browser evidence is saved under `C:/Users/isaac/.codex/visualizations/2026/10/03/01a0ff5a-b003-7c50-a8eb-6c5fb1ee8d3d`. A loopback-only QA proxy reused the unchanged 4313/4312 services and adapted the new preview origin to their existing 4173 configuration. Delays/errors were injected only in this external harness, never in product or protected repository source.

## TESTS

| Gate                    | Result                                                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused tests           | PASS: 440 tests, 21 files covering payment, Orders/receipt, checkout and affected catalogue/layout.                                                                  |
| Full frontend suite     | PASS: 876 tests, 57 files.                                                                                                                                           |
| TypeScript              | PASS: `tsc -b` and `tsc -p tsconfig.runtime.json`.                                                                                                                   |
| Production build        | PASS: Vite, 104 modules.                                                                                                                                             |
| Formatting              | PASS: Prettier changed supported files and repository changed-file gate; Layout.tsx retains its existing legacy exclusion and has only a reviewed one-line deletion. |
| Browser E2E             | PASS with protected harness limitations above; real mock SUCCESS, confirmation, Orders, tracking, PDF and receipt recovery verified.                                 |
| Diff check              | PASS: `git diff --check`.                                                                                                                                            |
| Credential scan         | PASS: added diff lines scanned for private keys, AWS/GitHub/API tokens, JWTs and secret literals.                                                                    |
| Strict premium UI audit | PASS: zero findings.                                                                                                                                                 |
| Independent review      | One uncertainty-copy finding resolved through failing/passing tests; no actionable findings remain.                                                                  |

New payment truth/uncertainty tests failed before the changes and passed afterward. Storage mapping and redundant Home Basket tests also failed first. No backend full suites or CI ran. Visual tokens and adapters are unchanged; DESIGN.md/UX-CONTRACT.md document only the approved presentation override. The standalone designmd CLI is unavailable; unchanged token frontmatter was preserved and Markdown formatting/static UI audit were verified.

## GIT

- Starting HEAD: `c6e351cc253b1a46b6a1595aa09c8831f6d6b5d5`.
- Final local HEAD: recorded in the completion response and external final report to avoid embedding this commit's own hash in its contents.
- Branch: `codex/customer-ux-polish01`.
- One local checkpoint: `polish: simplify customer purchase journey`.
- Final tracked/untracked status: clean in this isolated checkout; parent workspace and its pre-existing repositories are preserved.

## PROTECTED DEPENDENCIES

- cks-go unchanged: **YES**, clean at `a37f46d45ccc42082affd0c063c68e843a85ea95`.
- node-savt unchanged: **YES**, clean at `141401632eaa85d96ef72c3c0b119e731a2091d9`.
- Local synthetic order/payment records were created only by the authorized E2E flow; source checkpoints did not change.

## SEVERITY / DEFERRED POLISH

No frontend-owned BLOCKING finding remains. IMPORTANT external acceptance items: native authenticated entry/payment return/file handling/OS keyboard, unavailable local address search, and the protected mock return 404. These require their owning runtime/device workstream, not a change to this frontend refinement.

Deferred POLISH (one item): the browser document title remains Basket while the in-page paid state correctly says Order confirmed; the route remains the accepted in-memory Basket route.

## PUBLICATION

Push: **NO**. PR: **NO**. CI: **NO**. Merge: **NO**. Deployment: **NO**.
