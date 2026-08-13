/**
 * Controlled command execution (§63).
 *
 * ctxd never exposes arbitrary shell execution — not to a worker, not through
 * MCP, not through the CLI. Every command runs through this module, which sorts
 * it into one of three categories and refuses anything it cannot recognise.
 *
 * READ_ONLY      — inspects the repository; cannot change it.
 * SAFE_MUTATING  — writes only build artefacts and caches (tests, typecheck…).
 * DANGEROUS      — destroys work, rewrites history, deploys, touches
 *                  credentials. Never runs without explicit confirmation.
 *
 * The default for an unrecognised command is refusal, not permission.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

export type CommandCategory = "READ_ONLY" | "SAFE_MUTATING" | "DANGEROUS";

export interface CommandOutcome {
  readonly command: string;
  readonly category: CommandCategory;
  readonly ran: boolean;
  readonly exitCode: number | undefined;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  /** Set when the command was refused or could not run. */
  readonly refusedReason?: string;
}

/** Executables that only read. */
const READ_ONLY_BINARIES = new Set([
  "rg", "ripgrep", "grep", "find", "ls", "dir", "cat", "head", "tail", "wc",
  "which", "where", "stat", "file", "tree", "diff",
]);

/** Git subcommands that only read. */
const READ_ONLY_GIT = new Set([
  "status", "diff", "log", "show", "ls-files", "rev-parse", "branch",
  "describe", "blame", "shortlog", "config", "remote", "cat-file",
  "merge-base", "rev-list", "name-rev", "for-each-ref", "count-objects",
]);

/** Git subcommands that destroy work or rewrite history. */
const DANGEROUS_GIT = new Set([
  "reset", "clean", "checkout", "restore", "revert", "rebase", "push",
  "filter-branch", "gc", "prune", "reflog", "update-ref", "am", "apply",
  "cherry-pick", "merge", "switch", "stash", "worktree", "submodule",
]);

/** Package-manager scripts that build or test rather than publish or install. */
const SAFE_SCRIPTS = new Set([
  "test", "typecheck", "type-check", "tsc", "lint", "build", "check", "format",
  "coverage", "vitest", "jest", "mocha", "eslint", "prettier",
]);

const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun", "npx", "pnpx"]);

/** Commands that are dangerous whatever their arguments. */
const DANGEROUS_BINARIES = new Set([
  "rm", "rmdir", "del", "mv", "move", "dd", "mkfs", "shutdown", "reboot",
  "kill", "killall", "taskkill", "chmod", "chown", "curl", "wget", "ssh",
  "scp", "rsync", "docker", "kubectl", "helm", "terraform", "aws", "gcloud",
  "az", "heroku", "vercel", "netlify", "fly", "serverless", "sudo", "su",
  "gpg", "openssl", "keytool", "security", "pass",
]);

/**
 * Categorise a command without running it.
 *
 * `undefined` means ctxd does not recognise the command. Callers must treat
 * that as a refusal — an unknown command is not assumed safe.
 */
export function categorize(command: string, args: readonly string[]): CommandCategory | undefined {
  const binary = command.toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, "");
  const first = args[0]?.toLowerCase();

  if (DANGEROUS_BINARIES.has(binary)) return "DANGEROUS";

  if (binary === "git") {
    // Skip leading global flags to find the subcommand. `git --version` has
    // none and only reads; a flag that takes a value (`git -C other reset`)
    // leaves a non-subcommand here and falls through to refusal, which is the
    // conservative answer.
    const subcommand = args.find((arg) => !arg.startsWith("-"))?.toLowerCase();
    if (subcommand === undefined) return "READ_ONLY";
    if (DANGEROUS_GIT.has(subcommand)) return "DANGEROUS";
    if (READ_ONLY_GIT.has(subcommand)) return "READ_ONLY";
    return undefined;
  }

  if (READ_ONLY_BINARIES.has(binary)) return "READ_ONLY";

  if (PACKAGE_MANAGERS.has(binary)) {
    // `npm run test` and `npm test` both end at a script name.
    const script = first === "run" || first === "run-script" || first === "exec" ? args[1] : first;
    if (script === undefined) return undefined;
    const normalized = script.toLowerCase();
    if (SAFE_SCRIPTS.has(normalized)) return "SAFE_MUTATING";
    if (normalized === "install" || normalized === "i" || normalized === "add" ||
        normalized === "remove" || normalized === "publish" || normalized === "update" ||
        normalized === "up" || normalized === "link" || normalized === "dlx") {
      return "DANGEROUS";
    }
    return undefined;
  }

  if (binary === "tsc" || binary === "eslint" || binary === "prettier" ||
      binary === "vitest" || binary === "jest" || binary === "mocha" ||
      binary === "cargo" || binary === "go" || binary === "pytest" ||
      binary === "ruff" || binary === "mypy") {
    // Build tools write artefacts and caches, never source.
    if (binary === "cargo" && (first === "publish" || first === "install")) return "DANGEROUS";
    if (binary === "go" && (first === "install" || first === "clean")) return "DANGEROUS";
    return "SAFE_MUTATING";
  }

  if (binary === "node") return "SAFE_MUTATING";

  return undefined;
}

/**
 * Find the real executable behind a bare command name.
 *
 * On Windows the tools ctxd runs — `npm`, `pnpm`, `tsc` — are `.cmd` shims, and
 * `execFileSync` cannot launch those by bare name. Resolving the path here
 * keeps the shell switched off: arguments stay separate values rather than text
 * a shell would re-parse, so a filename containing `&` is a filename.
 */
export function resolveExecutable(command: string, env: NodeJS.ProcessEnv = process.env): string {
  if (command.includes("/") || command.includes("\\") || isAbsolute(command)) return command;
  if (process.platform !== "win32") return command;

  const extensions = (env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter((extension) => extension !== "");

  for (const directory of (env["PATH"] ?? "").split(delimiter)) {
    if (directory === "") continue;
    for (const extension of extensions) {
      const candidate = join(directory, `${command}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }

  return command;
}

export interface RunOptions {
  readonly cwd: string;
  readonly timeoutMs?: number;
  /** Categories permitted without confirmation. DANGEROUS is never included. */
  readonly allow?: readonly CommandCategory[];
  /** Explicit confirmation for a DANGEROUS command. */
  readonly confirmDangerous?: boolean;
}

const DEFAULT_ALLOWED: readonly CommandCategory[] = ["READ_ONLY", "SAFE_MUTATING"];
const OUTPUT_LIMIT = 256 * 1024;

function refuse(
  command: string,
  category: CommandCategory,
  reason: string,
): CommandOutcome {
  return {
    command,
    category,
    ran: false,
    exitCode: undefined,
    stdout: "",
    stderr: "",
    durationMs: 0,
    refusedReason: reason,
  };
}

/**
 * Run a command after categorising it.
 *
 * Never invokes a shell: the binary and its arguments are passed separately, so
 * a path containing a semicolon or an ampersand is an odd filename rather than
 * a second command.
 */
export function runCommand(
  command: string,
  args: readonly string[],
  options: RunOptions,
): CommandOutcome {
  const display = [command, ...args].join(" ");
  const category = categorize(command, args);

  if (category === undefined) {
    return refuse(display, "DANGEROUS", "ctxd does not recognise this command, so it was not run");
  }

  if (category === "DANGEROUS" && options.confirmDangerous !== true) {
    return refuse(display, category, "dangerous commands require explicit confirmation");
  }

  const allowed = options.allow ?? DEFAULT_ALLOWED;
  if (category !== "DANGEROUS" && !allowed.includes(category)) {
    return refuse(display, category, `${category} commands are not permitted here`);
  }

  const started = Date.now();
  const executable = resolveExecutable(command);

  // Node refuses to spawn a .cmd/.bat shim without a shell, and on Windows the
  // package managers ctxd runs are exactly that. Turning the shell on means the
  // arguments get re-parsed, so anything that could change the command's
  // meaning is refused rather than escaped-and-hoped-for.
  const needsShell = /\.(cmd|bat)$/i.test(executable);
  if (needsShell) {
    const unsafe = args.find((arg) => /["&|<>^%\r\n]/.test(arg));
    if (unsafe !== undefined) {
      return refuse(display, category, `argument "${unsafe}" cannot be passed safely on Windows`);
    }
  }

  // Under a shell the bare name is passed back: a resolved path like
  // "C:\Program Files\nodejs\npm.cmd" would be split at its space, and letting
  // cmd resolve the name from PATH avoids quoting the whole line by hand.
  const target = needsShell ? command : executable;

  try {
    const stdout = execFileSync(target, args as string[], {
      cwd: options.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: options.timeoutMs ?? 120_000,
      maxBuffer: OUTPUT_LIMIT,
      ...(needsShell ? { shell: true } : {}),
    });
    return {
      command: display,
      category,
      ran: true,
      exitCode: 0,
      stdout,
      stderr: "",
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      status?: number | null;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const decode = (value: string | Buffer | undefined): string =>
      value === undefined ? "" : typeof value === "string" ? value : value.toString("utf8");

    // A missing binary is not a failed check — it is an unavailable one.
    if (failure.code === "ENOENT") {
      return refuse(display, category, `${command} is not installed`);
    }

    return {
      command: display,
      category,
      ran: true,
      exitCode: failure.status ?? undefined,
      stdout: decode(failure.stdout),
      stderr: decode(failure.stderr) || failure.message,
      durationMs: Date.now() - started,
    };
  }
}
