/**
 * Moving work between workers (UI-11, §37).
 *
 * `buildHandoff` already assembles everything an incoming worker needs to read.
 * What it does not do is *move* anything: it produces a summary, and a summary
 * a developer copies between two chat windows is not a task changing hands. If
 * the outgoing session dies before the paste, the work is where it was and
 * nobody knows.
 *
 * A transfer makes the move durable, on the checkpoint infrastructure that
 * already exists rather than a mechanism invented for it:
 *
 *   1. a checkpoint records the state at the moment of the handover
 *   2. the task is reassigned to the incoming worker
 *   3. the handoff text is built from that checkpoint, so what the incoming
 *      worker reads and what ctxd recorded are the same thing
 *
 * The identity discipline from §6 applies throughout. `from` is what the
 * outgoing worker called itself, which ctxd cannot verify; `to` is an
 * assignment, not an observation of anyone picking it up. Neither is ever
 * presented as a fact ctxd established.
 */

import type { Db } from "@ctxd/db";
import type { GitInfo } from "@ctxd/project";
import { buildHandoff, createCheckpoint, latestCheckpoint, type Checkpoint, type Handoff } from "./checkpoints.js";
import { activeSession } from "./sessions.js";
import { getTask, updateTask, type Task } from "./tasks.js";

export interface TransferInput {
  readonly projectId: string;
  readonly root: string;
  /** Who is handing over. Self-declared and never verified (§6). */
  readonly fromWorker?: string | null;
  /** Who is being asked to pick the work up. */
  readonly toWorker: string;
  /** Which task to move. Defaults to whatever the session or checkpoint names. */
  readonly taskId?: string | null;
  /** A note from the outgoing worker, recorded verbatim. */
  readonly note?: string | undefined;
  readonly git?: GitInfo;
}

export interface TransferResult {
  readonly handoff: Handoff;
  /** The checkpoint written at the moment of transfer. */
  readonly checkpoint: Checkpoint;
  /** The task that moved, or undefined when there was none to move. */
  readonly task: Task | undefined;
  readonly fromWorker: string | null;
  readonly toWorker: string;
  /**
   * What ctxd could not do, stated rather than skipped.
   *
   * A transfer that silently moved nothing would be the worst possible
   * outcome: the outgoing worker believes the work was handed on, and it was
   * not (§37).
   */
  readonly warnings: readonly string[];
}

/**
 * Which task is being handed over.
 *
 * An explicit id wins. Otherwise the active session's task, then the latest
 * checkpoint's — the same order `buildHandoff` uses, so the transfer and the
 * summary can never disagree about what is moving.
 */
function resolveTask(db: Db, input: TransferInput): Task | undefined {
  if (input.taskId !== undefined && input.taskId !== null) {
    return getTask(db, input.taskId);
  }

  const session = activeSession(db, input.projectId);
  if (session?.taskId != null) {
    const fromSession = getTask(db, session.taskId);
    if (fromSession !== undefined) return fromSession;
  }

  const checkpoint = latestCheckpoint(db, input.projectId);
  if (checkpoint?.taskId != null) return getTask(db, checkpoint.taskId);

  return undefined;
}

/**
 * Hand the work to another worker.
 *
 * Records before it reassigns, so a failure between the two leaves a
 * checkpoint describing real state rather than a task assigned to a worker
 * with nothing to read.
 */
export function transferTask(db: Db, input: TransferInput, now = new Date()): TransferResult {
  const warnings: string[] = [];

  if (input.toWorker.trim() === "") {
    throw new Error("a transfer needs a worker to hand to");
  }

  const task = resolveTask(db, input);
  const session = activeSession(db, input.projectId);
  const from = input.fromWorker ?? session?.worker ?? null;

  if (from === null) {
    // Not fatal — the work still moves. But the record will say the outgoing
    // side was unknown rather than guessing at whoever last touched the
    // project, which is exactly the inference §6 forbids.
    warnings.push(
      "no outgoing worker was named, so this handoff records an unknown sender — " +
        "run with --from, or start the session with a worker name",
    );
  }

  if (from !== null && from === input.toWorker) {
    warnings.push(
      `the outgoing and incoming worker are both "${input.toWorker}", so nothing changed hands`,
    );
  }

  const checkpoint = createCheckpoint(
    db,
    {
      projectId: input.projectId,
      root: input.root,
      ...(task === undefined ? {} : { taskId: task.id }),
      // The checkpoint is what makes the transfer durable, so it says plainly
      // that a handover happened and to whom.
      nextAction:
        input.note === undefined || input.note.trim() === ""
          ? `handed to ${input.toWorker}`
          : `handed to ${input.toWorker}: ${input.note}`,
      worker: from,
      ...(input.git === undefined ? {} : { git: input.git }),
    },
    now,
  );

  let moved = task;
  if (task === undefined) {
    warnings.push(
      "no task is associated with this work, so nothing was reassigned — " +
        "the checkpoint and handoff still describe the state",
    );
  } else {
    moved = updateTask(db, task.id, { worker: input.toWorker }, now) ?? task;
  }

  const handoff = buildHandoff(db, {
    projectId: input.projectId,
    root: input.root,
    recommendedWorker: input.toWorker,
    ...(input.git === undefined ? {} : { git: input.git }),
  });

  return {
    handoff,
    checkpoint,
    task: moved,
    fromWorker: from,
    toWorker: input.toWorker,
    warnings,
  };
}

/**
 * Render a transfer for a terminal or a tool result.
 *
 * The header states the claim status of both names, because the handoff text
 * is the thing an incoming worker reads, and a line saying "from claude" with
 * no qualification is how a self-declared name becomes an assumed fact.
 */
export function formatTransfer(result: TransferResult): string {
  const lines = [
    `HANDOFF — ${result.fromWorker ?? "unknown"} → ${result.toWorker}`,
    "",
    result.task === undefined
      ? "No task was associated with this work."
      : `Task "${result.task.title}" is now assigned to ${result.toWorker}.`,
    `Checkpoint ${result.checkpoint.id} recorded at ${result.checkpoint.createdAt}.`,
    "",
    // §6: the outgoing name was self-declared, and the incoming one has not
    // been observed doing anything yet.
    "Both names are configuration, not identification. ctxd records who a worker",
    "said it was and who the work was assigned to; it cannot verify either.",
    "",
  ];

  if (result.warnings.length > 0) {
    lines.push("Warnings:", ...result.warnings.map((warning) => `  ! ${warning}`), "");
  }

  return lines.join("\n");
}
