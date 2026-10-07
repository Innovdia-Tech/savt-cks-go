# FE-RECEIPT01 local verification

The Android host treated the existing Blob download as a fatal page error. Embedded receipt saving now sends already-authorized PDF bytes through `SavtCksGoBridge`; standalone browsers retain their object URL and anchor download, including existing filenames.

## Document boundary

The exact envelope is `{type: "document-save", payload}`. The payload has exactly `protocolVersion: "1"`, UUIDv4 `requestId`, `filename`, `mimeType: "application/pdf"`, and `base64`. Filenames use ASCII alphanumerics, spaces, underscores and hyphens, end in `.pdf`, and are at most 120 characters. PDF bytes must begin `%PDF-` and have a decoded size from 5 through 2,097,152 bytes.

The exact `savt-cks-go-document-result` detail is `{protocolVersion: "1", requestId, status: "saved" | "failed"}`. The result contains no file path. Native success clears downloading and displays `Receipt saved`; failure keeps the readable order page and retry state. Completion is fenced to the owning order and settles once.

The legacy Android document picker is user-paced, so there is no document-result timeout. A lost native result requires leaving/reopening the host. No receipt URL, cookie, token, authorization header or payment status crosses this bridge.

## Focused checks — 2026-10-04

- 157 tests passed in the nine affected receipt and bridge files below.
- TypeScript application/runtime typecheck and production Vite build passed.
- Changed-file Prettier check, diff whitespace check and strict UI audit passed.
- Independent review found two lifecycle issues; delayed-result and retired-picker cleanup regressions passed after repairs.

```sh
pnpm exec vitest run src/orders/download.test.ts src/orders/state.test.ts src/orders/components.test.ts src/orders/api.test.ts src/orders/documents.test.ts src/webview/bridge.test.ts src/webview/document-save.test.ts src/location/bridge.test.ts src/support/SupportAction.test.ts
pnpm run typecheck
pnpm run build
```

## Loopback device fixture

`receipt-native.html`, `receipt-native.tsx` and `vite.receipt.config.mjs` are test-only. The production build still uses its normal entry point. The fixture renders the real order detail components and controller, performs actual credentialed receipt fetches, and uses the real native host/bootstrap/document bridge.

```sh
pnpm exec vite build --config verification/vite.receipt.config.mjs
```

Run the native repository's loopback server with this build directory and an existing receipt PDF, then its `integration_test/cks_go_receipt_test.dart` on a physical Android device. The fixture logs metadata and state transitions without PDF bytes or credentials. It resets all events and commands before each run.

Physical acceptance passed on OPPO CPH1937 / Android API 30: payment/final actions saved files; malformed save and unexpected download remained nonfatal; the host remained open; Back returned to the Savt test screen. Both saved 6,674-byte files matched the source PDF SHA-256 `06a02517dafecaff8ec84338c8c075b64f388c5b2172c7099bcfeb1d41fca297` and parsed as one-page PDFs. The PDFs opened in the device viewer.

This fixture uses synthetic loopback authentication and the same existing payment PDF for both document kinds. It proves transfer and file saving; real Savt login and real Final Sales Receipt issuance were not exercised. No backend/API, financial, payment, lifecycle, identity or session architecture changed. No push, PR, merge or deployment occurred; FE-FINAL01 still gates qualification.
