import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import * as prettier from "prettier";

const require = createRequire(import.meta.url);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const root = git("rev-parse", "--show-toplevel").trim();
process.chdir(root);
const base = process.env.FORMAT_BASE_REF || "origin/main";
const baseSha = git(
  "rev-parse",
  "--verify",
  "--end-of-options",
  `${base}^{commit}`,
).trim();
const changed = git(
  "diff",
  "--name-only",
  "-z",
  "--diff-filter=ACMRT",
  `${baseSha}...HEAD`,
  "--",
)
  .split("\0")
  .filter(Boolean);
const files = [];
for (const file of changed) {
  const info = await prettier.getFileInfo(file, {
    ignorePath: ".prettierignore",
  });
  if (!info.ignored && info.inferredParser) files.push(resolve(root, file));
}
if (files.length === 0) {
  console.log(
    "Changed-file formatting: no supported, non-ignored files to check.",
  );
} else {
  console.log(`Changed-file formatting against ${base}: ${files.length} files`);
  const binary = resolve(
    dirname(require.resolve("prettier/package.json")),
    "bin/prettier.cjs",
  );
  const result = spawnSync(
    process.execPath,
    [binary, "--check", "--ignore-path", ".prettierignore", ...files],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
