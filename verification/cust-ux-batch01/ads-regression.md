# Advertisement regression evidence

Amendment 4 retains the existing current-main advertisement implementation. No advertisement production file changed.

The supplied production evidence says Railway tracks `qualification/fe-final01`, which lacks the MERCH advertisement client, and the live frontend has made zero customer advertisement requests. This is recorded as supplied deployment evidence; this local batch does not access or alter Railway, deploy, or inspect the live service.

## Existing production path

- `src/catalogue/api.ts:89` requests exactly `GET /api/v1/customer/advertisements?placement=HOME_HERO`, with credentials, `no-store`, the existing abort signal, and the strict parser.
- `src/catalogue/advertisements.ts:48` accepts only the exact public envelope and advertisement/action keys, validates identifiers and managed artwork paths, limits the feed to ten unique records, and rejects malformed or unsafe actions.
- `src/catalogue/state.ts:435` starts Home advertisement loading after successful address assignment and catalogue readiness. `loadHome` preserves generation/abort checks, hides failed feeds, and does not block Home or featured products.
- `src/catalogue/components.tsx:722` maps the backend advertisement records into artwork, alternative text, and the backend action. Development artwork is guarded by `import.meta.env.DEV` and explicit development controls; production has no hardcoded advertisement fallback.
- `src/catalogue/components.tsx:1143` renders the carousel on ready Home. An empty feed renders no carousel through `AdvertisingCarousel`.
- `src/catalogue/AdvertisingCarousel.tsx:268` renders HQ artwork without fabricated CTA/text overlays. `NONE` has no banner button. `PRODUCT`, `CATEGORY`, and `EXTERNAL_URL` retain their distinct accessible action names.
- `src/catalogue/components.tsx:779` retains safe external URL handling and fresh outlet-scoped product/category resolution before navigation.

## Focused regression

Existing focused coverage passed before adding tests: **83 tests in six files**.

Added `src/catalogue/home-advertisements.test.ts`: **12 tests**, using the real `CatalogueApi`, strict parsing, `CatalogueController`, and `AdvertisingCarousel` with local complete HTTP fixtures. No advertisement production change was needed.

The added regressions verify:

- The Home feed is requested once, only after valid assignment and catalogue readiness, with exact `HOME_HERO` placement, GET method, credentials, no body, and the expected public headers.
- No feed request occurs without an authenticated customer, while addresses load, without an address, without coordinates, or when assignment belongs to a different address.
- Backend-managed artwork and alternative text reach the real carousel, and all four action projections keep their rendering semantics.
- A fresh empty response removes an existing banner and leaves Home ready, with no hardcoded fallback.
- A fresh malformed response containing a private advertisement field is rejected by the HTTP/parser boundary and removes the previous banner, with no fallback.

The server-rendered carousel assertion exercises its real artwork component. Browser acceptance must separately exercise the actual `CatalogueApp` effect that maps Home state into slides; this unit integration test does not run browser effects.

Combined focused command:

```powershell
node node_modules/vitest/vitest.mjs run src/catalogue/advertisements.test.ts src/catalogue/api.test.ts src/catalogue/state.test.ts src/catalogue/AdvertisingCarousel.test.tsx src/catalogue/refresh.test.ts src/catalogue/home-advertisements.test.ts src/webview/external-link.test.ts
```

Result: **95 passed, 0 failed, seven files passed**. The existing selection retains product/category target resolution, stale response suppression, failed artwork handling, empty/static feeds, accessible carousel controls, refresh behavior, and external URL safety.

Actual Home banner and empty-feed browser rendering at 320, 390 × 844, and 430 pixels passed in the shared actual-main embedded fixture. `startup-browser-report.json` records 18 passing startup/Home checks, including the backend-returned NONE advertisement image/alt text and carousel removal after an empty response. This exercises the real `CatalogueApp` effect that the server-rendered test cannot exercise. Physical WebView evidence remains **PENDING**.

No full broad suite was run for this amendment. No backend, Flutter, Railway, push, PR, CI, merge, or deployment action occurred.
