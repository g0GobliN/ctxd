/**
 * P0 must survive budget pressure whenever physically possible; P4 is dropped
 * first. See the priority model in the specification (§21).
 */
export type Priority = "P0" | "P1" | "P2" | "P3" | "P4";

export const PRIORITIES: readonly Priority[] = ["P0", "P1", "P2", "P3", "P4"];

/** Order in which budget pressure removes items: P4 first, P0 last. */
export const EVICTION_ORDER: readonly Priority[] = ["P4", "P3", "P2", "P1", "P0"];

export type ContextItemType =
  | "source"
  | "documentation"
  | "memory"
  | "session"
  | "project"
  | "configuration"
  | "git"
  | "other";

export type TokenCountType = "estimated" | "exact";

/**
 * Individual relevance signals, kept separate so a ranking decision can always
 * be explained and so unavailable signals stay visibly zero rather than being
 * invented. Signals that need later phases (semantic, dependency, memory,
 * architecture, git, historical usefulness) are deliberately absent for now
 * rather than faked.
 */
export interface RelevanceSignals {
  readonly keyword: number;
  readonly path: number;
  readonly fileType: number;
  readonly priority: number;
  readonly recency: number;
  readonly tokenCost: number;
}

export interface ContextItem {
  readonly id: string;
  readonly path: string;
  readonly content: string;
  readonly tokenCount: number;
  readonly tokenCountType: TokenCountType;
  readonly type: ContextItemType;
  readonly priority: Priority;
  /** Modification time in epoch milliseconds. */
  readonly mtime: number;
  /** SHA-256 of the raw content, used for exact duplicate detection. */
  readonly hash: string;
  readonly score?: number;
  readonly relevance?: RelevanceSignals;
  /** Human-readable justification, surfaced in the context receipt. */
  readonly reason?: string;
}

/**
 * Ranking weights.
 *
 * These values are experimental starting points, not scientifically optimal
 * constants. They are configurable and versioned precisely so they can be
 * benchmarked and improved without touching the algorithm.
 */
export interface RankingWeights {
  readonly keyword: number;
  readonly path: number;
  readonly fileType: number;
  readonly priority: number;
  readonly recency: number;
  readonly tokenCost: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  keyword: 3.0,
  fileType: 1.5,
  priority: 2.0,
  recency: 0.5,
  path: 2.0,
  tokenCost: 0.1,
};

/** Bumped whenever ranking, dedup or selection behaviour changes. */
export const ALGORITHM_VERSION = "1.0.0";
