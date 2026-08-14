import type { Db } from "@ctxd/db";
import type { CtxdEvent, EmitEventInput, EventData, EventType } from "./types.js";

interface EventRow {
  readonly id: number;
  readonly project_id: string;
  readonly session_id: string | null;
  readonly task_id: string | null;
  readonly worker: string | null;
  readonly type: string;
  readonly data: string;
  readonly created_at: string;
}

/**
 * Parse a stored payload.
 *
 * A row whose JSON is unreadable still describes something that happened, so
 * the event survives with an empty payload rather than disappearing. Losing
 * the detail is bad; silently losing the event is worse, because the activity
 * stream would then be quietly incomplete while looking complete.
 */
function parseData(raw: string): EventData {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as EventData;
  } catch {
    return {};
  }
}

function toEvent(row: EventRow): CtxdEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    taskId: row.task_id,
    worker: row.worker,
    type: row.type as EventType,
    data: parseData(row.data),
    createdAt: row.created_at,
  };
}

/**
 * Append an event.
 *
 * Append-only, like `session_events`. Nothing updates or deletes a row here:
 * the log is what happened, and a record that can be rewritten is not a record
 * of anything.
 *
 * Returns the assigned id so a caller can correlate a later event with this
 * one — a `worker_request_finished` with the id of its `worker_request_started`.
 */
export function emitEvent(db: Db, input: EmitEventInput, now = new Date()): CtxdEvent {
  const event = {
    projectId: input.projectId,
    sessionId: input.sessionId ?? null,
    taskId: input.taskId ?? null,
    worker: input.worker ?? null,
    type: input.type,
    data: input.data ?? {},
    createdAt: now.toISOString(),
  };

  const result = db
    .prepare(
      `INSERT INTO events (project_id, session_id, task_id, worker, type, data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.projectId,
      event.sessionId,
      event.taskId,
      event.worker,
      event.type,
      JSON.stringify(event.data),
      event.createdAt,
    );

  return { ...event, id: Number(result.lastInsertRowid) };
}

export interface ReadEventsOptions {
  /** Return events after this id. The SSE cursor: 0 means from the beginning. */
  readonly after?: number;
  readonly limit?: number;
  readonly type?: EventType;
}

/** How many events one read returns before the caller must ask again. */
export const EVENT_PAGE = 200;

/**
 * Read events for a project in the order they happened.
 *
 * Ascending by id, because a client replaying what it missed has to see the
 * events in the order they occurred, and the interface would otherwise animate
 * a response before its request.
 */
export function readEvents(
  db: Db,
  projectId: string,
  options: ReadEventsOptions = {},
): CtxdEvent[] {
  const after = options.after ?? 0;
  const limit = Math.min(Math.max(options.limit ?? EVENT_PAGE, 1), 1000);

  const rows =
    options.type === undefined
      ? (db
          .prepare(
            `SELECT * FROM events WHERE project_id = ? AND id > ?
             ORDER BY id ASC LIMIT ?`,
          )
          .all(projectId, after, limit) as EventRow[])
      : (db
          .prepare(
            `SELECT * FROM events WHERE project_id = ? AND id > ? AND type = ?
             ORDER BY id ASC LIMIT ?`,
          )
          .all(projectId, after, options.type, limit) as EventRow[]);

  return rows.map(toEvent);
}

/**
 * The newest events, newest first.
 *
 * What the activity panel shows on load, before the stream takes over. Reads
 * the tail directly rather than counting the table, so it stays constant-time
 * as the log grows.
 */
export function recentEvents(db: Db, projectId: string, limit = 50): CtxdEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM events WHERE project_id = ?
       ORDER BY id DESC LIMIT ?`,
    )
    .all(projectId, Math.min(Math.max(limit, 1), 1000)) as EventRow[];
  return rows.map(toEvent);
}

/**
 * The highest event id in the log, or 0 when it is empty.
 *
 * A client that only wants what happens from now on starts here, rather than
 * replaying history it never asked for.
 */
export function latestEventId(db: Db, projectId: string): number {
  const row = db
    .prepare("SELECT MAX(id) AS max_id FROM events WHERE project_id = ?")
    .get(projectId) as { max_id: number | null } | undefined;
  return row?.max_id ?? 0;
}
