# Customer profile and saved addresses

CUST01B extends the existing English-language, Malaysia-focused mobile grocery prototype. Preserve the existing green palette, Inter/system typography, rounded white cards, 430px shell, and mocked commerce. No redesign or backend changes.

## Runtime owners

- Existing visual tokens: `tailwind.config.js`, `src/styles.css`.
- Customer feature styles: `src/customer/customer.css`; white/surface cards, slate borders, green actions. The darker green on new buttons provides readable white button text.
- Customer forms: `src/addresses/AddressForm.tsx`; 16px inputs and 44px action targets.
- Lifecycle and feedback: `src/customer/state.ts`, `errors.ts`, `components.tsx`.
- Session authority: existing `src/session/controller.ts`; its credential callback is infrastructure-only.

Use native buttons, labels and a native checkout select (platform popup is intentional). The app-owned unsaved-change dialog uses native dialog focus and Escape behavior. Inline deactivation confirmation names its reversible effect. Customer data and drafts remain in memory. Never persist identity, address PII or CSRF.

Profile and address requests follow the CKS integration checkout DTOs and routes at `bac1f2f`. Mutations wait for the server. Reload all addresses after success because default changes update other versions. A conflict requires explicit reload; uncertain submissions retain the same immutable operation for retry. Catalogue, prices, payment, tracking and receipts remain mocked.

## CUST02B catalogue binding

The frozen `CUST02A-CP0-R2-assignment-context.md` is authoritative (SHA-256 `d662cca7e63d35fcadc8bd821710d8b769c71ac94408f952abc00822cde767f3`). Its approved data/copy adaptation preserves the existing English Malaysia grocery visual direction: green surfaces, Inter/system text, rounded white cards, 430px shell, category strip and two-column product grid.

Runtime owners: `src/catalogue/contracts.ts` (closed wire projections), `api.ts` (credentialed requests), `state.ts` (memory and generation boundaries), `context.tsx` (read-only customer/session subscriptions), `components.tsx` and `catalogue.css` (presentation). Existing `CheckoutAddress` has a catalogue copy variant and continues to use the original selection controller. Address mutations, session and bridge protocols are unchanged.

The header displays the returned assigned outlet only after assignment. Home, Categories, search and detail consume real contract shapes; one MYR minor-unit price and two-state availability are the only commercial claims. Images reserve fixed space, use returned HTTPS URLs with lazy loading, and fall back to a neutral placeholder. Approval/host allowlisting remains the backend projection's responsibility.

Real catalogue navigation cannot reach the retained prototype commerce implementation. Add is disabled; Cart and Orders explain that ordering/tracking are not connected. No quote, payment, order, receipt or tracking request is made. `mockData.ts` is untouched.

Search is debounced 300ms with composition protection, explicit Enter and immediate clear. The search/category/page state and assignment context stay in memory, since they are session/address-specific. Hash navigation contains only screen names and product UUIDs. Address/context/filter changes reset pages. No assignment handle or address identifier enters a URL, browser storage, logs or analytics.

Development catalogue fixtures are dynamically imported only under the existing explicit DEV + development-API flags. A constructor production guard is an additional boundary. The development composition supplies synthetic coordinates on fixture address reads; production address data and mutation authority are unchanged. Fixtures reset on refresh.
