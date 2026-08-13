/**
 * Decisions, bug memory and file explanations (§45, §46, §47).
 *
 * All three are project memory with a particular shape, so they share one
 * implementation rather than three near-identical ones. What differs is the
 * memory type, the vocabulary of the prompts, and how the record is rendered.
 */

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import {
  formatMemoryMatches,
  getMemory,
  listMemories,
  memoriesForPaths,
  saveMemory,
  type Memory,
  type MemoryType,
} from "@ctxd/memory";
import { detectProject, findProjectByRoot } from "@ctxd/project";

interface Kind {
  readonly command: string;
  readonly type: MemoryType;
  readonly noun: string;
  readonly plural: string;
  readonly heading: string;
}

const DECISION: Kind = {
  command: "decision",
  type: "DECISION",
  noun: "decision",
  plural: "decisions",
  heading: "DECISION",
};

const BUG: Kind = {
  command: "bug",
  type: "BUG",
  noun: "bug",
  plural: "bugs",
  heading: "BUG",
};

const EXPLANATION: Kind = {
  command: "explain",
  type: "FILE",
  noun: "explanation",
  plural: "explanations",
  heading: "FILE",
};

function help(kind: Kind): string {
  const extra =
    kind === DECISION
      ? `  --question <text>  What was being decided
  --reason <text>    Why this was chosen`
      : kind === BUG
        ? `  --cause <text>     What caused it
  --fix <text>       How it was fixed`
        : `  --why <text>       Why this code is the way it is
  --important <text> What must not be changed without review`;

  return `ctxd ${kind.command} — record and surface project ${kind.plural}

Usage:
  ctxd ${kind.command}                      List ${kind.plural}
  ctxd ${kind.command} <id>                 Show one
  ctxd ${kind.command} add --title <text>   Record a new one
  ctxd ${kind.command} for <path>...        Show ${kind.plural} touching these files

Options:
  --title <text>     Short summary (required for add)
  --file <path>      Attach to a file or module; repeatable
${extra}
  --status <text>    ACTIVE, RESOLVED, SUPERSEDED … (free text)
  --dir <path>       Project directory (default: .)
  --json             Machine-readable output
  -h, --help         Show this help

Recorded ${kind.plural} are surfaced automatically by \`ctxd diff\` when the files
they concern are changed — which is the point of writing them down.`;
}

function renderMemory(kind: Kind, memory: Memory): string {
  const lines = [
    `${kind.heading} ${memory.id}`,
    "",
    memory.title,
    "",
    memory.content.trimEnd(),
    "",
    `Status: ${memory.status}`,
    `Source: ${memory.source} · importance ${memory.importance} · confidence ${memory.confidence}`,
    `Recorded: ${memory.createdAt}`,
  ];
  if (memory.tags.length > 0) lines.push(`Applies to: ${memory.tags.join(", ")}`);
  return lines.join("\n");
}

interface Resolved {
  readonly db: Db;
  readonly projectId: string;
  readonly root: string;
}

function openProject(dir: string): Resolved | string {
  const paths = resolvePaths();
  ensureDataDir(paths);
  const db = openDatabase(paths.dbFile);
  migrate(db);

  const detected = detectProject(dir);
  const project = findProjectByRoot(db, detected.root);
  if (project === undefined) {
    db.close();
    return `no ctxd project registered for ${detected.root} — run: ctxd init --dir ${dir}`;
  }

  return { db, projectId: project.id, root: detected.root };
}

/**
 * Compose the record body from the kind's fields.
 *
 * The shape follows the specification's examples (Question/Decision/Reason,
 * Problem/Cause/Fix, WHY/IMPORTANT) so a record reads the same way whoever
 * wrote it.
 */
function composeContent(
  kind: Kind,
  values: Record<string, string | boolean | string[] | undefined>,
): string {
  const get = (name: string): string | undefined => {
    const value = values[name];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
  };

  const parts: string[] = [];

  if (kind === DECISION) {
    const question = get("question");
    const reason = get("reason");
    if (question !== undefined) parts.push(`Question:\n${question}`);
    const decision = get("content") ?? get("decision");
    if (decision !== undefined) parts.push(`Decision:\n${decision}`);
    if (reason !== undefined) parts.push(`Reason:\n${reason}`);
  } else if (kind === BUG) {
    const problem = get("content") ?? get("problem");
    if (problem !== undefined) parts.push(`Problem:\n${problem}`);
    const cause = get("cause");
    if (cause !== undefined) parts.push(`Cause:\n${cause}`);
    const fix = get("fix");
    if (fix !== undefined) parts.push(`Fix:\n${fix}`);
  } else {
    const why = get("why") ?? get("content");
    if (why !== undefined) parts.push(`WHY:\n${why}`);
    const important = get("important");
    if (important !== undefined) parts.push(`IMPORTANT:\n${important}`);
  }

  const status = get("status");
  if (status !== undefined) parts.push(`Status:\n${status.toUpperCase()}`);

  return parts.join("\n\n");
}

function makeCommand(kind: Kind): (argv: readonly string[]) => number {
  return (argv: readonly string[]): number => {
    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(`${help(kind)}\n`);
      return 0;
    }

    let values;
    let positionals: string[];
    try {
      ({ values, positionals } = parseArgs({
        args: argv as string[],
        options: {
          title: { type: "string" },
          content: { type: "string" },
          file: { type: "string", multiple: true },
          question: { type: "string" },
          decision: { type: "string" },
          reason: { type: "string" },
          problem: { type: "string" },
          cause: { type: "string" },
          fix: { type: "string" },
          why: { type: "string" },
          important: { type: "string" },
          status: { type: "string" },
          dir: { type: "string" },
          json: { type: "boolean" },
        },
        allowPositionals: true,
        strict: true,
      }));
    } catch (error) {
      process.stderr.write(`ctxd ${kind.command}: ${(error as Error).message}\n\n${help(kind)}\n`);
      return 1;
    }

    const dir = resolve(values.dir ?? ".");
    const opened = openProject(dir);
    if (typeof opened === "string") {
      process.stderr.write(`ctxd ${kind.command}: ${opened}\n`);
      return 1;
    }

    const { db, projectId } = opened;
    try {
      const action = positionals[0];

      /* add ------------------------------------------------------------- */
      if (action === "add") {
        const title = values.title;
        if (title === undefined || title.trim() === "") {
          process.stderr.write(`ctxd ${kind.command} add: --title is required\n`);
          return 1;
        }

        const content = composeContent(kind, values as Record<string, string | undefined>);
        if (content === "") {
          process.stderr.write(
            `ctxd ${kind.command} add: nothing to record — give at least one detail field\n\n${help(kind)}\n`,
          );
          return 1;
        }

        const files = values.file ?? [];
        const outcome = saveMemory(db, {
          projectId,
          type: kind.type,
          title: title.trim(),
          content,
          // Authority follows what the record actually is (§31). A decision the
          // developer typed is an accepted decision; a bug report and a file
          // note are explicit user statements. All three outrank anything a
          // worker later concludes.
          source: kind.type === "DECISION" ? "accepted_decision" : "explicit_user",
          importance: "P1",
          confidence: 1,
          tags: files,
        });

        if (outcome.kind === "rejected") {
          process.stderr.write(`ctxd ${kind.command} add: ${outcome.reason}\n`);
          return 1;
        }

        process.stdout.write(
          `${outcome.kind === "unchanged" ? "already recorded" : "recorded"} ${kind.noun} ${outcome.memory.id}\n`,
        );
        if (files.length > 0) {
          process.stdout.write(`applies to: ${files.join(", ")}\n`);
        }
        return 0;
      }

      /* for <path>... ---------------------------------------------------- */
      if (action === "for") {
        const paths = positionals.slice(1);
        if (paths.length === 0) {
          process.stderr.write(`ctxd ${kind.command} for: give at least one path\n`);
          return 1;
        }

        const matches = memoriesForPaths(db, projectId, paths, { types: [kind.type] });
        if (values.json === true) {
          process.stdout.write(`${JSON.stringify(matches, null, 2)}\n`);
          return 0;
        }

        if (matches.length === 0) {
          process.stdout.write(`No ${kind.plural} recorded for those files.\n`);
          return 0;
        }
        process.stdout.write(`${formatMemoryMatches(matches)}\n`);
        return 0;
      }

      /* show one --------------------------------------------------------- */
      if (action !== undefined) {
        const memory = getMemory(db, action);
        if (memory === undefined || memory.type !== kind.type) {
          process.stderr.write(`ctxd ${kind.command}: no ${kind.noun} with id ${action}\n`);
          return 1;
        }
        process.stdout.write(
          values.json === true
            ? `${JSON.stringify(memory, null, 2)}\n`
            : `${renderMemory(kind, memory)}\n`,
        );
        return 0;
      }

      /* list -------------------------------------------------------------- */
      const memories = listMemories(db, projectId, { type: kind.type, limit: 100 });
      if (values.json === true) {
        process.stdout.write(`${JSON.stringify(memories, null, 2)}\n`);
        return 0;
      }

      if (memories.length === 0) {
        process.stdout.write(
          `No ${kind.plural} recorded yet.\n\nRecord one:\n  ctxd ${kind.command} add --title "…"\n`,
        );
        return 0;
      }

      for (const memory of memories) {
        const first = memory.content.trim().split("\n").slice(0, 2).join(" ").slice(0, 90);
        process.stdout.write(`${memory.id}  [${memory.status}]  ${memory.title}\n`);
        process.stdout.write(`    ${first}\n`);
        if (memory.tags.length > 0) {
          process.stdout.write(`    applies to: ${memory.tags.join(", ")}\n`);
        }
      }
      return 0;
    } catch (error) {
      process.stderr.write(`ctxd ${kind.command}: ${(error as Error).message}\n`);
      return 1;
    } finally {
      db.close();
    }
  };
}

export const decisionCommand = makeCommand(DECISION);
export const bugCommand = makeCommand(BUG);
export const explainCommand = makeCommand(EXPLANATION);

export const DECISION_HELP = help(DECISION);
export const BUG_HELP = help(BUG);
export const EXPLAIN_HELP = help(EXPLANATION);
