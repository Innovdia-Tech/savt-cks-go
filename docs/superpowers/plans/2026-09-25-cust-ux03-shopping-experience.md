# CUST-UX03 Shopping Experience

Base: `d9c25be4918cb1c9f4e53b3b53f397607f16ade7` in the isolated `codex/cust-ux03-shopping-refinement` frontend worktree. No later main commits or equivalent UX03 branch were found. Existing catalogue, quote, payment, order, session, and WebView contracts remain authoritative.

1. Refine the real customer Home, Categories, Product Detail, and Cart presentation with the existing CKS red tokens, square uncropped image slots, landscape advertising, and shared quantity controls. Development fixtures remain explicitly synthetic; production gets no invented campaign or payment content.
2. Render one cart and checkout review on the existing route: address, items, authoritative quote fees, final total, changed-total acceptance, and a single Pay action. Keep editable cart state until Pay freezes the accepted quote.
3. On backend-confirmed FAILED payment, retain the basket, release the quote freeze, and require a fresh quote before another Pay. Keep unknown payment initiation tied to its original idempotency key. Observe return with a bounded number of backend result GETs and no automatic handoff.
4. Remove only the Order Detail delivery-note display. Preserve data parsing, paid-order cancellation removal, receipt and help paths.
5. Test controller, component, and development-fixture boundaries; run affected checks and one final suite. Inspect 320, 390, and 430 pixel layouts plus enlarged text, exercise the full fixture journey, and capture one consolidated walkthrough before a local checkpoint commit.
