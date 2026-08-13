import { resolve } from "node:path";
import { VERSION, type Config, type CtxdPaths } from "@ctxd/core";
import { getSchemaVersion, type Db } from "@ctxd/db";
import { formatReceipt } from "@ctxd/context";
import {
  buildProjectContext,
  contextDecision,
  contextFile,
  contextGet,
  contextHistory,
  contextSearch,
  PathEscapesProjectError,
} from "@ctxd/firewall";
import {
  getMemory,
  isMemorySource,
  isMemoryType,
  listMemories,
  saveMemory,
  type MemorySource,
  type MemoryType,
} from "@ctxd/memory";
import { detectProject, findProjectByRoot, type ProjectRow } from "@ctxd/project";
import {
  buildHandoff,
  createCheckpoint,
  formatCheckpoint,
  formatHandoff,
  getTask,
  isTaskStatus,
  listTasks,
  subtasks,
  updateTask,
  type TaskStatus,
} from "@ctxd/work";

export interface ToolContext {
  readonly db: Db;
  readonly paths: CtxdPaths;
  readonly config: Config;
  /** Directory the server was started in; the default project for every tool. */
  readonly cwd: string;
}

export interface ToolResult {
  readonly text: string;
  readonly isError?: boolean;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  handler(args: Record<string, unknown>): ToolResult;
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return undefined;
}

function fail(message: string): ToolResult {
  return { text: message, isError: true };
}

interface ResolvedProject {
  readonly root: string;
  readonly project: ProjectRow | undefined;
}

function resolveProject(ctx: ToolContext, args: Record<string, unknown>): ResolvedProject {
  const dir = resolve(str(args, "dir") ?? ctx.cwd);
  const detected = detectProject(dir);
  return { root: detected.root, project: findProjectByRoot(ctx.db, detected.root) };
}

function requireProject(
  ctx: ToolContext,
  args: Record<string, unknown>,
): ResolvedProject | ToolResult {
  const resolved = resolveProject(ctx, args);
  if (resolved.project === undefined) {
    return fail(
      `No ctxd project is registered for ${resolved.root}. ` +
        `Ask the developer to run: ctxd init --dir ${resolved.root}`,
    );
  }
  return resolved;
}

const DIR_PROPERTY = {
  dir: {
    type: "string",
    description: "Project directory. Defaults to where the ctxd server was started.",
  },
} as const;

/**
 * The MCP tool surface.
 *
 * Every tool calls the same services the CLI does — no business logic is
 * reimplemented here. MCP is a bridge, not the core.
 *
 * A tool is added only once the service behind it exists. A tool that cannot
 * do what its name promises is worse than no tool: a worker would call it,
 * believe the result, and act on nothing.
 */
export function createTools(ctx: ToolContext): ToolDefinition[] {
  return [
    {
      name: "ctx_status",
      description:
        "Report ctxd's state: version, storage location, database schema and whether this directory is a registered project.",
      inputSchema: { type: "object", properties: { ...DIR_PROPERTY } },
      handler(args) {
        const { root, project } = resolveProject(ctx, args);
        const lines = [
          `ctxd ${VERSION}`,
          `data directory: ${ctx.paths.dataDir}`,
          `database schema: v${getSchemaVersion(ctx.db)}`,
          `mode: ${ctx.config.mode}`,
          `directory: ${root}`,
          project === undefined
            ? "project: not registered (run ctxd init)"
            : `project: ${project.name} [${project.id}]`,
        ];
        return { text: lines.join("\n") };
      },
    },

    {
      name: "ctx_project_summary",
      description:
        "Summarise the project: detected stack, indexed file count, and the mandatory rules that constrain any change.",
      inputSchema: { type: "object", properties: { ...DIR_PROPERTY } },
      handler(args) {
        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project, root } = resolved as ResolvedProject & { project: ProjectRow };

        const files = ctx.db
          .prepare("SELECT count(*) AS count FROM files WHERE project_id = ?")
          .get(project.id) as { count: number };
        const rules = listMemories(ctx.db, project.id, {
          importance: "P0",
          status: "active",
          limit: 25,
        });

        const lines = [
          `# ${project.name}`,
          ``,
          `root: ${root}`,
          `language: ${project.language ?? "not detected"}`,
          `framework: ${project.framework ?? "not detected"}`,
          `package manager: ${project.package_manager ?? "not detected"}`,
          `indexed files: ${files.count}`,
          ``,
          `## Binding rules (${rules.length})`,
          ``,
          ...(rules.length === 0
            ? ["None recorded."]
            : rules.map((rule) => `- ${rule.title} — ${rule.content.split("\n")[0] ?? ""}`)),
        ];
        return { text: lines.join("\n") };
      },
    },

    {
      name: "ctx_context_build",
      description:
        "Build the minimum useful context for a task. Returns the assembled context plus a receipt explaining every inclusion and exclusion. Prefer this over reading the repository yourself.",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string", description: "What you are about to do." },
          budget: {
            type: "number",
            description: "Maximum estimated tokens in the result (default 10000).",
          },
          receipt_only: {
            type: "boolean",
            description: "Return only the receipt, without the context itself.",
          },
          ...DIR_PROPERTY,
        },
        required: ["task"],
      },
      handler(args) {
        const task = str(args, "task");
        if (task === undefined) return fail("task is required");

        const { root } = resolveProject(ctx, args);
        const result = buildProjectContext({
          task,
          dir: root,
          budget: num(args, "budget") ?? 10000,
          db: ctx.db,
          config: ctx.config,
          touchMemories: true,
        });

        const receipt = formatReceipt(result.receipt);
        if (args["receipt_only"] === true) return { text: receipt };

        return {
          text: `${result.context}\n\n---\n\n${receipt}`,
        };
      },
    },

    {
      name: "ctx_search",
      description:
        "Search project memory: rules, decisions, bugs, facts. Returns summaries with the cost of fetching each in full — fetch with ctx_get only what you need.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          ...DIR_PROPERTY,
        },
        required: ["query"],
      },
      handler(args) {
        const query = str(args, "query");
        if (query === undefined) return fail("query is required");

        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project } = resolved as ResolvedProject & { project: ProjectRow };

        const results = contextSearch(ctx.db, project.id, query, num(args, "limit") ?? 10);
        if (results.length === 0) return { text: `No memories match ${JSON.stringify(query)}.` };

        return {
          text: results
            .map(
              (result) =>
                `${result.importance}  ${result.title}  [${result.type}]\n` +
                `  ${result.snippet}\n` +
                `  id: ${result.id}  source: ${result.source}  ${result.estimatedTokens} tokens to fetch`,
            )
            .join("\n\n"),
        };
      },
    },

    {
      name: "ctx_get",
      description: "Fetch one memory in full by id, as returned by ctx_search.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      handler(args) {
        const id = str(args, "id");
        if (id === undefined) return fail("id is required");

        const memory = contextGet(ctx.db, id);
        if (memory === undefined) return fail(`No memory with id ${id}.`);

        return {
          text:
            `# ${memory.title}\n\n${memory.content}\n\n` +
            `— ${memory.type}, source ${memory.source}, confidence ${memory.confidence}`,
        };
      },
    },

    {
      name: "ctx_decision_get",
      description:
        "List decisions already taken on this project. Check before changing an approach — a decision may already govern it.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" }, ...DIR_PROPERTY },
      },
      handler(args) {
        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project } = resolved as ResolvedProject & { project: ProjectRow };

        const decisions = contextDecision(
          ctx.db,
          project.id,
          str(args, "query"),
          num(args, "limit") ?? 10,
        );
        if (decisions.length === 0) return { text: "No decisions recorded." };

        return {
          text: decisions
            .map((decision) => `- ${decision.title}\n  ${decision.snippet}\n  id: ${decision.id}`)
            .join("\n\n"),
        };
      },
    },

    {
      name: "ctx_file_search",
      description:
        "Find indexed files by path. Returns paths only — read one with ctx_file_get.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          ...DIR_PROPERTY,
        },
        required: ["query"],
      },
      handler(args) {
        const query = str(args, "query");
        if (query === undefined) return fail("query is required");

        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project } = resolved as ResolvedProject & { project: ProjectRow };

        const rows = ctx.db
          .prepare(
            `SELECT path, size, language FROM files
             WHERE project_id = ? AND path LIKE ? ESCAPE '\\'
             ORDER BY length(path), path LIMIT ?`,
          )
          .all(
            project.id,
            `%${query.replace(/[\\%_]/g, "\\$&")}%`,
            num(args, "limit") ?? 25,
          ) as { path: string; size: number; language: string | null }[];

        if (rows.length === 0) return { text: `No indexed file matches ${JSON.stringify(query)}.` };

        return {
          text: rows
            .map((row) => `${row.path}  (${row.size} bytes${row.language ? `, ${row.language}` : ""})`)
            .join("\n"),
        };
      },
    },

    {
      name: "ctx_file_get",
      description:
        "Read one file from the project, optionally a line range. Confined to the project root.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          from_line: { type: "number" },
          to_line: { type: "number" },
          ...DIR_PROPERTY,
        },
        required: ["path"],
      },
      handler(args) {
        const path = str(args, "path");
        if (path === undefined) return fail("path is required");

        const { root } = resolveProject(ctx, args);
        try {
          const slice = contextFile(root, path, {
            ...(num(args, "from_line") === undefined ? {} : { fromLine: num(args, "from_line") as number }),
            ...(num(args, "to_line") === undefined ? {} : { toLine: num(args, "to_line") as number }),
          });
          if (slice === undefined) return fail(`Cannot read ${path}.`);

          return {
            text:
              `${slice.path} lines ${slice.fromLine}-${slice.toLine} of ${slice.totalLines}\n\n` +
              slice.content,
          };
        } catch (error) {
          if (error instanceof PathEscapesProjectError) return fail(error.message);
          throw error;
        }
      },
    },

    {
      name: "ctx_history",
      description: "Recent Git commits for the project.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number" }, ...DIR_PROPERTY },
      },
      handler(args) {
        const { root } = resolveProject(ctx, args);
        const commits = contextHistory(root, num(args, "limit") ?? 10);
        if (commits.length === 0) return { text: "No commits." };

        return {
          text: commits
            .map((commit) => `${commit.hash.slice(0, 8)}  ${commit.date}  ${commit.subject}`)
            .join("\n"),
        };
      },
    },

    {
      name: "ctx_memory_save",
      description:
        "Record durable project knowledge: a decision taken, a constraint discovered, a bug and its cause. Use source 'worker_statement' for your own conclusions — they will not override what the developer stated.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          type: {
            type: "string",
            description:
              "FACT, DECISION, ARCHITECTURE, CONSTRAINT, RULE, BUG, TASK, NOTE, EXPERIMENT, PREFERENCE (default NOTE).",
          },
          source: {
            type: "string",
            description:
              "worker_statement (default for AI conclusions), inferred, verified_code, verified_git, accepted_decision.",
          },
          tags: { type: "array", items: { type: "string" } },
          ...DIR_PROPERTY,
        },
        required: ["title", "content"],
      },
      handler(args) {
        const title = str(args, "title");
        const content = str(args, "content");
        if (title === undefined || content === undefined) {
          return fail("title and content are required");
        }

        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project } = resolved as ResolvedProject & { project: ProjectRow };

        const typeInput = (str(args, "type") ?? "NOTE").toUpperCase();
        if (!isMemoryType(typeInput)) return fail(`Unknown memory type ${typeInput}.`);

        const sourceInput = str(args, "source") ?? "worker_statement";
        if (!isMemorySource(sourceInput)) return fail(`Unknown source ${sourceInput}.`);

        // A worker may not claim the developer's authority for its own output.
        if (sourceInput === "explicit_user" || sourceInput === "project_rule") {
          return fail(
            `A worker may not record memory as ${sourceInput}. ` +
              `Use worker_statement, or ask the developer to record it themselves.`,
          );
        }

        const tags = Array.isArray(args["tags"])
          ? (args["tags"] as unknown[]).filter((tag): tag is string => typeof tag === "string")
          : [];

        const outcome = saveMemory(ctx.db, {
          projectId: project.id,
          type: typeInput as MemoryType,
          title,
          content,
          source: sourceInput as MemorySource,
          tags,
        });

        switch (outcome.kind) {
          case "created":
            return { text: `Recorded as ${outcome.memory.id}.` };
          case "unchanged":
            return { text: `Already recorded as ${outcome.memory.id}; nothing changed.` };
          case "superseded":
            return {
              text: `Recorded as ${outcome.memory.id}, superseding ${outcome.previous.id}.`,
            };
          case "rejected":
            return fail(
              `Refused: ${outcome.reason}. The existing memory "${outcome.existing.title}" ` +
                `has higher authority. Raise the conflict with the developer instead of overwriting it.`,
            );
        }
      },
    },

    {
      name: "ctx_memory_update",
      description:
        "Revise an existing memory. The revision is recorded as a new version that supersedes the old one; nothing is destroyed. Subject to the same authority rules as ctx_memory_save.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          content: { type: "string" },
          source: { type: "string" },
          ...DIR_PROPERTY,
        },
        required: ["id", "content"],
      },
      handler(args) {
        const id = str(args, "id");
        const content = str(args, "content");
        if (id === undefined || content === undefined) {
          return fail("id and content are required");
        }

        const existing = getMemory(ctx.db, id);
        if (existing === undefined) return fail(`No memory with id ${id}.`);

        const sourceInput = str(args, "source") ?? "worker_statement";
        if (!isMemorySource(sourceInput)) return fail(`Unknown source ${sourceInput}.`);
        if (sourceInput === "explicit_user" || sourceInput === "project_rule") {
          return fail(`A worker may not record memory as ${sourceInput}.`);
        }

        const outcome = saveMemory(ctx.db, {
          projectId: existing.projectId,
          type: existing.type,
          title: existing.title,
          content,
          source: sourceInput as MemorySource,
          tags: existing.tags,
        });

        switch (outcome.kind) {
          case "superseded":
            return { text: `Updated; ${outcome.previous.id} is now superseded.` };
          case "unchanged":
            return { text: "No change: the content is identical." };
          case "created":
            return { text: `Recorded as ${outcome.memory.id}.` };
          case "rejected":
            return fail(
              `Refused: ${outcome.reason}. Raise the conflict with the developer instead.`,
            );
        }
      },
    },

    {
      name: "ctx_task_get",
      description:
        "List open tasks, or fetch one by id with its subtasks. Check what is already planned before starting something new.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", description: "BACKLOG, PLANNED, IN_PROGRESS, BLOCKED, REVIEW, DONE, CANCELLED" },
          ...DIR_PROPERTY,
        },
      },
      handler(args) {
        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project } = resolved as ResolvedProject & { project: ProjectRow };

        const id = str(args, "id");
        if (id !== undefined) {
          const task = getTask(ctx.db, id);
          if (task === undefined) return fail(`No task with id ${id}.`);

          const children = subtasks(ctx.db, id);
          return {
            text:
              `${task.title}\n\n` +
              `status: ${task.status}\npriority: ${task.priority}\n` +
              `worker: ${task.worker ?? "unassigned"}\n\n${task.description}` +
              (children.length === 0
                ? ""
                : `\n\nSubtasks:\n${children
                    .map((child) => `- [${child.status}] ${child.title} (${child.id})`)
                    .join("\n")}`),
          };
        }

        const statusInput = str(args, "status")?.toUpperCase();
        if (statusInput !== undefined && !isTaskStatus(statusInput)) {
          return fail(`Unknown status ${statusInput}.`);
        }

        const tasks = listTasks(ctx.db, project.id, {
          ...(statusInput === undefined ? {} : { status: statusInput as TaskStatus }),
        });
        if (tasks.length === 0) return { text: "No open tasks." };

        return {
          text: tasks
            .map((task) => `[${task.status}] ${task.priority} ${task.title}\n  id: ${task.id}`)
            .join("\n"),
        };
      },
    },

    {
      name: "ctx_task_update",
      description:
        "Update a task's status, priority or assignee as work progresses. Use it to reflect reality, not to close work you have not verified.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string" },
          priority: { type: "string" },
          worker: { type: "string" },
          ...DIR_PROPERTY,
        },
        required: ["id"],
      },
      handler(args) {
        const id = str(args, "id");
        if (id === undefined) return fail("id is required");

        const statusInput = str(args, "status")?.toUpperCase();
        if (statusInput !== undefined && !isTaskStatus(statusInput)) {
          return fail(`Unknown status ${statusInput}.`);
        }

        const priority = str(args, "priority");
        const worker = str(args, "worker");
        const task = updateTask(ctx.db, id, {
          ...(statusInput === undefined ? {} : { status: statusInput as TaskStatus }),
          ...(priority === undefined ? {} : { priority: priority as never }),
          ...(worker === undefined ? {} : { worker }),
        });

        if (task === undefined) return fail(`No task with id ${id}.`);
        return { text: `${task.title} is now ${task.status}.` };
      },
    },

    {
      name: "ctx_checkpoint",
      description:
        "Record where the work stands: objective, what is done, what remains, and the next action. Anything you omit is derived from recorded state.",
      inputSchema: {
        type: "object",
        properties: {
          objective: { type: "string" },
          completed: { type: "string" },
          remaining: { type: "string" },
          next_action: { type: "string" },
          ...DIR_PROPERTY,
        },
      },
      handler(args) {
        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project, root } = resolved as ResolvedProject & { project: ProjectRow };

        const checkpoint = createCheckpoint(ctx.db, {
          projectId: project.id,
          root,
          ...(str(args, "objective") === undefined ? {} : { objective: str(args, "objective") as string }),
          ...(str(args, "completed") === undefined ? {} : { completed: str(args, "completed") as string }),
          ...(str(args, "remaining") === undefined ? {} : { remaining: str(args, "remaining") as string }),
          ...(str(args, "next_action") === undefined ? {} : { nextAction: str(args, "next_action") as string }),
        });

        return { text: formatCheckpoint(checkpoint) };
      },
    },

    {
      name: "ctx_handoff",
      description:
        "Assemble everything another worker needs to continue: task, progress, binding constraints, decisions, known bugs and Git state.",
      inputSchema: {
        type: "object",
        properties: { to: { type: "string" }, ...DIR_PROPERTY },
      },
      handler(args) {
        const resolved = requireProject(ctx, args);
        if ("text" in resolved) return resolved;
        const { project, root } = resolved as ResolvedProject & { project: ProjectRow };

        const handoff = buildHandoff(ctx.db, {
          projectId: project.id,
          root,
          ...(str(args, "to") === undefined ? {} : { recommendedWorker: str(args, "to") as string }),
        });

        return { text: formatHandoff(handoff) };
      },
    },
  ];
}
