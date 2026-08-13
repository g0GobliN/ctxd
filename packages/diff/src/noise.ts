/**
 * Formatting noise detection (§53).
 *
 * The question this answers is "how much of this diff can a runtime actually
 * observe?" A removed line and an added line that differ only in indentation,
 * line endings, quote style or trailing punctuation are the same line wearing
 * different clothes — churn, not change.
 *
 * Nothing here reverts anything. The firewall reports the split between
 * semantic and presentation-only changes and leaves the worker's output intact.
 */

import { changedLines, type FileDiff } from "./parse.js";
import {
  commentStyle,
  isCommentLine,
  isImportLine,
  normalizePresentation,
} from "./syntax.js";

export type FormattingKind =
  | "line-endings"
  | "indentation"
  | "whitespace"
  | "quote-style"
  | "trailing-punctuation"
  | "blank-lines"
  | "import-order"
  | "whole-file-format";

export interface FileNoise {
  readonly path: string;
  /** Added plus removed lines, as Git counted them. */
  readonly changedLines: number;
  /** Changed lines that pair up as presentation-only churn. */
  readonly formattingLines: number;
  /** Changed lines a runtime can observe. */
  readonly semanticLines: number;
  readonly semanticAdded: number;
  readonly semanticRemoved: number;
  /** Semantic changed lines that are whole-line comments. */
  readonly commentLines: number;
  /** Semantic changed lines that are import statements. */
  readonly importLines: number;
  /** Semantic changed lines that are neither comment nor blank nor import. */
  readonly codeLines: number;
  /** Churn but no observable change. */
  readonly formattingOnly: boolean;
  /** Every semantic change is a comment. */
  readonly commentOnly: boolean;
  /** Every semantic change is an import statement. */
  readonly importOnly: boolean;
  /** The whole file appears to have been rewritten. */
  readonly wholeFileRewrite: boolean;
  /** Which presentation differences were observed, in a stable order. */
  readonly formattingKinds: readonly FormattingKind[];
}

const KIND_ORDER: readonly FormattingKind[] = [
  "line-endings",
  "indentation",
  "whitespace",
  "quote-style",
  "trailing-punctuation",
  "blank-lines",
  "import-order",
  "whole-file-format",
];

function stripCarriageReturn(line: string): string {
  return line.replace(/\r$/, "");
}

function collapseWhitespace(line: string): string {
  return stripCarriageReturn(line).replace(/\s+/g, " ").trim();
}

function foldQuotes(line: string): string {
  return collapseWhitespace(line).replace(/'/g, '"');
}

/** Why did these two lines pair up? The first matching rule wins. */
function formattingKindOf(removed: string, added: string): FormattingKind {
  if (stripCarriageReturn(removed) === stripCarriageReturn(added)) return "line-endings";
  if (stripCarriageReturn(removed).trim() === stripCarriageReturn(added).trim()) {
    return "indentation";
  }
  if (collapseWhitespace(removed) === collapseWhitespace(added)) return "whitespace";
  if (foldQuotes(removed) === foldQuotes(added)) return "quote-style";
  return "trailing-punctuation";
}

function groupByKey(texts: readonly string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const text of texts) {
    const key = normalizePresentation(text);
    const bucket = groups.get(key);
    if (bucket === undefined) groups.set(key, [text]);
    else bucket.push(text);
  }
  return groups;
}

/**
 * Split one file's diff into semantic change and presentation-only churn.
 *
 * Pairing is done across the whole file rather than per hunk: a formatter run
 * moves lines between hunks, and pairing per hunk would report the move as
 * genuine change.
 */
export function analyzeFileNoise(file: FileDiff): FileNoise {
  const lines = changedLines(file);
  const style = commentStyle(file.path);

  const removedTexts = lines.filter((line) => line.kind === "removed").map((line) => line.text);
  const addedTexts = lines.filter((line) => line.kind === "added").map((line) => line.text);

  const removedGroups = groupByKey(removedTexts);
  const addedGroups = groupByKey(addedTexts);

  const kinds = new Set<FormattingKind>();
  let formattingLines = 0;
  const semanticRemoved: string[] = [];
  const semanticAdded: string[] = [];
  const pairedTexts: Array<{ removed: string; added: string }> = [];

  for (const [key, removedBucket] of removedGroups) {
    const addedBucket = addedGroups.get(key) ?? [];
    const pairs = Math.min(removedBucket.length, addedBucket.length);

    for (let i = 0; i < pairs; i += 1) {
      const removed = removedBucket[i] as string;
      const added = addedBucket[i] as string;
      // A blank line on both sides is whitespace churn with no other story.
      if (key === "") kinds.add("blank-lines");
      else {
        kinds.add(formattingKindOf(removed, added));
        pairedTexts.push({ removed, added });
      }
    }

    formattingLines += pairs * 2;
    for (let i = pairs; i < removedBucket.length; i += 1) {
      semanticRemoved.push(removedBucket[i] as string);
    }
  }

  for (const [key, addedBucket] of addedGroups) {
    const pairs = Math.min(removedGroups.get(key)?.length ?? 0, addedBucket.length);
    for (let i = pairs; i < addedBucket.length; i += 1) {
      semanticAdded.push(addedBucket[i] as string);
    }
  }

  const semantic = [...semanticRemoved, ...semanticAdded];
  const semanticNonBlank = semantic.filter((text) => text.trim() !== "");
  const commentLines = semanticNonBlank.filter((text) => isCommentLine(text, style)).length;
  const importLines = semanticNonBlank.filter(
    (text) => !isCommentLine(text, style) && isImportLine(text),
  ).length;
  const codeLines = semanticNonBlank.length - commentLines - importLines;

  if (
    pairedTexts.length >= 2 &&
    pairedTexts.every((pair) => isImportLine(pair.removed) && isImportLine(pair.added))
  ) {
    kinds.add("import-order");
  }

  // A hunk's `oldLines` includes its context, so the summed span is a fair
  // stand-in for how much of the file the diff touched.
  const oldSpan = file.hunks.reduce((total, hunk) => total + hunk.oldLines, 0);
  const wholeFileRewrite =
    file.kind === "modified" && oldSpan >= 20 && file.linesRemoved / oldSpan >= 0.7;

  const changed = file.linesAdded + file.linesRemoved;
  const formattingOnly = changed > 0 && semanticNonBlank.length === 0;
  if (formattingOnly && changed >= 40) kinds.add("whole-file-format");

  return {
    path: file.path,
    changedLines: changed,
    formattingLines,
    semanticLines: semantic.length,
    semanticAdded: semanticAdded.length,
    semanticRemoved: semanticRemoved.length,
    commentLines,
    importLines,
    codeLines,
    formattingOnly,
    commentOnly: semanticNonBlank.length > 0 && commentLines === semanticNonBlank.length,
    importOnly: semanticNonBlank.length > 0 && importLines === semanticNonBlank.length,
    wholeFileRewrite,
    formattingKinds: KIND_ORDER.filter((kind) => kinds.has(kind)),
  };
}
