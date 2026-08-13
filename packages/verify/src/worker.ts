/**
 * Worker abstraction (§42).
 *
 * A worker is whatever produces changes — Claude, Cursor, a local model, a
 * human. ctxd deliberately knows nothing about how any of them work: no
 * provider SDK, no API call, no provider-specific branch anywhere in this file.
 * Workers are replaceable; the memory they share is not.
 */

export type WorkerState = "idle" | "active" | "unknown";

export interface WorkerStatus {
  readonly id: string;
  readonly state: WorkerState;
  /** ISO timestamp of the worker's last recorded activity, if known. */
  readonly lastActivity?: string;
  readonly currentTask?: string;
  readonly lastError?: string;
  /** Where the status came from, so an inferred value is never read as fact. */
  readonly source: "session" | "unknown";
}

export interface Worker {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly string[];
  status(): Promise<WorkerStatus>;
}

/** Capabilities a worker may declare. Free-form by design (§42). */
export const CAPABILITIES = {
  editFiles: "edit_files",
  runCommands: "run_commands",
  readContext: "read_context",
  writeMemory: "write_memory",
  mcp: "mcp",
} as const;

export interface WorkerDefinition {
  readonly id: string;
  readonly name: string;
  readonly capabilities: readonly string[];
}

/**
 * Workers ctxd ships knowing the *names* of.
 *
 * This is a label registry, not an integration: nothing here changes ctxd's
 * behaviour. A worker ctxd has never heard of works exactly as well — it simply
 * carries its own name.
 */
export const KNOWN_WORKERS: readonly WorkerDefinition[] = [
  {
    id: "claude",
    name: "Claude Code",
    capabilities: [
      CAPABILITIES.editFiles,
      CAPABILITIES.runCommands,
      CAPABILITIES.readContext,
      CAPABILITIES.writeMemory,
      CAPABILITIES.mcp,
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    capabilities: [
      CAPABILITIES.editFiles,
      CAPABILITIES.readContext,
      CAPABILITIES.writeMemory,
      CAPABILITIES.mcp,
    ],
  },
  {
    id: "local",
    name: "Local worker",
    capabilities: [CAPABILITIES.editFiles, CAPABILITIES.runCommands, CAPABILITIES.readContext],
  },
];

/** Look up a worker definition, or describe an unknown one honestly. */
export function workerDefinition(id: string): WorkerDefinition {
  const known = KNOWN_WORKERS.find((worker) => worker.id === id.toLowerCase());
  if (known !== undefined) return known;
  return { id, name: id, capabilities: [] };
}

export interface StatusLookup {
  /** Most recent activity ctxd recorded for this worker, if any. */
  (id: string): Omit<WorkerStatus, "id" | "source"> | undefined;
}

/**
 * Build a Worker from a definition and a status source.
 *
 * The status source is injected rather than imported so this package never
 * depends on the database — the same reason the Context Engine is exposed as a
 * pure function.
 */
export function createWorker(definition: WorkerDefinition, lookup?: StatusLookup): Worker {
  return {
    id: definition.id,
    name: definition.name,
    capabilities: definition.capabilities,
    async status(): Promise<WorkerStatus> {
      const found = lookup?.(definition.id);
      if (found === undefined) {
        return { id: definition.id, state: "unknown", source: "unknown" };
      }
      return { ...found, id: definition.id, source: "session" };
    },
  };
}
