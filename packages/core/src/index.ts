export {
  MODES,
  LOG_LEVELS,
  WORKER_OUTPUT_MODES,
  type Config,
  type ContextConfig,
  type LoggingConfig,
  type LogLevel,
  type Mode,
  type StorageConfig,
  type UiConfig,
  type WorkerOutputMode,
  type WorkersConfig,
} from "./types.js";

export {
  DATA_DIR_ENV,
  DATA_SUBDIRECTORIES,
  DEFAULT_STORAGE_DIRECTORY,
  ensureDataDir,
  isWritableDir,
  resolvePaths,
  type CtxdPaths,
  type ResolvePathsOptions,
} from "./paths.js";

export {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  validateConfig,
  type ConfigValidation,
  type LoadedConfig,
} from "./config.js";

export {
  createLogger,
  fileSink,
  isLogLevel,
  multiSink,
  stderrSink,
  type CreateLoggerOptions,
  type LogRecord,
  type Logger,
  type LogSink,
} from "./logger.js";

export const VERSION = "0.1.0";
