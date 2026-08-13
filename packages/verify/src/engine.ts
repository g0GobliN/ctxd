/**
 * Verification engine (§43).
 *
 * After a worker changes code, ctxd runs the project's own checks and reports
 * PASS, FAIL or NEEDS_REVIEW. Two rules matter more than the mechanics:
 *
 * 1. A check that did not run is never reported as passed (§0, §13).
 * 2. A check with nothing to verify is not a pass either — a repository with no
 *    tests yields NEEDS_REVIEW, not a clean bill of health.
 */

import { detectDrift, type ArchitectureRule, type ArchitectureViolation } from "./architecture.js";
import { discoverChecks, type CheckDefinition, type CheckKind } from "./checks.js";
import { runCommand, type CommandOutcome, type RunOptions } from "./commands.js";
import { readDiff, type FileDiff } from "@ctxd/diff";

export type VerificationStatus = "PASS" | "FAIL" | "NEEDS_REVIEW" | "UNKNOWN";

export type CheckStatus = "passed" | "failed" | "unavailable" | "skipped";

export interface CheckResult {
  readonly kind: CheckKind;
  readonly status: CheckStatus;
  readonly command: string;
  readonly exitCode: number | undefined;
  readonly durationMs: number;
  /** Why the check ended this way; always populated for non-passes. */
  readonly detail: string;
  /** Trimmed output, kept only for failures — a pass has nothing to explain. */
  readonly output?: string;
}

export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly checks: readonly CheckResult[];
  readonly violations: readonly ArchitectureViolation[];
  /** Files the worker changed, as verified against Git. */
  readonly changedFiles: readonly string[];
  readonly reasons: readonly string[];
  readonly timestamp: string;
}

export interface VerifyOptions {
  readonly cwd: string;
  /** Restrict to these checks; default is everything discovered. */
  readonly only?: readonly CheckKind[];
  readonly rules?: readonly ArchitectureRule[];
  /** Pre-read diff, when the caller already has one. */
  readonly files?: readonly FileDiff[];
  readonly timeoutMs?: number;
  /** Skip running commands; report what *would* run. */
  readonly dryRun?: boolean;
}

/** How much of a failing command's output to keep. */
const OUTPUT_KEEP_LINES = 40;

function trimOutput(outcome: CommandOutcome): string {
  const combined = `${outcome.stdout}\n${outcome.stderr}`.trim();
  const lines = combined.split("\n");
  if (lines.length <= OUTPUT_KEEP_LINES) return combined;
  // Keep the tail: compilers and test runners put the summary last.
  return [`… ${lines.length - OUTPUT_KEEP_LINES} earlier lines omitted`, ...lines.slice(-OUTPUT_KEEP_LINES)].join("\n");
}

function toResult(definition: CheckDefinition, outcome: CommandOutcome): CheckResult {
  if (!outcome.ran) {
    return {
      kind: definition.kind,
      status: "unavailable",
      command: outcome.command,
      exitCode: undefined,
      durationMs: outcome.durationMs,
      detail: outcome.refusedReason ?? "the command did not run",
    };
  }

  if (outcome.exitCode === 0) {
    return {
      kind: definition.kind,
      status: "passed",
      command: outcome.command,
      exitCode: 0,
      durationMs: outcome.durationMs,
      detail: `${definition.source} exited 0`,
    };
  }

  return {
    kind: definition.kind,
    status: "failed",
    command: outcome.command,
    exitCode: outcome.exitCode,
    durationMs: outcome.durationMs,
    detail: `exited ${outcome.exitCode ?? "abnormally"}`,
    output: trimOutput(outcome),
  };
}

/**
 * Run verification for a working tree.
 *
 * Checks run in a fixed order — typecheck, lint, test, build — so a fast,
 * precise failure is reported before a slow one. Every check still runs even
 * after an earlier failure: a reviewer wants the whole picture, and stopping
 * early would hide a second problem behind the first.
 */
export function verify(options: VerifyOptions): VerificationResult {
  const timestamp = new Date().toISOString();
  const discovered = discoverChecks(options.cwd);
  const order: readonly CheckKind[] = ["typecheck", "lint", "test", "build"];

  const selected = order
    .flatMap((kind) => discovered.filter((check) => check.kind === kind))
    .filter((check) => options.only === undefined || options.only.includes(check.kind));

  const files = options.files ?? readDiff({ cwd: options.cwd }).files;
  const changedFiles = files.map((file) => file.path);

  const runOptions: RunOptions = {
    cwd: options.cwd,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  };

  const checks: CheckResult[] = selected.map((definition) => {
    if (options.dryRun === true) {
      return {
        kind: definition.kind,
        status: "skipped" as const,
        command: [definition.command, ...definition.args].join(" "),
        exitCode: undefined,
        durationMs: 0,
        detail: "dry run — not executed",
      };
    }
    return toResult(definition, runCommand(definition.command, definition.args, runOptions));
  });

  const { violations, errors } = detectDrift(files, options.rules ?? []);

  const reasons: string[] = [];
  for (const error of errors) reasons.push(error);

  const failed = checks.filter((check) => check.status === "failed");
  const passed = checks.filter((check) => check.status === "passed");
  const unavailable = checks.filter((check) => check.status === "unavailable");

  for (const check of failed) reasons.push(`${check.kind} failed: ${check.detail}`);
  for (const check of unavailable) reasons.push(`${check.kind} unavailable: ${check.detail}`);
  if (violations.length > 0) {
    reasons.push(`${violations.length} architecture rule violation(s)`);
  }

  let status: VerificationStatus;
  if (options.dryRun === true) {
    status = "UNKNOWN";
    reasons.push("dry run — no check was executed");
  } else if (failed.length > 0) {
    status = "FAIL";
  } else if (violations.length > 0) {
    // Drift is a design problem, not a broken build: it needs a person, not a
    // failure verdict.
    status = "NEEDS_REVIEW";
  } else if (passed.length === 0) {
    status = "NEEDS_REVIEW";
    reasons.push(
      selected.length === 0
        ? "no verification checks are configured for this project"
        : "no check completed successfully",
    );
  } else if (unavailable.length > 0) {
    status = "NEEDS_REVIEW";
  } else {
    status = "PASS";
  }

  return { status, checks, violations, changedFiles, reasons, timestamp };
}

/** Render a verification result for a human. */
export function formatVerification(result: VerificationResult): string {
  const lines: string[] = [`VERIFICATION ${result.status}`, ""];

  if (result.checks.length === 0) {
    lines.push("No checks discovered for this project.");
  } else {
    for (const check of result.checks) {
      const mark =
        check.status === "passed" ? "✓" : check.status === "failed" ? "✗" : "—";
      const timing = check.durationMs > 0 ? ` (${(check.durationMs / 1000).toFixed(1)}s)` : "";
      lines.push(`  ${mark} ${check.kind.padEnd(10)} ${check.command}${timing}`);
      if (check.status !== "passed") lines.push(`      ${check.detail}`);
    }
  }

  if (result.violations.length > 0) {
    lines.push("", "Architecture:");
    for (const violation of result.violations) {
      lines.push(`  ! ${violation.rule}`);
      lines.push(`      ${violation.path}: ${violation.line}`);
    }
  }

  if (result.changedFiles.length > 0) {
    lines.push("", `Changed files (${result.changedFiles.length}):`);
    for (const path of result.changedFiles.slice(0, 15)) lines.push(`  · ${path}`);
    if (result.changedFiles.length > 15) {
      lines.push(`  … and ${result.changedFiles.length - 15} more`);
    }
  }

  if (result.reasons.length > 0) {
    lines.push("", "Why:");
    for (const reason of result.reasons) lines.push(`  · ${reason}`);
  }

  return lines.join("\n");
}
