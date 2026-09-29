# CKS Go UX01 Market-Ready Frontend Plan

> Use TDD for behavior changes. Keep all work on `codex/cust-ux01-market-ready` until one final PR/CI cycle.

**Spec:** `docs/superpowers/specs/2026-09-29-cust-ux01-market-ready.md`

## Task 1 — Production Home parity

- Promote safe advertising slides out of DEV-only fixtures.
- Keep the existing carousel behavior/accessibility.
- Expand deterministic production category icon mapping.
- Use “Featured for You” on Home.
- Tests: production slides render with DEV false; zero external/untrusted destinations; category visual mapping is deterministic.

## Task 2 — Embedded shell cleanup

- Detect trusted native bridge presence once at app startup.
- In embedded mode remove duplicate web CKS Go/Back/Close chrome.
- Keep cart and delivery context.
- Standalone browser retains current web controls.
- Tests: embedded Home has no duplicate brand/close; standalone does; browse embedded has route title but no duplicate Back/Close.

## Task 3 — First-use readiness and address repair presentation

- Replace technical coordinate states with delivery-location language.
- Add readiness helper for ACTIVE + finite coordinates.
- Auto-route first-use/no-coordinate customers into a bounded setup/repair screen instead of showing catalogue failure.
- Keep real customer state/controller authority.
- Tests for no address, valid address, missing coordinates, repair copy and navigation.

## Task 4 — Delivery details form cleanup

- Remove customer-editable latitude/longitude.
- Add location result as an explicit input to address create/edit.
- Prefill recipient name/phone from customer profile where empty.
- Preserve exact backend DTO fields and validation.
- Tests: latitude/longitude never render as inputs; mutation still contains trusted provider coordinates; customer can edit allowed contact/address fields.

## Task 5 — Location bridge contract

- Add provider-neutral web `requestCurrentLocation` / `searchLocation` port with strict payload parsing.
- Hardened WebView uses trusted Savt bridge only; standalone browser may use browser geolocation for current position.
- No direct third-party geocoder calls from React.
- UI states: permission denied, unavailable, search, found, confirm.
- If approved map provider is absent, render honest location confirmation (no fake map).

## Task 6 — Native companion

- Savt Flutter: branded red CKS Go loading overlay.
- Extend trusted CKS Go bridge for current-location + address-search using existing `geolocator` and `geocoding` packages.
- Return only bounded location fields to trusted CKS origin.
- Do not enable WebView geolocation.
- Existing bootstrap/payment bridge behavior unchanged.

## Task 7 — Final verification / preview / publication

- Frontend: format, typecheck, full tests, build, diff review.
- Flutter: focused CKS Go tests + analyze for changed files.
- Update Railway UI-review service to this branch for visual acceptance.
- Verify Home production parity and first-use states at 320/390/430 and large text.
- One frontend PR and, because native UX/bridge changes are required, one Flutter PR.
- Merge only after both are green and compatible; production Railway deploy follows frontend merge.

## Consolidation verification — 2026-09-29

Existing PR #15 and native companion PR #3 are retained. Reconciliation repairs formatting, location validation, onboarding/loading gating, existing-address repair, save-error recovery, profile address creation, duplicate submissions, and default production-banner parity. Native repairs cover test compilation, timeout recovery, stale-document result fencing, strict platform payload validation and reduced-motion loading.

Local browser checks use explicitly synthetic data. The optional `scripts/check-ux01-browser.mjs` runs against a loopback DEV server with an existing Playwright installation via `NODE_PATH` and optional `CHROME_PATH`. It verifies 320/390/430/768 and simulated 200% text, new-address POST, same-ID repair PATCH, denial-to-search, no automatic location request, embedded chrome, banners and the preserved cart/quote/payment/order path. It is not real API, native-device or payment-provider acceptance.

Final approval requires an authorized signed-in Android device against real CKS APIs. No device was connected during local checks. Screenshot capture is pending explicit clarification of the prior no-screenshot instruction. Neither PR may be merged or production deployed by this consolidation task.
