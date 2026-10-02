# PAY-RECEIPT-FE01 local acceptance

## Governing requirement and execution plan

The customer PAY-RECEIPT-FE01 brief authorizes changes only in `Innovdia-Tech/savt-cks-go`, starting at `7551db700043c5c567edbc40a3e71c1b9f9cdcfa`. CKS Go Phase 1 v1.4 contract section 9 requires a Payment Receipt after payment and a separate Final Sales Receipt after fulfilment. The protected backend at `a37f46d45ccc42082affd0c063c68e843a85ea95` is the authority for document availability, ownership, immutable amount and download paths. No business rule is inferred by the browser.

Execution: verify repository/checkpoints and inspect the real 390x844 customer journey; reproduce the missing Payment Receipt; add failing contract/client/controller/UI/save tests; consume the existing document projection and authenticated download; repeat the real mock payment journey and exception checks; run the local gates; review and create one local checkpoint. No schema or API contract changes are needed.

## Implementation

Payment Receipt is a secondary action in **Order Detail > Documents**, below tracking, items, payment summary and delivery details. Final Receipt has its own heading and capability. Its existing detail projection, endpoint and completed-order download behavior are preserved.

- `src/orders/contracts.ts`: strict independent document projection, kind and exact order-bound relative path validation.
- `src/orders/api.ts`: credentialed document GET and `credentials: include` PDF GET; no-store, abort/timeout, content-type and nonempty-body validation.
- `src/orders/state.ts`: separate document and Payment Receipt loading/error state, duplicate-download protection, safe filename, navigation/logout race fencing.
- `src/orders/components.tsx`: available/loading/error/retry presentation and shared browser save helper; PDF Blob -> object URL -> temporary download anchor -> delayed revocation. Authentication is carried by the request, never by the URL.
- `src/orders/orders.css`: existing neutral card/button system, token-based spacing, visible focus and 44px minimum target.
- `src/orders/api.test.ts`, `state.test.ts`, `components.test.ts`, `documents.test.ts`, `download.test.ts`: receipt behavior and material failure coverage.
- `src/payment/components.tsx`, `components.test.ts`: the existing explicit local simulator status action also covers PAID_PROCESSING. The same DEV/non-PROD/loopback guard applies; no production presentation or payment state machine change.
- `UX-CONTRACT.md` and this report: current ownership, verification and user-POV findings.

Receipt errors use safe copy and explicit retry. A document lookup error leaves order tracking readable. Download loading disables the action and marks it busy. Final Receipt unavailability is normal copy, not an error.

## Customer E2E

The real local Session -> saved Address -> Catalogue -> Cart -> authoritative Quote -> mock GKash SUCCESS -> Order Confirmed -> Order Detail -> Payment Receipt journey was exercised against the protected backend and node-savt checkpoints. No real charge occurred. Final order: `985d5701-a560-4113-985d-8f184e5f1a22`, displayed `CKSGO-20261003-00003`.

| Required proof                            | Result | Evidence                                                                                                |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Payment Receipt visible                   | PASS   | Order Detail Documents action; backend metadata AVAILABLE                                               |
| Download action                           | PASS   | Correct order-bound `/payment-receipt/download` GET                                                     |
| Authenticated request                     | PASS   | Existing session cookies present; no query credential                                                   |
| PDF received                              | PASS   | HTTP 200, application/pdf, private/no-store, `%PDF-`                                                    |
| Browser/download verified                 | PASS   | Browser saved a real 6,695-byte PDF in Downloads; identical to authenticated API bytes                  |
| Correct amount                            | PASS   | Quote, detail, immutable metadata and PDF all RM15.45 / 1545 minor units                                |
| Final Sales Receipt blocked pre-COMPLETED | PASS   | ORDER_RECEIVED unchanged; document flag false; final metadata/download both 409 FINAL_RECEIPT_NOT_READY |

Saved file: `CKS-Go-Payment-Receipt-CKSGO-20261003-00003.pdf`. SHA256: `e2e62388e3e7de96f91db461405fc415a87af9a7875caf3e6321606b9d95d8fe`. Repeated authorized PDF requests return identical bytes. All three document routes return 404 for a different customer.

Browser exception coverage: injected download failure shows safe retry without the private diagnostic; a delayed response disables the loading action; a document lookup failure preserves tracking and recovers on Try again. Keyboard Enter invokes download. Receipt target is 44px tall and there is no horizontal overflow at 320x844, 390x844 or 430x932.

The local simulator return link leads to a fixture `/local-payment-return` 404. The journey returns to the original customer tab and uses its guarded Check Payment Status action after verified server finality. This is a local harness limitation; the native Savt launcher/Flutter return and file handling were not exercised. The browser event adapter did not report downloads reliably; the saved file, byte identity and extracted PDF contents provide the file proof.

## Tests and review

| Gate                                 | Result                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Focused orders tests                 | 99 passed, 7 files                                                                            |
| Focused orders + affected payment UI | 133 passed, 8 files                                                                           |
| Full customer local suite            | 866 passed, 57 files                                                                          |
| TypeScript                           | PASS: `tsc -b` and `tsc -p tsconfig.runtime.json`                                             |
| Production build                     | PASS: Vite production build, 104 modules                                                      |
| Formatting                           | PASS: changed source/report formatting and repository changed-file gate against starting HEAD |
| Browser E2E                          | PASS with the local return limitation above                                                   |
| Diff whitespace                      | PASS: `git diff --check`                                                                      |
| Credential-pattern scan              | PASS: no credential findings in changed files                                                 |
| Strict premium UI audit              | PASS: zero findings                                                                           |
| Independent code review              | No actionable findings, including the final guarded status action                             |

Tests were added before production changes; missing receipt behavior and the processing-state status action failed first and passed after implementation. Commands use the bundled Node runtime to execute the repository's scripts/tools. This customer package has no `pnpm check` or lint script; its applicable typecheck, build, test and changed-file formatting gates were run directly. No CI was started.

## User journey at 390x844

| Surface              | Rating         | Finding                                                                                                                                        |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| CKS Go entry         | CONFUSING      | The standalone local fixture requests OTP login again; the already-authenticated native Savt entry cannot be verified in this browser harness. |
| Address              | CLEAR          | Saved selected address and assigned outlet are visible; no unnecessary re-selection.                                                           |
| Catalogue            | CLEAR          | Search, product price and Add are straightforward; missing images and fixture names are test-data limitations.                                 |
| Product              | MINOR FRICTION | Storage wording such as ambient is less familiar than the rest of the customer copy.                                                           |
| Cart                 | CLEAR          | Quantity, removal, delivery address and review action are clear.                                                                               |
| Checkout             | CLEAR          | Item/delivery/processing amounts and the RM15.45 Pay action are explicit.                                                                      |
| Payment              | MINOR FRICTION | The local simulator return-link 404 requires returning to the original tab and explicitly checking status.                                     |
| Payment confirmation | MINOR FRICTION | A processing response says both Payment received and Payment is still processing, and native return recovery was not testable here.            |
| Order Confirmed      | CLEAR          | A backend-projected paid order shows its order number and View order.                                                                          |
| Current Orders       | CLEAR          | The new order appears with its amount and Order received status.                                                                               |
| Tracking             | CLEAR          | Four customer stages are readable without operational enum names.                                                                              |
| Payment Receipt      | CLEAR          | Payment received, a secondary download action and separate final-receipt availability are understandable.                                      |

## Click / decision friction

With the existing session and selected saved address, the RM15.45 fixture requires **7 meaningful taps to confirmation**: Add, Increase to two, View basket, Review order, Pay, simulator SUCCESS, Check Payment Status. View order and Download Payment Receipt add **2 taps**, giving **9 to the PDF**. Entry authentication and audit-only address/product exploration are excluded. Checking before order materialization can add another explicit status tap. The failed fixture return link adds an avoidable local-only navigation.

No new customer decision or confirmation screen was introduced. Reviewing the authoritative amount before Pay remains useful. Standalone Home exposes top, sticky and bottom Basket shortcuts. Checkout and receipt do not expose quote IDs, payment intent IDs, tokens, provider codes or internal order enum values; product storage ambient and the processing-state wording remain copy friction.

## Blocking UX issues

NONE remaining in the implemented frontend slice. The absent Payment Receipt action and local paid-processing recovery action were fixed. The local return-link 404 is recorded as a harness limitation with a working status-check route; native return acceptance remains unverified.

## Important UX issues

1. Verify authenticated native Savt entry and return on the actual Flutter host; the standalone OTP path does not prove the intended host journey.
2. Repair the local return fixture configuration in its owning workstream to remove the 404 and manual tab/status step.
3. Clarify processing-state copy in a bounded UX task while preserving backend finality and existing observation rules.

## Polish

1. Replace ambient with familiar customer wording if product storage information is customer-facing.
2. Review the standalone Home Basket shortcut duplication; embedded host already has its own canonical variant.

## Git, protected dependencies and publication

Starting customer HEAD: `7551db700043c5c567edbc40a3e71c1b9f9cdcfa`, initially clean. Branch: `codex/pay-receipt-fe01`. One local checkpoint is required after the gates; its final SHA and clean status are recorded in the completion response and external git evidence.

Protected cks-go unchanged: YES, `a37f46d45ccc42082affd0c063c68e843a85ea95`. Protected node-savt unchanged: YES, `141401632eaa85d96ef72c3c0b119e731a2091d9`. Both source worktrees retain their original clean state. No shared schema, backend domain, server routes or provider source changes.

Push: NO. PR: NO. CI: NO. Merge: NO. Deployment: NO.
