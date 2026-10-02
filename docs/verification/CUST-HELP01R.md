# CUST-HELP01R — final customer support UX polish

## Synchronization

All three existing `codex/cust-help01-whatsapp` checkouts were clean. Each stated support commit was present at HEAD. Origin was fetched and changes from the original support parent to current origin/main were compared: no advancement or support-file overlap was found. One requested rebase per branch completed as up to date, with no conflicts or rewritten SHA.

| Repository   | Existing support SHA (unchanged by synchronization) | Fetched origin/main                        |
| ------------ | --------------------------------------------------- | ------------------------------------------ |
| Backend      | `a1ae8a97dbdc3eda85eeee96cf4c8e63deef6185`          | `0e6b8edca12844954fa0d9f8c0c27156d7f4a23a` |
| Customer web | `3729357281a164054b1b8ca8ed37e1bbd2ece757`          | `a92e371424d856cd54aebcaa5b49d0c3043ee103` |
| Savt native  | `8ac35d86c8d2f2fb13cce921f075d21355feed6d`          | `b41cb8f1a0fb06f3b59dab611ab4ea47b23c08a4` |

## Customer presentation

- Home: compact “Need help? Get help” row, 14px/600 CKS red, outline icon, transparent tertiary action, minimum 44px target.
- Unsupported delivery: existing heading and saved-address description unchanged; Choose another address and + Add new address precede “Need help with your delivery address?” / “Get help on WhatsApp”. The competing Home help row is omitted in this state.
- Initial delivery setup: the same delivery help follows search/current-location controls and the confirmation/details controls as stages change.
- Order: “Need help with this order?” / “Get help on WhatsApp”, with the unchanged accessible label and fixed message containing only the displayed customer order number.
- Payment: general help follows existing recovery actions in failed, handoff-error, genuine initiation/status errors, voucher recovery errors and uncertain retry errors. Idle, ready, initiating/opening, checking, pending, returned unpaid (`retryable-pending`), retrying, paid/confirmed/paid-processing and session-expired states omit payment help.
- Missing/invalid recipient or invalid order number: no support button or invalid URL. Shopping and recovery remain usable.
- External-opening exception: “We couldn't open WhatsApp. Please try again.” The native host retains its safe unavailable feedback.

Backend-authoritative configuration, authenticated endpoint, closed projection, E.164 validation, generated messages, bridge validation, external application launch, WebView navigation policy, payment authority/return detection/retry/finality and Basket logic are unchanged. No new module, page, modal, floating bubble or navigation item was introduced.

## Files changed in this refinement

- `src/support/SupportAction.tsx`, `SupportAction.test.ts`: compact contextual copy, unique accessible description IDs, no invalid action and safe exception feedback.
- `src/styles.css`: secondary support row presentation only.
- `src/catalogue/components.tsx`, `components.test.ts`: move unsupported-address help after recovery and remove competing utility row.
- `src/customer/DeliveryLocationSetup.tsx`, `DeliveryLocationSetup.test.tsx`: support below setup controls, including confirmation.
- `src/orders/components.tsx`, `components.test.ts`: heading and action wording.
- `src/payment/components.tsx`, `components.test.ts`: read-only support configuration and help after genuine error recovery; no state/controller changes.
- `scripts/prove-customer-support.mjs`: reproducible synthetic browser journeys, lifecycle return observation, unavailable configuration and handoff failure, geometry/style assertions, Basket preservation and optional screenshot output.
- `DESIGN.md`, `UX-CONTRACT.md`, `docs/verification/CUST-HELP01.md`, this record: current design/behavior and bounded evidence.

## Verification

- Web bounded suite: 14 files, 175 tests passed. Covers support/config/message generation, setup/picker/readiness, unsupported-address hierarchy, payment components/return observer, order components, Basket/checkout binding and the four-item navigation shell.
- TypeScript: application build-mode and runtime-project checks passed.
- Production Vite build passed.
- Strict UI audit: zero findings.
- Touched-file Prettier and `git diff --check` passed.
- Backend focused support endpoint/config suite: 15 tests passed; no backend source changed, so no unrelated suites or extra backend commit.
- Native focused support parser/host suite: 39 tests passed. Analysis of the two support/host sources and matching tests found no issues; format check reported zero changes. Flutter-generated platform registrant changes were restored. No native source changed or extra native commit.

## Mobile/browser acceptance

The local Chrome harness passed at 320×844, 390×844 and 430×932 using synthetic fixtures and an intercepted recipient response. Actual WhatsApp was never contacted. Screenshots were visually inspected.

| Criterion                                                    | 320×844 | 390×844 | 430×932 |
| ------------------------------------------------------------ | ------- | ------- | ------- |
| A: Home discoverable and secondary                           | PASS    | PASS    | PASS    |
| B: Delivery recovery primary                                 | PASS    | PASS    | PASS    |
| C: Payment recovery primary                                  | PASS    | PASS    | PASS    |
| D: Order help contextual                                     | PASS    | PASS    | PASS    |
| E: Four navigation items                                     | PASS    | PASS    | PASS    |
| F: No floating support bubble                                | PASS    | PASS    | PASS    |
| G: No support overlap with Basket/nav or horizontal overflow | PASS    | PASS    | PASS    |

The harness checks Home with a nonempty sticky Basket summary, initial setup and confirmation, unsupported delivery, order enquiries, failed/unavailable payment enquiries, ready/pending/paid exclusions, keyboard activation, native dispatch, standalone opening and safe exception feedback. Support opening preserves the current route, Basket display and payment-disabled controls. Native host tests separately cover bottom safe-area/gesture clearance.

Local screenshots and browser log are stored outside the repository under `../cust-help01-evidence/polish/`. Reproduce with the existing Playwright install, Chrome and a local Vite preview using synthetic API/bridge adapters. `SUPPORT_EVIDENCE_DIR` optionally saves screenshots; `SUPPORT_PREVIEW_ORIGIN` selects the local preview.

Installed-device WhatsApp acceptance remains **PENDING**: correct recipient from Home/delivery/payment-error, displayed order number, actual external app launch and return with session/Basket/state preserved. Local browser/native tests do not prove installed app association.

One additional customer-web local commit is authorized. Backend and native commits remain unchanged. No push, PR, CI, merge or deployment.
