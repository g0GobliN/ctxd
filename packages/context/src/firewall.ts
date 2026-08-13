import { selectWithinBudget, type SelectionResult } from "./budget.js";
import { collectCandidates, totalTokens, type CollectOptions } from "./collect.js";
import { deduplicate, type DedupResult } from "./dedup.js";
import { heuristicEstimator, type TokenEstimator } from "./estimator.js";
import { rankItems } from "./ranking.js";
import { buildReceipt, type ContextReceipt } from "./receipt.js";
import { extractTaskSignals, type TaskSignals } from "./task.js";
import { ALGORITHM_VERSION, type ContextItem, type RankingWeights } from "./types.js";

export interface BuildContextOptions {
  readonly task: string;
  readonly dir: string;
  readonly budget: number;
  readonly project?: string;
  /**
   * Candidates from sources other than the filesystem — memory, Git state,
   * task state. They join the same dedup, ranking and budget pipeline as
   * files, so nothing bypasses the firewall by virtue of where it came from.
   *
   * An item carrying a `reason` was returned by a retrieval provider that
   * already justified it, and is exempt from the task-relevance gate.
   */
  readonly extraCandidates?: readonly ContextItem[];
  readonly estimator?: TokenEstimator;
  readonly weights?: RankingWeights;
  readonly safetyMarginTokens?: number;
  readonly now?: number;
  readonly requestId?: string;
  readonly timestamp?: string;
  readonly collect?: CollectOptions;
}

export interface BuildContextResult {
  readonly signals: TaskSignals;
  readonly candidates: readonly ContextItem[];
  readonly candidateTokens: number;
  readonly dedup: DedupResult;
  readonly ranked: readonly ContextItem[];
  readonly selection: SelectionResult;
  readonly receipt: ContextReceipt;
  /** The assembled context, ready to hand to a worker. */
  readonly context: string;
}

/**
 * Build the minimum useful context for a task.
 *
 * The pipeline is task → signals → candidates → dedup → rank → budget →
 * compression → receipt. Every stage is deterministic and local: no network
 * call, no model, no embeddings. Running it twice on unchanged inputs produces
 * byte-identical output.
 *
 * This is a pure function of the filesystem it is pointed at, which is what
 * makes it testable and benchmarkable.
 */
export function buildContext(options: BuildContextOptions): BuildContextResult {
  const estimator = options.estimator ?? heuristicEstimator;
  const signals = extractTaskSignals(options.task);

  const collected = collectCandidates(options.dir, {
    estimator,
    ...(options.collect ?? {}),
  });
  const candidates = [...collected.items, ...(options.extraCandidates ?? [])];
  const candidateTokens = totalTokens(candidates);

  const dedup = deduplicate(candidates);

  const ranked = rankItems(dedup.kept, signals, {
    ...(options.weights === undefined ? {} : { weights: options.weights }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });

  const selection = selectWithinBudget(ranked, signals, {
    budget: options.budget,
    estimator,
    ...(options.safetyMarginTokens === undefined
      ? {}
      : { safetyMarginTokens: options.safetyMarginTokens }),
  });

  const receipt = buildReceipt({
    project: options.project ?? options.dir,
    task: options.task,
    candidateTokens,
    duplicates: dedup.duplicates,
    duplicateTokens: dedup.removedTokens,
    selection,
    tokenCountType: estimator.accuracy,
    algorithmVersion: ALGORITHM_VERSION,
    ...(options.requestId === undefined ? {} : { requestId: options.requestId }),
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
  });

  return {
    signals,
    candidates,
    candidateTokens,
    dedup,
    ranked,
    selection,
    receipt,
    context: renderContext(selection),
  };
}

/** Assemble the selected items into the text a worker receives. */
export function renderContext(selection: SelectionResult): string {
  return selection.included
    .map((entry) => {
      const header = `# ${entry.item.path} [${entry.item.priority}${entry.compressed ? ", compressed" : ""}]`;
      return `${header}\n\n${entry.content.trimEnd()}\n`;
    })
    .join("\n");
}
