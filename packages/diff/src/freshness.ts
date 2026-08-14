/**
 * Whether a recorded verification still describes the tree in front of you
 * (UI-8, §21).
 *
 * ctxd has no verification-runs table and 2.0 does not add one, so the newest
 * Change Receipt is the only record of a check having happened. A receipt
 * carries a status and a timestamp, and a status shown without regard to the
 * timestamp is the most dangerous number in the product: a PASS from before the
 * last three edits reads exactly like a PASS from a moment ago, and it is the
 * one a developer would act on.
 *
 * The rule here is the same one that governs `openEnded` worker connections:
 * where the evidence is thin, report the evidence rather than invent a
 * threshold. Staleness is not "older than an hour" — that would be a guess
 * dressed as a fact. It is "a file in this repository changed after the check
 * ran", which is something ctxd can actually observe.
 */

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

export type Freshness =
  /** Nothing in the tree has changed since the check ran. */
  | "current"
  /** Something changed after the check, so the verdict describes an older tree. */
  | "stale"
  /** No check recorded, or no way to compare — never a substitute for either. */
  | "unknown";

export interface FreshnessReport {
  readonly freshness: Freshness;
  /** The verification status from the receipt, or "unknown" when there is none. */
  readonly status: string;
  /** When the check ran. */
  readonly at: string | null;
  /**
   * What made it stale — a path, or a commit. Populated only for `stale`, so
   * the verdict can always be traced back to the thing that caused it.
   */
  readonly changedSince: string | null;
  /** Why the answer is what it is, in words, for the interface to show. */
  readonly reason: string;
}

function runGit(args: readonly string[], cwd: string): string | undefined {
  try {
    return execFileSync("git", args as string[], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return undefined;
  }
}

/** Paths Git reports as changed, tracked and untracked alike. */
function changedPaths(cwd: string): string[] | undefined {
  const raw = runGit(["status", "--porcelain=v1", "-z", "--untracked-files=normal"], cwd);
  if (raw === undefined) return undefined;

  const paths: string[] = [];
  for (const entry of raw.split("\0")) {
    if (entry.length <= 3) continue;
    // `XY <path>`; a rename's second field follows as its own NUL-separated
    // record, which is picked up on the next iteration as a bare path.
    paths.push(entry.slice(3));
  }
  return paths;
}

/** The newest commit time, so work committed after a check counts as change. */
function headCommittedAt(cwd: string): number | undefined {
  const raw = runGit(["log", "-1", "--format=%cI"], cwd);
  if (raw === undefined || raw.trim() === "") return undefined;
  const parsed = Date.parse(raw.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export interface FreshnessInput {
  readonly cwd: string;
  /** The newest Change Receipt's verification status, if one exists. */
  readonly status?: string | undefined;
  /** That receipt's timestamp. */
  readonly at?: string | undefined;
}

/**
 * Judge a recorded verification against the current working tree.
 *
 * Deliberately conservative in one direction only: anything that cannot be
 * established reads `unknown`, never `current`. Showing "current" on missing
 * evidence would be the exact failure this function exists to prevent, whereas
 * an unnecessary `unknown` only costs the developer a re-run.
 */
export function verificationFreshness(input: FreshnessInput): FreshnessReport {
  const { cwd, status, at } = input;

  if (status === undefined || at === undefined) {
    return {
      freshness: "unknown",
      status: status ?? "unknown",
      at: at ?? null,
      changedSince: null,
      reason: "no verification has been recorded for this project",
    };
  }

  const ranAt = Date.parse(at);
  if (!Number.isFinite(ranAt)) {
    return {
      freshness: "unknown",
      status,
      at,
      changedSince: null,
      reason: "the receipt's timestamp could not be read, so its age is unknown",
    };
  }

  const paths = changedPaths(cwd);
  if (paths === undefined) {
    return {
      freshness: "unknown",
      status,
      at,
      changedSince: null,
      reason: "not a Git repository, so ctxd cannot tell whether the tree has changed since",
    };
  }

  for (const path of paths) {
    let modifiedAt: number;
    try {
      modifiedAt = statSync(join(cwd, path)).mtimeMs;
    } catch {
      // A path Git lists but that is not on disk was deleted — itself a change
      // to the tree, and one that happened at an unknown moment. Unknown is the
      // honest answer; claiming current would be the unsafe one.
      return {
        freshness: "unknown",
        status,
        at,
        changedSince: path,
        reason: `${path} is listed as changed but is not on disk, so ctxd cannot date the change`,
      };
    }

    if (modifiedAt > ranAt) {
      return {
        freshness: "stale",
        status,
        at,
        changedSince: path,
        reason: `${path} changed after this check ran, so ${status} describes an earlier state of the tree`,
      };
    }
  }

  const committedAt = headCommittedAt(cwd);
  if (committedAt !== undefined && committedAt > ranAt) {
    return {
      freshness: "stale",
      status,
      at,
      changedSince: "HEAD",
      reason: `work was committed after this check ran, so ${status} describes an earlier state of the tree`,
    };
  }

  return {
    freshness: "current",
    status,
    at,
    changedSince: null,
    reason:
      paths.length === 0
        ? "no uncommitted changes and nothing committed since this check ran"
        : "nothing in the tree has been modified since this check ran",
  };
}
