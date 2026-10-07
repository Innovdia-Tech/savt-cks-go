# CUST-UX-BATCH01 local checkpoint

Branch: `codex/cust-fee01-small-order-explainer`.

Starting HEAD: `094a78e96851462b7c02cf147081a4642b16b2eb`.

Original base: `5b4d17dd4657a64bf63263d7e02f761dafca8c2b`.

## Amendment evidence

- `scroll-regression.md`, `scroll-red-report.json` and `scroll-report.json`
  identify the actual customer scroll owner and record visual suppression,
  wheel, keyboard, touch, navigation, overflow, modal scrolling and simulated
  safe-area checks at 320×844, 390×844 and 430×844.
- `address-report.json` records actual Home→delivery-address navigation,
  one native location request/reply, saved-coordinate reuse, missing-coordinate
  setup, genuine failure handling and superseded search/GPS intent checks.
  API, native and Google Map boundaries are local shims, not physical devices.
- `startup-trace.md`, `startup-red-report.json` and
  `startup-browser-report.json` trace document/bootstrap/authentication/loaded,
  profile, addresses, assignment/catalogue and stable Home. The web fix retains
  the embedded shell while customer reads are pending; the authenticated loaded
  handshake is unchanged.
- `ads-regression.md` records strict backend advertisement loading/rendering,
  `placement=HOME_HERO`, all four actions, empty/malformed feed hiding and no
  production fallback. Actual Home rendering is covered by the startup browser
  fixture. The Railway qualification mismatch is supplied evidence, not a new
  live-service claim.

## Address native follow-up

The web fixes isolate prior checkout errors from fresh address entry and fence
GPS completion against newer search/navigation intent. A shared coordinate
lookup keeps same-component current-location/recenter actions to one native
request without retries.

Full component unmount followed by reentry has a separate native boundary.
`address-native-boundary-report.json` records the actual web message shape:
`{"type":"location-current","requestId":"<UUID>","protocolVersion":"1"}`.
Each explicit tap sends its distinct request exactly once. Disposing the old
web port removes its listener but has no native cancellation message. The
inspected host at `cks_go_host_screen.dart:343` silently returns while
`_locationInFlight` is true. Its old UUID reply cannot complete the new request,
which times out in the source-matched browser model.

This subcase is stopped with **NATIVE FOLLOW-UP REQUIRED**: native must handle
cancellation/replacement or queue/respond with the new correlation ID. No
global web workaround, automatic retry or Flutter change was made. The report
includes the read-only native revision and line provenance; this is modeled
browser/source evidence, with physical WebView qualification still **PENDING**.

## Combined focused verification

Reproduce with `node verification/cust-ux-batch01/run-focused.mjs`.
The runner selects 23 affected test files covering CUST-FEE01, proxy forwarding,
AppShell, address/location, authenticated embedded startup and Home advertising.
It then runs the three browser drivers and checks changed-file formatting.
Exact commands, counts and results are stored in `focused-report.json`.
Logs and fixture caches remain local ignored files.

Final combined result: **574 tests passed across 23 files**, all **49 browser
checks passed** (scroll 18, address 13, startup/Home 18), and changed-file
formatting passed. All three browser servers confirmed cleanup. The separate
native boundary diagnostic is an expected unresolved host case, not a passing
physical acceptance claim. Fresh one-tap location already passed in the original
production-mode browser reproduction; the original physical incident's cause
remains unproven.

Production changes are limited to `src/styles.css`,
`src/catalogue/components.tsx`, `src/customer/DeliveryAddressPicker.tsx` and
`src/customer/DeliveryLocationSetup.tsx`.

This checkpoint runs focused verification only. The 1,290-test broad suite,
production build and broad TypeScript gate are deferred until the complete
customer-app batch is ready for the final broad gate.

## Preservation and boundaries

CUST-FEE01 production files are unchanged from the starting HEAD: the contract
header, strict new/legacy union, authoritative fee amount, small-order sheet
and stored order-detail fee metadata remain intact. Payment/return, receipt,
advertisement business rules and brand assets/tokens are unchanged.

Policies & terms UI, content and links remain deferred until the backend/HQ API.
No placeholder or checkout consent checkbox was added.

Physical Android/iOS WebView and assistive-technology acceptance remains
**PENDING**. Backend, Flutter and Railway were not modified. No push, PR, CI,
merge or deployment action occurred.
