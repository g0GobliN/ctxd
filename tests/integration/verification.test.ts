import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { readDiff } from "@ctxd/diff";
import { buildCorrectionContext, discoverChecks, verify } from "@ctxd/verify";

/**
 * The verification engine is only worth anything if it runs real commands and
 * reports what really happened. These tests build a throwaway project whose
 * checks are plain Node scripts, so the outcome is controlled without mocking
 * the thing under test.
 */

let repo: string;

function write(relative: string, content: string): void {
  const path = join(repo, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function manifest(scripts: Record<string, string>): string {
  return `${JSON.stringify({ name: "fixture", private: true, scripts }, null, 2)}\n`;
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), "ctxd-verify-"));
  execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: repo });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repo });
  execFileSync("git", ["config", "user.name", "ctxd test"], { cwd: repo });

  write("pass.js", "process.exit(0);\n");
  write("fail.js", 'console.error("src/app.js(3,5): error TS2345: bad argument");\nprocess.exit(2);\n');
  write("src/app.js", ["const a = 1;", "const b = 2;", "const c = wrong(a, b);", "", "module.exports = c;", ""].join("\n"));
});

after(() => {
  if (repo !== undefined) rmSync(repo, { recursive: true, force: true });
});

describe("check discovery (§41, §43)", () => {
  it("reads the project's own scripts rather than assuming a runner", () => {
    write("package.json", manifest({ typecheck: "node pass.js", test: "node pass.js" }));

    const checks = discoverChecks(repo);
    assert.deepEqual(checks.map((check) => check.kind).sort(), ["test", "typecheck"]);
    assert.match(checks[0]?.source ?? "", /package\.json scripts\./);
  });

  it("finds nothing in a project with no manifest", () => {
    const empty = mkdtempSync(join(tmpdir(), "ctxd-empty-"));
    try {
      assert.deepEqual(discoverChecks(empty), []);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("verification results (§43)", () => {
  it("reports PASS only when checks actually ran and passed", () => {
    write("package.json", manifest({ typecheck: "node pass.js", test: "node pass.js" }));

    const result = verify({ cwd: repo, files: [] });
    assert.equal(result.status, "PASS");
    assert.ok(result.checks.every((check) => check.status === "passed"));
    assert.ok(result.checks.length >= 2);
  });

  it("reports FAIL and keeps the failing output", () => {
    write("package.json", manifest({ typecheck: "node fail.js", test: "node pass.js" }));

    const result = verify({ cwd: repo, files: [] });
    assert.equal(result.status, "FAIL");

    const failed = result.checks.find((check) => check.status === "failed");
    assert.ok(failed, "expected a failed check");
    assert.equal(failed.kind, "typecheck");
    assert.equal(failed.exitCode, 2);
    assert.match(failed.output ?? "", /TS2345/);
    assert.ok(result.reasons.some((reason) => reason.includes("typecheck failed")));
  });

  it("does not call an unverifiable project a pass", () => {
    write("package.json", manifest({}));

    const result = verify({ cwd: repo, files: [] });
    assert.equal(result.status, "NEEDS_REVIEW");
    assert.ok(
      result.reasons.some((reason) => reason.includes("no verification checks are configured")),
      `expected an explanation, got ${JSON.stringify(result.reasons)}`,
    );
  });

  it("names the commands it would run without running them", () => {
    write("package.json", manifest({ test: "node fail.js" }));

    const result = verify({ cwd: repo, files: [], dryRun: true });
    assert.equal(result.status, "UNKNOWN");
    assert.ok(result.checks.every((check) => check.status === "skipped"));
  });

  it("treats an architecture violation as review, not as a broken build", () => {
    write("package.json", manifest({ test: "node pass.js" }));
    write("apps/portal/src/db.js", "const db = openDatabase();\n");

    const files = readDiff({ cwd: repo }).files;
    const result = verify({
      cwd: repo,
      files,
      rules: [
        {
          id: "frontend-no-db",
          rule: "Frontend must not access the database directly.",
          appliesTo: "^apps/portal/",
          forbids: "openDatabase",
        },
      ],
    });

    assert.equal(result.status, "NEEDS_REVIEW");
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.path, "apps/portal/src/db.js");

    rmSync(join(repo, "apps"), { recursive: true, force: true });
  });
});

describe("correction context from a real failure (§43, §60)", () => {
  it("builds a compact context pointing at the real failing line", () => {
    write("package.json", manifest({ typecheck: "node fail.js" }));

    const result = verify({ cwd: repo, files: [] });
    assert.equal(result.status, "FAIL");

    const correction = buildCorrectionContext({
      task: "Make the app compile",
      result,
      readFile: (path) => {
        try {
          return readFileSync(join(repo, path), "utf8");
        } catch {
          return undefined;
        }
      },
    });

    assert.match(correction.text, /CORRECTION CONTEXT/);
    assert.match(correction.text, /Make the app compile/);
    assert.match(correction.text, /TS2345/);
    // It found src/app.js from the error text and showed the offending line.
    assert.match(correction.text, /src\/app\.js/);
    assert.match(correction.text, /wrong\(a, b\)/);
    assert.ok(correction.estimatedTokens < 800);
  });
});
