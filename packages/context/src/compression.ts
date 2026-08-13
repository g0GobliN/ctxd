import { heuristicEstimator, type TokenEstimator } from "./estimator.js";
import { normalizeTerms, type TaskSignals } from "./task.js";
import type { ContextItem } from "./types.js";

/** Lines kept on each side of a relevant line, to preserve local meaning. */
const CONTEXT_WINDOW = 2;

/**
 * Structural lines worth keeping even when they do not mention the task:
 * imports, exports, declaration signatures and headings.
 *
 * Indentation matters. A top-level `const` is part of a module's shape; a
 * `const` four levels deep is a local variable inside a function body, and
 * keeping every one of those would mean never compressing source at all.
 * Declarations are therefore only structural near the left margin, where
 * module- and class-level definitions live.
 *
 * Regex-based on purpose — AST parsing is a later optimisation, not a V1
 * requirement.
 */
const STRUCTURAL_PATTERNS: readonly RegExp[] = [
  // Imports and exports at any depth: they define the file's connections.
  /^\s*import\s/,
  /^\s*export\s/,
  /^\s*from\s+\S+\s+import\s/,
  // Declarations at module or class level (up to two spaces of indentation).
  /^ {0,2}(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(?:function|class|interface|type|enum|def|fn|struct|impl)\s/,
  // Bindings only at column 0: anything indented is a local inside a body.
  /^(?:export\s+)?(?:const|let|var)\s/,
  // Class method signatures, e.g. `  async handle(request: Request) {`.
  /^ {2}(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*[A-Za-z_$][\w$]*\s*\(/,
  // Markdown headings.
  /^#{1,6}\s/,
  // Decorators and doc-comment openers.
  /^\s*(?:@\w|\/\*\*)/,
];

function isStructural(line: string): boolean {
  return STRUCTURAL_PATTERNS.some((pattern) => pattern.test(line));
}

export interface CompressionResult {
  readonly content: string;
  readonly tokenCount: number;
  readonly compressed: boolean;
  /** Estimated tokens removed from this item's representation. */
  readonly savedTokens: number;
}

export interface CompressOptions {
  readonly estimator?: TokenEstimator;
  /** Items at or below this size are left untouched. */
  readonly minTokensToCompress?: number;
}

const DEFAULT_MIN_TOKENS = 400;

/**
 * Deterministically shrink one item's representation.
 *
 * No model is involved. Structural lines and lines matching the task's
 * vocabulary are kept along with a small surrounding window; everything else
 * collapses into an explicit elision marker so the worker can see that
 * material was omitted rather than silently losing it.
 *
 * The file on disk is never modified — only this representation changes.
 */
export function compressItem(
  item: ContextItem,
  signals: TaskSignals,
  options: CompressOptions = {},
): CompressionResult {
  const estimator = options.estimator ?? heuristicEstimator;
  const minTokens = options.minTokensToCompress ?? DEFAULT_MIN_TOKENS;

  if (item.tokenCount <= minTokens) {
    return {
      content: item.content,
      tokenCount: item.tokenCount,
      compressed: false,
      savedTokens: 0,
    };
  }

  const lines = item.content.split("\n");
  const terms = new Set(signals.terms);
  const keep = new Array<boolean>(lines.length).fill(false);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;

    const relevant =
      isStructural(line) || normalizeTerms(line).some((term) => terms.has(term));
    if (!relevant) continue;

    const from = Math.max(0, i - CONTEXT_WINDOW);
    const to = Math.min(lines.length - 1, i + CONTEXT_WINDOW);
    for (let j = from; j <= to; j += 1) keep[j] = true;
  }

  if (keep.every((value) => !value)) {
    // Nothing matched: keep the head so the item still carries some meaning.
    for (let i = 0; i < Math.min(lines.length, 20); i += 1) keep[i] = true;
  }

  const out: string[] = [];
  let omitted = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (keep[i] === true) {
      if (omitted > 0) {
        out.push(`… ${omitted} line${omitted === 1 ? "" : "s"} omitted …`);
        omitted = 0;
      }
      out.push(lines[i] as string);
    } else {
      omitted += 1;
    }
  }
  if (omitted > 0) out.push(`… ${omitted} line${omitted === 1 ? "" : "s"} omitted …`);

  const content = out.join("\n");
  const tokenCount = estimator.count(content);

  // Compression that does not actually help is discarded.
  if (tokenCount >= item.tokenCount) {
    return {
      content: item.content,
      tokenCount: item.tokenCount,
      compressed: false,
      savedTokens: 0,
    };
  }

  return {
    content,
    tokenCount,
    compressed: true,
    savedTokens: item.tokenCount - tokenCount,
  };
}
