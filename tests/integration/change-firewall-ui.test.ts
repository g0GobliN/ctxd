import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The Change Firewall in the interface (UI-6).
 *
 * `@ctxd/diff` has computed all of this since Phase 7; what UI-6 adds is the
 * interface actually showing it. So the test that matters is not whether the
 * analysis is right — the change benchmarks cover that — but whether the
 * payload the interface renders carries a real warning, with the evidence
 * behind it, over the real route.
 *
 * Exit criterion: a small-change scenario produces a real warning. Real means
 * a genuine repository, a genuine diff, and the warning arriving over HTTP.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;
let repo: string;

interface Signal {
  readonly id: string;
  readonly severity: string;
  readonly summary: string;
  readonly evidence: string;
}

interface Receipt {
  readonly request_id: string;
  readonly task: string;
  readonly scope: string;
  readonly files_changed: number;
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  readonly unrelated_files: readonly string[];
  readonly dependency_changes: number;
  readonly expected_size: string;
  readonly expected_files: number | null;
  readonly expected_lines: number | null;
  readonly classification: string;
  readonly classification_reasons: readonly string[];
  readonly recommendation: string;
  readonly risk: string;
  readonly change_efficiency_score: number;
  readonly verification_status: string;
  readonly signals: readonly Signal[];
  readonly comments_flagged: readonly string[];
  readonly files: readonly { path: string; related: boolean; reason: string }[];
  readonly algorithm_version: string;
}

function git(...args: string[]): void {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

/** The one-line fix, before anyone got carried away. */
const RETRY_BEFORE = `import { sleep } from "../util/sleep.js";

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
}

export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  if (attempt < 0) return false;
  return attempt <= policy.maxAttempts;
}

export function backoffMs(attempt: number, policy: RetryPolicy): number {
  return policy.baseDelayMs * 2 ** attempt;
}

export async function withRetry<T>(op: () => Promise<T>, policy: RetryPolicy): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await op();
    } catch (error) {
      if (!shouldRetry(attempt, policy)) throw error;
      await sleep(backoffMs(attempt, policy));
      attempt += 1;
    }
  }
}
`;

/** The same fix, plus a reindent of the whole file and some obvious comments. */
const RETRY_AFTER = `import { sleep } from '../util/sleep.js';

export interface RetryPolicy {
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
}

// Returns true if we should retry.
export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
    if (attempt < 0) return false;
    return attempt < policy.maxAttempts;
}

// Computes the backoff.
export function backoffMs(attempt: number, policy: RetryPolicy): number {
    return policy.baseDelayMs * 2 ** attempt;
}

// Runs the retry loop.
export async function withRetry<T>(op: () => Promise<T>, policy: RetryPolicy): Promise<T> {
    let attempt = 0;
    for (;;) {
        try {
            return await op();
        } catch (error) {
            if (!shouldRetry(attempt, policy)) throw error;
            await sleep(backoffMs(attempt, policy));
            attempt += 1;
        }
    }
}
`;

before(async () => {
  ensureDataDir(paths);
  db = openDatabase(paths.dbFile);
  migrate(db);

  repo = mkdtempSync(join(tmpdir(), "ctxd-firewall-ui-"));
  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "ctxd test");
  git("config", "commit.gpgsign", "false");

  mkdirSync(join(repo, "src", "http"), { recursive: true });
  mkdirSync(join(repo, "src", "billing"), { recursive: true });
  mkdirSync(join(repo, "src", "reporting"), { recursive: true });

  writeFileSync(join(repo, "src", "http", "retry.ts"), RETRY_BEFORE);
  writeFileSync(
    join(repo, "src", "billing", "invoice.ts"),
    "export function total(cents: number[]): number {\n  return cents.reduce((a, b) => a + b, 0);\n}\n",
  );
  writeFileSync(
    join(repo, "src", "reporting", "export.ts"),
    "export function toCsv(rows: string[][]): string {\n  return rows.map((r) => r.join(\",\")).join(\"\\n\");\n}\n",
  );
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify({ name: "fixture", dependencies: { undici: "^6.19.0" } }, null, 2) + "\n",
  );
  git("add", ".");
  git("commit", "-m", "initial");

  // Now the sprawl: the fix, a whole-file reindent, two unrelated files and a
  // new dependency — all delivered under a task that asked for one line.
  writeFileSync(join(repo, "src", "http", "retry.ts"), RETRY_AFTER);
  writeFileSync(
    join(repo, "src", "billing", "invoice.ts"),
    "// Adds up the amounts.\nexport function total(cents: number[]): number {\n    return cents.reduce((a, b) => a + b, 0);\n}\n",
  );
  writeFileSync(
    join(repo, "src", "reporting", "export.ts"),
    "// Turns rows into CSV.\nexport function toCsv(rows: string[][]): string {\n    return rows.map((r) => r.join(\",\")).join(\"\\n\");\n}\n",
  );
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify(
      { name: "fixture", dependencies: { undici: "^6.19.0", "p-retry": "^6.2.0" } },
      null,
      2,
    ) + "\n",
  );

  api = await startApiServer({
    db,
    paths,
    config: DEFAULT_CONFIG,
    dir: repo,
    host: "127.0.0.1",
    port: 0,
    token: "test-token-not-a-real-secret",
  });
});

after(async () => {
  await api?.close();
  db?.close();
  home.cleanup();
  rmSync(repo, { recursive: true, force: true });
});

async function analyse(task: string): Promise<Receipt> {
  const response = await fetch(
    `${api.url}/api/diff?dir=${encodeURIComponent(repo)}&task=${encodeURIComponent(task)}`,
  );
  assert.equal(response.status, 200);
  return (await response.json()) as Receipt;
}

describe("Change Firewall in the interface (UI-6)", () => {
  it("produces a real warning for a small task with a sprawling change", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");

    const warnings = receipt.signals.filter((signal) => signal.severity === "warning");
    assert.ok(warnings.length > 0, "the interface had no warning to show");

    // A warning a developer cannot check is one they learn to dismiss, so each
    // one has to carry the evidence behind it as well as a summary.
    for (const warning of warnings) {
      assert.notEqual(warning.summary, "");
      assert.notEqual(warning.evidence, "");
    }

    // At least one warning must be tied to the *task* rather than only to the
    // diff's shape — that is what makes it small-fix protection (§55) rather
    // than a generic size complaint. Which of the two fires depends on how far
    // past the expectation the diff went: `small-task-large-change` is the
    // severe form, `multi-file-spread` the proportionate one, and pinning a
    // specific id here would make the test a snapshot of today's thresholds
    // rather than a check on the guarantee. The severe form is pinned by the
    // small-change-sprawl benchmark, where the diff earns it.
    const scoped = warnings.filter(
      (signal) => signal.id === "small-task-large-change" || signal.id === "multi-file-spread",
    );
    assert.ok(
      scoped.length > 0,
      `no task-scoped warning; signals were ${JSON.stringify(receipt.signals)}`,
    );
    assert.match(scoped[0]?.evidence ?? "", /small|expected/i);
  });

  it("carries the expectation the warning is measured against (§51)", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");

    // The panel shows expected beside actual so the verdict can be argued with
    // rather than only accepted. That needs all three fields to arrive.
    assert.equal(receipt.expected_size, "small");
    assert.ok(receipt.expected_files !== null);
    assert.ok(receipt.expected_lines !== null);
    assert.ok(receipt.files_changed > (receipt.expected_files ?? 0));
  });

  it("names the unrelated files rather than only counting them", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");

    assert.ok(receipt.unrelated_files.length > 0);
    for (const path of receipt.unrelated_files) assert.notEqual(path, "");
    // Every file in the receipt says why it was judged related or not.
    for (const file of receipt.files) assert.notEqual(file.reason, "");
  });

  it("separates presentation change from semantic change (§53)", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");

    // The reindent is the bulk of the diff. Reporting it apart from semantic
    // change is what lets a reviewer skip it — and ctxd still reverts nothing.
    assert.ok(receipt.formatting_lines > 0);
    assert.ok(receipt.semantic_lines > 0);
  });

  it("flags a dependency change, which no retry fix required", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");
    assert.ok(receipt.dependency_changes > 0);
  });

  it("still returns a full receipt rather than rejecting the work (§50)", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");

    assert.notEqual(receipt.request_id, "");
    assert.notEqual(receipt.recommendation, "");
    assert.ok(receipt.classification_reasons.length > 0);
    assert.equal(receipt.files.length, receipt.files_changed);
    assert.notEqual(receipt.algorithm_version, "");
  });

  it("reports verification as unknown rather than implying it passed", async () => {
    const receipt = await analyse("Fix the off-by-one in the retry limit check");
    // `ctxd diff` runs no checks. Anything other than UNKNOWN here would be the
    // interface claiming a check that never happened.
    assert.equal(receipt.verification_status, "UNKNOWN");
  });

  it("stays quiet when the task genuinely covers the change", async () => {
    // Same diff, honestly described. The firewall must not warn merely because
    // a diff is large — a tool that warns on everything protects nothing.
    const receipt = await analyse(
      "Reformat the retry, billing and reporting modules and adopt p-retry",
    );

    const mismatch = receipt.signals.find((s) => s.id === "small-task-large-change");
    assert.equal(mismatch, undefined);
  });
});
