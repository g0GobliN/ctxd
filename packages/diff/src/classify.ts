/**
 * Diff Firewall decision (§57).
 *
 * The classification is a routing decision, not a verdict on the code. It
 * answers "should a human look at this before it goes further?" and it must
 * always be able to show the evidence it used — §57 forbids arbitrary
 * judgements, so every branch here records the counted facts that produced it.
 */

import type { OverEditAnalysis } from "./overedit.js";
import type { ChangeSurface } from "./surface.js";

export type VerificationStatus = "PASS" | "FAIL" | "NEEDS_REVIEW" | "UNKNOWN";

export type ChangeClassification =
  | "FOCUSED"
  | "ACCEPTABLE"
  | "BROAD"
  | "SUSPICIOUS"
  | "NEEDS_REVIEW";

export type Risk = "low" | "medium" | "high";

export interface ClassificationResult {
  readonly classification: ChangeClassification;
  readonly risk: Risk;
  /** Evidence for the classification, most decisive first. */
  readonly reasons: readonly string[];
  /** What ctxd suggests the human does next. Advice only. */
  readonly recommendation: string;
}

export interface ClassifyOptions {
  readonly verification?: VerificationStatus | undefined;
  /** Architecture rules the change violated, if any were checked. */
  readonly architectureViolations?: readonly string[] | undefined;
}

const FOCUSED_SCORE = 0.85;
const ACCEPTABLE_SCORE = 0.65;
const BROAD_SCORE = 0.45;

/**
 * Classify a change from its measured surface.
 *
 * Order matters and is fixed: hard evidence that a human must look (a failed
 * verification, a violated architecture rule, a small task that produced a
 * large change) outranks the efficiency score, because those are facts while
 * the score is a heuristic.
 */
export function classifyChange(
  surface: ChangeSurface,
  overEdit: OverEditAnalysis,
  options: ClassifyOptions = {},
): ClassificationResult {
  const reasons: string[] = [];
  const score = overEdit.change_efficiency_score;
  const violations = options.architectureViolations ?? [];

  if (surface.files_changed === 0) {
    return {
      classification: "FOCUSED",
      risk: "low",
      reasons: ["no files changed"],
      recommendation: "Nothing to review.",
    };
  }

  const summary =
    `${surface.files_changed} file(s), +${surface.lines_added}/−${surface.lines_removed}, ` +
    `${surface.semantic_lines} semantic line(s), efficiency ${score.toFixed(2)}`;

  if (violations.length > 0) {
    return {
      classification: "NEEDS_REVIEW",
      risk: "high",
      reasons: [`architecture rule violated: ${violations.join("; ")}`, summary],
      recommendation: "Resolve the architecture violation before continuing.",
    };
  }

  if (options.verification === "FAIL") {
    return {
      classification: "NEEDS_REVIEW",
      risk: "high",
      reasons: ["verification failed", summary],
      recommendation: "Fix the failing verification before judging the diff's shape.",
    };
  }

  if (overEdit.smallTaskMismatch) {
    return {
      classification: "NEEDS_REVIEW",
      risk: "high",
      reasons: [
        "small task produced a large change",
        overEdit.signals.find((signal) => signal.id === "small-task-large-change")?.evidence ??
          summary,
      ],
      recommendation:
        "Review the diff before treating the task as complete — the extra work may be unnecessary.",
    };
  }

  const warnings = overEdit.signals.filter((signal) => signal.severity === "warning");
  for (const signal of warnings) reasons.push(`${signal.summary} (${signal.evidence})`);
  reasons.push(summary);

  if (score < BROAD_SCORE && (surface.unrelated_files.length > 0 || surface.whole_file_rewrites > 0)) {
    return {
      classification: "SUSPICIOUS",
      risk: "high",
      reasons,
      recommendation:
        "Review before continuing. A large diff is not wrong by itself — check whether the extra files and rewrites were required.",
    };
  }

  if (score < ACCEPTABLE_SCORE) {
    return {
      classification: "BROAD",
      risk: "medium",
      reasons,
      recommendation: "Skim the diff for changes the task did not require.",
    };
  }

  if (score < FOCUSED_SCORE || warnings.length > 0) {
    return {
      classification: "ACCEPTABLE",
      risk: surface.dependency_changes > 0 ? "medium" : "low",
      reasons,
      recommendation:
        surface.dependency_changes > 0
          ? "Confirm the dependency change was intended."
          : "No action needed beyond normal review.",
    };
  }

  if (options.verification === "UNKNOWN" || options.verification === undefined) {
    reasons.push("verification not run");
  }

  return {
    classification: "FOCUSED",
    risk: "low",
    reasons,
    recommendation: "Minimal focused change — normal review is enough.",
  };
}
