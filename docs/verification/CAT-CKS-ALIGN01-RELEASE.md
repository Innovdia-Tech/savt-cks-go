# CAT-CKS-ALIGN01 customer release integration

The accepted R3 product identification and strict contract changes are integrated
onto customer main `5157ffca9452725649619e25c38ffe1bc60f27cc`, including the accepted
checkout, address and embedded UX from PR #35. Only the missing delta from
`d794e22459f0bc63fe23dceded6327ebc739dcff` to
`631e6f68f5c9b578d93e816feaa11f1de9f07630` was transferred through a three-way patch.
The original qualification branch and checkpoint remain unchanged.

Authority: the 9 October 2026 customer release integration/publication request;
R3 sections 1, 4A, 5, 7 and 9–10 cited in the accepted R3 verification report;
serializer-backed handoff; Phase 1 implementation contract sections 2, 4, 5, 9
and 12. This is a customer repository integration without backend, schema or
business-rule changes. Backend PR #136 at
`a6cf5850517d2c0b41aab78596bd3a9e403c0cc6` is the supplied final compatible contract;
its reported successful CI is reused, without a backend-suite rerun.

Catalogue/product, Basket/Checkout and order items display Item description and
exact human-readable Barcode, preserving leading zeroes. Closed legacy and CKS
shapes retain malformed-response rejection. CKS permits the implemented nullable
retired attributes and paired nullable UOM snapshots. Historical missing barcodes
remain omitted; accepted quote and order identity use frozen snapshots.

Implementation overlaps preserve the release's existing fee parser, Small Order
Fee bottom sheet and scoped fee-capability forwarding. Product capability is
forwarded on the four implemented product routes; quote and order detail retain
both capability headers. Existing address/GPS ownership, embedded startup,
advertisements, payment freeze/return and authenticated server receipts remain.
No divergent branch history or previous screenshot campaign was imported.

Local integration verification:

- 1,095 tests passed, zero failed or skipped, across 48 bounded frontend/runtime
  files covering product parsers/renderers, catalogue, checkout, orders, payment,
  WebView, addresses, session and actual proxy forwarding.
- Both strict TypeScript checks and the production Vite build passed.
- Changed-file formatting and diff whitespace checks passed. Windows checkout
  line endings were normalized by the existing formatter; the four imported
  serializer/joint JSON fixtures are byte-identical to their accepted R3 blobs.
- Independent read-only integration review found no material regression or
  unresolved security/business-contract conflict.
- A bounded built-app/proxy browser run passed at 320px and 390px: 12 screenshots
  cover minimal catalogue/product/draft basket, CKS quote/order and historical
  missing barcode; explicit-null historical barcode was additionally checked.
  No horizontal overflow was found. Both receipt controls handed off the supplied
  12,595-byte backend PDF byte-identically to the emulated native save bridge.

The initial focused run's sole failure was the existing order API test's exact
header assertion, updated to require both capabilities. The browser harness's
older synthetic server lacked the release's advertisement route; adding its
truthful empty response corrected that evidence boundary. Sandbox realpath and
loopback restrictions required normal local filesystem/network access for the
same tests/build/harness. These were tooling/fixture issues, not product changes.

Prior R3 evidence at `631e6f6` is reused for unchanged legacy/minimal/malformed
variants, 80-character wrapping, frozen identity after master edits and the
bounded real-service joint check. The latter used actual customer APIs/proxy,
backend services/serializers and isolated PostgreSQL, with identity, assignment,
routes and historical paid-order creation simulated. Fresh browser checks use
the actual integrated React app/APIs/proxy and synthetic HTTP/session/address/
native boundaries. They do not qualify physical devices or live payment.

The empty-postcode order/receipt blocker is corrected in the follow-up to
`00db6db9e9f8241161d273608893eafe29dddb21` on the same PR #36 branch. The cause was
the order-detail parser's nonempty `text()` check rejecting the backend's literal
empty-string frozen postcode. Read-only checks at pinned backend
`a6cf5850517d2c0b41aab78596bd3a9e403c0cc6` confirm checkout snapshots absence as
`postcode: address.postcode ?? ''` (checkout-quote service line 407), payment
materialization copies the frozen quote field (line 312), and the order reader
returns it unchanged (customer-orders-read service line 351).

Only the local order-read postcode predicate now permits that exact empty string
alongside existing valid populated strings. The key remains required; null,
missing/undefined, nonstring, whitespace-only and overlength values still reject.
The existing 24-character bound and raw snapshot are retained. Shared `text()`
and `exact()` validation, address creation/editing, quote/payment, auth/ownership,
receipt eligibility and download validation are unchanged. Delivery details omit
the missing postcode and its separator, without current-address backfill,
snapshot rewriting, address editing or a new payment attempt.

Correction verification:

- Existing legacy, CKS and persisted paid-order serializer fixtures reproduce
  the boundary by changing only the frozen postcode. Initial focused result:
  41 passed and 5 failed (three read-contract cases, clean address presentation,
  and paid-order/receipt access); after correction all 46 pass.
- 329 relevant order/API/component/receipt, R3 identity and unchanged address
  validation regressions pass across 11 files, with zero failures or skips.
- Both strict typechecks, production build, touched-file formatting and diff
  checks pass. Independent read-only review found no material issues.
- One bounded 320px/390px built-app/proxy check passes with two screenshots:
  empty-postcode paid/completed order details and eligible receipt controls are
  reachable, with no missing-postcode separator, malformed address punctuation
  or horizontal overflow. Both server receipt paths preserve the supplied
  12,595-byte PDF through four byte-identical native-emulation handoffs.

Unchanged catalogue, fee and PR #35 acceptance evidence above is reused.
Correction red/green reports, pinned-contract proof, scoped regression report,
browser/provenance evidence and committed-file credential/scope audit are retained
under the adjacent `postcode-correction/` evidence folder. The exact correction
HEAD and new automatic CI registration are recorded after the single normal
push to PR #36; the previous green CI is not rerun.

Remaining acceptance: physical Android/WebView R3 and postcode-correction
acceptance; full production
Nest/auth/session/payment qualification; live catalogue/image/commercial inputs
where separately authorized. Compatible frontend/proxy qualification precedes
enabling minimal-product use, with the independent fee activation gate retained.

Review publication uses one branch `codex/cat-cks-align01-customer-release` and
one PR to customer main after committed-file credential/scope checks. Exact
committed HEAD, PR and automatic CI registration are recorded in the adjacent
local publication manifest. Stop after registration; no CI waiting/polling,
merge, auto-merge, deployment, Railway changes, qualification push, APK rebuild,
live payment or catalogue/price import.

Full local integration evidence is retained beside the preserved checkpoint in
`exports/fe-final01/evidence/cat-cks-align01-release/` in the shared workspace.
