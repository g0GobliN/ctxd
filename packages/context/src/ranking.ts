import { normalizeTerms, type TaskSignals } from "./task.js";
import {
  DEFAULT_RANKING_WEIGHTS,
  type ContextItem,
  type ContextItemType,
  type Priority,
  type RankingWeights,
  type RelevanceSignals,
} from "./types.js";

/** Half-life used by the recency signal, in days. */
const RECENCY_HALF_LIFE_DAYS = 30;

/** Token count at which the cost penalty saturates. */
const TOKEN_COST_SATURATION = 8000;

/** Matches beyond this count add nothing, so one huge file cannot dominate. */
const TERM_FREQUENCY_CAP = 8;

const FILE_TYPE_SCORES: Record<ContextItemType, number> = {
  source: 1.0,
  memory: 0.9,
  documentation: 0.7,
  project: 0.65,
  git: 0.5,
  configuration: 0.4,
  session: 0.3,
  other: 0.2,
};

const PRIORITY_SCORES: Record<Priority, number> = {
  P0: 1.0,
  P1: 0.8,
  P2: 0.6,
  P3: 0.35,
  P4: 0.1,
};

/**
 * How strongly the task's vocabulary appears in the content, in [0, 1].
 *
 * Each term contributes its capped frequency, so a file mentioning several
 * different task terms outranks one repeating a single term.
 */
export function keywordScore(content: string, signals: TaskSignals): number {
  if (signals.terms.length === 0) return 0;

  const terms = normalizeTerms(content);
  if (terms.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const term of terms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  let total = 0;
  for (const term of signals.terms) {
    const count = counts.get(term) ?? 0;
    if (count > 0) {
      total += Math.min(count, TERM_FREQUENCY_CAP) / TERM_FREQUENCY_CAP;
    }
  }

  const lower = content.toLowerCase();
  let phraseBonus = 0;
  for (const phrase of signals.phrases) {
    if (lower.includes(phrase)) phraseBonus += 1;
  }

  const base = total / signals.terms.length;
  const bonus = signals.phrases.length === 0 ? 0 : phraseBonus / signals.phrases.length;
  return Math.min(1, base * 0.8 + bonus * 0.2);
}

/**
 * How strongly the path itself matches the task, in [0, 1].
 *
 * Paths are a strong signal: `payment/webhook.ts` is more likely relevant to a
 * webhook task than `camera/device.ts`, whatever the file contents say.
 */
export function pathScore(path: string, signals: TaskSignals): number {
  if (signals.terms.length === 0) return 0;

  const segments = normalizeTerms(path);
  if (segments.length === 0) return 0;

  const present = new Set(segments);
  let matched = 0;
  for (const term of signals.terms) {
    if (present.has(term)) matched += 1;
  }

  return Math.min(1, matched / signals.terms.length);
}

/** Exponential decay from the item's modification time, in [0, 1]. */
export function recencyScore(mtime: number, now: number = Date.now()): number {
  const ageDays = Math.max(0, (now - mtime) / 86_400_000);
  return 2 ** (-ageDays / RECENCY_HALF_LIFE_DAYS);
}

/** Cost of including an item, in [0, 1]; subtracted from the final score. */
export function tokenCostScore(tokenCount: number): number {
  return Math.min(1, tokenCount / TOKEN_COST_SATURATION);
}

export function fileTypeScore(type: ContextItemType): number {
  return FILE_TYPE_SCORES[type];
}

export function priorityScore(priority: Priority): number {
  return PRIORITY_SCORES[priority];
}

/** Compute every individual signal for one item. */
export function computeSignals(
  item: ContextItem,
  signals: TaskSignals,
  now: number = Date.now(),
): RelevanceSignals {
  return {
    keyword: keywordScore(item.content, signals),
    path: pathScore(item.path, signals),
    fileType: fileTypeScore(item.type),
    priority: priorityScore(item.priority),
    recency: recencyScore(item.mtime, now),
    tokenCost: tokenCostScore(item.tokenCount),
  };
}

/** Combine signals into a single score using the configured weights. */
export function combineSignals(
  relevance: RelevanceSignals,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS,
): number {
  return (
    relevance.keyword * weights.keyword +
    relevance.path * weights.path +
    relevance.fileType * weights.fileType +
    relevance.priority * weights.priority +
    relevance.recency * weights.recency -
    relevance.tokenCost * weights.tokenCost
  );
}

export interface RankOptions {
  readonly weights?: RankingWeights;
  readonly now?: number;
}

/**
 * Score and sort candidates, highest first.
 *
 * Ties break on path so the ordering is completely deterministic — the same
 * inputs always produce the same context.
 */
export function rankItems(
  items: readonly ContextItem[],
  signals: TaskSignals,
  options: RankOptions = {},
): ContextItem[] {
  const weights = options.weights ?? DEFAULT_RANKING_WEIGHTS;
  const now = options.now ?? Date.now();

  return items
    .map((item) => {
      const relevance = computeSignals(item, signals, now);
      return { ...item, relevance, score: combineSignals(relevance, weights) };
    })
    .sort((a, b) => {
      const byScore = (b.score ?? 0) - (a.score ?? 0);
      if (byScore !== 0) return byScore;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });
}
