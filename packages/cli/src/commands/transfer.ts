/**
 * Export and import (§74).
 *
 * The promise is no lock-in: everything ctxd knows about a project must be able
 * to leave in a form a person can read and another tool can parse. So the
 * export is plain JSON with a documented shape — not a database dump, not an
 * archive format that needs ctxd to open it.
 *
 * Import never destroys. Records are matched by identity and skipped when they
 * already exist; a conflicting record is reported rather than silently
 * overwritten, because the local copy might be the newer truth.
 */

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureDataDir, resolvePaths, VERSION } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { getMemory, listMemories, saveMemory, type Memory } from "@ctxd/memory";
import { detectProject, findProjectByRoot, listProjects, type ProjectRow } from "@ctxd/project";
import { listTasks, type Task } from "@ctxd/work";

/** Bumped only when the shape changes incompatibly. */
export const EXPORT_FORMAT = 1;

export interface CtxdExport {
  readonly format: number;
  readonly ctxdVersion: string;
  readonly exportedAt: string;
  readonly project: {
    readonly name: string;
    readonly root: string;
    readonly language: string | null;
    readonly framework: string | null;
  };
  readonly memories: readonly Memory[];
  readonly tasks: readonly Task[];
}

export const EXPORT_HELP = `ctxd export — take your project knowledge elsewhere

Usage:
  ctxd export [--dir <path>] [--out <file>]

Options:
  --dir <path>   Project to export (default: .)
  --out <file>   Write here instead of stdout
  --pretty       Indent the JSON (default: on for files, off for pipes)
  -h, --help     Show this help

Exports memories and tasks as plain JSON. No proprietary format, no lock-in:
the file is readable without ctxd and parseable by anything.`;

export const IMPORT_HELP = `ctxd import — bring project knowledge from another machine

Usage:
  ctxd import <file> [--dir <path>] [--dry-run]

Options:
  --dir <path>   Project to import into (default: .)
  --dry-run      Report what would change, without changing it
  -h, --help     Show this help

Import never deletes and never overwrites. A record that already exists is
skipped; one that conflicts is reported so you can decide.`;

function openProject(dir: string): { db: Db; project: ProjectRow } | string {
  const paths = resolvePaths();
  ensureDataDir(paths);
  const db = openDatabase(paths.dbFile);
  migrate(db);

  const detected = detectProject(dir);
  const project = findProjectByRoot(db, detected.root);
  if (project === undefined) {
    const known = listProjects(db).length;
    db.close();
    return (
      `no ctxd project registered for ${detected.root} — run: ctxd init --dir ${dir}` +
      (known === 0 ? "" : ` (${known} other project(s) are registered)`)
    );
  }

  return { db, project };
}

export function exportCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${EXPORT_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        out: { type: "string" },
        pretty: { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd export: ${(error as Error).message}\n\n${EXPORT_HELP}\n`);
    return 1;
  }

  const dir = resolve(values.dir ?? ".");
  const opened = openProject(dir);
  if (typeof opened === "string") {
    process.stderr.write(`ctxd export: ${opened}\n`);
    return 1;
  }

  const { db, project } = opened;
  try {
    // No limit: an export that silently truncated would be worse than none.
    const payload: CtxdExport = {
      format: EXPORT_FORMAT,
      ctxdVersion: VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        root: project.root,
        language: project.language ?? null,
        framework: project.framework ?? null,
      },
      memories: listMemories(db, project.id, { limit: Number.MAX_SAFE_INTEGER }),
      tasks: listTasks(db, project.id, { limit: Number.MAX_SAFE_INTEGER }),
    };

    const pretty = values.pretty === true || values.out !== undefined;
    const json = `${JSON.stringify(payload, null, pretty ? 2 : 0)}\n`;

    if (values.out === undefined) {
      process.stdout.write(json);
    } else {
      const path = resolve(values.out);
      writeFileSync(path, json, { mode: 0o600 });
      process.stdout.write(
        `exported ${payload.memories.length} memories and ${payload.tasks.length} tasks to ${path}\n`,
      );
    }
    return 0;
  } catch (error) {
    process.stderr.write(`ctxd export: ${(error as Error).message}\n`);
    return 1;
  } finally {
    db.close();
  }
}

/** Validate enough of the payload to fail clearly rather than half-importing. */
function parseExport(raw: string): CtxdExport | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return `not valid JSON: ${(error as Error).message}`;
  }

  const payload = parsed as Partial<CtxdExport>;
  if (typeof payload.format !== "number") return "missing \"format\"";
  if (payload.format > EXPORT_FORMAT) {
    return `format ${payload.format} was written by a newer ctxd (this one understands ${EXPORT_FORMAT})`;
  }
  if (!Array.isArray(payload.memories)) return "missing \"memories\" array";
  if (!Array.isArray(payload.tasks)) return "missing \"tasks\" array";

  return payload as CtxdExport;
}

export function importCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${IMPORT_HELP}\n`);
    return 0;
  }

  let values;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        "dry-run": { type: "boolean" },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd import: ${(error as Error).message}\n\n${IMPORT_HELP}\n`);
    return 1;
  }

  const source = positionals[0];
  if (source === undefined) {
    process.stderr.write(`ctxd import: give a file to import\n\n${IMPORT_HELP}\n`);
    return 1;
  }

  let raw: string;
  try {
    raw = readFileSync(resolve(source), "utf8");
  } catch (error) {
    process.stderr.write(`ctxd import: could not read ${source} — ${(error as Error).message}\n`);
    return 1;
  }

  const payload = parseExport(raw);
  if (typeof payload === "string") {
    process.stderr.write(`ctxd import: ${payload}\n`);
    return 1;
  }

  const dir = resolve(values.dir ?? ".");
  const opened = openProject(dir);
  if (typeof opened === "string") {
    process.stderr.write(`ctxd import: ${opened}\n`);
    return 1;
  }

  const { db, project } = opened;
  const dryRun = values["dry-run"] === true;

  let imported = 0;
  let skipped = 0;
  const conflicts: string[] = [];

  try {
    for (const memory of payload.memories) {
      // Identity is scoped to the project. Memory ids are globally unique keys,
      // but the same knowledge can legitimately apply to two projects on one
      // machine — so an id held by a *different* project is a collision to work
      // around, not a record that already exists here.
      const existing = getMemory(db, memory.id);
      const alreadyHere = existing !== undefined && existing.projectId === project.id;

      if (alreadyHere) {
        if (existing.hash !== memory.hash) {
          conflicts.push(
            `${memory.id} "${memory.title}" — a different record already exists locally`,
          );
        } else {
          skipped += 1;
        }
        continue;
      }

      if (dryRun) {
        imported += 1;
        continue;
      }

      const outcome = saveMemory(db, {
        projectId: project.id,
        // Keep the original id where it is free, so a round trip between two
        // machines stays stable. Let one be generated when it is taken.
        ...(existing === undefined ? { id: memory.id } : {}),
        type: memory.type,
        title: memory.title,
        content: memory.content,
        source: memory.source,
        importance: memory.importance,
        confidence: memory.confidence,
        tags: memory.tags,
      });

      if (outcome.kind === "rejected") {
        conflicts.push(`${memory.id} "${memory.title}" — ${outcome.reason}`);
      } else if (outcome.kind === "unchanged") {
        skipped += 1;
      } else {
        imported += 1;
      }
    }

    const verb = dryRun ? "would import" : "imported";
    process.stdout.write(
      `${verb} ${imported} memories · skipped ${skipped} already present\n`,
    );

    if (payload.tasks.length > 0) {
      // Being explicit beats importing work state that would collide with the
      // local project's own tasks.
      process.stdout.write(
        `${payload.tasks.length} task(s) in the file were not imported — ` +
          "task state belongs to the machine doing the work\n",
      );
    }

    if (conflicts.length > 0) {
      process.stdout.write("\nConflicts (nothing was overwritten):\n");
      for (const conflict of conflicts) process.stdout.write(`  ! ${conflict}\n`);
      return 2;
    }

    return 0;
  } catch (error) {
    process.stderr.write(`ctxd import: ${(error as Error).message}\n`);
    return 1;
  } finally {
    db.close();
  }
}
