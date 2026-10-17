# LEGAL-ADMIN01 published policy reader

Management's 17 October 2026 LEGAL-ADMIN01 request adds HQ-managed publication.
The LEGAL-UX03 customer layout remains the presentation owner.

`src/legal/published.ts` implements one read-only request:
`GET /api/v1/customer/legal-policies`. The exact response is
`{data: [{slug, title, version, effectiveAt, sections}]}`. The four slugs are
`terms`, `delivery`, `cancellation-refund`, and `privacy`; version is a positive
integer and effectiveAt is the server's UTC ISO timestamp. Ordered sections
contain `{id, heading, blocks}`. Paragraph blocks contain `{type: 'paragraph',
text}`; lists contain `{type: 'list', ordered, items}`. Closed parsing rejects
unknown/internal fields, unsupported block types, duplicate identifiers and
malformed metadata. Plain strings are rendered as React text nodes.

The backend alone selects effective published versions. The browser does not
infer effective status from its local clock, fabricate publishedAt, or retrieve
drafts. Draft preview and version history use staff-protected HQ routes owned by
the backend/HQ lane. Normal customer builds contain no draft fixture wording.

`PublishedPolicyProvider` is distinct from `PolicyGatewayProvider`. It supplies
only reading to the existing PolicyCentre; it cannot activate consent or record
acceptance. The acceptance provider remains absent. Checkout's policy helper
recognizes the read-only provider, while its controller, button eligibility,
initiation/retry delegates and preview payment block retain their existing rules.

Every dialog opening reads through the current customer session, same-origin
proxy and cookies. No-store reads have bounded fetch/body consumption, cancellation
and generation fencing. A 401 uses existing session expiry/recovery. Loading,
empty and failed responses stay distinct; errors offer Retry. No data enters
browser storage or URLs. The legacy exact checkout version set, if supplied in
future, retains precedence over the general published reader.

The existing authorized `preview01` boundary can display its static review fixture
only after a successful publication read establishes no publication for that slug.
Published text takes precedence; failed, unauthorized, malformed and pending
reads never fall back. The fixture is not the saved HQ draft and has no effective
date. Review saved edits using HQ Preview. The same existing preview context keeps
payment initiation disabled independently of the displayed text.

The shared PolicySections renders headings, paragraphs, ordered/unordered lists
and collapsed section navigation in the accepted compact reader. Effective date
and version occupy its compact overview row. Orders selection, checkout return,
Escape/native Back, focus restoration and scroll ownership remain unchanged.

Verification commands use the installed Node runtime when npm is unavailable:

```text
node node_modules/vitest/vitest.mjs run src/legal src/orders/components.test.ts src/catalogue/startup.test.tsx src/checkout/components.test.ts src/customer/delivery-back.test.ts --configLoader runner --reporter=dot
node node_modules/typescript/bin/tsc -b
node node_modules/typescript/bin/tsc -p tsconfig.runtime.json
node node_modules/vite/bin/vite.js build --config vite.config.js --configLoader runner
node node_modules/vite/bin/vite.js build --mode preview01 --config vite.config.js --configLoader runner
```

Synthetic publication fixtures and successful tests do not approve legal text or
enable server acceptance enforcement. No source push, PR or deployment belongs
to this isolated customer implementation lane; rollout is coordinated separately.
