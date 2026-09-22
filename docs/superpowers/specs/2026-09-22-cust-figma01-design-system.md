# CUST-FIGMA01 Customer UI Foundation

## Authority

- User brief: CUST-FIGMA01 — CKS GO CUSTOMER FIGMA DESIGN SYSTEM + APP SHELL.
- Required base: `b8f236904b56822cf8461ff37d9168ae417bf1a4`.
- Primary Figma file: `ncty6c6YIPuFnHymP2nqos`.
- Design-system node: `25:55` (`Customer_Design_System_Board`).
- Root reference page: `3:3` (`02 Customer Screens Batch 1-3`).
- Publication: local only; no push, PR, merge, deploy, backend, Flutter, or Railway change.

## Frozen scope

Create the reusable customer presentation foundation only: CKS-first semantic tokens, typography, shared controls, app shell, supported bottom navigation, loading/empty/error states, quantity controls, responsive containment, safe-area handling, and accessibility foundations. Do not migrate all Phase 1 screens.

Preserve the existing session, address, outlet assignment, catalogue, cart, quote, checkout, payment, order, cancellation, receipt, stale-request, and WebView contracts. Backend data remains authoritative. No new routes, APIs, state machines, storage, or business statuses.

## Design decisions

- CKS Red `#E52329` owns commerce CTAs, active customer navigation, cart emphasis, and order actions.
- Savt Green `#4CAF50` and dark `#3F8E1E` remain reward/savings/success ecosystem colors.
- Background `#F8FAF6`, ink `#111827`, info `#3B82F6`, warning `#F59E0B`, error `#EF4444`.
- Inter/system typography: H1 24/32 bold, H2 20/28 semibold, body 14/20 regular.
- Mobile reference is 390×844; runtime is fluid, safe-area aware, and intentionally contained on wide screens.
- Supported bottom destinations are Home, Categories, Cart, and Orders. Account is omitted because the repository has no supported route.

## Existing owners

- Runtime tokens and global shell styling: `src/styles.css`, `tailwind.config.js`.
- App shell and bottom navigation: `src/components/Layout.tsx`.
- Live product presentation: `src/catalogue/components.tsx` (`ProductTile`).
- Cart quantity behavior: `src/checkout/state.ts`; presentation may reuse `src/components/QuantitySelector.tsx`.
- Address form and native checkout select: `src/addresses/AddressForm.tsx`, `src/customer/components.tsx`.
- All feature controllers, APIs, contracts, contexts, session, and WebView bridge remain unchanged.
