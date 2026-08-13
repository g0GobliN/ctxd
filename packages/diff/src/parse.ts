/**
 * Unified diff parsing.
 *
 * The Diff Firewall reasons about what a worker actually changed, so the parser
 * is deliberately literal: it records exactly the lines Git reported and never
 * infers content it did not see. Anything it cannot parse becomes a warning
 * rather than a silent omission.
 */

export type DiffLineKind = "context" | "added" | "removed";

export interface DiffLine {
  readonly kind: DiffLineKind;
  /** Line text with the leading +/-/space marker removed. */
  readonly text: string;
}

export interface DiffHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly DiffLine[];
}

export type FileChangeKind = "added" | "deleted" | "modified" | "renamed" | "copied";

export interface FileDiff {
  /** Path after the change (the old path for deletions). */
  readonly path: string;
  /** Path before the change; differs from `path` only for renames and copies. */
  readonly oldPath: string;
  readonly kind: FileChangeKind;
  readonly binary: boolean;
  readonly hunks: readonly DiffHunk[];
  readonly linesAdded: number;
  readonly linesRemoved: number;
  /** Git's rename/copy similarity index, when it reported one. */
  readonly similarity?: number;
}

export interface ParsedDiff {
  readonly files: readonly FileDiff[];
  readonly warnings: readonly string[];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Undo Git's C-style quoting of unusual paths.
 *
 * Git wraps a path in double quotes when it contains control characters,
 * quotes, backslashes or non-ASCII bytes; leaving the quoting in place would
 * make an ordinary file look like a different one on every comparison.
 */
function unquotePath(raw: string): string {
  if (!raw.startsWith('"') || !raw.endsWith('"') || raw.length < 2) return raw;

  const body = raw.slice(1, -1);
  let out = "";

  for (let i = 0; i < body.length; i += 1) {
    const char = body[i] as string;
    if (char !== "\\") {
      out += char;
      continue;
    }

    const next = body[i + 1];
    if (next === undefined) break;
    i += 1;

    switch (next) {
      case "n": out += "\n"; break;
      case "t": out += "\t"; break;
      case "r": out += "\r"; break;
      case '"': out += '"'; break;
      case "\\": out += "\\"; break;
      default: {
        // Octal escape (\303) — Git emits these byte by byte for UTF-8.
        const octal = body.slice(i, i + 3);
        if (/^[0-7]{3}$/.test(octal)) {
          out += String.fromCharCode(Number.parseInt(octal, 8));
          i += 2;
        } else {
          out += next;
        }
      }
    }
  }

  return out;
}

/** Strip the `a/` or `b/` prefix Git puts on diff paths. */
function stripPrefix(path: string): string {
  if (path === "/dev/null") return path;
  if (path.startsWith("a/") || path.startsWith("b/")) return path.slice(2);
  return path;
}

/**
 * Split a `diff --git a/x b/y` header into its two paths.
 *
 * Paths may contain spaces, so the split point is the last ` b/` that leaves a
 * non-empty left side — unambiguous for every path Git emits unquoted.
 */
function splitHeaderPaths(rest: string): { old: string; next: string } | undefined {
  if (rest.startsWith('"')) {
    const end = findQuotedEnd(rest);
    if (end === -1) return undefined;
    const first = rest.slice(0, end + 1);
    const second = rest.slice(end + 1).trim();
    if (second === "") return undefined;
    return { old: stripPrefix(unquotePath(first)), next: stripPrefix(unquotePath(second)) };
  }

  const marker = " b/";
  const index = rest.lastIndexOf(marker);
  if (index <= 0) return undefined;

  return {
    old: stripPrefix(rest.slice(0, index)),
    next: stripPrefix(rest.slice(index + 1)),
  };
}

/** Index of the closing quote of a C-quoted path, honouring backslash escapes. */
function findQuotedEnd(text: string): number {
  for (let i = 1; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === '"') return i;
  }
  return -1;
}

interface FileAccumulator {
  path: string;
  oldPath: string;
  kind: FileChangeKind;
  binary: boolean;
  similarity: number | undefined;
  hunks: DiffHunk[];
  linesAdded: number;
  linesRemoved: number;
}

function startFile(oldPath: string, newPath: string): FileAccumulator {
  return {
    path: newPath,
    oldPath,
    kind: "modified",
    binary: false,
    similarity: undefined,
    hunks: [],
    linesAdded: 0,
    linesRemoved: 0,
  };
}

function finishFile(accumulator: FileAccumulator): FileDiff {
  const { similarity, ...rest } = accumulator;
  return {
    ...rest,
    hunks: accumulator.hunks,
    ...(similarity === undefined ? {} : { similarity }),
  };
}

/**
 * Parse the output of `git diff`.
 *
 * Handles multi-file diffs, renames, copies, binary files and files with no
 * trailing newline. Rename detection depends on the caller passing `-M`; when
 * it is absent a rename simply reads as one deletion and one addition, which is
 * accurate rather than wrong.
 */
export function parseUnifiedDiff(raw: string): ParsedDiff {
  const files: FileDiff[] = [];
  const warnings: string[] = [];

  let current: FileAccumulator | undefined;
  let hunk: { header: RegExpMatchArray; lines: DiffLine[] } | undefined;

  const closeHunk = (): void => {
    if (current === undefined || hunk === undefined) return;
    const [, oldStart, oldLines, newStart, newLines] = hunk.header;
    current.hunks.push({
      oldStart: Number(oldStart ?? 0),
      oldLines: oldLines === undefined ? 1 : Number(oldLines),
      newStart: Number(newStart ?? 0),
      newLines: newLines === undefined ? 1 : Number(newLines),
      lines: hunk.lines,
    });
    hunk = undefined;
  };

  const closeFile = (): void => {
    closeHunk();
    if (current !== undefined) files.push(finishFile(current));
    current = undefined;
  };

  for (const line of raw.split("\n")) {
    if (line.startsWith("diff --git ")) {
      closeFile();
      const paths = splitHeaderPaths(line.slice("diff --git ".length).trim());
      if (paths === undefined) {
        warnings.push(`unparseable diff header: ${line}`);
        continue;
      }
      current = startFile(paths.old, paths.next);
      continue;
    }

    if (current === undefined) continue;

    if (hunk === undefined) {
      if (line.startsWith("new file mode")) {
        current.kind = "added";
        continue;
      }
      if (line.startsWith("deleted file mode")) {
        current.kind = "deleted";
        continue;
      }
      if (line.startsWith("rename from ")) {
        current.kind = "renamed";
        current.oldPath = unquotePath(line.slice("rename from ".length).trim());
        continue;
      }
      if (line.startsWith("rename to ")) {
        current.kind = "renamed";
        current.path = unquotePath(line.slice("rename to ".length).trim());
        continue;
      }
      if (line.startsWith("copy from ")) {
        current.kind = "copied";
        current.oldPath = unquotePath(line.slice("copy from ".length).trim());
        continue;
      }
      if (line.startsWith("copy to ")) {
        current.kind = "copied";
        current.path = unquotePath(line.slice("copy to ".length).trim());
        continue;
      }
      if (line.startsWith("similarity index ")) {
        const value = Number.parseInt(line.slice("similarity index ".length), 10);
        if (Number.isFinite(value)) current.similarity = value;
        continue;
      }
      if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
        current.binary = true;
        continue;
      }
      if (line.startsWith("--- ")) {
        const path = stripPrefix(unquotePath(line.slice(4).trim()));
        if (path === "/dev/null") current.kind = "added";
        else if (current.kind === "modified") current.oldPath = path;
        continue;
      }
      if (line.startsWith("+++ ")) {
        const path = stripPrefix(unquotePath(line.slice(4).trim()));
        if (path === "/dev/null") {
          current.kind = "deleted";
          current.path = current.oldPath;
        } else if (current.kind === "modified" || current.kind === "added") {
          current.path = path;
          if (current.kind === "added") current.oldPath = path;
        }
        continue;
      }
    }

    const header = line.match(HUNK_HEADER);
    if (header !== null) {
      closeHunk();
      hunk = { header, lines: [] };
      continue;
    }

    if (hunk === undefined) continue;

    // "\ No newline at end of file" annotates the previous line; it is not a
    // change of its own and must not be counted as one.
    if (line.startsWith("\\")) continue;

    if (line.startsWith("+")) {
      hunk.lines.push({ kind: "added", text: line.slice(1) });
      current.linesAdded += 1;
      continue;
    }
    if (line.startsWith("-")) {
      hunk.lines.push({ kind: "removed", text: line.slice(1) });
      current.linesRemoved += 1;
      continue;
    }
    if (line.startsWith(" ") || line === "") {
      hunk.lines.push({ kind: "context", text: line.slice(1) });
      continue;
    }

    // Anything else ends the hunk body (e.g. the start of trailing Git output).
    closeHunk();
  }

  closeFile();
  return { files, warnings };
}

/** All changed (added or removed) lines of a file, in diff order. */
export function changedLines(file: FileDiff): DiffLine[] {
  const out: DiffLine[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind !== "context") out.push(line);
    }
  }
  return out;
}

/**
 * Lines that were replaced rather than purely added or removed.
 *
 * Within each hunk a run of removals immediately followed by a run of additions
 * is a modification of `min(removed, added)` lines; the remainder is a genuine
 * addition or deletion. This matches how a reviewer reads a diff.
 */
export function countModifiedLines(file: FileDiff): number {
  let modified = 0;

  for (const hunk of file.hunks) {
    let removed = 0;
    let added = 0;

    const flush = (): void => {
      modified += Math.min(removed, added);
      removed = 0;
      added = 0;
    };

    for (const line of hunk.lines) {
      if (line.kind === "removed") {
        // A removal after additions starts a new run.
        if (added > 0) flush();
        removed += 1;
      } else if (line.kind === "added") {
        added += 1;
      } else {
        flush();
      }
    }
    flush();
  }

  return modified;
}
