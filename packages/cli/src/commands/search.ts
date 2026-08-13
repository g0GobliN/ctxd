import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";
import {
  contextDecision,
  contextFile,
  contextGet,
  contextHistory,
  contextSearch,
  PathEscapesProjectError,
} from "@ctxd/firewall";
import { detectProject, findProjectByRoot } from "@ctxd/project";

export const SEARCH_HELP = `ctxd search — expand context incrementally

Usage:
  ctxd search <query>              Search project knowledge (summaries only)
  ctxd search --get <id>           Fetch one memory in full
  ctxd search --decisions [query]  List relevant decisions
  ctxd search --file <path>        Read one file, optionally a line range
  ctxd search --history            Recent commits

Options:
  --dir <path>     Project directory (default: .)
  --from <line>    First line when reading a file
  --to <line>      Last line when reading a file
  --limit <n>      Maximum results (default: 10)
  -h, --help       Show this help

Search returns summaries with the token cost of fetching each result, so
context is expanded deliberately rather than all at once.`;

export function searchCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${SEARCH_HELP}\n`);
    return 0;
  }

  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        get: { type: "string" },
        decisions: { type: "boolean" },
        file: { type: "string" },
        history: { type: "boolean" },
        from: { type: "string" },
        to: { type: "string" },
        limit: { type: "string" },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd search: ${(error as Error).message}\n\n${SEARCH_HELP}\n`);
    return 1;
  }

  const dir = resolve(values.dir ?? ".");
  const limit = Number.parseInt(values.limit ?? "10", 10);
  const paths = resolvePaths();
  ensureDataDir(paths);

  const detected = detectProject(dir);

  // Reading a file or history needs no database at all.
  if (values.file !== undefined) {
    try {
      const slice = contextFile(detected.root, values.file, {
        ...(values.from === undefined ? {} : { fromLine: Number.parseInt(values.from, 10) }),
        ...(values.to === undefined ? {} : { toLine: Number.parseInt(values.to, 10) }),
      });
      if (slice === undefined) {
        process.stderr.write(`ctxd search: cannot read ${values.file}\n`);
        return 1;
      }
      process.stdout.write(
        `${slice.path} lines ${slice.fromLine}-${slice.toLine} of ${slice.totalLines} ` +
          `(${slice.estimatedTokens} estimated tokens)\n\n${slice.content}\n`,
      );
      return 0;
    } catch (error) {
      if (error instanceof PathEscapesProjectError) {
        process.stderr.write(`ctxd search: ${error.message}\n`);
        return 1;
      }
      throw error;
    }
  }

  if (values.history === true) {
    const commits = contextHistory(detected.root, limit);
    if (commits.length === 0) {
      process.stdout.write("No commits.\n");
      return 0;
    }
    for (const commit of commits) {
      process.stdout.write(`${commit.hash.slice(0, 8)}  ${commit.date}  ${commit.subject}\n`);
    }
    return 0;
  }

  const db = openDatabase(paths.dbFile);
  try {
    migrate(db);
    const project = findProjectByRoot(db, detected.root);
    if (project === undefined) {
      process.stderr.write(
        `ctxd search: no project registered for ${detected.root}. Run: ctxd init --dir ${dir}\n`,
      );
      return 1;
    }

    if (values.get !== undefined) {
      const memory = contextGet(db, values.get);
      if (memory === undefined) {
        process.stderr.write(`ctxd search: no memory with id ${values.get}\n`);
        return 1;
      }
      process.stdout.write(
        `# ${memory.title}\n\n${memory.content}\n\n` +
          `— ${memory.type}, ${memory.source}, confidence ${memory.confidence}, ` +
          `${memory.estimatedTokens} estimated tokens\n`,
      );
      return 0;
    }

    const query = positionals.join(" ");
    const results =
      values.decisions === true
        ? contextDecision(db, project.id, query, limit)
        : contextSearch(db, project.id, query, limit);

    if (values.decisions !== true && query.trim() === "") {
      process.stderr.write(`ctxd search: a query is required\n\n${SEARCH_HELP}\n`);
      return 1;
    }

    if (results.length === 0) {
      process.stdout.write("No matches.\n");
      return 0;
    }

    for (const result of results) {
      process.stdout.write(
        `${result.importance}  ${result.title}  [${result.type}]\n` +
          `      ${result.snippet}\n` +
          `      ${result.id}  ${result.source}  ${result.estimatedTokens} tokens to fetch\n`,
      );
    }
    process.stdout.write(
      `\nFetch one with: ctxd search --get <id>\n`,
    );
    return 0;
  } finally {
    db.close();
  }
}
