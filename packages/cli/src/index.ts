#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { VERSION } from "@ctxd/core";

export const HELP = `ctxd — local-first AI engineering manager and context firewall

Usage:
  ctxd <command> [options]

Commands:
  bug         Record and surface previous bugs
  checkpoint  Record where the work stands
  context     Build the minimum useful context for a task
  decision    Record and surface project decisions
  diff        Inspect a worker's changes before accepting them
  doctor      Check that the local environment is usable
  efficiency  The context reduction, on its own
  explain     Attach a WHY note to a file or module
  export      Take your project knowledge elsewhere
  handoff     Hand the work to another worker
  import      Bring project knowledge from another machine
  init        Register a project with ctxd
  logs        Read the local ctxd log
  mcp         Run the MCP server for AI workers
  memory      Record and read project memory
  resume      What was I doing?
  search      Expand context incrementally
  session     Track a working session
  stats       What ctxd has kept out of the model's context
  status      Show the current ctxd state
  task        Track units of work
  ui          Serve the local API for the ctxd interface
  verify      Run the project's checks against a worker's changes

Options:
  -h, --help       Show this help
  -v, --version    Show the ctxd version

Run "ctxd <command> --help" for command-specific help.`;

type CommandHandler = (argv: readonly string[]) => number | Promise<number>;

/**
 * Commands are loaded on demand.
 *
 * Importing every command up front pulled in the whole dependency graph —
 * including better-sqlite3's native binding — before ctxd had even read its
 * arguments, which cost roughly 700ms on every invocation. `ctxd --version`
 * has no business paying to open a database driver (§72).
 */
const COMMANDS: Readonly<Record<string, () => Promise<CommandHandler>>> = {
  bug: async () => (await import("./commands/knowledge.js")).bugCommand,
  checkpoint: async () => (await import("./commands/work.js")).checkpointCommand,
  context: async () => (await import("./commands/context.js")).contextCommand,
  decision: async () => (await import("./commands/knowledge.js")).decisionCommand,
  decisions: async () => (await import("./commands/knowledge.js")).decisionCommand,
  diff: async () => (await import("./commands/diff.js")).diffCommand,
  doctor: async () => (await import("./commands/doctor.js")).doctorCommand,
  efficiency: async () => (await import("./commands/stats.js")).efficiencyCommand,
  explain: async () => (await import("./commands/knowledge.js")).explainCommand,
  export: async () => (await import("./commands/transfer.js")).exportCommand,
  handoff: async () => (await import("./commands/work.js")).handoffCommand,
  import: async () => (await import("./commands/transfer.js")).importCommand,
  init: async () => (await import("./commands/init.js")).initCommand,
  logs: async () => (await import("./commands/logs.js")).logsCommand,
  mcp: async () => (await import("./commands/mcp.js")).mcpCommand,
  memory: async () => (await import("./commands/memory.js")).memoryCommand,
  resume: async () => (await import("./commands/work.js")).resumeCommand,
  search: async () => (await import("./commands/search.js")).searchCommand,
  session: async () => (await import("./commands/work.js")).sessionCommand,
  stats: async () => (await import("./commands/stats.js")).statsCommand,
  status: async () => (await import("./commands/status.js")).statusCommand,
  task: async () => (await import("./commands/work.js")).taskCommand,
  ui: async () => (await import("./commands/ui.js")).uiCommand,
  verify: async () => (await import("./commands/verify.js")).verifyCommand,
};

/**
 * Parse argv and dispatch to a command. Returns the process exit code.
 *
 * The first non-flag argument selects the command; everything else is handed
 * to it untouched so each command owns its own option parsing.
 */
export async function run(argv: readonly string[]): Promise<number> {
  const commandIndex = argv.findIndex((arg) => !arg.startsWith("-"));

  if (commandIndex === -1) {
    if (argv.includes("--version") || argv.includes("-v")) {
      process.stdout.write(`${VERSION}
`);
      return 0;
    }
    process.stdout.write(`${HELP}
`);
    return 0;
  }

  const name = argv[commandIndex] as string;
  const load = COMMANDS[name];
  if (load === undefined) {
    process.stderr.write(`ctxd: unknown command "${name}"

${HELP}
`);
    return 1;
  }

  const rest = [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];
  return (await load())(rest);
}

/**
 * Was this module executed, rather than imported?
 *
 * Comparing `import.meta.url` to `process.argv[1]` as strings is wrong the
 * moment the CLI is launched through its installed `bin` shim: the shim
 * resolves symlinks, so argv[1] is the real file inside the package store while
 * `import.meta.url` is the path the loader used. The two never match, and the
 * CLI silently did nothing — exit 0, no output, for every command.
 *
 * Both sides are therefore reduced to a canonical real path. Case is folded on
 * Windows and macOS, whose filesystems treat paths case-insensitively.
 */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;

  const canonical = (path: string): string => {
    let resolved = path;
    try {
      resolved = realpathSync(path);
    } catch {
      // A path that cannot be resolved is compared as given.
    }
    return process.platform === "win32" || process.platform === "darwin"
      ? resolved.toLowerCase()
      : resolved;
  };

  return canonical(fileURLToPath(import.meta.url)) === canonical(entry);
}

if (isDirectRun()) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`ctxd: ${(error as Error).message}
`);
      process.exitCode = 1;
    },
  );
}
