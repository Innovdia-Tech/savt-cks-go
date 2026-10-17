# LEGAL-ADMIN01 customer verification

Local synthetic evidence, 17 October 2026. These checks do not approve policy text,
publish a policy, enable checkout acceptance, or verify a deployed environment.

The actual customer application uses its existing development session and commerce
adapters. `browser.mjs` intercepts only the new published-policy read and support
lookup; requests outside the local origin are blocked. Publication fixtures include
an explicit synthetic-text marker. Draft screenshots show the existing preview
fixture, not a saved HQ draft. Saved draft review belongs to authorized HQ Preview.

| Check                                                   | Result                                               |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Focused legal, Orders, startup, checkout and Back tests | 204 passed, 9 files                                  |
| Application and runtime TypeScript checks               | Passed                                               |
| Standard and preview01 Vite builds                      | Passed; existing chunk-size advisory only            |
| Bundled original draft paragraphs                       | Standard: 0/49; preview01: 49/49                     |
| Strict premium static audit, including src/legal        | 0 findings                                           |
| Real Chromium application checks at 320, 390 and 430 px | 9 journeys passed; 13 screenshots; no browser errors |
| Independent customer integration review                 | No concrete must-fix findings                        |

At each width, the browser checks all four published policies, paragraphs and
ordered/unordered lists, effective date, section jump focus/scroll, horizontal
overflow, Orders selection and close/Back focus restoration. It then checks the
restricted static draft fallback and failed-read state. A populated basket and
quote survive the checkout reader round trip; payment remains disabled by the
existing preview guard and no acceptance checkbox appears. API/parser tests also
cover empty/malformed payloads, session expiry/logout races, deadlines and
HTML-like text rendered without DOM injection.

`browser-results.json` records the observed GET requests and checks. Screenshots
are named by viewport and state: `*-published-centre.png`,
`*-published-reader.png`, `*-preview-draft-reader.png`,
`*-checkout-return.png`, and `390-read-error.png`.

To reproduce, start Vite in `preview01` mode at `127.0.0.1:5348` with
`VITE_CKS_GO_DEVELOPMENT_API=true` and `VITE_CKS_GO_DEVELOPMENT_BRIDGE=true`, then run
`node verification/legal-admin01/browser.mjs`. Install Playwright or set
`PLAYWRIGHT_PATH` to an existing package. The default browser is installed Chrome;
`CHROME_PATH` can override its executable and `CKS_LEGAL_ORIGIN` can override the
local origin. Typecheck/test/build commands are recorded in
`docs/legal-admin01-reader-integration.md`.

Live customer session/proxy integration and physical Savt WebView behaviour remain
coordinated QA checks. No backend persistence or HQ authorization claim is inferred
from these customer-only synthetic results.
