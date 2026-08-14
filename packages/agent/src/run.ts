/**
 * The full flow: context → routing → worker → change review.
 *
 * This is the loop the developer watches instead of driving. Every stage is a
 * service that already existed and was already tested; this file is sequencing
 * and nothing else. That matters — an agent that reimplemented ranking, or
 * change analysis, would be a second set of answers to questions ctxd already
 * answers, and the two would drift.
 *
 * ## What it does not do
 *
 * It does not decide the work is finished. The Diff Firewall reports the shape
 * of the change and `verify` runs the project's checks, but neither commits,
 * reverts nor accepts anything (§34, §50). A run ends with evidence and a
 * verdict a person can disagree with.
 */

import { buildProjectContext } from "@ctxd/firewall";
import { analyzeWorkingTree } from "@ctxd/diff";
import { emitEvent } from "@ctxd/events";
import type { Db } from "@ctxd/db";
import { route, type RoutingDecision } from "./route.js";
import { runners, runWorker, type WorkerRunResult } from "./runner.js";

export interface AgentRunOptions {
  readonly db: Db;
  readonly projectId: string;
  readonly root: string;
  readonly task: string;
  readonly budget?: number;
  readonly config: NonNullable<Parameters<typeof buildProjectContext>[0]["config"]>;
  /** Force a worker. Without it, routing decides. */
  readonly worker?: string | undefined;
  readonly model?: string | undefined;
  /** Let the worker edit files. Off by default (§34). */
  readonly applyEdits?: boolean;
  readonly timeoutMs?: number;
}

export interface AgentRun {
  readonly task: string;
  readonly routing: RoutingDecision;
  /** The receipt for the context the worker was given. */
  readonly contextReceipt: unknown;
  readonly worker: WorkerRunResult;
  /**
   * The Diff Firewall's reading of what changed afterwards.
   *
   * Undefined when the worker was not allowed to edit, because then there is
   * nothing of the worker's to review and analysing the tree would report the
   * developer's own uncommitted work as if the agent had done it.
   */
  readonly change?: unknown;
}

/**
 * The instruction handed to the worker.
 *
 * The context ctxd selected is the body of it, and the rules exist to stop the
 * worker doing the two things the Diff Firewall would then have to flag: going
 * wider than the task, and reformatting on the way past.
 */
function composePrompt(task: string, context: string): string {
  return [
    "You are working inside a repository through ctxd, which has already",
    "selected the context below as the minimum needed for this task.",
    "",
    `TASK: ${task}`,
    "",
    "Rules:",
    "- Change only what the task requires. Unrelated edits will be flagged.",
    "- Do not reformat code you are not otherwise changing.",
    "- Do not add dependencies the task did not ask for.",
    "- If the context is insufficient, say what is missing rather than guessing.",
    "",
    "CONTEXT:",
    context,
  ].join("\n");
}

export async function runAgent(options: AgentRunOptions): Promise<AgentRun> {
  const { db, projectId, root, task } = options;

  // 1 — context. The same call `ctxd context` makes, so the agent is held to
  // the same budget and produces the same auditable receipt.
  const built = buildProjectContext({
    task,
    dir: root,
    budget: options.budget ?? 10_000,
    db,
    config: options.config,
    touchMemories: false,
  });

  const contextTokens = built.receipt.final_total_tokens;

  // 2 — routing, before anything is started, so a refusal costs nothing.
  const decision = route({
    contextTokens,
    runners: runners(),
    worker: options.worker,
    model: options.model,
  });

  emitEvent(db, {
    projectId,
    type: "worker_request_started",
    worker: decision.worker,
    data: {
      task,
      model: decision.model,
      contextTokens,
      requestId: built.receipt.request_id,
      source: "agent",
    },
  });

  // 3 — run it.
  const result = await runWorker({
    cwd: root,
    prompt: composePrompt(task, built.context),
    model: decision.model,
    ...(options.applyEdits === undefined ? {} : { applyEdits: options.applyEdits }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });

  emitEvent(db, {
    projectId,
    type: result.ok ? "worker_request_finished" : "worker_error",
    worker: decision.worker,
    data: {
      task,
      ok: result.ok,
      durationMs: result.durationMs,
      ...(result.error === undefined ? {} : { error: result.error }),
      source: "agent",
    },
  });

  // 4 — review what came back, but only when the worker could actually change
  // anything. Analysing the tree after a read-only run would attribute the
  // developer's own uncommitted work to the agent.
  let change: unknown;
  if (options.applyEdits === true) {
    try {
      change = analyzeWorkingTree({ cwd: root, task }).receipt;
    } catch {
      // Not a Git repository, or nothing to read. The run still happened, and
      // reporting it as failed because the review could not run would be a
      // worse answer than reporting the review as absent.
      change = undefined;
    }
  }

  return {
    task,
    routing: decision,
    contextReceipt: built.receipt,
    worker: result,
    ...(change === undefined ? {} : { change }),
  };
}
