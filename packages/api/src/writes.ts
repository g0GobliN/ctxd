/**
 * Mutating API routes (2.1).
 *
 * 2.0 shipped an interface that could show everything and change nothing: the
 * route table held sixteen reads and one write. These routes close that gap so
 * the same actions the CLI performs are reachable from the interface.
 *
 * Two rules hold throughout, and they are the reason this file is transport
 * only:
 *
 * 1. **Every route calls the function the CLI calls.** `saveMemory`,
 *    `createTask`, `createCheckpoint` and the rest are imported, never
 *    reimplemented. A second copy of an authority rule is a second place it can
 *    be wrong, and the one that disagrees would be the one nobody tested.
 * 2. **Refusals are reported, never worked around.** `saveMemory` can reject a
 *    write whose authority is too low to override what is already recorded.
 *    That answer is passed through as a 409 with its reason attached, exactly
 *    as the MCP surface passes it back to a worker.
 *
 * ## Why these routes accept sources the MCP surface refuses
 *
 * `ctx_memory_save` restricts a worker to `worker_statement` and `inferred`,
 * because a worker is not positioned to assert `verified_code`, `verified_git`
 * or `accepted_decision` (§6, and see workers.md).
 *
 * The caller here is not a worker. Mutating routes require the local API token,
 * which is generated `0600` inside a `0700` data directory and is treated as a
 * credential precisely because it authorises changes to project memory (§62).
 * Holding it means being the developer at the keyboard — the same authority
 * `ctxd memory add --source accepted_decision` already has from a terminal.
 *
 * Restricting the interface below the CLI would not add safety. It would only
 * mean a developer who wanted to record a decision had to leave the window to
 * do it, and the authority rules in `@ctxd/memory` still apply either way.
 */

import { statSync } from "node:fs";
import { resolve } from "node:path";
import { isMemorySource, isMemoryType, saveMemory } from "@ctxd/memory";
import {
  detectProject,
  findProjectByRoot,
  getProject,
  indexProjectFiles,
  listProjects,
  upsertProject,
  writeProjectStorage,
  type ProjectRow,
} from "@ctxd/project";
import {
  buildHandoff,
  createCheckpoint,
  createTask,
  getTask,
  isTaskStatus,
  startSession,
  transferTask,
  updateTask,
} from "@ctxd/work";
import { verify, type CheckKind } from "@ctxd/verify";
import { runAgent, runners } from "@ctxd/agent";
import { emitEvent } from "@ctxd/events";
import {
  HttpError,
  optionalInt,
  optionalString,
  requireString,
  type Route,
  type RouteRequest,
} from "./http.js";
import type { RouteContext } from "./context.js";

const PRIORITIES = ["P0", "P1", "P2", "P3", "P4"] as const;
type Priority = (typeof PRIORITIES)[number];

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

/** The checks `ctxd verify` knows how to discover and run. */
const CHECK_KINDS = ["typecheck", "lint", "test", "build"] as const;

function isCheckKind(value: string): value is CheckKind {
  return (CHECK_KINDS as readonly string[]).includes(value);
}

/**
 * Which project a write is about.
 *
 * Resolution order, and the order matters more for writes than for reads:
 *
 * 1. an explicit `project` in the body, or `?project=`
 * 2. the project registered at the directory this server is inspecting
 * 3. the only registered project, when there is exactly one
 *
 * Step 2 is the one worth spelling out. The read routes resolve an absent
 * project to *the first registered row*, which is harmless when it produces an
 * empty dashboard and actively wrong when it files a decision: `ctxd desktop
 * --dir some/repo` would record against whichever project happened to be
 * registered first. Serving a stale view is recoverable; writing project
 * memory into the wrong project is not obviously noticed at all.
 *
 * With several projects registered and no way to tell which is meant, this
 * refuses rather than guesses. An error naming the choice costs a retry; a
 * silent write into the wrong project costs trust in every record ctxd holds.
 *
 * Returns the row rather than the id: a checkpoint needs the project root, and
 * looking it up here means one lookup and one "no such project" answer.
 */
function projectFor(context: RouteContext, request: RouteRequest): ProjectRow {
  const named =
    optionalString(request.body, "project") ?? request.query.get("project") ?? undefined;

  if (named !== undefined && named !== "") {
    const found = getProject(context.db, named);
    if (found === undefined) throw new HttpError(404, `no project with id ${named}`);
    return found;
  }

  const here = findProjectByRoot(context.db, resolve(context.dir));
  if (here !== undefined) return here;

  const projects = listProjects(context.db);
  const only = projects[0];
  if (only === undefined) {
    throw new HttpError(404, "no project is registered — run: ctxd init");
  }
  if (projects.length > 1) {
    throw new HttpError(
      409,
      `${context.dir} is not a registered project, and ${projects.length} others are — ` +
        `name one with "project", or run: ctxd init --dir .`,
    );
  }
  return only;
}

/** Read an optional array-of-strings field. */
function optionalStringList(body: unknown, field: string): readonly string[] | undefined {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new HttpError(400, `"${field}" must be an array of strings`);
  }
  return value as readonly string[];
}

/** Read an optional field constrained to a known set. */
function optionalEnum<T extends string>(
  body: unknown,
  field: string,
  guard: (value: string) => value is T,
  allowed: readonly string[],
): T | undefined {
  const value = optionalString(body, field);
  if (value === undefined) return undefined;
  const normalised = value.toUpperCase();
  if (!guard(normalised)) {
    throw new HttpError(400, `"${field}" must be one of: ${allowed.join(", ")}`);
  }
  return normalised;
}

/**
 * Record an event without letting the log decide whether the write succeeded.
 *
 * The durable record — the memory row, the task, the checkpoint — is already
 * committed by the time this runs. A failure to append to the activity log is
 * not a reason to report the write as failed.
 */
function noteEvent(context: RouteContext, input: Parameters<typeof emitEvent>[1]): void {
  try {
    emitEvent(context.db, input);
  } catch {
    // Deliberately ignored; see above.
  }
}

export function createWriteRoutes(context: RouteContext): Route[] {
  const { db, paths, config } = context;

  return [
    {
      // `ctxd init` — register a directory as a project.
      //
      // This is what lets the interface be a starting point rather than a
      // second screen for something the terminal had to set up first.
      //
      // It reads a directory the caller names, which is a real capability, and
      // it is token-gated for that reason. What it records is metadata only:
      // indexing stores path, size, mtime, hash, language and type, and never
      // file content (§8) — so registering a directory does not make its
      // contents readable through the API.
      method: "POST",
      path: "/api/projects",
      mutating: true,
      handler: (request) => {
        const dir = resolve(optionalString(request.body, "dir") ?? context.dir);
        const index = (request.body as { index?: unknown } | undefined)?.index !== false;

        // `detectProject` does not require the directory to exist — it reports
        // "nothing detected" for a path with no manifests, and a missing path
        // looks identical to that. Registering a project for a directory that
        // is not there produces a row nothing can ever index, so the check is
        // explicit here.
        let stats;
        try {
          stats = statSync(dir);
        } catch {
          throw new HttpError(400, `${dir} does not exist`);
        }
        if (!stats.isDirectory()) throw new HttpError(400, `${dir} is not a directory`);

        let detected;
        try {
          detected = detectProject(dir);
        } catch (error) {
          throw new HttpError(400, `${dir}: ${(error as Error).message}`);
        }

        const existing = getProject(db, detected.id);
        const project = upsertProject(db, detected);
        writeProjectStorage(paths.projectsDir, detected);

        const indexed = index ? indexProjectFiles(db, project.id, project.root) : undefined;

        return {
          // "registered" and "refreshed" are different events to a person even
          // though both are one upsert, so the answer says which happened.
          outcome: existing === undefined ? "registered" : "refreshed",
          project,
          evidence: detected.evidence,
          ...(indexed === undefined ? {} : { indexed }),
        };
      },
    },

    {
      // `ctxd memory add`, and the decision/bug/explain commands that are
      // memory writes with a fixed type.
      method: "POST",
      path: "/api/memory",
      mutating: true,
      handler: (request) => {
        const project = projectFor(context, request);
        const title = requireString(request.body, "title");
        const content = requireString(request.body, "content");

        const type = optionalEnum(request.body, "type", isMemoryType, [
          "DECISION",
          "CONSTRAINT",
          "BUG",
          "NOTE",
          "RULE",
        ]) ?? "NOTE";

        // Lower-cased rather than upper: sources are snake_case identifiers,
        // unlike types.
        const sourceInput = optionalString(request.body, "source")?.toLowerCase();
        if (sourceInput !== undefined && !isMemorySource(sourceInput)) {
          throw new HttpError(400, `unknown memory source "${sourceInput}"`);
        }

        const importance = optionalEnum(request.body, "importance", isPriority, [...PRIORITIES]);
        const tags = optionalStringList(request.body, "tags");

        const outcome = saveMemory(db, {
          projectId: project.id,
          type,
          title,
          content,
          source: sourceInput ?? "accepted_decision",
          ...(importance === undefined ? {} : { importance }),
          ...(tags === undefined ? {} : { tags }),
        });

        // An authority refusal is a real answer, not a server fault. 409 says
        // the request was understood and deliberately not applied, and the
        // reason travels so the interface can show what it collided with.
        if (outcome.kind === "rejected") {
          throw new HttpError(
            409,
            `refused: ${outcome.reason} — "${outcome.existing.title}" has higher authority`,
          );
        }

        noteEvent(context, {
          projectId: project.id,
          type: "memory_updated",
          data: { memoryId: outcome.memory.id, outcome: outcome.kind, source: "api" },
        });

        return {
          outcome: outcome.kind,
          memory: outcome.memory,
          ...(outcome.kind === "superseded" ? { supersedes: outcome.previous.id } : {}),
        };
      },
    },

    {
      // `ctxd task add`
      method: "POST",
      path: "/api/tasks",
      mutating: true,
      handler: (request) => {
        const project = projectFor(context, request);
        const title = requireString(request.body, "title");
        const description = optionalString(request.body, "description");
        const priority = optionalEnum(request.body, "priority", isPriority, [...PRIORITIES]);
        const status = optionalEnum(request.body, "status", isTaskStatus, [
          "BACKLOG",
          "PLANNED",
          "IN_PROGRESS",
          "BLOCKED",
          "REVIEW",
          "DONE",
        ]);
        const worker = optionalString(request.body, "worker");
        const parentTask = optionalString(request.body, "parentTask");

        const task = createTask(db, {
          projectId: project.id,
          title,
          ...(description === undefined ? {} : { description }),
          ...(priority === undefined ? {} : { priority }),
          ...(status === undefined ? {} : { status }),
          ...(worker === undefined ? {} : { worker }),
          ...(parentTask === undefined ? {} : { parentTask }),
        });

        noteEvent(context, {
          projectId: project.id,
          type: "task_updated",
          ...(worker === undefined ? {} : { worker }),
          data: { taskId: task.id, change: "created", status: task.status, source: "api" },
        });

        return task;
      },
    },

    {
      // `ctxd task update` — moving a card on the board is this route.
      //
      // PATCH rather than POST: the body carries only the fields that change,
      // and every omitted field is left alone rather than cleared.
      method: "PATCH",
      path: "/api/tasks",
      mutating: true,
      handler: (request) => {
        const id = requireString(request.body, "id");
        const existing = getTask(db, id);
        if (existing === undefined) throw new HttpError(404, `no task with id ${id}`);

        const status = optionalEnum(request.body, "status", isTaskStatus, [
          "BACKLOG",
          "PLANNED",
          "IN_PROGRESS",
          "BLOCKED",
          "REVIEW",
          "DONE",
        ]);
        const priority = optionalEnum(request.body, "priority", isPriority, [...PRIORITIES]);
        const title = optionalString(request.body, "title");
        const description = optionalString(request.body, "description");
        const worker = optionalString(request.body, "worker");

        if (
          status === undefined &&
          priority === undefined &&
          title === undefined &&
          description === undefined &&
          worker === undefined
        ) {
          throw new HttpError(400, "nothing to update: supply status, priority, title, description or worker");
        }

        const task = updateTask(db, id, {
          ...(status === undefined ? {} : { status }),
          ...(priority === undefined ? {} : { priority }),
          ...(title === undefined ? {} : { title }),
          ...(description === undefined ? {} : { description }),
          ...(worker === undefined ? {} : { worker }),
        });

        // `getTask` found it a moment ago, so this is a row deleted between the
        // two calls rather than a bad id. Reported as gone rather than as a
        // server fault, and no event is written for an update that did not
        // happen.
        if (task === undefined) throw new HttpError(404, `task ${id} no longer exists`);

        noteEvent(context, {
          projectId: existing.projectId,
          type: "task_updated",
          ...(worker === undefined ? {} : { worker }),
          data: { taskId: id, change: "updated", status: task.status, source: "api" },
        });

        return task;
      },
    },

    {
      // `ctxd session start`
      method: "POST",
      path: "/api/session",
      mutating: true,
      handler: (request) => {
        const project = projectFor(context, request);
        const worker = optionalString(request.body, "worker");
        const taskId = optionalString(request.body, "task");
        const branch = optionalString(request.body, "branch");

        // A project has at most one open session; `startSession` returns the
        // existing one rather than opening a second, so this route is safe to
        // call twice and the interface does not have to guess first.
        const session = startSession(db, {
          projectId: project.id,
          ...(taskId === undefined ? {} : { taskId }),
          ...(worker === undefined ? {} : { worker }),
          ...(branch === undefined ? {} : { branch }),
        });

        return session;
      },
    },

    {
      // `ctxd handoff` — move work from one worker to another.
      //
      // Without `to`, this assembles the handoff and changes nothing: a
      // developer can read what would travel before committing to the move.
      // With `to`, `transferTask` makes it durable — a summary a person copies
      // between two chat windows is not a task changing hands, and it does not
      // survive the session dying before the paste.
      method: "POST",
      path: "/api/handoff",
      mutating: true,
      handler: (request) => {
        const project = projectFor(context, request);
        const to = optionalString(request.body, "to");

        if (to === undefined || to.trim() === "") {
          return { moved: false, handoff: buildHandoff(db, {
            projectId: project.id,
            root: project.root,
          }) };
        }

        const from = optionalString(request.body, "from");
        const taskId = optionalString(request.body, "task");
        const note = optionalString(request.body, "note");

        let result;
        try {
          result = transferTask(db, {
            projectId: project.id,
            root: project.root,
            toWorker: to,
            ...(from === undefined ? {} : { fromWorker: from }),
            ...(taskId === undefined ? {} : { taskId }),
            ...(note === undefined ? {} : { note }),
          });
        } catch (error) {
          throw new HttpError(400, (error as Error).message);
        }

        noteEvent(context, {
          projectId: project.id,
          type: "task_updated",
          worker: result.toWorker,
          data: {
            taskId: result.task?.id ?? null,
            change: "handed_off",
            from: result.fromWorker,
            source: "api",
          },
        });

        // Warnings travel rather than being swallowed: "the outgoing worker was
        // unknown" is something the person reading this needs to see.
        return { moved: true, ...result };
      },
    },

    {
      // `ctxd verify` — run the project's own checks.
      //
      // This is the one route that executes commands, and it is worth being
      // explicit about why that is not a contradiction of §63. That rule
      // forbids exposing execution *to a worker* through MCP, and a CI gate
      // asserts `@ctxd/mcp` cannot even import `@ctxd/verify`. Both still hold:
      // nothing here is reachable from the MCP surface.
      //
      // What runs is not arbitrary either. `discoverChecks` reads the project's
      // own manifest and runs the typecheck, lint, test and build scripts it
      // already defines — the request chooses among those, and cannot supply a
      // command of its own.
      //
      // It is synchronous, so a long test run holds the server until it
      // finishes. `timeoutMs` bounds that, and `dryRun` reports what would run
      // without running it.
      method: "POST",
      path: "/api/verify",
      mutating: true,
      handler: (request) => {
        const project = projectFor(context, request);
        const dryRun = (request.body as { dryRun?: unknown } | undefined)?.dryRun === true;
        const timeoutMs = optionalInt(request.body, "timeoutMs");

        const only = optionalStringList(request.body, "only");
        if (only !== undefined && !only.every(isCheckKind)) {
          throw new HttpError(400, `"only" must contain: ${CHECK_KINDS.join(", ")}`);
        }

        const result = verify({
          cwd: project.root,
          dryRun,
          ...(only === undefined ? {} : { only: only as readonly CheckKind[] }),
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
        });

        noteEvent(context, {
          projectId: project.id,
          type: dryRun ? "verification_started" : "verification_finished",
          data: { status: result.status, dryRun, source: "api" },
        });

        return result;
      },
    },

    {
      // Which workers ctxd could start, and why not, for the ones it cannot.
      // Read-only, so the interface can show the picture before committing to
      // a run.
      method: "GET",
      path: "/api/agent",
      mutating: false,
      handler: () => ({ runners: runners() }),
    },

    {
      // Run a task: context → routing → worker → change review.
      //
      // This is the one route that starts an AI. It is a deliberate departure
      // from the specification's "Never: autonomous multi-agent orchestration"
      // and from §34's "require approval when destructive", made explicitly by
      // the project owner — see plan-tracker.md.
      //
      // Two things keep it from being the runaway that rule was guarding
      // against:
      //
      // 1. `applyEdits` is **off by default**. Without it the worker reads and
      //    reports; it does not touch the working tree.
      // 2. Nothing is committed, reverted or accepted. The run ends with a
      //    Change Receipt a person still has to agree with (§50).
      //
      // ctxd itself still opens no socket: it starts Claude Code, which is
      // authenticated by the developer's own subscription, so no API key is
      // stored or handled here.
      method: "POST",
      path: "/api/agent",
      mutating: true,
      handler: async (request) => {
        const project = projectFor(context, request);
        const task = requireString(request.body, "task");
        const budget = optionalInt(request.body, "budget");
        const worker = optionalString(request.body, "worker");
        const model = optionalString(request.body, "model");
        const timeoutMs = optionalInt(request.body, "timeoutMs");
        const applyEdits = (request.body as { applyEdits?: unknown } | undefined)
          ?.applyEdits === true;

        try {
          return await runAgent({
            db,
            projectId: project.id,
            root: project.root,
            task,
            config,
            applyEdits,
            ...(budget === undefined ? {} : { budget }),
            ...(worker === undefined ? {} : { worker }),
            ...(model === undefined ? {} : { model }),
            ...(timeoutMs === undefined ? {} : { timeoutMs }),
          });
        } catch (error) {
          // "No runnable worker is installed" is a 409 rather than a 500: the
          // request was understood, and the machine is the reason it cannot be
          // carried out.
          throw new HttpError(409, (error as Error).message);
        }
      },
    },

    {
      // `ctxd checkpoint`
      method: "POST",
      path: "/api/checkpoint",
      mutating: true,
      handler: (request) => {
        const project = projectFor(context, request);

        const objective = optionalString(request.body, "objective");
        const completed = optionalString(request.body, "completed");
        const remaining = optionalString(request.body, "remaining");
        const nextAction = optionalString(request.body, "next");
        const taskId = optionalString(request.body, "task");
        const worker = optionalString(request.body, "worker");

        // The project's own root, not the directory the server was pointed at:
        // a checkpoint records the state of the project it belongs to.
        const checkpoint = createCheckpoint(db, {
          projectId: project.id,
          root: project.root,
          ...(objective === undefined ? {} : { objective }),
          ...(completed === undefined ? {} : { completed }),
          ...(remaining === undefined ? {} : { remaining }),
          ...(nextAction === undefined ? {} : { nextAction }),
          ...(taskId === undefined ? {} : { taskId }),
          ...(worker === undefined ? {} : { worker }),
        });

        noteEvent(context, {
          projectId: project.id,
          type: "checkpoint_created",
          ...(worker === undefined ? {} : { worker }),
          data: { checkpointId: checkpoint.id, source: "api" },
        });

        return checkpoint;
      },
    },
  ];
}
