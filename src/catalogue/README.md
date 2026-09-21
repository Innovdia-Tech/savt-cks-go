# CUST02B local catalogue binding

Frozen contract: CUST02A-CP0-R2-assignment-context.md, SHA-256 d662cca7e63d35fcadc8bd821710d8b769c71ac94408f952abc00822cde767f3.

- POST `/api/v1/customer/outlet-assignment`: exact saved-address ID and row version, credentialed, existing in-memory CSRF.
- GET `/api/v1/customer/outlets/:outletId/categories`, `/products`, `/products/:outletProductId`: credentialed no-store reads with `X-CKS-Assignment-Context` only in the header.
- Closed runtime parsing; bounded pagination/search, canonical context handle, UTC dates, UUIDv4 identities, supported integer minor-unit price, nullable HTTPS image and plain text.
- Memory-only controller. Session/address/revision/context/filter transitions fence late work. Expiry clears visible context/data, including during pending requests. On-demand renewal retries at most once. Profile bootstrap recovery is limited once per session.
- The real catalogue feeds the memory-only cart by `outletProductId`. The cart can request the trusted checkout quote API, but has no payment, order, receipt, or tracking integration. The retained prototype success flow is unreachable through the exported App.

## Local fixtures

Use the existing explicit `VITE_CKS_GO_DEVELOPMENT_API=true` and `VITE_CKS_GO_DEVELOPMENT_BRIDGE=true` development environment, then run `npm run dev`. The fixture panel exposes catalogue states plus quote price/stock/product changes, assignment/address mismatch, expiry, offline, timeout, malformed and session-expiry paths. Synthetic active addresses exercise both same-outlet and different-outlet transitions. Short lifetimes make catalogue and quote expiry observable locally. No credentials or live provider traffic are required.

Fixtures are dynamically imported behind `import.meta.env.DEV` and the existing runtime configuration guard; construction with production=true throws. They never relax the real parsers. Refresh resets fixtures and creates new in-memory controllers. The fixture address wrapper changes only synthetic GET projections, not the production controller or mutation protocol.

## Verification

Focused: `npm test -- src/catalogue`.
Final: fresh `npm ci`, changed-file Prettier, `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`, complete diff review. The repository format script compares committed HEAD; before the sole final commit use an explicit changed/untracked-file list with Prettier to cover the working tree.

Historical CUST02C browser acceptance covered 390×844, 430×932 and desktop through trusted quote. CUST03A supersedes only its downstream boundary with the explicit CKS Go payment/result flow; frontend Order creation, mock success, receipt and tracking remain unreachable.
