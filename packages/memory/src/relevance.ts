/**
 * Surfacing memory when related files are touched (§45, §46, §47).
 *
 * A decision, a past bug or a file explanation is only worth recording if it
 * comes back at the moment it matters — which is when someone edits the code it
 * concerns. Otherwise it is an archive nobody reads, and the worker "cleans up"
 * the intentional oddity for the third time.
 *
 * Matching is deterministic and textual. No model, no embeddings: a memory is
 * relevant to a path when it names that path, its file, or its module.
 */

import type { Db } from "@ctxd/db";
import type { Memory, MemoryType } from "./types.js";

/** Memory types that describe code rather than events. */
export const CODE_MEMORY_TYPES: readonly MemoryType[] = [
  "DECISION",
  "BUG",
  "FILE",
  "CONSTRAINT",
  "RULE",
  "ARCHITECTURE",
];

export interface MemoryMatch {
  readonly memory: Memory;
  /** The changed path this memory was matched against. */
  readonly path: string;
  /** The text that matched, so the reason can be shown rather than asserted. */
  readonly matched: string;
  /** Higher is more specific: a full path beats a bare module name. */
  readonly specificity: number;
}

/**
 * Shortest token that may be matched on its own.
 *
 * Below this, matches are noise: a memory mentioning "id" or "api" would attach
 * itself to half the repository and the feature would train people to ignore it.
 */
const MIN_TOKEN = 4;

/** Directory names that identify nothing on their own. */
const GENERIC_SEGMENTS = new Set([
  "src", "lib", "app", "apps", "packages", "test", "tests", "spec", "specs",
  "dist", "build", "out", "index", "main", "utils", "util", "common", "shared",
  "types", "helpers", "internal", "public", "assets", "config",
]);

/**
 * The identifiers by which a changed file might be referred to, most specific
 * first: the full path, then progressively shorter suffixes, the bare file
 * name, the stem, and finally the module directory.
 */
export function pathAliases(path: string): { alias: string; specificity: number }[] {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/").filter((segment) => segment !== "");
  const aliases: { alias: string; specificity: number }[] = [];

  const push = (alias: string, specificity: number): void => {
    if (alias.length < MIN_TOKEN) return;
    if (aliases.some((entry) => entry.alias === alias)) return;
    aliases.push({ alias, specificity });
  };

  push(normalized, 100);

  // Path suffixes: "payment/idempotency.ts" matches a memory that referred to
  // the file without the full prefix.
  for (let i = 1; i < segments.length; i += 1) {
    const suffix = segments.slice(i).join("/");
    push(suffix, 90 - i);
  }

  const fileName = segments[segments.length - 1];
  if (fileName !== undefined) {
    push(fileName, 60);
    const stem = fileName.replace(/\.[^.]+$/, "");
    if (!GENERIC_SEGMENTS.has(stem.toLowerCase())) push(stem, 50);
  }

  // The module directory — "src/payment" — so a decision about a subsystem
  // surfaces for any file inside it.
  if (segments.length >= 2) {
    const directory = segments.slice(0, -1).join("/");
    push(directory, 40);

    const moduleName = segments[segments.length - 2];
    if (moduleName !== undefined && !GENERIC_SEGMENTS.has(moduleName.toLowerCase())) {
      push(moduleName, 30);
    }
  }

  return aliases;
}

/**
 * Does `haystack` contain `alias` as a standalone token?
 *
 * A substring test would match "payment" inside "prepayments"; requiring a
 * non-identifier character on each side keeps the match honest.
 */
function mentions(haystack: string, alias: string): boolean {
  const index = haystack.indexOf(alias);
  if (index === -1) return false;

  const before = index === 0 ? "" : haystack[index - 1];
  const afterIndex = index + alias.length;
  const after = afterIndex >= haystack.length ? "" : haystack[afterIndex];

  const boundary = (char: string | undefined): boolean =>
    char === undefined || char === "" || !/[A-Za-z0-9_-]/.test(char);

  // A path alias may legitimately be followed by "/" or preceded by one.
  return boundary(before) && boundary(after);
}

export interface RelevanceOptions {
  /** Restrict to these memory types. Defaults to the code-describing set. */
  readonly types?: readonly MemoryType[];
  /** Maximum matches returned. */
  readonly limit?: number;
  /** Include archived and superseded memories. Off by default. */
  readonly includeInactive?: boolean;
}

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
    type: row.type as Memory["type"],
    title: row.title,
    content: row.content,
    importance: row.importance as Memory["importance"],
    confidence: row.confidence,
    source: row.source as Memory["source"],
    status: row.status as Memory["status"],
    tags: JSON.parse(row.tags) as string[],
    hash: row.hash,
    bodyPath: row.body_path,
    supersedes: row.supersedes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

/**
 * Find the memories that concern the given files.
 *
 * Returns one match per memory — the most specific path it matched — sorted by
 * specificity then importance, so the decision about *this file* comes before
 * the constraint about the whole module.
 */
export function memoriesForPaths(
  db: Db,
  projectId: string,
  paths: readonly string[],
  options: RelevanceOptions = {},
): MemoryMatch[] {
  if (paths.length === 0) return [];

  const types = options.types ?? CODE_MEMORY_TYPES;
  if (types.length === 0) return [];

  const placeholders = types.map(() => "?").join(", ");
  const statusClause = options.includeInactive === true ? "" : " AND status = 'active'";

  const rows = db
    .prepare(
      `SELECT * FROM memories
       WHERE project_id = ? AND type IN (${placeholders})${statusClause}
       ORDER BY importance ASC, updated_at DESC`,
    )
    .all(projectId, ...types) as MemoryRow[];

  const matches = new Map<string, MemoryMatch>();

  for (const row of rows) {
    // Tags are searched too: attaching a path as a tag is the explicit way to
    // bind a memory to a file (§47).
    const haystack = `${row.title}\n${row.content}\n${row.tags}`
      .replace(/\\/g, "/")
      .toLowerCase();

    for (const path of paths) {
      for (const { alias, specificity } of pathAliases(path)) {
        if (!mentions(haystack, alias.toLowerCase())) continue;

        const existing = matches.get(row.id);
        if (existing === undefined || specificity > existing.specificity) {
          matches.set(row.id, { memory: toMemory(row), path, matched: alias, specificity });
        }
        break;
      }
    }
  }

  const ordered = [...matches.values()].sort(
    (a, b) =>
      b.specificity - a.specificity ||
      a.memory.importance.localeCompare(b.memory.importance) ||
      a.memory.title.localeCompare(b.memory.title),
  );

  return options.limit === undefined ? ordered : ordered.slice(0, options.limit);
}

/**
 * Render matches as a warning block for a change review.
 *
 * The wording matters: this is a prompt to check, never an accusation. The
 * point of §47 is to stop a worker deleting deliberate code, and the way to do
 * that is to show the reasoning, not to block the edit.
 */
export function formatMemoryMatches(matches: readonly MemoryMatch[]): string {
  if (matches.length === 0) return "";

  const lines: string[] = ["RELEVANT PROJECT MEMORY", ""];
  const label: Partial<Record<MemoryType, string>> = {
    DECISION: "Decision",
    BUG: "Previous bug",
    FILE: "File note",
    CONSTRAINT: "Constraint",
    RULE: "Rule",
    ARCHITECTURE: "Architecture",
  };

  for (const match of matches) {
    lines.push(
      `${label[match.memory.type] ?? match.memory.type}: ${match.memory.title}`,
      `  applies to: ${match.path} (matched "${match.matched}")`,
      `  source: ${match.memory.source} · importance ${match.memory.importance}`,
    );

    const body = match.memory.content.trim().split("\n").slice(0, 6);
    for (const line of body) lines.push(`  ${line}`);
    lines.push("");
  }

  lines.push("These are recorded decisions, not obstacles — but do not remove the");
  lines.push("code they describe without reading them first.");
  return lines.join("\n");
}
