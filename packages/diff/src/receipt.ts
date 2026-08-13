/**
 * Change Receipt (§56).
 *
 * The counterpart to the Context Receipt: that one explains every token ctxd
 * sent, this one explains every line the worker changed. Both exist for the
 * same reason — a claim about a change should come with the evidence for it.
 *
 * Receipts are written, never rewritten. The worker's code is not touched.
 */

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CommentNoise } from "./comments.js";
import type {
  ChangeClassification,
  ClassificationResult,
  Risk,
  VerificationStatus,
} from "./classify.js";
import type { OverEditSignal } from "./overedit.js";
import type { ChangeSurface } from "./surface.js";

export interface ReceiptFileEntry {
  readonly path: string;
  readonly kind: string;
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  readonly related: boolean;
  readonly reason: string;
}

export interface ChangeReceipt {
  readonly request_id: string;
  readonly timestamp: string;
  readonly project: string;
  readonly task: string;
  readonly worker: string;
  readonly scope: string;
  readonly files_changed: number;
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly lines_modified: number;
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  readonly formatting_only_changes: number;
  readonly comment_only_changes: number;
  readonly import_only_changes: number;
  readonly unrelated_files: readonly string[];
  readonly dependency_changes: number;
  readonly generated_file_changes: number;
  readonly rename_changes: number;
  readonly whole_file_rewrites: number;
  readonly expected_size: string;
  readonly expected_files: number | null;
  readonly expected_lines: number | null;
  readonly risk: Risk;
  /** Focus measure in 0–1. Explicitly not a correctness score (§52). */
  readonly change_efficiency_score: number;
  readonly classification: ChangeClassification;
  readonly classification_reasons: readonly string[];
  readonly recommendation: string;
  readonly verification_status: VerificationStatus;
  readonly signals: readonly OverEditSignal[];
  readonly comments_flagged: readonly string[];
  readonly files: readonly ReceiptFileEntry[];
  readonly warnings: readonly string[];
  readonly algorithm_version: string;
}

export const DIFF_ALGORITHM_VERSION = "diff-firewall-1";

export interface BuildChangeReceiptInput {
  readonly project: string;
  readonly task: string;
  readonly worker: string;
  readonly scope: string;
  readonly surface: ChangeSurface;
  readonly comments: CommentNoise;
  readonly signals: readonly OverEditSignal[];
  readonly efficiencyScore: number;
  readonly classification: ClassificationResult;
  readonly verification: VerificationStatus;
  readonly warnings: readonly string[];
  readonly requestId?: string;
  readonly timestamp?: string;
}

export function buildChangeReceipt(input: BuildChangeReceiptInput): ChangeReceipt {
  const { surface } = input;

  return {
    request_id: input.requestId ?? randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    project: input.project,
    task: input.task,
    worker: input.worker,
    scope: input.scope,
    files_changed: surface.files_changed,
    lines_added: surface.lines_added,
    lines_removed: surface.lines_removed,
    lines_modified: surface.lines_modified,
    semantic_lines: surface.semantic_lines,
    formatting_lines: surface.formatting_lines,
    formatting_only_changes: surface.formatting_only_changes,
    comment_only_changes: surface.comment_only_changes,
    import_only_changes: surface.import_only_changes,
    unrelated_files: surface.unrelated_files,
    dependency_changes: surface.dependency_changes,
    generated_file_changes: surface.generated_file_changes,
    rename_changes: surface.rename_changes,
    whole_file_rewrites: surface.whole_file_rewrites,
    expected_size: surface.expected.size,
    expected_files: surface.expected.files ?? null,
    expected_lines: surface.expected.lines ?? null,
    risk: input.classification.risk,
    change_efficiency_score: input.efficiencyScore,
    classification: input.classification.classification,
    classification_reasons: input.classification.reasons,
    recommendation: input.classification.recommendation,
    verification_status: input.verification,
    signals: input.signals,
    comments_flagged: input.comments.added
      .filter((entry) => entry.verdict === "restates-code")
      .map((entry) => `${entry.path}: ${entry.text}`),
    files: surface.files.map((file) => ({
      path: file.path,
      kind: file.kind,
      lines_added: file.linesAdded,
      lines_removed: file.linesRemoved,
      semantic_lines: file.noise.semanticLines,
      formatting_lines: file.noise.formattingLines,
      related: file.related,
      reason: file.relatedReason,
    })),
    warnings: input.warnings,
    algorithm_version: DIFF_ALGORITHM_VERSION,
  };
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/**
 * Render the receipt for a human.
 *
 * The efficiency score is always printed with its disclaimer attached. A bare
 * number invites being read as a grade on the code, which is exactly what it is
 * not.
 */
export function formatChangeReceipt(receipt: ChangeReceipt): string {
  const lines: string[] = [
    `CHANGE RECEIPT ${receipt.request_id}`,
    "",
    `Task:      ${receipt.task}`,
    `Project:   ${receipt.project}`,
    `Worker:    ${receipt.worker}`,
    `Compared:  ${receipt.scope}`,
    "",
    `Changed:   ${plural(receipt.files_changed, "file")}`,
    `Added:     ${receipt.lines_added} lines`,
    `Removed:   ${receipt.lines_removed} lines`,
    `Modified:  ${receipt.lines_modified} lines`,
    "",
    `Semantic:        ${receipt.semantic_lines} lines`,
    `Formatting-only: ${receipt.formatting_lines} lines (${receipt.formatting_only_changes} file(s))`,
    `Comment-only:    ${receipt.comment_only_changes} file(s)`,
    `Import-only:     ${receipt.import_only_changes} file(s)`,
    `Unrelated:       ${receipt.unrelated_files.length} file(s)`,
    `Dependency:      ${receipt.dependency_changes} file(s)`,
    `Generated:       ${receipt.generated_file_changes} file(s)`,
    `Renamed:         ${receipt.rename_changes} file(s)`,
  ];

  if (receipt.expected_files !== null) {
    lines.push(
      "",
      `Expected (${receipt.expected_size} task): about ${receipt.expected_files} file(s), ` +
        `${receipt.expected_lines ?? "?"} changed line(s)`,
    );
  }

  lines.push(
    "",
    `Assessment: ${receipt.classification}  (risk: ${receipt.risk})`,
    `Change efficiency score: ${receipt.change_efficiency_score.toFixed(2)} ` +
      "— a focus measure, not a correctness score",
    `Verification: ${receipt.verification_status}`,
    "",
    "Why:",
  );
  for (const reason of receipt.classification_reasons) lines.push(`  · ${reason}`);

  if (receipt.signals.length > 0) {
    lines.push("", "Signals:");
    for (const signal of receipt.signals) {
      const mark = signal.severity === "warning" ? "!" : "·";
      lines.push(`  ${mark} ${signal.summary}`);
      if (signal.evidence !== "") lines.push(`      ${signal.evidence}`);
    }
  }

  if (receipt.files.length > 0) {
    lines.push("", "Files:");
    for (const file of receipt.files.slice(0, 20)) {
      const mark = file.related ? "✓" : "?";
      lines.push(
        `  ${mark} ${file.path}  [${file.kind}, +${file.lines_added}/−${file.lines_removed}, ` +
          `${file.semantic_lines} semantic]`,
      );
      lines.push(`      ${file.reason}`);
    }
    if (receipt.files.length > 20) {
      lines.push(`  … and ${receipt.files.length - 20} more`);
    }
  }

  if (receipt.comments_flagged.length > 0) {
    lines.push("", "Comments that restate the code (not removed — review or move to memory):");
    for (const entry of receipt.comments_flagged.slice(0, 10)) lines.push(`  · ${entry}`);
  }

  if (receipt.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of receipt.warnings) lines.push(`  ! ${warning}`);
  }

  lines.push("", `Recommendation: ${receipt.recommendation}`);
  lines.push(`Algorithm version: ${receipt.algorithm_version}`);
  return lines.join("\n");
}

/** Persist the receipt as JSON. Returns the path written. */
export function writeChangeReceipt(directory: string, receipt: ChangeReceipt): string {
  const path = join(directory, `${receipt.request_id}.json`);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return path;
}
