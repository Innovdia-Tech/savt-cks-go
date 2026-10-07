import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const evidence = dirname(fileURLToPath(import.meta.url));
const project = resolve(evidence, "../..");
const git = spawnSync("git", ["diff", "--name-only", "HEAD"], {
  cwd: project,
  encoding: "utf8",
});
if (git.status !== 0) throw new Error(git.stderr);
const formattingFiles = [
  ...git.stdout.trim().split(/\r?\n/).filter(Boolean),
  "src/checkout/processing-fee.test-fixtures.ts",
  ...readdirSync(evidence)
    .filter((name) => /\.(?:mjs|tsx|html|json|md)$/.test(name))
    .map((name) => `verification/cust-fee01/${name}`),
];
const stages = [
  ["full-tests", "node_modules/vitest/vitest.mjs", "run"],
  ["frontend-typecheck", "node_modules/typescript/bin/tsc", "-b"],
  [
    "runtime-typecheck",
    "node_modules/typescript/bin/tsc",
    "-p",
    "tsconfig.runtime.json",
  ],
  [
    "production-build",
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "vite.config.js",
    "--configLoader",
    "runner",
  ],
  [
    "format",
    "node_modules/prettier/bin/prettier.cjs",
    "--check",
    ...new Set(formattingFiles),
  ],
];
const results = [];
for (const [name, ...args] of stages) {
  const result = spawnSync(process.execPath, args, {
    cwd: project,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = result.stdout + result.stderr;
  writeFileSync(resolve(evidence, `${name}.log`), output);
  const status = {
    name,
    exitCode: result.status,
    status: result.status === 0 ? "PASS" : "FAIL",
  };
  if (name === "full-tests") {
    status.tests = Number(output.match(/Tests\s+(\d+) passed/)?.[1] ?? 0);
  }
  results.push(status);
  console.log(JSON.stringify(status));
  if (result.status !== 0) console.log(output);
}
writeFileSync(
  resolve(evidence, "local-gate-report.json"),
  JSON.stringify({ results }, null, 2) + "\n",
);
process.exitCode = results.some((result) => result.status === "FAIL") ? 1 : 0;
