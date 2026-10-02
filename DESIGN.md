---
version: alpha
colors:
  cks-primary: "#E52329"
  cks-primary-hover: "#C91D23"
  cks-primary-pressed: "#AB171C"
  savt-reward: "#4CAF50"
  savt-reward-dark: "#3F8E1E"
  background: "#EBF3E3"
  surface: "#FFFFFF"
  border: "#E9E9E9"
  text: "#231F20"
  text-muted: "#666666"
  icon-muted: "#878787"
  info: "#3B82F6"
  warning: "#F59E0B"
  error: "#EF4444"
typography:
  heading-large:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    lineHeight: "28px"
  heading:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    lineHeight: "28px"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: "20px"
rounded:
  button: "14px"
  card: "16px"
  chip: "999px"
  sheet: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  primary-button:
    backgroundColor: "#E52329"
    textColor: "#FFFFFF"
    borderRadius: "14px"
  reward-chip:
    backgroundColor: "#EEF8E8"
    textColor: "#3F8E1E"
    borderRadius: "999px"
  app-shell:
    backgroundColor: "#EBF3E3"
    maxWidth: "430px"
---

# CKS GO customer catalogue, checkout and orders

## Overview

CUST-FIGMA01 establishes a CKS-first retail foundation for the customer mini-app inside the Savt identity, rewards and payment ecosystem. The north star is the approved 390px Figma customer system: compact grocery utility, quiet warm-neutral surfaces, confident red commerce actions, and green used only when Savt reward or positive ecosystem meaning is earned. The interface must never read as a generic green fintech shell or as a desktop grocery marketplace stretched edge to edge.

The product register leads: fast scanning, stable state rendering, accessible touch targets and backend-authoritative evidence outrank decorative novelty. The visual signature is the disciplined CKS-red action line running from product Add through checkout, payment, active navigation and order actions; everything around it stays restrained.

Primary design authority: Figma file `ncty6c6YIPuFnHymP2nqos`. Node `25:55` (`Customer_Design_System_Board`) supplies tokens and component guidance; node `14:5` (`06_CKS_GO_Home__Serviceable_Frame`) supplies the canonical serviceable-home composition; page node `3:3` supplies Phase 1 screen context. The earlier file `UXedi4eBmFntqpwNzIAiXj` is secondary only and was not needed to resolve this foundation.

Runtime ownership uses Model B: CSS custom properties in `src/styles.css` own accepted values; `tailwind.config.js` maps semantic aliases to those properties; this file mirrors values and explains intent. Shared components consume semantic roles, never independent copies.

The CUST-UX04R2 refinement preserves the accepted Savt Home reference and soft green page. Home uses four equal category columns with unchanged approved artwork contained in white rounded 68px tiles (64px at 320px), equal 6px padding and reserved two-line authoritative labels. The label-to-Featured heading gap is 20px. Basket groups delivery, Your items and Order summary on quiet white surfaces with 16px section gaps. Quantity and secondary Remove sit beside the product details, with labeled Item subtotal below. Summary amounts retain their existing sources; Total remains strongest. Delivery details keeps native disclosure semantics with a decorative rotating chevron, and confirmed fees use a compact neutral check row. Existing payment-frozen state places payment status first and visually disables basket mutations. Pending remains a static clock status after bounded observation; confirmation requires the unchanged backend-authoritative finality rules.

CUST-UX04R3 refines only Basket item rows. A single white Your items surface uses neutral dividers, contained 64px images and grouped product details. At 390/430px, a stable 122px quantity control and secondary Remove occupy the right column; ordinary middle rows are 101px and a line subtotal adds 24px. Names retain their authoritative text with a two-line visual clamp. At widths below 360px, quantity and Remove share one compact row beneath the image/details, with the optional subtotal below. The visible order and DOM order are product details, quantity, Remove, then subtotal. The subtotal amount is 14/600, secondary to Order Total. The shared stepper keeps 44px buttons through a Basket-only padding override. All accepted Home, summary, payment, navigation and media behavior remains unchanged.

## Colors

CUST-HELP01R uses compact support rows with 14px/600 CKS-red text, a small outline help icon, a transparent tertiary action and a minimum 44px target. The muted prompt is “Need help?” on Home/payment errors and “Need help with your delivery address?” after delivery controls. Order detail retains its light section with the heading “Need help with this order?”. Support stays in document flow; address/payment recovery retains visual priority. Missing/invalid config hides the action; launch failures use restrained status text. The four navigation items and accepted commerce styling remain unchanged.

- CKS Red is the primary commerce/action role: Add to basket, checkout, payment, order actions, active customer navigation and Basket emphasis.
- Savt Green and Savt Green Dark are reserved for Savt Cash, rewards, savings, earned benefits and positive Savt ecosystem messages. Green is not the universal CTA color.
- CUST-UX04R uses Savt Home’s soft green page family (#EBF3E3), white fields/cards and neutral ink. Supporting text uses #666666 for normal-text contrast on green and white; #878787 is reserved for neutral icons. Info, warning and error are semantic and always paired with copy/icon/shape, never color alone.
- Error red and brand red have different roles even when visually related: destructive/error messaging uses the error token; ordinary safe commerce uses CKS primary.
- Small CKS-red text uses a white surface to retain AA contrast with the exact brand red. Search actions, catalogue links and selected category chips preserve neutral white backing rather than introducing another red.

## Typography

Inter uses the same locally bundled regular, medium, semibold and bold assets as Savt, with the system stack as fallback. Main titles and Home section headings are 20/28 at 700; other sections are 16/24 at 600; product names 14px at 600 with two lines; prices 16px at 700; body 14/20 at 400; supporting copy 13px at 400; meta 12/18 at 400; buttons 14/18 at 600; See all links 14px at 500; navigation labels 12px at 500. The Flutter host title is Inter 18px at 600. Feature files consume the shared type scale. Decorative lettering may retain a heavier weight, but ordinary customer hierarchy stops at 700.

## Layout

The Figma reference is 390×844, but production is fluid from 320px upward. The application uses the full phone width, preserves one canonical content scroller, and applies safe-area insets to top chrome and bottom navigation. At tablet and desktop widths it remains intentionally mobile-app-like, centered within a maximum 430px shell instead of stretching product cards across the viewport. Page padding follows the 20–24px Figma rhythm.

## Elevation & Depth

Static surfaces use light semantic borders. Product cards and category artwork have no decorative shadow; persistent navigation uses the restrained `0 -2px 8px rgb(35 31 32 / 4%)` shadow. Heavy elevation and decorative glass effects are anti-references. Loading, empty and error swaps reserve compatible geometry.

## Shapes

Buttons/fields use 14px radii, cards 16px, chips/badges full pills, and sheets 20px. Important mobile controls target 48px height (44px minimum). Radius communicates component family rather than novelty; feature-specific arbitrary rounding is drift.

## Components

CUST-UX06 keeps one Home Categories action, “Browse all”, and removes the Featured products action and general Home help. General help is a compact white Orders row directly below the header, with the existing outline help icon and CKS-red action. Orders has one neutral 44px refresh icon in the web header; its zero-order state uses the receipt icon and centered Browse products action. Contextual delivery, payment-error and order-detail support retains its existing presentation and behavior.

The shared SearchField owns its single clear control: a neutral small × inside the field, a transparent 44px target, and reserved right padding. Its scoped CSS suppresses WebKit cancel/decoration controls while preserving search input semantics, keyboard submission, focus, composition and debounce. Product detail uses 16px page insets, a white contained-media surface with the existing 20px sheet radius, separate unboxed product information, and one subtle metadata card. The existing 16px price role and sticky purchase owner remain canonical.

- Primary button: solid CKS Red with white text, stable disabled/loading geometry and a visible CKS focus ring.
- Secondary button: white/light surface, semantic border and dark text. Tertiary actions are restrained text buttons.
- Product card: bordered white card, reserved image geometry, 14px name, CKS-red price/action, and only contract-supported availability. Reward chips appear only when reward data exists.
- Search: light neutral fill, no prominent border, 16px input text, search icon and app-owned clear action. Inputs/textareas retain labelled controls and visible focus. Textareas do not expose manual resize.
- Bottom navigation: Home, Browse, Basket and Orders only. Browse shows backend-visible outlet categories; Home previews the preferred available Phase 1 subset with approved local artwork. Active navigation uses CKS-red outline icon and label without a stacked underline or pill. Navigation icons use a 24px canvas, 2px stroke and rounded caps/joins; Orders uses a receipt icon. Account is hidden until a supported route exists.
- Basket summary: when nonempty, a CKS-red merchandise subtotal control sits immediately above bottom navigation. It uses the current cart lines, omits fees and trusted-quote adjustments, and hides on Basket. Its confirmation motion respects reduced-motion settings.
- Loading/empty/error: shared stable-footprint components with human-readable copy and safe recovery. Raw backend codes never render.
- Quantity sheet: native accessible dialog foundation, viewport-bounded with safe-area padding. Quantity controls are pill-shaped with named increment/decrement buttons.

## Do's and Don'ts

- Do keep session, catalogue, cart, quote, payment, order, receipt and bridge authority in their existing controllers/contracts.
- Do use CKS red for commerce and Savt green for rewards/success.
- Do verify at 390×844, 430×932, 768×1024 and 1280×900.
- Don't add unsupported routes/statuses or infer business state from Figma.
- Don't paste Figma absolute positioning, hide scrollbars, persist customer context, or invent logo assets.

CUST01B through CUST03B extend the existing English-language, Malaysia-focused mobile grocery prototype. CUST-FIGMA01 supersedes the former universal green action palette with the approved CKS-first semantic split while preserving Inter/system typography, rounded white cards and the 430px shell. CUST03B added backend-authoritative customer order history, detail, tracking and receipt download after CUST03A payment finality. CUST-CANCEL01 removes customer cancellation actions after Order creation while keeping historical cancelled/refund presentation. It does not add frontend Order creation, infer fulfilment state, or change the backend.

## CUST-UX05 feedback and refresh

Home success feedback uses the shared `CustomerNotice`: a small white status toast with a subtle positive check, polite live announcement and no reserved document-flow space. Its explicit success timer runs for 2.8 seconds after a successful address save and address-list read; actionable recovery remains inline. The shell owns transient announcements on its screens. Pull feedback uses a compact white top indicator with CKS-red arrow/spinner and “Pull to refresh”, “Release to refresh”, or “Refreshing…”. A neutral 44px Refresh icon provides keyboard/click access through the same guarded path. No content translation or decorative motion is added; the spinner is static under reduced motion. Existing CSS variables own surface, border, radius, positive color and toast stacking. The delivery-unavailable state keeps its approved card/CTA/navigation structure with a decorative rounded-stroke 24px unavailable-location icon and neutral pull education only where refreshing is enabled. Category artwork, columns, geometry and authoritative labels remain unchanged.

## Runtime owners

- Existing visual tokens: CSS variables in `src/styles.css` are canonical; `tailwind.config.js` is the semantic adapter.
- Customer feature styles: `src/customer/customer.css`; white/surface cards, semantic borders, CKS-red commerce actions and Savt-green reward/success treatments.
- Customer forms: `src/addresses/AddressForm.tsx`; 16px inputs and 44px action targets.
- Lifecycle and feedback: `src/customer/state.ts`, `errors.ts`, `components.tsx`.
- Session authority: existing `src/session/controller.ts`; its credential callback is infrastructure-only.
- Customer orders: `src/orders/contracts.ts` (closed customer-safe projections), `api.ts` (exact customer routes), `state.ts` (memory, retry identity and request fencing), `context.tsx` (application ownership), and `components.tsx` / `orders.css` (presentation).

Use native buttons and labels. UX02 delivery selection uses full saved-address cards and a dedicated search state. The app-owned unsaved-change dialog uses native dialog focus and Escape behavior. Inline deactivation confirmation names its reversible effect. Customer data and drafts remain in memory. Never persist identity, address PII or CSRF.

Profile and address requests follow the CKS integration checkout DTOs and routes at `bac1f2f`. Mutations wait for the server. Reload all addresses after success because default changes update other versions. A conflict requires explicit reload; uncertain submissions retain the same immutable operation for retry. Order creation remains disconnected and backend-owned.

## CUST02B catalogue binding

The frozen `CUST02A-CP0-R2-assignment-context.md` is authoritative (SHA-256 `d662cca7e63d35fcadc8bd821710d8b769c71ac94408f952abc00822cde767f3`). Its data and lifecycle boundaries remain authoritative, while CUST-FIGMA01 supersedes its historical universal-green and two-column presentation with the CKS-red action hierarchy, Inter/system text, rounded white cards, 430px shell, category tiles and compact serviceable-home product list approved in Figma.

Runtime owners: `src/catalogue/contracts.ts` (closed wire projections), `api.ts` (credentialed requests), `state.ts` (memory and generation boundaries), `context.tsx` (read-only customer/session subscriptions), `components.tsx` and `catalogue.css` (presentation). Existing `CheckoutAddress` has a catalogue copy variant and continues to use the original selection controller. Address mutations, session and bridge protocols are unchanged.

The header displays the returned assigned outlet only after assignment. Home, Categories, search and detail consume real contract shapes; one MYR minor-unit price and two-state availability are the only commercial claims. Images reserve fixed space, use returned HTTPS URLs with lazy loading, and fall back to a neutral placeholder. Approval/host allowlisting remains the backend projection's responsibility.

Real catalogue navigation cannot reach the retained prototype commerce implementation. Add is disabled; Cart and Orders explain that ordering/tracking are not connected. No quote, payment, order, receipt or tracking request is made. `mockData.ts` is untouched.

Search is debounced 300ms with composition protection, explicit Enter and immediate clear. The search/category/page state and assignment context stay in memory, since they are session/address-specific. Hash navigation contains only screen names and product UUIDs. Address/context/filter changes reset pages. No assignment handle or address identifier enters a URL, browser storage, logs or analytics.

Development catalogue fixtures are dynamically imported only under the existing explicit DEV + development-API flags. A constructor production guard is an additional boundary. The development composition supplies synthetic coordinates on fixture address reads; production address data and mutation authority are unchanged. Fixtures reset on refresh.

## CUST02C cart and trusted quote

Runtime owners: `src/checkout/contracts.ts` (closed authoritative quote projection), `api.ts` (exact credentialed POST and stable attempt key), `state.ts` (cart, assignment transitions and quote lifecycle), `context.tsx` (customer/catalogue coordination), and `components.tsx` / `checkout.css` (presentation). Existing customer and catalogue owners remain canonical for saved addresses and assigned catalogue products.

The cart stores one assigned outlet and exact outlet-product identities with display snapshots, current displayed MYR price and bounded quantity. It merges only identical `outletProductId` values. It never searches for or remaps a replacement by product ID, SKU, barcode or name.

Changing to the same assigned outlet preserves lines and invalidates a quote. A different outlet commits immediately only for an empty cart. A nonempty cart uses an app-owned confirmation whose least destructive action receives initial focus; cancel preserves the committed address/outlet/cart, while confirm clears cart and quote before adopting the new assignment.

`POST /api/v1/checkout/quote` occurs only from an explicit cart action. The request contains outlet/address/outlet-product identities, quantities, delivery type, in-memory CSRF and one UUIDv4 key per attempt; it contains no client totals, fees, distance, ETA or prices. The response is parsed as a closed contract and displayed as server-authoritative. Price changes require explicit review, and expiry disables the quote until an explicit requote. Assignment context, CSRF, quote token and session credentials stay out of URLs, browser storage, logs and visible UI.

The historical CUST02C boundary ended after quote review. It is superseded only by the bounded CUST03A payment/result behavior below.

## CUST03A payment initiation and result

Runtime owners: `src/payment/contracts.ts` (closed payment projections and HTTPS checkout URL validation), `api.ts` (exact CKS Go payment routes), `state.ts` (payment lifecycle, retry identity, finality and session fencing), `context.tsx` (quote and visible-return observation), and `components.tsx` (customer-visible status). `src/webview/bridge.ts` owns the small native `payment-handoff` message; `src/checkout/state.ts` owns quote/cart freezing.

The customer web calls only `POST /api/v1/customer/checkout/payments` and `GET /api/v1/customer/checkout/payments/:paymentIntentId` on the configured CKS Go backend. Provider communication remains server-to-server. The web never calls Savt Payment, GKash, or another gateway and never creates an Order. The quote token is used only in the credentialed POST body and remains absent from URLs, storage, logs, bridge messages, and visible UI.

Payment starts only from “Proceed to payment” on an accepted, unexpired quote. The cart and address become immutable before POST. An uncertain create retry reuses the same UUIDv4 idempotency key. A successful create stores one PaymentIntent and the strictly validated HTTPS checkout URL in memory. A checkout may be reopened only when the native bridge failed to open that same checkout; ordinary unpaid return uses PAY06B recovery.

Production WebView navigation is not changed directly. The native bridge receives exactly `{ type: "payment-handoff", payload: { checkoutUrl } }` and production fails closed when the channel is absent or throws. The development bridge records this navigation request only; it cannot provide payment finality.

### PAY06B payment recovery

The PAY06B brief and merged PAY06A contract at `7a4811263c2c532f958c9813d9002c0bf1f2237f` supersede the earlier pending-reopen behavior. Immediately after handoff, retain CUST-UX04’s “Payment pending”, “We're checking your payment status.” and “Your order will appear once payment is confirmed.” presentation without a retry action. Visible return performs the existing bounded observations before unpaid pending becomes “Payment not completed”, with CKS-red “Try Payment Again” and secondary “Check Payment Status”. The primary action calls the bodyless credentialed retry endpoint; it never reuses an old URL. Both actions are disabled while “Preparing a new payment” is shown.

Only a returned initiation-style PENDING with a validated checkout URL opens that returned checkout through the existing bridge. “Continue secure payment” is confined to a failure opening that same newly-created/returned checkout. A retry result may instead be pending, failed, paid-processing or paid with a strict Order; a 200 does not imply a new charge. Receiving payment permanently removes retry eligibility. Uncertain retries retain their exact source intent/key in memory, including when the source subsequently reads FAILED. Voucher rejection keeps customer-friendly basket guidance through unpaid observations.

Tokens, cards, typography, focus styles and the 430px shell retain their established owners. See [PAY06B verification and restart limitation](docs/verification/PAY06B.md). No payment/session recovery is persisted across a full WebView or app process destruction.

External return, focus, visibility, redirect contents, and successful handoff are navigation signals only. Visible return may trigger at most three coalesced payment-result GET observations with bounded delays. `PENDING`, `FAILED`, and `PAID_PROCESSING` never render “Order Confirmed.” That reserved state appears only for `PAID` with a strict backend-projected Order identity matching the payment’s checkout reference. Logout/session loss clears all payment memory and invalidates late asynchronous completions.

## CUST03B order history, tracking and after-order actions

Source authority is the read-only CKS Go backend at `9f5b779e38eea447e0bf425e0489e70107231356`. The browser reads only `GET /api/v1/customer/orders` and `GET /api/v1/customer/orders/:orderId`, cancels only through `POST /api/v1/customer/orders/:orderId/cancel`, and downloads a receipt only through the exact backend-returned customer-safe path `GET /api/v1/orders/:orderId/receipt/download`. All responses are parsed as closed contracts; unknown, malformed, internal or newly added fields fail closed rather than entering presentation state.

History and detail display only backend-projected customer stages and milestones. The UI never derives a stage from timestamps, delivery records or payment state, and does not expose raw operational state, internal identifiers, rider data, SKU snapshots or provider details. Order identity may appear in the hash route only as the UUID required by the backend route; customer copy uses the order number.

Cancellation is offered only when the backend returns `canCancel`. The hint is not treated as authority: the backend rechecks eligibility. The empty request uses in-memory CSRF and one stable UUIDv4 idempotency key across uncertain retries. Success is rendered only from the returned cancellation projection; conflict and other safe backend failures remain non-confirming. The app-owned native dialog names the irreversible request, initially focuses “Keep order,” supports Escape, and does not optimistically change status.

Receipt download is visible only when the strict detail projection declares it available and returns paths matching the current order. The response must be a PDF. No receipt, order response, CSRF value, cancellation key or delivery address is persisted in browser storage. Logout/session loss clears order state and fences late requests. The CUST03A PAID-plus-valid-Order finality rule is unchanged; its “View order” action only navigates to the backend-backed detail route.

## UX01 — Native-Embedded Customer Entry

- CKS Retail red remains the primary commerce/action color.
- In Savt WebView mode, the native host owns Back, Close and the CKS Go app title. The React shell must not duplicate those controls.
- Standalone browser mode retains safe web Back/Close controls.
- Home merchandising is a production feature: curated CKS Go banner slides render without DEV flags; development controls only switch preview scenarios.
- A new customer must establish a usable delivery location before shopping. A saved address is usable only when ACTIVE with finite latitude and longitude.
- Latitude/longitude are infrastructure data and must never render as editable customer fields.
- Existing text-only addresses use a repair flow that preserves the saved address and adds the confirmed location.
- Current-location permission is requested only after the user explicitly selects that action.
- The hardened Savt WebView keeps browser geolocation disabled; current location uses the trusted native bridge.
- Do not ship a fake map or unapproved map/tile provider. Until an approved map provider is configured, use the honest location confirmation/search experience.

## UX01 consolidation precedence

The September 29 UX01 brief supersedes historical product-list presentation: Home uses the accepted two-column product grid with 1:1 contain-fit media. Native embedded shopping begins with delivery context and cart, followed by search, production banners, categories and Featured for You. Standalone web retains its header controls. The default development preview uses these same curated production banners; explicit developer scenarios remain available for edge-case checks.

Reconciled drift: historical CUST02B prose describes the earlier compact product list; the current two-column grid and production merchandising are the approved UX01 direction. Commerce, session, quote, payment and order authority stay with their existing controllers and backend contracts.

## UX02 — Delivery address and location

The Home delivery link opens a dedicated mobile picker with active saved-address cards, a visible selected state, current-location shortcut, search entry and add action. The selected state uses CKS red; Default remains secondary metadata. Inactive addresses belong to Profile management. Saved-address selection runs the existing authoritative assignment check before changing Home context. Text-only addresses enter location repair and retain the same address ID.

Typed search uses the authenticated CKS Go customer location API and bounded Google Places predictions. Search debounces at 300 ms, cancels stale work and keeps its session token only in memory. The customer chooses a prediction, confirms its resolved geographic location, then enters delivery details. Native GPS remains tap-initiated and returns to the same confirmation step. Delivery details prefill bounded text while coordinates remain hidden and attached to the confirmed point. The visual confirmation is textual until an approved browser map provider exists; it never imitates a map. Google Maps text attribution sits with the prediction list using the permitted compact presentation.

## CUST-UX04 Savt continuity

Runtime changes retain the accepted Home sequence and all controller authority. Embedded delivery context leads with Deliver to and a compact address chevron; standalone retains Change and its Basket shortcut. Embedded Home omits the redundant Basket circle; navigation and the merchandise-only sticky Basket bar remain available. Search retains its form, keyboard Search/Enter, debounce, composition and clear behavior without a separate visible submit button. The carousel retains slide authority, swipe, keyboard, named dots, pause/play and reduced-motion behavior; embedded controls use dots plus a small icon, while standalone arrows are restrained. Featured products avoids unsupported personalization. Browse consumes the existing accumulated ACTIVE category directory used by Home, without a second source or customer directory pagination; selected categories supply the screen/search title. Category artwork stays 64–68px with medium two-line labels. White product cards have contained images, light borders, no shadow and stable purchase targets. Inactive outline icons use #878787 while their labels use the accessible supporting neutral. Embedded Home relies on Flutter for Back, Close and the page-level CKS Go title. Prices/review errors use customer language; quote classes and payment finality remain internal and unchanged. Order stage PICK_AND_PACK renders Preparing your order.
