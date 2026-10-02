# CUST-HELP01 — customer WhatsApp support

`orders/support.ts` retains the E.164 parser, order URL builder and order opener. It adds general help and shares safe opening. Messages are exactly:

```text
Hi CKS Go Support, I need some help.

My enquiry:
```

```text
Hi CKS Go Support, I need help with my order <ORDER_NUMBER>.

My enquiry:
```

Home has a small secondary “Get help” utility action above its content. Order Detail retains “Get help with this order” with “WhatsApp support”. Both reuse the shared tertiary button, Inter, CKS red, outline help icon, visible focus, a 44px target and accessible descriptive labels. Bottom navigation remains Home, Browse, Basket, Orders.

The authenticated `GET /api/v1/customer/support` returns only `{ data: { whatsapp: string | null } }`. The provider mounts inside the session boundary, loads independently with a five-second deadline and keeps only recipient digits in memory. Missing/invalid/offline/unavailable support leaves commerce usable. Legacy `VITE_CKS_GO_SUPPORT_WHATSAPP` is ignored.

For pilot operations, set backend `CKS_GO_SUPPORT_WHATSAPP` to the approved test recipient using the backend environment controls. For production replace the same value with the official support recipient and restart/redeploy the API under separate authorization; no customer-web source edit or rebuild is needed. Actual recipient values must never enter committed documentation.

Embedded actions send only `{ type: "support-handoff", payload: { whatsappUrl } }` through `SavtCksGoBridge`. The matching native host validates the exact destination and fixed messages before launching with `LaunchMode.externalApplication`. Standalone actions preserve `window.open(url, "_blank", "noopener,noreferrer")`. No arbitrary URL is accepted by the support API and the WebView trust policy stays unchanged.

Local automated coverage verifies configuration, message encoding, unavailable rendering, native dispatch and native allowlist/host behavior. Actual installed-device WhatsApp launch and return require pilot acceptance after the separately authorized releases; local automated tests do not prove an installed app association.

## Local verification

- Full customer-web suite: 60 files, 804 tests passed; TypeScript application/runtime checks and production Vite build passed.
- Changed-file Prettier check and `git diff --check` passed. Strict premium UI audit: zero findings.
- `scripts/prove-customer-support.mjs` passed in local Chrome at 390px and 320px: independent config loading, Home and order help, four navigation tabs, Enter activation, minimum 44px targets, native bridge dispatch, standalone opening, and friendly failure/missing/invalid states.
- Native CKS Go suite: 113 tests passed; changed-file Dart analysis passed. The final order-prefix correction also passed all 39 focused parser/host tests. Both legacy `CKS-…` and current backend `CKSGO-…` customer-facing numbers are accepted; internal UUIDs and multiline enquiry injection are rejected.
- No push, PR, CI, merge or deployment was performed. The matching API/web/native changes remain local.
