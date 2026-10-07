# CKSGO-BRAND01 shared assets v1.1

Approved operations branding implementation, 7 October 2026 (Malaysia/Singapore).
The supplied three-team brief is a reference; the pasted implementation request
authorizes this local HQ, Outlet and Rider package. No messages or changes have
been sent to the other repositories.

**v1.1 supersedes v1.** It corrects the original O/G sRGB fill mapping in the color
and white/blue masters, their application copies and derived app icons. The v1 ZIP
is retained as a historical artifact; use `CKSGO-BRAND01-v1.1-assets.zip` for new
consumers. Geometry, transforms, bounds, light fill and the all-white SVG remain
unchanged. UI tokens and product behavior are unchanged.

The canonical asset set is `packages/design-tokens/assets/`:

- `cks-go-logo-colour.svg`: page 1's light-blue CKS / blue GO, for white surfaces.
- `cks-go-logo-white-blue.svg`: page 2's upper white CKS / blue GO variant, for a
  suitable light-blue surface.
- `cks-go-logo-white.svg`: page 2's lower all-white variant, used on the dark-blue
  operations shell.
- `manifest.json`: source PDF SHA-256, original CMYK/spot fills, exported sRGB
  fills and per-asset SHA-256 checksums.

Each lockup has the five original outlined paths and transforms. Exporting removes
the page heading and page 2 background; it does not trace, redraw or generate a
new logo. Reverse bounds round outward to avoid clipping the original curves.
Use the full lockup with `object-fit: contain`; do not crop or stretch it.

Original artwork colors are retained through the supplied PDF's Poppler sRGB
conversion: light blue `#94D2E4`, O `#3570BC`, G `#3470BC`, and white where supplied.
These artwork values intentionally differ from the digital UI tokens. The PDF
contains inconsistent printed RGB/HEX values and no output intent. Its mockup
URLs, 24-hour wording and 30-minute graphic are visual references, not product
copy or business-rule authorization.

The original painted logo path order is C, K, S, O, G. O/path 4 uses CMYK
`0.867 0.508 0.035 0`; G/path 5 uses `0.871 0.508 0.035 0`. Direct PDF stream reads
and fresh Poppler source renders independently establish this mapping. The
exporter's lookup is not the verification oracle. See the focused
[v1.1 local handoff](../../verification/CKSGO-BRAND01-V1.1-LOCAL.md) and
[asset verification](../../verification/cksgo-brand01/correction-v1.1/asset-verification.json).

The shared UI token choices are:

| Role                       | Value                    | Use                                                     |
| -------------------------- | ------------------------ | ------------------------------------------------------- |
| Brand light blue           | `#8ECBE2`                | Explicit adopted digital HEX; selected surfaces         |
| Action blue                | `#0C74B6`                | Working digital value; white primary-button text        |
| Action hover / pressed     | `#09639C` / `#084F7C`    | Supporting UI choices                                   |
| Dark shell / selected ink  | `#123D56`                | White/reverse logo shell; text on light blue            |
| Shell secondary text       | `#C7E6F1`                | Text on dark shell                                      |
| Canvas / pale surface      | `#F3F8FB` / `#F7FBFD`    | Supporting UI choices                                   |
| Cards                      | `#FFFFFF`                | Existing card geometry, including scheduled/empty cards |
| Muted surface              | `#EAF2F6`                | Supporting UI choice                                    |
| Border / strong border     | `#D9E6ED` / `#B7CBD6`    | Supporting UI choices                                   |
| Body ink                   | `#26282B`                | Existing dark text                                      |
| Success / warning / danger | Existing semantic tokens | Preserve operational meanings                           |

White on action blue has approximately 5.01:1 contrast. White is not suitable for
normal text on light blue; use dark shell ink there. Action blue is not a suitable
normal-text foreground on light blue. Keep labels and semantic status colors.

Both staff apps receive byte-identical logo copies. SVG app icons contain the
original color lockup centered in a white 512px square. All artwork fits inside
the maskable 80%-diameter safe circle. PNG derivatives are 192px, 512px and 180px
(Apple touch); they are rendered from that SVG, not recreated separately.
Installed-app names, `start_url`, scope, routes and service-worker update policy
remain unchanged.

To reproduce from the supplied original PDF, use Python with pypdf:

```text
python scripts/export-cks-go-brand.py "CKS go_logo and mockup Proposal_18022025.pdf"
```

The exporter checks the approved source checksum. To regenerate app icon sizes,
run the existing Node/Playwright renderer:

```text
node scripts/sync-cks-go-brand-icons.mjs
```

Verify independently of the exporter with pypdf, Pillow and pdftoppm:

```text
python scripts/check-cks-go-brand-assets.py "CKS go_logo and mockup Proposal_18022025.pdf"
```

`CKS_BROWSER_NODE_MODULES` may point to a bundled Node modules directory containing
Playwright. Neither script changes business logic or contacts a live API.

Customer web and Savt Flutter can consume the three SVGs and this token mapping
without a new cross-repository package. Savt should retain its own general
identity and launcher icon; its CKS Go-owned surfaces use these assets within
the previously accepted single-header contract. Receipt/PDF redesign is outside
this checkpoint. Publication, CI, merge and deployment require separate user
authorization.
