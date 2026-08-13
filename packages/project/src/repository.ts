import { collectCandidates, type CollectOptions } from "@ctxd/context";
import type { Db } from "@ctxd/db";
import type { DetectedProject } from "./detect.js";

export interface ProjectRow {
  readonly id: string;
  readonly root: string;
  readonly name: string;
  readonly vcs: string | null;
  readonly runtime: string | null;
  readonly language: string | null;
  readonly package_manager: string | null;
  readonly framework: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Insert or update a project row.
 *
 * `created_at` is preserved across re-runs: `ctxd init` on an existing project
 * refreshes what was detected without pretending the project is new.
 */
export function upsertProject(db: Db, project: DetectedProject, now = new Date()): ProjectRow {
  const timestamp = now.toISOString();

  // A directory can be registered before it becomes a Git repository, and
  // identity anchors to the root commit once one exists — so re-registering
  // the same directory can arrive with a different id. `root` is UNIQUE, so
  // inserting would fail with a raw constraint error.
  //
  // The established row wins. Its id is what project memory, tasks and
  // sessions already point at, and forking the project or crashing would both
  // be worse than keeping the identity the data is attached to.
  const established = findProjectByRoot(db, project.root);
  if (established !== undefined && established.id !== project.id) {
    db.prepare(
      `UPDATE projects SET
         name            = ?,
         vcs             = ?,
         runtime         = ?,
         language        = ?,
         package_manager = ?,
         framework       = ?,
         updated_at      = ?
       WHERE id = ?`,
    ).run(
      project.name,
      project.vcs,
      project.runtime,
      project.language,
      project.packageManager,
      project.framework,
      timestamp,
      established.id,
    );
    return getProject(db, established.id) as ProjectRow;
  }

  db.prepare(
    `INSERT INTO projects
       (id, root, name, vcs, runtime, language, package_manager, framework, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       root            = excluded.root,
       name            = excluded.name,
       vcs             = excluded.vcs,
       runtime         = excluded.runtime,
       language        = excluded.language,
       package_manager = excluded.package_manager,
       framework       = excluded.framework,
       updated_at      = excluded.updated_at`,
  ).run(
    project.id,
    project.root,
    project.name,
    project.vcs,
    project.runtime,
    project.language,
    project.packageManager,
    project.framework,
    timestamp,
    timestamp,
  );

  return getProject(db, project.id) as ProjectRow;
}

export function getProject(db: Db, id: string): ProjectRow | undefined {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
}

export function findProjectByRoot(db: Db, root: string): ProjectRow | undefined {
  return db.prepare("SELECT * FROM projects WHERE root = ?").get(root) as ProjectRow | undefined;
}

export function listProjects(db: Db): ProjectRow[] {
  return db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as ProjectRow[];
}

interface FileRow {
  readonly path: string;
  readonly size: number;
  readonly mtime: number;
  readonly hash: string;
}

export interface IndexResult {
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly removed: number;
  readonly total: number;
}

/**
 * Index a project's files incrementally.
 *
 * Only files whose size, mtime or hash changed are rewritten; everything else
 * is left alone. Deleted files are removed from the index so it never claims
 * something exists that does not.
 *
 * Content is deliberately not stored — the repository is the source of truth.
 * Indexing records only what was seen, so the next pass can skip it.
 *
 * Nothing here contacts a worker: a changed file is a fact to record, not a
 * reason to send anything to a model.
 */
export function indexProjectFiles(
  db: Db,
  projectId: string,
  root: string,
  options: CollectOptions = {},
  now = new Date(),
): IndexResult {
  const timestamp = now.toISOString();
  const collected = collectCandidates(root, options);

  const existing = new Map<string, FileRow>();
  for (const row of db
    .prepare("SELECT path, size, mtime, hash FROM files WHERE project_id = ?")
    .all(projectId) as FileRow[]) {
    existing.set(row.path, row);
  }

  const upsert = db.prepare(
    `INSERT INTO files (project_id, path, size, mtime, hash, language, item_type, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       size       = excluded.size,
       mtime      = excluded.mtime,
       hash       = excluded.hash,
       language   = excluded.language,
       item_type  = excluded.item_type,
       indexed_at = excluded.indexed_at`,
  );
  const remove = db.prepare("DELETE FROM files WHERE project_id = ? AND path = ?");

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  const seen = new Set<string>();

  db.transaction(() => {
    for (const item of collected.items) {
      seen.add(item.path);
      const size = Buffer.byteLength(item.content, "utf8");
      const previous = existing.get(item.path);

      if (previous !== undefined && previous.hash === item.hash && previous.size === size) {
        unchanged += 1;
        continue;
      }

      upsert.run(
        projectId,
        item.path,
        size,
        item.mtime,
        item.hash,
        languageOf(item.path),
        item.type,
        timestamp,
      );
      if (previous === undefined) added += 1;
      else updated += 1;
    }

    for (const path of existing.keys()) {
      if (!seen.has(path)) remove.run(projectId, path);
    }
  })();

  return {
    added,
    updated,
    unchanged,
    removed: [...existing.keys()].filter((path) => !seen.has(path)).length,
    total: collected.items.length,
  };
}

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  rb: "ruby",
  php: "php",
  cs: "csharp",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  swift: "swift",
  scala: "scala",
  sql: "sql",
  sh: "shell",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
};

export function languageOf(path: string): string | null {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  return LANGUAGE_BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? null;
}
