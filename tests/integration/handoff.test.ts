import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { saveMemory } from "@ctxd/memory";
import { detectProject, upsertProject } from "@ctxd/project";
import {
  createTask,
  formatTransfer,
  getTask,
  latestCheckpoint,
  startSession,
  transferTask,
} from "@ctxd/work";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * Cross-worker handoff (UI-11, §37).
 *
 * Exit criterion: a task moves between workers without losing context. Two
 * halves, and the second is the one that is easy to fake — a summary that reads
 * well proves nothing if the task itself never moved, and a task that moved
 * with no recorded state hands the next worker an assignment and no reason.
 *
 * So these tests check both: the assignment actually changed in the database,
 * and everything the outgoing worker knew is still reachable afterwards.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let repo: string;
let bare: string;
let projectId: string;
let emptyProjectId: string;

function git(...args: string[]): void {
  execFileSync("git", args, { cwd: repo, stdio: "ignore" });
}

before(() => {
  ensureDataDir(paths);
  db = openDatabase(paths.dbFile);
  migrate(db);

  repo = mkdtempSync(join(tmpdir(), "ctxd-handoff-"));
  git("init", "--initial-branch=main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "ctxd test");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(repo, "README.md"), "# fixture\n");
  git("add", ".");
  git("commit", "-m", "initial");

  projectId = upsertProject(db, detectProject(repo)).id;

  // A second registered project with no task at all, for the case where there
  // is nothing to reassign. Outside the repository, so detection cannot walk
  // up and find the first one.
  bare = mkdtempSync(join(tmpdir(), "ctxd-handoff-bare-"));
  emptyProjectId = upsertProject(db, detectProject(bare)).id;
});

after(() => {
  db?.close();
  home.cleanup();
  rmSync(repo, { recursive: true, force: true });
  rmSync(bare, { recursive: true, force: true });
});

describe("cross-worker handoff (UI-11)", () => {
  it("moves the task to the incoming worker", () => {
    const task = createTask(db, {
      projectId,
      title: "Fix the webhook retry loop",
      description: "Retries fire twice for the same event id",
      worker: "claude",
    });
    startSession(db, { projectId, taskId: task.id, worker: "claude" });

    const result = transferTask(db, {
      projectId,
      root: repo,
      fromWorker: "claude",
      toWorker: "cursor",
      note: "signature verification is done; the dedup table is not",
    });

    // The assignment actually changed. A handoff that only printed a summary
    // would leave the task owned by a worker that has stopped working on it.
    assert.equal(result.task?.id, task.id);
    assert.equal(getTask(db, task.id)?.worker, "cursor");
    assert.equal(result.fromWorker, "claude");
    assert.equal(result.toWorker, "cursor");
    assert.deepEqual(result.warnings, []);
  });

  it("records a checkpoint so the handover survives the session ending", () => {
    const checkpoint = latestCheckpoint(db, projectId);
    assert.ok(checkpoint !== undefined);

    // The durable half. Without this, an outgoing session that dies before the
    // developer pastes the summary loses the handover entirely.
    assert.match(checkpoint.nextAction, /handed to cursor/);
    assert.match(checkpoint.nextAction, /dedup table/);
    assert.equal(checkpoint.worker, "claude");
  });

  it("carries the constraints and decisions the incoming worker needs", () => {
    saveMemory(db, {
      projectId,
      type: "CONSTRAINT",
      title: "Webhook handlers must be idempotent",
      content: "Stripe retries on any non-2xx, so a handler that is not idempotent double-charges",
      importance: "P0",
      source: "explicit_user",
    });
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Dedup on event id, not payload hash",
      content: "Payloads differ between retries of the same event",
      source: "accepted_decision",
    });

    const result = transferTask(db, {
      projectId,
      root: repo,
      fromWorker: "claude",
      toWorker: "cursor",
    });

    // "Without losing context" is the criterion, and this is what it means in
    // practice: the binding constraint and the accepted decision travel with
    // the work rather than living only in the outgoing worker's session.
    const constraints = result.handoff.constraints.map((memory) => memory.title);
    const decisions = result.handoff.decisions.map((memory) => memory.title);

    assert.ok(constraints.includes("Webhook handlers must be idempotent"));
    assert.ok(decisions.includes("Dedup on event id, not payload hash"));
    assert.equal(result.handoff.recommendedWorker, "cursor");
  });

  it("hands back the other way without losing what the first worker recorded", () => {
    const back = transferTask(db, {
      projectId,
      root: repo,
      fromWorker: "cursor",
      toWorker: "claude",
    });

    assert.equal(back.toWorker, "claude");
    assert.equal(back.task?.worker, "claude");
    // The round trip is the real test of "without losing context": everything
    // recorded before the first handoff is still here after the second.
    assert.ok(
      back.handoff.constraints.some((m) => m.title === "Webhook handlers must be idempotent"),
    );
    assert.ok(back.handoff.decisions.some((m) => m.title === "Dedup on event id, not payload hash"));
  });

  it("takes the outgoing worker from the session when none is given", () => {
    // The session was started with a worker name, which is a recorded fact
    // rather than a guess — so ctxd uses it instead of demanding it again.
    const result = transferTask(db, { projectId, root: repo, toWorker: "cursor" });

    assert.equal(result.fromWorker, "claude");
    assert.deepEqual(result.warnings, []);
  });

  it("says so rather than guessing when nothing names the outgoing worker", () => {
    // No session, no --from. §6: ctxd cannot establish who was working, and
    // naming whoever last touched the project would be exactly the inference
    // the provenance rules forbid.
    const result = transferTask(db, {
      projectId: emptyProjectId,
      root: bare,
      toWorker: "cursor",
    });

    assert.equal(result.fromWorker, null);
    assert.ok(
      result.warnings.some((warning) => warning.includes("unknown sender")),
      `warnings were ${JSON.stringify(result.warnings)}`,
    );
  });

  it("warns rather than pretending when there is no task to move", () => {
    const result = transferTask(db, {
      projectId: emptyProjectId,
      root: bare,
      fromWorker: "claude",
      toWorker: "cursor",
    });

    assert.equal(result.task, undefined);
    assert.ok(
      result.warnings.some((warning) => warning.includes("nothing was reassigned")),
      `warnings were ${JSON.stringify(result.warnings)}`,
    );
    // The checkpoint is still written: the state is worth recording even when
    // there is no task record to attach it to.
    assert.ok(result.checkpoint.id !== "");
  });

  it("notices a handoff that changes nothing", () => {
    const result = transferTask(db, {
      projectId,
      root: repo,
      fromWorker: "cursor",
      toWorker: "cursor",
    });

    assert.ok(
      result.warnings.some((warning) => warning.includes("nothing changed hands")),
      `warnings were ${JSON.stringify(result.warnings)}`,
    );
  });

  it("refuses a transfer with no destination", () => {
    assert.throws(
      () => transferTask(db, { projectId, root: repo, toWorker: "  " }),
      /needs a worker to hand to/,
    );
  });

  it("never presents either name as verified", () => {
    const result = transferTask(db, {
      projectId,
      root: repo,
      fromWorker: "claude",
      toWorker: "cursor",
    });

    const text = formatTransfer(result);
    // The handoff text is what an incoming worker reads. A line saying "from
    // claude" with no qualification is how a self-declared name quietly becomes
    // an assumed fact (§6).
    assert.match(text, /cannot verify either/);
    assert.match(text, /claude → cursor/);
  });
});
