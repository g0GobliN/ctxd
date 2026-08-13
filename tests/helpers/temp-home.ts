import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A throwaway CTXD_HOME.
 *
 * Tests must never read or write the developer's real `~/.ctxd`, so every
 * test that touches storage runs against one of these.
 */
export interface TempHome {
  readonly dir: string;
  readonly env: NodeJS.ProcessEnv;
  cleanup(): void;
}

export function createTempHome(): TempHome {
  const dir = mkdtempSync(join(tmpdir(), "ctxd-test-"));
  return {
    dir,
    env: { ...process.env, CTXD_HOME: dir },
    // Windows refuses to delete a directory while any handle into it is still
    // open, and SQLite's WAL files can outlive the connection by a moment.
    // Retrying covers that; a directory that still will not go is a temp-dir
    // leak, not a test failure, so it is reported rather than thrown.
    cleanup: () => {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
      } catch (error) {
        process.stderr.write(
          `warning: could not remove temp home ${dir} (${(error as Error).message})\n`,
        );
      }
    },
  };
}
