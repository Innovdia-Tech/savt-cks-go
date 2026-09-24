---
version: alpha
colors:
  cks-primary: "#E52329"
  cks-primary-hover: "#C91D23"
  cks-primary-pressed: "#AB171C"
  savt-reward: "#4CAF50"
  savt-reward-dark: "#3F8E1E"
  background: "#F8FAF6"
  surface: "#FFFFFF"
  border: "#E6ECE2"
  text: "#111827"
  text-muted: "#667083"
  info: "#3B82F6"
  warning: "#F59E0B"
  error: "#EF4444"
typography:
  heading-large:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    lineHeight: "32px"
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
    backgroundColor: "#F8FAF6"
    maxWidth: "430px"
---

# CKS GO customer catalogue, checkout and orders

## Overview

CUST-FIGMA01 establishes a CKS-first retail foundation for the customer mini-app inside the Savt identity, rewards and payment ecosystem. The north star is the approved 390px Figma customer system: compact grocery utility, quiet warm-neutral surfaces, confident red commerce actions, and green used only when Savt reward or positive ecosystem meaning is earned. The interface must never read as a generic green fintech shell or as a desktop grocery marketplace stretched edge to edge.

The product register leads: fast scanning, stable state rendering, accessible touch targets and backend-authoritative evidence outrank decorative novelty. The visual signature is the disciplined CKS-red action line running from product Add through checkout, payment, active navigation and order actions; everything around it stays restrained.

Primary design authority: Figma file `ncty6c6YIPuFnHymP2nqos`. Node `25:55` (`Customer_Design_System_Board`) supplies tokens and component guidance; node `14:5` (`06_CKS_GO_Home__Serviceable_Frame`) supplies the canonical serviceable-home composition; page node `3:3` supplies Phase 1 screen context. The earlier file `UXedi4eBmFntqpwNzIAiXj` is secondary only and was not needed to resolve this foundation.

Runtime ownership uses Model B: CSS custom properties in `src/styles.css` own accepted values; `tailwind.config.js` maps semantic aliases to those properties; this file mirrors values and explains intent. Shared components consume semantic roles, never independent copies.

## Colors

- CKS Red is the primary commerce/action role: Add to cart, checkout, payment, order actions, active customer navigation and cart emphasis.
- Savt Green and Savt Green Dark are reserved for Savt Cash, rewards, savings, earned benefits and positive Savt ecosystem messages. Green is not the universal CTA color.
- Background, surface, border, ink and muted text follow the Figma neutrals. Info, warning and error are semantic and always paired with copy/icon/shape, never color alone.
- Error red and brand red have different roles even when visually related: destructive/error messaging uses the error token; ordinary safe commerce uses CKS primary.

## Typography

Inter is primary with the system stack as a metric-compatible fallback. Large headings are 24/32 bold, section headings 20/28 semibold, body 14/20 regular, and supporting/meta text 12/18. Buttons use 13/18 semibold. Feature files should consume the shared type scale instead of inventing sizes.

## Layout

The Figma reference is 390×844, but production is fluid from 320px upward. The application uses the full phone width, preserves one canonical content scroller, and applies safe-area insets to top chrome and bottom navigation. At tablet and desktop widths it remains intentionally mobile-app-like, centered within a maximum 430px shell instead of stretching product cards across the viewport. Page padding follows the 20–24px Figma rhythm.

## Elevation & Depth

Static surfaces use borders first. Product/address cards may use the Figma soft shadow `0 5px 14px rgb(16 24 40 / 7%)`; persistent navigation uses a restrained upward shadow. Heavy elevation and decorative glass effects are anti-references. Loading, empty and error swaps reserve compatible geometry.

## Shapes

Buttons/fields use 14px radii, cards 16px, chips/badges full pills, and sheets 20px. Important mobile controls target 48px height (44px minimum). Radius communicates component family rather than novelty; feature-specific arbitrary rounding is drift.

## Components

- Primary button: solid CKS Red with white text, stable disabled/loading geometry and a visible CKS focus ring.
- Secondary button: white/light surface, semantic border and dark text. Tertiary actions are restrained text buttons.
- Product card: bordered white card, reserved image geometry, 14px name, CKS-red price/action, and only contract-supported availability. Reward chips appear only when reward data exists.
- Search/input/textarea: white surface, semantic border, 14px radius, labelled control, visible focus and an app-owned clear action for search. Textareas do not expose manual resize.
- Bottom navigation: Home, Categories, Cart and Orders only. Active commerce navigation uses CKS Red. Account is hidden until a supported route exists.
- Loading/empty/error: shared stable-footprint components with human-readable copy and safe recovery. Raw backend codes never render.
- Quantity sheet: native accessible dialog foundation, viewport-bounded with safe-area padding. Quantity controls are pill-shaped with named increment/decrement buttons.

## Do's and Don'ts

- Do keep session, catalogue, cart, quote, payment, order, receipt and bridge authority in their existing controllers/contracts.
- Do use CKS red for commerce and Savt green for rewards/success.
- Do verify at 390×844, 430×932, 768×1024 and 1280×900.
- Don't add unsupported routes/statuses or infer business state from Figma.
- Don't paste Figma absolute positioning, hide scrollbars, persist customer context, or invent logo assets.

CUST01B through CUST03B extend the existing English-language, Malaysia-focused mobile grocery prototype. CUST-FIGMA01 supersedes the former universal green action palette with the approved CKS-first semantic split while preserving Inter/system typography, rounded white cards and the 430px shell. CUST03B added backend-authoritative customer order history, detail, tracking and receipt download after CUST03A payment finality. CUST-CANCEL01 removes customer cancellation actions after Order creation while keeping historical cancelled/refund presentation. It does not add frontend Order creation, infer fulfilment state, or change the backend.

## Runtime owners

- Existing visual tokens: CSS variables in `src/styles.css` are canonical; `tailwind.config.js` is the semantic adapter.
- Customer feature styles: `src/customer/customer.css`; white/surface cards, semantic borders, CKS-red commerce actions and Savt-green reward/success treatments.
- Customer forms: `src/addresses/AddressForm.tsx`; 16px inputs and 44px action targets.
- Lifecycle and feedback: `src/customer/state.ts`, `errors.ts`, `components.tsx`.
- Session authority: existing `src/session/controller.ts`; its credential callback is infrastructure-only.
- Customer orders: `src/orders/contracts.ts` (closed customer-safe projections), `api.ts` (exact customer routes), `state.ts` (memory, retry identity and request fencing), `context.tsx` (application ownership), and `components.tsx` / `orders.css` (presentation).

Use native buttons, labels and a native checkout select (platform popup is intentional). The app-owned unsaved-change dialog uses native dialog focus and Escape behavior. Inline deactivation confirmation names its reversible effect. Customer data and drafts remain in memory. Never persist identity, address PII or CSRF.

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

Payment starts only from “Proceed to payment” on an accepted, unexpired quote. The cart and address become immutable before POST. An uncertain create retry reuses the same UUIDv4 idempotency key. A successful create stores one PaymentIntent and the strictly validated HTTPS checkout URL in memory; reopening uses that existing intent and never issues another POST.

Production WebView navigation is not changed directly. The native bridge receives exactly `{ type: "payment-handoff", payload: { checkoutUrl } }` and production fails closed when the channel is absent or throws. The development bridge records this navigation request only; it cannot provide payment finality.

External return, focus, visibility, redirect contents, and successful handoff are navigation signals only. They may trigger one coalesced payment-result GET. `PENDING`, `FAILED`, and `PAID_PROCESSING` never render “Order Confirmed.” That reserved state appears only for `PAID` with a strict backend-projected Order identity matching the payment’s checkout reference. Logout/session loss clears all payment memory and invalidates late asynchronous completions.

## CUST03B order history, tracking and after-order actions

Source authority is the read-only CKS Go backend at `9f5b779e38eea447e0bf425e0489e70107231356`. The browser reads only `GET /api/v1/customer/orders` and `GET /api/v1/customer/orders/:orderId`, cancels only through `POST /api/v1/customer/orders/:orderId/cancel`, and downloads a receipt only through the exact backend-returned customer-safe path `GET /api/v1/orders/:orderId/receipt/download`. All responses are parsed as closed contracts; unknown, malformed, internal or newly added fields fail closed rather than entering presentation state.

History and detail display only backend-projected customer stages and milestones. The UI never derives a stage from timestamps, delivery records or payment state, and does not expose raw operational state, internal identifiers, rider data, SKU snapshots or provider details. Order identity may appear in the hash route only as the UUID required by the backend route; customer copy uses the order number.

Cancellation is offered only when the backend returns `canCancel`. The hint is not treated as authority: the backend rechecks eligibility. The empty request uses in-memory CSRF and one stable UUIDv4 idempotency key across uncertain retries. Success is rendered only from the returned cancellation projection; conflict and other safe backend failures remain non-confirming. The app-owned native dialog names the irreversible request, initially focuses “Keep order,” supports Escape, and does not optimistically change status.

Receipt download is visible only when the strict detail projection declares it available and returns paths matching the current order. The response must be a PDF. No receipt, order response, CSRF value, cancellation key or delivery address is persisted in browser storage. Logout/session loss clears order state and fences late requests. The CUST03A PAID-plus-valid-Order finality rule is unchanged; its “View order” action only navigates to the backend-backed detail route.
