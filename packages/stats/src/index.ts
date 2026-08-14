/**
 * Token statistics and efficiency reporting (§48, §49).
 *
 * Every number here is derived from receipts already on disk — nothing is
 * sampled, estimated after the fact, or inferred. The one rule that shapes the
 * whole module: **ctxd never states a monetary saving.** Token counts are
 * estimates from a heuristic tokenizer, and a currency figure would imply a
 * precision that does not exist. The phrase is always "estimated context
 * avoided" (§18, §25, §48, §49).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ContextReceipt } from "@ctxd/context";
import type { ChangeReceipt } from "@ctxd/diff";

/** How a value was obtained. An unavailable signal reads as unknown, not zero. */
export type Accuracy = "exact" | "estimated" | "unknown";

export interface ContextStats {
  readonly requests: number;
  readonly candidateTokens: number;
  readonly finalTokens: number;
  readonly avoidedTokens: number;
  readonly duplicateTokens: number;
  readonly irrelevantTokens: number;
  readonly lowPriorityTokens: number;
  readonly compressedTokens: number;
  /** Always "estimated" while the heuristic tokenizer is in use. */
  readonly accuracy: Accuracy;
  readonly firstAt: string | undefined;
  readonly lastAt: string | undefined;
}

export interface ChangeStats {
  readonly reviews: number;
  readonly filesChanged: number;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly semanticLines: number;
  readonly formattingLines: number;
  readonly unrelatedFiles: number;
  readonly dependencyChanges: number;
  /** Mean change efficiency. A focus measure, never a correctness score. */
  readonly meanEfficiency: number | undefined;
  readonly byClassification: Readonly<Record<string, number>>;
  readonly byVerification: Readonly<Record<string, number>>;
}

export interface Stats {
  readonly context: ContextStats;
  readonly change: ChangeStats;
  /** Receipt files that could not be read, so a gap is never silent. */
  readonly unreadable: readonly string[];
}

export interface LoadOptions {
  /** Only count receipts at or after this ISO timestamp. */
  readonly since?: string | undefined;
  readonly limit?: number | undefined;
}

interface LoadedReceipts<T> {
  readonly receipts: readonly T[];
  readonly unreadable: readonly string[];
}

/**
 * Read every receipt in a directory, newest first.
 *
 * A missing directory yields nothing rather than throwing: a fresh install has
 * no receipts, and that is a legitimate answer to "how much have you saved?".
 */
function loadReceipts<T extends { timestamp: string }>(
  directory: string,
  options: LoadOptions,
): LoadedReceipts<T> {
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(".json"));
  } catch {
    return { receipts: [], unreadable: [] };
  }

  const entries = names
    .map((name) => {
      const path = join(directory, name);
      try {
        return { path, mtime: statSync(path).mtimeMs };
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is { path: string; mtime: number } => entry !== undefined)
    .sort((a, b) => b.mtime - a.mtime);

  const receipts: T[] = [];
  const unreadable: string[] = [];
  const sinceMs = options.since === undefined ? undefined : Date.parse(options.since);

  for (const entry of entries) {
    if (options.limit !== undefined && receipts.length >= options.limit) break;

    let parsed: T;
    try {
      parsed = JSON.parse(readFileSync(entry.path, "utf8")) as T;
    } catch {
      unreadable.push(entry.path);
      continue;
    }

    if (sinceMs !== undefined && Number.isFinite(sinceMs)) {
      const at = Date.parse(parsed.timestamp);
      if (Number.isFinite(at) && at < sinceMs) continue;
    }
    receipts.push(parsed);
  }

  return { receipts, unreadable };
}

function summariseContext(receipts: readonly ContextReceipt[]): ContextStats {
  const sum = (pick: (receipt: ContextReceipt) => number): number =>
    receipts.reduce((total, receipt) => total + pick(receipt), 0);

  const timestamps = receipts
    .map((receipt) => receipt.timestamp)
    .filter((value) => value !== undefined)
    .sort();

  const candidateTokens = sum((receipt) => receipt.candidate_total_tokens);
  const finalTokens = sum((receipt) => receipt.final_total_tokens);

  return {
    requests: receipts.length,
    candidateTokens,
    finalTokens,
    avoidedTokens: candidateTokens - finalTokens,
    duplicateTokens: sum((receipt) => receipt.removed_tokens.duplicate_tokens),
    irrelevantTokens: sum((receipt) => receipt.removed_tokens.irrelevant_tokens),
    lowPriorityTokens: sum((receipt) => receipt.removed_tokens.low_priority_tokens),
    compressedTokens: sum((receipt) => receipt.removed_tokens.compressed_tokens),
    // Every receipt records its own counting method; if they ever disagree the
    // weaker one wins, because a mixed total is not exact.
    accuracy: receipts.length === 0
      ? "unknown"
      : receipts.every((receipt) => receipt.token_count_estimation === "exact")
        ? "exact"
        : "estimated",
    firstAt: timestamps[0],
    lastAt: timestamps[timestamps.length - 1],
  };
}

function summariseChanges(receipts: readonly ChangeReceipt[]): ChangeStats {
  const sum = (pick: (receipt: ChangeReceipt) => number): number =>
    receipts.reduce((total, receipt) => total + pick(receipt), 0);

  const byClassification: Record<string, number> = {};
  const byVerification: Record<string, number> = {};
  for (const receipt of receipts) {
    byClassification[receipt.classification] =
      (byClassification[receipt.classification] ?? 0) + 1;
    byVerification[receipt.verification_status] =
      (byVerification[receipt.verification_status] ?? 0) + 1;
  }

  return {
    reviews: receipts.length,
    filesChanged: sum((receipt) => receipt.files_changed),
    linesAdded: sum((receipt) => receipt.lines_added),
    linesRemoved: sum((receipt) => receipt.lines_removed),
    semanticLines: sum((receipt) => receipt.semantic_lines),
    formattingLines: sum((receipt) => receipt.formatting_lines),
    unrelatedFiles: sum((receipt) => receipt.unrelated_files.length),
    dependencyChanges: sum((receipt) => receipt.dependency_changes),
    meanEfficiency:
      receipts.length === 0
        ? undefined
        : Number(
            (sum((receipt) => receipt.change_efficiency_score) / receipts.length).toFixed(2),
          ),
    byClassification,
    byVerification,
  };
}

export interface CollectOptions extends LoadOptions {
  readonly contextReceiptsDir: string;
  readonly changeReceiptsDir: string;
}

/** Aggregate every receipt on disk into one report. */
export function collectStats(options: CollectOptions): Stats {
  const context = loadReceipts<ContextReceipt>(options.contextReceiptsDir, options);
  const change = loadReceipts<ChangeReceipt>(options.changeReceiptsDir, options);

  return {
    context: summariseContext(context.receipts),
    change: summariseChanges(change.receipts),
    unreadable: [...context.unreadable, ...change.unreadable],
  };
}

function percentage(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/**
 * Render the statistics report.
 *
 * Reads as "estimated context avoided" throughout. There is deliberately no
 * cost figure and no provider comparison: ctxd does not have billing data, and
 * inventing one would be the most tempting lie this tool could tell.
 */
export function formatStats(stats: Stats, scope = "all time"): string {
  const { context, change } = stats;
  const lines: string[] = [`CTXD STATISTICS — ${scope}`, ""];

  if (context.requests === 0) {
    lines.push("No context receipts yet. Run: ctxd context --task …");
  } else {
    lines.push(
      `Context requests: ${context.requests}`,
      "",
      `Raw candidate context: ${context.candidateTokens.toLocaleString()} ${context.accuracy}`,
      `Final context:         ${context.finalTokens.toLocaleString()} ${context.accuracy}`,
      "",
      "Removed:",
      `  duplicate:    ${context.duplicateTokens.toLocaleString()}`,
      `  irrelevant:   ${context.irrelevantTokens.toLocaleString()}`,
      `  low priority: ${context.lowPriorityTokens.toLocaleString()}`,
      `  compression:  ${context.compressedTokens.toLocaleString()}`,
      "",
      `Estimated context avoided: ${context.avoidedTokens.toLocaleString()}`,
      `Sent: ${percentage(context.finalTokens, context.candidateTokens)} of candidate context`,
    );

    if (context.firstAt !== undefined) {
      lines.push("", `First receipt: ${context.firstAt}`, `Last receipt:  ${context.lastAt}`);
    }
  }

  if (change.reviews > 0) {
    lines.push(
      "",
      `Changes reviewed: ${change.reviews}`,
      `  files changed:   ${change.filesChanged.toLocaleString()}`,
      `  lines:           +${change.linesAdded.toLocaleString()}/−${change.linesRemoved.toLocaleString()}`,
      `  semantic lines:  ${change.semanticLines.toLocaleString()}`,
      `  presentation:    ${change.formattingLines.toLocaleString()}`,
      `  unrelated files: ${change.unrelatedFiles}`,
      `  dependency changes: ${change.dependencyChanges}`,
    );

    if (change.meanEfficiency !== undefined) {
      lines.push(
        `  mean change efficiency: ${change.meanEfficiency.toFixed(2)} ` +
          "— a focus measure, not a correctness score",
      );
    }

    const verdicts = Object.entries(change.byClassification)
      .sort(([, a], [, b]) => b - a)
      .map(([verdict, count]) => `${verdict} ${count}`)
      .join(" · ");
    if (verdicts !== "") lines.push(`  verdicts: ${verdicts}`);
  }

  if (stats.unreadable.length > 0) {
    lines.push("", "Could not read:");
    for (const path of stats.unreadable) lines.push(`  ! ${path}`);
  }

  lines.push(
    "",
    "Token counts are estimates from a local heuristic tokenizer, not provider",
    "billing units. ctxd does not have billing data and never reports a cost.",
  );

  return lines.join("\n");
}

/** The efficiency-only view (§49): the reduction, without the change stats. */
export function formatEfficiency(stats: Stats, scope = "all time"): string {
  const { context } = stats;

  if (context.requests === 0) {
    return `CTXD EFFICIENCY — ${scope}\n\nNo context receipts yet.`;
  }

  return [
    `CTXD EFFICIENCY — ${scope}`,
    "",
    `Requests: ${context.requests}`,
    "",
    `Raw candidate context: ${context.candidateTokens.toLocaleString()} ${context.accuracy}`,
    `Final context:         ${context.finalTokens.toLocaleString()} ${context.accuracy}`,
    "",
    "Removed:",
    `  Duplicate:    ${context.duplicateTokens.toLocaleString()}`,
    `  Irrelevant:   ${context.irrelevantTokens.toLocaleString()}`,
    `  Low priority: ${context.lowPriorityTokens.toLocaleString()}`,
    `  Compression:  ${context.compressedTokens.toLocaleString()}`,
    "",
    `Estimated context avoided: ${context.avoidedTokens.toLocaleString()}`,
  ].join("\n");
}

/** Start of the current day, for `--today`. */
export function startOfToday(now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

/**
 * The named reporting windows (UI-7).
 *
 * Defined here rather than in the interface so the CLI and the API cannot
 * disagree about what "7d" means. A browser that computed its own cutoff would
 * be a second place the answer could differ from `ctxd stats`, and the two
 * agreeing is the reason either can be trusted.
 */
export type StatsWindow = "today" | "7d" | "30d" | "all";

export const STATS_WINDOWS: readonly StatsWindow[] = ["today", "7d", "30d", "all"];

export function isStatsWindow(value: string): value is StatsWindow {
  return (STATS_WINDOWS as readonly string[]).includes(value);
}

/**
 * The cutoff a window implies, or `undefined` for everything on disk.
 *
 * "today" is local midnight, matching `--today`; the rolling windows count back
 * from now rather than from midnight, because "the last 7 days" is what a
 * developer checking mid-afternoon means by it.
 */
export function windowSince(window: StatsWindow, now: Date = new Date()): string | undefined {
  switch (window) {
    case "today":
      return startOfToday(now);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

/** How a window is worded in a report heading. */
export function describeWindow(window: StatsWindow): string {
  switch (window) {
    case "today":
      return "today";
    case "7d":
      return "last 7 days";
    case "30d":
      return "last 30 days";
    default:
      return "all time";
  }
}
