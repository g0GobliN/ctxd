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
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
