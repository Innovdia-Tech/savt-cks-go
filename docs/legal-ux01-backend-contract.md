# LEGAL-UX01 backend activation contract

This frontend slice prepares a Policy Centre, policy detail views and checkout
acceptance states. Production does not instantiate a `PolicyGateway`, so checkout
acceptance remains inactive. Adapter and UI readiness do not provide backend
enforcement, publish legal text or establish that consent has been recorded.

## Observed baseline

The local frontend base is `c40c552bac1597d8b690725d294a8e177ca3c0fa`
(REPAIR04; approved tree `c593fba3a4cb4e2aca81db033fddf1d19974af80`).
`src/payment/api.ts` initiates payment with `{ quoteId, quoteToken }` and a
stable idempotency key. `src/payment/state.ts` freezes the accepted quote before
initiation and preserves the attempt for uncertain retries. This task does not
extend that request or change payment/provider behavior.

The latest full backend copy inspected locally was
`C:/Users/isaac/Documents/ChatGPT/CKS go frontend/merch-home01-clean-backend`, at
`2a2642d8fcc1f2636376458c83be03e305d4e2c4` (7 October 2026). Its
`apps/api/src/modules/orders/checkout-payment.dtos.ts` accepts only quote ID and
quote token. Its `prisma/schema.prisma` and
`apps/api/src/modules/settings/refund-policy.service.ts` contain effective-dated,
versioned commercial refund rules. The quote/order refund-rule reference is not
a published legal document or customer consent record.

No customer legal-publication or legal-acceptance API/persistence contract was
found in the five local backend copies searched. The later pinned backend PR
#142 evidence concerns location reliability. Current remote branches and deployed
contracts were not checked; absence in these local copies is not a claim about
current remote state.

## Frontend adapter boundary

`src/legal/contracts.ts` defines `PolicyGateway` with these operations:

- `listPublished(signal)` retrieves the published document set.
- `checkoutRequirement(quoteId, signal)` retrieves a quote-specific requirement.
- `recordAcceptance(request, signal)` records explicit customer acceptance.

Transport payloads are unknown until strict validation succeeds. These method
names describe an adapter interface, not existing or proposed HTTP routes.
The backend owner must agree and implement the transport contract before a
production gateway is connected. Synthetic fixtures are test evidence only.

The current adapter shape identifies a document by `kind` (`terms`, `delivery`,
`cancellation-refund` or `privacy`) and `version`, with `status: "published"`,
`effectiveAt`, `publishedAt` and plain-text `content`. A required response has
`mode: "required"`, `enforcementReady: true`, all four documents, `quoteId`,
`checkoutAttemptId`, `requirementId` and `expiresAt`. A receipt echoes the acceptance
request (`accepted: true` and the complete `policies: [{ kind, version }]` set),
adding `acceptanceId`, `acceptedAt` and `expiresAt`; its expiry cannot exceed the
requirement expiry. A gateway may explicitly return `{ mode: "inactive" }`, but
the controller rejects a downgrade after observing a required response.

## Required backend guarantees

1. Publish immutable, approved policy documents with stable document identities,
   exact versions, effective dates and approved content. Draft, withdrawn,
   incomplete or unapproved content must not appear as a current published policy.
2. Return the required version set bound to `quoteId`, `checkoutAttemptId` and
   `requirementId`, with server-authoritative validity. A browser must not choose
   its own required documents or assert that a requirement is inactive.
3. Record explicit acceptance for that exact identity tuple and complete version
   set. Return a durable receipt with an acceptance ID, server `acceptedAt`,
   `expiresAt` and the exact requirement, quote, attempt and document/version
   bindings. The frontend must reject an incomplete or mismatched receipt.
4. Derive the customer from the trusted session; enforce ownership, CSRF and
   idempotency on the server. Reject stale requirements, expired receipts,
   substituted IDs/versions, missing documents and cross-customer or cross-attempt
   replay. Client time, a checked box or a stored browser flag is not proof.
5. Enforce the required consent atomically with payment creation and payment
   retry. Associate the same immutable acceptance evidence with the resulting
   order. Resolve races, retries and uncertain responses without allowing a
   duplicate payment or an order lacking required evidence. The backend owner
   must define how refreshed requirements interact with existing pending payment
   attempts; the frontend must not infer this behavior.

## Activation gate

Keep the production gateway absent until the approved content, published-content
read contract, checkout requirement contract, durable acceptance receipt and
atomic backend enforcement are implemented and verified together. Then wire the
agreed transport, validate real contract fixtures and verify version changes,
expiry, session loss, uncertain acceptance, payment retry and order association.

A successful frontend test or consent receipt alone does not prove payment-side
enforcement. This document supplies no legal wording, invents no endpoint and
does not authorize publication or payment/provider changes.
