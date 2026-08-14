import { strict as assert } from "node:assert";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase, TARGET_SCHEMA_VERSION, type Db } from "@ctxd/db";
import {
  emitEvent,
  latestEventId,
  readEvents,
  recentEvents,
  type CtxdEvent,
} from "@ctxd/events";
import { startSession } from "@ctxd/work";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

const PROJECT = "events-project";
let counter = 0;

function freshDb(name: string): Db {
  const db = openDatabase(join(home.dir, `events-${name}.db`));
  migrate(db);
  db.prepare(
    "INSERT INTO projects (id, root, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(PROJECT, `/tmp/events-${(counter += 1)}`, "fixture", "2026-01-01", "2026-01-01");
  return db;
}

describe("event log (§7)", () => {
  it("ships as a migration, so an existing database gains it on open", () => {
    assert.ok(TARGET_SCHEMA_VERSION >= 5);
    const db = freshDb("migration");
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events'")
      .get();
    assert.notEqual(table, undefined);
    db.close();
  });

  it("records an event with no session, which session_events cannot", () => {
    const db = freshDb("no-session");

    // The case that forced a second table: a worker attaches before any
    // session exists, so there is no session_id to reference (§7.2).
    const event = emitEvent(db, {
      projectId: PROJECT,
      type: "worker_connected",
      worker: "claude",
    });

    assert.equal(event.sessionId, null);
    assert.equal(event.taskId, null);
    assert.equal(event.type, "worker_connected");
    db.close();
  });

  it("still links an event to a session when there is one", () => {
    const db = freshDb("with-session");
    const { session } = startSession(db, { projectId: PROJECT, worker: "cursor" });

    const event = emitEvent(db, {
      projectId: PROJECT,
      type: "context_built",
      sessionId: session.id,
      worker: "cursor",
      data: { candidateTokens: 51_000, finalTokens: 9_000 },
    });

    assert.equal(event.sessionId, session.id);
    assert.equal(event.data["finalTokens"], 9_000);
    db.close();
  });

  it("returns events in the order they happened", () => {
    const db = freshDb("ordering");
    for (const type of ["context_requested", "context_built", "worker_request_finished"] as const) {
      emitEvent(db, { projectId: PROJECT, type });
    }

    const events = readEvents(db, PROJECT);
    assert.deepEqual(
      events.map((event) => event.type),
      ["context_requested", "context_built", "worker_request_finished"],
    );
    db.close();
  });

  it("replays only what a cursor missed", () => {
    const db = freshDb("cursor");
    const first = emitEvent(db, { projectId: PROJECT, type: "worker_connected" });
    emitEvent(db, { projectId: PROJECT, type: "context_requested" });
    emitEvent(db, { projectId: PROJECT, type: "context_built" });

    // What a reconnecting SSE client sends as Last-Event-ID.
    const missed = readEvents(db, PROJECT, { after: first.id });

    assert.equal(missed.length, 2);
    assert.deepEqual(
      missed.map((event) => event.type),
      ["context_requested", "context_built"],
    );
    db.close();
  });

  it("keeps one project's events out of another's", () => {
    const db = freshDb("isolation");
    db.prepare(
      "INSERT INTO projects (id, root, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("other-project", "/tmp/other", "other", "2026-01-01", "2026-01-01");

    emitEvent(db, { projectId: PROJECT, type: "worker_connected" });
    emitEvent(db, { projectId: "other-project", type: "worker_connected" });

    assert.equal(readEvents(db, PROJECT).length, 1);
    assert.equal(readEvents(db, "other-project").length, 1);
    db.close();
  });

  it("records a worker as a claim, not as a verified identity", () => {
    const db = freshDb("claim");

    // Anything may name itself anything: the server observes an attachment,
    // never an identity (§6). The log's job is to attribute, not to vouch.
    const event = emitEvent(db, {
      projectId: PROJECT,
      type: "worker_connected",
      worker: "definitely-claude",
    });

    assert.equal(event.worker, "definitely-claude");
    db.close();
  });

  it("leaves the worker null rather than guessing one", () => {
    const db = freshDb("unknown-worker");
    const event = emitEvent(db, { projectId: PROJECT, type: "verification_started" });

    // §37: absent evidence reads as absent, so the interface can say UNKNOWN.
    assert.equal(event.worker, null);
    db.close();
  });

  it("survives a payload that is not readable JSON", () => {
    const db = freshDb("corrupt");
    emitEvent(db, { projectId: PROJECT, type: "task_updated" });
    db.prepare("UPDATE events SET data = ? WHERE id = 1").run("{not json");

    // The event still happened. Losing the detail is acceptable; losing the
    // event silently would make the activity stream quietly incomplete.
    const events = readEvents(db, PROJECT);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0]?.data, {});
    db.close();
  });

  it("caps how much one read returns", () => {
    const db = freshDb("limit");
    for (let index = 0; index < 30; index += 1) {
      emitEvent(db, { projectId: PROJECT, type: "memory_updated" });
    }

    assert.equal(readEvents(db, PROJECT, { limit: 10 }).length, 10);
    db.close();
  });

  it("reports the newest id so a client can start from now", () => {
    const db = freshDb("latest");
    assert.equal(latestEventId(db, PROJECT), 0);

    const event = emitEvent(db, { projectId: PROJECT, type: "checkpoint_created" });
    assert.equal(latestEventId(db, PROJECT), event.id);
    db.close();
  });

  it("shows the newest events first for the activity panel", () => {
    const db = freshDb("recent");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected" });
    emitEvent(db, { projectId: PROJECT, type: "context_requested" });

    const recent: CtxdEvent[] = recentEvents(db, PROJECT, 5);
    assert.equal(recent[0]?.type, "context_requested");
    db.close();
  });

  it("removes a project's events with the project", () => {
    const db = freshDb("cascade");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected" });
    db.prepare("DELETE FROM projects WHERE id = ?").run(PROJECT);

    assert.equal(readEvents(db, PROJECT).length, 0);
    db.close();
  });

  it("keeps an event after its session is deleted", () => {
    const db = freshDb("session-cascade");
    const { session } = startSession(db, { projectId: PROJECT, worker: "claude" });
    emitEvent(db, { projectId: PROJECT, type: "context_built", sessionId: session.id });

    db.prepare("DELETE FROM sessions WHERE id = ?").run(session.id);

    // ON DELETE SET NULL, not CASCADE: what happened still happened, and an
    // append-only log that loses rows is not a record of anything.
    const events = readEvents(db, PROJECT);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.sessionId, null);
    db.close();
  });
});
