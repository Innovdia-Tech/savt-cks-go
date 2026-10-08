# CUST-FEE01 local verification

Branch: `codex/cust-fee01-small-order-explainer`

Base: `5b4d17dd4657a64bf63263d7e02f761dafca8c2b`

The backend remains the fee authority. Quote and optional order-detail metadata
share one strict parser. The summary and sheet display `processingFeeMinor`;
the only presentation calculation is the quoted threshold minus the quoted
qualifying amount, when the charged outcome has a higher known threshold.

The user approved one additional production file, `runtime/proxy.mjs`, because
the existing same-origin proxy stripped the contract header. Forwarding is
restricted to quote POST and UUIDv4 order-detail GET. The existing global header
allowlist, cookies, framing and upstream routing remain intact.

Tests were added and observed failing before the contract, API, UI and proxy
implementation. Contract tests went from 26 failures to 228 passes; API tests
from five failures to 30 passes; render tests from eight failures to 47 passes;
the proxy contract cases from two failures to ten passes. Focused verification
also covered six existing proxy header, cookie and request-framing checks.

The browser harness mounts the real `CartScreen` and parses synthetic quotes.
Its amounts deliberately distinguish the authoritative charge, tier charge,
qualifying amount, displayed basket subtotal and delivery charge. It contacts
no backend or payment provider and uses no native bridge.

`browser-report.json` records the final 320×844, 390×844 and 430×844 matrix:
charged, zero, no-match, disabled, legacy percentage/fixed, null/equal/lower
thresholds, deliberate open/close, keyboard focus, Escape, backdrop, invalidation,
simulated 34px safe area, 200% text, long wrapping and horizontal overflow.
Native modal focus may visit browser chrome (represented by `BODY`); background
page controls remain inert. Physical WebView qualification is **PENDING**.

`red-report.json` captures the original component from the exact base, generated
temporarily without altering production source. This browser regression baseline
was captured after the current implementation and is labelled accordingly.
`null-threshold-red-report.json` records the wording regression before its fix.
`typography-red-report.json` records the enlarged-heading overlap before its
line-height fix. Normal heading metrics remain 20/28; enlarged text receives
proportional leading.

Reproduce browser acceptance with `node verification/cust-fee01/run-browser.mjs`.
The harness starts and closes its own loopback Vite server. Its optional `--red`
mode recreates the original-component regression baseline; `--unknown-only`
runs the focused nullable-threshold assertion.

The one broad local gate is `node verification/cust-fee01/run-local-gate.mjs`.
It runs the full test suite, both TypeScript checks, production Vite build and
changed-file formatting. Exact results and test counts are in
`local-gate-report.json`; logs are local ignored files. `premium-audit.json`
records the strict design audit.

The broad gate passed all 1,290 tests across 70 files, both TypeScript checks
and the production build. Its initial formatting check flagged only the generated
`premium-audit.json`. After formatting that report, the complete changed-file
formatting check passed. The original result and formatting follow-up are both
preserved in `local-gate-report.json`; the other gate stages were not repeated.

No push, PR, CI, merge or deployment was performed. Backend, Flutter, Railway,
payment controllers, receipt bridge, merchandising logic and brand tokens were
not modified.
