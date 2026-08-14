/**
 * Event emission from the CLI (§7).
 *
 * The CLI holds no database connection between commands, so each emission opens
 * one, writes, and closes. That cost is paid *after* the work it describes,
 * never on the startup path, so it does not touch the CLI start time the
 * performance tests assert.
 *
 * Emission never throws and never prints. A command's job is the work it was
 * asked to do; recording that it happened is a side effect, and a side effect
 * that can fail the command would be worse than no record at all.
 */

import { resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";
import { emitEvent, type EventData, type EventType } from "@ctxd/events";
import { detectProject, findProjectByRoot } from "@ctxd/project";

export interface RecordOptions {
  readonly worker?: string | undefined;
  readonly data?: EventData;
}

/**
 * Record that something happened in `dir`.
 *
 * Silent when the directory is not a registered project: there is no project to
 * attach the event to, and `ctxd init` is what changes that. The command still
 * does its work either way.
 */
export function record(dir: string, type: EventType, options: RecordOptions = {}): void {
  try {
    const db = openDatabase(resolvePaths().dbFile);
    try {
      migrate(db);
      const project = findProjectByRoot(db, detectProject(dir).root);
      if (project === undefined) return;

      emitEvent(db, {
        projectId: project.id,
        type,
        // Self-declared, exactly as everywhere else: the CLI records what the
        // developer said, and ctxd does not pretend to have checked it (§6).
        worker: options.worker ?? null,
        ...(options.data === undefined ? {} : { data: options.data }),
      });
    } finally {
      db.close();
    }
  } catch {
    // Deliberately silent. See the note above.
  }
}
