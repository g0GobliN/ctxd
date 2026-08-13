import { randomUUID } from "node:crypto";
import type { Priority } from "@ctxd/context";
import type { Db } from "@ctxd/db";

export type TaskStatus =
  | "BACKLOG"
  | "PLANNED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "REVIEW"
  | "DONE"
  | "CANCELLED";

export const TASK_STATUSES: readonly TaskStatus[] = [
  "BACKLOG",
  "PLANNED",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
];

/** Statuses that mean no further work is expected. */
export const TERMINAL_STATUSES: readonly TaskStatus[] = ["DONE", "CANCELLED"];

export interface Task {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly priority: Priority;
  readonly status: TaskStatus;
  readonly parentTask: string | null;
  readonly worker: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

interface TaskRow {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: string;
  readonly status: string;
  readonly parent_task: string | null;
  readonly worker: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    priority: row.priority as Priority,
    status: row.status as TaskStatus,
    parentTask: row.parent_task,
    worker: row.worker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export interface CreateTaskInput {
  readonly projectId: string;
  readonly title: string;
  readonly description?: string;
  readonly priority?: Priority;
  readonly status?: TaskStatus;
  readonly parentTask?: string | null;
  readonly worker?: string | null;
}

export function createTask(db: Db, input: CreateTaskInput, now = new Date()): Task {
  const timestamp = now.toISOString();
  const task: Task = {
    id: randomUUID(),
    projectId: input.projectId,
    title: input.title,
    description: input.description ?? "",
    priority: input.priority ?? "P2",
    status: input.status ?? "BACKLOG",
    parentTask: input.parentTask ?? null,
    worker: input.worker ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  };

  db.prepare(
    `INSERT INTO tasks
       (id, project_id, title, description, priority, status, parent_task, worker,
        created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.projectId,
    task.title,
    task.description,
    task.priority,
    task.status,
    task.parentTask,
    task.worker,
    task.createdAt,
    task.updatedAt,
    task.completedAt,
  );

  return task;
}

export function getTask(db: Db, id: string): Task | undefined {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row === undefined ? undefined : toTask(row);
}

export interface ListTasksOptions {
  readonly status?: TaskStatus;
  readonly parentTask?: string | null;
  readonly includeTerminal?: boolean;
  readonly limit?: number;
}

export function listTasks(db: Db, projectId: string, options: ListTasksOptions = {}): Task[] {
  const clauses = ["project_id = ?"];
  const params: unknown[] = [projectId];

  if (options.status !== undefined) {
    clauses.push("status = ?");
    params.push(options.status);
  } else if (options.includeTerminal !== true) {
    clauses.push(`status NOT IN (${TERMINAL_STATUSES.map(() => "?").join(", ")})`);
    params.push(...TERMINAL_STATUSES);
  }

  if (options.parentTask !== undefined) {
    if (options.parentTask === null) {
      clauses.push("parent_task IS NULL");
    } else {
      clauses.push("parent_task = ?");
      params.push(options.parentTask);
    }
  }

  params.push(options.limit ?? 100);

  const rows = db
    .prepare(
      `SELECT * FROM tasks WHERE ${clauses.join(" AND ")}
       ORDER BY priority ASC, updated_at DESC LIMIT ?`,
    )
    .all(...params) as TaskRow[];

  return rows.map(toTask);
}

export interface UpdateTaskInput {
  readonly status?: TaskStatus;
  readonly priority?: Priority;
  readonly title?: string;
  readonly description?: string;
  readonly worker?: string | null;
}

/**
 * Update a task.
 *
 * Reaching a terminal status stamps `completed_at`; leaving one clears it, so
 * a task reopened after being closed does not keep claiming it was finished.
 */
export function updateTask(
  db: Db,
  id: string,
  input: UpdateTaskInput,
  now = new Date(),
): Task | undefined {
  const existing = getTask(db, id);
  if (existing === undefined) return undefined;

  const status = input.status ?? existing.status;
  const becameTerminal = TERMINAL_STATUSES.includes(status);
  const completedAt = becameTerminal ? (existing.completedAt ?? now.toISOString()) : null;

  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, priority = ?, status = ?, worker = ?,
                      updated_at = ?, completed_at = ?
     WHERE id = ?`,
  ).run(
    input.title ?? existing.title,
    input.description ?? existing.description,
    input.priority ?? existing.priority,
    status,
    input.worker === undefined ? existing.worker : input.worker,
    now.toISOString(),
    completedAt,
    id,
  );

  return getTask(db, id);
}

/** Direct subtasks, for decomposed work. */
export function subtasks(db: Db, parentId: string): Task[] {
  const rows = db
    .prepare("SELECT * FROM tasks WHERE parent_task = ? ORDER BY priority ASC, created_at ASC")
    .all(parentId) as TaskRow[];
  return rows.map(toTask);
}

export interface TaskProgress {
  readonly total: number;
  readonly done: number;
  readonly remaining: number;
}

/** Completion of a task's subtasks. A task with no subtasks reports zero total. */
export function taskProgress(db: Db, parentId: string): TaskProgress {
  const children = subtasks(db, parentId);
  const done = children.filter((task) => task.status === "DONE").length;
  return {
    total: children.length,
    done,
    remaining: children.filter((task) => !TERMINAL_STATUSES.includes(task.status)).length,
  };
}
