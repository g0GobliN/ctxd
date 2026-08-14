/**
 * Local API routes (§67–71).
 *
 * Every route calls the same core services the CLI and MCP server call —
 * business logic is never duplicated per entry point. This file is transport:
 * it turns a request into a service call and a service result into JSON.
 */

import { VERSION } from "@ctxd/core";
import { analyzeWorkingTree, isGitRepository } from "@ctxd/diff";
import { buildProjectContext } from "@ctxd/firewall";
import { listMemories, searchMemories } from "@ctxd/memory";
import { describeGit, inspectGit, listProjects } from "@ctxd/project";
import { buildResume, lastSession, listTasks, latestCheckpoint } from "@ctxd/work";
import { KNOWN_WORKERS } from "@ctxd/verify";
import { emitEvent, workerConnections } from "@ctxd/events";
import {
  collectStats,
  describeWindow,
  isStatsWindow,
  STATS_WINDOWS,
  windowSince,
} from "@ctxd/stats";
import { HttpError, optionalInt, optionalString, requireString, type Route } from "./http.js";
import { createEventRoutes } from "./events.js";
import { createWriteRoutes } from "./writes.js";
import { buildGraph } from "./graph.js";
import { listReceipts } from "./receipts.js";
import { projectIdFor } from "./project-scope.js";
import type { RouteContext } from "./context.js";

export type { RouteContext };

/** How many receipts a listing returns before the caller must ask for more. */
const RECEIPT_PAGE = 50;

/**
 * Build the route table.
 *
 * `mutating: true` marks a route that changes state or writes a file, and those
 * require the local token (§62). Reads are open to any loopback caller, which
 * is what makes the UI usable without a login while still protecting writes.
 */
export function createRoutes(context: RouteContext): Route[] {
  const { db, paths, config } = context;

  return [
    {
      method: "GET",
      path: "/api/health",
      mutating: false,
      handler: () => ({ ok: true, version: VERSION }),
    },

    {
      method: "GET",
      path: "/api/status",
      mutating: false,
      handler: () => {
        const git = inspectGit(context.dir);
        const projects = listProjects(db);
        return {
          version: VERSION,
          mode: config.mode,
          dataDir: paths.dataDir,
          dir: context.dir,
          projects: projects.length,
          git: describeGit(git, context.dir),
          // Estimates are always labelled as such (§18).
          tokenCounting: "estimated",
        };
      },
    },

    {
      method: "GET",
      path: "/api/projects",
      mutating: false,
      handler: () => ({ projects: listProjects(db) }),
    },

    {
      method: "GET",
      path: "/api/memory",
      mutating: false,
      handler: (request) => {
        const query = request.query.get("q");
        const limit = Number.parseInt(request.query.get("limit") ?? "50", 10);
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;

        if (query !== null && query.trim() !== "") {
          return { hits: searchMemories(db, query, { limit: safeLimit }) };
        }

        const projectId = projectIdFor(context, request);
        return { memories: listMemories(db, projectId, { limit: safeLimit }) };
      },
    },

    {
      method: "GET",
      path: "/api/tasks",
      mutating: false,
      handler: (request) => {
        const projectId = projectIdFor(context, request);
        return { tasks: listTasks(db, projectId, {}) };
      },
    },

    {
      method: "GET",
      path: "/api/session",
      mutating: false,
      handler: (request) => {
        const projectId = projectIdFor(context, request);
        return {
          last: lastSession(db, projectId),
          checkpoint: latestCheckpoint(db, projectId),
        };
      },
    },

    {
      // §69. Status is derived from recorded sessions, never inferred: a
      // worker ctxd has not seen reads as "unknown" rather than "idle", because
      // claiming a worker is idle when nothing was recorded would be a guess.
      //
      // `state` keeps its original meaning — what the session history says —
      // and `connection` is added alongside it from the event log. They answer
      // different questions ("has this worker worked here?" versus "is it
      // attached right now?") and collapsing them would lose one of the two.
      method: "GET",
      path: "/api/workers",
      mutating: false,
      handler: (request) => {
        const projectId = projectIdFor(context, request);
        const connections = new Map(
          workerConnections(db, projectId).map((entry) => [entry.claimedWorker, entry]),
        );

        /**
         * The live half of a worker's row.
         *
         * `claimed: true` travels with it so no consumer can read the name as
         * something ctxd verified — the transport reports an attachment, never
         * an identity (§6).
         */
        const connectionFor = (id: string) => {
          const found = connections.get(id);
          if (found === undefined) {
            return { state: "unknown", since: null, lastActivityAt: null, openEnded: false, claimed: true };
          }
          return {
            state: found.state,
            since: found.since,
            lastActivityAt: found.lastActivityAt,
            openEnded: found.openEnded,
            claimed: true,
          };
        };
        const sessions = db
          .prepare(
            `SELECT worker, task_id, started_at, ended_at, summary
             FROM sessions
             WHERE project_id = ? AND worker IS NOT NULL
             ORDER BY started_at DESC`,
          )
          .all(projectId) as {
            worker: string;
            task_id: string | null;
            started_at: string;
            ended_at: string | null;
            summary: string | null;
          }[];

        const seen = new Map<string, (typeof sessions)[number]>();
        for (const session of sessions) {
          if (!seen.has(session.worker)) seen.set(session.worker, session);
        }

        const known = KNOWN_WORKERS.map((definition) => {
          const latest = seen.get(definition.id);
          seen.delete(definition.id);
          return {
            id: definition.id,
            name: definition.name,
            capabilities: definition.capabilities,
            state: latest === undefined ? "unknown" : latest.ended_at === null ? "active" : "idle",
            source: latest === undefined ? "unknown" : "session",
            lastActivity: latest?.ended_at ?? latest?.started_at ?? null,
            currentTask: latest?.ended_at === null ? (latest.task_id ?? null) : null,
            lastTask: latest?.task_id ?? null,
            lastSummary: latest?.summary ?? null,
            connection: connectionFor(definition.id),
          };
        });

        // Workers ctxd has never heard of still get reported: the registry is
        // a set of labels, not a permitted list (§42).
        const others = [...seen.entries()].map(([id, latest]) => ({
          id,
          name: id,
          capabilities: [] as readonly string[],
          state: latest.ended_at === null ? "active" : "idle",
          source: "session",
          lastActivity: latest.ended_at ?? latest.started_at,
          currentTask: latest.ended_at === null ? (latest.task_id ?? null) : null,
          lastTask: latest.task_id ?? null,
          lastSummary: latest.summary ?? null,
          connection: connectionFor(id),
        }));

        // A worker seen only on the event log has never opened a session, so it
        // appears in neither list above. It is still something that connected
        // to this project, and dropping it would make the interface quieter
        // than the truth.
        const accountedFor = new Set([...known, ...others].map((worker) => worker.id));
        const streamOnly = [...connections.keys()]
          .filter((id) => !accountedFor.has(id))
          .map((id) => ({
            id,
            name: id,
            capabilities: [] as readonly string[],
            state: "unknown",
            source: "events",
            lastActivity: connections.get(id)?.lastActivityAt ?? null,
            currentTask: null,
            lastTask: null,
            lastSummary: null,
            connection: connectionFor(id),
          }));

        return { workers: [...known, ...others, ...streamOnly] };
      },
    },

    {
      // Read-only. Changing configuration from a browser would need a write
      // path into the user's config file; the file itself is the interface.
      method: "GET",
      path: "/api/config",
      mutating: false,
      handler: () => ({
        config,
        configFile: paths.configFile,
        dataDir: paths.dataDir,
        editable: false,
        note: "Configuration is read from the file above. ctxd does not write it from the interface.",
      }),
    },

    {
      method: "GET",
      path: "/api/resume",
      mutating: false,
      handler: (request) => {
        const projectId = projectIdFor(context, request);
        const root = request.query.get("dir") ?? context.dir;
        return { resume: buildResume(db, projectId, root) };
      },
    },

    {
      method: "GET",
      path: "/api/receipts/context",
      mutating: false,
      handler: (request) => ({
        receipts: listReceipts(
          paths.contextReceiptsDir,
          optionalInt({ limit: request.query.get("limit") }, "limit") ?? RECEIPT_PAGE,
        ),
      }),
    },

    {
      method: "GET",
      path: "/api/receipts/change",
      mutating: false,
      handler: (request) => ({
        receipts: listReceipts(
          paths.changeReceiptsDir,
          optionalInt({ limit: request.query.get("limit") }, "limit") ?? RECEIPT_PAGE,
        ),
      }),
    },

    {
      // The token monitor (UI-7).
      //
      // The aggregation is `@ctxd/stats`, the same module `ctxd stats` calls,
      // so the interface and the CLI cannot report different totals for the
      // same receipts. The browser used to sum receipts itself; that made the
      // interface a second place the number could be computed, and therefore a
      // second place it could be wrong.
      method: "GET",
      path: "/api/stats",
      mutating: false,
      handler: (request) => {
        const requested = request.query.get("window") ?? "all";
        if (!isStatsWindow(requested)) {
          throw new HttpError(
            400,
            `"window" must be one of ${STATS_WINDOWS.join(", ")}`,
          );
        }

        const since = windowSince(requested);
        const limit = optionalInt({ limit: request.query.get("limit") }, "limit");

        const stats = collectStats({
          contextReceiptsDir: paths.contextReceiptsDir,
          changeReceiptsDir: paths.changeReceiptsDir,
          ...(since === undefined ? {} : { since }),
          ...(limit === undefined ? {} : { limit }),
        });

        return {
          // Echoed back so the interface labels what it is showing rather than
          // whatever tab happens to be highlighted.
          window: requested,
          scope: describeWindow(requested),
          since: since ?? null,
          ...stats,
        };
      },
    },

    {
      method: "GET",
      path: "/api/diff",
      mutating: false,
      handler: (request) => {
        const dir = request.query.get("dir") ?? context.dir;
        if (!isGitRepository(dir)) {
          throw new HttpError(400, `${dir} is not a git repository`);
        }

        const task = request.query.get("task");
        const analysis = analyzeWorkingTree({
          cwd: dir,
          ...(task === null || task === "" ? {} : { task }),
        });
        return analysis.receipt;
      },
    },

    {
      // Building context writes a receipt, so it is a mutating route even
      // though it changes no project data.
      method: "POST",
      path: "/api/context",
      mutating: true,
      handler: (request) => {
        const task = requireString(request.body, "task");
        const dir = optionalString(request.body, "dir") ?? context.dir;
        const budget = optionalInt(request.body, "budget") ?? 10000;
        const worker = optionalString(request.body, "worker");

        const result = buildProjectContext({
          task,
          dir,
          budget,
          db,
          config,
          touchMemories: false,
          claimedWorker: worker,
        });

        // Recorded so the graph shows context the interface built, not only
        // context a worker asked for. Counts and the receipt id travel; the
        // context itself never does.
        try {
          emitEvent(db, {
            projectId: projectIdFor(context, request),
            type: "context_built",
            ...(worker === undefined ? {} : { worker }),
            data: {
              task,
              requestId: result.receipt.request_id,
              candidateTokens: result.receipt.candidate_total_tokens,
              finalTokens: result.receipt.final_total_tokens,
              source: "api",
            },
          });
        } catch {
          // The receipt is the durable record and it is already written. A log
          // failure must not turn a successful build into an error.
        }

        return {
          receipt: result.receipt,
          warnings: result.selection.warnings,
        };
      },
    },

    {
      // The graph home screen (§4). Assembled here so the interface lays out
      // what the core decided rather than deciding it in a browser.
      method: "GET",
      path: "/api/graph",
      mutating: false,
      handler: (request) => buildGraph(context, projectIdFor(context, request)),
    },

    ...createEventRoutes(context),
    ...createWriteRoutes(context),
  ];
}
