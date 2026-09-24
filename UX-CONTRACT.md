# Customer UI contract

## Canonical UI Map

| Capability     | Canonical owner                                | Source of truth                  | Allowed variants                                                                   | Verification                            |
| -------------- | ---------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------- |
| Form           | src/addresses/AddressForm.tsx                  | Customer DTOs                    | Add/edit, memory-only drafts                                                       | Validation and browser create/edit      |
| Select/Listbox | CheckoutAddress in src/customer/components.tsx | Active saved-address list        | Native platform popup                                                              | Checkout selection and keyboard         |
| CRUD           | src/customer/state.ts                          | Customer address service         | Pessimistic writes, explicit conflict reload, stable retries                       | API/state tests and browser full flow   |
| Toast          | DataFeedback in src/customer/components.tsx    | Customer error contracts         | Persistent inline status/error                                                     | Render and browser failure tests        |
| Navigation     | src/customer/context.tsx                       | Memory-only form state           | Discard dialog; native beforeunload                                                | Escape, cancel, discard browser checks  |
| Scrollbar      | Existing src/styles.css and Layout.tsx         | Existing prototype shell         | Global tokenized baseline; existing scroll ownership preserved                     | Narrow and desktop browser review       |
| Button         | src/components/ui.tsx                          | DESIGN.md + runtime tokens       | Primary/secondary/tertiary/icon; stable busy and disabled states                   | Component semantics + browser keyboard  |
| Status         | src/components/ui.tsx                          | Closed catalogue/order contracts | Availability and customer order stages only; Figma promo labels are presentational | Component render + feature tests        |
| System states  | src/components/ui.tsx                          | Existing feature phases/errors   | Loading, empty and error with safe action callbacks                                | Component render + browser state matrix |
| App shell      | src/components/Layout.tsx                      | Existing hash routes             | Home, Categories, Cart, Orders; Account intentionally omitted                      | Shell tests + four viewport review      |

Source authority: current CKS Go customer DTOs, controller, address service and session guards. Tests: customer/contracts, API, state and rendered presentation suites; local browser acceptance at the requested narrow sizes. No sensitive values in URLs, storage, logs or presentation session snapshots. Legacy mocked affordances remain outside this bounded package.

CKS-first presentation rule: CKS Red is the safe commerce primary and active customer-navigation color. Savt Green remains for rewards, savings and positive Savt ecosystem meaning. This visual rule does not change lifecycle, authority, permissions, payment finality or order state.

## CUST02B catalogue UI consequences

Source: frozen CUST02A-CP0-R2, assignment lifecycle, strict envelopes and CUST02B package sections. Catalogue does not redefine backend policy.

| Capability          | Canonical owner                                   | Allowed variant                                                             | Verification                                                    |
| ------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Address selection   | Existing CheckoutAddress / CustomerDataController | Catalogue copy; no mutation or session authority change                     | catalogue/address-selection tests and browser address switch    |
| Browse state        | catalogue/state.ts                                | Automatic address-driven assignment; bounded renewal; late response fencing | state tests including expiry during pending reads               |
| Search / pagination | catalogue/components.tsx and API                  | Server query, explicit Previous/Next, page reset; memory-only filters       | HTTP tests and browser search/page/empty results                |
| Status              | CatalogueStatus                                   | Inline loading, empty, error, expiry and read-only copy                     | rendered tests and deterministic browser scenarios              |
| Images              | ProductImage                                      | Fixed placeholder, lazy returned image, load-error fallback                 | component test and browser null-image geometry                  |
| Navigation          | Existing guardNavigation + screen/product hash    | Existing unsaved-form guard; no context/address in URL                      | keyboard search, detail/back/refresh, profile and logout checks |
| Commerce            | CatalogueApp                                      | Historical CUST02B boundary; superseded by the CUST02C map below            | component/browser checks and source review                      |

Keep the existing profile/address forms, mutation outcomes, confirmations and session boundary intact. Browser Back restores screen/product navigation; query/filter/page state is intentionally ephemeral and never persisted. A full refresh performs fresh session/address loading and assignment. Catalogue GETs cannot renew or resolve outlets by themselves; the controller uses a separate bounded assignment POST when needed.

## CUST02C cart and trusted quote UI consequences

Source: approved CUST02C package, existing trusted checkout quote API and frozen assignment-context contract. These rows describe UI behavior; backend policy remains authoritative.

| Capability          | Canonical owner                                  | Allowed variant                                                                                                           | Verification                                |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Cart identity       | `checkout/state.ts`                              | One outlet; exact `outletProductId` merge; bounded line/quantity; memory-only display snapshots                           | state and rendered cart tests               |
| Address transition  | `checkout/context.tsx` and `AddressChangeDialog` | Same outlet preserves cart; different nonempty cart requires app-owned clear confirmation                                 | transition tests and browser cancel/confirm |
| Quote action        | `CartScreen` and `checkout/api.ts`               | Explicit customer action only; stable UUIDv4 per attempt; no client-calculated commercial fields                          | API/state tests and request inspection      |
| Quote evidence      | `QuoteSummary`                                   | Closed authoritative lines, totals, currency, timing, expiry and returned assignment evidence                             | parser/render tests and browser success     |
| Price review        | `checkout/state.ts`                              | Changed server prices block reviewed state until explicit acceptance                                                      | state/render tests and browser scenario     |
| Expiry/recovery     | `checkout/state.ts` and `QuoteSummary`           | Expired quote is not actionable; explicit requote; bounded same-attempt retry only for uncertain transport/parse failures | timer, API and browser failure scenarios    |
| Downstream boundary | `CatalogueApp`                                   | No payment, order creation, mock confirmation, receipt or tracking action from the real cart                              | component tests and source/browser review   |

The assignment-context handle and all credentials remain memory-only and never enter URLs, storage, logs or visible error copy. Browser Back may restore catalogue navigation only; refresh reconstructs an empty cart and requests a fresh assignment context. The native address select remains platform-owned. The clear-cart confirmation is app-owned, Escape-cancelable, viewport-bounded and initially focuses Cancel.

The CUST02C downstream-boundary row is historical. Payment is superseded by the bounded CUST03A rows below; customer order reads and supported after-order actions are superseded by CUST03B. Frontend Order creation remains disconnected.

## CUST03A payment initiation and result UI consequences

Source: pinned CKS Go backend payment contract at `ab1e6b90c4b5b324ce463a8b08f40bc8fd78e3ec`. The backend remains the sole authority for provider communication, payment finality, and Order materialization.

| Capability         | Canonical owner                           | Allowed variant                                                                                                | Verification                           |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Payment start      | `PaymentPanel` and `payment/state.ts`     | Explicit action on accepted quote; cart/address freeze before one POST; stable key on uncertain retry          | state, API, and rendered tests         |
| External handoff   | `webview/bridge.ts`                       | Explicit native external-browser request; HTTPS without URL credentials; fail closed; no same-WebView redirect | bridge tests and browser fixture       |
| Pending recovery   | `payment/state.ts`                        | Existing intent may reopen its checkout URL; no second create POST                                             | state tests and local counters         |
| Return observation | `payment/context.tsx`                     | Visible focus/visibility or explicit button performs coalesced result GET only                                 | observer and controller tests          |
| Finality states    | `PaymentPanel`                            | PENDING, FAILED, PAID_PROCESSING, and safe error copy remain non-confirming                                    | rendered state matrix                  |
| Order confirmation | `payment/contracts.ts` and `PaymentPanel` | “Order Confirmed” only for PAID plus strict backend Order identity and matching checkout reference             | parser, controller, and rendered tests |
| Session boundary   | `payment/state.ts`                        | Clear token, URL, intent, Order, retry key, and fence late work on logout/session loss                         | generation-race tests                  |

The payment panel reuses the existing rounded white card, CKS-red primary action, native button semantics, focus ring, and narrow-shell behavior. It does not display checkout URLs, quote tokens, PaymentIntent IDs, raw backend/provider codes, or provider redirect parameters. A restart after terminal failure clears cart and payment state and requires a fresh quote.

## CUST03B customer orders UI consequences

Source: pinned CKS Go backend customer-order and receipt contracts at `9f5b779e38eea447e0bf425e0489e70107231356`. Backend projections remain the sole authority for customer stage, milestones, cancellation eligibility and receipt availability.

| Capability       | Canonical owner                         | Allowed variant                                                                                              | Verification                                       |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| History          | `orders/state.ts` and `OrdersScreen`    | Credentialed, paginated backend list; explicit loading, empty, error, session and refresh states             | contract/API/state/render/browser tests            |
| Order detail     | `orders/contracts.ts` and detail screen | Closed customer-safe projection; order number in copy; no raw operational fields or inferred values          | strict parser and rendered redaction tests         |
| Tracking         | `OrderDetailScreen`                     | Exact backend `customerStage` and returned milestones only; no browser-derived fulfilment authority          | stage matrix, malformed-contract and browser tests |
| Back navigation  | `CatalogueApp`                          | Order UUID only in hash route; returns to in-memory history without leaking address or credentials           | navigation and browser Back checks                 |
| Cancellation     | `orders/api.ts`, state and dialog       | `canCancel` hint; empty POST; in-memory CSRF; stable retry key; backend result only; least-destructive focus | API/state/dialog/browser checks                    |
| Receipt download | `orders/api.ts` and detail screen       | Exact returned download path for current order; PDF content type; browser-owned file save                    | contract/API and receipt-ready browser checks      |
| Session boundary | `orders/state.ts`                       | Clear history/detail/retry state and fence late work on logout or 401                                        | state races and session browser scenario           |

History and detail reuse the existing shell, rounded cards, CKS-red action hierarchy, focus ring and MYR formatting. The CUST03B cancellation row above is historical and is superseded by CUST-CANCEL01 below. File saving remains browser-owned. Customer order data and receipt blobs are memory-only; receipt visibility never comes from a payment assumption.

## CUST-CANCEL01 paid Order view and support override

| Capability        | Canonical owner                        | Current behavior                                                                                                                                                | Verification                           |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Final Pay notice  | `PaymentPanel`                         | Review items and delivery address before Pay; confirmed Orders cannot be changed or cancelled in the app                                                        | payment render tests                   |
| Order view        | `OrdersScreen` and `OrderDetailScreen` | Keep history, refresh, tracking, receipt and historical cancelled/refund views; ignore stale `canCancel` for actions                                            | order render, state and contract tests |
| Customer mutation | `orders/api.ts` and `orders/state.ts`  | No cancellation command, retry, confirmation dialog or POST path                                                                                                | API/state tests and source audit       |
| WhatsApp help     | `orders/support.ts` and order detail   | Optional `VITE_CKS_GO_SUPPORT_WHATSAPP`; empty/invalid is inert; valid E.164-style number builds only encoded HTTPS `wa.me` enquiry with displayed Order number | config and stubbed-navigation tests    |

Support opens a separate browser context through `window.open` with `noopener,noreferrer` and does not change Order, payment or fulfilment state. Native WebView handling requires separate Flutter acceptance; the payment-handoff bridge is reserved for payment. Backend policy enforcement is tracked in CUST-CANCEL01-BE.
