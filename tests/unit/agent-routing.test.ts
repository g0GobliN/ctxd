import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { chooseModel, cursorRunner, route, type RunnableWorker } from "@ctxd/agent";

/**
 * Routing is a pure function so it can be tested on a machine with no AI
 * tooling installed. The runners are supplied rather than probed for exactly
 * that reason.
 */

const claudeAvailable: RunnableWorker = {
  id: "claude",
  name: "Claude Code",
  command: "claude",
  available: true,
  detail: "2.1.232",
};

const claudeMissing: RunnableWorker = {
  id: "claude",
  name: "Claude Code",
  command: "claude",
  available: false,
  detail: "not installed or not on PATH",
};

describe("model choice", () => {
  it("scales with the size of the context, not the wording of the task", () => {
    assert.equal(chooseModel(500).model, "haiku");
    assert.equal(chooseModel(12_000).model, "sonnet");
    assert.equal(chooseModel(120_000).model, "opus");
  });

  it("states a reason for every choice", () => {
    for (const tokens of [500, 12_000, 120_000]) {
      assert.match(chooseModel(tokens).reason, /token/);
    }
  });

  it("honours an explicit choice over the thresholds", () => {
    const chosen = chooseModel(500, "opus");
    assert.equal(chosen.model, "opus");
    assert.match(chosen.reason, /explicitly/);
  });

  it("ignores a model name it does not know rather than passing it through", () => {
    // A typo must not become an argument to the worker, where it would fail
    // after the context had already been built.
    assert.equal(chooseModel(500, "gpt-4").model, "haiku");
  });
});

describe("worker routing", () => {
  it("reports Cursor as unrunnable with the reason, rather than omitting it", () => {
    const decision = route({ contextTokens: 1000, runners: [claudeAvailable, cursorRunner()] });

    assert.equal(decision.worker, "claude");
    assert.equal(decision.notRunnable.length, 1);
    assert.equal(decision.notRunnable[0]?.id, "cursor");
    // A worker the developer pays for must not silently vanish from the
    // picture; the interface needs to be able to say why it was not used.
    assert.ok(decision.reasons.some((reason) => /Cursor not considered/.test(reason)));
  });

  it("says plainly when there is only one runnable worker", () => {
    const decision = route({ contextTokens: 1000, runners: [claudeAvailable, cursorRunner()] });
    assert.ok(
      decision.reasons.some((reason) => /only worker ctxd can start/.test(reason)),
      "a single option is not a decision, and should not read like one",
    );
  });

  it("refuses when nothing is runnable, naming what was missing", () => {
    assert.throws(
      () => route({ contextTokens: 1000, runners: [claudeMissing, cursorRunner()] }),
      /no runnable worker is installed[\s\S]*Claude Code/,
    );
  });

  it("refuses a worker that exists but cannot be started, and explains", () => {
    assert.throws(
      () =>
        route({
          contextTokens: 1000,
          runners: [claudeAvailable, cursorRunner()],
          worker: "cursor",
        }),
      /Cursor cannot be started by ctxd[\s\S]*headless/,
    );
  });

  it("refuses a worker it has never heard of", () => {
    assert.throws(
      () => route({ contextTokens: 1000, runners: [claudeAvailable], worker: "copilot" }),
      /no runnable worker named copilot/,
    );
  });

  it("honours an explicitly named runnable worker", () => {
    const decision = route({
      contextTokens: 1000,
      runners: [claudeAvailable],
      worker: "claude",
    });
    assert.equal(decision.worker, "claude");
    assert.ok(decision.reasons.some((reason) => /explicitly/.test(reason)));
  });
});

describe("what ctxd claims about Cursor", () => {
  it("does not claim Cursor is runnable", () => {
    const cursor = cursorRunner();
    assert.equal(cursor.available, false);
    // The reason has to survive into the UI, so it is asserted rather than
    // left as a comment.
    assert.match(cursor.detail ?? "", /no headless mode/);
    assert.match(cursor.detail ?? "", /handoff/);
  });
});
