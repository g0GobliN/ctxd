/** Optimization mode. `cheap` optimizes aggressively, `full` preserves more. */
export type Mode = "cheap" | "balanced" | "full";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Default output verbosity requested from AI workers. */
export type WorkerOutputMode = "minimal" | "normal" | "detailed";

export interface ContextConfig {
  /** Head-room kept free so a context build never lands exactly on the limit. */
  readonly safetyMarginTokens: number;
  /** Budget reserved for the worker's own output. */
  readonly outputReserveTokens: number;
}

export interface StorageConfig {
  /** May contain a leading `~`; resolved at runtime, never stored expanded. */
  readonly directory: string;
}

export interface UiConfig {
  readonly host: string;
  readonly port: number;
}

export interface LoggingConfig {
  readonly level: LogLevel;
}

export interface WorkersConfig {
  readonly defaultOutputMode: WorkerOutputMode;
}

export interface Config {
  readonly mode: Mode;
  readonly context: ContextConfig;
  readonly storage: StorageConfig;
  readonly ui: UiConfig;
  readonly logging: LoggingConfig;
  readonly workers: WorkersConfig;
}

export const MODES: readonly Mode[] = ["cheap", "balanced", "full"];
export const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
export const WORKER_OUTPUT_MODES: readonly WorkerOutputMode[] = [
  "minimal",
  "normal",
  "detailed",
];
