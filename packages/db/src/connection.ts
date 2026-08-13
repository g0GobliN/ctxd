import Database from "better-sqlite3";

export type Db = Database.Database;

export interface OpenDatabaseOptions {
  /** Open without creating the file; used by read-only status checks. */
  readonly readonly?: boolean;
  readonly fileMustExist?: boolean;
}

/**
 * Open a ctxd database with the pragmas the specification requires.
 *
 * WAL keeps readers from blocking the CLI while a worker writes, and foreign
 * keys are enforced rather than advisory.
 */
export function openDatabase(path: string, options: OpenDatabaseOptions = {}): Db {
  const db = new Database(path, {
    readonly: options.readonly ?? false,
    fileMustExist: options.fileMustExist ?? false,
  });

  if (!options.readonly) {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("foreign_keys = ON");
  return db;
}

/** The journal mode actually in force, e.g. `wal`. */
export function journalMode(db: Db): string {
  const rows = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
  return rows[0]?.journal_mode ?? "unknown";
}

/** True when foreign key enforcement is actually on. */
export function foreignKeysEnabled(db: Db): boolean {
  const rows = db.pragma("foreign_keys") as Array<{ foreign_keys: number }>;
  return rows[0]?.foreign_keys === 1;
}

/**
 * Probe FTS5 by creating a temporary virtual table.
 *
 * Checking the compile options is not enough — this proves the module can
 * actually be used, which is what later phases depend on.
 */
export function hasFts5(db: Db): boolean {
  try {
    db.exec("CREATE VIRTUAL TABLE temp.__ctxd_fts5_probe USING fts5(content)");
    db.exec("DROP TABLE temp.__ctxd_fts5_probe");
    return true;
  } catch {
    return false;
  }
}

/** The SQLite library version, e.g. `3.45.1`. */
export function sqliteVersion(db: Db): string {
  const row = db.prepare("SELECT sqlite_version() AS version").get() as
    | { version: string }
    | undefined;
  return row?.version ?? "unknown";
}
