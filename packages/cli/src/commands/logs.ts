/**
 * `ctxd logs` (§75).
 *
 * Logs are newline-delimited JSON, which is right for machines and unpleasant
 * for people. This renders them back into something readable, and filters by
 * level so `--level error` answers "what went wrong" without a pager.
 *
 * Records are already redacted when written — `redactSecrets` runs on every
 * field before it reaches a file. This command adds no second redaction pass,
 * because a filter here would imply the file itself might contain secrets.
 */

import { parseArgs } from "node:util";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isLogLevel, LOG_LEVELS, resolvePaths, type LogLevel } from "@ctxd/core";

export const LOGS_HELP = `ctxd logs — read the local ctxd log

Usage:
  ctxd logs [--level <level>] [--lines <n>] [--grep <text>] [--json]

Options:
  --level <level>  Minimum level: ${LOG_LEVELS.join(", ")} (default: debug)
  --lines <n>      Show the last n records (default: 50)
  --grep <text>    Only records whose message or fields contain this text
  --file <path>    Read this log file instead of the newest
  --list           List available log files and exit
  --json           Print the raw JSON records
  -h, --help       Show this help

Logs are local files. Secrets are redacted when records are written, never
after the fact.`;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

interface Record_ {
  readonly time?: string;
  readonly level?: string;
  readonly msg?: string;
  readonly [key: string]: unknown;
}

/** Log files in the directory, newest first. */
function logFiles(directory: string): { path: string; name: string; mtime: number }[] {
  if (!existsSync(directory)) return [];

  return readdirSync(directory)
    .filter((name) => name.endsWith(".log") || name.endsWith(".jsonl") || name.endsWith(".ndjson"))
    .map((name) => {
      const path = join(directory, name);
      try {
        return { path, name, mtime: statSync(path).mtimeMs };
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is { path: string; name: string; mtime: number } => entry !== undefined)
    .sort((a, b) => b.mtime - a.mtime);
}

function render(record: Record_): string {
  const { time, level, msg, ...fields } = record;
  const when = time === undefined ? "" : time.replace("T", " ").replace(/\.\d+Z$/, "");
  const mark = (level ?? "info").toUpperCase().padEnd(5);
  const extra = Object.keys(fields).length === 0 ? "" : ` ${JSON.stringify(fields)}`;
  return `${when} ${mark} ${msg ?? ""}${extra}`;
}

export function logsCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${LOGS_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        level: { type: "string" },
        lines: { type: "string" },
        grep: { type: "string" },
        file: { type: "string" },
        list: { type: "boolean" },
        json: { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd logs: ${(error as Error).message}\n\n${LOGS_HELP}\n`);
    return 1;
  }

  const paths = resolvePaths();
  const available = logFiles(paths.logsDir);

  if (values.list === true) {
    if (available.length === 0) {
      process.stdout.write(`No log files in ${paths.logsDir}\n`);
      return 0;
    }
    for (const entry of available) {
      process.stdout.write(`${entry.name}  ${new Date(entry.mtime).toISOString()}\n`);
    }
    return 0;
  }

  let minimum: LogLevel = "debug";
  if (values.level !== undefined) {
    const level = values.level.toLowerCase();
    if (!isLogLevel(level)) {
      process.stderr.write(`ctxd logs: --level must be one of ${LOG_LEVELS.join(", ")}\n`);
      return 1;
    }
    minimum = level;
  }

  let limit = 50;
  if (values.lines !== undefined) {
    limit = Number.parseInt(values.lines, 10);
    if (!Number.isInteger(limit) || limit <= 0) {
      process.stderr.write("ctxd logs: --lines must be a positive integer\n");
      return 1;
    }
  }

  const target = values.file ?? available[0]?.path;
  if (target === undefined) {
    process.stdout.write(
      `No log files in ${paths.logsDir}.\n` +
        "ctxd logs to stderr by default; a log file appears once file logging is configured.\n",
    );
    return 0;
  }

  let raw: string;
  try {
    raw = readFileSync(target, "utf8");
  } catch (error) {
    process.stderr.write(`ctxd logs: could not read ${target} — ${(error as Error).message}\n`);
    return 1;
  }

  const needle = values.grep?.toLowerCase();
  const selected: string[] = [];
  let unparsed = 0;

  for (const line of raw.split("\n")) {
    if (line.trim() === "") continue;

    let record: Record_;
    try {
      record = JSON.parse(line) as Record_;
    } catch {
      // A truncated final line is normal while something is still writing.
      unparsed += 1;
      continue;
    }

    const level = record.level;
    if (typeof level === "string" && isLogLevel(level)) {
      if (LEVEL_RANK[level] < LEVEL_RANK[minimum]) continue;
    }

    if (needle !== undefined && !line.toLowerCase().includes(needle)) continue;

    selected.push(values.json === true ? line : render(record));
  }

  const tail = selected.slice(-limit);
  if (tail.length === 0) {
    process.stdout.write(`No matching records in ${target}\n`);
    return 0;
  }

  for (const line of tail) process.stdout.write(`${line}\n`);

  if (selected.length > tail.length) {
    process.stdout.write(
      `\n… ${selected.length - tail.length} earlier record(s) not shown; raise --lines\n`,
    );
  }
  if (unparsed > 0) {
    process.stdout.write(`\n${unparsed} line(s) could not be parsed as JSON\n`);
  }

  return 0;
}
