import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidence = dirname(fileURLToPath(import.meta.url));
const project = resolve(evidence, "../..");
const startingHead = "094a78e96851462b7c02cf147081a4642b16b2eb";
const testFiles = [
  "src/checkout/contracts.test.ts",
  "src/checkout/api.test.ts",
  "src/checkout/components.test.ts",
  "src/orders/contracts.test.ts",
  "src/orders/api.test.ts",
  "runtime/server.test.mjs",
  "src/components/Layout.test.ts",
  "src/customer/DeliveryAddressPicker.test.tsx",
  "src/customer/DeliveryLocationSetup.test.tsx",
  "src/location/bridge.test.ts",
  "src/location/api.test.ts",
  "src/catalogue/startup.test.tsx",
  "src/components/session/SessionStatus.test.ts",
  "src/session/controller.test.ts",
  "src/webview/bridge.test.ts",
  "src/catalogue/components.test.ts",
  "src/catalogue/advertisements.test.ts",
  "src/catalogue/api.test.ts",
  "src/catalogue/state.test.ts",
  "src/catalogue/AdvertisingCarousel.test.tsx",
  "src/catalogue/refresh.test.ts",
  "src/catalogue/home-advertisements.test.ts",
  "src/webview/external-link.test.ts",
];
const gitFiles = (args) => {
  const result = spawnSync("git", args, { cwd: project, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.split(/\r?\n/).filter(Boolean);
};
const formattingFiles = [
  ...new Set([
    ...gitFiles(["diff", "--name-only", startingHead]),
    ...gitFiles(["ls-files", "--others", "--exclude-standard"]),
  ]),
].filter((name) => /\.(?:css|ts|tsx|mjs|html|json|md)$/.test(name));
const stages = [
  ["focused-unit", "node_modules/vitest/vitest.mjs", "run", ...testFiles],
  ["scroll-browser", "verification/cust-ux-batch01/scroll-browser.mjs"],
  ["address-browser", "verification/cust-ux-batch01/address-run-browser.mjs"],
  ["startup-browser", "verification/cust-ux-batch01/startup-run-browser.mjs"],
  [
    "format",
    "node_modules/prettier/bin/prettier.cjs",
    "--check",
    ...formattingFiles,
  ],
];
const report = {
  task: "CUST-UX-BATCH01",
  startingHead,
  startedAt: new Date().toISOString(),
  scope:
    "Combined focused regression only; no full suite, build or broad typecheck gate",
  physicalWebView: "PENDING",
  testFiles,
  results: [],
};
for (const [name, ...args] of stages) {
  const result = spawnSync(process.execPath, args, {
    cwd: project,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  const output = result.stdout + result.stderr;
  writeFileSync(resolve(evidence, `${name}.log`), output);
  const status = {
    name,
    exitCode: result.status,
    status: result.status === 0 ? "PASS" : "FAIL",
  };
  if (name === "focused-unit") {
    status.tests = Number(output.match(/Tests\s+(\d+) passed/)?.[1] ?? 0);
    status.files = Number(output.match(/Test Files\s+(\d+) passed/)?.[1] ?? 0);
  }
  if (name.endsWith("-browser") && result.status === 0) {
    const filename =
      name === "scroll-browser"
        ? "scroll-report.json"
        : name === "address-browser"
          ? "address-report.json"
          : "startup-browser-report.json";
    status.browserSummary = JSON.parse(
      readFileSync(resolve(evidence, filename), "utf8"),
    ).summary;
    const formatReport = spawnSync(
      process.execPath,
      [
        "node_modules/prettier/bin/prettier.cjs",
        "--write",
        resolve(evidence, filename),
      ],
      { cwd: project, encoding: "utf8" },
    );
    if (formatReport.status !== 0) throw new Error(formatReport.stderr);
  }
  report.results.push(status);
  console.log(JSON.stringify(status));
  if (result.status !== 0) {
    console.log(output);
    break;
  }
}
report.finishedAt = new Date().toISOString();
const filename = resolve(evidence, "focused-report.json");
writeFileSync(filename, JSON.stringify(report, null, 2) + "\n");
const formatting = spawnSync(
  process.execPath,
  ["node_modules/prettier/bin/prettier.cjs", "--write", filename],
  { cwd: project, encoding: "utf8" },
);
if (formatting.status !== 0) throw new Error(formatting.stderr);
process.exitCode = report.results.some((result) => result.status === "FAIL")
  ? 1
  : 0;
