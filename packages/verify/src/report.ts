/**
 * Worker output modes and context economy (§58–§61).
 *
 * The context firewall controls what goes *to* a worker. This controls what
 * comes back, and what gets sent on the next turn. Both directions matter: a
 * worker that replies with the task restated, the repository re-explained and
 * the whole diff pasted has spent the budget the firewall just saved.
 */

import { estimateTokens } from "@ctxd/context";
import type { ChangeReceipt } from "@ctxd/diff";
import type { VerificationResult } from "./engine.js";

export type OutputMode = "minimal" | "normal" | "detailed";

export const DEFAULT_OUTPUT_MODE: OutputMode = "minimal";

export interface WorkerReport {
  readonly task: string;
  readonly worker: string;
  readonly changedFiles: readonly string[];
  readonly result: "done" | "failed" | "needs-review";
  readonly verification: VerificationResult["status"];
  /** Anything the next worker could not infer from the code itself. */
  readonly notes: readonly string[];
}

/**
 * Render a worker report at the requested verbosity.
 *
 * `minimal` is the default (§58) and deliberately omits the task text, the
 * repository description, code blocks, the diff and any prose explanation —
 * every one of which the reader already has. What remains is what changed, what
 * happened, and what could not be inferred.
 */
export function formatReport(report: WorkerReport, mode: OutputMode = DEFAULT_OUTPUT_MODE): string {
  const lines: string[] = [];

  if (mode !== "minimal") lines.push(`Task: ${report.task}`, `Worker: ${report.worker}`);

  lines.push(`Result: ${report.result}`, `Verification: ${report.verification}`);

  if (report.changedFiles.length === 0) {
    lines.push("Changed: none");
  } else {
    const limit = mode === "detailed" ? report.changedFiles.length : 10;
    lines.push(`Changed (${report.changedFiles.length}):`);
    for (const path of report.changedFiles.slice(0, limit)) lines.push(`  ${path}`);
    if (report.changedFiles.length > limit) {
      lines.push(`  … and ${report.changedFiles.length - limit} more`);
    }
  }

  if (report.notes.length > 0) {
    const notes = mode === "minimal" ? report.notes.slice(0, 3) : report.notes;
    lines.push("Notes:");
    for (const note of notes) lines.push(`  · ${note}`);
  }

  return lines.join("\n");
}

/** Build a report from a verification result and a change receipt. */
export function reportFrom(
  task: string,
  worker: string,
  verification: VerificationResult,
  receipt?: ChangeReceipt,
): WorkerReport {
  const notes: string[] = [];

  if (receipt !== undefined) {
    if (receipt.unrelated_files.length > 0) {
      notes.push(`${receipt.unrelated_files.length} changed file(s) were not implied by the task`);
    }
    if (receipt.dependency_changes > 0) notes.push("dependencies changed");
    if (receipt.classification === "NEEDS_REVIEW" || receipt.classification === "SUSPICIOUS") {
      notes.push(receipt.recommendation);
    }
  }
  for (const reason of verification.reasons.slice(0, 3)) notes.push(reason);

  const result =
    verification.status === "PASS" ? "done" : verification.status === "FAIL" ? "failed" : "needs-review";

  return {
    task,
    worker,
    changedFiles: receipt?.files.map((file) => file.path) ?? verification.changedFiles,
    result,
    verification: verification.status,
    notes,
  };
}

export type DeltaKind = "base" | "task" | "change" | "error";

export interface ContextDelta {
  readonly kind: DeltaKind;
  readonly content: string;
  /** Stable identity, so the same delta is not sent twice (§59). */
  readonly key: string;
}

export interface DeltaLedger {
  /** Keys already sent to this worker. */
  readonly sent: ReadonlySet<string>;
}

export interface DeltaSelection {
  readonly send: readonly ContextDelta[];
  readonly skipped: readonly ContextDelta[];
  readonly estimatedTokens: number;
  readonly estimatedTokensAvoided: number;
}

/**
 * Decide which deltas the worker still needs (§59, §61).
 *
 * ctxd maintains BASE + TASK + CHANGE + ERROR rather than resending everything
 * each turn. A delta already sent is skipped unless its content changed —
 * `key` carries the identity and the content decides staleness, so a rule that
 * was edited is resent while an unchanged one is not.
 *
 * An error delta is never skipped: it is the reason the turn is happening.
 */
export function selectDeltas(deltas: readonly ContextDelta[], ledger: DeltaLedger): DeltaSelection {
  const send: ContextDelta[] = [];
  const skipped: ContextDelta[] = [];

  for (const delta of deltas) {
    if (delta.kind !== "error" && ledger.sent.has(delta.key)) skipped.push(delta);
    else send.push(delta);
  }

  const tokensOf = (list: readonly ContextDelta[]): number =>
    list.reduce((total, delta) => total + estimateTokens(delta.content), 0);

  return {
    send,
    skipped,
    estimatedTokens: tokensOf(send),
    estimatedTokensAvoided: tokensOf(skipped),
  };
}

/**
 * A delta's identity: its kind, its label, and a digest of its content.
 *
 * Including the content means an edited rule produces a different key and is
 * resent — the alternative, keying on the label alone, would let a worker act
 * on a rule that has since changed.
 */
export function deltaKey(kind: DeltaKind, label: string, content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = (Math.imul(hash, 31) + content.charCodeAt(i)) | 0;
  }
  return `${kind}:${label}:${(hash >>> 0).toString(36)}`;
}
