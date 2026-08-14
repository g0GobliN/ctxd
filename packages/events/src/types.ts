/**
 * The live event log (§6, §7).
 *
 * ctxd runs as several processes that share no memory: the MCP server is
 * started by the worker, the HTTP API by `ctxd ui`, and the CLI by the
 * developer. An event raised in one has to reach a browser attached to
 * another, so events are written to SQLite — already the shared state between
 * all three — and the API process tails the table and fans them out.
 *
 * The discipline throughout is §37: a field with no evidence behind it is
 * null, never a plausible value.
 */

/**
 * What happened.
 *
 * Kept as a closed union so the interface can render each kind deliberately.
 * Adding a type is a deliberate act: an event nothing renders is an event that
 * misleads whoever finds it in the table.
 */
export type EventType =
  // Transport-level facts about a worker's connection. These are observed —
  // a client attached or detached — as distinct from what it claims to be.
  | "worker_connected"
  | "worker_disconnected"
  | "worker_request_started"
  | "worker_request_finished"
  | "worker_error"
  // The context firewall.
  | "context_requested"
  | "context_built"
  // Verification.
  | "verification_started"
  | "verification_finished"
  // Durable state.
  | "memory_updated"
  | "task_updated"
  | "checkpoint_created"
  // Work changing hands. Distinct from `task_updated` because the interesting
  // fact is not that a field changed but that a different worker is expected to
  // continue — the one moment where losing context is most likely (§37).
  | "handoff_created"
  // The output firewall.
  | "change_analyzed";

export const EVENT_TYPES: readonly EventType[] = [
  "worker_connected",
  "worker_disconnected",
  "worker_request_started",
  "worker_request_finished",
  "worker_error",
  "context_requested",
  "context_built",
  "verification_started",
  "verification_finished",
  "memory_updated",
  "task_updated",
  "checkpoint_created",
  "handoff_created",
  "change_analyzed",
];

/**
 * Event payload.
 *
 * Identifiers and counts only. Never file contents, memory bodies or diff
 * text: the stream is a read route, so every local process can see it, and an
 * event carrying a file's contents would leak more than `/api/memory` does.
 * The client receives an id and fetches what it is allowed to fetch.
 */
export type EventData = Readonly<Record<string, string | number | boolean | null>>;

export interface CtxdEvent {
  /** Monotonic within the database. Doubles as the SSE cursor. */
  readonly id: number;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly taskId: string | null;
  /**
   * Who the producer said it was.
   *
   * Self-declared and never verified — the MCP server observes that *a* client
   * attached, not which one (§6). Treated exactly as `worker_statement`
   * provenance is treated in memory: recorded, attributed, never promoted to
   * fact. The interface must present it as a claim.
   */
  readonly worker: string | null;
  readonly type: EventType;
  readonly data: EventData;
  readonly createdAt: string;
}

export interface EmitEventInput {
  readonly projectId: string;
  readonly type: EventType;
  readonly sessionId?: string | null;
  readonly taskId?: string | null;
  readonly worker?: string | null;
  readonly data?: EventData;
}
