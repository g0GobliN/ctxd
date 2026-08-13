import { appendFileSync } from "node:fs";
import { redactSecrets } from "@ctxd/utils";
import { LOG_LEVELS, type LogLevel } from "./types.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogRecord {
  readonly time: string;
  readonly level: LogLevel;
  readonly msg: string;
  readonly [key: string]: unknown;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  readonly level: LogLevel;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export interface CreateLoggerOptions {
  readonly level?: LogLevel;
  /** Where records go. Defaults to stderr as newline-delimited JSON. */
  readonly sink?: LogSink;
  /** Fields attached to every record from this logger. */
  readonly base?: Record<string, unknown>;
}

/** Newline-delimited JSON to stderr, so stdout stays machine-parsable. */
export const stderrSink: LogSink = (record) => {
  process.stderr.write(`${JSON.stringify(record)}\n`);
};

/** Append newline-delimited JSON to a log file. */
export function fileSink(path: string): LogSink {
  return (record) => {
    appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  };
}

/** Send each record to every sink; one failing sink must not lose the rest. */
export function multiSink(...sinks: readonly LogSink[]): LogSink {
  return (record) => {
    for (const sink of sinks) {
      try {
        sink(record);
      } catch {
        // A broken sink (full disk, closed pipe) must never crash the CLI.
      }
    }
  };
}

/**
 * Create a structured logger.
 *
 * Every field is passed through secret redaction before it is written: no API
 * key, password, token or `.env` value may reach a log file.
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const sink = options.sink ?? stderrSink;
  const base = options.base ?? {};
  const threshold = LEVEL_RANK[level];

  function emit(recordLevel: LogLevel, msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_RANK[recordLevel] < threshold) return;
    const merged = { ...base, ...(fields ?? {}) };
    const safe = redactSecrets(merged) as Record<string, unknown>;
    sink({
      time: new Date().toISOString(),
      level: recordLevel,
      msg,
      ...safe,
    });
  }

  return {
    level,
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (fields) =>
      createLogger({ level, sink, base: { ...base, ...fields } }),
  };
}

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}
