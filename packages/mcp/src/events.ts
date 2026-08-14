/**
 * Event emission from the MCP server (§6, §7).
 *
 * This process is where worker activity is observable at all, so it is the
 * first producer. What it may honestly report is narrow:
 *
 * - **That a client attached.** The transport says so. This is fact.
 * - **What that client is called.** Configuration says so — `ctxd mcp
 *   --worker cursor` is the developer stating which worker they wired up. The
 *   server cannot check it, so it travels as a claim and is rendered as one.
 *
 * With no `--worker`, the worker is null. A default of "claude" would be a
 * guess, and §37 is explicit that a guess is worse than an absence.
 */

import { emitEvent, type EmitEventInput, type EventData, type EventType } from "@ctxd/events";
import type { Db } from "@ctxd/db";

export interface EventEmitter {
  emit(type: EventType, input?: Partial<Omit<EmitEventInput, "type">>): void;
}

/**
 * An emitter bound to a project and a claimed worker.
 *
 * Emission never throws. An event is a side record of something that already
 * happened, so failing to write one must not fail the tool call that caused
 * it: a worker asking for context should get its context even if the log is
 * unwritable.
 */
export function createEmitter(
  db: Db,
  projectId: string | undefined,
  worker: string | undefined,
): EventEmitter {
  return {
    emit(type, input = {}) {
      // No registered project means no foreign key to hang the event on. The
      // work still proceeds; it is simply not observable until `ctxd init`.
      const project = input.projectId ?? projectId;
      if (project === undefined) return;

      try {
        emitEvent(db, {
          ...input,
          projectId: project,
          type,
          worker: input.worker ?? worker ?? null,
        });
      } catch {
        // Deliberately silent: this is stdio, and anything written to stdout
        // would corrupt the JSON-RPC stream the worker is reading.
      }
    },
  };
}

/** An emitter that drops everything, for callers with no database to write to. */
export function nullEmitter(): EventEmitter {
  return { emit: () => undefined };
}

export type { EventData };
