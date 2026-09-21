# CKS GO customer catalogue, checkout and orders

CUST01B through CUST03B extend the existing English-language, Malaysia-focused mobile grocery prototype. Preserve the existing green palette, Inter/system typography, rounded white cards and 430px shell. CUST03B adds backend-authoritative customer order history, detail, tracking, cancellation and receipt download after CUST03A payment finality. It does not add frontend Order creation, infer fulfilment state, or change the backend.

## Runtime owners

- Existing visual tokens: `tailwind.config.js`, `src/styles.css`.
- Customer feature styles: `src/customer/customer.css`; white/surface cards, slate borders, green actions. The darker green on new buttons provides readable white button text.
- Customer forms: `src/addresses/AddressForm.tsx`; 16px inputs and 44px action targets.
- Lifecycle and feedback: `src/customer/state.ts`, `errors.ts`, `components.tsx`.
- Session authority: existing `src/session/controller.ts`; its credential callback is infrastructure-only.
- Customer orders: `src/orders/contracts.ts` (closed customer-safe projections), `api.ts` (exact customer routes), `state.ts` (memory, retry identity and request fencing), `context.tsx` (application ownership), and `components.tsx` / `orders.css` (presentation).

Use native buttons, labels and a native checkout select (platform popup is intentional). The app-owned unsaved-change dialog uses native dialog focus and Escape behavior. Inline deactivation confirmation names its reversible effect. Customer data and drafts remain in memory. Never persist identity, address PII or CSRF.

Profile and address requests follow the CKS integration checkout DTOs and routes at `bac1f2f`. Mutations wait for the server. Reload all addresses after success because default changes update other versions. A conflict requires explicit reload; uncertain submissions retain the same immutable operation for retry. Order creation remains disconnected and backend-owned.

## CUST02B catalogue binding

The frozen `CUST02A-CP0-R2-assignment-context.md` is authoritative (SHA-256 `d662cca7e63d35fcadc8bd821710d8b769c71ac94408f952abc00822cde767f3`). Its approved data/copy adaptation preserves the existing English Malaysia grocery visual direction: green surfaces, Inter/system text, rounded white cards, 430px shell, category strip and two-column product grid.

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
