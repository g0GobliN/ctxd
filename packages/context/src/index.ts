export {
  ALGORITHM_VERSION,
  DEFAULT_RANKING_WEIGHTS,
  EVICTION_ORDER,
  PRIORITIES,
  type ContextItem,
  type ContextItemType,
  type Priority,
  type RankingWeights,
  type RelevanceSignals,
  type TokenCountType,
} from "./types.js";

export { estimateTokens, heuristicEstimator, type TokenEstimator } from "./estimator.js";

export {
  extractTaskSignals,
  isStopWord,
  normalizeTerms,
  type TaskSignals,
} from "./task.js";

export {
  classifyItem,
  defaultPriority,
  readFrontMatterPriority,
} from "./classify.js";

export {
  compileIgnoreRules,
  DEFAULT_IGNORE_PATTERNS,
  isIgnored,
  readIgnoreFile,
  type IgnoreRule,
} from "./ignore.js";

export {
  collectCandidates,
  totalTokens,
  type CollectOptions,
  type CollectResult,
} from "./collect.js";

export {
  deduplicate,
  NEAR_DUPLICATE_THRESHOLD,
  normalizeForComparison,
  shingles,
  similarity,
  strongerItem,
  type DedupResult,
  type DuplicateRecord,
} from "./dedup.js";

export {
  combineSignals,
  computeSignals,
  fileTypeScore,
  keywordScore,
  pathScore,
  priorityScore,
  rankItems,
  recencyScore,
  tokenCostScore,
  type RankOptions,
} from "./ranking.js";

export {
  compressItem,
  type CompressOptions,
  type CompressionResult,
} from "./compression.js";

export {
  selectWithinBudget,
  type ExcludedItem,
  type SelectedItem,
  type SelectionResult,
  type SelectOptions,
} from "./budget.js";

export {
  buildReceipt,
  formatReceipt,
  writeReceipt,
  type ContextReceipt,
  type ReceiptExcludedItem,
  type ReceiptIncludedItem,
  type RemovedTokens,
} from "./receipt.js";

export {
  buildContext,
  renderContext,
  type BuildContextOptions,
  type BuildContextResult,
} from "./firewall.js";
