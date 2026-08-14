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

/**
 * What a scenario measures.
 *
 * `context` scenarios measure the input firewall: what reached the model.
 * `change` scenarios measure the output firewall: what the worker did with it.
 * Both live under the same directory because both are benchmarks — retrieval
 * quality and edit discipline are the two things ctxd claims to improve, and
 * measuring only one of them would leave half the claim unevidenced (UI-12).
 */
export type BenchmarkKind = "context" | "change";

interface BenchmarkFile {
  readonly kind?: BenchmarkKind;
}

function readDefinition(name: string): { dir: string; raw: Record<string, unknown> } {
  const dir = join(BENCHMARK_ROOT, name);
  return {
    dir,
    raw: JSON.parse(readFileSync(join(dir, "benchmark.json"), "utf8")) as Record<string, unknown>,
  };
}

function scenarioNames(): string[] {
  return readdirSync(BENCHMARK_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Load every context benchmark under `tests/fixtures/benchmarks`.
 *
 * Scenarios are discovered rather than listed, so adding a directory is all it
 * takes. Kind defaults to `context` because that is what every scenario was
 * before change benchmarks existed — an absent field must not silently
 * reclassify a scenario that has been running all along.
 */
export function loadBenchmarks(): Benchmark[] {
  return scenarioNames()
    .map((name) => readDefinition(name))
    .filter(({ raw }) => ((raw as BenchmarkFile).kind ?? "context") === "context")
    .map(({ dir, raw }) => ({
      ...(raw as unknown as Omit<Benchmark, "dir">),
      dir: join(dir, "project"),
    }));
}

/** What a change scenario asserts about the Diff Firewall's verdict. */
export interface ChangeExpectation {
  readonly classification?: string;
  /** low | medium | high — how much attention the verdict demands. */
  readonly risk?: string;
  readonly minEfficiency?: number;
  readonly maxEfficiency?: number;
  readonly smallTaskMismatch?: boolean;
  readonly filesChanged?: number;
  readonly minUnrelatedFiles?: number;
  readonly requiredSignals?: readonly string[];
  readonly forbiddenSignals?: readonly string[];
  /**
   * The firewall must still produce a receipt and a recommendation rather than
   * refusing the work. A large diff is not the same as a wrong one (§50).
   */
  readonly mustNotAutoReject?: boolean;
  /** Why this scenario exists, carried into the failure message. */
  readonly note?: string;
}

export interface ChangeBenchmark {
  readonly name: string;
  readonly task: string;
  readonly expect: ChangeExpectation;
  /** The unified diff under test, read from the scenario directory. */
  readonly diff: string;
}

/**
 * Load every change benchmark.
 *
 * The diff is a checked-in file rather than a repository built at test time:
 * the Diff Firewall is a pure function over a parsed diff, so a fixture diff
 * measures exactly what a real one would, without a Git dependency in the
 * measurement.
 */
export function loadChangeBenchmarks(): ChangeBenchmark[] {
  return scenarioNames()
    .map((name) => readDefinition(name))
    .filter(({ raw }) => (raw as BenchmarkFile).kind === "change")
    .map(({ dir, raw }) => {
      const definition = raw as unknown as Omit<ChangeBenchmark, "diff"> & { diff: string };
      return {
        name: definition.name,
        task: definition.task,
        expect: definition.expect,
        diff: readFileSync(join(dir, definition.diff), "utf8"),
      };
    });
}
