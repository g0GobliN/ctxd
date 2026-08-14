/**
 * Which part of the graph an event touches (UI-4).
 *
 * Kept apart from the drawing code, and free of React and the DOM, so the
 * mapping can be tested against events a real producer wrote rather than
 * against a fixture invented for the test. The graph's claim is that it moves
 * because something happened; that claim is only worth making if the link
 * between the event and the movement is checkable.
 *
 * The rule from §37 applies here too. An event that does not say which worker
 * raised it highlights the core and nothing else — attributing it to whichever
 * worker happens to be on screen would be inventing the attribution the event
 * itself declined to make.
 */

import type { CtxdEvent } from "./api.js";

/**
 * How long a pulse lasts.
 *
 * Long enough to be seen on a glance away from the screen, short enough that
 * two events a second apart read as two events rather than one long glow.
 */
export const HIGHLIGHT_MS = 2200;

/**
 * Element keys.
 *
 * `worker:<claimed name>` and `edge:worker:<claimed name>` carry the
 * self-declared name because that is the only handle the event provides; the
 * graph renders it as a claim exactly as every other surface does (§6).
 */
export const CORE = "core";
export const MEMORY = "memory";
export const REPOSITORY = "repository";
export const VERIFICATION = "verification";
export const EDGE_MEMORY = "edge:memory";
export const EDGE_REPOSITORY = "edge:repository";
export const EDGE_VERIFICATION = "edge:verification";

export function workerKey(claimedName: string): string {
  return `worker:${claimedName}`;
}

export function workerEdgeKey(claimedName: string): string {
  return `edge:worker:${claimedName}`;
}

/**
 * The elements one event lights up.
 *
 * Every path includes the core, because every path actually goes through it —
 * that is the one claim the picture makes, and an event that appeared to reach
 * memory without passing through ctxd would contradict the architecture the
 * diagram exists to show.
 */
export function elementsForEvent(event: CtxdEvent): readonly string[] {
  const worker =
    event.claimedWorker === null
      ? []
      : [workerKey(event.claimedWorker), workerEdgeKey(event.claimedWorker)];

  switch (event.type) {
    case "worker_connected":
    case "worker_disconnected":
    case "worker_request_started":
    case "worker_request_finished":
    case "worker_error":
      return [...worker, CORE];

    // Retrieval reads memory, so the memory edge is the part of the picture
    // that is actually carrying traffic.
    case "context_requested":
    case "context_built":
      return [...worker, CORE, MEMORY, EDGE_MEMORY];

    case "memory_updated":
      return [...worker, CORE, MEMORY, EDGE_MEMORY];

    case "verification_started":
    case "verification_finished":
      return [...worker, CORE, VERIFICATION, EDGE_VERIFICATION];

    // The output firewall reads the working tree, so it is the repository edge
    // that lights up, not verification — a change analysis runs no checks.
    case "change_analyzed":
      return [...worker, CORE, REPOSITORY, EDGE_REPOSITORY];

    case "task_updated":
    case "checkpoint_created":
      return [...worker, CORE];

    // A handoff is durable state written through the core, so memory lights
    // with it. The *incoming* worker is not lit: it has been assigned the work,
    // which is not the same as having been observed doing anything, and a graph
    // that lit it would be showing activity that has not happened (§37).
    case "handoff_created":
      return [...worker, CORE, MEMORY, EDGE_MEMORY];

    default:
      // An event type the interface does not know about still happened. It
      // reaches the core, which is the only thing that can be said about it
      // without guessing.
      return [...worker, CORE];
  }
}

/**
 * Whether an event can change a number the graph displays.
 *
 * All of them can: connection state, token counts, memory totals, task counts
 * and the verification status each derive from something an event records.
 * Rather than maintain a list that would quietly go stale as producers are
 * added, the graph refetches on any event and lets debouncing absorb a burst.
 */
export function affectsGraphData(): boolean {
  return true;
}

/** Element key → the time its most recent pulse started. */
export type Pulses = ReadonlyMap<string, number>;

export function applyPulse(current: Pulses, event: CtxdEvent, now: number): Pulses {
  const next = new Map(current);
  for (const key of elementsForEvent(event)) next.set(key, now);
  return next;
}

/** The keys still lit at `now`, and nothing else. */
export function activeElements(pulses: Pulses, now: number): ReadonlySet<string> {
  const active = new Set<string>();
  for (const [key, at] of pulses) {
    if (now - at < HIGHLIGHT_MS) active.add(key);
  }
  return active;
}

/**
 * Drop pulses that have finished.
 *
 * Without this the map grows for the life of the page — one entry per distinct
 * element, which is bounded, but one per worker name seen, which is not.
 */
export function prunePulses(pulses: Pulses, now: number): Pulses {
  const next = new Map<string, number>();
  for (const [key, at] of pulses) {
    if (now - at < HIGHLIGHT_MS) next.set(key, at);
  }
  return next;
}
