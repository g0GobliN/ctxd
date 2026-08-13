import { randomUUID } from "node:crypto";
import type { Db } from "@ctxd/db";

export type SessionEventKind = "activity" | "error" | "decision" | "memory" | "note";

export interface Session {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly worker: string | null;
  readonly branch: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly summary: string | null;
}

export interface SessionEvent {
  readonly id: number;
  readonly sessionId: string;
  readonly kind: SessionEventKind;
  readonly detail: string;
  readonly createdAt: string;
}

interface SessionRow {
  readonly id: string;
  readonly project_id: string;
  readonly task_id: string | null;
  readonly worker: string | null;
  readonly branch: string | null;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly summary: string | null;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    worker: row.worker,
    branch: row.branch,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    summary: row.summary,
  };
}

export interface StartSessionInput {
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly worker?: string | null;
  readonly branch?: string | null;
}

/**
 * Start a session.
 *
 * A project has at most one open session: starting another while one is open
 * returns the existing one rather than creating a second, so activity is never
 * split across two records by accident.
 */
export function startSession(
  db: Db,
  input: StartSessionInput,
  now = new Date(),
): { session: Session; alreadyOpen: boolean } {
  const open = activeSession(db, input.projectId);
  if (open !== undefined) return { session: open, alreadyOpen: true };

  const session: Session = {
    id: randomUUID(),
    projectId: input.projectId,
    taskId: input.taskId ?? null,
    worker: input.worker ?? null,
    branch: input.branch ?? null,
    startedAt: now.toISOString(),
    endedAt: null,
    summary: null,
  };

  db.prepare(
    `INSERT INTO sessions (id, project_id, task_id, worker, branch, started_at, ended_at, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    session.id,
    session.projectId,
    session.taskId,
    session.worker,
    session.branch,
    session.startedAt,
    session.endedAt,
    session.summary,
  );

  return { session, alreadyOpen: false };
}

/** The project's open session, if any. */
export function activeSession(db: Db, projectId: string): Session | undefined {
  const row = db
    .prepare(
      "SELECT * FROM sessions WHERE project_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(projectId) as SessionRow | undefined;
  return row === undefined ? undefined : toSession(row);
}

export function getSession(db: Db, id: string): Session | undefined {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
  return row === undefined ? undefined : toSession(row);
}

export function lastSession(db: Db, projectId: string): Session | undefined {
  const row = db
    .prepare("SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT 1")
    .get(projectId) as SessionRow | undefined;
  return row === undefined ? undefined : toSession(row);
}

/** Record something that happened. Append-only. */
export function recordEvent(
  db: Db,
  sessionId: string,
  kind: SessionEventKind,
  detail: string,
  now = new Date(),
): void {
  db.prepare(
    "INSERT INTO session_events (session_id, kind, detail, created_at) VALUES (?, ?, ?, ?)",
  ).run(sessionId, kind, detail, now.toISOString());
}

export function sessionEvents(db: Db, sessionId: string, limit = 200): SessionEvent[] {
  const rows = db
    .prepare("SELECT * FROM session_events WHERE session_id = ? ORDER BY id ASC LIMIT ?")
    .all(sessionId, limit) as {
    id: number;
    session_id: string;
    kind: string;
    detail: string;
    created_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind as SessionEventKind,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}

/**
 * End a session with a summary.
 *
 * Events are left in place: the summary is an addition, never a replacement.
 * The raw record of what happened stays available.
 */
export function endSession(
  db: Db,
  sessionId: string,
  summary: string,
  now = new Date(),
): Session | undefined {
  db.prepare("UPDATE sessions SET ended_at = ?, summary = ? WHERE id = ? AND ended_at IS NULL").run(
    now.toISOString(),
    summary,
    sessionId,
  );
  return getSession(db, sessionId);
}
