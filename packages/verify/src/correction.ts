/**
 * Correction context (§43, §60).
 *
 * When verification fails, the wrong move is to resend the original context and
 * hope. The worker already has it; resending costs the whole budget again and
 * buries the one new fact — the error — in material the worker has already read.
 *
 * A correction context carries only what changed since the worker last looked:
 * the failed command, the relevant part of its error, the code the error points
 * at, the requirement, and any rule that applies. Nothing else.
 */

import { estimateTokens } from "@ctxd/context";
import type { CheckResult, VerificationResult } from "./engine.js";

export interface CorrectionSource {
  /** Read a file from the repository, or return undefined if unreadable. */
  (path: string): string | undefined;
}

export interface CorrectionOptions {
  /** What the worker was asked to do. */
  readonly task: string;
  readonly result: VerificationResult;
  /** Reads file contents; injected so this stays a pure function in tests. */
  readonly readFile?: CorrectionSource;
  /** Rules or decisions that bear on the failure. */
  readonly rules?: readonly string[];
  /** A previous failed attempt, included only when it is likely to help. */
  readonly previousAttempt?: string | undefined;
  /** Lines of code to show around each error location. */
  readonly contextLines?: number;
  /** Cap on the whole correction context. */
  readonly maxTokens?: number;
}

export interface ErrorLocation {
  readonly path: string;
  readonly line: number | undefined;
  readonly message: string;
}

export interface CorrectionContext {
  readonly text: string;
  readonly estimatedTokens: number;
  readonly locations: readonly ErrorLocation[];
  /** What was deliberately left out, so the omission is visible. */
  readonly omitted: readonly string[];
}

const DEFAULT_CONTEXT_LINES = 6;
const DEFAULT_MAX_TOKENS = 2000;

/**
 * Patterns that carry a file and line out of compiler and runner output.
 *
 * Covers `path(12,3): error`, `path:12:3`, and `at path:12:3`, which between
 * them handle tsc, eslint, node, jest, vitest, cargo, go and python.
 */
const LOCATION_PATTERNS: readonly RegExp[] = [
  /(?:^|\s)([\w./\\-]+\.\w+)\((\d+),\d+\)/,
  /(?:^|\s|\()([\w./\\-]+\.\w+):(\d+):\d+/,
  /(?:^|\s)File "([^"]+)", line (\d+)/,
];

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Pull the file/line references out of a failing check's output. */
export function extractLocations(output: string, limit = 5): ErrorLocation[] {
  const locations: ErrorLocation[] = [];
  const seen = new Set<string>();

  for (const raw of output.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    for (const pattern of LOCATION_PATTERNS) {
      const match = line.match(pattern);
      if (match === null) continue;

      const path = normalizePath(match[1] ?? "");
      const number = Number.parseInt(match[2] ?? "", 10);
      if (path === "" || !Number.isFinite(number)) continue;

      const key = `${path}:${number}`;
      if (seen.has(key)) break;
      seen.add(key);
      locations.push({ path, line: number, message: line });
      break;
    }

    if (locations.length >= limit) break;
  }

  return locations;
}

/** The lines around an error, with a gutter so the worker can cite them back. */
function excerpt(content: string, line: number | undefined, radius: number): string {
  const lines = content.split("\n");
  if (line === undefined) return lines.slice(0, radius * 2).join("\n");

  const start = Math.max(0, line - 1 - radius);
  const end = Math.min(lines.length, line + radius);
  const width = String(end).length;

  return lines
    .slice(start, end)
    .map((text, index) => {
      const number = start + index + 1;
      const marker = number === line ? ">" : " ";
      return `${marker} ${String(number).padStart(width)} | ${text}`;
    })
    .join("\n");
}

/**
 * Build the compact context for a failed verification.
 *
 * Returns an empty context when nothing failed: there is no correction to make,
 * and inventing one would spend tokens saying so.
 */
export function buildCorrectionContext(options: CorrectionOptions): CorrectionContext {
  const { result } = options;
  const radius = options.contextLines ?? DEFAULT_CONTEXT_LINES;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const omitted: string[] = [];

  const failures: CheckResult[] = result.checks.filter((check) => check.status === "failed");

  if (failures.length === 0 && result.violations.length === 0) {
    return {
      text: "",
      estimatedTokens: 0,
      locations: [],
      omitted: ["nothing failed — no correction context is needed"],
    };
  }

  const sections: string[] = [
    "CORRECTION CONTEXT",
    "",
    "This is not the original context. It contains only what changed: the",
    "failure and the code it points at. You already have the rest.",
    "",
    `Requirement: ${options.task}`,
  ];

  const locations: ErrorLocation[] = [];

  for (const failure of failures) {
    sections.push("", `Failed: ${failure.command}`, `Result: ${failure.detail}`);

    const output = failure.output ?? "";
    if (output !== "") {
      const found = extractLocations(output);
      locations.push(...found);

      // The error message itself, not the whole run log.
      const relevant = found.length > 0
        ? found.map((location) => location.message).join("\n")
        : output.split("\n").slice(-12).join("\n");
      sections.push("", "Error:", relevant);

      if (found.length === 0) omitted.push(`${failure.kind}: no file/line found in the output`);
    }
  }

  for (const violation of result.violations) {
    sections.push(
      "",
      "Architecture rule violated:",
      violation.rule,
      `${violation.path}${violation.lineNumber === undefined ? "" : `:${violation.lineNumber}`}`,
      `  ${violation.line}`,
    );
    locations.push({
      path: violation.path,
      line: violation.lineNumber,
      message: violation.rule,
    });
  }

  const readFile = options.readFile;
  if (readFile !== undefined) {
    const shown = new Set<string>();
    for (const location of locations) {
      if (shown.has(location.path)) continue;
      shown.add(location.path);

      const content = readFile(location.path);
      if (content === undefined) {
        omitted.push(`${location.path}: could not be read`);
        continue;
      }
      sections.push("", `${location.path}:`, excerpt(content, location.line, radius));
    }
  } else if (locations.length > 0) {
    omitted.push("file excerpts (no file reader supplied)");
  }

  if (options.rules !== undefined && options.rules.length > 0) {
    sections.push("", "Rules that apply:");
    for (const rule of options.rules) sections.push(`  · ${rule}`);
  }

  // §59: a previous attempt is only worth resending when the worker would
  // otherwise repeat it. It is the first thing dropped under budget pressure.
  if (options.previousAttempt !== undefined && options.previousAttempt !== "") {
    sections.push("", "Previous attempt (do not repeat it):", options.previousAttempt);
  }

  let text = sections.join("\n");
  let estimated = estimateTokens(text);

  if (estimated > maxTokens && options.previousAttempt !== undefined) {
    const index = sections.indexOf("Previous attempt (do not repeat it):");
    if (index > 0) {
      sections.splice(index - 1);
      omitted.push("previous attempt (over budget)");
      text = sections.join("\n");
      estimated = estimateTokens(text);
    }
  }

  return { text, estimatedTokens: estimated, locations, omitted };
}
