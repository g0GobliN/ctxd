import { createHash, randomUUID } from "node:crypto";
import type { Priority } from "@ctxd/context";
import type { Db } from "@ctxd/db";
import { canOverride, defaultConfidence } from "./authority.js";
import type { Memory, MemorySource, MemoryStatus, MemoryType } from "./types.js";

interface MemoryRow {
  readonly id: string;
  readonly project_id: string;
  readonly type: string;
  readonly title: string;
  readonly content: string;
  readonly importance: string;
  readonly confidence: number;
  readonly source: string;
  readonly status: string;
  readonly tags: string;
  readonly hash: string;
  readonly body_path: string | null;
  readonly supersedes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly last_accessed_at: string | null;
}

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as MemoryType,
    title: row.title,
    content: row.content,
    importance: row.importance as Priority,
    confidence: row.confidence,
    source: row.source as MemorySource,
    status: row.status as MemoryStatus,
    tags: JSON.parse(row.tags) as string[],
    hash: row.hash,
    bodyPath: row.body_path,
    supersedes: row.supersedes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

/** Identity of a memory's substance, used to detect a re-save of the same fact. */
export function memoryHash(type: MemoryType, title: string, content: string): string {
  return createHash("sha256")
    .update(`${type}\n${title.trim()}\n${content.trim()}`)
    .digest("hex");
}

export interface SaveMemoryInput {
  readonly projectId: string;
  readonly type: MemoryType;
  readonly title: string;
  readonly content: string;
  readonly source: MemorySource;
  readonly importance?: Priority;
  readonly confidence?: number;
  readonly tags?: readonly string[];
  readonly bodyPath?: string | null;
  readonly supersedes?: string | null;
  readonly id?: string;
}

export type SaveOutcome =
  | { readonly kind: "created"; readonly memory: Memory }
  | { readonly kind: "unchanged"; readonly memory: Memory }
  | { readonly kind: "superseded"; readonly memory: Memory; readonly previous: Memory }
  | { readonly kind: "rejected"; readonly existing: Memory; readonly reason: string };

/** Importance implied by a memory's type when none is given. */
function defaultImportance(type: MemoryType, source: MemorySource): Priority {
  if (source === "explicit_user" || source === "project_rule") return "P0";
  switch (type) {
    case "RULE":
    case "CONSTRAINT":
      return "P0";
    case "DECISION":
    case "ARCHITECTURE":
      return "P1";
    case "BUG":
    case "TASK":
    case "FACT":
      return "P2";
    case "SESSION":
    case "CONVERSATION":
    case "SNAPSHOT":
      return "P4";
    default:
      return "P3";
  }
}

/**
 * Save a memory.
 *
 * Re-saving identical substance is a no-op rather than a duplicate row. A
 * memory that conflicts with a more authoritative one is **rejected and
 * reported**, never written over the top: an inference must not quietly
 * replace something the developer stated.
 */
export function saveMemory(db: Db, input: SaveMemoryInput, now = new Date()): SaveOutcome {
  const timestamp = now.toISOString();
  const hash = memoryHash(input.type, input.title, input.content);

  const duplicate = db
    .prepare("SELECT * FROM memories WHERE project_id = ? AND hash = ?")
    .get(input.projectId, hash) as MemoryRow | undefined;
  if (duplicate !== undefined) {
    return { kind: "unchanged", memory: toMemory(duplicate) };
  }

  const memory: Memory = {
    id: input.id ?? randomUUID(),
    projectId: input.projectId,
    type: input.type,
    title: input.title,
    content: input.content,
    importance: input.importance ?? defaultImportance(input.type, input.source),
    confidence: input.confidence ?? defaultConfidence(input.source),
    source: input.source,
    status: "active",
    tags: input.tags ?? [],
    hash,
    bodyPath: input.bodyPath ?? null,
    supersedes: input.supersedes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastAccessedAt: null,
  };

  // A memory with the same title and type is the same claim restated.
  const existingRow = db
    .prepare(
      "SELECT * FROM memories WHERE project_id = ? AND type = ? AND title = ? AND status = 'active'",
    )
    .get(input.projectId, input.type, input.title) as MemoryRow | undefined;

  if (existingRow !== undefined) {
    const existing = toMemory(existingRow);
    const decision = canOverride(memory, existing);
    if (!decision.allowed) {
      return { kind: "rejected", existing, reason: decision.reason };
    }

    db.transaction(() => {
      insert(db, { ...memory, supersedes: existing.id });
      db.prepare("UPDATE memories SET status = 'superseded', updated_at = ? WHERE id = ?").run(
        timestamp,
        existing.id,
      );
    })();

    return {
      kind: "superseded",
      memory: { ...memory, supersedes: existing.id },
      previous: existing,
    };
  }

  insert(db, memory);
  return { kind: "created", memory };
}

function insert(db: Db, memory: Memory): void {
  db.prepare(
    `INSERT INTO memories
       (id, project_id, type, title, content, importance, confidence, source, status,
        tags, hash, body_path, supersedes, created_at, updated_at, last_accessed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    memory.id,
    memory.projectId,
    memory.type,
    memory.title,
    memory.content,
    memory.importance,
    memory.confidence,
    memory.source,
    memory.status,
    JSON.stringify(memory.tags),
    memory.hash,
    memory.bodyPath,
    memory.supersedes,
    memory.createdAt,
    memory.updatedAt,
    memory.lastAccessedAt,
  );
}

export function getMemory(db: Db, id: string): Memory | undefined {
  const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(id) as MemoryRow | undefined;
  return row === undefined ? undefined : toMemory(row);
}

export interface ListMemoriesOptions {
  readonly type?: MemoryType;
  readonly status?: MemoryStatus;
  readonly importance?: Priority;
  readonly limit?: number;
}

export function listMemories(
  db: Db,
  projectId: string,
  options: ListMemoriesOptions = {},
): Memory[] {
  const clauses = ["project_id = ?"];
  const params: unknown[] = [projectId];

  if (options.type !== undefined) {
    clauses.push("type = ?");
    params.push(options.type);
  }
  if (options.status !== undefined) {
    clauses.push("status = ?");
    params.push(options.status);
  }
  if (options.importance !== undefined) {
    clauses.push("importance = ?");
    params.push(options.importance);
  }
  params.push(options.limit ?? 100);

  const rows = db
    .prepare(
      `SELECT * FROM memories WHERE ${clauses.join(" AND ")}
       ORDER BY importance ASC, updated_at DESC LIMIT ?`,
    )
    .all(...params) as MemoryRow[];

  return rows.map(toMemory);
}

export interface MemoryCounts {
  readonly total: number;
  /** Live memories by type. Types with none are absent rather than zero. */
  readonly byType: Readonly<Record<string, number>>;
}

/**
 * How much this project actually remembers.
 *
 * Counted in SQLite rather than by measuring a listing: every listing is capped,
 * so counting one would report the cap as the total once a project outgrew it —
 * a number that looks precise and stops being true exactly when it matters.
 *
 * Archived memories are excluded. They were superseded, and reporting them as
 * things ctxd knows would overstate what it would actually retrieve.
 */
export function countMemories(db: Db, projectId: string): MemoryCounts {
  const rows = db
    .prepare(
      `SELECT type, COUNT(*) AS n FROM memories
       WHERE project_id = ? AND status != 'archived'
       GROUP BY type`,
    )
    .all(projectId) as { type: string; n: number }[];

  const byType: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byType[row.type] = row.n;
    total += row.n;
  }

  return { total, byType };
}

/** Record that a memory was used, which later phases rank on. */
export function touchMemory(db: Db, id: string, now = new Date()): void {
  db.prepare("UPDATE memories SET last_accessed_at = ? WHERE id = ?").run(now.toISOString(), id);
}

export function archiveMemory(db: Db, id: string, now = new Date()): boolean {
  const result = db
    .prepare("UPDATE memories SET status = 'archived', updated_at = ? WHERE id = ?")
    .run(now.toISOString(), id);
  return result.changes === 1;
}
