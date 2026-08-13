import { strict as assert } from "node:assert";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  foreignKeysEnabled,
  getSchemaVersion,
  hasFts5,
  journalMode,
  migrate,
  MIGRATIONS,
  openDatabase,
  SchemaTooNewError,
  sqliteVersion,
  TARGET_SCHEMA_VERSION,
} from "@ctxd/db";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

function freshDb(name: string) {
  return openDatabase(join(home.dir, `${name}.db`));
}

describe("openDatabase", () => {
  it("enables WAL and foreign keys", () => {
    const db = freshDb("pragmas");
    assert.equal(journalMode(db).toLowerCase(), "wal");
    assert.equal(foreignKeysEnabled(db), true);
    db.close();
  });

  it("reports a SQLite version", () => {
    const db = freshDb("version");
    assert.match(sqliteVersion(db), /^\d+\.\d+/);
    db.close();
  });
});

describe("FTS5", () => {
  it("is available and actually usable", () => {
    const db = freshDb("fts5");
    assert.equal(hasFts5(db), true);

    db.exec("CREATE VIRTUAL TABLE docs USING fts5(body)");
    db.prepare("INSERT INTO docs (body) VALUES (?)").run("stripe webhook idempotency");
    const row = db
      .prepare("SELECT body FROM docs WHERE docs MATCH ?")
      .get("idempotency") as { body: string } | undefined;

    assert.equal(row?.body, "stripe webhook idempotency");
    db.close();
  });

  it("leaves no probe table behind", () => {
    const db = freshDb("probe");
    hasFts5(db);
    const leftover = db
      .prepare("SELECT name FROM temp.sqlite_master WHERE name LIKE '__ctxd%'")
      .all();
    assert.deepEqual(leftover, []);
    db.close();
  });
});

describe("migrate", () => {
  it("takes a new database to the target version", () => {
    const db = freshDb("migrate-new");
    assert.equal(getSchemaVersion(db), 0);

    const result = migrate(db);
    assert.equal(result.from, 0);
    assert.equal(result.to, TARGET_SCHEMA_VERSION);
    // A fresh database applies every migration, whatever they are today.
    assert.deepEqual(result.applied, MIGRATIONS.map((migration) => migration.name));
    assert.equal(getSchemaVersion(db), TARGET_SCHEMA_VERSION);
    db.close();
  });

  it("is idempotent", () => {
    const db = freshDb("migrate-twice");
    migrate(db);
    const second = migrate(db);

    assert.deepEqual(second.applied, []);
    assert.equal(second.from, TARGET_SCHEMA_VERSION);
    assert.equal(second.to, TARGET_SCHEMA_VERSION);
    db.close();
  });

  it("creates a meta table that records the schema version", () => {
    const db = freshDb("migrate-meta");
    migrate(db);

    const row = db.prepare("SELECT value, updated_at FROM meta WHERE key = ?").get(
      "schema_version",
    ) as { value: string; updated_at: string } | undefined;

    assert.equal(row?.value, String(TARGET_SCHEMA_VERSION));
    assert.equal(Number.isNaN(Date.parse(row?.updated_at ?? "")), false);
    db.close();
  });

  it("refuses to touch a database from a newer ctxd", () => {
    const db = freshDb("migrate-newer");
    migrate(db);
    db.prepare("UPDATE meta SET value = ? WHERE key = ?").run("999", "schema_version");

    assert.throws(() => migrate(db), SchemaTooNewError);
    // The schema must be left exactly as it was found.
    assert.equal(getSchemaVersion(db), 999);
    db.close();
  });
});
