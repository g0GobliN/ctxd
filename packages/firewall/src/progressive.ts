import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  compileIgnoreRules,
  DEFAULT_IGNORE_PATTERNS,
  estimateTokens,
  isIgnored,
  readIgnoreFile,
  type IgnoreRule,
} from "@ctxd/context";
import type { Db } from "@ctxd/db";
import { getMemory, listMemories, searchMemories, touchMemory } from "@ctxd/memory";
import { inspectGit, type GitCommit } from "@ctxd/project";
import { isSubPath } from "@ctxd/utils";

/**
 * Progressive context retrieval.
 *
 * The initial context is deliberately small. Rather than sending everything a
 * worker might conceivably need, ctxd answers follow-up questions: search
 * first, then fetch only what the results justify. This is the second
 * protection layer — a minimum initial context plus controlled expansion.
 *
 * Search returns summaries, never full documents. Retrieving the body is a
 * separate, deliberate call.
 */

export interface SearchResultSummary {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly importance: string;
  readonly source: string;
  readonly confidence: number;
  readonly snippet: string;
  /** What fetching this item in full would cost. */
  readonly estimatedTokens: number;
}

/** Search project knowledge. Returns summaries only. */
export function contextSearch(
  db: Db,
  projectId: string,
  query: string,
  limit = 10,
): SearchResultSummary[] {
  return searchMemories(db, query, { projectId, limit }).map((hit) => ({
    id: hit.memory.id,
    title: hit.memory.title,
    type: hit.memory.type,
    importance: hit.memory.importance,
    source: hit.memory.source,
    confidence: hit.memory.confidence,
    snippet: hit.snippet.replace(/\s+/g, " ").trim(),
    estimatedTokens: estimateTokens(hit.memory.content),
  }));
}

export interface MemoryBody {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly content: string;
  readonly source: string;
  readonly confidence: number;
  readonly estimatedTokens: number;
}

/** Fetch one memory in full, recording that it was used. */
export function contextGet(db: Db, id: string): MemoryBody | undefined {
  const memory = getMemory(db, id);
  if (memory === undefined) return undefined;

  touchMemory(db, id);
  return {
    id: memory.id,
    title: memory.title,
    type: memory.type,
    content: memory.content,
    source: memory.source,
    confidence: memory.confidence,
    estimatedTokens: estimateTokens(memory.content),
  };
}

/** Decisions relevant to a query, so a worker can check before changing course. */
export function contextDecision(
  db: Db,
  projectId: string,
  query?: string,
  limit = 10,
): SearchResultSummary[] {
  if (query === undefined || query.trim() === "") {
    return listMemories(db, projectId, { type: "DECISION", status: "active", limit }).map(
      (memory) => ({
        id: memory.id,
        title: memory.title,
        type: memory.type,
        importance: memory.importance,
        source: memory.source,
        confidence: memory.confidence,
        snippet: memory.content.slice(0, 160).replace(/\s+/g, " ").trim(),
        estimatedTokens: estimateTokens(memory.content),
      }),
    );
  }

  return searchMemories(db, query, { projectId, type: "DECISION", limit }).map((hit) => ({
    id: hit.memory.id,
    title: hit.memory.title,
    type: hit.memory.type,
    importance: hit.memory.importance,
    source: hit.memory.source,
    confidence: hit.memory.confidence,
    snippet: hit.snippet.replace(/\s+/g, " ").trim(),
    estimatedTokens: estimateTokens(hit.memory.content),
  }));
}

export interface FileSlice {
  readonly path: string;
  readonly content: string;
  readonly fromLine: number;
  readonly toLine: number;
  readonly totalLines: number;
  readonly estimatedTokens: number;
}

export class PathEscapesProjectError extends Error {
  constructor(readonly requested: string) {
    super(`refusing to read ${requested}: outside the project root`);
    this.name = "PathEscapesProjectError";
  }
}

/**
 * A worker asked for a file ctxd refuses to read to anyone.
 *
 * Separate from `PathEscapesProjectError` because the path is legitimate — it
 * is the *contents* that must never reach a model.
 */
export class SecretFileError extends Error {
  constructor(readonly requested: string) {
    super(`refusing to read ${requested}: it matches a secret or ignored pattern`);
    this.name = "SecretFileError";
  }
}

/**
 * Ignore rules for a project root, compiled once per root.
 *
 * Progressive retrieval has to apply exactly the rules collection applies.
 * Confinement alone is not enough: `.env` is inside the project root, so a
 * containment check happily admits it.
 */
const ignoreCache = new Map<string, IgnoreRule[]>();

function rulesFor(root: string): IgnoreRule[] {
  const cached = ignoreCache.get(root);
  if (cached !== undefined) return cached;

  const rules = [
    ...compileIgnoreRules(DEFAULT_IGNORE_PATTERNS, "default"),
    ...readIgnoreFile(join(root, ".gitignore")),
    ...readIgnoreFile(join(root, ".ctxdignore")),
  ];
  ignoreCache.set(root, rules);
  return rules;
}

/**
 * Would collection have refused this file?
 *
 * The check runs on the path *relative to the root*, matching how the walker
 * evaluates it, and on every parent segment — a file inside `secrets/` is
 * refused even though its own name looks innocent.
 */
export function isRefusedPath(root: string, absolute: string): boolean {
  const relativePath = relative(root, absolute).split(sep).join("/");
  if (relativePath === "" || relativePath.startsWith("..")) return true;
  return isIgnored(relativePath, rulesFor(root), false);
}

export interface FileOptions {
  readonly fromLine?: number;
  readonly toLine?: number;
  readonly maxBytes?: number;
}

/**
 * Read one file, optionally a line range.
 *
 * The path is confined to the project root. A worker asking for
 * `../../.ssh/id_rsa` gets a refusal, not a key — progressive retrieval must
 * not become an arbitrary file-read primitive.
 */
export function contextFile(
  root: string,
  requestedPath: string,
  options: FileOptions = {},
): FileSlice | undefined {
  const absolute = isAbsolute(requestedPath)
    ? resolve(requestedPath)
    : resolve(join(root, requestedPath));

  if (!isSubPath(root, absolute)) {
    throw new PathEscapesProjectError(requestedPath);
  }

  // Confinement is not enough. `.env`, `id_rsa` and everything under
  // `secrets/` live *inside* the project root, so a containment check admits
  // them. Progressive retrieval is the one path a worker drives directly, and
  // it must refuse exactly what collection refuses — otherwise "ctxd never
  // sends secrets to workers" is true of the pipeline and false of the tool.
  if (isRefusedPath(root, absolute)) {
    throw new SecretFileError(requestedPath);
  }

  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return undefined;
  }
  if (!stats.isFile()) return undefined;

  const maxBytes = options.maxBytes ?? 512 * 1024;
  if (stats.size > maxBytes) return undefined;

  const lines = readFileSync(absolute, "utf8").split("\n");
  const fromLine = Math.max(1, options.fromLine ?? 1);
  const toLine = Math.min(lines.length, options.toLine ?? lines.length);
  const content = lines.slice(fromLine - 1, toLine).join("\n");

  return {
    path: requestedPath,
    content,
    fromLine,
    toLine,
    totalLines: lines.length,
    estimatedTokens: estimateTokens(content),
  };
}

/** Recent commits. Git stays the source of truth; this only reads it. */
export function contextHistory(root: string, limit = 10): readonly GitCommit[] {
  return inspectGit(root, limit).recentCommits ?? [];
}
