#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { VERSION } from "@ctxd/core";
import { contextCommand } from "./commands/context.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { mcpCommand } from "./commands/mcp.js";
import { memoryCommand } from "./commands/memory.js";
import { searchCommand } from "./commands/search.js";
import {
  checkpointCommand,
  handoffCommand,
  resumeCommand,
  sessionCommand,
  taskCommand,
} from "./commands/work.js";
import { statusCommand } from "./commands/status.js";

export const HELP = `ctxd — local-first AI engineering manager and context firewall

Usage:
  ctxd <command> [options]

Commands:
  checkpoint  Record where the work stands
  context     Build the minimum useful context for a task
  doctor      Check that the local environment is usable
  handoff     Hand the work to another worker
  init        Register a project with ctxd
  mcp         Run the MCP server for AI workers
  memory      Record and read project memory
  resume      What was I doing?
  search      Expand context incrementally
  session     Track a working session
  status      Show the current ctxd state
  task        Track units of work

Options:
  -h, --help       Show this help
  -v, --version    Show the ctxd version

Run "ctxd <command> --help" for command-specific help.`;

type CommandHandler = (argv: readonly string[]) => number | Promise<number>;

const COMMANDS: Readonly<Record<string, CommandHandler>> = {
  checkpoint: checkpointCommand,
  context: contextCommand,
  handoff: handoffCommand,
  doctor: doctorCommand,
  init: initCommand,
  mcp: mcpCommand,
  memory: memoryCommand,
  resume: resumeCommand,
  search: searchCommand,
  session: sessionCommand,
  task: taskCommand,
  status: statusCommand,
};

/**
 * Parse argv and dispatch to a command. Returns the process exit code.
 *
 * The first non-flag argument selects the command; everything else is handed
 * to it untouched so each command owns its own option parsing.
 */
export function run(argv: readonly string[]): number | Promise<number> {
  const commandIndex = argv.findIndex((arg) => !arg.startsWith("-"));

  if (commandIndex === -1) {
    if (argv.includes("--version") || argv.includes("-v")) {
      process.stdout.write(`${VERSION}\n`);
      return 0;
    }
    process.stdout.write(`${HELP}\n`);
    return 0;
  }

  const name = argv[commandIndex] as string;
  const handler = COMMANDS[name];
  if (handler === undefined) {
    process.stderr.write(`ctxd: unknown command "${name}"\n\n${HELP}\n`);
    return 1;
  }

  const rest = [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];
  return handler(rest);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  const outcome = run(process.argv.slice(2));
  if (typeof outcome === "number") {
    process.exitCode = outcome;
  } else {
    outcome.then((code) => {
      process.exitCode = code;
    });
  }
}
