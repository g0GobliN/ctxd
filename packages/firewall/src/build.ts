import {
  buildContext,
  extractTaskSignals,
  type BuildContextResult,
  type ContextItem,
  type RankingWeights,
} from "@ctxd/context";
import type { Config, CtxdPaths } from "@ctxd/core";
import type { Db } from "@ctxd/db";
import { detectProject, findProjectByRoot, inspectGit, type ProjectRow } from "@ctxd/project";
import { gitProvider, memoryProvider, type RetrievalProvider } from "./providers.js";

export interface BuildProjectContextOptions {
  readonly task: string;
  readonly dir: string;
  readonly budget: number;
  readonly db: Db;
  readonly paths?: CtxdPaths;
  readonly config?: Config;
  readonly weights?: RankingWeights;
  readonly now?: number;
  readonly requestId?: string;
  readonly timestamp?: string;
  /** Self-declared requester, recorded on the receipt as a claim (§6). */
  readonly claimedWorker?: string | undefined;
  /** Record that retrieved memories were used. Off in tests for determinism. */
  readonly touchMemories?: boolean;
}

export interface ProjectContextResult extends BuildContextResult {
  /** The registered project, when this directory is one. */
  readonly project: ProjectRow | undefined;
  /** Candidates contributed by each non-filesystem provider. */
  readonly retrieved: Readonly<Record<string, number>>;
}

/**
 * Build context for a registered project.
 *
 * This is the production firewall: the filesystem is only one source. Project
 * memory and current Git state are retrieved alongside it, and everything joins
 * the same pipeline — dedup, ranking, coverage, budget, compression, receipt.
 * Nothing gets into the context by virtue of where it came from.
 *
 * An unregistered directory still works, using files alone. Degrading to a
 * smaller set of signals is correct; pretending memory exists when it does not
 * would not be.
 *
 * Two directories matter here and they are deliberately not the same one:
 *
 *   `detected.root` — the project's identity and Git state. Anchored to the
 *                     repository root so memory stays attached to the project
 *                     from any subdirectory.
 *   `options.dir`   — the scope files are collected from. Exactly what the
 *                     caller asked for.
 *
 * Collecting from the repository root instead would silently widen every
 * request made from a subdirectory into a whole-repository scan — the opposite
 * of what a minimum-useful-context tool promises, and it would inflate the
 * "estimated context avoided" figure with files nobody asked about.
 */
export function buildProjectContext(
  options: BuildProjectContextOptions,
): ProjectContextResult {
  const signals = extractTaskSignals(options.task);
  const detected = detectProject(options.dir);
  const project = findProjectByRoot(options.db, detected.root);

  const providers: RetrievalProvider[] = [];
  if (project !== undefined) {
    providers.push(
      memoryProvider(options.db, project.id, {
        ...(options.touchMemories === true ? { touch: true } : {}),
      }),
    );
  }
  providers.push(
    gitProvider(inspectGit(detected.root), {
      ...(options.now === undefined ? {} : { now: options.now }),
    }),
  );

  const extraCandidates: ContextItem[] = [];
  const retrieved: Record<string, number> = {};

  for (const provider of providers) {
    const items = provider.retrieve(signals);
    retrieved[provider.name] = items.length;
    extraCandidates.push(...items);
  }

  const result = buildContext({
    task: options.task,
    dir: options.dir,
    budget: options.budget,
    project: project?.name ?? detected.name,
    extraCandidates,
    ...(options.claimedWorker === undefined ? {} : { claimedWorker: options.claimedWorker }),
    ...(options.weights === undefined ? {} : { weights: options.weights }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.requestId === undefined ? {} : { requestId: options.requestId }),
    ...(options.timestamp === undefined ? {} : { timestamp: options.timestamp }),
    ...(options.config === undefined
      ? {}
      : { safetyMarginTokens: options.config.context.safetyMarginTokens }),
  });

  return { ...result, project, retrieved };
}
