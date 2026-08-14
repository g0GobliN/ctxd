import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { analyzeDiff, parseUnifiedDiff } from "@ctxd/diff";
import { loadChangeBenchmarks } from "../helpers/benchmark.ts";

/**
 * Golden benchmarks for the output firewall (UI-12, §82).
 *
 * The input firewall has been measured since Phase 1.5: seven scenarios that
 * say which files must reach the model and which must not. The output firewall
 * had no equivalent — its behaviour was asserted, but never measured against
 * named scenarios that a change in scoring would visibly move.
 *
 * That gap matters more than it looks. The Diff Firewall's whole value rests on
 * two opposite failures being avoided at once: staying quiet on a focused
 * change, and warning loudly on a sprawling one. A tool that warns on
 * everything is ignored, and then it protects nothing; a tool that warns on
 * nothing protects nothing to begin with. One scenario for each is the minimum
 * that pins both ends.
 */

const benchmarks = loadChangeBenchmarks();

describe("change benchmarks (UI-12)", () => {
  it("discovers the scenarios from the fixture directory", () => {
    assert.ok(benchmarks.length >= 2, "expected at least a focused and a sprawling scenario");
  });

  for (const benchmark of benchmarks) {
    describe(benchmark.name, () => {
      const parsed = parseUnifiedDiff(benchmark.diff);
      const analysis = analyzeDiff(parsed.files, {
        task: benchmark.task,
        project: "change-benchmark",
        worker: "benchmark",
      });

      const { expect } = benchmark;
      const context = expect.note === undefined ? "" : `\n  why: ${expect.note}`;
      const signals = analysis.overEdit.signals.map((signal) => signal.id);

      it("parses the fixture diff without warnings", () => {
        assert.deepEqual(parsed.warnings, [], `${benchmark.name} diff did not parse cleanly`);
        assert.ok(parsed.files.length > 0);
      });

      if (expect.filesChanged !== undefined) {
        it(`touches ${expect.filesChanged} file(s)`, () => {
          assert.equal(analysis.surface.files_changed, expect.filesChanged);
        });
      }

      if (expect.classification !== undefined) {
        it(`classifies as ${expect.classification}`, () => {
          assert.equal(
            analysis.classification.classification,
            expect.classification,
            `${benchmark.name}: expected ${expect.classification}, got ` +
              `${analysis.classification.classification}${context}`,
          );
        });
      }

      if (expect.risk !== undefined) {
        it(`carries ${expect.risk} risk`, () => {
          assert.equal(analysis.classification.risk, expect.risk, context);
        });
      }

      if (expect.smallTaskMismatch !== undefined) {
        it(
          expect.smallTaskMismatch
            ? "flags the small task / large change mismatch (§55)"
            : "does not cry mismatch on a proportionate change",
          () => {
            assert.equal(analysis.overEdit.smallTaskMismatch, expect.smallTaskMismatch, context);
          },
        );
      }

      if (expect.minEfficiency !== undefined) {
        it(`scores at least ${expect.minEfficiency} for focus`, () => {
          assert.ok(
            analysis.overEdit.change_efficiency_score >= expect.minEfficiency,
            `${benchmark.name}: efficiency ${analysis.overEdit.change_efficiency_score} ` +
              `below ${expect.minEfficiency}${context}`,
          );
        });
      }

      if (expect.maxEfficiency !== undefined) {
        it(`scores no more than ${expect.maxEfficiency} for focus`, () => {
          // A focus measure, never a correctness score (§52). A low number here
          // means "read this carefully", not "this is wrong".
          assert.ok(
            analysis.overEdit.change_efficiency_score <= expect.maxEfficiency,
            `${benchmark.name}: efficiency ${analysis.overEdit.change_efficiency_score} ` +
              `above ${expect.maxEfficiency}${context}`,
          );
        });
      }

      if (expect.minUnrelatedFiles !== undefined) {
        it(`names at least ${expect.minUnrelatedFiles} unrelated file(s)`, () => {
          assert.ok(
            analysis.surface.unrelated_files.length >= expect.minUnrelatedFiles,
            `${benchmark.name}: unrelated files were ` +
              `${JSON.stringify(analysis.surface.unrelated_files)}${context}`,
          );
        });
      }

      for (const required of expect.requiredSignals ?? []) {
        it(`raises the ${required} signal`, () => {
          assert.ok(
            signals.includes(required),
            `${benchmark.name}: signals were ${JSON.stringify(signals)}${context}`,
          );
        });
      }

      for (const forbidden of expect.forbiddenSignals ?? []) {
        it(`stays quiet about ${forbidden}`, () => {
          assert.ok(
            !signals.includes(forbidden),
            `${benchmark.name}: unexpected ${forbidden}; signals were ` +
              `${JSON.stringify(signals)}${context}`,
          );
        });
      }

      it("explains its verdict rather than only stating it", () => {
        // A warning a developer cannot check is a warning they will learn to
        // dismiss. Every scenario must produce reasons, not just a label.
        assert.ok(analysis.classification.reasons.length > 0);
        for (const signal of analysis.overEdit.signals) {
          assert.notEqual(signal.summary, "");
        }
      });

      if (expect.mustNotAutoReject === true) {
        it("warns without rejecting the work (§50)", () => {
          // ctxd never blindly rewrites worker code and never treats a large
          // diff as proof of a wrong one. The receipt exists, the files are all
          // recorded, and the recommendation is for a human to read it.
          assert.ok(analysis.receipt.request_id !== "");
          assert.equal(analysis.receipt.files.length, analysis.surface.files_changed);
          assert.notEqual(analysis.receipt.recommendation, "");
          assert.ok(analysis.receipt.lines_removed > 0 || analysis.receipt.lines_added > 0);
        });
      }
    });
  }
});
