# CUST02B local catalogue binding

Frozen contract: CUST02A-CP0-R2-assignment-context.md, SHA-256 d662cca7e63d35fcadc8bd821710d8b769c71ac94408f952abc00822cde767f3.

- POST `/api/v1/customer/outlet-assignment`: exact saved-address ID and row version, credentialed, existing in-memory CSRF.
- GET `/api/v1/customer/outlets/:outletId/categories`, `/products`, `/products/:outletProductId`: credentialed no-store reads with `X-CKS-Assignment-Context` only in the header.
- Closed runtime parsing; bounded pagination/search, canonical context handle, UTC dates, UUIDv4 identities, supported integer minor-unit price, nullable HTTPS image and plain text.
- Memory-only controller. Session/address/revision/context/filter transitions fence late work. Expiry clears visible context/data, including during pending requests. On-demand renewal retries at most once. Profile bootstrap recovery is limited once per session.
- The real catalogue has no quote/payment/order/cart-success integration. The retained prototype is unreachable through the exported App.

## Local fixtures

Use the existing explicit `VITE_CKS_GO_DEVELOPMENT_API=true` and `VITE_CKS_GO_DEVELOPMENT_BRIDGE=true` development environment, then run `npm run dev`. The fixture panel exposes success, null images, unavailable, empty categories/search/category, expiry/renewal, address changed, provider incomplete, no service, context-store outage, blocked, offline, timeout, malformed, session expired, outlet unavailable and address prerequisite cases. The expiry fixture uses a short effective lifetime for local observation. No credentials or live provider traffic are required.

Fixtures are dynamically imported behind `import.meta.env.DEV` and the existing runtime configuration guard; construction with production=true throws. They never relax the real parsers. Refresh resets fixtures and creates new in-memory controllers. The fixture address wrapper changes only synthetic GET projections, not the production controller or mutation protocol.

## Verification

Focused: `npm test -- src/catalogue`.
Final: fresh `npm ci`, changed-file Prettier, `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`, complete diff review. The repository format script compares committed HEAD; before the sole final commit use an explicit changed/untracked-file list with Prettier to cover the working tree.

Browser acceptance: 390×844, 430×932 and 1280×900. Check assignment, address selection, category, search and page reset, detail/back/refresh, null images, unavailable/read-only, empty states, provider/store/offline/timeout failures, expiry/renewal, logout/relaunch, focus and overflow. This package is accepted against local frozen-contract fixtures; backend S1 integration and CUST02C remain separate.
