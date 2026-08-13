import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  buildReceipt,
  compressItem,
  deduplicate,
  extractTaskSignals,
  formatReceipt,
  rankItems,
  selectWithinBudget,
  shingles,
  similarity,
  strongerItem,
  estimateTokens,
  type ContextItem,
  type Priority,
} from "@ctxd/context";

const NOW = Date.parse("2026-08-01T00:00:00Z");
const signals = extractTaskSignals("Fix Stripe webhook idempotency");

function item(
  path: string,
  content: string,
  overrides: Partial<ContextItem> = {},
): ContextItem {
  return {
    id: path,
    path,
    content,
    tokenCount: estimateTokens(content),
    tokenCountType: "estimated",
    type: "source",
    priority: "P2" as Priority,
    mtime: NOW,
    hash: createHash("sha256").update(content).digest("hex"),
    ...overrides,
  };
}

describe("deduplicate", () => {
  it("removes an exact duplicate and keeps one copy", () => {
    const result = deduplicate([
      item("a.ts", "same content here"),
      item("b.ts", "same content here"),
    ]);

    assert.equal(result.kept.length, 1);
    assert.equal(result.duplicates.length, 1);
    assert.equal(result.duplicates[0]?.kind, "exact");
    assert.ok(result.removedTokens > 0);
  });

  it("removes near duplicates above the threshold", () => {
    const base = `line ${Array.from({ length: 60 }, (_, i) => `alpha beta gamma ${i}`).join("\n")}`;
    const result = deduplicate([item("a.md", base), item("b.md", `${base}\nan extra line`)]);

    assert.equal(result.kept.length, 1);
    assert.equal(result.duplicates[0]?.kind, "near");
    assert.ok((result.duplicates[0]?.similarity ?? 0) > 0.9);
  });

  it("keeps genuinely different documents", () => {
    const result = deduplicate([
      item("a.ts", "stripe webhook idempotency handling"),
      item("b.ts", "camera stream frame decoding"),
    ]);
    assert.equal(result.kept.length, 2);
    assert.deepEqual(result.duplicates, []);
  });

  it("never reports fewer kept items than distinct content", () => {
    const result = deduplicate([]);
    assert.deepEqual(result.kept, []);
    assert.equal(result.removedTokens, 0);
  });

  it("prefers the higher priority copy", () => {
    const low = item("low.md", "identical", { priority: "P3" });
    const high = item("high.md", "identical", { priority: "P0" });
    assert.equal(strongerItem(low, high).path, "high.md");
  });

  it("prefers the more recent copy at equal priority", () => {
    const older = item("older.md", "identical", { mtime: NOW - 100_000 });
    const newer = item("newer.md", "identical", { mtime: NOW });
    assert.equal(strongerItem(older, newer).path, "newer.md");
  });

  it("scores identical shingle sets as identical", () => {
    assert.equal(similarity(shingles("a b c d e f"), shingles("a b c d e f")), 1);
    assert.equal(similarity(shingles("a b c d e f"), shingles("z y x w v u")), 0);
  });
});

describe("rankItems", () => {
  it("puts task-relevant files first", () => {
    const ranked = rankItems(
      [
        item("src/camera/stream.ts", "camera frames and decoding"),
        item("src/payment/webhook.ts", "stripe webhook idempotency handler"),
      ],
      signals,
      { now: NOW },
    );
    assert.equal(ranked[0]?.path, "src/payment/webhook.ts");
  });

  it("attaches every signal to the ranked item", () => {
    const ranked = rankItems([item("src/payment/webhook.ts", "stripe webhook")], signals, {
      now: NOW,
    });
    const relevance = ranked[0]?.relevance;
    assert.ok(relevance !== undefined);
    assert.ok(relevance.keyword > 0);
    assert.ok(relevance.path > 0);
    assert.ok(typeof ranked[0]?.score === "number");
  });

  it("breaks ties on path so ordering is deterministic", () => {
    const a = item("b.ts", "identical text");
    const b = item("a.ts", "identical text");
    const ranked = rankItems([a, b], signals, { now: NOW });
    assert.equal(ranked[0]?.path, "a.ts");
  });

  it("respects configured weights", () => {
    const items = [
      item("src/camera/stream.ts", "camera frames", { priority: "P0" }),
      item("src/payment/webhook.ts", "stripe webhook idempotency"),
    ];
    const keywordLed = rankItems(items, signals, {
      now: NOW,
      weights: { keyword: 10, path: 1, fileType: 0, priority: 0, recency: 0, tokenCost: 0 },
    });
    const priorityLed = rankItems(items, signals, {
      now: NOW,
      weights: { keyword: 0, path: 0, fileType: 0, priority: 10, recency: 0, tokenCost: 0 },
    });

    assert.equal(keywordLed[0]?.path, "src/payment/webhook.ts");
    assert.equal(priorityLed[0]?.path, "src/camera/stream.ts");
  });
});

describe("compressItem", () => {
  const long = [
    `import { StripeAdapter } from "./adapter.js";`,
    ...Array.from({ length: 400 }, (_, i) => `  const unrelated${i} = computeSomething(${i});`),
    `export function handleWebhook() { return "idempotency"; }`,
  ].join("\n");

  it("leaves small items untouched", () => {
    const small = item("small.ts", "export const a = 1;");
    const result = compressItem(small, signals);
    assert.equal(result.compressed, false);
    assert.equal(result.content, small.content);
    assert.equal(result.savedTokens, 0);
  });

  it("shrinks large items while keeping relevant lines", () => {
    const result = compressItem(item("big.ts", long), signals);
    assert.equal(result.compressed, true);
    assert.ok(result.tokenCount < estimateTokens(long));
    assert.ok(result.content.includes("handleWebhook"));
    assert.ok(result.content.includes("import { StripeAdapter }"));
  });

  it("marks what it omitted rather than dropping it silently", () => {
    const result = compressItem(item("big.ts", long), signals);
    assert.match(result.content, /lines omitted/);
  });

  it("never modifies the original item", () => {
    const original = item("big.ts", long);
    compressItem(original, signals);
    assert.equal(original.content, long);
  });
});

describe("selectWithinBudget", () => {
  it("keeps the final total within budget", () => {
    const ranked = rankItems(
      Array.from({ length: 30 }, (_, i) =>
        item(`src/payment/file${i}.ts`, `stripe webhook idempotency ${"body ".repeat(200)}`),
      ),
      signals,
      { now: NOW },
    );
    const result = selectWithinBudget(ranked, signals, { budget: 2000 });

    assert.ok(result.finalTokens <= 2000, `final ${result.finalTokens} exceeds budget`);
    assert.ok(result.included.length > 0);
    assert.ok(result.excluded.length > 0);
  });

  it("honours the safety margin", () => {
    const ranked = rankItems(
      [item("src/payment/webhook.ts", `stripe webhook ${"x ".repeat(2000)}`)],
      signals,
      { now: NOW },
    );
    const result = selectWithinBudget(ranked, signals, {
      budget: 2000,
      safetyMarginTokens: 500,
    });
    assert.equal(result.effectiveBudget, 1500);
    assert.ok(result.finalTokens <= 1500);
  });

  it("fits mandatory items before anything else", () => {
    const ranked = rankItems(
      [
        item("src/payment/webhook.ts", `stripe webhook idempotency ${"body ".repeat(300)}`),
        item("docs/rules.md", "duplicate stripe event must not create a second payment", {
          priority: "P0",
          type: "documentation",
        }),
      ],
      signals,
      { now: NOW },
    );
    const result = selectWithinBudget(ranked, signals, { budget: 400 });

    const paths = result.included.map((entry) => entry.item.path);
    assert.ok(paths.includes("docs/rules.md"), "P0 item must be included");
    assert.deepEqual(result.warnings, []);
  });

  it("warns instead of silently dropping a mandatory item that cannot fit", () => {
    const ranked = rankItems(
      [item("docs/rules.md", "rule ".repeat(5000), { priority: "P0", type: "documentation" })],
      signals,
      { now: NOW },
    );
    const result = selectWithinBudget(ranked, signals, { budget: 50 });

    assert.equal(result.included.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0] ?? "", /docs\/rules\.md/);
  });

  it("refuses to pad the budget with irrelevant files", () => {
    const ranked = rankItems(
      [
        item("src/payment/webhook.ts", "stripe webhook idempotency"),
        item("src/camera/stream.ts", "frames and decoding"),
      ],
      signals,
      { now: NOW },
    );
    const result = selectWithinBudget(ranked, signals, { budget: 100_000 });

    const paths = result.included.map((entry) => entry.item.path);
    assert.ok(paths.includes("src/payment/webhook.ts"));
    assert.ok(!paths.includes("src/camera/stream.ts"), "irrelevant file should not be padded in");
    assert.equal(
      result.excluded.find((entry) => entry.path === "src/camera/stream.ts")?.reason,
      "no task relevance",
    );
  });

  it("never truncates an included item mid-content", () => {
    const ranked = rankItems(
      [item("src/payment/webhook.ts", `stripe webhook idempotency ${"line\n".repeat(500)}`)],
      signals,
      { now: NOW },
    );
    const result = selectWithinBudget(ranked, signals, { budget: 300 });

    for (const entry of result.included) {
      const isWholeOrCompressed =
        entry.content === entry.item.content || entry.compressed;
      assert.ok(isWholeOrCompressed, `${entry.item.path} was neither whole nor compressed`);
    }
  });
});

describe("receipt", () => {
  const ranked = rankItems(
    [
      item("src/payment/webhook.ts", "stripe webhook idempotency"),
      item("src/camera/stream.ts", "frames"),
    ],
    signals,
    { now: NOW },
  );
  const selection = selectWithinBudget(ranked, signals, { budget: 5000 });
  const receipt = buildReceipt({
    project: "fixture",
    task: signals.raw,
    candidateTokens: 50_000,
    duplicates: [],
    duplicateTokens: 0,
    selection,
    tokenCountType: "estimated",
    algorithmVersion: "1.0.0",
    requestId: "test",
    timestamp: "2026-08-01T00:00:00.000Z",
  });

  it("always records that counts are estimates", () => {
    assert.equal(receipt.token_count_estimation, "estimated");
  });

  it("records a reason for every item", () => {
    for (const entry of [...receipt.included_items, ...receipt.excluded_items]) {
      assert.ok(entry.reason.length > 0);
    }
  });

  it("reports reduction as estimated context avoided, never money", () => {
    const text = formatReceipt(receipt);
    assert.match(text, /Estimated context avoided/);
    assert.ok(!text.includes("$"), "a receipt must never imply a monetary saving");
  });

  it("carries the algorithm version so results stay comparable", () => {
    assert.equal(receipt.algorithm_version, "1.0.0");
  });
});
