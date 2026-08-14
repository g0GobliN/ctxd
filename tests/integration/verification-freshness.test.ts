import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { verificationFreshness } from "@ctxd/diff";

/**
 * Verification freshness (UI-8, §21).
 *
 * The exit criterion is a single sentence — a stale PASS is never shown as
 * current — and it is the most consequential one in the interface, because a
 * PASS is the number a developer acts on without reading further.
 *
 * There is no verification-runs table, so freshness is judged against the tree:
 * something changed after the check, or it did not. These tests use a real Git
 * repository and real file writes, because the whole verdict rests on mtimes
 * and `git status` behaving the way the code assumes they do.
 */

let repo: string;

function git(...args: string[]): void {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

/** An ISO timestamp safely in the past, so writes land after it. */
function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), "ctxd-freshness-"));
  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "ctxd test");
  git("config", "commit.gpgsign", "false");

  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src", "app.ts"), "export const value = 1;\n");
  git("add", ".");
  git("commit", "-m", "initial");
});

after(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("verification freshness (UI-8)", () => {
  it("reports unknown when nothing has ever been verified", () => {
    const report = verificationFreshness({ cwd: repo });

    assert.equal(report.freshness, "unknown");
    assert.equal(report.status, "unknown");
    assert.equal(report.at, null);
    assert.match(report.reason, /no verification has been recorded/);
  });

  it("calls a check current when the tree has not moved since", () => {
    const report = verificationFreshness({
      cwd: repo,
      status: "PASS",
      // After the commit, and nothing has been written since.
      at: new Date(Date.now() + 1000).toISOString(),
    });

    assert.equal(report.freshness, "current");
    assert.equal(report.changedSince, null);
  });

  it("never shows a stale PASS as current", () => {
    // A check ran, and then a file changed. This is the case the phase exists
    // for: the status is genuinely PASS and genuinely no longer applicable.
    const ranAt = secondsAgo(60);
    writeFileSync(join(repo, "src", "app.ts"), "export const value = 2;\n");

    const report = verificationFreshness({ cwd: repo, status: "PASS", at: ranAt });

    assert.equal(report.freshness, "stale");
    assert.equal(report.status, "PASS");
    assert.match(report.changedSince ?? "", /app\.ts$/);
    // The reason names the file, so the verdict can be checked rather than
    // merely believed.
    assert.match(report.reason, /app\.ts/);
    assert.match(report.reason, /earlier state of the tree/);
  });

  it("counts an untracked file as a change to the tree", () => {
    // Commit what the previous case dirtied, so the only outstanding change is
    // the new file and the verdict can only be pointing at it.
    git("add", ".");
    git("commit", "-m", "second");

    const ranAt = secondsAgo(60);
    writeFileSync(join(repo, "src", "new-thing.ts"), "export const added = true;\n");

    const report = verificationFreshness({ cwd: repo, status: "PASS", at: ranAt });

    // A worker that creates a file changed the repository as much as one that
    // edits it, and a check that predates the new file did not see it.
    assert.equal(report.freshness, "stale");
    assert.match(report.changedSince ?? "", /new-thing\.ts$/);
  });

  it("counts work committed after the check as a change", () => {
    git("add", ".");
    git("commit", "-m", "third");

    const report = verificationFreshness({
      cwd: repo,
      status: "PASS",
      at: secondsAgo(300),
    });

    assert.equal(report.freshness, "stale");
    // With a clean tree there is no changed file to point at, so the commit is
    // what is named — the verdict still traces to something observable.
    assert.equal(report.changedSince, "HEAD");
    assert.match(report.reason, /committed after this check ran/);
  });

  it("reports unknown outside a repository rather than assuming current", () => {
    const loose = mkdtempSync(join(tmpdir(), "ctxd-not-a-repo-"));
    try {
      const report = verificationFreshness({
        cwd: loose,
        status: "PASS",
        at: secondsAgo(10),
      });

      // Anything that cannot be established reads unknown, never current: an
      // unnecessary unknown costs a re-run, a false current costs correctness.
      assert.equal(report.freshness, "unknown");
      assert.equal(report.status, "PASS");
      assert.match(report.reason, /cannot tell whether the tree has changed/);
    } finally {
      rmSync(loose, { recursive: true, force: true });
    }
  });

  it("reports unknown when the receipt's timestamp cannot be read", () => {
    const report = verificationFreshness({
      cwd: repo,
      status: "PASS",
      at: "not a timestamp",
    });

    assert.equal(report.freshness, "unknown");
    assert.match(report.reason, /timestamp could not be read/);
  });

  it("keeps a FAIL a FAIL, whatever its age", () => {
    const report = verificationFreshness({
      cwd: repo,
      status: "FAIL",
      at: secondsAgo(600),
    });

    // Freshness qualifies the verdict; it never replaces it. A stale FAIL is
    // still the last thing ctxd actually observed.
    assert.equal(report.status, "FAIL");
    assert.ok(report.freshness === "stale" || report.freshness === "current");
  });
});
