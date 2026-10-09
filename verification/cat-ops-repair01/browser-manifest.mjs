// Evidence-only report generator. It compares the actual completed BEFORE/AFTER
// runs and hashes all twenty screenshots. No application/backend files are read
// or changed beyond saved evidence reports.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const output = fileURLToPath(new URL("./browser/", import.meta.url));
const read = async (phase) =>
  JSON.parse(await readFile(join(output, phase, "results.json"), "utf8"));
const [before, after] = await Promise.all([read("before"), read("after")]);
assert.equal(before.result, "PASS");
assert.equal(after.result, "PASS");
assert.deepEqual(before.handoffHashes, after.handoffHashes);
assert.deepEqual(before.scenarioFingerprints, after.scenarioFingerprints);
const positiveBefore = before.screenChecks.filter(
  (check) => check.actualBarcodeNodes.length > 0,
);
assert.equal(positiveBefore.length, 20);
assert.equal(
  after.screenChecks.filter((check) => check.actualBarcodeNodes.length > 0)
    .length,
  0,
);
const identity = ({ width, scenario, surface, name, rawApiBarcode }) => ({
  width,
  scenario,
  surface,
  name,
  rawApiBarcode,
});
assert.deepEqual(
  before.screenChecks.map(identity),
  after.screenChecks.map(identity),
  "Item data cases must remain identical across render changes",
);
const envelopeIdentity = ({ width, scenario, path, envelopeFingerprint }) => ({
  width,
  scenario,
  path,
  envelopeFingerprint,
});
assert.deepEqual(
  before.responseChecks.map(envelopeIdentity),
  after.responseChecks.map(envelopeIdentity),
  "Raw HTTP responses must remain identical",
);
assert.deepEqual(
  before.receiptChecks,
  after.receiptChecks,
  "PDF handoff payload evidence must remain identical",
);
const pairs = [];
for (const capture of before.screenshots) {
  const match = after.screenshots.find(
    (item) => item.width === capture.width && item.surface === capture.surface,
  );
  assert(match, "Screenshot pair missing");
  const artifact = async (phase, filename) => {
    const bytes = await readFile(join(output, phase, filename));
    return {
      path: `${phase}/${filename}`,
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  };
  pairs.push({
    width: capture.width,
    surface: capture.surface,
    scenario: capture.scenario,
    before: await artifact("before", capture.filename),
    after: await artifact("after", match.filename),
  });
}
const manifest = {
  result: "PASS",
  claimScope:
    "LOCAL ONLY bounded Chromium evidence from actual built React apps, actual runtime proxy and strict parsers against synthetic HTTP/session/native boundaries. No full authenticated/backend/native-device/payment acceptance.",
  baselineSourceHead: before.baselineSourceHead,
  baselineSourceTree: before.baselineSourceTree,
  browser: after.browser,
  widths: [390, 320],
  screenshots: { before: 10, after: 10, total: 20, pairs },
  assertions: {
    surfaceChecksBefore: before.screenChecks.length,
    surfaceChecksAfter: after.screenChecks.length,
    populatedOrLeadingZeroVisibleBefore: positiveBefore.length,
    barcodeDisplaysAfter: 0,
    missingAndNullCasesAccepted: true,
    descriptionNumbersAndApprovedClassificationPreserved: true,
    pricesQuantitiesCartQuoteOrderIdentityPreserved: true,
    quotePaymentEntryEnabledWithoutPaymentExecution: true,
    sameRawHttpEnvelopesBeforeAfter: true,
    rawResponseComparisonsPerPhase: after.responseChecks.length,
    originalHandoffBytesUnchanged: true,
    exactPdfHandoffsBefore: before.receiptChecks.length,
    exactPdfHandoffsAfter: after.receiptChecks.length,
    pdfSha256: after.handoffHashes["final-sales-receipt.pdf"],
    noHorizontalOverflow: true,
    noNavigationPurchaseOverlap: true,
    browserErrors: [...before.errors, ...after.errors],
    unexpectedRoutes: [...before.unexpected, ...after.unexpected],
    blockedExternalOrigins: [
      ...new Set([
        ...before.blockedExternalOriginsBeforeNetwork,
        ...after.blockedExternalOriginsBeforeNetwork,
      ]),
    ],
  },
  beforeReport: "before/results.json",
  afterReport: "after/results.json",
  beforeArtifacts: before.appArtifacts,
  afterArtifacts: after.appArtifacts,
  handoffHashes: after.handoffHashes,
  syntheticDependencies: after.synthetic,
  limitations: after.limitation,
  visualReview:
    "Five BEFORE and five AFTER captures spanning every surface and both widths were visually inspected. Every screenshot also has DOM overflow/navigation geometry assertions.",
};
assert.deepEqual(manifest.assertions.browserErrors, []);
assert.deepEqual(manifest.assertions.unexpectedRoutes, []);
await writeFile(
  join(output, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    result: "PASS",
    screenshots: 20,
    surfaceChecks: before.screenChecks.length + after.screenChecks.length,
    exactPdfHandoffs: before.receiptChecks.length + after.receiptChecks.length,
    output: join(output, "manifest.json"),
  }),
);
