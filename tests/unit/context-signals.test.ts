import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  classifyItem,
  compileIgnoreRules,
  DEFAULT_IGNORE_PATTERNS,
  defaultPriority,
  estimateTokens,
  extractTaskSignals,
  isIgnored,
  keywordScore,
  normalizeTerms,
  pathScore,
  readFrontMatterPriority,
  recencyScore,
  tokenCostScore,
} from "@ctxd/context";

describe("estimateTokens", () => {
  it("counts nothing for empty input", () => {
    assert.equal(estimateTokens(""), 0);
  });

  it("is deterministic", () => {
    const text = "const paymentIntent = await stripe.create({ amount: 100 });";
    assert.equal(estimateTokens(text), estimateTokens(text));
  });

  it("grows with content length", () => {
    assert.ok(estimateTokens("short") < estimateTokens("short ".repeat(50)));
  });

  it("charges long identifiers more than short ones", () => {
    assert.ok(estimateTokens("idempotencyKeyStore") > estimateTokens("key"));
  });

  it("lands in a sane range for prose", () => {
    // ~11 words; a real tokenizer would say roughly 12-16.
    const tokens = estimateTokens(
      "The webhook handler must be idempotent because Stripe retries deliveries often",
    );
    assert.ok(tokens >= 10 && tokens <= 25, `unexpected estimate ${tokens}`);
  });
});

describe("normalizeTerms", () => {
  it("splits camelCase into parts and keeps the whole", () => {
    const terms = normalizeTerms("idempotencyKey");
    assert.ok(terms.includes("idempotency"));
    assert.ok(terms.includes("key"));
    assert.ok(terms.includes("idempotencykey"));
  });

  it("lowercases and drops single characters", () => {
    assert.deepEqual(normalizeTerms("A Payment"), ["payment"]);
  });

  it("splits on punctuation and paths", () => {
    const terms = normalizeTerms("src/payment/webhook.ts");
    assert.deepEqual(terms, ["src", "payment", "webhook", "ts"]);
  });
});

describe("extractTaskSignals", () => {
  it("keeps meaningful terms and drops filler verbs", () => {
    const signals = extractTaskSignals("Fix Stripe webhook idempotency");
    assert.deepEqual(signals.terms, ["stripe", "webhook", "idempotency"]);
  });

  it("builds adjacent phrases", () => {
    const signals = extractTaskSignals("Fix Stripe webhook idempotency");
    assert.ok(signals.phrases.includes("stripe webhook"));
    assert.ok(signals.phrases.includes("webhook idempotency"));
  });

  it("preserves the raw task text", () => {
    assert.equal(extractTaskSignals("  Fix it  ").raw, "  Fix it  ");
  });

  it("handles a task with no usable terms", () => {
    const signals = extractTaskSignals("fix the");
    assert.deepEqual(signals.terms, []);
    assert.deepEqual(signals.phrases, []);
  });
});

describe("scoring signals", () => {
  const signals = extractTaskSignals("Fix Stripe webhook idempotency");

  it("scores matching content above unrelated content", () => {
    const relevant = keywordScore(
      "export class StripeWebhookHandler { idempotency }",
      signals,
    );
    const irrelevant = keywordScore("export class CameraStream { frames }", signals);
    assert.ok(relevant > irrelevant);
    assert.equal(irrelevant, 0);
  });

  it("scores matching paths above unrelated paths", () => {
    assert.ok(pathScore("src/payment/webhook.ts", signals) > pathScore("src/camera/stream.ts", signals));
  });

  it("returns zero for an empty task", () => {
    const empty = extractTaskSignals("the");
    assert.equal(keywordScore("anything", empty), 0);
    assert.equal(pathScore("any/path.ts", empty), 0);
  });

  it("keeps every signal within [0, 1]", () => {
    const content = "stripe webhook idempotency ".repeat(200);
    assert.ok(keywordScore(content, signals) <= 1);
    assert.ok(pathScore("stripe/webhook/idempotency.ts", signals) <= 1);
    assert.ok(tokenCostScore(10_000_000) <= 1);
  });

  it("decays recency over time", () => {
    const now = Date.parse("2026-08-01T00:00:00Z");
    const fresh = recencyScore(now, now);
    const old = recencyScore(now - 90 * 86_400_000, now);
    assert.equal(fresh, 1);
    assert.ok(old < 0.2 && old > 0);
  });
});

describe("classifyItem", () => {
  it("recognises source, documentation, configuration and sessions", () => {
    assert.equal(classifyItem("src/payment/webhook.ts"), "source");
    assert.equal(classifyItem("docs/architecture.md"), "documentation");
    assert.equal(classifyItem("package.json"), "configuration");
    assert.equal(classifyItem(".ctxd/sessions/session-1.md"), "session");
    assert.equal(classifyItem(".ctxd/memory/decision.md"), "memory");
    assert.equal(classifyItem("project.md"), "project");
    assert.equal(classifyItem("logo.svg"), "other");
  });
});

describe("priority policy", () => {
  it("treats rules and security documents as mandatory", () => {
    assert.equal(defaultPriority("docs/rules.md", "documentation"), "P0");
    assert.equal(defaultPriority("docs/security.md", "documentation"), "P0");
  });

  it("archives sessions", () => {
    assert.equal(defaultPriority(".ctxd/sessions/session-1.md", "session"), "P4");
  });

  it("gives ordinary source a middle priority", () => {
    assert.equal(defaultPriority("src/payment/webhook.ts", "source"), "P2");
  });

  it("lets explicit front matter override the policy", () => {
    assert.equal(readFrontMatterPriority("---\npriority: P0\n---\n\n# Note\n"), "P0");
    assert.equal(readFrontMatterPriority("# Note\n"), undefined);
    assert.equal(readFrontMatterPriority("---\ntype: MEMORY\n---\n"), undefined);
  });
});

describe("ignore rules", () => {
  const rules = compileIgnoreRules(DEFAULT_IGNORE_PATTERNS, "default");

  it("never collects environment files", () => {
    assert.equal(isIgnored(".env", rules, false), true);
    assert.equal(isIgnored(".env.local", rules, false), true);
  });

  it("skips dependency and build output", () => {
    assert.equal(isIgnored("node_modules", rules, true), true);
    assert.equal(isIgnored("dist", rules, true), true);
    assert.equal(isIgnored("packages/core/dist", rules, true), true);
  });

  it("skips key material", () => {
    assert.equal(isIgnored("certs/server.pem", rules, false), true);
  });

  it("keeps ordinary source", () => {
    assert.equal(isIgnored("src/payment/webhook.ts", rules, false), false);
  });

  it("ignores comments, blanks and unsupported negation", () => {
    const custom = compileIgnoreRules(["# comment", "", "!keep.ts", "drop.ts"], "test");
    assert.equal(custom.length, 1);
    assert.equal(isIgnored("drop.ts", custom, false), true);
    assert.equal(isIgnored("keep.ts", custom, false), false);
  });

  it("anchors patterns that start with a slash", () => {
    const custom = compileIgnoreRules(["/build.ts"], "test");
    assert.equal(isIgnored("build.ts", custom, false), true);
    assert.equal(isIgnored("nested/build.ts", custom, false), false);
  });
});
