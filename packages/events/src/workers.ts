/**
 * Worker state derived from the event log (§6).
 *
 * The rule this file exists to enforce: ctxd reports what it observed and
 * nothing more. A worker it has never seen is UNKNOWN, not idle and not
 * disconnected — absence of evidence is not evidence, and the interface has to
 * be able to tell the difference.
 */

import type { Db } from "@ctxd/db";

/**
 * What the log says about a worker right now.
 *
 * - `connected` — the last transport event was an attachment
 * - `working` — a request started and has not finished
 * - `error` — the last thing it did was fail
 * - `disconnected` — it detached
 * - `unknown` — nothing was ever recorded
 */
export type WorkerConnectionState =
  | "connected"
  | "working"
  | "error"
  | "disconnected"
  | "unknown";

export interface WorkerConnection {
  /** The name the worker was configured with. Never verified (§6). */
  readonly claimedWorker: string;
  readonly state: WorkerConnectionState;
  /** When the event behind `state` happened. */
  readonly since: string | null;
  /** Any recorded activity, which may be newer than the state-defining event. */
  readonly lastActivityAt: string | null;
  /**
   * A connection observed opening but never observed closing.
   *
   * True while a worker is genuinely attached — and also when its process was
   * killed outright, since no disconnect can be written by a process that is
   * already gone. So this is reported alongside `since` rather than resolved:
   * a caller that wants to weigh the age can, and ctxd does not have to invent
   * a timeout and call the result knowledge.
   */
  readonly openEnded: boolean;
}

interface StateRow {
  readonly worker: string;
  readonly type: string;
  readonly created_at: string;
}

/**
 * Current state for every worker the log has seen.
 *
 * One pass over the project's events, newest first, taking the first
 * state-defining event per worker. Events with no worker are skipped: they
 * happened, but they say nothing about who was connected.
 */
export function workerConnections(db: Db, projectId: string): WorkerConnection[] {
  const rows = db
    .prepare(
      `SELECT worker, type, created_at
       FROM events
       WHERE project_id = ? AND worker IS NOT NULL
       ORDER BY id DESC`,
    )
    .all(projectId) as StateRow[];

  const byWorker = new Map<string, { state: StateRow | undefined; lastActivity: string }>();

  for (const row of rows) {
    const existing = byWorker.get(row.worker);
    if (existing === undefined) {
      byWorker.set(row.worker, { state: undefined, lastActivity: row.created_at });
    }

    const entry = byWorker.get(row.worker);
    if (entry === undefined || entry.state !== undefined) continue;

    // The first of these seen going backwards is the current state; anything
    // else is activity that does not change whether the worker is attached.
    if (
      row.type === "worker_connected" ||
      row.type === "worker_disconnected" ||
      row.type === "worker_error" ||
      row.type === "worker_request_started" ||
      row.type === "worker_request_finished"
    ) {
      entry.state = row;
    }
  }

  return [...byWorker.entries()].map(([worker, entry]) => {
    const type = entry.state?.type;
    return {
      claimedWorker: worker,
      state: toState(type),
      since: entry.state?.created_at ?? null,
      lastActivityAt: entry.lastActivity,
      openEnded: type === "worker_connected" || type === "worker_request_started",
    };
  });
}

function toState(type: string | undefined): WorkerConnectionState {
  switch (type) {
    case "worker_connected":
    case "worker_request_finished":
      return "connected";
    case "worker_request_started":
      return "working";
    case "worker_error":
      return "error";
    case "worker_disconnected":
      return "disconnected";
    default:
      // Activity was recorded but no transport event ever was. Something used
      // ctxd; whether it is still attached is genuinely not known.
      return "unknown";
  }
}

/**
 * Delete events older than a cutoff.
 *
 * The log is append-only during a session but not kept forever: it grows with
 * every tool call, and a table that only ever grows becomes a slow startup and
 * a large file on someone's laptop. Old events have already been summarised
 * into sessions, checkpoints and receipts, which are the durable record.
 *
 * Returns how many rows were removed.
 */
export function pruneEvents(db: Db, before: Date): number {
  const result = db.prepare("DELETE FROM events WHERE created_at < ?").run(before.toISOString());
  return result.changes;
}

/** Days of event history kept by default. */
export const DEFAULT_RETENTION_DAYS = 30;
