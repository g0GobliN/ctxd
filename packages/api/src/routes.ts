/**
 * Local API routes (§67–71).
 *
 * Every route calls the same core services the CLI and MCP server call —
 * business logic is never duplicated per entry point. This file is transport:
 * it turns a request into a service call and a service result into JSON.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { VERSION, type Config, type CtxdPaths } from "@ctxd/core";
import { analyzeWorkingTree, isGitRepository } from "@ctxd/diff";
import { buildProjectContext } from "@ctxd/firewall";
import { listMemories, searchMemories } from "@ctxd/memory";
import { describeGit, inspectGit, listProjects } from "@ctxd/project";
import { buildResume, lastSession, listTasks, latestCheckpoint } from "@ctxd/work";
import type { Db } from "@ctxd/db";
import {
  HttpError,
  optionalInt,
  optionalString,
  requireString,
  type Route,
  type RouteRequest,
} from "./http.js";

export interface RouteContext {
  readonly db: Db;
  readonly paths: CtxdPaths;
  readonly config: Config;
  /** Directory the UI is inspecting; defaults to the process working directory. */
  readonly dir: string;
}

/** How many receipts a listing returns before the caller must ask for more. */
const RECEIPT_PAGE = 50;

function projectIdFor(context: RouteContext, request: RouteRequest): string {
  const supplied = request.query.get("project");
  if (supplied !== null && supplied !== "") return supplied;

  const projects = listProjects(context.db);
  const first = projects[0];
  if (first === undefined) {
    throw new HttpError(404, "no project is registered — run: ctxd init");
  }
  return first.id;
}

/**
 * List receipt files newest-first.
 *
 * Reads the directory rather than the database because receipts are files by
 * design: they stay readable and portable without ctxd (§74).
 */
function listReceipts(directory: string, limit: number): unknown[] {
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }

  const entries = names
    .map((name) => {
      const path = join(directory, name);
      try {
        return { name, path, mtime: statSync(path).mtimeMs };
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is { name: string; path: string; mtime: number } => entry !== undefined)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const receipts: unknown[] = [];
  for (const entry of entries) {
    try {
      receipts.push(JSON.parse(readFileSync(entry.path, "utf8")));
    } catch {
      // A corrupt receipt is skipped rather than failing the whole listing;
      // the others are still worth showing.
    }
  }
  return receipts;
}

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

        const result = buildProjectContext({
          task,
          dir,
          budget,
          db,
          config,
          touchMemories: false,
        });

        return {
          receipt: result.receipt,
          warnings: result.selection.warnings,
        };
      },
    },
  ];
}
