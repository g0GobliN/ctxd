import { readFileSync, writeFileSync } from "node:fs";
import {
  LOG_LEVELS,
  MODES,
  WORKER_OUTPUT_MODES,
  type Config,
  type LogLevel,
  type Mode,
  type WorkerOutputMode,
} from "./types.js";
import { DEFAULT_STORAGE_DIRECTORY } from "./paths.js";

export const DEFAULT_CONFIG: Config = {
  mode: "balanced",
  context: {
    safetyMarginTokens: 2000,
    outputReserveTokens: 5000,
  },
  storage: {
    directory: DEFAULT_STORAGE_DIRECTORY,
  },
  ui: {
    host: "127.0.0.1",
    port: 4317,
  },
  logging: {
    level: "info",
  },
  workers: {
    defaultOutputMode: "minimal",
  },
};

export interface ConfigValidation {
  /** Defaults merged with every valid field found in the input. */
  readonly config: Config;
  /** One message per rejected field. Empty when the input was fully valid. */
  readonly errors: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEnum<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
  path: string,
  errors: string[],
): T {
  const value = raw[key];
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  errors.push(`${path}: expected one of ${allowed.join(", ")}, got ${JSON.stringify(value)}`);
  return fallback;
}

function readInt(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  path: string,
  errors: string[],
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number {
  const value = raw[key];
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) {
    return value;
  }
  errors.push(`${path}: expected an integer between ${min} and ${max}, got ${JSON.stringify(value)}`);
  return fallback;
}

function readString(
  raw: Record<string, unknown>,
  key: string,
  fallback: string,
  path: string,
  errors: string[],
): string {
  const value = raw[key];
  if (value === undefined) return fallback;
  if (typeof value === "string" && value.length > 0) return value;
  errors.push(`${path}: expected a non-empty string, got ${JSON.stringify(value)}`);
  return fallback;
}

function readSection(
  raw: Record<string, unknown>,
  key: string,
  errors: string[],
): Record<string, unknown> {
  const value = raw[key];
  if (value === undefined) return {};
  if (isRecord(value)) return value;
  errors.push(`${key}: expected an object, got ${JSON.stringify(value)}`);
  return {};
}

/**
 * Validate an unknown value against the config shape.
 *
 * Invalid fields fall back to their default and are reported; a bad config
 * never silently changes behaviour and never aborts the CLI on its own.
 */
export function validateConfig(input: unknown): ConfigValidation {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      config: DEFAULT_CONFIG,
      errors: [`config: expected an object, got ${JSON.stringify(input)}`],
    };
  }

  const context = readSection(input, "context", errors);
  const storage = readSection(input, "storage", errors);
  const ui = readSection(input, "ui", errors);
  const logging = readSection(input, "logging", errors);
  const workers = readSection(input, "workers", errors);

  const config: Config = {
    mode: readEnum<Mode>(input, "mode", MODES, DEFAULT_CONFIG.mode, "mode", errors),
    context: {
      safetyMarginTokens: readInt(
        context,
        "safetyMarginTokens",
        DEFAULT_CONFIG.context.safetyMarginTokens,
        "context.safetyMarginTokens",
        errors,
      ),
      outputReserveTokens: readInt(
        context,
        "outputReserveTokens",
        DEFAULT_CONFIG.context.outputReserveTokens,
        "context.outputReserveTokens",
        errors,
      ),
    },
    storage: {
      directory: readString(
        storage,
        "directory",
        DEFAULT_CONFIG.storage.directory,
        "storage.directory",
        errors,
      ),
    },
    ui: {
      host: readString(ui, "host", DEFAULT_CONFIG.ui.host, "ui.host", errors),
      port: readInt(ui, "port", DEFAULT_CONFIG.ui.port, "ui.port", errors, {
        min: 1,
        max: 65535,
      }),
    },
    logging: {
      level: readEnum<LogLevel>(
        logging,
        "level",
        LOG_LEVELS,
        DEFAULT_CONFIG.logging.level,
        "logging.level",
        errors,
      ),
    },
    workers: {
      defaultOutputMode: readEnum<WorkerOutputMode>(
        workers,
        "defaultOutputMode",
        WORKER_OUTPUT_MODES,
        DEFAULT_CONFIG.workers.defaultOutputMode,
        "workers.defaultOutputMode",
        errors,
      ),
    },
  };

  return { config, errors };
}

export interface LoadedConfig extends ConfigValidation {
  /** False when no config file exists yet and defaults are in use. */
  readonly exists: boolean;
  readonly path: string;
}

/** Read and validate the config file. A missing file yields defaults. */
export function loadConfig(configFile: string): LoadedConfig {
  let text: string;
  try {
    text = readFileSync(configFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { config: DEFAULT_CONFIG, errors: [], exists: false, path: configFile };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      config: DEFAULT_CONFIG,
      errors: [`config: invalid JSON (${(error as Error).message})`],
      exists: true,
      path: configFile,
    };
  }

  const { config, errors } = validateConfig(parsed);
  return { config, errors, exists: true, path: configFile };
}

/** Write a config file. Configuration must never contain secrets. */
export function saveConfig(configFile: string, config: Config): void {
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
