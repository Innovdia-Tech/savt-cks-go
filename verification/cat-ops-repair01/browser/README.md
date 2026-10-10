# CAT-OPS-REPAIR01-FE browser evidence

The BEFORE and AFTER browser runs passed in installed Chrome 154.0.8037.98 at
320px and 390px. `manifest.json` pairs all twenty captures and records SHA-256
for each screenshot and both served build artifacts. Each phase has forty
surface checks, sixty-four exact synthetic HTTP response comparisons and sixteen
exact server-PDF handoffs through the existing receipt controls.

Screens covered: catalogue card, product detail, Basket item, accepted Checkout
item and order item. Each screen runs with a populated barcode, a leading-zero
barcode, a historical omitted barcode and an explicit null barcode. The primary
leading-zero scenario supplies ten screenshots per phase. Populated and
leading-zero values appear on twenty BEFORE surfaces. All forty AFTER surfaces
omit the barcode label and raw barcode values.

The same API envelopes are consumed in both phases; their fingerprints compare
equal. Assertions preserve numeric names/descriptions such as `5kg`, `20 minutes`
and `2026`, approved Category/Subcategory, image fallback, selling price, quantity
two, draft subtotal, exact checkout item ID/quantity, accepted backend quote total
and frozen order name/quantity/line total. The Pay entry control remains enabled;
the harness does not execute payment. Both receipt download controls retain their
behavior and pass the exact supplied PDF bytes to the native bridge. Geometry
checks found no horizontal document/item overflow or overlap between purchase
controls and bottom navigation. Five BEFORE and five AFTER captures spanning
every surface and both widths were visually inspected.

BEFORE serves the existing readonly `customer-cat-cks-align02/dist` using that
checkout's actual runtime/server and proxy. Its source HEAD is
`b7f47ff4ded165161a6c2c0d84ad52afff495e8e`, with tree
`efe1073fb69e0ce4cafac2f33f3e5b6645f84a27`, equal to the new task's base tree.
The old checkout was never edited. AFTER serves the new task's actual build,
including `index-DL_onmaE.js` and `index-CwRMVKiH.css`. Every served build file is
hashed before the run and checked unchanged at completion.

This is LOCAL ONLY bounded screen evidence. The React app, API parsers/state
controllers, route/navigation behavior, same-origin runtime proxy, download
controls and native bridge payload code are real. Session/CSRF, member/address,
assignment/context, HTTP API responses, advertisements/support, fixed browser
clock, native host presence and native saved acknowledgements are synthetic.
Catalogue IDs/prices are derived to match the independent quote fixture; numeric
descriptions, frozen names and completed-order/document availability are explicit
synthetic derivatives. Product images are null and exercise the actual fallback.
No Playwright API response fulfillment is used; all API requests cross the actual
runtime proxy. Neither run contacted an external origin.

Original handoff JSON and the prior backend-rendered PDF bytes remain unchanged.
The PDF SHA-256 is
`ead9013ac7abc78f9b79837c3c9e519b9c9f747a5475f636efcc976558571b4f`.
The same static PDF is served at both receipt download endpoints to check byte
transport; this does not claim live receipt rendering, native file-system saving
or matching this synthetic scenario's edited display names to the PDF contents.

These runs do not exercise a Nest backend, database, real authentication/session
exchange, live payments or a physical native device. Prior ALIGN02 pinned Nest
evidence is retained separately and was not rerun for CAT-OPS-REPAIR01. No backend
checkout, branch, live data, publication, push, PR or deployment was changed by
this evidence work.

From the customer task root, after its AFTER build is ready:

```powershell
node verification/cat-ops-repair01/browser-proof.mjs before
node verification/cat-ops-repair01/browser-proof.mjs after
node verification/cat-ops-repair01/browser-manifest.mjs
```

The harness defaults to installed Chrome at
`C:/Program Files/Google/Chrome/Application/chrome.exe`; `CHROME_PATH` can override
it. Bundled Playwright is reused, with no browser or dependency download.
Keep `handoff/` files byte-identical when formatting other new evidence files.
