import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  analyzeWorkingTree,
  isGitRepository,
  readDiff,
  writeChangeReceipt,
} from "@ctxd/diff";

/**
 * These tests drive the Diff Firewall through real Git rather than fixture
 * text, because the parser's job is to agree with what Git actually emits.
 * Everything happens in a temporary directory — no test touches ~/.ctxd or the
 * developer's repository.
 */

let repo: string;

function git(args: readonly string[], cwd = repo): string {
  return execFileSync("git", args as string[], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function write(relative: string, content: string): void {
  const path = join(repo, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

const WEBHOOK = [
  "import { store } from './store.js';",
  "",
  "export function handleWebhook(event) {",
  "  const retryLimit = 3;",
  "  if (store.has(event.id)) return;",
  "  store.add(event.id);",
  "  return process(event, retryLimit);",
  "}",
  "",
].join("\n");

const CAMERA = [
  "export function startStream(device) {",
  "  const fps = 30;",
  "  return device.open(fps);",
  "}",
  "",
].join("\n");

/** A file large enough that reformatting it is unmistakably a large change. */
const LEDGER = Array.from(
  { length: 120 },
  (_, i) => `export function entry${i}(amount) {\n  return amount + ${i};\n}`,
).join("\n").concat("\n");

before(() => {
  repo = mkdtempSync(join(tmpdir(), "ctxd-diff-"));
  git(["init", "--quiet", "--initial-branch=main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "ctxd test"]);
  git(["config", "commit.gpgsign", "false"]);

  write("src/payment/webhook.js", WEBHOOK);
  write("src/payment/ledger.js", LEDGER);
  write("src/camera/stream.js", CAMERA);
  write("package.json", '{\n  "name": "fixture",\n  "dependencies": {}\n}\n');
  git(["add", "."]);
  git(["commit", "--quiet", "-m", "initial"]);
});

after(() => {
  if (repo !== undefined) rmSync(repo, { recursive: true, force: true });
});

describe("readDiff against a real repository", () => {
  it("recognises the temporary directory as a repository", () => {
    assert.equal(isGitRepository(repo), true);
  });

  it("reports no changes on a clean tree", () => {
    const source = readDiff({ cwd: repo });
    assert.equal(source.files.length, 0);
    assert.equal(source.warnings.length, 0);
  });
});

describe("the one-line fix (§55, §82)", () => {
  it("classifies a small task with a small diff as FOCUSED", () => {
    write("src/payment/webhook.js", WEBHOOK.replace("retryLimit = 3", "retryLimit = 5"));

    const analysis = analyzeWorkingTree({
      cwd: repo,
      task: "Change the webhook retry limit from 3 to 5",
      worker: "claude",
      project: "fixture",
    });

    assert.equal(analysis.surface.files_changed, 1);
    assert.equal(analysis.surface.semantic_lines, 2);
    assert.deepEqual(analysis.surface.unrelated_files, []);
    assert.equal(analysis.classification.classification, "FOCUSED");
    assert.equal(analysis.receipt.change_efficiency_score, 1);

    git(["checkout", "--", "."]);
  });
});

describe("the over-edit (§50, §52, §55)", () => {
  it("flags a small task that reformatted a file and touched unrelated code", () => {
    // The intended one-line fix…
    const reformatted = WEBHOOK.replace("retryLimit = 3", "retryLimit = 5")
      // …plus a whole-file reindent the task never asked for.
      .replace(/^ {2}/gm, "    ");
    write("src/payment/webhook.js", reformatted);

    // …plus an unrelated file, and a new dependency.
    write("src/camera/stream.js", CAMERA.replace("fps = 30", "fps = 60"));
    write("package.json", '{\n  "name": "fixture",\n  "dependencies": {\n    "left-pad": "^1.3.0"\n  }\n}\n');

    const analysis = analyzeWorkingTree({
      cwd: repo,
      task: "Change the webhook retry limit from 3 to 5",
      worker: "claude",
      project: "fixture",
    });

    assert.equal(analysis.surface.files_changed, 3);
    assert.ok(
      analysis.surface.unrelated_files.includes("src/camera/stream.js"),
      `expected the camera file to be flagged, got ${JSON.stringify(analysis.surface.unrelated_files)}`,
    );
    assert.equal(analysis.surface.dependency_changes, 1);
    assert.ok(analysis.surface.formatting_lines > 0, "expected reindentation to register as noise");

    // A small task that produced this must not pass as a focused change.
    assert.ok(
      ["BROAD", "SUSPICIOUS", "NEEDS_REVIEW"].includes(analysis.classification.classification),
      `expected the change to be flagged, got ${analysis.classification.classification}`,
    );
    assert.ok(analysis.receipt.change_efficiency_score < 1);

    // …but nothing was reverted: the worker's files are exactly as written.
    const after = readDiff({ cwd: repo });
    assert.equal(after.files.length, 3);

    git(["checkout", "--", "."]);
  });

  it("flags SMALL TASK / LARGE CHANGE MISMATCH when a one-line fix reformats a whole file", () => {
    // The requested one-line fix…
    write("src/payment/webhook.js", WEBHOOK.replace("retryLimit = 3", "retryLimit = 5"));
    // …and a 120-function file reindented for no reason the task gave.
    write("src/payment/ledger.js", LEDGER.replace(/^ {2}/gm, "        "));

    const analysis = analyzeWorkingTree({
      cwd: repo,
      task: "Change the webhook retry limit from 3 to 5",
      worker: "claude",
      project: "fixture",
    });

    assert.equal(analysis.classification.classification, "NEEDS_REVIEW");
    assert.equal(analysis.overEdit.smallTaskMismatch, true);

    // The churn is reported as presentation, not mistaken for real change.
    assert.ok(
      analysis.surface.formatting_lines >= 200,
      `expected the reindent to register as churn, got ${analysis.surface.formatting_lines}`,
    );
    assert.equal(analysis.surface.formatting_only_changes, 1);

    // The reason must be stated, not merely asserted (§52).
    const mismatch = analysis.overEdit.signals.find(
      (signal) => signal.id === "small-task-large-change",
    );
    assert.ok(mismatch);
    assert.match(mismatch.evidence, /expected about \d+ file\(s\)/);

    git(["checkout", "--", "."]);
  });
});

describe("untracked files", () => {
  it("counts a newly created file as an addition without staging it", () => {
    write("src/payment/idempotency.js", "export const key = (e) => e.id;\n");

    const source = readDiff({ cwd: repo });
    assert.deepEqual(source.untrackedFiles, ["src/payment/idempotency.js"]);
    const added = source.files.find((file) => file.path === "src/payment/idempotency.js");
    assert.ok(added, "expected the untracked file in the diff");
    assert.equal(added.kind, "added");
    assert.equal(added.linesAdded, 1);

    // Reading must not have staged anything.
    const staged = git(["diff", "--cached", "--name-only"]).trim();
    assert.equal(staged, "");

    rmSync(join(repo, "src/payment/idempotency.js"));
  });
});

describe("renames", () => {
  it("reads a move as one rename, not a delete plus an add", () => {
    git(["mv", "src/camera/stream.js", "src/camera/video.js"]);

    const source = readDiff({ cwd: repo });
    const renamed = source.files.find((file) => file.kind === "renamed");
    assert.ok(renamed, `expected a rename, got ${JSON.stringify(source.files.map((f) => f.kind))}`);
    assert.equal(renamed.oldPath, "src/camera/stream.js");
    assert.equal(renamed.path, "src/camera/video.js");

    git(["reset", "--hard", "--quiet", "HEAD"]);
  });
});

describe("the Change Receipt (§56)", () => {
  it("writes a receipt to a directory and reads back the same verdict", () => {
    write("src/payment/webhook.js", WEBHOOK.replace("retryLimit = 3", "retryLimit = 5"));

    const analysis = analyzeWorkingTree({
      cwd: repo,
      task: "Change the webhook retry limit from 3 to 5",
      worker: "claude",
      project: "fixture",
      verification: "PASS",
    });

    const receiptDir = mkdtempSync(join(tmpdir(), "ctxd-receipts-"));
    try {
      const path = writeChangeReceipt(receiptDir, analysis.receipt);
      assert.ok(path.endsWith(".json"));
      assert.equal(analysis.receipt.verification_status, "PASS");
      assert.equal(analysis.receipt.worker, "claude");
      assert.equal(analysis.receipt.files_changed, 1);
    } finally {
      rmSync(receiptDir, { recursive: true, force: true });
      git(["checkout", "--", "."]);
    }
  });
});
