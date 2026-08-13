/**
 * Comment noise reduction (§54).
 *
 * A comment earns its place by saying something the code cannot: why unusual
 * behaviour exists, what an external API does wrong, which rule must not be
 * broken. A comment that restates the line beneath it is noise.
 *
 * ctxd never deletes a comment. It flags the restatements so durable reasoning
 * can be moved into project memory instead of accumulating in source files, and
 * it keeps anything that looks like an explanation even when unsure.
 */

import { type FileDiff } from "./parse.js";
import { commentStyle, commentText, isCommentLine } from "./syntax.js";
import { normalizeTerms } from "@ctxd/context";

export type CommentVerdict = "keep" | "restates-code" | "unclear";

export interface AddedComment {
  readonly path: string;
  readonly text: string;
  readonly verdict: CommentVerdict;
  /** Why the verdict was reached, for the receipt. */
  readonly reason: string;
}

export interface CommentJudgement {
  readonly verdict: CommentVerdict;
  readonly reason: string;
}

export interface CommentNoise {
  readonly added: readonly AddedComment[];
  readonly keptCount: number;
  readonly restatingCount: number;
  /** Comment texts added more than once across the diff. */
  readonly duplicated: readonly string[];
}

/**
 * Words that mark a comment as carrying reasoning rather than narration.
 *
 * Deliberately broad: keeping a redundant comment costs nothing, while flagging
 * a comment that records a security constraint or an API quirk is exactly the
 * mistake this feature exists to prevent.
 */
const REASONING_MARKERS: readonly string[] = [
  "because", "why", "reason", "so that", "otherwise", "must", "must not",
  "never", "do not", "don't", "avoid", "careful", "caution", "warning",
  "security", "secure", "auth", "token", "secret", "credential", "injection",
  "race", "deadlock", "thread", "concurren", "idempot", "retry", "retries",
  "timeout", "workaround", "hack", "bug", "issue", "quirk", "known",
  "intentional", "deliberate", "on purpose", "invariant", "assumption",
  "assumes", "requires", "constraint", "contract", "spec", "rfc", "standard",
  "compat", "legacy", "deprecated", "breaking", "performance", "expensive",
  "cache", "order matters", "side effect", "business", "rule", "policy",
  "decision", "see ", "ref ", "http://", "https://", "todo", "fixme", "hack:",
  "note:", "important",
];

/** Openers of a comment that narrates the next line. */
const NARRATION_OPENERS: readonly RegExp[] = [
  /^check(s|ing)?\s+(if|whether|for)\b/,
  /^(set|sets|setting)\b/,
  /^(get|gets|getting)\b/,
  /^(return|returns)\b/,
  /^(loop|loops|iterate|iterates|iterating)\b/,
  /^(initiali[sz]e|initiali[sz]ing)\b/,
  /^(create|creates|creating)\b/,
  /^(declare|declares|define|defines)\b/,
  /^(increment|decrement)\b/,
  /^(call|calls|calling)\b/,
  /^(import|imports)\b/,
  /^(add|adds|append|appends)\b/,
  /^(remove|removes|delete|deletes)\b/,
  /^(assign|assigns)\b/,
  /^(start|starts|begin|begins)\b/,
  /^(handle|handles)\s+the\b/,
  /^(this|the)\s+(function|method|class|variable|constant|field)\b/,
];

/** Overlap above which a comment is considered a restatement of its code. */
const RESTATEMENT_OVERLAP = 0.6;

/**
 * Is this line part of a documentation block rather than an inline comment?
 *
 * Covers JSDoc/TSDoc (`/**`, ` * `), Python and Ruby docstrings, and XML doc
 * comments (`///`).
 */
export function isDocBlockLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("/**") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("///") ||
    trimmed.startsWith('"""') ||
    trimmed.startsWith("'''") ||
    trimmed.startsWith("##")
  );
}

function overlapWithCode(comment: string, code: string): number {
  const commentTerms = new Set(normalizeTerms(comment));
  if (commentTerms.size === 0) return 0;

  const codeTerms = new Set(normalizeTerms(code));
  if (codeTerms.size === 0) return 0;

  let shared = 0;
  for (const term of commentTerms) {
    if (codeTerms.has(term)) shared += 1;
  }
  return shared / commentTerms.size;
}

/**
 * Judge one added comment against the code line that follows it.
 *
 * The bar for flagging is high on purpose: a comment is only called a
 * restatement when it carries no reasoning marker *and* either opens with
 * narration or largely repeats the identifiers on the next line.
 */
export function judgeComment(
  text: string,
  followingCode?: string | undefined,
): CommentJudgement {
  const body = commentText(text);
  const lower = body.toLowerCase();

  if (body === "") return { verdict: "keep", reason: "comment marker only" };

  // A documentation block describes an API for its callers; it is not narrating
  // the statement below it, so the restatement test does not apply. Judging a
  // doc block line by line would flag ordinary API documentation as noise.
  if (isDocBlockLine(text)) {
    return { verdict: "keep", reason: "documentation block" };
  }

  const marker = REASONING_MARKERS.find((needle) => lower.includes(needle));
  if (marker !== undefined) {
    return { verdict: "keep", reason: `explains reasoning ("${marker.trim()}")` };
  }

  // A long comment is usually carrying context even without a marker word.
  if (normalizeTerms(body).length > 14) {
    return { verdict: "keep", reason: "substantial explanation" };
  }

  if (NARRATION_OPENERS.some((pattern) => pattern.test(lower))) {
    return { verdict: "restates-code", reason: "narrates the following statement" };
  }

  if (followingCode !== undefined) {
    const overlap = overlapWithCode(body, followingCode);
    if (overlap >= RESTATEMENT_OVERLAP) {
      return {
        verdict: "restates-code",
        reason: `repeats ${Math.round(overlap * 100)}% of the next line's identifiers`,
      };
    }
  }

  return { verdict: "unclear", reason: "no reasoning marker, but not obviously redundant" };
}

/**
 * Collect and judge every whole-line comment the diff adds.
 *
 * Only added comments are judged. A comment the worker *removed* is a semantic
 * event for the reviewer, not noise to be graded.
 */
export function analyzeComments(files: readonly FileDiff[]): CommentNoise {
  const added: AddedComment[] = [];
  const seen = new Map<string, number>();

  for (const file of files) {
    const style = commentStyle(file.path);
    if (style === "none") continue;

    for (const hunk of file.hunks) {
      for (let i = 0; i < hunk.lines.length; i += 1) {
        const line = hunk.lines[i];
        if (line === undefined || line.kind !== "added") continue;
        if (!isCommentLine(line.text, style)) continue;

        // The next added or context line is what this comment describes.
        let following: string | undefined;
        for (let j = i + 1; j < hunk.lines.length; j += 1) {
          const candidate = hunk.lines[j];
          if (candidate === undefined || candidate.kind === "removed") continue;
          if (candidate.text.trim() === "") continue;
          if (isCommentLine(candidate.text, style)) continue;
          following = candidate.text;
          break;
        }

        const { verdict, reason } = judgeComment(line.text, following);
        added.push({ path: file.path, text: line.text.trim(), verdict, reason });

        const body = commentText(line.text);
        if (body !== "") seen.set(body, (seen.get(body) ?? 0) + 1);
      }
    }
  }

  const duplicated = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([body]) => body)
    .sort();

  return {
    added,
    keptCount: added.filter((entry) => entry.verdict === "keep").length,
    restatingCount: added.filter((entry) => entry.verdict === "restates-code").length,
    duplicated,
  };
}
