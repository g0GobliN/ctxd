/**
 * Read-only diff sourcing.
 *
 * ctxd never writes to Git. Every command here reads: no `add`, no `stash`, no
 * index mutation. Untracked files are read from disk directly rather than
 * staged with `git add -N`, because a firewall that modifies the repository it
 * is inspecting would be a worse problem than the one it detects.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseUnifiedDiff, type FileDiff, type ParsedDiff } from "./parse.js";

/** Largest untracked file synthesised into the diff, in bytes. */
const MAX_UNTRACKED_BYTES = 512 * 1024;

export type DiffScope = "working" | "staged" | "range";

export interface ReadDiffOptions {
  readonly cwd: string;
  /**
   * `working` — everything not yet committed (staged and unstaged), plus
   * untracked files. `staged` — the index only. `range` — an explicit revision
   * range such as `main...HEAD`.
   */
  readonly scope?: DiffScope;
  readonly range?: string;
  /** Limit the diff to these pathspecs. */
  readonly paths?: readonly string[];
  /** Include untracked files as synthesised additions (working scope only). */
  readonly includeUntracked?: boolean;
}

export interface DiffSource extends ParsedDiff {
  readonly scope: DiffScope;
  /** What was compared, for the receipt: e.g. `HEAD (staged + unstaged)`. */
  readonly against: string;
  readonly untrackedFiles: readonly string[];
}

function runGit(args: readonly string[], cwd: string): string | undefined {
  try {
    return execFileSync("git", args as string[], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return undefined;
  }
}

function hasCommits(cwd: string): boolean {
  return runGit(["rev-parse", "--verify", "HEAD"], cwd) !== undefined;
}

/** Files Git knows nothing about yet, honouring `.gitignore`. */
function untrackedPaths(cwd: string): string[] {
  const raw = runGit(["ls-files", "--others", "--exclude-standard", "-z"], cwd);
  if (raw === undefined) return [];
  return raw.split("\0").filter((path) => path !== "");
}

/**
 * Represent an untracked file as an addition.
 *
 * A worker that creates a file has changed the repository just as much as one
 * that edits it, and a change surface that ignored new files would understate
 * every scaffolding-heavy change.
 */
function synthesizeAddition(cwd: string, path: string): FileDiff | undefined {
  let content: string;
  try {
    const stats = statSync(join(cwd, path));
    if (!stats.isFile() || stats.size > MAX_UNTRACKED_BYTES) return undefined;
    content = readFileSync(join(cwd, path), "utf8");
  } catch {
    return undefined;
  }

  // A NUL byte means binary; record the file without inventing line content.
  if (content.includes("\0")) {
    return {
      path,
      oldPath: path,
      kind: "added",
      binary: true,
      hunks: [],
      linesAdded: 0,
      linesRemoved: 0,
    };
  }

  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  return {
    path,
    oldPath: path,
    kind: "added",
    binary: false,
    hunks: [
      {
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: lines.length,
        lines: lines.map((text) => ({ kind: "added" as const, text })),
      },
    ],
    linesAdded: lines.length,
    linesRemoved: 0,
  };
}

/** True when `cwd` sits inside a Git work tree. */
export function isGitRepository(cwd: string): boolean {
  return runGit(["rev-parse", "--is-inside-work-tree"], cwd)?.trim() === "true";
}

/**
 * Collect the diff to analyse.
 *
 * `-M` enables rename detection so a moved file reads as one rename rather than
 * a large deletion plus a large addition — without it every file move would
 * look like over-editing.
 */
export function readDiff(options: ReadDiffOptions): DiffSource {
  const { cwd } = options;
  const scope = options.scope ?? "working";
  const pathspec = options.paths === undefined || options.paths.length === 0
    ? []
    : ["--", ...options.paths];

  const base = ["diff", "--no-color", "--no-ext-diff", "-M", "--find-renames"];
  let args: string[];
  let against: string;

  if (scope === "range") {
    const range = options.range ?? "HEAD~1..HEAD";
    args = [...base, range, ...pathspec];
    against = range;
  } else if (scope === "staged") {
    args = [...base, "--cached", ...(hasCommits(cwd) ? ["HEAD"] : []), ...pathspec];
    against = hasCommits(cwd) ? "HEAD (staged)" : "empty tree (staged)";
  } else if (hasCommits(cwd)) {
    args = [...base, "HEAD", ...pathspec];
    against = "HEAD (staged + unstaged)";
  } else {
    // A repository with no commits has nothing to diff against; only untracked
    // files exist, and they are picked up below.
    args = [...base, ...pathspec];
    against = "empty repository";
  }

  const raw = runGit(args, cwd);
  const parsed = raw === undefined
    ? { files: [], warnings: [`git ${args.join(" ")} failed`] }
    : parseUnifiedDiff(raw);

  const files = [...parsed.files];
  const warnings = [...parsed.warnings];
  const untracked: string[] = [];

  if (scope !== "range" && options.includeUntracked !== false) {
    for (const path of untrackedPaths(cwd)) {
      if (options.paths !== undefined && options.paths.length > 0) {
        if (!options.paths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
          continue;
        }
      }
      const file = synthesizeAddition(cwd, path);
      if (file === undefined) {
        warnings.push(`untracked file skipped (too large or unreadable): ${path}`);
        continue;
      }
      files.push(file);
      untracked.push(path);
    }
  }

  return { files, warnings, scope, against, untrackedFiles: untracked };
}
