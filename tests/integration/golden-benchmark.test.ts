import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildContext } from "@ctxd/context";
import { loadBenchmarks } from "../helpers/benchmark.ts";

/**
 * The golden benchmark is a product-quality gate, not a smoke test.
 *
 * It asserts that a realistic 50k+ token repository collapses into the budget
 * while keeping every file the task genuinely needs and dropping the ones it
 * does not. If this fails, the context engine is not fit to ship — the
 * specification is explicit that work should not proceed past a failure here.
 */
for (const benchmark of loadBenchmarks()) {
  describe(`golden benchmark: ${benchmark.name}`, () => {
    // Fixed clock so the recency signal cannot drift as the fixture ages.
    const result = buildContext({
      task: benchmark.task,
      dir: benchmark.dir,
      budget: benchmark.budget,
      project: benchmark.name,
      now: Date.parse("2026-08-02T12:00:00Z"),
      requestId: "benchmark",
      timestamp: "2026-08-02T12:00:00.000Z",
    });

    const includedPaths = new Set(result.selection.included.map((entry) => entry.item.path));
    const excludedPaths = new Set(result.selection.excluded.map((entry) => entry.path));
    const candidatePaths = new Set(result.candidates.map((item) => item.path));

    it("discovers more than the required candidate volume", () => {
      assert.ok(
        result.candidateTokens > benchmark.minCandidateTokens,
        `expected more than ${benchmark.minCandidateTokens} candidate tokens, got ${result.candidateTokens}`,
      );
    });

    it("produces a final context within budget", () => {
      assert.ok(
        result.selection.finalTokens <= benchmark.budget,
        `final ${result.selection.finalTokens} exceeds budget ${benchmark.budget}`,
      );
      assert.ok(result.selection.finalTokens > 0, "final context must not be empty");
    });

    it("keeps every mandatory file", () => {
      for (const path of benchmark.mustInclude) {
        assert.ok(includedPaths.has(path), `MUST_INCLUDE missing: ${path}`);
      }
    });

    it("keeps the files that should be included", () => {
      for (const path of benchmark.shouldInclude) {
        assert.ok(includedPaths.has(path), `SHOULD_INCLUDE missing: ${path}`);
      }
    });

    it("excludes irrelevant files", () => {
      for (const path of benchmark.mustExclude) {
        assert.ok(!includedPaths.has(path), `MUST_EXCLUDE present in context: ${path}`);
      }
    });

    it("never collects secrets", () => {
      // The fixture must actually contain a secret, or this test proves
      // nothing. `.env` is gitignored, so a fresh checkout regenerates it.
      assert.ok(
        existsSync(join(benchmark.dir, ".env")),
        "fixture is missing .env — regenerate it: node --experimental-strip-types scripts/generate-fixture.ts",
      );

      for (const path of candidatePaths) {
        assert.ok(!path.startsWith(".env"), `secret file collected as a candidate: ${path}`);
      }
    });

    it("removes near-duplicate documents", () => {
      for (const expectation of benchmark.mustDeduplicate) {
        const dropped = result.dedup.duplicates.some(
          (duplicate) => duplicate.path === expectation.drop,
        );
        assert.ok(dropped, `expected ${expectation.drop} to be detected as a duplicate`);
        assert.ok(
          !includedPaths.has(expectation.drop),
          `duplicate ${expectation.drop} reached the final context`,
        );
        assert.ok(
          includedPaths.has(expectation.keep),
          `expected ${expectation.keep} to be kept instead of ${expectation.drop}`,
        );
      }
    });

    it("preserves every P0 item", () => {
      const mandatory = result.dedup.kept.filter((item) => item.priority === "P0");
      assert.ok(mandatory.length > 0, "fixture should contain P0 items");
      for (const item of mandatory) {
        assert.ok(includedPaths.has(item.path), `P0 item dropped: ${item.path}`);
      }
      assert.deepEqual(result.selection.warnings, []);
    });

    it("produces a receipt that accounts for every candidate", () => {
      const { receipt } = result;
      assert.equal(receipt.token_count_estimation, "estimated");
      assert.equal(receipt.final_total_tokens, result.selection.finalTokens);
      assert.equal(receipt.candidate_total_tokens, result.candidateTokens);
      assert.ok(receipt.included_items.length > 0);

      const accountedFor = new Set([
        ...receipt.included_items.map((item) => item.path),
        ...receipt.excluded_items.map((item) => item.path),
        ...receipt.duplicates.map((duplicate) => duplicate.path),
      ]);
      for (const path of candidatePaths) {
        assert.ok(accountedFor.has(path), `candidate missing from receipt: ${path}`);
      }
    });

    it("explains why each included item was chosen", () => {
      for (const item of result.receipt.included_items) {
        assert.ok(item.reason.length > 0, `no reason recorded for ${item.path}`);
      }
      for (const item of result.receipt.excluded_items) {
        assert.ok(item.reason.length > 0, `no reason recorded for ${item.path}`);
      }
      assert.ok(excludedPaths.size > 0, "a 50k fixture must exclude something");
    });

    it("is deterministic", () => {
      const again = buildContext({
        task: benchmark.task,
        dir: benchmark.dir,
        budget: benchmark.budget,
        project: benchmark.name,
        now: Date.parse("2026-08-02T12:00:00Z"),
        requestId: "benchmark",
        timestamp: "2026-08-02T12:00:00.000Z",
      });
      assert.equal(again.context, result.context);
      assert.deepEqual(again.receipt, result.receipt);
    });
  });
}
