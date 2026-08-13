import type { Db } from "./connection.js";

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: (db: Db) => void;
}

/**
 * Ordered migrations. Append only — never edit a released migration, and
 * never let the schema change without a version bump.
 *
 * Phase 1 needs `meta` alone. Later phases add projects, memories, tasks,
 * files, receipts and the rest.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "meta",
    up: (db) => {
      db.exec(`
        CREATE TABLE meta (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
      `);
    },
  },
  {
    version: 2,
    name: "projects_and_files",
    up: (db) => {
      db.exec(`
        CREATE TABLE projects (
          id              TEXT PRIMARY KEY,
          root            TEXT NOT NULL UNIQUE,
          name            TEXT NOT NULL,
          vcs             TEXT,
          runtime         TEXT,
          language        TEXT,
          package_manager TEXT,
          framework       TEXT,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        ) STRICT;

        -- Indexed file metadata. Content is never stored here: the repository
        -- remains the source of truth, this only records what was seen and
        -- when, so unchanged files can be skipped on the next pass.
        CREATE TABLE files (
          project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          path        TEXT NOT NULL,
          size        INTEGER NOT NULL,
          mtime       REAL NOT NULL,
          hash        TEXT NOT NULL,
          language    TEXT,
          item_type   TEXT NOT NULL,
          indexed_at  TEXT NOT NULL,
          PRIMARY KEY (project_id, path)
        ) STRICT;

        CREATE INDEX files_project_hash ON files (project_id, hash);
      `);
    },
  },
  {
    version: 3,
    name: "memories",
    up: (db) => {
      db.exec(`
        CREATE TABLE memories (
          id               TEXT PRIMARY KEY,
          project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          type             TEXT NOT NULL,
          title            TEXT NOT NULL,
          content          TEXT NOT NULL,
          importance       TEXT NOT NULL,
          confidence       REAL NOT NULL,
          source           TEXT NOT NULL,
          status           TEXT NOT NULL,
          tags             TEXT NOT NULL,
          hash             TEXT NOT NULL,
          -- Set when the full text lives in a Markdown file rather than here.
          body_path        TEXT,
          supersedes       TEXT REFERENCES memories(id) ON DELETE SET NULL,
          created_at       TEXT NOT NULL,
          updated_at       TEXT NOT NULL,
          last_accessed_at TEXT
        ) STRICT;

        CREATE INDEX memories_project_status ON memories (project_id, status);
        CREATE INDEX memories_project_type ON memories (project_id, type);
        CREATE UNIQUE INDEX memories_project_hash ON memories (project_id, hash);

        -- External-content FTS5 index. Weighted at query time so a title match
        -- outranks a passing mention in the body.
        CREATE VIRTUAL TABLE memories_fts USING fts5(
          title,
          content,
          tags,
          content='memories',
          content_rowid='rowid',
          tokenize='porter unicode61'
        );

        CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts (rowid, title, content, tags)
          VALUES (new.rowid, new.title, new.content, new.tags);
        END;

        CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories BEGIN
          INSERT INTO memories_fts (memories_fts, rowid, title, content, tags)
          VALUES ('delete', old.rowid, old.title, old.content, old.tags);
        END;

        CREATE TRIGGER memories_fts_update AFTER UPDATE ON memories BEGIN
          INSERT INTO memories_fts (memories_fts, rowid, title, content, tags)
          VALUES ('delete', old.rowid, old.title, old.content, old.tags);
          INSERT INTO memories_fts (rowid, title, content, tags)
          VALUES (new.rowid, new.title, new.content, new.tags);
        END;
      `);
    },
  },
  {
    version: 4,
    name: "work_state",
    up: (db) => {
      db.exec(`
        CREATE TABLE tasks (
          id           TEXT PRIMARY KEY,
          project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          title        TEXT NOT NULL,
          description  TEXT NOT NULL,
          priority     TEXT NOT NULL,
          status       TEXT NOT NULL,
          -- Decomposition: a subtask points at its parent. ON DELETE SET NULL
          -- so removing a parent orphans subtasks rather than destroying them.
          parent_task  TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          worker       TEXT,
          created_at   TEXT NOT NULL,
          updated_at   TEXT NOT NULL,
          completed_at TEXT
        ) STRICT;

        CREATE INDEX tasks_project_status ON tasks (project_id, status);
        CREATE INDEX tasks_parent ON tasks (parent_task);

        CREATE TABLE sessions (
          id         TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          task_id    TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          worker     TEXT,
          branch     TEXT,
          started_at TEXT NOT NULL,
          ended_at   TEXT,
          summary    TEXT
        ) STRICT;

        CREATE INDEX sessions_project_started ON sessions (project_id, started_at DESC);

        -- What happened during a session. Append-only: the raw record is kept
        -- even after a checkpoint summarises it.
        CREATE TABLE session_events (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          kind       TEXT NOT NULL,
          detail     TEXT NOT NULL,
          created_at TEXT NOT NULL
        ) STRICT;

        CREATE INDEX session_events_session ON session_events (session_id, id);

        CREATE TABLE checkpoints (
          id            TEXT PRIMARY KEY,
          project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          task_id       TEXT REFERENCES tasks(id) ON DELETE SET NULL,
          session_id    TEXT REFERENCES sessions(id) ON DELETE SET NULL,
          objective     TEXT NOT NULL,
          completed     TEXT NOT NULL,
          remaining     TEXT NOT NULL,
          next_action   TEXT NOT NULL,
          worker        TEXT,
          branch        TEXT,
          changed_files TEXT NOT NULL,
          known_errors  TEXT NOT NULL,
          created_at    TEXT NOT NULL
        ) STRICT;

        CREATE INDEX checkpoints_project_created ON checkpoints (project_id, created_at DESC);
      `);
    },
  },
];

/** Highest migration version known to this build. */
export const TARGET_SCHEMA_VERSION: number =
  MIGRATIONS.reduce((max, migration) => Math.max(max, migration.version), 0);
