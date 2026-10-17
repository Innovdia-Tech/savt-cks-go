# LEGAL-UX02 preview presentation

Build the existing customer app with `npm run build:preview01` only for the restricted PREVIEW01 customer service. Normal `npm run build` does not contain the supplied draft wording. No query parameter, browser storage value or policy API response activates the preview fixture.

The source pack `CKSGO_LEGAL_POLICY_PREVIEW_v01.zip` supplies the exact JSON fixture in `src/legal/preview/CKSGO_LEGAL_POLICY_PREVIEW_v01.json`. Its SHA256 is `cb1c09fded4ff1486cd6becad17ee2d5b7a360d1be77789db56f6d7405fbc9c5`. The four policies contain 25 sections and 49 paragraphs. Keep this file outside automatic formatting so the source remains traceable.

The preview uses a separate read-only context. Published-policy parsing, acceptance contracts, backend records and payment controllers are unchanged. Preview payment controls remain disabled. Published versions supplied by checkout or a configured gateway are never replaced with draft text.

Management's supplied mobile reference governs this presentation: a compact four-policy centre, one dedicated reader, compact Back/title/Close header, independently scrolling body, heading navigation and explicit draft status. Existing Orders, checkout and native modal behavior is reused.

Before deployment, verify the target remains `preview01-customer` in `development-qa`, source-pinned with auto-deploy disabled. Stage only its new commit pin and `npm run build:preview01` build command, inspect the pending patch, then apply once. Never apply or modify Production DARK's 38 staged changes. Do not enable routing, payments or other integrations to qualify checkout.
