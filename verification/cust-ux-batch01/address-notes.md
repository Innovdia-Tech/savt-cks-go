# Address first-entry verification

Two customer-web defects were reproduced before production edits: a previous checkout address-transition error appeared when the picker was reopened, and a late GPS response replaced a newer Search location action. The picker now displays transition errors only after a selection made in that picker fails; the checkout controller keeps its genuine error. GPS completions use the existing intent generation, while a separate pending Promise owns the native lookup. Search remains usable, current-location actions stay disabled until the outstanding request settles, and map Recenter shares that lookup. Search tokens remain valid until GPS actually commits the confirmation screen.

The fresh authenticated Home → Delivery address → one current-location tap already succeeded in the original production-mode browser reproduction at 320, 390 × 844, and 430. It sent one exact `{ type: "location-current", requestId, protocolVersion: "1" }` message, accepted its matching reply, mounted one map, and received a 200 reverse-address response. Saved coordinates required no GPS request. A saved address without coordinates opened normal setup. This evidence does not establish that the reported physical first-tap failure has been repaired; physical WebView remains **PENDING**.

## Focused verification

- Unit RED: 1 failed, 16 passed. The fresh-entry assertion failed because the previous checkout error rendered immediately.
- Unit GREEN: 17 passed across `DeliveryAddressPicker.test.tsx`, `DeliveryLocationSetup.test.tsx`, `location/bridge.test.ts`, and `location/api.test.ts`.
- Original production browser RED: 6 passed, 4 failed, no runtime errors; source pinned to starting commit `094a78e96851462b7c02cf147081a4642b16b2eb`. The matrix then contained ten checks.
- Request-ownership intermediate RED: 10 passed, 2 failed. It exposed a stranded action-busy state after typing and a possible overlapping native GPS request. This historical report precedes the dedicated GPS owner.
- Recenter intermediate RED: 12 passed, 1 failed. Recenter sent a second request while the first was pending. This historical report precedes sharing the pending Promise.
- Final production browser GREEN: 13 passed, no runtime errors or unexpected API requests. Race checks hold and explicitly release native replies; they do not depend on a timing delay. Genuine GPS and address-selection failures remain visible.

The original, intermediate, and final reports are `address-baseline-report.json`, `address-request-ownership-red-report.json`, `address-recenter-red-report.json`, and `address-report.json`. Server cleanup awaits the child process closing.

```powershell
node verification/cust-ux-batch01/address-run-browser.mjs
node verification/cust-ux-batch01/address-run-browser.mjs --baseline
node verification/cust-ux-batch01/address-native-boundary.mjs
```

The replayed original baseline now runs the expanded matrix and is expected to fail. The historical baseline report retains its original ten-check count.

## Native follow-up boundary

The separate `address-native-boundary-report.json` records a pre-existing unmount/reentry failure using actual web navigation and a native shim matching the read-only Flutter host source. While an old GPS request remains pending, leaving the location component disposes the web listener and rejects its local promise. Reentering and tapping once sends a new UUID request once. Native `_handleLocationMessage` silently returns at `cks_go_host_screen.dart:343` while `_locationInFlight` is true. The old reply still carries the old UUID, so it cannot complete the new request; the new request times out.

The diagnostic records two explicit taps, two distinct requests, one dropped new request, one old reply, zero maps, and no automatic retry. Native must correlate cancellation/navigation or queue the new request instead of silently dropping it. This native subcase was stopped after reproduction. The source checkout and exact native HEAD are recorded in the report. This is a source-matched browser model, **not physical-device evidence**. No Flutter/native code, backend code, or deployment was changed.
