import { compressItem, type CompressOptions } from "./compression.js";
import { heuristicEstimator, type TokenEstimator } from "./estimator.js";
import type { TaskSignals } from "./task.js";
import type { ContextItem, Priority } from "./types.js";

export interface SelectedItem {
  readonly item: ContextItem;
  /** The representation actually included, possibly compressed. */
  readonly content: string;
  readonly tokenCount: number;
  readonly compressed: boolean;
  readonly reason: string;
}

export interface ExcludedItem {
  readonly path: string;
  readonly tokenCount: number;
  readonly reason: string;
  readonly score: number;
  readonly priority: Priority;
}

export interface SelectionResult {
  readonly included: readonly SelectedItem[];
  readonly excluded: readonly ExcludedItem[];
  readonly finalTokens: number;
  readonly budget: number;
  readonly effectiveBudget: number;
  readonly compressedTokens: number;
  readonly lowPriorityTokens: number;
  readonly irrelevantTokens: number;
  /** Non-fatal problems, e.g. a mandatory item that could not be fitted. */
  readonly warnings: readonly string[];
}

export interface SelectOptions {
  readonly budget: number;
  readonly estimator?: TokenEstimator;
  /** Head-room kept free inside the budget. */
  readonly safetyMarginTokens?: number;
  readonly compression?: CompressOptions;
}

function isMandatory(priority: Priority): boolean {
  return priority === "P0";
}

/**
 * Whether an item has any task-specific reason to be included.
 *
 * Leftover budget is not an argument for sending a file. Without a keyword or
 * path connection to the task — or a priority that makes it relevant to the
 * current work regardless — an item is padding, and padding is exactly what
 * the context firewall exists to remove.
 *
 * Items that are genuinely needed but mention nothing (a dependency of a
 * relevant file, say) will be justified by the dependency and memory signals
 * added in later phases, not by filling space now.
 */
/**
 * The weakest keyword signal that still counts as a connection.
 *
 * `keywordScore` is roughly 0.8 × the fraction of task terms present, so this
 * threshold excludes a file whose only tie to the task is a single incidental
 * term out of many — an unrelated service whose SQL happens to say `ORDER BY`
 * against a task mentioning "order", say. It scales with the task rather than
 * cutting at a fixed count: on an eight-term task one stray match is 0.10 and
 * is dropped, while on a three-term task a single genuine match is 0.27 and is
 * kept.
 *
 * A path match is exempt. Directory and file names are chosen deliberately, so
 * a path hit is evidence in a way that one word in a comment is not.
 */
const MINIMUM_KEYWORD_RELEVANCE = 0.12;

function hasTaskRelevance(item: ContextItem): boolean {
  if (isMandatory(item.priority) || item.priority === "P1") return true;
  // An item that arrived with a reason was returned by a retrieval provider
  // that already justified it — a memory found by search, for example.
  if (item.reason !== undefined) return true;
  const signals = item.relevance;
  if (signals === undefined) return true;
  return signals.keyword >= MINIMUM_KEYWORD_RELEVANCE || signals.path > 0;
}

/**
 * Select the context set that fits the budget.
 *
 * The final string is never truncated. Items are chosen whole, compressed when
 * they do not fit whole, and dropped only when compression is not enough —
 * so the worker never receives a file that stops mid-line.
 *
 * Mandatory (P0) items are fitted first. Budget pressure then removes the
 * lowest-value items, which the priority signal already pushes toward P4.
 */
export function selectWithinBudget(
  ranked: readonly ContextItem[],
  signals: TaskSignals,
  options: SelectOptions,
): SelectionResult {
  const estimator = options.estimator ?? heuristicEstimator;
  const margin = Math.max(0, options.safetyMarginTokens ?? 0);
  const effectiveBudget = Math.max(0, options.budget - margin);

  const included: SelectedItem[] = [];
  const excluded: ExcludedItem[] = [];
  const warnings: string[] = [];

  let used = 0;
  let compressedTokens = 0;
  let lowPriorityTokens = 0;
  let irrelevantTokens = 0;

  const mandatory = ranked.filter((item) => isMandatory(item.priority));
  const optional = ranked.filter((item) => !isMandatory(item.priority));

  function tryInclude(item: ContextItem, mandatoryItem: boolean): boolean {
    const remaining = effectiveBudget - used;

    if (item.tokenCount <= remaining) {
      included.push({
        item,
        content: item.content,
        tokenCount: item.tokenCount,
        compressed: false,
        reason: mandatoryItem ? "mandatory (P0)" : describeReason(item),
      });
      used += item.tokenCount;
      return true;
    }

    const compressedResult = compressItem(item, signals, {
      estimator,
      ...(options.compression ?? {}),
    });

    if (compressedResult.compressed && compressedResult.tokenCount <= remaining) {
      included.push({
        item,
        content: compressedResult.content,
        tokenCount: compressedResult.tokenCount,
        compressed: true,
        reason: mandatoryItem
          ? "mandatory (P0), compressed to fit"
          : `${describeReason(item)}, compressed to fit`,
      });
      used += compressedResult.tokenCount;
      compressedTokens += compressedResult.savedTokens;
      return true;
    }

    return false;
  }

  for (const item of mandatory) {
    if (tryInclude(item, true)) continue;

    // A mandatory item that cannot be fitted is reported loudly rather than
    // dropped in silence.
    warnings.push(
      `mandatory item ${item.path} (${item.tokenCount} estimated tokens) does not fit the remaining budget`,
    );
    excluded.push({
      path: item.path,
      tokenCount: item.tokenCount,
      reason: "mandatory item exceeds remaining budget",
      score: item.score ?? 0,
      priority: item.priority,
    });
  }

  for (const item of optional) {
    if (!hasTaskRelevance(item)) {
      irrelevantTokens += item.tokenCount;
      excluded.push({
        path: item.path,
        tokenCount: item.tokenCount,
        reason: "no task relevance",
        score: item.score ?? 0,
        priority: item.priority,
      });
      continue;
    }

    if (tryInclude(item, false)) continue;

    const reason =
      item.priority === "P4" || item.priority === "P3"
        ? "low priority, no budget remaining"
        : "no budget remaining";

    if (item.priority === "P4" || item.priority === "P3") {
      lowPriorityTokens += item.tokenCount;
    } else {
      irrelevantTokens += item.tokenCount;
    }

    excluded.push({
      path: item.path,
      tokenCount: item.tokenCount,
      reason,
      score: item.score ?? 0,
      priority: item.priority,
    });
  }

  return {
    included,
    excluded,
    finalTokens: used,
    budget: options.budget,
    effectiveBudget,
    compressedTokens,
    lowPriorityTokens,
    irrelevantTokens,
    warnings,
  };
}

function describeReason(item: ContextItem): string {
  // A retrieval provider that supplied a reason knows more about why this item
  // was fetched than a generic description of its signals ever could.
  if (item.reason !== undefined) return item.reason;

  const signals = item.relevance;
  if (signals === undefined) return "selected by rank";

  if (signals.path > 0.4 && signals.keyword > 0.2) return "path and content match the task";
  if (signals.keyword > 0.3) return "direct task relevance";
  if (signals.path > 0.4) return "path matches the task";
  if (signals.priority >= 0.8) return "high priority";
  return "supporting context";
}
