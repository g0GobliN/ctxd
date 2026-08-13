import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const BENCHMARK_ROOT = fileURLToPath(
  new URL("../fixtures/benchmarks/", import.meta.url),
);

export interface DeduplicationExpectation {
  readonly keep: string;
  readonly drop: string;
}

/**
 * A benchmark scenario.
 *
 * Adding a scenario means adding a directory with a `benchmark.json` — the
 * runner discovers it automatically, so the infrastructure scales to the
 * auth-migration, database-migration and other scenarios the specification
 * lists as future work.
 */
export interface Benchmark {
  readonly name: string;
  readonly task: string;
  readonly budget: number;
  readonly minCandidateTokens: number;
  readonly mustInclude: readonly string[];
  readonly shouldInclude: readonly string[];
  readonly mustExclude: readonly string[];
  readonly mustDeduplicate: readonly DeduplicationExpectation[];
  /** Absolute path to the fixture repository (the `project/` sub-directory). */
  readonly dir: string;
}

/** Load every benchmark scenario found under `tests/fixtures/benchmarks`. */
export function loadBenchmarks(): Benchmark[] {
  const entries = readdirSync(BENCHMARK_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => (a.name < b.name ? -1 : 1));

  return entries.map((entry) => {
    const dir = join(BENCHMARK_ROOT, entry.name);
    const definition = JSON.parse(readFileSync(join(dir, "benchmark.json"), "utf8")) as
      Omit<Benchmark, "dir">;
    return { ...definition, dir: join(dir, "project") };
  });
}
