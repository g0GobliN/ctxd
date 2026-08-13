import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";
import {
  detectProject,
  indexProjectFiles,
  upsertProject,
  writeProjectStorage,
} from "@ctxd/project";
import { formatKeyValue } from "@ctxd/utils";

export const INIT_HELP = `ctxd init — register a project with ctxd

Usage:
  ctxd init [--dir <path>] [--no-index] [--help]

Options:
  --dir <path>   Project directory (default: .)
  --no-index     Register the project without indexing its files
  -h, --help     Show this help

Detects the runtime, language, package manager and framework by reading real
files — never by guessing from directory names. Re-running init on a known
project refreshes what was detected without losing its identity.`;

export function initCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${INIT_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        "no-index": { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd init: ${(error as Error).message}\n\n${INIT_HELP}\n`);
    return 1;
  }

  const dir = resolve(values.dir ?? ".");
  const paths = resolvePaths();

  let project;
  try {
    ensureDataDir(paths);
    project = detectProject(dir);
  } catch (error) {
    process.stderr.write(`ctxd init: ${(error as Error).message}\n`);
    return 1;
  }

  const db = openDatabase(paths.dbFile);
  try {
    migrate(db);
    const existing = db
      .prepare("SELECT created_at FROM projects WHERE id = ?")
      .get(project.id) as { created_at: string } | undefined;

    upsertProject(db, project);
    const storage = writeProjectStorage(paths.projectsDir, project);

    const lines: (readonly [string, string])[] = [
      ["project", project.name],
      ["id", project.id],
      ["root", project.root],
      ["vcs", project.vcs ?? "none"],
      ["runtime", project.runtime ?? "not detected"],
      ["language", project.language ?? "not detected"],
      ["package manager", project.packageManager ?? "not detected"],
      ["framework", project.framework ?? "not detected"],
      ["storage", storage.dir],
    ];

    if (values["no-index"] !== true) {
      const result = indexProjectFiles(db, project.id, project.root);
      lines.push([
        "indexed",
        `${result.total} files (${result.added} new, ${result.updated} changed, ` +
          `${result.unchanged} unchanged, ${result.removed} removed)`,
      ]);
    }

    process.stdout.write(`${existing === undefined ? "Registered" : "Refreshed"} project\n\n`);
    process.stdout.write(`${formatKeyValue(lines)}\n`);

    if (project.evidence.length > 0) {
      process.stdout.write(`\ndetected from: ${project.evidence.join(", ")}\n`);
    } else {
      process.stdout.write(
        `\nNo manifest files found in ${project.root}; nothing was inferred from directory names.\n`,
      );
    }

    return 0;
  } catch (error) {
    process.stderr.write(`ctxd init: ${(error as Error).message}\n`);
    return 1;
  } finally {
    db.close();
  }
}
