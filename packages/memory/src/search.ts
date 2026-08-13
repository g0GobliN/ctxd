import type { Priority } from "@ctxd/context";
import type { Db } from "@ctxd/db";
import type { Memory, MemoryStatus, MemoryType } from "./types.js";

/**
 * Field weights for bm25: a term in the title is a stronger signal than the
 * same term buried in the body, and a tag match sits between the two.
 */
const TITLE_WEIGHT = 10;
const CONTENT_WEIGHT = 4;
const TAGS_WEIGHT = 6;

/** Importance contributions, mirroring the context engine's priority model. */
const IMPORTANCE_BOOST: Record<Priority, number> = {
  P0: 1.0,
  P1: 0.8,
  P2: 0.6,
  P3: 0.35,
  P4: 0.1,
};

const RECENCY_HALF_LIFE_DAYS = 60;

export interface SearchOptions {
  readonly projectId?: string;
  readonly type?: MemoryType;
  readonly status?: MemoryStatus;
  readonly minImportance?: Priority;
  readonly limit?: number;
  readonly now?: number;
}

export interface SearchHit {
  readonly memory: Memory;
  /** Combined relevance: text match, importance, confidence and recency. */
  readonly score: number;
  /** Raw bm25 relevance, negated so larger is better. */
  readonly textScore: number;
  readonly snippet: string;
}

/**
 * Escape a user query for FTS5.
 *
 * Bare user input can contain FTS5 operators that either error or silently
 * change the query's meaning. Each term is quoted, so a search means what the
 * user typed. A quoted phrase in the input is preserved as a phrase.
 */
export function toMatchQuery(query: string): string {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
  const rest = query.replace(/"[^"]*"/g, " ");

  const terms = rest
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((term) => term.length > 1)
    .map((term) => `"${term.toLowerCase()}"`);

  const quoted = phrases
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase !== "")
    .map((phrase) => `"${phrase.toLowerCase()}"`);

  return [...quoted, ...terms].join(" OR ");
}

const PRIORITY_ORDER: readonly Priority[] = ["P0", "P1", "P2", "P3", "P4"];

interface SearchRow {
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
  readonly rank: number;
  readonly snippet: string;
}

/**
 * Search memories with SQLite FTS5.
 *
 * No embeddings and no vector database: FTS5 with weighted fields, filtered by
 * project, type, status and importance, then re-scored by importance,
 * confidence and recency. A low-confidence inference does not outrank an
 * explicit rule just because it repeats a search term more often.
 */
export function searchMemories(db: Db, query: string, options: SearchOptions = {}): SearchHit[] {
  const match = toMatchQuery(query);
  if (match === "") return [];

  const clauses = ["memories_fts MATCH ?"];
  const params: unknown[] = [match];

  if (options.projectId !== undefined) {
    clauses.push("m.project_id = ?");
    params.push(options.projectId);
  }
  if (options.type !== undefined) {
    clauses.push("m.type = ?");
    params.push(options.type);
  }

  // Superseded and archived memories are excluded unless asked for: stale
  // knowledge resurfacing as if current is worse than not finding it.
  clauses.push("m.status = ?");
  params.push(options.status ?? "active");

  if (options.minImportance !== undefined) {
    const allowed = PRIORITY_ORDER.slice(0, PRIORITY_ORDER.indexOf(options.minImportance) + 1);
    clauses.push(`m.importance IN (${allowed.map(() => "?").join(", ")})`);
    params.push(...allowed);
  }

  params.push(options.limit ?? 20);

  const rows = db
    .prepare(
      `SELECT m.*,
              bm25(memories_fts, ${TITLE_WEIGHT}, ${CONTENT_WEIGHT}, ${TAGS_WEIGHT}) AS rank,
              snippet(memories_fts, 1, '', '', '…', 16) AS snippet
       FROM memories_fts
       JOIN memories m ON m.rowid = memories_fts.rowid
       WHERE ${clauses.join(" AND ")}
       ORDER BY rank
       LIMIT ?`,
    )
    .all(...params) as SearchRow[];

  const now = options.now ?? Date.now();

  return rows
    .map((row) => {
      const memory: Memory = {
        id: row.id,
        projectId: row.project_id,
        type: row.type as MemoryType,
        title: row.title,
        content: row.content,
        importance: row.importance as Priority,
        confidence: row.confidence,
        source: row.source as Memory["source"],
        status: row.status as MemoryStatus,
        tags: JSON.parse(row.tags) as string[],
        hash: row.hash,
        bodyPath: row.body_path,
        supersedes: row.supersedes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastAccessedAt: row.last_accessed_at,
      };

      // bm25 returns smaller-is-better negatives; flip so larger is better.
      const textScore = -row.rank;
      const ageDays = Math.max(0, (now - Date.parse(row.updated_at)) / 86_400_000);
      const recency = 2 ** (-ageDays / RECENCY_HALF_LIFE_DAYS);

      const score =
        textScore +
        IMPORTANCE_BOOST[memory.importance] * 3 +
        memory.confidence * 2 +
        recency;

      return { memory, score, textScore, snippet: row.snippet };
    })
    .sort((a, b) => b.score - a.score || (a.memory.id < b.memory.id ? -1 : 1));
}
