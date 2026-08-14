export {
  changedLines,
  countModifiedLines,
  parseUnifiedDiff,
  type DiffHunk,
  type DiffLine,
  type DiffLineKind,
  type FileChangeKind,
  type FileDiff,
  type ParsedDiff,
} from "./parse.js";

export {
  isGitRepository,
  readDiff,
  type DiffScope,
  type DiffSource,
  type ReadDiffOptions,
} from "./source.js";

export {
  commentStyle,
  commentText,
  countByNormalized,
  extensionOf,
  isCommentLine,
  isImportLine,
  normalizePresentation,
  type CommentStyle,
} from "./syntax.js";

export {
  analyzeFileNoise,
  type FileNoise,
  type FormattingKind,
} from "./noise.js";

export {
  analyzeComments,
  isDocBlockLine,
  judgeComment,
  type AddedComment,
  type CommentJudgement,
  type CommentNoise,
  type CommentVerdict,
} from "./comments.js";

export {
  expectedScope,
  inferTaskSize,
  isRelated,
  isTestPath,
  type ExpectedScope,
  type ScopeOptions,
  type TaskSize,
} from "./scope.js";

export {
  computeChangeSurface,
  extensionCounts,
  isDependencyChange,
  isGeneratedFile,
  isLockFile,
  primaryFiles,
  type ChangeSurface,
  type FileSurface,
  type SurfaceOptions,
} from "./surface.js";

export {
  detectOverEditing,
  type EfficiencyPenalty,
  type OverEditAnalysis,
  type OverEditSignal,
  type SignalSeverity,
} from "./overedit.js";

export {
  classifyChange,
  type ChangeClassification,
  type ClassificationResult,
  type ClassifyOptions,
  type Risk,
  type VerificationStatus,
} from "./classify.js";

export {
  buildChangeReceipt,
  DIFF_ALGORITHM_VERSION,
  formatChangeReceipt,
  writeChangeReceipt,
  type BuildChangeReceiptInput,
  type ChangeReceipt,
  type ReceiptFileEntry,
} from "./receipt.js";

export {
  analyzeDiff,
  analyzeWorkingTree,
  type AnalyzeOptions,
  type AnalyzeWorkingTreeOptions,
  type DiffAnalysis,
  type WorkingTreeAnalysis,
} from "./analyze.js";

export {
  verificationFreshness,
  type Freshness,
  type FreshnessInput,
  type FreshnessReport,
} from "./freshness.js";
