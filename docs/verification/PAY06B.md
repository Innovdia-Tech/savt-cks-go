# PAY06B local verification

Verified on 2 October 2026. This checkpoint implements customer payment retry
recovery in `Innovdia-Tech/savt-cks-go`.

## Authority and execution plan

The supplied PAY06B brief governs the customer outcome, copy, frozen API union,
security boundary, focused verification and local-only delivery. Backend behavior
was checked against the exact merged PAY06A commit
`7a4811263c2c532f958c9813d9002c0bf1f2237f`, including its retry service, controller,
OpenAPI and
[decision 0006](https://github.com/Innovdia-Tech/cks-go/blob/7a4811263c2c532f958c9813d9002c0bf1f2237f/docs/decisions/0006-checkout-abandoned-payment-retry.md).
The backend owns attempt allocation, ownership, financial finality and Order
materialization. HTTP 200 does not prove that a new charge was created.

The completed vertical slice followed this plan:

1. Verify repository, exact frontend base and frozen merged backend contract;
   create the requested isolated branch/worktree.
2. Add failing focused API/controller/rendered tests for the supplied PAY06B
   behaviors. Implement strict response parsing and the credentialed bodyless
   retry client. No persistence/schema change is required.
3. Add explicit controller retry with independent operation identity, bounded
   return checks, successor adoption, finality and session fencing.
4. Present the requested recovery/busy copy using existing Savt/CKS components,
   tokens, buttons, focus styles and responsive shell.
5. Run the payment and adjacent checkout tests, customer typecheck/build, local
   embedded browser acceptance and diff review. Independently review finality
   and uncertainty exceptions and add red/green regressions for findings.
6. Create one clean local commit and stop. Its SHA and post-commit clean status
   are recorded in the completion handoff.

## Repository checkpoint

- Verified frontend base: `2440202c82a990b0e075713976e69591c1ab0d28`.
- Branch: `codex/pay06b-payment-retry-ux`.
- Worktree:
  `C:\Users\isaac\Documents\ChatGPT\cks-go-m05b-clean\.worktrees\savt-pay06b`.
- Remote: `https://github.com/Innovdia-Tech/savt-cks-go.git`.
- No push, PR, merge, deployment, Flutter change or CKS Go backend change.
- Existing base-compatible dependencies were reused through a local ignored
  `node_modules` junction; the source lockfile remains unchanged.

## Exact API implementation

`PaymentApi.retry(paymentIntentId, idempotencyKey, externalAbortSignal?)` sends:

```http
POST /api/v1/customer/checkout/payments/:paymentIntentId/retry
Accept: application/json
Idempotency-Key: <UUID for this operation>
x-cks-csrf: <existing authenticated customer session CSRF>
```

There is no body and no added Content-Type. Both IDs use the existing UUID
validation conventions. The request runs through `session.withCredentials`,
includes credentials, disables caching and preserves the existing 15-second
timeout, external abort and expired-session behavior.

The strict `{ data: ... }` parser accepts exactly either:

```text
{ checkoutReference, payment: {
    paymentIntentId, status: PENDING|FAILED, checkoutUrl?, expiresAt?
} }
{ checkoutReference, status: PENDING|FAILED|PAID_PROCESSING|PAID,
  order: null | { orderId, orderNumber, status } }
```

Checkout references and intent/Order IDs must be valid UUIDs. Status must be a
literal string from the appropriate union; arrays and coercible values are
rejected. URL, when present, must be HTTPS without credentials. Expiry, when
present, must be a valid timestamp. Extra/mixed fields and inconsistent Order
shapes fail closed: only PAID may carry a valid Order, and PAID requires one.
The controller revalidates the retry response and requires its checkout reference
to match the active checkout before adopting anything or opening a page.

Added exact merged error allowlist entries:

```text
CHECKOUT_PAYMENT_RETRY_VOUCHER_UNSUPPORTED
PAYMENT_ATTEMPT_STATE_CHANGED
CHECKOUT_PAYMENT_CREATE_DISABLED
SAVT_PAYMENT_RECOVERY_FAILED
SAVT_PAYMENT_NOT_FOUND
PAYMENT_ATTEMPT_IDENTITY_MISMATCH
LOCAL_PAYMENT_INTENT_MISSING
CHECKOUT_MONEY_UNSAFE
CUSTOMER_COMMERCE_BLOCKED
PAYMENT_ATTEMPT_NOT_PENDING
CUSTOMER_ORGANISATION_FORBIDDEN
SAVT_INTEGRATION_UNAVAILABLE
```

Raw backend/provider messages are discarded and never rendered.

## State transitions and recovery

| Trigger/result                 | Behavior                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial Pay                    | Existing accepted-quote create/freeze/handoff flow remains.                                                                                                                                    |
| Successful handoff             | Waiting for payment confirmation; no retry action yet.                                                                                                                                         |
| Visible return                 | At most three coalesced GET checks, with existing 750/1500ms delays; no automatic charging POST.                                                                                               |
| Returned PENDING after checks  | Retryable pending; explicit retry and status actions.                                                                                                                                          |
| Retry tap                      | Require current intent/reference; save a fresh UUID operation key; clear old URL; enter retrying before awaiting. Double taps and concurrent status/return work cannot send another retry.     |
| Initiation PENDING with URL    | Adopt returned intent; open only its returned validated URL through the existing bridge.                                                                                                       |
| Initiation PENDING without URL | Adopt returned intent; remain retryable; never reopen a stale URL.                                                                                                                             |
| Result PENDING                 | Keep current intent and remain retryable; no handoff.                                                                                                                                          |
| FAILED                         | Safe failure with explicit retry/status or basket review when failure is definitive.                                                                                                           |
| PAID_PROCESSING                | Payment received/finalising state; charging and basket restart are blocked.                                                                                                                    |
| PAID with valid Order          | Confirmed Order flow; paid state is final.                                                                                                                                                     |
| Invalid/mismatched response    | Safe status-only error; no blind retry or URL handoff.                                                                                                                                         |
| Uncertain timeout/network      | Retain the exact source intent/key; the next explicit retry replays that operation. A later FAILED source read cannot justify a fresh key or basket restart while its successor may be active. |
| Failed return observation      | Explicit status recovery resumes bounded checking before pending retry eligibility.                                                                                                            |
| Voucher restriction            | Friendly basket guidance persists through unpaid focus/status observations and read failures. Later payment receipt supersedes it permanently.                                                 |
| Native handoff error           | Continue secure payment can reopen only the same checkout whose bridge handoff failed.                                                                                                         |
| Session loss                   | Clear payment/quote/URL/Order/retry memory and fence late completions.                                                                                                                         |

Payment receipt is monotonic. After a valid PAID_PROCESSING or PAID observation,
stale unpaid reads and subsequent read errors cannot enable another charge or
basket restart. Initial creation uncertainty and payment retry uncertainty retain
separate operation keys in memory.

## Customer copy

Returned unpaid pending:

> **Payment not completed**
>
> We haven't received payment confirmation. If you closed the payment page before
> finishing, you can try again.

Primary: **Try Payment Again**. Secondary: **Check Payment Status**.

Busy: **Preparing a new payment**; both actions disabled, with `aria-busy` and
polite live status. Immediate handoff: **Waiting for payment confirmation**.

Received: **Payment received — finalising your order**. Confirmed: **Order
confirmed**, with verified Order number and existing View order action.

Voucher restriction:

> This payment can't be restarted from this checkout. Please return to your
> basket and try again.

Its action is **Review basket**. No IDs, status constants, HTTP codes, provider
references, idempotency terminology or technical backend messages appear in the
payment panel.

## Focused verification

Final command, exit 0:

```powershell
node node_modules/vitest/vitest.mjs run src/payment/api.test.ts src/payment/state.test.ts src/payment/components.test.ts src/payment/contracts.test.ts src/payment/context.test.ts src/checkout/api.test.ts src/checkout/state.test.ts src/checkout/components.test.ts src/checkout/contracts.test.ts src/checkout/context.test.ts --reporter=default --reporter=json --outputFile=qa-pay06b-final-tests.json
```

| Test file                   |  Passed |
| --------------------------- | ------: |
| payment/api.test.ts         |      40 |
| payment/state.test.ts       |      56 |
| payment/components.test.ts  |      22 |
| payment/contracts.test.ts   |      15 |
| payment/context.test.ts     |       1 |
| checkout/api.test.ts        |      10 |
| checkout/state.test.ts      |      21 |
| checkout/components.test.ts |      23 |
| checkout/contracts.test.ts  |      22 |
| checkout/context.test.ts    |       3 |
| **Total: 10 files**         | **213** |

**Zero failures and zero skipped tests.** The final JSON report is retained with
the local evidence. Focused TDD reproduced missing retry behavior before the
implementation and reproduced each material review regression before its fix.

Customer typecheck and production build, exit 0:

```powershell
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
```

Vite 7.3.6 built 103 modules; main JS 438.25 kB / 128.80 kB gzip.
Changed-file Prettier (`--no-config`, matching this repository), strict premium
UI audit (zero findings) and `git diff --check` passed. Production and test diffs
were reviewed; an independent reviewer found no remaining material issue in the
final payment-receipt safeguards. No full repository suite or backend
`pnpm check` was run, as the supplied task explicitly limits verification.

## Mobile and browser acceptance

`scripts/prove-pay06b-browser.mjs` exercises the actual app with local synthetic
payment routes and the existing development/native bridge interface. Its test
instrumentation is confined to the browser harness. No production credentials or
GKash requests are used. All **14 scenarios passed**, with zero browser errors:

- Successor URL/intent adoption at **320, 390 and 430px**.
- At the primary **390px embedded viewport**: pending without URL, processing,
  paid Order, failed, voucher restriction, malformed union, uncertain retry,
  session expiry, narrow bridge-error reopen, return-paid and return-processing.

The harness checks bounded/coalesced return GETs, no premature retry, bodyless
retry headers, keyboard activation, duplicate-tap prevention, busy disabled
actions, successor status reads, no stale URL reopening, same source/key after an
uncertain request and subsequent source FAILED, no storage persistence, no IDs in
the route, at least 44px actions and no horizontal overflow. Screenshot inspection
confirmed clear unpaid/processing/confirmed distinctions, readable customer copy,
existing CKS-red primary actions and the established card/footer/shell layout.

Local evidence: **47 PNG captures**, `results.json`, final focused test JSON,
red/green diagnostic JSON and `premium-audit.json` under:

```text
C:\Users\isaac\.codex\visualizations\2026\10\02\01a0faca-fe7f-70a3-a101-c08c748875e2\pay06b
```

These are browser/embedded-fixture checks. Physical Savt WebView lifecycle and
real GKash/provider acceptance remain unverified by this local checkpoint.

## Full app/WebView restart limitation

Payment IDs, checkout references/URLs, session credentials, operation keys and
controller state remain in memory only. No payment/session persistence was added
to localStorage, sessionStorage, routes, fragments or globals. The native payment
handoff remains the existing transient bridge message.

A full app process kill, WebView destruction or fresh page load loses this
in-memory payment recovery context, including the operation key. PAY06B cannot
automatically resume the interrupted checkout after that event. Any future
restart recovery needs a separately approved trusted backend/native contract;
this slice does not invent persistent recovery or automatically create a charge.

## Changed files

- `src/payment/api.ts`, `contracts.ts`, `state.ts`, `components.tsx`.
- `src/payment/api.test.ts`, `state.test.ts`, `components.test.ts`.
- `src/checkout/components.test.ts` (adjacent waiting-state fixture/expectation).
- `scripts/prove-pay06b-browser.mjs`.
- `DESIGN.md`, `UX-CONTRACT.md`, `docs/verification/PAY06B.md`.

Existing bridge/session implementation, initial checkout contracts, runtime
configuration, styles/tokens, dependencies/lockfile, Flutter and backend sources
were not changed. Keep the local branch/worktree and stop after the one commit.

## Stale return-observation repair

The final local review of `5648e7dc91ddc95b2ab72e43ec468ac14edf32fe` found one
completion write outside the captured generation/intent fence. An old checkout's
third GET could resolve after session loss and a new checkout's first return GET,
marking the new sequence complete during its delay. Its next PENDING read then
made the new checkout retryable after only two of its own reads.

The supplied repair request requires stale completion to be a no-op. The repair
adds an immediate generation and active paymentIntentId mismatch return before
`returnChecksComplete = true`. Existing guards on the phase/URL/state update and
the observation promise's identity cleanup remain. No API, public state type,
component, charging, storage or persistence behavior changes.

Two deferred-promise regressions reproduce the exact old-third-GET/session-loss/
new-checkout race, with the new checkout's third result PENDING or PAID. Before
the fix both failed because the new intent appeared in only two GET calls instead
of three. After the fix both pass: stale completion publishes no snapshot change
and preserves the active intent, phase, error and Order. The new sequence performs
its own 750/1500ms delays and three reads; PENDING becomes retryable only then,
and PAID on the third read confirms the Order. No retry POST or extra handoff is
introduced. The same tests also assert that session loss first clears payment
state to session-expired.

Focused verification, exit 0:

```powershell
node node_modules/vitest/vitest.mjs run src/payment/state.test.ts --reporter=default --reporter=json --outputFile=qa-pay06b-repair-green.json
```

**58 passed, zero failed or skipped, one file**: the existing 56 controller tests
plus the two race cases. This includes normal bounded PENDING, PAID/processing/
FAILED, repeated retry taps and session-loss behavior. Changed-file Prettier and
`git diff --check` passed. Component/API tests, typecheck and build were not rerun:
their implementation, public state shape and production types did not change.
The 213-test set and browser matrix were not repeated.

Red and green JSON evidence is retained beside the original local PAY06B evidence
as `repair-red.json` and `repair-green.json`. Preserve the reviewed commit and
create exactly one follow-up repair commit; no amend, squash or publication.

## CUST-UX04 sync and publication gate

The subsequent approved sync request permits one branch push and one PR to main
after focused verification. It does not permit merging the PR or deployment.
The worktree started clean at the accepted repair
`7f8f6465199b9a276299977260677d4969824b06`. One origin fetch confirmed the pinned
main `507c33503e5c9dc76d13be6a63eb784c04292f83`, containing CUST-UX04 / PR #23.
No remote PAY06B branch or PR existed. Main is integrated by a normal merge;
accepted implementation and repair history are preserved without rewriting.

Conflicts were limited to `src/payment/components.tsx` and
`src/checkout/components.test.ts`. The resolution retains CUST-UX04's exact
initial “Payment pending” card, clock icon, status role, explanatory copy and
failed-payment basket guidance. PAY06B's recovery branches and explicit actions
remain. The checkout assertions retain four disabled controls and payment status
before the delivery and items cards. The merged payment phase table and browser
harness use the accepted initial heading and Savt session-expiry heading.

Initial pending says “We're checking your payment status.” and “Your order will
appear once payment is confirmed.”, without retry. Only returned PENDING after
three observations exposes “Payment not completed” and its two recovery actions.
The API, parser, controller and stale-return repair are unchanged from the
accepted repair. CUST-UX04's styles, checkout layout, session presentation and
app wiring match incoming main. No new browser persistence is introduced; the
full app/WebView restart limitation above still applies.

Focused sync verification, exit 0:

```powershell
node node_modules/vitest/vitest.mjs run src/payment/api.test.ts src/payment/state.test.ts src/payment/components.test.ts src/checkout/components.test.ts src/checkout/state.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
```

**172 tests passed in five files, zero failed or skipped**: payment API 40,
payment state/controller 58, payment presentation 23, checkout presentation 30,
checkout state 21. These include both stale-old-third-GET regressions, normal
three-read pending recovery, paid result, session loss, double taps and frozen
basket controls. No repository-wide suite was run.

The browser harness passed **14 synthetic scenarios**, with **47 screenshots**.
Initial pending, returned recovery and disabled retry were visually inspected at
320, 390 and 430px. No horizontal overflow or clipped actions appeared; controls
meet the 44px minimum. Inter, the soft green background, red primary action and
compact responsive basket layout remain. The harness additionally asserts the
initial copy, four disabled basket controls and absence of technical payment
copy. It verifies one retry POST per operation, successor handoff, no stale URL
handoff, uncertain-operation key reuse, terminal results and session expiry.
Physical Savt WebView lifecycle and real provider acceptance remain unverified.

Changed-file Prettier (12 files, explicit `--no-config` to avoid inheriting the
enclosing backend checkout's configuration), `git diff --check`, and the strict
design audit passed with no findings. A redacted local credential scan of added
lines in the unpublished diff against pinned main used 22 detectors and found
no credentials. Local test JSON, browser results/screenshots and scan evidence
are retained in the `pay06b/sync` evidence directory. Final read-only merge
review was CLEAN.
