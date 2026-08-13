import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { ensureDataDir, resolvePaths, type CtxdPaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import {
  getMemory,
  isMemorySource,
  isMemoryType,
  listMemories,
  saveMemory,
  searchMemories,
  toMarkdown,
  writeMemoryBody,
  writeMemoryDigests,
  type Memory,
  type MemorySource,
  type MemoryType,
} from "@ctxd/memory";
import { detectProject, findProjectByRoot } from "@ctxd/project";
import { formatKeyValue } from "@ctxd/utils";
import { join } from "node:path";
import type { Priority } from "@ctxd/context";

export const MEMORY_HELP = `ctxd memory — record and read project memory

Usage:
  ctxd memory add --title <text> --content <text> [options]
  ctxd memory list [--type <TYPE>] [--limit <n>]
  ctxd memory show <id>
  ctxd memory search <query> [--type <TYPE>] [--limit <n>]

Options:
  --dir <path>        Project directory (default: .)
  --type <TYPE>       FACT, DECISION, ARCHITECTURE, CONSTRAINT, RULE, BUG,
                      TASK, NOTE, EXPERIMENT, PREFERENCE, FILE, SNAPSHOT,
                      SESSION, CONVERSATION (default: NOTE)
  --source <SOURCE>   explicit_user, project_rule, accepted_decision,
                      verified_code, verified_git, worker_statement, inferred
                      (default: explicit_user)
  --importance <P>    P0..P4; defaults from the type and source
  --tags <a,b,c>      Comma-separated tags
  --limit <n>         Maximum results
  -h, --help          Show this help

Authority order: explicit user instruction > project rule > accepted decision >
verified code > verified Git > worker statement > inferred. A lower-authority
memory is never allowed to silently overwrite a higher-authority one.`;

interface Resolved {
  readonly db: Db;
  readonly projectId: string;
  readonly projectDir: string;
  readonly paths: CtxdPaths;
}

/** Open the database and resolve which project the command applies to. */
function resolveProject(dir: string): Resolved | string {
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

  return {
    db,
    projectId: project.id,
    projectDir: join(paths.projectsDir, project.id),
    paths,
  };
}

function formatMemory(memory: Memory): string {
  return formatKeyValue([
    ["id", memory.id],
    ["type", memory.type],
    ["title", memory.title],
    ["importance", memory.importance],
    ["source", `${memory.source} (confidence ${memory.confidence})`],
    ["status", memory.status],
    ["tags", memory.tags.length === 0 ? "none" : memory.tags.join(", ")],
    ["updated", memory.updatedAt],
  ]);
}

function refreshDigests(resolved: Resolved): void {
  const all = listMemories(resolved.db, resolved.projectId, { limit: 1000 });
  writeMemoryDigests(resolved.projectDir, all);
}

export function memoryCommand(argv: readonly string[]): number {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${MEMORY_HELP}\n`);
    return argv.length === 0 ? 1 : 0;
  }

  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        type: { type: "string" },
        source: { type: "string" },
        importance: { type: "string" },
        tags: { type: "string" },
        limit: { type: "string" },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd memory: ${(error as Error).message}\n\n${MEMORY_HELP}\n`);
    return 1;
  }

  const [subcommand, ...rest] = positionals;
  const resolved = resolveProject(values.dir ?? ".");
  if (typeof resolved === "string") {
    process.stderr.write(`ctxd memory: ${resolved}\n`);
    return 1;
  }

  try {
    switch (subcommand) {
      case "add":
        return addMemory(resolved, values);
      case "list":
        return listCommand(resolved, values);
      case "show":
        return showCommand(resolved, rest[0]);
      case "search":
        return searchCommand(resolved, rest.join(" "), values);
      default:
        process.stderr.write(
          `ctxd memory: unknown subcommand "${subcommand ?? ""}"\n\n${MEMORY_HELP}\n`,
        );
        return 1;
    }
  } finally {
    resolved.db.close();
  }
}

function addMemory(resolved: Resolved, values: Record<string, unknown>): number {
  const title = values["title"] as string | undefined;
  const content = values["content"] as string | undefined;

  if (title === undefined || content === undefined) {
    process.stderr.write("ctxd memory add: --title and --content are required\n");
    return 1;
  }

  const typeInput = (values["type"] as string | undefined) ?? "NOTE";
  if (!isMemoryType(typeInput.toUpperCase())) {
    process.stderr.write(`ctxd memory add: unknown type "${typeInput}"\n`);
    return 1;
  }
  const type = typeInput.toUpperCase() as MemoryType;

  const sourceInput = (values["source"] as string | undefined) ?? "explicit_user";
  if (!isMemorySource(sourceInput)) {
    process.stderr.write(`ctxd memory add: unknown source "${sourceInput}"\n`);
    return 1;
  }
  const source = sourceInput as MemorySource;

  const importance = values["importance"] as Priority | undefined;
  const tags = ((values["tags"] as string | undefined) ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");

  const body = writeMemoryBody(
    join(resolved.projectDir, "memory"),
    `${Date.now()}`,
    title,
    content,
  );

  const outcome = saveMemory(resolved.db, {
    projectId: resolved.projectId,
    type,
    title,
    content: body.stored,
    source,
    tags,
    bodyPath: body.bodyPath,
    ...(importance === undefined ? {} : { importance }),
  });

  switch (outcome.kind) {
    case "rejected":
      process.stderr.write(
        `ctxd memory add: refused — ${outcome.reason}\n\n` +
          `Existing memory:\n${formatMemory(outcome.existing)}\n`,
      );
      return 2;
    case "unchanged":
      process.stdout.write(`Already recorded (unchanged)\n\n${formatMemory(outcome.memory)}\n`);
      return 0;
    case "superseded":
      refreshDigests(resolved);
      process.stdout.write(
        `Recorded, superseding ${outcome.previous.id}\n\n${formatMemory(outcome.memory)}\n`,
      );
      return 0;
    case "created":
      refreshDigests(resolved);
      process.stdout.write(`Recorded\n\n${formatMemory(outcome.memory)}\n`);
      return 0;
  }
}

function listCommand(resolved: Resolved, values: Record<string, unknown>): number {
  const typeInput = values["type"] as string | undefined;
  const type =
    typeInput !== undefined && isMemoryType(typeInput.toUpperCase())
      ? (typeInput.toUpperCase() as MemoryType)
      : undefined;

  const memories = listMemories(resolved.db, resolved.projectId, {
    ...(type === undefined ? {} : { type }),
    status: "active",
    limit: Number.parseInt((values["limit"] as string | undefined) ?? "50", 10),
  });

  if (memories.length === 0) {
    process.stdout.write("No memories recorded yet.\n");
    return 0;
  }

  for (const memory of memories) {
    process.stdout.write(
      `${memory.importance}  ${memory.type.padEnd(13)} ${memory.title}\n` +
        `      ${memory.id}  ${memory.source} (${memory.confidence})\n`,
    );
  }
  return 0;
}

function showCommand(resolved: Resolved, id: string | undefined): number {
  if (id === undefined) {
    process.stderr.write("ctxd memory show: an id is required\n");
    return 1;
  }

  const memory = getMemory(resolved.db, id);
  if (memory === undefined) {
    process.stderr.write(`ctxd memory show: no memory with id ${id}\n`);
    return 1;
  }

  process.stdout.write(toMarkdown(memory));
  return 0;
}

function searchCommand(
  resolved: Resolved,
  query: string,
  values: Record<string, unknown>,
): number {
  if (query.trim() === "") {
    process.stderr.write("ctxd memory search: a query is required\n");
    return 1;
  }

  const hits = searchMemories(resolved.db, query, {
    projectId: resolved.projectId,
    limit: Number.parseInt((values["limit"] as string | undefined) ?? "20", 10),
  });

  if (hits.length === 0) {
    process.stdout.write(`No memories match ${JSON.stringify(query)}.\n`);
    return 0;
  }

  for (const hit of hits) {
    process.stdout.write(
      `${hit.memory.importance}  ${hit.memory.title}  [${hit.memory.type}]\n` +
        `      ${hit.snippet.replace(/\s+/g, " ").trim()}\n` +
        `      ${hit.memory.id}  score ${hit.score.toFixed(2)}\n`,
    );
  }
  return 0;
}
