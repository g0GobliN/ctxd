import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  analyzeComments,
  analyzeDiff,
  analyzeFileNoise,
  computeChangeSurface,
  countModifiedLines,
  expectedScope,
  formatChangeReceipt,
  inferTaskSize,
  isDependencyChange,
  isGeneratedFile,
  judgeComment,
  parseUnifiedDiff,
  type FileDiff,
} from "@ctxd/diff";

/** Build a unified diff for one modified file from its old and new content. */
function diffOf(path: string, hunkBody: string, oldSpan = 0, newSpan = 0): string {
  const lines = hunkBody.split("\n");
  const oldLines = oldSpan || lines.filter((line) => !line.startsWith("+")).length;
  const newLines = newSpan || lines.filter((line) => !line.startsWith("-")).length;
  return [
    `diff --git a/${path} b/${path}`,
    "index 1111111..2222222 100644",
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${oldLines} +1,${newLines} @@`,
    hunkBody,
    "",
  ].join("\n");
}

function parseOne(raw: string): FileDiff {
  const parsed = parseUnifiedDiff(raw);
  const file = parsed.files[0];
  assert.ok(file, "expected exactly one parsed file");
  return file;
}

describe("parseUnifiedDiff", () => {
  it("counts added and removed lines and ignores the no-newline marker", () => {
    const file = parseOne(
      diffOf(
        "src/payment/webhook.ts",
        [
          " const handler = () => {",
          "-  const limit = 3;",
          "+  const limit = 5;",
          " };",
          "\\ No newline at end of file",
        ].join("\n"),
      ),
    );

    assert.equal(file.path, "src/payment/webhook.ts");
    assert.equal(file.kind, "modified");
    assert.equal(file.linesAdded, 1);
    assert.equal(file.linesRemoved, 1);
    assert.equal(countModifiedLines(file), 1);
  });

  it("recognises additions, deletions and renames", () => {
    const raw = [
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,1 @@",
      "+export const a = 1;",
      "diff --git a/src/gone.ts b/src/gone.ts",
      "deleted file mode 100644",
      "--- a/src/gone.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-export const b = 2;",
      "diff --git a/src/old.ts b/src/moved.ts",
      "similarity index 96%",
      "rename from src/old.ts",
      "rename to src/moved.ts",
      "",
    ].join("\n");

    const files = parseUnifiedDiff(raw).files;
    assert.equal(files.length, 3);
    assert.equal(files[0]?.kind, "added");
    assert.equal(files[1]?.kind, "deleted");
    assert.equal(files[1]?.path, "src/gone.ts");
    assert.equal(files[2]?.kind, "renamed");
    assert.equal(files[2]?.oldPath, "src/old.ts");
    assert.equal(files[2]?.path, "src/moved.ts");
    assert.equal(files[2]?.similarity, 96);
  });

  it("marks binary files without inventing line counts", () => {
    const raw = [
      "diff --git a/img/logo.png b/img/logo.png",
      "index 1111111..2222222 100644",
      "Binary files a/img/logo.png and b/img/logo.png differ",
      "",
    ].join("\n");

    const file = parseOne(raw);
    assert.equal(file.binary, true);
    assert.equal(file.linesAdded, 0);
    assert.equal(file.linesRemoved, 0);
  });
});

describe("formatting noise (§53)", () => {
  it("reports indentation-only churn as presentation, not semantics", () => {
    const file = parseOne(
      diffOf(
        "src/a.ts",
        [
          "-  const a = 1;",
          "-  const b = 2;",
          "+    const a = 1;",
          "+    const b = 2;",
        ].join("\n"),
      ),
    );

    const noise = analyzeFileNoise(file);
    assert.equal(noise.semanticLines, 0);
    assert.equal(noise.formattingLines, 4);
    assert.equal(noise.formattingOnly, true);
    assert.ok(noise.formattingKinds.includes("indentation"));
  });

  it("separates a real change from the formatting around it", () => {
    const file = parseOne(
      diffOf(
        "src/a.ts",
        [
          "-  const limit = 3;",
          "-  const name = 'x';",
          "+    const limit = 5;",
          "+    const name = \"x\";",
        ].join("\n"),
      ),
    );

    const noise = analyzeFileNoise(file);
    // The quote change pairs up; only the limit change is semantic.
    assert.equal(noise.formattingLines, 2);
    assert.equal(noise.semanticLines, 2);
    assert.equal(noise.formattingOnly, false);
    assert.ok(noise.formattingKinds.includes("quote-style"));
  });

  it("detects line-ending churn across a whole file", () => {
    const body = Array.from({ length: 30 }, (_, i) => `-const v${i} = ${i};`)
      .concat(Array.from({ length: 30 }, (_, i) => `+const v${i} = ${i};\r`))
      .join("\n");

    const noise = analyzeFileNoise(parseOne(diffOf("src/big.ts", body)));
    assert.equal(noise.semanticLines, 0);
    assert.equal(noise.formattingLines, 60);
    assert.ok(noise.formattingKinds.includes("line-endings"));
    assert.ok(noise.formattingKinds.includes("whole-file-format"));
  });

  it("treats reordered imports as presentation, not change", () => {
    const file = parseOne(
      diffOf(
        "src/a.ts",
        [
          '-import { b } from "./b.js";',
          '-import { a } from "./a.js";',
          '+import { a } from "./a.js";',
          '+import { b } from "./b.js";',
        ].join("\n"),
      ),
    );

    const noise = analyzeFileNoise(file);
    assert.equal(noise.semanticLines, 0);
    assert.ok(noise.formattingKinds.includes("import-order"));
  });
});

describe("comment noise (§54)", () => {
  it("keeps comments that explain why", () => {
    const kept = judgeComment(
      "// Stripe can retry the same event, so this must remain idempotent.",
      "if (seen.has(event.id)) return;",
    );
    assert.equal(kept.verdict, "keep");
  });

  it("flags comments that restate the next line", () => {
    const flagged = judgeComment("// Check if the event exists.", "if (event) {");
    assert.equal(flagged.verdict, "restates-code");
  });

  it("never flags a security note", () => {
    const kept = judgeComment("// Constant-time compare: avoids a timing attack.", "compare(a, b);");
    assert.equal(kept.verdict, "keep");
  });

  it("collects added comments and spots duplicates", () => {
    const raw =
      diffOf("src/a.ts", ["+// Increment the counter.", "+count += 1;"].join("\n")) +
      diffOf("src/b.ts", ["+// Increment the counter.", "+count += 1;"].join("\n"));

    const comments = analyzeComments(parseUnifiedDiff(raw).files);
    assert.equal(comments.added.length, 2);
    assert.equal(comments.restatingCount, 2);
    assert.deepEqual(comments.duplicated, ["Increment the counter."]);
  });
});

describe("expected scope (§51, §55)", () => {
  it("reads a value change as a small task", () => {
    assert.equal(inferTaskSize("Change webhook retry limit from 3 to 5").size, "small");
  });

  it("reads a refactor as a large task even when it mentions a small edit", () => {
    assert.equal(inferTaskSize("Refactor the retry limit handling").size, "large");
  });

  it("has no expectation without a task description", () => {
    const scope = expectedScope();
    assert.equal(scope.size, "unknown");
    assert.equal(scope.files, undefined);
  });
});

describe("dependency and generated file detection", () => {
  it("treats a lock file as a dependency change", () => {
    assert.equal(isGeneratedFile("pnpm-lock.yaml"), true);
    const file = parseOne(diffOf("pnpm-lock.yaml", ["+  foo: 1.0.0"].join("\n")));
    assert.equal(isDependencyChange(file), true);
  });

  it("does not call a package.json description edit a dependency change", () => {
    const file = parseOne(
      diffOf("package.json", ['-  "description": "old",', '+  "description": "new",'].join("\n")),
    );
    assert.equal(isDependencyChange(file), false);
  });

  it("does call a package.json dependency edit a dependency change", () => {
    const file = parseOne(
      diffOf("package.json", ['+    "left-pad": "^1.3.0",'].join("\n")),
    );
    assert.equal(isDependencyChange(file), true);
  });
});

describe("change surface (§51)", () => {
  it("does not report a test file as unrelated when its subject changed", () => {
    const raw =
      diffOf("src/payment/webhook.ts", ["+const retries = 5;"].join("\n")) +
      diffOf("tests/unit/all.test.ts", ["+assert.equal(retries, 5);"].join("\n"));

    const surface = computeChangeSurface(parseUnifiedDiff(raw).files, {
      task: "Fix the payment webhook retry count",
    });
    assert.deepEqual(surface.unrelated_files, []);
    assert.equal(surface.test_file_changes, 1);
  });

  it("reports a file with no connection to the task", () => {
    const raw =
      diffOf("src/payment/webhook.ts", ["+const retries = 5;"].join("\n")) +
      diffOf("src/camera/stream.ts", ["+const fps = 30;"].join("\n"));

    const surface = computeChangeSurface(parseUnifiedDiff(raw).files, {
      task: "Fix the payment webhook retry count",
    });
    assert.deepEqual(surface.unrelated_files, ["src/camera/stream.ts"]);
  });
});

describe("diff firewall decision (§82 exit criteria)", () => {
  const smallTask = "Change webhook retry limit from 3 to 5";

  it("small task + small diff → FOCUSED", () => {
    const raw = diffOf(
      "src/payment/webhook.ts",
      ["-const retryLimit = 3;", "+const retryLimit = 5;"].join("\n"),
    );

    const analysis = analyzeDiff(parseUnifiedDiff(raw).files, { task: smallTask });
    assert.equal(analysis.classification.classification, "FOCUSED");
    assert.equal(analysis.overEdit.change_efficiency_score, 1);
    assert.equal(analysis.surface.semantic_lines, 2);
  });

  it("small task + huge diff → flagged, with the reason stated", () => {
    let raw = diffOf(
      "src/payment/webhook.ts",
      ["-const retryLimit = 3;", "+const retryLimit = 5;"].join("\n"),
    );
    for (let f = 0; f < 7; f += 1) {
      const body = Array.from({ length: 40 }, (_, i) => `+const camera${f}_${i} = ${i};`).join("\n");
      raw += diffOf(`src/camera/module${f}.ts`, body);
    }

    const analysis = analyzeDiff(parseUnifiedDiff(raw).files, { task: smallTask });
    assert.equal(analysis.classification.classification, "NEEDS_REVIEW");
    assert.equal(analysis.overEdit.smallTaskMismatch, true);

    const mismatch = analysis.overEdit.signals.find(
      (signal) => signal.id === "small-task-large-change",
    );
    assert.ok(mismatch, "expected a SMALL TASK / LARGE CHANGE MISMATCH signal");
    // §52: the warning must explain itself, not just assert.
    assert.match(mismatch.evidence, /expected about \d+ file\(s\)/);
    assert.ok(analysis.classification.reasons.length > 0);
  });

  it("a relevant large change is not auto-rejected", () => {
    let raw = "";
    for (let f = 0; f < 6; f += 1) {
      const body = Array.from(
        { length: 40 },
        (_, i) => `+export function paymentHelper${f}_${i}() { return ${i}; }`,
      ).join("\n");
      raw += diffOf(`src/payment/module${f}.ts`, body);
    }

    const analysis = analyzeDiff(parseUnifiedDiff(raw).files, {
      task: "Refactor the payment module into smaller units",
    });

    assert.equal(analysis.surface.unrelated_files.length, 0);
    assert.notEqual(analysis.classification.classification, "SUSPICIOUS");
    assert.equal(analysis.overEdit.smallTaskMismatch, false);
    assert.ok(
      analysis.overEdit.change_efficiency_score >= 0.65,
      `a large but relevant refactor should not be penalised into review: ${analysis.overEdit.change_efficiency_score}`,
    );
  });

  it("formatting-only noise is detected and reported", () => {
    const body = Array.from({ length: 40 }, (_, i) => `-  const v${i} = ${i};`)
      .concat(Array.from({ length: 40 }, (_, i) => `+      const v${i} = ${i};`))
      .join("\n");

    const analysis = analyzeDiff(parseUnifiedDiff(diffOf("src/payment/webhook.ts", body)).files, {
      task: "Fix the payment webhook retry count",
    });

    assert.equal(analysis.surface.formatting_only_changes, 1);
    assert.equal(analysis.surface.semantic_lines, 0);
    assert.ok(
      analysis.overEdit.signals.some((signal) => signal.id === "formatting-noise"),
      "expected a formatting-noise signal",
    );
  });

  it("comment-only noise is detected", () => {
    const analysis = analyzeDiff(
      parseUnifiedDiff(
        diffOf("src/payment/webhook.ts", ["+// Set the counter.", "+// Get the event."].join("\n")),
      ).files,
      { task: "Fix the payment webhook retry count" },
    );

    assert.equal(analysis.surface.comment_only_changes, 1);
    assert.equal(analysis.comments.restatingCount, 2);
  });

  it("keeps a comment that mentions a reason, even in a comment-only diff", () => {
    const analysis = analyzeDiff(
      parseUnifiedDiff(
        diffOf("src/payment/webhook.ts", ["+// Stripe retries events, so stay idempotent."].join("\n")),
      ).files,
      { task: "Fix the payment webhook retry count" },
    );

    assert.equal(analysis.comments.restatingCount, 0);
    assert.equal(analysis.comments.keptCount, 1);
  });

  it("unrelated files and dependency changes are detected together", () => {
    const raw =
      diffOf("src/payment/webhook.ts", ["+const retryLimit = 5;"].join("\n")) +
      diffOf("src/camera/stream.ts", ["+const fps = 30;"].join("\n")) +
      diffOf("package.json", ['+    "left-pad": "^1.3.0",'].join("\n"));

    const analysis = analyzeDiff(parseUnifiedDiff(raw).files, {
      task: "Fix the payment webhook retry count",
    });

    assert.ok(analysis.surface.unrelated_files.includes("src/camera/stream.ts"));
    assert.equal(analysis.surface.dependency_changes, 1);
    assert.ok(analysis.overEdit.signals.some((signal) => signal.id === "dependency-changes"));
    assert.ok(analysis.overEdit.signals.some((signal) => signal.id === "unrelated-files"));
  });

  it("detects a whole-file rewrite", () => {
    const body = Array.from({ length: 40 }, (_, i) => `-const old${i} = ${i};`)
      .concat(Array.from({ length: 40 }, (_, i) => `+const fresh${i} = ${i};`))
      .join("\n");

    const analysis = analyzeDiff(parseUnifiedDiff(diffOf("src/payment/webhook.ts", body, 40)).files, {
      task: "Fix the payment webhook retry count",
    });
    assert.equal(analysis.surface.whole_file_rewrites, 1);
  });

  it("records the verification result on the receipt", () => {
    const raw = diffOf("src/payment/webhook.ts", ["+const retryLimit = 5;"].join("\n"));

    const passed = analyzeDiff(parseUnifiedDiff(raw).files, {
      task: "Fix the payment webhook retry count",
      verification: "PASS",
    });
    assert.equal(passed.receipt.verification_status, "PASS");

    const failed = analyzeDiff(parseUnifiedDiff(raw).files, {
      task: "Fix the payment webhook retry count",
      verification: "FAIL",
    });
    assert.equal(failed.receipt.verification_status, "FAIL");
    assert.equal(failed.classification.classification, "NEEDS_REVIEW");
  });

  it("an architecture violation forces review", () => {
    const raw = diffOf("apps/portal/src/foo.ts", ["+const db = openDatabase();"].join("\n"));
    const analysis = analyzeDiff(parseUnifiedDiff(raw).files, {
      task: "Fix the portal foo handler",
      architectureViolations: ["frontend must not access the database directly"],
    });

    assert.equal(analysis.classification.classification, "NEEDS_REVIEW");
    assert.equal(analysis.classification.risk, "high");
  });

  it("generates a Change Receipt that states its score is not a correctness score", () => {
    const raw = diffOf(
      "src/payment/webhook.ts",
      ["-const retryLimit = 3;", "+const retryLimit = 5;"].join("\n"),
    );

    const analysis = analyzeDiff(parseUnifiedDiff(raw).files, {
      task: "Change webhook retry limit from 3 to 5",
      project: "ctxd",
      worker: "claude",
      requestId: "fixed-id",
      timestamp: "2026-08-13T00:00:00.000Z",
    });

    const { receipt } = analysis;
    assert.equal(receipt.request_id, "fixed-id");
    assert.equal(receipt.files_changed, 1);
    assert.equal(receipt.lines_added, 1);
    assert.equal(receipt.lines_removed, 1);
    assert.equal(receipt.worker, "claude");
    assert.equal(receipt.classification, "FOCUSED");

    const rendered = formatChangeReceipt(receipt);
    assert.match(rendered, /CHANGE RECEIPT fixed-id/);
    assert.match(rendered, /not a correctness score/);
  });

  it("is deterministic — the same diff produces the same verdict", () => {
    const raw =
      diffOf("src/payment/webhook.ts", ["+const retryLimit = 5;"].join("\n")) +
      diffOf("src/camera/stream.ts", ["+const fps = 30;"].join("\n"));
    const options = { task: "Fix the payment webhook retry count" } as const;

    const first = analyzeDiff(parseUnifiedDiff(raw).files, options);
    const second = analyzeDiff(parseUnifiedDiff(raw).files, options);

    assert.equal(
      first.overEdit.change_efficiency_score,
      second.overEdit.change_efficiency_score,
    );
    assert.deepEqual(first.classification, second.classification);
    assert.deepEqual(first.surface.unrelated_files, second.surface.unrelated_files);
  });

  it("reports nothing to review for an empty diff", () => {
    const analysis = analyzeDiff([], { task: "Fix the payment webhook retry count" });
    assert.equal(analysis.surface.files_changed, 0);
    assert.equal(analysis.classification.classification, "FOCUSED");
    assert.equal(analysis.classification.risk, "low");
  });
});
