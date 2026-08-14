import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExcludedItem, SelectionResult } from "./budget.js";
import type { DuplicateRecord } from "./dedup.js";
import type { Priority, TokenCountType } from "./types.js";

export interface ReceiptIncludedItem {
  readonly path: string;
  readonly token_count: number;
  readonly reason: string;
  readonly score: number;
  readonly priority: Priority;
  readonly compressed: boolean;
}

export interface ReceiptExcludedItem {
  readonly path: string;
  readonly token_count: number;
  readonly reason: string;
  readonly score: number;
  readonly priority: Priority;
}

export interface RemovedTokens {
  readonly duplicate_tokens: number;
  readonly irrelevant_tokens: number;
  readonly low_priority_tokens: number;
  readonly compressed_tokens: number;
}

export interface ContextReceipt {
  readonly request_id: string;
  readonly timestamp: string;
  readonly project: string;
  readonly task: string;
  /**
   * Who asked, if they said.
   *
   * Optional in the type because receipts are files on disk and every receipt
   * written before this field existed will never have it. Absent means UNKNOWN,
   * which is the honest reading — not "nobody" and not a guess (§37).
   *
   * The value is self-declared, exactly as it is on the event log: ctxd sees a
   * request, not an identity (§6). It attributes; it does not vouch.
   */
  readonly claimed_worker?: string;
  readonly budget: number;
  readonly candidate_total_tokens: number;
  readonly final_total_tokens: number;
  /** Always "estimated" while the heuristic estimator is in use. */
  readonly token_count_estimation: TokenCountType;
  readonly algorithm_version: string;
  readonly removed_tokens: RemovedTokens;
  readonly included_items: readonly ReceiptIncludedItem[];
  readonly excluded_items: readonly ReceiptExcludedItem[];
  readonly duplicates: readonly DuplicateRecord[];
  readonly warnings: readonly string[];
}

export interface BuildReceiptInput {
  readonly project: string;
  readonly task: string;
  /** Self-declared requester. Omitted rather than defaulted when unknown. */
  readonly claimedWorker?: string | undefined;
  readonly candidateTokens: number;
  readonly duplicates: readonly DuplicateRecord[];
  readonly duplicateTokens: number;
  readonly selection: SelectionResult;
  readonly tokenCountType: TokenCountType;
  readonly algorithmVersion: string;
  readonly requestId?: string;
  readonly timestamp?: string;
}

function toExcluded(item: ExcludedItem): ReceiptExcludedItem {
  return {
    path: item.path,
    token_count: item.tokenCount,
    reason: item.reason,
    score: Number(item.score.toFixed(4)),
    priority: item.priority,
  };
}

/** Assemble the receipt that explains exactly what was sent and why. */
export function buildReceipt(input: BuildReceiptInput): ContextReceipt {
  const { selection } = input;

  return {
    request_id: input.requestId ?? randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    project: input.project,
    task: input.task,
    // Omitted entirely when unknown, so a reader cannot mistake an explicit
    // null for a worker that named itself null.
    ...(input.claimedWorker === undefined ? {} : { claimed_worker: input.claimedWorker }),
    budget: selection.budget,
    candidate_total_tokens: input.candidateTokens,
    final_total_tokens: selection.finalTokens,
    token_count_estimation: input.tokenCountType,
    algorithm_version: input.algorithmVersion,
    removed_tokens: {
      duplicate_tokens: input.duplicateTokens,
      irrelevant_tokens: selection.irrelevantTokens,
      low_priority_tokens: selection.lowPriorityTokens,
      compressed_tokens: selection.compressedTokens,
    },
    included_items: selection.included.map((entry) => ({
      path: entry.item.path,
      token_count: entry.tokenCount,
      reason: entry.reason,
      score: Number((entry.item.score ?? 0).toFixed(4)),
      priority: entry.item.priority,
      compressed: entry.compressed,
    })),
    excluded_items: selection.excluded.map(toExcluded),
    duplicates: input.duplicates,
    warnings: selection.warnings,
  };
}

/**
 * Render the receipt for a human.
 *
 * Reductions are always described as *estimated context avoided*. No monetary
 * figure is ever produced: the token counts are estimates, and a currency
 * amount would imply a precision that does not exist.
 */
export function formatReceipt(receipt: ContextReceipt): string {
  const avoided = receipt.candidate_total_tokens - receipt.final_total_tokens;
  const lines: string[] = [
    `CONTEXT RECEIPT ${receipt.request_id}`,
    "",
    `Task:      ${receipt.task}`,
    `Project:   ${receipt.project}`,
    // "claims" rather than a bare name: the receipt records who said they
    // asked, and a receipt that laundered that into fact would be lying in the
    // one document whose whole purpose is to be trustworthy.
    `Worker:    ${receipt.claimed_worker === undefined ? "unknown" : `claims ${receipt.claimed_worker}`}`,
    `Budget:    ${receipt.budget.toLocaleString()}`,
    "",
    `Candidate: ${receipt.candidate_total_tokens.toLocaleString()} ${receipt.token_count_estimation} tokens`,
    `Final:     ${receipt.final_total_tokens.toLocaleString()} ${receipt.token_count_estimation} tokens`,
    `Estimated context avoided: ${avoided.toLocaleString()}`,
    "",
    "Removed:",
    `  duplicate:    ${receipt.removed_tokens.duplicate_tokens.toLocaleString()}`,
    `  irrelevant:   ${receipt.removed_tokens.irrelevant_tokens.toLocaleString()}`,
    `  low priority: ${receipt.removed_tokens.low_priority_tokens.toLocaleString()}`,
    `  compression:  ${receipt.removed_tokens.compressed_tokens.toLocaleString()}`,
    "",
    `Included (${receipt.included_items.length}):`,
  ];

  for (const item of receipt.included_items) {
    lines.push(
      `  ✓ ${item.path}  [${item.priority}, ${item.token_count} tokens${item.compressed ? ", compressed" : ""}]`,
    );
    lines.push(`      reason: ${item.reason}`);
  }

  if (receipt.excluded_items.length > 0) {
    lines.push("", `Excluded (${receipt.excluded_items.length}):`);
    for (const item of receipt.excluded_items.slice(0, 15)) {
      lines.push(`  × ${item.path}  [${item.priority}] — ${item.reason}`);
    }
    if (receipt.excluded_items.length > 15) {
      lines.push(`  … and ${receipt.excluded_items.length - 15} more`);
    }
  }

  if (receipt.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of receipt.warnings) lines.push(`  ! ${warning}`);
  }

  lines.push("", `Token counting: ${receipt.token_count_estimation}`);
  lines.push(`Algorithm version: ${receipt.algorithm_version}`);
  return lines.join("\n");
}

/** Persist the receipt as JSON. Returns the path written. */
export function writeReceipt(directory: string, receipt: ContextReceipt): string {
  const path = join(directory, `${receipt.request_id}.json`);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return path;
}
