/**
 * Over-edit detection and the change efficiency score (§52, §55).
 *
 * IMPORTANT: `change_efficiency_score` is **not** a correctness score. A
 * perfectly correct change can score low, and a wrong change can score 1.0. It
 * measures one thing only — how focused the change appears relative to what the
 * task asked for — and it exists to decide whether a human should look, never
 * to decide whether the code is right.
 *
 * No signal here rejects, reverts or rewrites anything.
 */

import { changedLines, type FileDiff } from "./parse.js";
import type { CommentNoise } from "./comments.js";
import type { ChangeSurface } from "./surface.js";
import { commentStyle, isCommentLine, normalizePresentation } from "./syntax.js";

export type SignalSeverity = "info" | "warning";

export interface OverEditSignal {
  readonly id: string;
  readonly severity: SignalSeverity;
  readonly summary: string;
  /** The counted facts behind the signal, so nothing is asserted bare. */
  readonly evidence: string;
}

export interface EfficiencyPenalty {
  readonly label: string;
  readonly amount: number;
}

export interface OverEditAnalysis {
  readonly signals: readonly OverEditSignal[];
  /** 0–1, higher is more focused. Not a correctness score. */
  readonly change_efficiency_score: number;
  readonly penalties: readonly EfficiencyPenalty[];
  /** A small task produced a large change (§55). */
  readonly smallTaskMismatch: boolean;
  readonly duplicatedBlocks: readonly string[];
}

/** Consecutive added lines that must repeat before a block counts as duplicated. */
const DUPLICATE_BLOCK_LINES = 3;

/**
 * How much more raw churn than semantic change a task may produce before the
 * size mismatch fires. Reformatting is not free, but it is not the same offence
 * as writing four times the code that was asked for.
 */
const CHURN_ALLOWANCE = 4;

const GUARD_PATTERNS: readonly RegExp[] = [
  /^\s*if\s*\(!\s*\w+\s*\)\s*(return|throw|\{)/,
  /^\s*if\s*\(\s*\w+\s*===?\s*(null|undefined)\s*\)/,
  /^\s*if\s*\(\s*typeof\s+\w+\s*[!=]==?\s*["']undefined["']\s*\)/,
  /^\s*if\s+\w+\s+is\s+None\s*:/,
  /^\s*try\s*\{?\s*$/,
  /^\s*catch\s*\(/,
  /^\s*except\b/,
];

const VALIDATION_TERMS: readonly string[] = [
  "valid", "validation", "guard", "defensive", "null", "undefined", "error",
  "exception", "handle", "safety", "sanitiz", "check",
];

/**
 * Added blocks of identical logic appearing in more than one place.
 *
 * Catches the "worker duplicated a helper instead of importing it" pattern
 * (§50 item 11). Blank and comment lines are excluded so that repeated
 * boilerplate punctuation does not read as duplicated logic.
 */
function findDuplicatedBlocks(files: readonly FileDiff[]): string[] {
  const windows = new Map<string, Set<string>>();

  for (const file of files) {
    const style = commentStyle(file.path);
    const lines = changedLines(file)
      .filter((line) => line.kind === "added")
      .map((line) => line.text)
      .filter((text) => text.trim() !== "" && !isCommentLine(text, style))
      .map(normalizePresentation)
      .filter((text) => text.length > 3);

    for (let i = 0; i + DUPLICATE_BLOCK_LINES <= lines.length; i += 1) {
      const block = lines.slice(i, i + DUPLICATE_BLOCK_LINES).join("\n");
      const locations = windows.get(block) ?? new Set<string>();
      locations.add(`${file.path}:${i}`);
      windows.set(block, locations);
    }
  }

  return [...windows.entries()]
    .filter(([, locations]) => locations.size > 1)
    .map(([block]) => block)
    .sort()
    .slice(0, 10);
}

function countGuards(files: readonly FileDiff[]): number {
  let guards = 0;
  for (const file of files) {
    for (const line of changedLines(file)) {
      if (line.kind !== "added") continue;
      if (GUARD_PATTERNS.some((pattern) => pattern.test(line.text))) guards += 1;
    }
  }
  return guards;
}

function ratio(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.min(1, part / whole);
}

/**
 * Score how focused the change looks, and say why.
 *
 * The score starts at 1.0 and loses ground only for things that were counted:
 * unrelated files, presentation churn, comment noise, size overshoot and
 * whole-file rewrites. Every deduction is returned alongside the score so the
 * receipt can show the arithmetic instead of asserting a number.
 */
export function detectOverEditing(
  files: readonly FileDiff[],
  surface: ChangeSurface,
  comments: CommentNoise,
): OverEditAnalysis {
  const signals: OverEditSignal[] = [];
  const penalties: EfficiencyPenalty[] = [];
  const { expected } = surface;

  const totalChanged = surface.lines_added + surface.lines_removed;
  const unrelatedRatio = ratio(surface.unrelated_files.length, surface.files_changed);
  const formattingRatio = ratio(surface.formatting_lines, totalChanged);
  const rewriteRatio = ratio(surface.whole_file_rewrites, surface.files_changed);

  if (surface.unrelated_files.length > 0) {
    penalties.push({ label: "unrelated files", amount: unrelatedRatio * 0.35 });
    signals.push({
      id: "unrelated-files",
      severity: "warning",
      summary: `${surface.unrelated_files.length} file(s) share no vocabulary with the task`,
      evidence: surface.unrelated_files.slice(0, 8).join(", "),
    });
  }

  if (surface.formatting_lines > 0) {
    penalties.push({ label: "formatting noise", amount: formattingRatio * 0.25 });
  }
  if (surface.formatting_lines >= 20 && surface.formatting_lines > surface.semantic_lines * 3) {
    signals.push({
      id: "formatting-noise",
      severity: "warning",
      summary: "large formatting-only change detected",
      evidence: `${surface.semantic_lines} semantic line(s) vs ${surface.formatting_lines} presentation-only line(s)`,
    });
  }
  if (surface.formatting_only_changes > 0) {
    signals.push({
      id: "formatting-only-files",
      severity: "info",
      summary: `${surface.formatting_only_changes} file(s) changed presentation only`,
      evidence: surface.files
        .filter((file) => file.noise.formattingOnly)
        .map((file) => `${file.path} (${file.noise.formattingKinds.join(", ") || "whitespace"})`)
        .slice(0, 8)
        .join(", "),
    });
  }

  if (surface.comment_only_changes > 0) {
    signals.push({
      id: "comment-only-files",
      severity: "info",
      summary: `${surface.comment_only_changes} file(s) changed comments only`,
      evidence: surface.files
        .filter((file) => file.noise.commentOnly)
        .map((file) => file.path)
        .slice(0, 8)
        .join(", "),
    });
  }
  if (comments.restatingCount > 0) {
    penalties.push({
      label: "comment noise",
      amount: ratio(comments.restatingCount, Math.max(comments.added.length, 1)) * 0.1,
    });
    signals.push({
      id: "comment-noise",
      severity: "info",
      summary: `${comments.restatingCount} added comment(s) restate the code`,
      evidence: comments.added
        .filter((entry) => entry.verdict === "restates-code")
        .map((entry) => `${entry.path}: ${entry.text}`)
        .slice(0, 5)
        .join(" | "),
    });
  }
  if (comments.duplicated.length > 0) {
    signals.push({
      id: "duplicated-comments",
      severity: "info",
      summary: `${comments.duplicated.length} comment(s) added more than once`,
      evidence: comments.duplicated.slice(0, 5).join(" | "),
    });
  }

  if (surface.dependency_changes > 0) {
    penalties.push({ label: "dependency changes", amount: 0.1 });
    signals.push({
      id: "dependency-changes",
      severity: "warning",
      summary: `${surface.dependency_changes} dependency manifest or lock file changed`,
      evidence: surface.files
        .filter((file) => file.dependency)
        .map((file) => file.path)
        .join(", "),
    });
  }

  if (surface.generated_file_changes > 0) {
    signals.push({
      id: "generated-file-changes",
      severity: "info",
      summary: `${surface.generated_file_changes} generated or vendored file(s) changed`,
      evidence: surface.files
        .filter((file) => file.generated)
        .map((file) => file.path)
        .slice(0, 8)
        .join(", "),
    });
  }

  if (surface.rename_changes > 0) {
    signals.push({
      id: "rename-changes",
      severity: "info",
      summary: `${surface.rename_changes} file(s) renamed or moved`,
      evidence: surface.files
        .filter((file) => file.kind === "renamed")
        .map((file) => `${file.oldPath} → ${file.path}`)
        .join(", "),
    });
  }

  if (surface.import_only_changes > 0) {
    signals.push({
      id: "import-only-files",
      severity: "info",
      summary: `${surface.import_only_changes} file(s) changed imports only`,
      evidence: surface.files
        .filter((file) => file.noise.importOnly)
        .map((file) => file.path)
        .slice(0, 8)
        .join(", "),
    });
  }

  if (surface.whole_file_rewrites > 0) {
    penalties.push({ label: "whole-file rewrites", amount: rewriteRatio * 0.2 });
    signals.push({
      id: "whole-file-rewrite",
      severity: "warning",
      summary: `${surface.whole_file_rewrites} file(s) appear to have been rewritten in full`,
      evidence: surface.files
        .filter((file) => file.noise.wholeFileRewrite)
        .map((file) => `${file.path} (−${file.linesRemoved}/+${file.linesAdded})`)
        .join(", "),
    });
  }

  const duplicatedBlocks = findDuplicatedBlocks(files);
  if (duplicatedBlocks.length > 0) {
    penalties.push({ label: "duplicated logic", amount: 0.05 });
    signals.push({
      id: "duplicated-logic",
      severity: "info",
      summary: `${duplicatedBlocks.length} identical block(s) of ${DUPLICATE_BLOCK_LINES}+ added lines appear in more than one place`,
      evidence: duplicatedBlocks
        .slice(0, 2)
        .map((block) => block.split("\n").join(" ⏎ "))
        .join(" | "),
    });
  }

  const guards = countGuards(files);
  const taskMentionsValidation = VALIDATION_TERMS.some((term) =>
    expected.terms.some((taskTerm) => taskTerm.includes(term)),
  );
  if (guards >= 5 && !taskMentionsValidation) {
    signals.push({
      id: "defensive-code",
      severity: "info",
      summary: `${guards} guard clauses or try/catch blocks added by a task that did not ask for them`,
      evidence: "review whether the added error handling is required",
    });
  }

  // Size overshoot, measured against the task's expected surface.
  let smallTaskMismatch = false;
  if (expected.files !== undefined && surface.files_changed > expected.files) {
    signals.push({
      id: "multi-file-spread",
      severity: "warning",
      summary: `${surface.files_changed} files changed; a ${expected.size} task was expected to touch about ${expected.files}`,
      evidence: expected.reason,
    });
  }

  if (expected.lines !== undefined) {
    const semanticOvershoot = surface.semantic_lines / expected.lines;
    if (semanticOvershoot > 1) {
      penalties.push({
        label: "larger than expected",
        amount: Math.min(1, (semanticOvershoot - 1) / 4) * 0.3,
      });
    }

    // §55 measures the mismatch in raw lines, not semantic ones: a one-line fix
    // that reindents 300 lines is exactly the case this protects against, and
    // the reviewer still has to read all 300. Churn gets a looser allowance
    // than semantic change, but not an unlimited one.
    const churnOvershoot =
      (surface.lines_added + surface.lines_removed) / (expected.lines * CHURN_ALLOWANCE);
    const overshoot = Math.max(semanticOvershoot, churnOvershoot);

    const fileOvershoot =
      expected.files !== undefined && surface.files_changed > expected.files * 2;
    if (expected.size === "small" && (overshoot > 2 || fileOvershoot)) {
      smallTaskMismatch = true;
      signals.push({
        id: "small-task-large-change",
        severity: "warning",
        summary: "SMALL TASK / LARGE CHANGE MISMATCH",
        evidence:
          `expected about ${expected.files} file(s) and ${expected.lines} changed line(s); ` +
          `got ${surface.files_changed} file(s), +${surface.lines_added}/−${surface.lines_removed} ` +
          `(${surface.semantic_lines} semantic)`,
      });
    }
  }

  const deducted = penalties.reduce((total, penalty) => total + penalty.amount, 0);
  const score = Math.max(0, Math.min(1, 1 - deducted));

  return {
    signals,
    change_efficiency_score: Number(score.toFixed(2)),
    penalties: penalties.map((penalty) => ({
      label: penalty.label,
      amount: Number(penalty.amount.toFixed(3)),
    })),
    smallTaskMismatch,
    duplicatedBlocks,
  };
}
