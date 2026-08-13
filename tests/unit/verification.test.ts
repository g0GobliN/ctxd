import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseUnifiedDiff } from "@ctxd/diff";
import {
  buildCorrectionContext,
  categorize,
  createWorker,
  detectDrift,
  extractLocations,
  formatDrift,
  KNOWN_WORKERS,
  runCommand,
  workerDefinition,
  deltaKey,
  formatReport,
  reportFrom,
  selectDeltas,
  type ArchitectureRule,
  type VerificationResult,
} from "@ctxd/verify";

describe("worker abstraction (§42)", () => {
  it("knows claude, cursor and local without embedding provider logic", () => {
    assert.deepEqual(
      KNOWN_WORKERS.map((worker) => worker.id).sort(),
      ["claude", "cursor", "local"],
    );
  });

  it("accepts a worker it has never heard of", () => {
    const definition = workerDefinition("some-future-agent");
    assert.equal(definition.id, "some-future-agent");
    assert.deepEqual(definition.capabilities, []);
  });

  it("reports unknown status rather than inventing one", async () => {
    const worker = createWorker(workerDefinition("claude"));
    const status = await worker.status();
    assert.equal(status.state, "unknown");
    assert.equal(status.source, "unknown");
  });

  it("marks a status drawn from session data as such", async () => {
    const worker = createWorker(workerDefinition("claude"), () => ({
      state: "active",
      lastActivity: "2026-08-13T10:00:00.000Z",
      currentTask: "fix webhook",
    }));
    const status = await worker.status();
    assert.equal(status.state, "active");
    assert.equal(status.source, "session");
    assert.equal(status.currentTask, "fix webhook");
  });
});

describe("controlled execution (§63)", () => {
  it("treats repository inspection as read-only", () => {
    assert.equal(categorize("git", ["status"]), "READ_ONLY");
    assert.equal(categorize("git", ["diff", "HEAD"]), "READ_ONLY");
    assert.equal(categorize("rg", ["pattern"]), "READ_ONLY");
  });

  it("treats tests, typecheck, lint and build as safe mutating", () => {
    assert.equal(categorize("pnpm", ["run", "test"]), "SAFE_MUTATING");
    assert.equal(categorize("npm", ["test"]), "SAFE_MUTATING");
    assert.equal(categorize("tsc", ["-b"]), "SAFE_MUTATING");
  });

  it("treats destructive git, deploys and credential tools as dangerous", () => {
    for (const [command, args] of [
      ["git", ["reset", "--hard"]],
      ["git", ["clean", "-fd"]],
      ["git", ["push"]],
      ["rm", ["-rf", "."]],
      ["kubectl", ["apply"]],
      ["aws", ["s3", "rm"]],
    ] as const) {
      assert.equal(categorize(command, [...args]), "DANGEROUS", `${command} ${args.join(" ")}`);
    }
  });

  it("treats an installation as dangerous, not as a build step", () => {
    assert.equal(categorize("pnpm", ["install"]), "DANGEROUS");
    assert.equal(categorize("npm", ["add", "left-pad"]), "DANGEROUS");
  });

  it("refuses a command it does not recognise instead of assuming it is safe", () => {
    assert.equal(categorize("some-unknown-binary", []), undefined);

    const outcome = runCommand("some-unknown-binary", [], { cwd: process.cwd() });
    assert.equal(outcome.ran, false);
    assert.match(outcome.refusedReason ?? "", /does not recognise/);
  });

  it("refuses a dangerous command without explicit confirmation", () => {
    const outcome = runCommand("git", ["reset", "--hard"], { cwd: process.cwd() });
    assert.equal(outcome.ran, false);
    assert.equal(outcome.category, "DANGEROUS");
    assert.match(outcome.refusedReason ?? "", /explicit confirmation/);
  });

  it("actually runs a permitted read-only command", () => {
    const outcome = runCommand("git", ["--version"], { cwd: process.cwd() });
    assert.equal(outcome.ran, true);
    assert.equal(outcome.exitCode, 0);
    assert.match(outcome.stdout, /git version/);
  });
});

describe("architecture drift (§44)", () => {
  const rule: ArchitectureRule = {
    id: "frontend-no-db",
    rule: "Frontend must not access the database directly.",
    appliesTo: "^apps/portal/",
    forbids: "openDatabase|firebase-admin",
  };

  function diff(path: string, body: string): string {
    return [
      `diff --git a/${path} b/${path}`,
      `--- a/${path}`,
      `+++ b/${path}`,
      "@@ -1,1 +1,2 @@",
      body,
      "",
    ].join("\n");
  }

  it("reports the rule and the violating file", () => {
    const files = parseUnifiedDiff(diff("apps/portal/src/foo.ts", "+const db = openDatabase();")).files;
    const { violations } = detectDrift(files, [rule]);

    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.path, "apps/portal/src/foo.ts");
    assert.equal(violations[0]?.rule, rule.rule);

    const rendered = formatDrift(violations);
    assert.match(rendered, /ARCHITECTURE DRIFT DETECTED/);
    assert.match(rendered, /Frontend must not access the database directly\./);
    assert.match(rendered, /apps\/portal\/src\/foo\.ts/);
  });

  it("ignores files the rule does not govern", () => {
    const files = parseUnifiedDiff(diff("apps/api/src/foo.ts", "+const db = openDatabase();")).files;
    assert.equal(detectDrift(files, [rule]).violations.length, 0);
  });

  it("does not fire on a line the worker removed", () => {
    const files = parseUnifiedDiff(diff("apps/portal/src/foo.ts", "-const db = openDatabase();")).files;
    assert.equal(detectDrift(files, [rule]).violations.length, 0);
  });

  it("reports an invalid rule instead of silently never firing", () => {
    const broken: ArchitectureRule = { ...rule, id: "broken", forbids: "([unclosed" };
    const files = parseUnifiedDiff(diff("apps/portal/src/foo.ts", "+x")).files;
    const { errors } = detectDrift(files, [broken]);
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /broken/);
  });
});

describe("correction context (§43, §60)", () => {
  const failing: VerificationResult = {
    status: "FAIL",
    checks: [
      {
        kind: "typecheck",
        status: "failed",
        command: "pnpm run typecheck",
        exitCode: 2,
        durationMs: 1200,
        detail: "exited 2",
        output: "src/payment/webhook.ts(12,7): error TS2345: Argument of type 'string'.",
      },
    ],
    violations: [],
    changedFiles: ["src/payment/webhook.ts"],
    reasons: ["typecheck failed: exited 2"],
    timestamp: "2026-08-13T00:00:00.000Z",
  };

  it("pulls the file and line out of compiler output", () => {
    const locations = extractLocations(
      "src/payment/webhook.ts(12,7): error TS2345: bad argument",
    );
    assert.equal(locations.length, 1);
    assert.equal(locations[0]?.path, "src/payment/webhook.ts");
    assert.equal(locations[0]?.line, 12);
  });

  it("handles the path:line:col form used by eslint, jest and node", () => {
    const locations = extractLocations("  at src/payment/webhook.ts:12:7");
    assert.equal(locations[0]?.path, "src/payment/webhook.ts");
    assert.equal(locations[0]?.line, 12);
  });

  it("carries the failure and the code it points at, not the original context", () => {
    const source = Array.from({ length: 30 }, (_, i) => `const line${i} = ${i};`).join("\n");
    const correction = buildCorrectionContext({
      task: "Fix the webhook retry limit",
      result: failing,
      readFile: () => source,
    });

    assert.match(correction.text, /CORRECTION CONTEXT/);
    assert.match(correction.text, /This is not the original context/);
    assert.match(correction.text, /Fix the webhook retry limit/);
    assert.match(correction.text, /pnpm run typecheck/);
    assert.match(correction.text, /TS2345/);
    // The excerpt is a window around line 12, not the whole file.
    assert.match(correction.text, /> 12 \| const line11 = 11;/);
    assert.ok(!correction.text.includes("const line29 = 29;"), "excerpt should be windowed");
    assert.ok(correction.estimatedTokens > 0);
  });

  it("produces nothing when nothing failed", () => {
    const passing: VerificationResult = {
      ...failing,
      status: "PASS",
      checks: [{ ...failing.checks[0]!, status: "passed", exitCode: 0 }],
      reasons: [],
    };

    const correction = buildCorrectionContext({ task: "anything", result: passing });
    assert.equal(correction.text, "");
    assert.equal(correction.estimatedTokens, 0);
  });

  it("stays far smaller than a full context rebuild", () => {
    const correction = buildCorrectionContext({
      task: "Fix the webhook retry limit",
      result: failing,
      readFile: () => "const a = 1;\n".repeat(500),
    });
    assert.ok(
      correction.estimatedTokens < 500,
      `correction context should stay compact, got ${correction.estimatedTokens}`,
    );
  });

  it("says what it left out rather than omitting silently", () => {
    const correction = buildCorrectionContext({
      task: "Fix the webhook retry limit",
      result: failing,
    });
    assert.ok(correction.omitted.some((entry) => entry.includes("no file reader")));
  });
});

describe("worker output and context economy (§58-61)", () => {
  const verification: VerificationResult = {
    status: "PASS",
    checks: [],
    violations: [],
    changedFiles: ["src/payment/webhook.ts"],
    reasons: [],
    timestamp: "2026-08-13T00:00:00.000Z",
  };

  it("omits the task and repository context in minimal mode", () => {
    const report = reportFrom("Fix the webhook retry limit", "claude", verification);
    const minimal = formatReport(report, "minimal");

    assert.ok(!minimal.includes("Fix the webhook retry limit"), "minimal must not restate the task");
    assert.match(minimal, /Result: done/);
    assert.match(minimal, /src\/payment\/webhook\.ts/);

    const normal = formatReport(report, "normal");
    assert.match(normal, /Fix the webhook retry limit/);
    assert.ok(minimal.length < normal.length);
  });

  it("does not resend a delta the worker already has", () => {
    const rule = { kind: "base" as const, content: "P0: never log secrets", key: deltaKey("base", "rules", "P0: never log secrets") };
    const error = { kind: "error" as const, content: "TS2345 at webhook.ts:12", key: "error:typecheck:1" };

    const selection = selectDeltas([rule, error], { sent: new Set([rule.key, error.key]) });

    // The rule is skipped; the error is always sent — it is why this turn exists.
    assert.deepEqual(selection.send.map((delta) => delta.kind), ["error"]);
    assert.deepEqual(selection.skipped.map((delta) => delta.kind), ["base"]);
    assert.ok(selection.estimatedTokensAvoided > 0);
  });

  it("resends a rule whose content changed", () => {
    const original = deltaKey("base", "rules", "P0: never log secrets");
    const edited = deltaKey("base", "rules", "P0: never log secrets or tokens");
    assert.notEqual(original, edited);

    const selection = selectDeltas(
      [{ kind: "base", content: "P0: never log secrets or tokens", key: edited }],
      { sent: new Set([original]) },
    );
    assert.equal(selection.send.length, 1);
  });
});
