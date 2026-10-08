# Scrollbar amendment evidence

The actual shopping-page scroll owner is `.app-shell__scroll` in `AppShell`.
The viewport/shell constrain the page height; navigation sits outside this
flexible scroll owner. Shared `*` rules previously gave the owner a thin,
visible scrollbar.

The fix overrides only that owner's visual scrollbar with `scrollbar-width:
none`, the legacy Microsoft property and its scoped WebKit pseudo-element.
It leaves `overflow-y: auto`, body behavior, shared scrollbar styling, modal
scrolling, navigation and safe-area rules intact. The override is outside
the component cascade layer so it can override the existing unlayered rule.

`scroll-browser.mjs` mounts the actual `AppShell` and `CartScreen`, with long
synthetic cart data and a strictly parsed Small Order Fee quote. The
authoritative charge is RM2.00 while the matched-tier charge is RM9.00.
The harness uses neither a backend nor a native bridge.

Before the fix, the three owner-suppression assertions failed with `thin`
instead of `none`; all 15 behavior assertions passed. After the fix, all
18 assertions passed with zero runtime errors or external/API requests.
Separate RED and GREEN reports/screenshots preserve that evidence.
The historical RED runner recorded signal termination as `serverCleanedUp:
false`; the server did terminate. The corrected runner awaits child closure
and checks both exit and signal status; the final GREEN report records cleanup.

At 320×844, 390×844 and 430×844, browser checks confirm:

- No visual scrollbar or reserved gutter on the actual customer owner.
- Mouse wheel, focused-button PageDown and native browser touch gestures
  change the owner's scroll position.
- Navigation position and height remain stable while content scrolls.
- No horizontal overflow in the page or owner.
- The real Small Order Fee dialog keeps independent wheel scrolling,
  authoritative charge, wrapping, dismissal and trigger focus restoration.
- Simulated `--safe-area-bottom: 34px` retains 54px modal bottom padding.

Reproduce with `node verification/cust-ux-batch01/scroll-browser.mjs`.
The runner starts and cleans up its own loopback Vite server.
`--red` labels a baseline run; it should be run against the original code to
reproduce the failure, rather than against the fixed branch.

This is local Chrome browser emulation. Physical WebView qualification is
**PENDING**. Shared modal scrollbars are retained; they remain independent
of the customer's page scroll owner.
