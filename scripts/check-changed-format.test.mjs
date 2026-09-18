import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = resolve("scripts/check-changed-format.mjs");
const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "cks-format-test-"));
  directories.push(directory);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const write = (name, text) => {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), text);
  };
  const commit = () => {
    git("add", ".");
    git("commit", "-m", "fixture");
  };
  git("init");
  git("config", "user.name", "Formatter test");
  git("config", "user.email", "formatter@example.invalid");
  git("config", "commit.gpgsign", "false");
  write("legacy.js", "const legacy=1");
  commit();
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  const check = (base = "") =>
    spawnSync(process.execPath, [script], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, FORMAT_BASE_REF: base },
    });
  return { git, write, commit, check };
};

describe("changed-file formatting gate", () => {
  it("uses origin/main by default without checking unchanged legacy debt", () => {
    const repo = fixture();
    repo.write("new.js", "const value = 1;\n");
    repo.commit();
    const result = repo.check();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 files");
  });

  it("propagates failures for changed filenames with spaces and brackets without modifying them", () => {
    const repo = fixture();
    repo.write("changed [one] file.js", "const value=1");
    repo.commit();
    expect(repo.check().status).toBe(1);
    expect(repo.git("status", "--porcelain")).toBe("");
    expect(repo.check("HEAD").status).toBe(0);
  });

  it("respects the two exclusions and skips unsupported or deleted files", () => {
    const repo = fixture();
    repo.write(".prettierignore", "/src/App.tsx\n/src/components/Layout.tsx\n");
    repo.write("src/App.tsx", "const app=1");
    repo.write("src/components/Layout.tsx", "const layout=1");
    repo.write("notes.unknown", "not prettier input");
    repo.git("rm", "legacy.js");
    repo.commit();
    const result = repo.check();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("no supported, non-ignored files");
  });

  it("checks renamed legacy files when they enter the changed set", () => {
    const repo = fixture();
    repo.git("mv", "legacy.js", "renamed.js");
    repo.commit();
    expect(repo.check().status).toBe(1);
  });
});
