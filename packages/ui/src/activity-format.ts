/**
 * How an event is worded in the activity stream (UI-5).
 *
 * Separated from the panel so the wording can be checked against the event
 * types the core actually emits. The claim the stream makes is that every line
 * corresponds to a stored event; that is only worth making if there is no way
 * for a line to appear without one, and no label sitting here for an event type
 * that no producer writes.
 */

import type { CtxdEvent } from "./api.js";

/**
 * Human wording per event type.
 *
 * Deliberately exhaustive rather than clever: a lookup that fell back to
 * prettifying the raw name would silently accept a type nobody meant to
 * display, and the stream would start explaining events it does not understand.
 */
export const LABELS: Readonly<Record<string, string>> = {
  worker_connected: "Worker attached",
  worker_disconnected: "Worker detached",
  worker_request_started: "Worker request started",
  worker_request_finished: "Worker request finished",
  worker_error: "Worker error",
  context_requested: "Context requested",
  context_built: "Context built",
  verification_started: "Verification started",
  verification_finished: "Verification finished",
  memory_updated: "Memory updated",
  task_updated: "Task updated",
  checkpoint_created: "Checkpoint created",
  handoff_created: "Work handed over",
  change_analyzed: "Change analysed",
};

/**
 * The label for an event.
 *
 * An unrecognised type renders as its raw name rather than being dropped. The
 * event happened; hiding it because this build has no wording for it would
 * make the stream quietly incomplete, which is worse than one ugly line.
 */
export function labelFor(type: string): string {
  return LABELS[type] ?? type;
}

export function toneFor(type: string): string {
  if (type === "worker_error") return "danger";
  if (type === "worker_disconnected") return "warn";
  if (type === "context_built" || type === "verification_finished") return "ok";
  return "";
}

/**
 * One line of detail, drawn only from what the event carries.
 *
 * Returns nothing when the event carries nothing to say. An event with no
 * payload gets no detail line rather than a generic one — a sentence that reads
 * the same whether or not ctxd knew anything is the shape of claim §37 exists
 * to prevent.
 */
export function detailFor(event: CtxdEvent): string | undefined {
  const { data } = event;

  if (event.type === "context_built") {
    const candidate = data["candidateTokens"];
    const final = data["finalTokens"];
    if (typeof candidate === "number" && typeof final === "number") {
      // Labelled estimated because the tokenizer is a heuristic (§18, §49).
      return `${candidate.toLocaleString()} → ${final.toLocaleString()} estimated tokens`;
    }
  }

  if (event.type === "change_analyzed") {
    const verdict = data["classification"];
    const files = data["filesChanged"];
    if (typeof verdict === "string") {
      return typeof files === "number" ? `${verdict} · ${files} file(s)` : verdict;
    }
  }

  if (event.type === "handoff_created") {
    const to = data["toWorker"];
    const from = data["fromWorker"];
    if (typeof to === "string") {
      // Both names are self-declared or assigned, never observed (§6), which
      // is why the line reads as a direction rather than as an identity.
      return `${typeof from === "string" ? from : "unknown"} → ${to}`;
    }
  }

  if (event.type === "verification_finished") {
    const status = data["status"];
    const failed = data["failed"];
    const unavailable = data["unavailable"];
    if (typeof status === "string") {
      const notes: string[] = [];
      if (typeof failed === "number" && failed > 0) notes.push(`${failed} failed`);
      // A check that could not run is not a check that passed, so it is named
      // separately rather than folded into the total (§58).
      if (typeof unavailable === "number" && unavailable > 0) {
        notes.push(`${unavailable} unavailable`);
      }
      return notes.length === 0 ? status : `${status} · ${notes.join(", ")}`;
    }
  }

  const task = data["task"];
  if (typeof task === "string") return task;

  return undefined;
}

/**
 * Merge the replayed history with what arrived live.
 *
 * Deduplicated by id, because an event can arrive both ways when the stream
 * opens while the history request is still in flight — and the same event shown
 * twice reads as two things having happened.
 */
export function mergeEvents(
  live: readonly CtxdEvent[],
  history: readonly CtxdEvent[],
  window: number,
): readonly CtxdEvent[] {
  const seen = new Set(live.map((event) => event.id));
  return [...live, ...history.filter((event) => !seen.has(event.id))].slice(0, window);
}
