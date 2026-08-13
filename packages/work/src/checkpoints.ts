import { randomUUID } from "node:crypto";
import type { Db } from "@ctxd/db";
import { listMemories, type Memory } from "@ctxd/memory";
import { inspectGit, type GitInfo } from "@ctxd/project";
import { getTask, listTasks, type Task } from "./tasks.js";
import { activeSession, sessionEvents } from "./sessions.js";

export interface Checkpoint {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly sessionId: string | null;
  readonly objective: string;
  readonly completed: string;
  readonly remaining: string;
  readonly nextAction: string;
  readonly worker: string | null;
  readonly branch: string | null;
  readonly changedFiles: readonly string[];
  readonly knownErrors: readonly string[];
  readonly createdAt: string;
}

interface CheckpointRow {
  readonly id: string;
  readonly project_id: string;
  readonly task_id: string | null;
  readonly session_id: string | null;
  readonly objective: string;
  readonly completed: string;
  readonly remaining: string;
  readonly next_action: string;
  readonly worker: string | null;
  readonly branch: string | null;
  readonly changed_files: string;
  readonly known_errors: string;
  readonly created_at: string;
}

function toCheckpoint(row: CheckpointRow): Checkpoint {
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    sessionId: row.session_id,
    objective: row.objective,
    completed: row.completed,
    remaining: row.remaining,
    nextAction: row.next_action,
    worker: row.worker,
    branch: row.branch,
    changedFiles: JSON.parse(row.changed_files) as string[],
    knownErrors: JSON.parse(row.known_errors) as string[],
    createdAt: row.created_at,
  };
}

export interface CreateCheckpointInput {
  readonly projectId: string;
  readonly root: string;
  readonly objective?: string;
  readonly completed?: string;
  readonly remaining?: string;
  readonly nextAction?: string;
  readonly taskId?: string | null;
  readonly worker?: string | null;
  readonly git?: GitInfo;
}

/**
 * Create a checkpoint.
 *
 * Anything the caller does not supply is derived from state ctxd already has:
 * the objective from the active task, completed work from the session's
 * recorded activity, errors from its recorded errors, changed files from Git.
 * A checkpoint taken with no arguments is still useful.
 *
 * The underlying session and its events are left untouched — a checkpoint
 * summarises history, it does not replace it.
 */
export function createCheckpoint(
  db: Db,
  input: CreateCheckpointInput,
  now = new Date(),
): Checkpoint {
  const session = activeSession(db, input.projectId);
  const task =
    input.taskId !== undefined && input.taskId !== null
      ? getTask(db, input.taskId)
      : session?.taskId != null
        ? getTask(db, session.taskId)
        : undefined;

  const git = input.git ?? inspectGit(input.root);
  const events = session === undefined ? [] : sessionEvents(db, session.id);

  const activity = events.filter((event) => event.kind === "activity").map((e) => e.detail);
  const errors = events.filter((event) => event.kind === "error").map((e) => e.detail);

  const openTasks = listTasks(db, input.projectId, { limit: 10 });

  const checkpoint: Checkpoint = {
    id: randomUUID(),
    projectId: input.projectId,
    taskId: task?.id ?? null,
    sessionId: session?.id ?? null,
    objective: input.objective ?? task?.title ?? "unstated",
    completed:
      input.completed ??
      (activity.length === 0 ? "nothing recorded" : activity.join("\n")),
    remaining:
      input.remaining ??
      (openTasks.length === 0
        ? "nothing recorded"
        : openTasks.map((t) => `${t.status}: ${t.title}`).join("\n")),
    nextAction: input.nextAction ?? "unstated",
    worker: input.worker ?? session?.worker ?? null,
    branch: git.branch ?? null,
    changedFiles: (git.changes ?? []).map((change) => change.path),
    knownErrors: errors,
    createdAt: now.toISOString(),
  };

  db.prepare(
    `INSERT INTO checkpoints
       (id, project_id, task_id, session_id, objective, completed, remaining, next_action,
        worker, branch, changed_files, known_errors, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    checkpoint.id,
    checkpoint.projectId,
    checkpoint.taskId,
    checkpoint.sessionId,
    checkpoint.objective,
    checkpoint.completed,
    checkpoint.remaining,
    checkpoint.nextAction,
    checkpoint.worker,
    checkpoint.branch,
    JSON.stringify(checkpoint.changedFiles),
    JSON.stringify(checkpoint.knownErrors),
    checkpoint.createdAt,
  );

  return checkpoint;
}

export function latestCheckpoint(db: Db, projectId: string): Checkpoint | undefined {
  const row = db
    .prepare("SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(projectId) as CheckpointRow | undefined;
  return row === undefined ? undefined : toCheckpoint(row);
}

export function listCheckpoints(db: Db, projectId: string, limit = 20): Checkpoint[] {
  const rows = db
    .prepare("SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(projectId, limit) as CheckpointRow[];
  return rows.map(toCheckpoint);
}

export function formatCheckpoint(checkpoint: Checkpoint): string {
  const lines = [
    `CHECKPOINT ${checkpoint.id}`,
    ``,
    `Objective:`,
    checkpoint.objective,
    ``,
    `Completed:`,
    checkpoint.completed,
    ``,
    `Remaining:`,
    checkpoint.remaining,
    ``,
    `Next action:`,
    checkpoint.nextAction,
    ``,
    `Worker: ${checkpoint.worker ?? "unspecified"}`,
    `Branch: ${checkpoint.branch ?? "none"}`,
    `Changed files: ${checkpoint.changedFiles.length}`,
  ];

  if (checkpoint.changedFiles.length > 0) {
    lines.push(...checkpoint.changedFiles.slice(0, 20).map((file) => `  - ${file}`));
  }
  if (checkpoint.knownErrors.length > 0) {
    lines.push(``, `Known errors:`, ...checkpoint.knownErrors.map((error) => `  ! ${error}`));
  }

  return lines.join("\n");
}

export interface Handoff {
  readonly task: string;
  readonly objective: string;
  readonly completed: string;
  readonly remaining: string;
  readonly decisions: readonly Memory[];
  readonly constraints: readonly Memory[];
  readonly knownBugs: readonly Memory[];
  readonly changedFiles: readonly string[];
  readonly branch: string | null;
  readonly lastWorker: string | null;
  readonly recommendedWorker: string | null;
  readonly openTasks: readonly Task[];
}

export interface BuildHandoffInput {
  readonly projectId: string;
  readonly root: string;
  readonly recommendedWorker?: string | null;
  readonly git?: GitInfo;
}

/**
 * Assemble everything a different worker needs to pick the work up.
 *
 * Built from recorded state rather than asked for: the latest checkpoint, open
 * tasks, active decisions, binding constraints and unresolved bugs. A handoff
 * that required the outgoing worker to write it by hand would not survive an
 * interrupted session, which is exactly when it is needed.
 */
export function buildHandoff(db: Db, input: BuildHandoffInput): Handoff {
  const checkpoint = latestCheckpoint(db, input.projectId);
  const session = activeSession(db, input.projectId);
  const git = input.git ?? inspectGit(input.root);

  const task =
    checkpoint?.taskId != null
      ? getTask(db, checkpoint.taskId)
      : session?.taskId != null
        ? getTask(db, session.taskId)
        : undefined;

  const openTasks = listTasks(db, input.projectId, { limit: 20 });

  return {
    task: task?.title ?? checkpoint?.objective ?? "unstated",
    objective: checkpoint?.objective ?? task?.description ?? "unstated",
    completed: checkpoint?.completed ?? "no checkpoint recorded",
    remaining:
      checkpoint?.remaining ??
      (openTasks.length === 0 ? "nothing recorded" : openTasks.map((t) => t.title).join("\n")),
    decisions: listMemories(db, input.projectId, { type: "DECISION", status: "active", limit: 10 }),
    constraints: listMemories(db, input.projectId, {
      importance: "P0",
      status: "active",
      limit: 10,
    }),
    knownBugs: listMemories(db, input.projectId, { type: "BUG", status: "active", limit: 10 }),
    changedFiles: checkpoint?.changedFiles ?? (git.changes ?? []).map((change) => change.path),
    branch: git.branch ?? null,
    lastWorker: checkpoint?.worker ?? session?.worker ?? null,
    recommendedWorker: input.recommendedWorker ?? null,
    openTasks,
  };
}

export function formatHandoff(handoff: Handoff): string {
  const section = (title: string, body: string): string[] => [`${title}:`, body, ``];
  const list = (title: string, items: readonly Memory[]): string[] =>
    items.length === 0
      ? []
      : [`${title}:`, ...items.map((item) => `  - ${item.title}`), ``];

  return [
    `HANDOFF`,
    ``,
    ...section("TASK", handoff.task),
    ...section("OBJECTIVE", handoff.objective),
    ...section("DONE", handoff.completed),
    ...section("REMAINING", handoff.remaining),
    ...list("IMPORTANT — binding constraints", handoff.constraints),
    ...list("DECISIONS", handoff.decisions),
    ...list("KNOWN BUGS", handoff.knownBugs),
    `BRANCH: ${handoff.branch ?? "none"}`,
    `CHANGED FILES: ${handoff.changedFiles.length}`,
    ...handoff.changedFiles.slice(0, 20).map((file) => `  - ${file}`),
    ``,
    `LAST WORKER: ${handoff.lastWorker ?? "unspecified"}`,
    `RECOMMENDED: ${handoff.recommendedWorker ?? "unspecified"}`,
  ].join("\n");
}

/**
 * A continuation summary for `ctxd resume`.
 *
 * Answers the question a developer actually has when they sit back down: what
 * was I doing, how far did I get, and what is the next thing to do.
 */
export function buildResume(db: Db, projectId: string, root: string): string {
  const checkpoint = latestCheckpoint(db, projectId);
  const session = activeSession(db, projectId);
  const open = listTasks(db, projectId, { limit: 10 });
  const git = inspectGit(root);

  const lines: string[] = [];

  if (session !== undefined) {
    lines.push(`Session open since ${session.startedAt}${session.worker ? ` (${session.worker})` : ""}`);
  } else {
    lines.push("No open session.");
  }

  if (checkpoint !== undefined) {
    lines.push(
      ``,
      `Last checkpoint — ${checkpoint.createdAt}`,
      `  objective:   ${checkpoint.objective}`,
      `  next action: ${checkpoint.nextAction}`,
    );
    if (checkpoint.knownErrors.length > 0) {
      lines.push(`  known errors: ${checkpoint.knownErrors.length}`);
    }
  } else {
    lines.push("", "No checkpoint recorded yet.");
  }

  if (open.length > 0) {
    lines.push(``, `Open tasks (${open.length}):`);
    lines.push(...open.map((task) => `  ${task.status.padEnd(12)} ${task.priority}  ${task.title}`));
  }

  if (git.insideWorkTree === true) {
    const changes = git.changes?.length ?? 0;
    lines.push(
      ``,
      `Git: ${git.branch ?? "unknown branch"}, ${changes} uncommitted change${changes === 1 ? "" : "s"}`,
    );
  }

  const rules = listMemories(db, projectId, { importance: "P0", status: "active", limit: 5 });
  if (rules.length > 0) {
    lines.push(``, `Binding rules:`);
    lines.push(...rules.map((rule) => `  - ${rule.title}`));
  }

  return lines.join("\n");
}
