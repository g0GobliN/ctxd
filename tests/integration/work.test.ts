import { strict as assert } from "node:assert";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { saveMemory } from "@ctxd/memory";
import {
  activeSession,
  buildHandoff,
  buildResume,
  createCheckpoint,
  createTask,
  endSession,
  formatHandoff,
  getTask,
  latestCheckpoint,
  listTasks,
  recordEvent,
  sessionEvents,
  startSession,
  subtasks,
  taskProgress,
  updateTask,
} from "@ctxd/work";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

const PROJECT = "work-project";
let counter = 0;

function freshDb(name: string): Db {
  const db = openDatabase(join(home.dir, `work-${name}.db`));
  migrate(db);
  db.prepare(
    "INSERT INTO projects (id, root, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(PROJECT, `/tmp/work-${(counter += 1)}`, "fixture", "2026-01-01", "2026-01-01");
  return db;
}

describe("tasks", () => {
  it("creates a task with sensible defaults", () => {
    const db = freshDb("create");
    const task = createTask(db, { projectId: PROJECT, title: "Fix idempotency" });

    assert.equal(task.status, "BACKLOG");
    assert.equal(task.priority, "P2");
    assert.equal(task.completedAt, null);
    db.close();
  });

  it("supports decomposition and reports progress", () => {
    const db = freshDb("decompose");
    const parent = createTask(db, { projectId: PROJECT, title: "Parent" });
    const first = createTask(db, { projectId: PROJECT, title: "Step one", parentTask: parent.id });
    createTask(db, { projectId: PROJECT, title: "Step two", parentTask: parent.id });

    assert.equal(subtasks(db, parent.id).length, 2);
    assert.deepEqual(taskProgress(db, parent.id), { total: 2, done: 0, remaining: 2 });

    updateTask(db, first.id, { status: "DONE" });
    assert.deepEqual(taskProgress(db, parent.id), { total: 2, done: 1, remaining: 1 });
    db.close();
  });

  it("stamps completion when a task reaches a terminal status", () => {
    const db = freshDb("complete");
    const task = createTask(db, { projectId: PROJECT, title: "Ship it" });

    const done = updateTask(db, task.id, { status: "DONE" }, new Date("2026-08-01T00:00:00Z"));
    assert.equal(done?.completedAt, "2026-08-01T00:00:00.000Z");
    db.close();
  });

  it("clears completion when a closed task is reopened", () => {
    const db = freshDb("reopen");
    const task = createTask(db, { projectId: PROJECT, title: "Premature" });
    updateTask(db, task.id, { status: "DONE" });

    const reopened = updateTask(db, task.id, { status: "IN_PROGRESS" });
    assert.equal(reopened?.completedAt, null, "a reopened task must not claim it is finished");
    db.close();
  });

  it("hides terminal tasks from the default listing", () => {
    const db = freshDb("listing");
    const open = createTask(db, { projectId: PROJECT, title: "Open" });
    const closed = createTask(db, { projectId: PROJECT, title: "Closed" });
    updateTask(db, closed.id, { status: "DONE" });

    const listed = listTasks(db, PROJECT);
    assert.deepEqual(listed.map((task) => task.id), [open.id]);
    assert.equal(listTasks(db, PROJECT, { includeTerminal: true }).length, 2);
    db.close();
  });

  it("orphans subtasks rather than destroying them when a parent is deleted", () => {
    const db = freshDb("orphan");
    const parent = createTask(db, { projectId: PROJECT, title: "Parent" });
    const child = createTask(db, { projectId: PROJECT, title: "Child", parentTask: parent.id });

    db.prepare("DELETE FROM tasks WHERE id = ?").run(parent.id);
    assert.equal(getTask(db, child.id)?.parentTask, null);
    db.close();
  });
});

describe("sessions", () => {
  it("starts and ends a session", () => {
    const db = freshDb("session");
    const { session, alreadyOpen } = startSession(db, { projectId: PROJECT, worker: "claude" });

    assert.equal(alreadyOpen, false);
    assert.equal(activeSession(db, PROJECT)?.id, session.id);

    endSession(db, session.id, "did some work");
    assert.equal(activeSession(db, PROJECT), undefined);
    db.close();
  });

  it("never opens a second session alongside an open one", () => {
    const db = freshDb("single");
    const first = startSession(db, { projectId: PROJECT });
    const second = startSession(db, { projectId: PROJECT });

    assert.equal(second.alreadyOpen, true);
    assert.equal(second.session.id, first.session.id);
    db.close();
  });

  it("keeps events after the session ends", () => {
    const db = freshDb("events");
    const { session } = startSession(db, { projectId: PROJECT });
    recordEvent(db, session.id, "activity", "wrote the reservation protocol");
    recordEvent(db, session.id, "error", "expected 409, got 200");

    endSession(db, session.id, "summary");

    const events = sessionEvents(db, session.id);
    assert.equal(events.length, 2, "a summary must not replace the record of what happened");
    assert.deepEqual(events.map((event) => event.kind), ["activity", "error"]);
    db.close();
  });
});

describe("checkpoints", () => {
  it("derives what it can from recorded state", () => {
    const db = freshDb("derive");
    const task = createTask(db, { projectId: PROJECT, title: "Fix idempotency" });
    const { session } = startSession(db, { projectId: PROJECT, taskId: task.id, worker: "claude" });
    recordEvent(db, session.id, "activity", "added reservation");
    recordEvent(db, session.id, "error", "409 not returned");

    const checkpoint = createCheckpoint(db, {
      projectId: PROJECT,
      root: home.dir,
      git: { available: true, insideWorkTree: false },
    });

    assert.equal(checkpoint.objective, "Fix idempotency");
    assert.match(checkpoint.completed, /added reservation/);
    assert.deepEqual(checkpoint.knownErrors, ["409 not returned"]);
    assert.equal(checkpoint.worker, "claude");
    db.close();
  });

  it("prefers what the caller supplies", () => {
    const db = freshDb("supplied");
    startSession(db, { projectId: PROJECT });

    const checkpoint = createCheckpoint(db, {
      projectId: PROJECT,
      root: home.dir,
      objective: "Explicit objective",
      nextAction: "Run the tests",
      git: { available: true, insideWorkTree: false },
    });

    assert.equal(checkpoint.objective, "Explicit objective");
    assert.equal(checkpoint.nextAction, "Run the tests");
    db.close();
  });

  it("records changed files from Git", () => {
    const db = freshDb("git-files");
    const checkpoint = createCheckpoint(db, {
      projectId: PROJECT,
      root: home.dir,
      git: {
        available: true,
        insideWorkTree: true,
        branch: "main",
        changes: [
          { status: "M", path: "src/payment/webhook.ts" },
          { status: "A", path: "tests/webhook.test.ts" },
        ],
      },
    });

    assert.equal(checkpoint.branch, "main");
    assert.deepEqual(checkpoint.changedFiles, [
      "src/payment/webhook.ts",
      "tests/webhook.test.ts",
    ]);
    db.close();
  });

  it("leaves the session and its events intact", () => {
    const db = freshDb("intact");
    const { session } = startSession(db, { projectId: PROJECT });
    recordEvent(db, session.id, "activity", "something happened");

    createCheckpoint(db, {
      projectId: PROJECT,
      root: home.dir,
      git: { available: true, insideWorkTree: false },
    });

    assert.equal(activeSession(db, PROJECT)?.id, session.id);
    assert.equal(sessionEvents(db, session.id).length, 1);
    db.close();
  });
});

describe("handoff", () => {
  it("assembles constraints, decisions and bugs from memory", () => {
    const db = freshDb("handoff");
    const task = createTask(db, { projectId: PROJECT, title: "Fix idempotency" });
    startSession(db, { projectId: PROJECT, taskId: task.id, worker: "claude" });

    saveMemory(db, {
      projectId: PROJECT,
      type: "RULE",
      title: "No duplicate payments",
      content: "Binding.",
      source: "project_rule",
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "DECISION",
      title: "Key on the event id",
      content: "Decided.",
      source: "accepted_decision",
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "BUG",
      title: "Port collision",
      content: "Known.",
      source: "verified_code",
    });

    createCheckpoint(db, {
      projectId: PROJECT,
      root: home.dir,
      completed: "reservation added",
      git: { available: true, insideWorkTree: false },
    });

    const handoff = buildHandoff(db, {
      projectId: PROJECT,
      root: home.dir,
      recommendedWorker: "cursor",
      git: { available: true, insideWorkTree: false },
    });

    assert.equal(handoff.task, "Fix idempotency");
    assert.equal(handoff.lastWorker, "claude");
    assert.equal(handoff.recommendedWorker, "cursor");
    assert.equal(handoff.constraints.length, 1);
    assert.equal(handoff.decisions.length, 1);
    assert.equal(handoff.knownBugs.length, 1);

    const text = formatHandoff(handoff);
    assert.match(text, /No duplicate payments/);
    assert.match(text, /RECOMMENDED: cursor/);
    db.close();
  });

  it("still produces something useful with no checkpoint", () => {
    const db = freshDb("bare-handoff");
    createTask(db, { projectId: PROJECT, title: "Something to do" });

    const handoff = buildHandoff(db, {
      projectId: PROJECT,
      root: home.dir,
      git: { available: true, insideWorkTree: false },
    });

    assert.match(handoff.completed, /no checkpoint recorded/);
    assert.match(handoff.remaining, /Something to do/);
    db.close();
  });
});

describe("resume", () => {
  it("answers what was I doing", () => {
    const db = freshDb("resume");
    const task = createTask(db, { projectId: PROJECT, title: "Fix idempotency" });
    startSession(db, { projectId: PROJECT, taskId: task.id, worker: "claude" });
    createCheckpoint(db, {
      projectId: PROJECT,
      root: home.dir,
      nextAction: "Fix the 409 path",
      git: { available: true, insideWorkTree: false },
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "RULE",
      title: "No duplicate payments",
      content: "Binding.",
      source: "project_rule",
    });

    const summary = buildResume(db, PROJECT, home.dir);
    assert.match(summary, /Session open since/);
    assert.match(summary, /Fix the 409 path/);
    assert.match(summary, /Fix idempotency/);
    assert.match(summary, /No duplicate payments/);
    db.close();
  });

  it("says plainly when there is nothing to resume", () => {
    const db = freshDb("nothing");
    const summary = buildResume(db, PROJECT, home.dir);

    assert.match(summary, /No open session/);
    assert.match(summary, /No checkpoint recorded yet/);
    assert.ok(latestCheckpoint(db, PROJECT) === undefined);
    db.close();
  });
});
