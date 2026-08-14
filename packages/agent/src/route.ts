/**
 * Choosing who runs a task, and saying why.
 *
 * ## The honest shape of this problem
 *
 * "Let ctxd decide which AI to use" sounds like a choice between several
 * runnable workers. Today it is not, and pretending otherwise would be the one
 * kind of dishonesty this project cannot afford.
 *
 * - **Claude Code** ships a headless mode (`claude -p`). ctxd can start it, wait
 *   for it, and read a structured result. It is a runnable worker.
 * - **Cursor** is an editor. There is no supported way to hand it a task from
 *   outside and get an edit back. It connects *to* ctxd over MCP and asks for
 *   context; it does not take instructions from another process. It is a
 *   *reachable* worker — work can be handed to it with `ctxd handoff` — but it
 *   cannot be *run*.
 *
 * So routing reports what is genuinely available rather than presenting a menu
 * where every option but one would fail. When a second runner exists, it
 * appears here and the choice becomes real.
 *
 * ## What is actually decided
 *
 * Model selection is a real decision and it is made here, deterministically,
 * from the size of the context ctxd already built. §41 applies: do not call a
 * model to make a judgement that ordinary code makes correctly. Asking an AI
 * which AI to use would cost a round trip, a token bill and a source of
 * non-determinism, to answer a question a threshold answers.
 *
 * Every choice carries its reason, for the same reason every context receipt
 * does: a decision you cannot inspect is a decision you cannot argue with.
 */

/** A worker ctxd can start itself. */
export interface RunnableWorker {
  readonly id: string;
  readonly name: string;
  /** The executable ctxd would spawn. */
  readonly command: string;
  readonly available: boolean;
  /** Why it is unavailable, when it is. */
  readonly detail?: string;
}

export type ModelChoice = "haiku" | "sonnet" | "opus";

export interface RoutingDecision {
  readonly worker: string;
  readonly model: ModelChoice;
  /** Stated in full, never implied. */
  readonly reasons: readonly string[];
  /** Workers that exist but cannot be started, and why. */
  readonly notRunnable: readonly RunnableWorker[];
}

/**
 * Thresholds for model choice, in estimated tokens of built context.
 *
 * These are deliberately coarse. A finer scale would imply a precision the
 * token counts do not have — they are labelled estimates everywhere else in
 * ctxd, and a routing table pretending otherwise would be the same lie in a
 * new place (§18).
 */
const SMALL_CONTEXT = 4_000;
const LARGE_CONTEXT = 40_000;

/**
 * Pick the model for a task.
 *
 * Size of context is the signal, not the wording of the task. A task
 * description is a sentence; the context ctxd assembled for it is evidence of
 * how much of the repository the work actually touches.
 */
export function chooseModel(contextTokens: number, override?: string): {
  model: ModelChoice;
  reason: string;
} {
  if (override === "haiku" || override === "sonnet" || override === "opus") {
    return { model: override, reason: `model chosen explicitly (${override})` };
  }

  if (contextTokens <= SMALL_CONTEXT) {
    return {
      model: "haiku",
      reason: `context is small (${contextTokens.toLocaleString()} estimated tokens ≤ ${SMALL_CONTEXT.toLocaleString()})`,
    };
  }
  if (contextTokens >= LARGE_CONTEXT) {
    return {
      model: "opus",
      reason: `context is large (${contextTokens.toLocaleString()} estimated tokens ≥ ${LARGE_CONTEXT.toLocaleString()})`,
    };
  }
  return {
    model: "sonnet",
    reason: `context is mid-sized (${contextTokens.toLocaleString()} estimated tokens)`,
  };
}

/**
 * Decide who runs this task.
 *
 * `runners` is what the caller found on the machine — kept as a parameter
 * rather than probed here so this stays a pure function and can be tested
 * against a machine that has no AI tooling installed at all.
 */
export function route(options: {
  readonly contextTokens: number;
  readonly runners: readonly RunnableWorker[];
  readonly worker?: string | undefined;
  readonly model?: string | undefined;
}): RoutingDecision {
  const available = options.runners.filter((runner) => runner.available);
  const notRunnable = options.runners.filter((runner) => !runner.available);
  const reasons: string[] = [];

  if (available.length === 0) {
    throw new Error(
      "no runnable worker is installed. " +
        notRunnable.map((r) => `${r.name}: ${r.detail ?? "unavailable"}`).join("; "),
    );
  }

  let chosen = available[0] as RunnableWorker;

  if (options.worker !== undefined && options.worker !== "") {
    const named = available.find((runner) => runner.id === options.worker);
    if (named === undefined) {
      const unavailable = notRunnable.find((runner) => runner.id === options.worker);
      throw new Error(
        unavailable === undefined
          ? `no runnable worker named ${options.worker}`
          : `${unavailable.name} cannot be started by ctxd: ${unavailable.detail ?? "unavailable"}`,
      );
    }
    chosen = named;
    reasons.push(`worker chosen explicitly (${chosen.id})`);
  } else if (available.length === 1) {
    // Said plainly rather than dressed up as a decision.
    reasons.push(`${chosen.name} is the only worker ctxd can start`);
  } else {
    reasons.push(`${chosen.name} selected from ${available.length} runnable workers`);
  }

  for (const runner of notRunnable) {
    reasons.push(`${runner.name} not considered: ${runner.detail ?? "unavailable"}`);
  }

  const model = chooseModel(options.contextTokens, options.model);
  reasons.push(model.reason);

  return { worker: chosen.id, model: model.model, reasons, notRunnable };
}
