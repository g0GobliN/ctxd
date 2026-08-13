/**
 * The Diff Firewall pipeline.
 *
 * diff ──► surface ──► noise ──► over-edit ──► classify ──► receipt
 *
 * A pure function over a parsed diff, mirroring the Context Firewall: same
 * input, same output, every time. `analyzeWorkingTree` is the thin shell that
 * reads the diff from Git first.
 */

import { analyzeComments, type CommentNoise } from "./comments.js";
import {
  classifyChange,
  type ClassificationResult,
  type VerificationStatus,
} from "./classify.js";
import { detectOverEditing, type OverEditAnalysis } from "./overedit.js";
import type { FileDiff } from "./parse.js";
import {
  buildChangeReceipt,
  type ChangeReceipt,
} from "./receipt.js";
import { readDiff, type DiffScope, type DiffSource } from "./source.js";
import { computeChangeSurface, type ChangeSurface } from "./surface.js";

export interface AnalyzeOptions {
  readonly task?: string | undefined;
  readonly project?: string | undefined;
  readonly worker?: string | undefined;
  readonly expectedPaths?: readonly string[] | undefined;
  readonly verification?: VerificationStatus | undefined;
  readonly architectureViolations?: readonly string[] | undefined;
  /** Description of what was compared, recorded on the receipt. */
  readonly against?: string | undefined;
  readonly warnings?: readonly string[] | undefined;
  readonly requestId?: string | undefined;
  readonly timestamp?: string | undefined;
}

export interface DiffAnalysis {
  readonly surface: ChangeSurface;
  readonly comments: CommentNoise;
  readonly overEdit: OverEditAnalysis;
  readonly classification: ClassificationResult;
  readonly receipt: ChangeReceipt;
}

/**
 * Analyse an already-parsed diff.
 *
 * Exposed separately from the Git-reading path so the firewall can be tested on
 * fixture diffs with no repository involved — the same reason the Context
 * Engine is exposed as a pure function.
 */
export function analyzeDiff(
  files: readonly FileDiff[],
  options: AnalyzeOptions = {},
): DiffAnalysis {
  const task = options.task ?? "";
  const surface = computeChangeSurface(files, {
    task: options.task,
    expectedPaths: options.expectedPaths,
  });
  const comments = analyzeComments(files);
  const overEdit = detectOverEditing(files, surface, comments);
  const classification = classifyChange(surface, overEdit, {
    verification: options.verification,
    architectureViolations: options.architectureViolations,
  });

  const receipt = buildChangeReceipt({
    project: options.project ?? "unknown",
    task: task === "" ? "(no task supplied)" : task,
    worker: options.worker ?? "unknown",
    scope: options.against ?? "working tree",
    surface,
    comments,
    signals: overEdit.signals,
    efficiencyScore: overEdit.change_efficiency_score,
    classification,
    verification: options.verification ?? "UNKNOWN",
    warnings: options.warnings ?? [],
    ...(options.requestId === undefined ? {} : { requestId: options.requestId }),
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
  });

  return { surface, comments, overEdit, classification, receipt };
}

export interface AnalyzeWorkingTreeOptions extends AnalyzeOptions {
  readonly cwd: string;
  readonly scope?: DiffScope | undefined;
  readonly range?: string | undefined;
  readonly paths?: readonly string[] | undefined;
  readonly includeUntracked?: boolean | undefined;
}

export interface WorkingTreeAnalysis extends DiffAnalysis {
  readonly source: DiffSource;
}

/** Read the current diff from Git and run it through the firewall. */
export function analyzeWorkingTree(options: AnalyzeWorkingTreeOptions): WorkingTreeAnalysis {
  const source = readDiff({
    cwd: options.cwd,
    ...(options.scope === undefined ? {} : { scope: options.scope }),
    ...(options.range === undefined ? {} : { range: options.range }),
    ...(options.paths === undefined ? {} : { paths: options.paths }),
    ...(options.includeUntracked === undefined
      ? {}
      : { includeUntracked: options.includeUntracked }),
  });

  const analysis = analyzeDiff(source.files, {
    ...options,
    against: options.against ?? source.against,
    warnings: [...(options.warnings ?? []), ...source.warnings],
  });

  return { ...analysis, source };
}
