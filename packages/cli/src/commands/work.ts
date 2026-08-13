import { parseArgs } from "node:util";
import { resolve } from "node:path";
import type { Priority } from "@ctxd/context";
import { ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { detectProject, findProjectByRoot, inspectGit } from "@ctxd/project";
import {
  activeSession,
  buildHandoff,
  buildResume,
  createCheckpoint,
  createTask,
  endSession,
  formatCheckpoint,
  formatHandoff,
  getTask,
  isTaskStatus,
  latestCheckpoint,
  listCheckpoints,
  listTasks,
  recordEvent,
  sessionEvents,
  startSession,
  subtasks,
  taskProgress,
  updateTask,
} from "@ctxd/work";
import { formatKeyValue } from "@ctxd/utils";

interface Resolved {
  readonly db: Db;
  readonly projectId: string;
  readonly root: string;
}

function open(dir: string): Resolved | string {
  const paths = resolvePaths();
  ensureDataDir(paths);
  const db = openDatabase(paths.dbFile);
  migrate(db);

  const detected = detectProject(resolve(dir));
  const project = findProjectByRoot(db, detected.root);
  if (project === undefined) {
    db.close();
    return `no project registered for ${detected.root}. Run: ctxd init --dir ${dir}`;
  }
  return { db, projectId: project.id, root: detected.root };
}

const SHARED_OPTIONS = {
  dir: { type: "string" },
  title: { type: "string" },
  description: { type: "string" },
  status: { type: "string" },
  priority: { type: "string" },
  worker: { type: "string" },
  parent: { type: "string" },
  task: { type: "string" },
  objective: { type: "string" },
  completed: { type: "string" },
  remaining: { type: "string" },
  next: { type: "string" },
  summary: { type: "string" },
  to: { type: "string" },
  all: { type: "boolean" },
} as const;

function parse(argv: readonly string[], help: string) {
  try {
    return parseArgs({
      args: argv as string[],
      options: SHARED_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    process.stderr.write(`ctxd: ${(error as Error).message}\n\n${help}\n`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// ctxd task
// ---------------------------------------------------------------------------

export const TASK_HELP = `ctxd task — track units of work

Usage:
  ctxd task add --title <text> [--description <text>] [--priority P0..P4] [--parent <id>]
  ctxd task list [--status <STATUS>] [--all]
  ctxd task show <id>
  ctxd task update <id> [--status <STATUS>] [--priority P0..P4] [--worker <name>]

Statuses: BACKLOG, PLANNED, IN_PROGRESS, BLOCKED, REVIEW, DONE, CANCELLED`;

export function taskCommand(argv: readonly string[]): number {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${TASK_HELP}\n`);
    return argv.length === 0 ? 1 : 0;
  }

  const parsed = parse(argv, TASK_HELP);
  if (parsed === undefined) return 1;
  const { values, positionals } = parsed;

  const resolved = open(values.dir ?? ".");
  if (typeof resolved === "string") {
    process.stderr.write(`ctxd task: ${resolved}\n`);
    return 1;
  }

  const [subcommand, id] = positionals;
  try {
    switch (subcommand) {
      case "add": {
        if (values.title === undefined) {
          process.stderr.write("ctxd task add: --title is required\n");
          return 1;
        }
        const task = createTask(resolved.db, {
          projectId: resolved.projectId,
          title: values.title,
          ...(values.description === undefined ? {} : { description: values.description }),
          ...(values.priority === undefined ? {} : { priority: values.priority as Priority }),
          ...(values.parent === undefined ? {} : { parentTask: values.parent }),
          ...(values.worker === undefined ? {} : { worker: values.worker }),
        });
        process.stdout.write(`Created ${task.id}\n\n${describeTask(resolved.db, task.id)}\n`);
        return 0;
      }

      case "list": {
        const status = values.status?.toUpperCase();
        if (status !== undefined && !isTaskStatus(status)) {
          process.stderr.write(`ctxd task list: unknown status ${status}\n`);
          return 1;
        }
        const tasks = listTasks(resolved.db, resolved.projectId, {
          ...(status === undefined ? {} : { status }),
          ...(values.all === true ? { includeTerminal: true } : {}),
        });
        if (tasks.length === 0) {
          process.stdout.write("No open tasks.\n");
          return 0;
        }
        for (const task of tasks) {
          const progress = taskProgress(resolved.db, task.id);
          const suffix = progress.total > 0 ? `  (${progress.done}/${progress.total} subtasks)` : "";
          process.stdout.write(
            `${task.status.padEnd(12)} ${task.priority}  ${task.title}${suffix}\n      ${task.id}\n`,
          );
        }
        return 0;
      }

      case "show": {
        if (id === undefined) {
          process.stderr.write("ctxd task show: an id is required\n");
          return 1;
        }
        const text = describeTask(resolved.db, id);
        if (text === undefined) {
          process.stderr.write(`ctxd task show: no task with id ${id}\n`);
          return 1;
        }
        process.stdout.write(`${text}\n`);
        return 0;
      }

      case "update": {
        if (id === undefined) {
          process.stderr.write("ctxd task update: an id is required\n");
          return 1;
        }
        const status = values.status?.toUpperCase();
        if (status !== undefined && !isTaskStatus(status)) {
          process.stderr.write(`ctxd task update: unknown status ${status}\n`);
          return 1;
        }
        const task = updateTask(resolved.db, id, {
          ...(status === undefined ? {} : { status }),
          ...(values.priority === undefined ? {} : { priority: values.priority as Priority }),
          ...(values.title === undefined ? {} : { title: values.title }),
          ...(values.worker === undefined ? {} : { worker: values.worker }),
        });
        if (task === undefined) {
          process.stderr.write(`ctxd task update: no task with id ${id}\n`);
          return 1;
        }
        process.stdout.write(`Updated\n\n${describeTask(resolved.db, id)}\n`);
        return 0;
      }

      default:
        process.stderr.write(`ctxd task: unknown subcommand "${subcommand ?? ""}"\n\n${TASK_HELP}\n`);
        return 1;
    }
  } finally {
    resolved.db.close();
  }
}

function describeTask(db: Db, id: string): string | undefined {
  const task = getTask(db, id);
  if (task === undefined) return undefined;

  const children = subtasks(db, id);
  const lines = formatKeyValue([
    ["id", task.id],
    ["title", task.title],
    ["status", task.status],
    ["priority", task.priority],
    ["worker", task.worker ?? "unassigned"],
    ["parent", task.parentTask ?? "none"],
    ["created", task.createdAt],
    ...(task.completedAt === null
      ? []
      : ([["completed", task.completedAt]] as [string, string][])),
  ]);

  if (task.description !== "") {
    return `${lines}\n\n${task.description}${children.length === 0 ? "" : formatChildren(children)}`;
  }
  return `${lines}${children.length === 0 ? "" : formatChildren(children)}`;
}

function formatChildren(children: readonly { status: string; title: string; id: string }[]): string {
  return `\n\nSubtasks:\n${children
    .map((child) => `  ${child.status.padEnd(12)} ${child.title}  (${child.id})`)
    .join("\n")}`;
}

// ---------------------------------------------------------------------------
// ctxd session
// ---------------------------------------------------------------------------

export const SESSION_HELP = `ctxd session — track a working session

Usage:
  ctxd session start [--task <id>] [--worker <name>]
  ctxd session status
  ctxd session note <text>       Record activity
  ctxd session error <text>      Record a problem hit during the session
  ctxd session end [--summary <text>]`;

export function sessionCommand(argv: readonly string[]): number {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${SESSION_HELP}\n`);
    return argv.length === 0 ? 1 : 0;
  }

  const parsed = parse(argv, SESSION_HELP);
  if (parsed === undefined) return 1;
  const { values, positionals } = parsed;

  const resolved = open(values.dir ?? ".");
  if (typeof resolved === "string") {
    process.stderr.write(`ctxd session: ${resolved}\n`);
    return 1;
  }

  const [subcommand, ...rest] = positionals;
  try {
    switch (subcommand) {
      case "start": {
        const git = inspectGit(resolved.root);
        const { session, alreadyOpen } = startSession(resolved.db, {
          projectId: resolved.projectId,
          ...(values.task === undefined ? {} : { taskId: values.task }),
          ...(values.worker === undefined ? {} : { worker: values.worker }),
          ...(git.branch === undefined ? {} : { branch: git.branch }),
        });
        process.stdout.write(
          alreadyOpen
            ? `A session is already open (${session.id}), started ${session.startedAt}.\n`
            : `Session ${session.id} started.\n`,
        );
        return 0;
      }

      case "status": {
        const session = activeSession(resolved.db, resolved.projectId);
        if (session === undefined) {
          process.stdout.write("No open session.\n");
          return 0;
        }
        const events = sessionEvents(resolved.db, session.id);
        process.stdout.write(
          `${formatKeyValue([
            ["session", session.id],
            ["started", session.startedAt],
            ["worker", session.worker ?? "unspecified"],
            ["branch", session.branch ?? "none"],
            ["events", String(events.length)],
          ])}\n`,
        );
        if (events.length > 0) {
          process.stdout.write(
            `\n${events.map((event) => `  ${event.kind.padEnd(9)} ${event.detail}`).join("\n")}\n`,
          );
        }
        return 0;
      }

      case "note":
      case "error": {
        const session = activeSession(resolved.db, resolved.projectId);
        if (session === undefined) {
          process.stderr.write("ctxd session: no open session. Run: ctxd session start\n");
          return 1;
        }
        const detail = rest.join(" ");
        if (detail === "") {
          process.stderr.write(`ctxd session ${subcommand}: some text is required\n`);
          return 1;
        }
        recordEvent(
          resolved.db,
          session.id,
          subcommand === "error" ? "error" : "activity",
          detail,
        );
        process.stdout.write("Recorded.\n");
        return 0;
      }

      case "end": {
        const session = activeSession(resolved.db, resolved.projectId);
        if (session === undefined) {
          process.stdout.write("No open session.\n");
          return 0;
        }
        const events = sessionEvents(resolved.db, session.id);
        const summary =
          values.summary ??
          (events.length === 0
            ? "no activity recorded"
            : `${events.length} events recorded`);
        endSession(resolved.db, session.id, summary);
        process.stdout.write(`Session ${session.id} ended.\n`);
        return 0;
      }

      default:
        process.stderr.write(
          `ctxd session: unknown subcommand "${subcommand ?? ""}"\n\n${SESSION_HELP}\n`,
        );
        return 1;
    }
  } finally {
    resolved.db.close();
  }
}

// ---------------------------------------------------------------------------
// ctxd checkpoint / handoff / resume
// ---------------------------------------------------------------------------

export const CHECKPOINT_HELP = `ctxd checkpoint — record where the work stands

Usage:
  ctxd checkpoint [--objective <text>] [--completed <text>] [--remaining <text>] [--next <text>]
  ctxd checkpoint list

Anything you do not supply is derived from recorded state: the active task,
session activity, recorded errors and Git.`;

export function checkpointCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${CHECKPOINT_HELP}\n`);
    return 0;
  }

  const parsed = parse(argv, CHECKPOINT_HELP);
  if (parsed === undefined) return 1;
  const { values, positionals } = parsed;

  const resolved = open(values.dir ?? ".");
  if (typeof resolved === "string") {
    process.stderr.write(`ctxd checkpoint: ${resolved}\n`);
    return 1;
  }

  try {
    if (positionals[0] === "list") {
      const checkpoints = listCheckpoints(resolved.db, resolved.projectId);
      if (checkpoints.length === 0) {
        process.stdout.write("No checkpoints recorded.\n");
        return 0;
      }
      for (const checkpoint of checkpoints) {
        process.stdout.write(
          `${checkpoint.createdAt}  ${checkpoint.objective}\n      ${checkpoint.id}\n`,
        );
      }
      return 0;
    }

    const checkpoint = createCheckpoint(resolved.db, {
      projectId: resolved.projectId,
      root: resolved.root,
      ...(values.objective === undefined ? {} : { objective: values.objective }),
      ...(values.completed === undefined ? {} : { completed: values.completed }),
      ...(values.remaining === undefined ? {} : { remaining: values.remaining }),
      ...(values.next === undefined ? {} : { nextAction: values.next }),
      ...(values.worker === undefined ? {} : { worker: values.worker }),
      ...(values.task === undefined ? {} : { taskId: values.task }),
    });

    process.stdout.write(`${formatCheckpoint(checkpoint)}\n`);
    return 0;
  } finally {
    resolved.db.close();
  }
}

export const HANDOFF_HELP = `ctxd handoff — hand the work to another worker

Usage:
  ctxd handoff [--to <worker>]

Assembles the task, what is done, what remains, binding constraints, decisions,
known bugs and Git state from recorded history.`;

export function handoffCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${HANDOFF_HELP}\n`);
    return 0;
  }

  const parsed = parse(argv, HANDOFF_HELP);
  if (parsed === undefined) return 1;
  const { values } = parsed;

  const resolved = open(values.dir ?? ".");
  if (typeof resolved === "string") {
    process.stderr.write(`ctxd handoff: ${resolved}\n`);
    return 1;
  }

  try {
    const handoff = buildHandoff(resolved.db, {
      projectId: resolved.projectId,
      root: resolved.root,
      ...(values.to === undefined ? {} : { recommendedWorker: values.to }),
    });
    process.stdout.write(`${formatHandoff(handoff)}\n`);
    return 0;
  } finally {
    resolved.db.close();
  }
}

export const RESUME_HELP = `ctxd resume — what was I doing?

Usage:
  ctxd resume [--dir <path>]

Summarises the open session, the last checkpoint, open tasks, Git state and the
binding rules.`;

export function resumeCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${RESUME_HELP}\n`);
    return 0;
  }

  const parsed = parse(argv, RESUME_HELP);
  if (parsed === undefined) return 1;

  const resolved = open(parsed.values.dir ?? ".");
  if (typeof resolved === "string") {
    process.stderr.write(`ctxd resume: ${resolved}\n`);
    return 1;
  }

  try {
    process.stdout.write(`${buildResume(resolved.db, resolved.projectId, resolved.root)}\n`);
    if (latestCheckpoint(resolved.db, resolved.projectId) === undefined) {
      process.stdout.write(`\nRecord one with: ctxd checkpoint\n`);
    }
    return 0;
  } finally {
    resolved.db.close();
  }
}
