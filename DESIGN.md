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
