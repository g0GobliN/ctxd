import type { Db } from "./connection.js";
import { MIGRATIONS, TARGET_SCHEMA_VERSION, type Migration } from "./schema.js";

const SCHEMA_VERSION_KEY = "schema_version";

function metaTableExists(db: Db): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
    .get();
  return row !== undefined;
}

/**
 * The schema version recorded in `meta`.
 *
 * A database with no `meta` table has never been migrated and is version 0.
 */
export function getSchemaVersion(db: Db): number {
  if (!metaTableExists(db)) return 0;
  const row = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(SCHEMA_VERSION_KEY) as { value: string } | undefined;
  if (row === undefined) return 0;
  const parsed = Number.parseInt(row.value, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function setSchemaVersion(db: Db, version: number): void {
  db.prepare(
    `INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(SCHEMA_VERSION_KEY, String(version), new Date().toISOString());
}

export interface MigrationResult {
  readonly from: number;
  readonly to: number;
  readonly applied: readonly string[];
}

export class SchemaTooNewError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      `database schema version ${found} is newer than this ctxd build supports (${supported}). ` +
        `Upgrade ctxd; the schema will not be modified.`,
    );
    this.name = "SchemaTooNewError";
  }
}

/**
 * Apply every pending migration inside a transaction.
 *
 * A database from a newer ctxd is refused rather than downgraded — the schema
 * is never silently altered.
 */
export function migrate(db: Db): MigrationResult {
  const from = getSchemaVersion(db);
  if (from > TARGET_SCHEMA_VERSION) {
    throw new SchemaTooNewError(from, TARGET_SCHEMA_VERSION);
  }

  const pending: readonly Migration[] = MIGRATIONS.filter(
    (migration) => migration.version > from,
  )
    .slice()
    .sort((a, b) => a.version - b.version);

  const applied: string[] = [];
  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      setSchemaVersion(db, migration.version);
    })();
    applied.push(migration.name);
  }

  return { from, to: getSchemaVersion(db), applied };
}

export { TARGET_SCHEMA_VERSION };
