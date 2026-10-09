# Bounded ALIGN02 browser evidence

The harness passed with installed Chrome at 390px and 320px. `results.json`
contains the 16 screenshot inventory, geometry assertions, exact fixture
response comparisons, proxy capability/context observations and paired Nest
provenance/service/repository observations.

At each width the unchanged fixture boundary shows selected Rice, mapped product
details, return to the selected child, the draft basket and historical null
classification. The separate paired path runs the actual built React app through
its actual runtime proxy and pinned Nest catalogue controller/service, selecting
Approved Groceries -> Rice -> Brand Rice 5kg -> matching details -> Back.

Assertions preserve barcode `000123`, Item description, approved classification,
selling price, enabled purchase controls and the existing null-image fallback.
Historical null category/subcategory display `Not available`, without inventing
classification. Brand/UOM/Pack Size/Storage/source metadata do not gain separate
customer fields. No horizontal item/document overflow or overlap between the
purchase controls and bottom navigation was detected.

The handoff JSON bytes remain unchanged with SHA-256
`29f28b88f7f236d1eba6c3cbe9f3f655c86f4c6d70dda414294bdb9211868eb3`.
The supplied envelopes keep their historical metadata; fixture pages use a fixed
browser clock. The fixture-only list deliberately returns the supplied filtered
envelope for every product-list query. Real pair filtering is checked separately
through the pinned Nest service with its recorded predicates and synthetic
repository.

Synthetic dependencies: session status, loopback cookie/CSRF, member/address,
assignment/context/readiness, empty advertisements/support, native bridge
presence, browser-history return, fixed browser clock and in-memory repository.
The cookie name is deliberately `cksgo_evidence_session` over loopback HTTP;
production Secure/`__Host` cookie handling is not exercised. Both supplied product
images are null. No API route is fulfilled in Playwright, no external origin was
contacted, and no backend/customer deployment or live data was used.

This is bounded screen evidence. It does not claim full authenticated acceptance,
real identity/session exchange, PostgreSQL persistence, payment/receipt acceptance
or a physical native device run. Existing pinned backend build artifacts are
reused; their source SHA/timestamp verification and limitation are in the report.

Run after building the customer app, from its root:

```powershell
$env:CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node verification/cat-cks-align02/browser-proof.mjs
```

The first attempt found no downloaded Playwright Chromium executable. The final
passing run used installed Chrome without downloading browsers or dependencies.
