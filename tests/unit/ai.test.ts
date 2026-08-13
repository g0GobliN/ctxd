import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CAPABILITIES,
  extractDeterministic,
  formatOfflineReport,
  hasAny,
  NO_PROVIDERS,
  nullEmbeddingProvider,
  nullMemoryExtractor,
  nullSummarizer,
  offlineReport,
  splitStatements,
  worthConsultingProvider,
} from "@ctxd/ai";

/**
 * Optional local AI (§64-66).
 *
 * The tests that matter here are the negative ones: that ctxd ships no model,
 * reaches no network, and works entirely without a provider. The interfaces
 * exist so a backend *could* be added; nothing depends on one existing.
 */

const AI_SRC = fileURLToPath(new URL("../../packages/ai/src/", import.meta.url));

describe("the AI package ships no model and calls nothing (§65)", () => {
  it("imports no network primitive", () => {
    for (const name of readdirSync(AI_SRC)) {
      if (!name.endsWith(".ts")) continue;
      const source = readFileSync(join(AI_SRC, name), "utf8");

      assert.ok(
        !/from\s*["']node:(http|https|net|tls|dgram)["']/.test(source),
        `${name} imports a network module — a backend belongs behind the interface, not here`,
      );
      assert.ok(
        !/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(source),
        `${name} makes a network call`,
      );
    }
  });

  it("declares no runtime dependency on a model or provider SDK", () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../packages/ai/package.json", import.meta.url)), "utf8"),
    ) as { dependencies?: Record<string, string> };

    for (const name of Object.keys(manifest.dependencies ?? {})) {
      assert.ok(
        name.startsWith("@ctxd/"),
        `unexpected dependency ${name}: the AI package must stay interface-only`,
      );
    }
  });

  it("reports unavailability rather than fabricating an answer", async () => {
    const summary = await nullSummarizer.summarize("anything");
    assert.equal(summary.ok, false);
    if (!summary.ok) assert.equal(summary.reason, "no-provider-configured");

    const extracted = await nullMemoryExtractor.extract("anything");
    assert.equal(extracted.ok, false);

    const embedded = await nullEmbeddingProvider.embed(["anything"]);
    assert.equal(embedded.ok, false);
  });

  it("treats no configured provider as the normal state", () => {
    assert.equal(hasAny(NO_PROVIDERS), false);
  });
});

describe("offline mode (§66)", () => {
  it("keeps every required capability working with no provider", () => {
    const report = offlineReport();

    assert.equal(report.providersConfigured, false);
    assert.equal(report.fullyOffline, true);

    // The specification names these explicitly; none may require a model.
    for (const id of [
      "search", "memory", "git", "tasks", "sessions", "tokens",
      "context", "diff", "verification", "ui", "cli",
    ]) {
      const capability = CAPABILITIES.find((entry) => entry.id === id);
      assert.ok(capability, `§66 requires a "${id}" capability`);
      assert.equal(capability.worksOffline, true, `${id} must work offline`);
      assert.ok(capability.how.length > 0, `${id} should say how it works without AI`);
    }
  });

  it("renders a report that says no provider is configured", () => {
    const rendered = formatOfflineReport(offlineReport());
    assert.match(rendered, /none — this is the normal configuration/);
    assert.match(rendered, /works with no AI provider and no network/);
  });
});

describe("deterministic extraction (§64)", () => {
  it("finds decisions, constraints, bugs and next steps", () => {
    const text = [
      "We decided to keep idempotency keys permanently rather than expiring them.",
      "The retry limit must never exceed five, or the queue backs up.",
      "Root cause: the idempotency check ran after the insert, so a retry wrote twice.",
      "Next: rerun the webhook tests against the staging account.",
      "The weather was quite nice today and everyone seemed cheerful.",
    ].join("\n");

    const found = extractDeterministic(text);
    const types = found.map((entry) => entry.type);

    assert.ok(types.includes("DECISION"));
    assert.ok(types.includes("CONSTRAINT"));
    assert.ok(types.includes("BUG"));
    assert.ok(types.includes("TASK"));
    assert.equal(found.length, 4, "the unremarkable sentence should not be extracted");
  });

  it("carries the sentence it came from, so an extraction can be checked", () => {
    const found = extractDeterministic(
      "We decided to keep idempotency keys permanently rather than expiring them.",
    );
    const first = found[0];

    assert.ok(first);
    assert.equal(first.type, "DECISION");
    assert.match(first.evidence, /idempotency keys permanently/);
    assert.ok(first.confidence > 0 && first.confidence <= 1);
    assert.ok(first.title.length <= 80);
  });

  it("never proposes the same statement twice", () => {
    const line = "We decided to keep idempotency keys permanently rather than expiring them.";
    const found = extractDeterministic(`${line}\n${line}`);
    assert.equal(found.length, 1);
  });

  it("skips statements already recorded", () => {
    const line = "We decided to keep idempotency keys permanently rather than expiring them.";
    assert.equal(extractDeterministic(line, { exclude: [line] }).length, 0);
  });

  it("reads a markdown bullet as one statement", () => {
    const statements = splitStatements("- We decided to use pnpm. Not npm.\n- Second item here.");
    assert.equal(statements[0], "We decided to use pnpm. Not npm.");
    assert.equal(statements[1], "Second item here.");
  });

  it("extracts nothing from text with no markers", () => {
    const found = extractDeterministic(
      "The build takes about four minutes. Most of it is the type checker running over the workspace.",
    );
    assert.deepEqual(found, []);
  });

  it("does not suggest consulting a provider for a trivial note (§64)", () => {
    const short = "We decided to use pnpm rather than npm for this workspace.";
    assert.equal(worthConsultingProvider(short, extractDeterministic(short)), false);
  });

  it("suggests a provider only when a long text yielded little", () => {
    const prose = Array.from(
      { length: 20 },
      (_, i) => `Paragraph ${i} describing something at reasonable length without any marker word.`,
    ).join("\n");

    assert.equal(worthConsultingProvider(prose, extractDeterministic(prose)), true);
  });
});
