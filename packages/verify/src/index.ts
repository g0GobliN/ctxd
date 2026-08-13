export {
  CAPABILITIES,
  createWorker,
  KNOWN_WORKERS,
  workerDefinition,
  type StatusLookup,
  type Worker,
  type WorkerDefinition,
  type WorkerState,
  type WorkerStatus,
} from "./worker.js";

export {
  categorize,
  runCommand,
  type CommandCategory,
  type CommandOutcome,
  type RunOptions,
} from "./commands.js";

export {
  detectPackageManager,
  discoverChecks,
  type CheckDefinition,
  type CheckKind,
} from "./checks.js";

export {
  compileRules,
  detectDrift,
  EXAMPLE_RULES,
  formatDrift,
  type ArchitectureRule,
  type ArchitectureViolation,
} from "./architecture.js";

export {
  formatVerification,
  verify,
  type CheckResult,
  type CheckStatus,
  type VerificationResult,
  type VerificationStatus,
  type VerifyOptions,
} from "./engine.js";

export {
  DEFAULT_OUTPUT_MODE,
  deltaKey,
  formatReport,
  reportFrom,
  selectDeltas,
  type ContextDelta,
  type DeltaKind,
  type DeltaLedger,
  type DeltaSelection,
  type OutputMode,
  type WorkerReport,
} from "./report.js";

export {
  buildCorrectionContext,
  extractLocations,
  type CorrectionContext,
  type CorrectionOptions,
  type CorrectionSource,
  type ErrorLocation,
} from "./correction.js";
