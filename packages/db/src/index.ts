export {
  foreignKeysEnabled,
  hasFts5,
  journalMode,
  openDatabase,
  sqliteVersion,
  type Db,
  type OpenDatabaseOptions,
} from "./connection.js";

export {
  MIGRATIONS,
  TARGET_SCHEMA_VERSION,
  type Migration,
} from "./schema.js";

export {
  getSchemaVersion,
  migrate,
  SchemaTooNewError,
  type MigrationResult,
} from "./migrations.js";
