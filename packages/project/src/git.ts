import { execFileSync } from "node:child_process";

export interface GitCommit {
  readonly hash: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
}

export interface GitChange {
  /** Porcelain status code, e.g. `M`, `A`, `??`. */
  readonly status: string;
  readonly path: string;
}

export interface GitInfo {
  readonly available: boolean;
  readonly version?: string;
  readonly insideWorkTree?: boolean;
  readonly root?: string;
  readonly branch?: string;
  /** SHA of the first commit — a stable identity that survives moves. */
  readonly rootCommit?: string;
  readonly recentCommits?: readonly GitCommit[];
  readonly changes?: readonly GitChange[];
}

const RECORD_SEPARATOR = "";
const FIELD_SEPARATOR = "";

function run(args: readonly string[], cwd?: string): string | undefined {
  try {
    return execFileSync("git", args as string[], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      maxBuffer: 4 * 1024 * 1024,
    }).trim();
  } catch {
    return undefined;
  }
}

/** Is Git installed at all? */
export function gitVersion(): string | undefined {
  return run(["--version"]);
}

function parseCommits(raw: string): GitCommit[] {
  return raw
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record !== "")
    .map((record) => {
      const [hash = "", author = "", date = "", subject = ""] = record.split(FIELD_SEPARATOR);
      return { hash, author, date, subject };
    });
}

function parseChanges(raw: string): GitChange[] {
  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3).trim(),
    }));
}

/**
 * Read-only Git inspection.
 *
 * ctxd never replaces Git and never writes to it — Git remains the source of
 * truth for repository history. Every command here is a read, and a failure of
 * any single one degrades that field rather than the whole result.
 */
export function inspectGit(cwd: string = process.cwd(), commitLimit = 10): GitInfo {
  const version = gitVersion();
  if (version === undefined) return { available: false };

  if (run(["rev-parse", "--is-inside-work-tree"], cwd) !== "true") {
    return { available: true, version, insideWorkTree: false };
  }

  const root = run(["rev-parse", "--show-toplevel"], cwd);
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const rootCommit = run(["rev-list", "--max-parents=0", "HEAD"], cwd)?.split("\n").pop();

  const log = run(
    [
      "log",
      `-${commitLimit}`,
      `--pretty=format:%H${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s${RECORD_SEPARATOR}`,
    ],
    cwd,
  );
  const status = run(["status", "--porcelain"], cwd);

  return {
    available: true,
    version,
    insideWorkTree: true,
    ...(root === undefined ? {} : { root }),
    ...(branch === undefined ? {} : { branch }),
    ...(rootCommit === undefined || rootCommit === "" ? {} : { rootCommit }),
    ...(log === undefined ? {} : { recentCommits: parseCommits(log) }),
    ...(status === undefined ? {} : { changes: parseChanges(status) }),
  };
}

/** One-line summary of working tree state, for `ctxd status`. */
export function describeGit(git: GitInfo, fallbackCwd: string): string {
  if (!git.available) return "git not installed";
  if (git.insideWorkTree !== true) return "not a git repository";

  const changes = git.changes?.length ?? 0;
  const dirty = changes === 0 ? "clean" : `${changes} change${changes === 1 ? "" : "s"}`;
  return `${git.branch ?? "unknown branch"} (${dirty}) — ${git.root ?? fallbackCwd}`;
}
