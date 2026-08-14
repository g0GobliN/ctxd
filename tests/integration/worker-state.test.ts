import { strict as assert } from "node:assert";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { emitEvent, pruneEvents, workerConnections } from "@ctxd/events";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * Worker state derived from the event log (§6, UI-2).
 *
 * The property under test throughout: ctxd reports what it observed and never
 * more. Every case where evidence is missing must come out UNKNOWN.
 */

const home = createTempHome();
after(() => home.cleanup());

const PROJECT = "worker-state";
let counter = 0;

function freshDb(name: string): Db {
  const db = openDatabase(join(home.dir, `ws-${name}.db`));
  migrate(db);
  db.prepare(
    "INSERT INTO projects (id, root, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(PROJECT, `/tmp/ws-${(counter += 1)}`, "fixture", "2026-01-01", "2026-01-01");
  return db;
}

describe("worker connection state (§6)", () => {
  it("reports a worker as connected after it attaches", () => {
    const db = freshDb("connected");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });

    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.state, "connected");
    assert.equal(connection?.openEnded, true);
    db.close();
  });

  it("reports it as disconnected after it leaves", () => {
    const db = freshDb("disconnected");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });
    emitEvent(db, { projectId: PROJECT, type: "worker_disconnected", worker: "claude" });

    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.state, "disconnected");
    assert.equal(connection?.openEnded, false);
    db.close();
  });

  it("reports it as working while a request is in flight", () => {
    const db = freshDb("working");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "cursor" });
    emitEvent(db, { projectId: PROJECT, type: "worker_request_started", worker: "cursor" });

    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.state, "working");
    db.close();
  });

  it("returns to connected when the request finishes", () => {
    const db = freshDb("finished");
    emitEvent(db, { projectId: PROJECT, type: "worker_request_started", worker: "cursor" });
    emitEvent(db, { projectId: PROJECT, type: "worker_request_finished", worker: "cursor" });

    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.state, "connected");
    db.close();
  });

  it("reports an error as an error", () => {
    const db = freshDb("error");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });
    emitEvent(db, { projectId: PROJECT, type: "worker_error", worker: "claude" });

    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.state, "error");
    db.close();
  });

  it("knows nothing about a worker it has never seen", () => {
    const db = freshDb("never-seen");
    assert.deepEqual(workerConnections(db, PROJECT), []);
    db.close();
  });

  it("says unknown when there is activity but no transport event", () => {
    const db = freshDb("activity-only");
    // Something used ctxd and named itself, but never announced attaching.
    // Whether it is still there is genuinely not known — and "not known" is a
    // different answer from "gone".
    emitEvent(db, { projectId: PROJECT, type: "context_built", worker: "mystery" });

    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.state, "unknown");
    assert.notEqual(connection?.lastActivityAt, null);
    db.close();
  });

  it("does not let one worker's state describe another", () => {
    const db = freshDb("two-workers");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });
    emitEvent(db, { projectId: PROJECT, type: "worker_disconnected", worker: "cursor" });

    const byWorker = new Map(
      workerConnections(db, PROJECT).map((entry) => [entry.claimedWorker, entry.state]),
    );
    assert.equal(byWorker.get("claude"), "connected");
    assert.equal(byWorker.get("cursor"), "disconnected");
    db.close();
  });

  it("ignores events that name no worker", () => {
    const db = freshDb("no-worker");
    emitEvent(db, { projectId: PROJECT, type: "verification_started" });

    // The event happened, but it says nothing about who was attached, so it
    // must not conjure a worker row.
    assert.deepEqual(workerConnections(db, PROJECT), []);
    db.close();
  });

  it("flags a connection that was never observed closing", () => {
    const db = freshDb("open-ended");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });

    // A killed process cannot write its own disconnect, so "connected" can
    // outlive the connection. The caller is told, rather than ctxd inventing a
    // timeout and presenting the guess as knowledge.
    const [connection] = workerConnections(db, PROJECT);
    assert.equal(connection?.openEnded, true);
    assert.notEqual(connection?.since, null);
    db.close();
  });
});

describe("event retention", () => {
  it("removes events older than the cutoff and keeps the rest", () => {
    const db = freshDb("prune");
    emitEvent(db, { projectId: PROJECT, type: "worker_connected" }, new Date("2020-01-01"));
    emitEvent(db, { projectId: PROJECT, type: "worker_disconnected" }, new Date("2026-08-01"));

    const removed = pruneEvents(db, new Date("2026-01-01"));

    assert.equal(removed, 1);
    const left = db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number };
    assert.equal(left.n, 1);
    db.close();
  });
});
