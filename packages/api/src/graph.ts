/**
 * The engineering graph (§4, §5, UI-3).
 *
 * Assembled here rather than in React, for the same reason every other verdict
 * is: the interface renders what the core decided, and a browser that stitched
 * these numbers together itself would be a second place where they could be
 * wrong. The UI's job is layout.
 *
 * Every node reports what is actually known. A node with no evidence behind it
 * says so — `unknown` is a real answer here, not a placeholder (§37).
 */

import { verificationFreshness } from "@ctxd/diff";
import { countMemories } from "@ctxd/memory";
import { describeGit, inspectGit } from "@ctxd/project";
import { listTasks } from "@ctxd/work";
import { workerConnections } from "@ctxd/events";
import { VERSION } from "@ctxd/core";
import type { RouteContext } from "./context.js";
import { latestChangeReceipt, latestContextReceipt } from "./receipts.js";

export interface GraphWorkerNode {
  readonly id: string;
  /** Self-declared; ctxd cannot verify it (§6). */
  readonly claimedName: string;
  readonly connection: string;
  readonly since: string | null;
  readonly openEnded: boolean;
  readonly currentTask: string | null;
}

export interface CtxdGraph {
  readonly core: {
    readonly version: string;
    readonly mode: string;
    readonly dir: string;
    readonly projects: number;
    /** Workers whose last transport event was an attachment. */
    readonly workersAttached: number;
    readonly workersKnown: number;
  };
  readonly context: {
    /** Newest context receipt, or null when none has been written. */
    readonly lastRequestId: string | null;
    readonly lastAt: string | null;
    readonly candidateTokens: number | null;
    readonly finalTokens: number | null;
    readonly claimedWorker: string | null;
    /** Always "estimated" while the heuristic tokenizer is in use (§49). */
    readonly accuracy: string;
  };
  readonly memory: {
    readonly total: number;
    readonly byType: Readonly<Record<string, number>>;
  };
  readonly repository: {
    readonly git: string;
    readonly dir: string;
  };
  readonly verification: {
    /** From the newest Change Receipt — a past result, never a live claim. */
    readonly status: string;
    readonly at: string | null;
    readonly source: string;
    /** current | stale | unknown — judged against the tree, not a clock (UI-8). */
    readonly freshness: string;
    /** The file or commit that made it stale, when it is. */
    readonly changedSince: string | null;
    readonly reason: string;
  };
  readonly tasks: {
    readonly total: number;
    readonly inProgress: number;
  };
  readonly workers: readonly GraphWorkerNode[];
}

export function buildGraph(context: RouteContext, projectId: string): CtxdGraph {
  const { db } = context;

  const connections = workerConnections(db, projectId);
  const tasks = listTasks(db, projectId, {});
  const memory = countMemories(db, projectId);
  const contextReceipt = latestContextReceipt(context.paths);
  const changeReceipt = latestChangeReceipt(context.paths);

  // Judged against the working tree rather than against a clock: a PASS is
  // stale because something changed after it, not because time passed (§21).
  const freshness = verificationFreshness({
    cwd: context.dir,
    status: changeReceipt?.verification_status,
    at: changeReceipt?.timestamp,
  });

  const openTasks = tasks.filter((task) => task.status === "IN_PROGRESS");

  return {
    core: {
      version: VERSION,
      mode: context.config.mode,
      dir: context.dir,
      projects: 1,
      workersAttached: connections.filter(
        (entry) => entry.state === "connected" || entry.state === "working",
      ).length,
      workersKnown: connections.length,
    },

    context: {
      lastRequestId: contextReceipt?.request_id ?? null,
      lastAt: contextReceipt?.timestamp ?? null,
      candidateTokens: contextReceipt?.candidate_total_tokens ?? null,
      finalTokens: contextReceipt?.final_total_tokens ?? null,
      claimedWorker: contextReceipt?.claimed_worker ?? null,
      accuracy: contextReceipt?.token_count_estimation ?? "unknown",
    },

    memory: { total: memory.total, byType: memory.byType },

    repository: {
      git: describeGit(inspectGit(context.dir), context.dir),
      dir: context.dir,
    },

    verification: {
      // Verification runs on demand and is not stored as a first-class record,
      // so the honest source is the newest Change Receipt and its timestamp. A
      // status with no time attached would read as current when it is not —
      // which is why the freshness verdict travels with it rather than being
      // left for the reader to work out from a date (UI-8).
      status: freshness.status,
      at: freshness.at,
      source: changeReceipt === undefined ? "none" : "change_receipt",
      freshness: freshness.freshness,
      changedSince: freshness.changedSince,
      reason: freshness.reason,
    },

    tasks: { total: tasks.length, inProgress: openTasks.length },

    workers: connections.map((entry) => ({
      id: entry.claimedWorker,
      claimedName: entry.claimedWorker,
      connection: entry.state,
      since: entry.since,
      openEnded: entry.openEnded,
      currentTask: null,
    })),
  };
}
