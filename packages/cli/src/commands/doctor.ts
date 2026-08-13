import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureDataDir,
  isWritableDir,
  loadConfig,
  resolvePaths,
  type CtxdPaths,
} from "@ctxd/core";
import {
  foreignKeysEnabled,
  getSchemaVersion,
  hasFts5,
  journalMode,
  migrate,
  openDatabase,
  sqliteVersion,
  TARGET_SCHEMA_VERSION,
} from "@ctxd/db";
import { formatCheck } from "@ctxd/utils";
import { inspectGit } from "@ctxd/project";
import { offlineReport } from "@ctxd/ai";

/** Minimum Node major version required by the specification. */
export const NODE_MINIMUM_MAJOR = 24;

export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  /** Shown when the check fails; must describe a concrete remedy. */
  readonly fix?: string;
}

export interface DoctorReport {
  readonly checks: readonly Check[];
  readonly ok: boolean;
}

function checkNode(version: string = process.versions.node): Check {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  const ok = Number.isInteger(major) && major >= NODE_MINIMUM_MAJOR;
  return {
    name: `Node ${NODE_MINIMUM_MAJOR}+`,
    ok,
    detail: `v${version}`,
    ...(ok
      ? {}
      : {
          fix: `ctxd requires Node ${NODE_MINIMUM_MAJOR} or newer. Install it (for example: nvm install ${NODE_MINIMUM_MAJOR}) and re-run.`,
        }),
  };
}

function checkDataDir(paths: CtxdPaths): Check {
  try {
    ensureDataDir(paths);
  } catch (error) {
    return {
      name: "Data directory",
      ok: false,
      detail: paths.dataDir,
      fix: `Could not create the data directory (${(error as Error).message}). Check permissions or set CTXD_HOME to a writable path.`,
    };
  }

  if (!isWritableDir(paths.dataDir)) {
    return {
      name: "Data directory",
      ok: false,
      detail: paths.dataDir,
      fix: "The data directory exists but is not writable. Fix its permissions or set CTXD_HOME.",
    };
  }

  return { name: "Data directory", ok: true, detail: paths.dataDir };
}

function checkConfig(paths: CtxdPaths): Check {
  try {
    const loaded = loadConfig(paths.configFile);
    if (loaded.errors.length > 0) {
      return {
        name: "Configuration",
        ok: false,
        detail: paths.configFile,
        fix: `Invalid fields: ${loaded.errors.join("; ")}. Correct them or delete the file to fall back to defaults.`,
      };
    }
    return {
      name: "Configuration",
      ok: true,
      detail: loaded.exists ? paths.configFile : "defaults (no config file yet)",
    };
  } catch (error) {
    return {
      name: "Configuration",
      ok: false,
      detail: paths.configFile,
      fix: `Could not read the config file (${(error as Error).message}).`,
    };
  }
}

interface SqliteChecks {
  readonly sqlite: Check;
  readonly fts5: Check;
  readonly database: Check;
}

function checkSqlite(paths: CtxdPaths): SqliteChecks {
  let version: string;
  let fts5: boolean;

  // Probe the driver in memory first, so a broken install is reported as a
  // driver problem rather than a database problem.
  try {
    const probe = openDatabase(":memory:");
    version = sqliteVersion(probe);
    fts5 = hasFts5(probe);
    probe.close();
  } catch (error) {
    const fix = `better-sqlite3 could not be loaded (${(error as Error).message}). Run: pnpm install`;
    return {
      sqlite: { name: "SQLite", ok: false, detail: "unavailable", fix },
      fts5: { name: "FTS5", ok: false, detail: "not checked", fix },
      database: { name: "Database", ok: false, detail: "not checked", fix },
    };
  }

  const sqlite: Check = { name: "SQLite", ok: true, detail: version };
  const fts5Check: Check = fts5
    ? { name: "FTS5", ok: true, detail: "available" }
    : {
        name: "FTS5",
        ok: false,
        detail: "unavailable",
        fix: "This SQLite build lacks FTS5, which ctxd search requires. Reinstall better-sqlite3 with FTS5 support.",
      };

  let database: Check;
  try {
    const db = openDatabase(paths.dbFile);
    const result = migrate(db);
    const mode = journalMode(db);
    const fk = foreignKeysEnabled(db);
    const schema = getSchemaVersion(db);
    db.close();

    const problems: string[] = [];
    if (mode.toLowerCase() !== "wal") problems.push(`journal_mode is ${mode}, expected wal`);
    if (!fk) problems.push("foreign keys are not enabled");
    if (schema !== TARGET_SCHEMA_VERSION) {
      problems.push(`schema version is ${schema}, expected ${TARGET_SCHEMA_VERSION}`);
    }

    database =
      problems.length === 0
        ? {
            name: "Database",
            ok: true,
            detail: `schema v${schema}, WAL, foreign keys on${
              result.applied.length > 0 ? `, migrated: ${result.applied.join(", ")}` : ""
            }`,
          }
        : {
            name: "Database",
            ok: false,
            detail: paths.dbFile,
            fix: problems.join("; "),
          };
  } catch (error) {
    database = {
      name: "Database",
      ok: false,
      detail: paths.dbFile,
      fix: `Could not open or migrate the database (${(error as Error).message}).`,
    };
  }

  return { sqlite, fts5: fts5Check, database };
}

function checkLogging(paths: CtxdPaths): Check {
  const probe = join(paths.logsDir, ".ctxd-write-probe");
  try {
    writeFileSync(probe, "");
    rmSync(probe);
    return { name: "Logging", ok: true, detail: paths.logsDir };
  } catch (error) {
    return {
      name: "Logging",
      ok: false,
      detail: paths.logsDir,
      fix: `The log directory is not writable (${(error as Error).message}).`,
    };
  }
}

/**
 * Offline capability (§66).
 *
 * Graceful degradation without AI is mandatory, so `doctor` states it rather
 * than leaving it to a README. The check reads the capability table, which
 * fails if a future change makes something depend on a model.
 */
function checkOffline(): Check {
  const report = offlineReport();
  if (!report.fullyOffline) {
    const broken = report.capabilities.filter((capability) => !capability.worksOffline);
    return {
      name: "Offline",
      ok: false,
      detail: `${broken.length} capability(ies) require an AI provider`,
      fix: "§66 requires every listed capability to work with no provider.",
    };
  }

  return {
    name: "Offline",
    ok: true,
    detail: report.providersConfigured
      ? `all ${report.capabilities.length} capabilities work without AI (providers: ${report.providers.join(", ")})`
      : `all ${report.capabilities.length} capabilities work without AI (no provider configured)`,
  };
}

function checkGit(): Check {
  const git = inspectGit();
  if (!git.available) {
    return {
      name: "Git",
      ok: false,
      detail: "not found",
      fix: "Install Git; ctxd uses it for repository state and history.",
    };
  }
  return { name: "Git", ok: true, detail: git.version ?? "available" };
}

/**
 * Run every environment check.
 *
 * Each check performs real work — no check ever reports success without
 * having actually been executed.
 */
export function runDoctor(env: NodeJS.ProcessEnv = process.env): DoctorReport {
  const paths = resolvePaths({ env });

  const node = checkNode();
  const dataDir = checkDataDir(paths);
  const config = checkConfig(paths);
  const { sqlite, fts5, database } = checkSqlite(paths);
  const logging = checkLogging(paths);
  const git = checkGit();

  const checks = [node, sqlite, fts5, dataDir, config, database, logging, git, checkOffline()];
  return { checks, ok: checks.every((check) => check.ok) };
}

export function formatDoctor(report: DoctorReport): string {
  const lines = report.checks.map((check) => formatCheck(check.ok, check.name, check.detail));
  const failures = report.checks.filter((check) => !check.ok && check.fix !== undefined);

  if (failures.length > 0) {
    lines.push("");
    for (const failure of failures) {
      lines.push(`${failure.name}: ${failure.fix ?? ""}`);
    }
  }
  return lines.join("\n");
}

export const DOCTOR_HELP = `ctxd doctor — check that the local environment is usable

Usage:
  ctxd doctor [--help]

Checks Node, SQLite, FTS5, the data directory, configuration, the database,
logging and Git. Exits non-zero if any check fails.`;

export function doctorCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${DOCTOR_HELP}\n`);
    return 0;
  }

  const report = runDoctor();
  process.stdout.write(`${formatDoctor(report)}\n`);
  return report.ok ? 0 : 1;
}
