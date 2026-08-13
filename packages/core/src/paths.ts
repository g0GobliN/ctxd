import { mkdirSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expandTilde } from "@ctxd/utils";

/** Environment variable that relocates the whole ctxd data directory. */
export const DATA_DIR_ENV = "CTXD_HOME";

export const DEFAULT_STORAGE_DIRECTORY = "~/.ctxd";

/** Sub-directories of the data directory, created on demand. */
export const DATA_SUBDIRECTORIES = [
  "projects",
  "archive",
  "snapshots",
  "context_receipts",
  "change_receipts",
  "logs",
  "cache",
  "exports",
] as const;

export interface CtxdPaths {
  readonly dataDir: string;
  readonly configFile: string;
  readonly dbFile: string;
  readonly projectsDir: string;
  readonly archiveDir: string;
  readonly snapshotsDir: string;
  readonly contextReceiptsDir: string;
  readonly changeReceiptsDir: string;
  readonly logsDir: string;
  readonly cacheDir: string;
  readonly exportsDir: string;
}

export interface ResolvePathsOptions {
  /** Storage directory from configuration; may start with `~`. */
  readonly directory?: string | undefined;
  readonly env?: NodeJS.ProcessEnv;
  readonly home?: string;
}

/**
 * Resolve every ctxd path from a storage directory.
 *
 * Precedence: `CTXD_HOME` (used by tests so they never touch the real
 * `~/.ctxd`) > configured directory > `~/.ctxd`.
 */
export function resolvePaths(options: ResolvePathsOptions = {}): CtxdPaths {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const configured =
    env[DATA_DIR_ENV] ?? options.directory ?? DEFAULT_STORAGE_DIRECTORY;
  const dataDir = resolve(expandTilde(configured, home));

  return {
    dataDir,
    configFile: join(dataDir, "config.json"),
    dbFile: join(dataDir, "ctxd.db"),
    projectsDir: join(dataDir, "projects"),
    archiveDir: join(dataDir, "archive"),
    snapshotsDir: join(dataDir, "snapshots"),
    contextReceiptsDir: join(dataDir, "context_receipts"),
    changeReceiptsDir: join(dataDir, "change_receipts"),
    logsDir: join(dataDir, "logs"),
    cacheDir: join(dataDir, "cache"),
    exportsDir: join(dataDir, "exports"),
  };
}

/**
 * Create the data directory and its sub-directories if they are missing.
 * Safe to call repeatedly; existing directories are left untouched.
 */
export function ensureDataDir(paths: CtxdPaths): void {
  mkdirSync(paths.dataDir, { recursive: true, mode: 0o700 });
  for (const name of DATA_SUBDIRECTORIES) {
    mkdirSync(join(paths.dataDir, name), { recursive: true, mode: 0o700 });
  }
}

/** True when the directory exists and the process may write to it. */
export function isWritableDir(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
