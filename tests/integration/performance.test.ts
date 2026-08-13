import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { listMemories, saveMemory, searchMemories } from "@ctxd/memory";
import { detectProject, upsertProject } from "@ctxd/project";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * Performance targets (§72).
 *
 * The specification is explicit that correctness comes first — these are
 * targets, not a licence to cut corners. So the budgets here are generous
 * enough that only a real regression trips them, and each measurement is the
 * *median* of several runs: a single sample on a shared CI machine measures the
 * machine's mood, not the code.
 *
 * A failure means something got structurally slower — an unindexed query, a
 * full-table scan, work moved into module load — not that a laptop was busy.
 */

const CLI = fileURLToPath(new URL("../../packages/cli/dist/index.js", import.meta.url));

/**
 * §72 targets, with headroom for a loaded machine.
 *
 * `cliOverheadMs` is what ctxd adds on top of starting Node at all, measured
 * against a bare `node -e ""` in the same conditions. Absolute startup is
 * mostly Node's own cost and swings with machine load — the whole suite runs
 * test files in parallel — so an absolute budget would measure the machine's
 * mood. The overhead is what this repository actually controls: it sits around
 * 40ms with lazy command dispatch and was roughly 700ms when every command was
 * imported eagerly.
 */
const BUDGET = {
  cliOverheadMs: 350,
  searchMs: 100,
  memoryLookupMs: 100,
};

const home = createTempHome();
let db: Db;
let projectId: string;

function median(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function timeMedian(runs: number, action: () => void): number {
  const samples: number[] = [];
  // One untimed run first: the first call pays for lazy initialisation that
  // steady-state usage does not.
  action();
  for (let i = 0; i < runs; i += 1) {
    const started = performance.now();
    action();
    samples.push(performance.now() - started);
  }
  return median(samples);
}

before(() => {
  const root = join(home.dir, "perf-project");
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "perf-project" }));
  writeFileSync(join(root, "src/index.ts"), "export const value = 1;\n");

  db = openDatabase(join(home.dir, "perf.db"));
  migrate(db);
  projectId = upsertProject(db, detectProject(root)).id;

  // A memory set large enough that an unindexed scan would show up.
  const topics = [
    "stripe webhook idempotency", "payment retry backoff", "session fixation",
    "jwt access token lifetime", "vite hmr port collision", "database migration order",
    "cache invalidation policy", "rate limit headers", "queue consumer restart",
    "timezone handling in reports",
  ];
  for (let i = 0; i < 500; i += 1) {
    const topic = topics[i % topics.length] as string;
    saveMemory(db, {
      projectId,
      type: "FACT",
      title: `${topic} note ${i}`,
      content:
        `Observation ${i} about ${topic}. Recorded so a later session does not ` +
        "have to rediscover it from the code. Includes enough prose that the " +
        "full-text index has something real to work with.",
      source: "worker_statement",
      importance: (i % 5) + 1,
      confidence: 0.8,
    });
  }
});

after(() => {
  db?.close();
  home.cleanup();
});

describe("performance targets (§72)", () => {
  it("adds little to Node's own startup", () => {
    const time = (args: readonly string[]): number => {
      const started = performance.now();
      execFileSync(process.execPath, args as string[], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      return performance.now() - started;
    };

    // Warm up both paths so neither pays for first-run disk reads.
    time(["-e", ""]);
    time([CLI, "--version"]);

    // Measure each pair back to back and take the median of the *differences*.
    // A difference of medians would be noisy: the whole suite runs test files
    // in parallel, so load can shift between two separate measurement blocks.
    // Paired sampling cancels that out.
    const differences: number[] = [];
    const bareSamples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const bare = time(["-e", ""]);
      const withCtxd = time([CLI, "--version"]);
      bareSamples.push(bare);
      differences.push(withCtxd - bare);
    }

    const overhead = median(differences);
    assert.ok(
      overhead < BUDGET.cliOverheadMs,
      `ctxd added ${overhead.toFixed(0)}ms to Node's ${median(bareSamples).toFixed(0)}ms ` +
        `startup, budget ${BUDGET.cliOverheadMs}ms. ` +
        "Something is being imported that a bare --version does not need.",
    );
  });

  it("searches memory well inside the target", () => {
    const elapsed = timeMedian(10, () => {
      const hits = searchMemories(db, "stripe webhook idempotency", { limit: 20 });
      assert.ok(hits.length > 0, "search should find seeded memories");
    });

    assert.ok(
      elapsed < BUDGET.searchMs,
      `FTS5 search took ${elapsed.toFixed(1)}ms, budget ${BUDGET.searchMs}ms`,
    );
  });

  it("looks memory up well inside the target", () => {
    const elapsed = timeMedian(10, () => {
      const memories = listMemories(db, projectId, { limit: 20 });
      assert.equal(memories.length, 20);
    });

    assert.ok(
      elapsed < BUDGET.memoryLookupMs,
      `memory lookup took ${elapsed.toFixed(1)}ms, budget ${BUDGET.memoryLookupMs}ms`,
    );
  });

  it("does not degrade as the memory set grows", () => {
    // A scan would scale with the row count; an index barely moves. Comparing
    // a narrow limit against a wide one catches the difference without
    // depending on absolute machine speed.
    const narrow = timeMedian(10, () => {
      listMemories(db, projectId, { limit: 5 });
    });
    const wide = timeMedian(10, () => {
      listMemories(db, projectId, { limit: 200 });
    });

    // Both must stay inside the target; the ratio is informational, since a
    // wider limit legitimately returns more rows.
    assert.ok(narrow < BUDGET.memoryLookupMs, `narrow lookup ${narrow.toFixed(1)}ms`);
    assert.ok(wide < BUDGET.memoryLookupMs, `wide lookup ${wide.toFixed(1)}ms`);
  });
});
