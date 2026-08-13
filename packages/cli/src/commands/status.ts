import { existsSync } from "node:fs";
import { loadConfig, resolvePaths, VERSION } from "@ctxd/core";
import {
  getSchemaVersion,
  journalMode,
  openDatabase,
  TARGET_SCHEMA_VERSION,
} from "@ctxd/db";
import { formatKeyValue } from "@ctxd/utils";
import { describeGit, findProjectByRoot, inspectGit } from "@ctxd/project";

export interface StatusReport {
  readonly version: string;
  readonly configPath: string;
  readonly configExists: boolean;
  readonly configErrors: readonly string[];
  readonly dataDir: string;
  readonly mode: string;
  readonly database: string;
  readonly project: string;
  readonly git: string;
}

function describeDatabase(dbFile: string): string {
  if (!existsSync(dbFile)) return "not created yet (run ctxd doctor)";
  try {
    const db = openDatabase(dbFile, { readonly: true, fileMustExist: true });
    const schema = getSchemaVersion(db);
    const mode = journalMode(db);
    db.close();
    const suffix = schema === TARGET_SCHEMA_VERSION ? "" : ` (expected v${TARGET_SCHEMA_VERSION})`;
    return `ok — schema v${schema}${suffix}, journal ${mode}`;
  } catch (error) {
    return `unreadable — ${(error as Error).message}`;
  }
}

/**
 * Look up the registered project for this directory.
 *
 * A directory that has never been through `ctxd init` is reported as such,
 * not as an error: status must work anywhere.
 */
function describeProject(dbFile: string, root: string): string {
  if (!existsSync(dbFile)) return "not registered (run ctxd init)";
  try {
    const db = openDatabase(dbFile, { readonly: true, fileMustExist: true });
    try {
      if (getSchemaVersion(db) < 2) return "not registered (run ctxd init)";
      const project = findProjectByRoot(db, root);
      if (project === undefined) return "not registered (run ctxd init)";

      const files = db
        .prepare("SELECT count(*) AS count FROM files WHERE project_id = ?")
        .get(project.id) as { count: number };

      const stack = [project.language, project.framework, project.package_manager]
        .filter((value): value is string => value !== null)
        .join(", ");

      return `${project.name} [${project.id}]${stack === "" ? "" : ` — ${stack}`}, ${files.count} files indexed`;
    } finally {
      db.close();
    }
  } catch (error) {
    return `unreadable — ${(error as Error).message}`;
  }
}

/**
 * Collect status without requiring an initialised project: `ctxd status` must
 * work anywhere, including outside a repository.
 */
export function runStatus(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): StatusReport {
  const paths = resolvePaths({ env });
  const loaded = loadConfig(paths.configFile);
  const git = inspectGit(cwd);

  return {
    version: VERSION,
    configPath: paths.configFile,
    configExists: loaded.exists,
    configErrors: loaded.errors,
    dataDir: paths.dataDir,
    mode: loaded.config.mode,
    database: describeDatabase(paths.dbFile),
    project: describeProject(paths.dbFile, git.root ?? cwd),
    git: describeGit(git, cwd),
  };
}

export function formatStatus(report: StatusReport): string {
  const lines = formatKeyValue([
    ["ctxd", report.version],
    ["config", report.configExists ? report.configPath : `${report.configPath} (defaults)`],
    ["data", report.dataDir],
    ["mode", report.mode],
    ["database", report.database],
    ["project", report.project],
    ["git", report.git],
  ]);

  if (report.configErrors.length > 0) {
    return `${lines}\n\nconfig problems:\n${report.configErrors.map((e) => `  ${e}`).join("\n")}`;
  }
  return lines;
}

export const STATUS_HELP = `ctxd status — show the current ctxd state

Usage:
  ctxd status [--help]

Shows the ctxd version, configuration path, data directory, mode, database
state, current project and Git repository. Works outside a ctxd project.`;

export function statusCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${STATUS_HELP}\n`);
    return 0;
  }

  process.stdout.write(`${formatStatus(runStatus())}\n`);
  return 0;
}
