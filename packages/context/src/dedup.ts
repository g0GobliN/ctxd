import { PRIORITIES, type ContextItem, type Priority } from "./types.js";

export const NEAR_DUPLICATE_THRESHOLD = 0.9;

const SHINGLE_SIZE = 5;

/** Collapse whitespace and case so formatting differences do not hide a copy. */
export function normalizeForComparison(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic 32-bit hash (FNV-1a) — stable across runs and platforms. */
function hashShingle(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Word-level shingles, the signature used for near-duplicate comparison. */
export function shingles(content: string, size: number = SHINGLE_SIZE): Set<number> {
  const words = normalizeForComparison(content).split(" ").filter((word) => word !== "");
  const result = new Set<number>();

  if (words.length === 0) return result;
  if (words.length <= size) {
    result.add(hashShingle(words.join(" ")));
    return result;
  }

  for (let i = 0; i + size <= words.length; i += 1) {
    result.add(hashShingle(words.slice(i, i + size).join(" ")));
  }
  return result;
}

/** Jaccard similarity of two shingle sets, in [0, 1]. */
export function similarity(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const value of small) {
    if (large.has(value)) intersection += 1;
  }

  return intersection / (a.size + b.size - intersection);
}

function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}

/**
 * Decide which of two equivalent items to keep.
 *
 * Order: explicit priority, then recency, then source quality (a real source
 * file beats a document describing it), then path for a stable tie-break.
 */
export function strongerItem(a: ContextItem, b: ContextItem): ContextItem {
  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority < 0 ? a : b;

  if (a.mtime !== b.mtime) return a.mtime > b.mtime ? a : b;

  const quality = (item: ContextItem): number => (item.type === "source" ? 1 : 0);
  const byQuality = quality(b) - quality(a);
  if (byQuality !== 0) return byQuality < 0 ? a : b;

  return a.path <= b.path ? a : b;
}

export interface DuplicateRecord {
  readonly path: string;
  readonly duplicateOf: string;
  readonly kind: "exact" | "near";
  readonly similarity: number;
  readonly tokenCount: number;
}

export interface DedupResult {
  readonly kept: readonly ContextItem[];
  readonly duplicates: readonly DuplicateRecord[];
  /** Estimated tokens excluded because they were redundant. */
  readonly removedTokens: number;
}

/**
 * Remove exact and near-duplicate representations.
 *
 * Nothing is deleted from disk — a duplicate is merely excluded from *this*
 * context, and the removal is recorded so the receipt can explain it.
 */
export function deduplicate(
  items: readonly ContextItem[],
  threshold: number = NEAR_DUPLICATE_THRESHOLD,
): DedupResult {
  const kept: ContextItem[] = [];
  const signatures: Set<number>[] = [];
  const duplicates: DuplicateRecord[] = [];
  const byHash = new Map<string, number>();
  let removedTokens = 0;

  for (const item of items) {
    const exactIndex = byHash.get(item.hash);
    if (exactIndex !== undefined) {
      const incumbent = kept[exactIndex] as ContextItem;
      const winner = strongerItem(incumbent, item);
      const loser = winner === incumbent ? item : incumbent;

      kept[exactIndex] = winner;
      byHash.set(item.hash, exactIndex);
      duplicates.push({
        path: loser.path,
        duplicateOf: winner.path,
        kind: "exact",
        similarity: 1,
        tokenCount: loser.tokenCount,
      });
      removedTokens += loser.tokenCount;
      continue;
    }

    const signature = shingles(item.content);
    let matchedIndex = -1;
    let matchedScore = 0;

    for (let i = 0; i < kept.length; i += 1) {
      const score = similarity(signature, signatures[i] as Set<number>);
      if (score > threshold && score > matchedScore) {
        matchedIndex = i;
        matchedScore = score;
      }
    }

    if (matchedIndex === -1) {
      byHash.set(item.hash, kept.length);
      kept.push(item);
      signatures.push(signature);
      continue;
    }

    const incumbent = kept[matchedIndex] as ContextItem;
    const winner = strongerItem(incumbent, item);
    const loser = winner === incumbent ? item : incumbent;

    if (winner !== incumbent) {
      kept[matchedIndex] = winner;
      signatures[matchedIndex] = signature;
      byHash.set(winner.hash, matchedIndex);
    }

    duplicates.push({
      path: loser.path,
      duplicateOf: winner.path,
      kind: "near",
      similarity: Number(matchedScore.toFixed(4)),
      tokenCount: loser.tokenCount,
    });
    removedTokens += loser.tokenCount;
  }

  return { kept, duplicates, removedTokens };
}
