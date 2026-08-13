import { strict as assert } from "node:assert";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase } from "@ctxd/db";
import {
  archiveMemory,
  authorityRank,
  canOverride,
  defaultConfidence,
  getMemory,
  listMemories,
  outranks,
  saveMemory,
  searchMemories,
  toMarkdown,
  toMatchQuery,
  touchMemory,
  writeMemoryBody,
  writeMemoryDigests,
  EXTERNALIZE_ABOVE_BYTES,
  type Memory,
  type SaveMemoryInput,
} from "@ctxd/memory";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

const PROJECT = "project-1";
let counter = 0;

function freshDb(name: string) {
  const db = openDatabase(join(home.dir, `mem-${name}.db`));
  migrate(db);
  db.prepare(
    `INSERT INTO projects (id, root, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(PROJECT, `/tmp/root-${(counter += 1)}`, "fixture", "2026-01-01", "2026-01-01");
  return db;
}

function input(overrides: Partial<SaveMemoryInput> = {}): SaveMemoryInput {
  return {
    projectId: PROJECT,
    type: "FACT",
    title: "Stripe retries webhooks",
    content: "The same event id can arrive several times.",
    source: "explicit_user",
    ...overrides,
  };
}

describe("authority order", () => {
  it("ranks sources exactly as the specification requires", () => {
    const order = [
      "explicit_user",
      "project_rule",
      "accepted_decision",
      "verified_code",
      "verified_git",
      "worker_statement",
      "inferred",
    ] as const;

    for (let i = 1; i < order.length; i += 1) {
      const stronger = order[i - 1] as (typeof order)[number];
      const weaker = order[i] as (typeof order)[number];
      assert.ok(
        authorityRank(stronger) < authorityRank(weaker),
        `${stronger} should outrank ${weaker}`,
      );
      assert.equal(outranks(stronger, weaker), true);
      assert.equal(outranks(weaker, stronger), false);
    }
  });

  it("gives inferred knowledge visible doubt", () => {
    assert.equal(defaultConfidence("explicit_user"), 1);
    assert.ok(defaultConfidence("inferred") < 1);
    assert.ok(defaultConfidence("worker_statement") < defaultConfidence("verified_code"));
  });

  it("refuses to let an inference override an explicit rule", () => {
    const existing = { source: "project_rule", status: "active", title: "rule" } as Memory;
    const incoming = { source: "inferred" } as Memory;

    const decision = canOverride(incoming, existing);
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /may not override/);
  });

  it("allows an equal or higher authority to update", () => {
    const existing = { source: "worker_statement", status: "active", title: "x" } as Memory;
    assert.equal(canOverride({ source: "worker_statement" } as Memory, existing).allowed, true);
    assert.equal(canOverride({ source: "explicit_user" } as Memory, existing).allowed, true);
  });
});

describe("saveMemory", () => {
  it("creates a memory with type-appropriate defaults", () => {
    const db = freshDb("create");
    const outcome = saveMemory(db, input({ type: "RULE", source: "project_rule" }));

    assert.equal(outcome.kind, "created");
    if (outcome.kind !== "created") return;
    assert.equal(outcome.memory.importance, "P0");
    assert.equal(outcome.memory.confidence, 1);
    assert.equal(outcome.memory.status, "active");
    db.close();
  });

  it("treats an identical re-save as unchanged rather than a duplicate", () => {
    const db = freshDb("dedupe");
    saveMemory(db, input());
    const second = saveMemory(db, input());

    assert.equal(second.kind, "unchanged");
    assert.equal(listMemories(db, PROJECT).length, 1);
    db.close();
  });

  it("supersedes rather than mutating when authority allows", () => {
    const db = freshDb("supersede");
    const first = saveMemory(db, input({ source: "worker_statement" }));
    const second = saveMemory(db, input({ content: "Revised wording.", source: "explicit_user" }));

    assert.equal(second.kind, "superseded");
    if (second.kind !== "superseded") return;

    assert.equal(second.memory.supersedes, second.previous.id);
    if (first.kind === "created") {
      // The original is kept, marked superseded — history is never destroyed.
      assert.equal(getMemory(db, first.memory.id)?.status, "superseded");
    }
    assert.equal(listMemories(db, PROJECT, { status: "active" }).length, 1);
    db.close();
  });

  it("rejects a lower-authority contradiction and leaves the original intact", () => {
    const db = freshDb("reject");
    const original = saveMemory(db, input({ source: "project_rule" }));
    const attempt = saveMemory(db, input({ content: "The opposite.", source: "inferred" }));

    assert.equal(attempt.kind, "rejected");
    if (original.kind === "created") {
      const stored = getMemory(db, original.memory.id);
      assert.equal(stored?.status, "active");
      assert.equal(stored?.content, original.memory.content);
    }
    db.close();
  });

  it("filters listings by type and status", () => {
    const db = freshDb("list");
    saveMemory(db, input({ type: "RULE", title: "a rule", source: "project_rule" }));
    saveMemory(db, input({ type: "BUG", title: "a bug", source: "verified_code" }));

    assert.equal(listMemories(db, PROJECT, { type: "RULE" }).length, 1);
    assert.equal(listMemories(db, PROJECT, { type: "BUG" }).length, 1);
    assert.equal(listMemories(db, PROJECT).length, 2);
    db.close();
  });

  it("archives without deleting", () => {
    const db = freshDb("archive");
    const outcome = saveMemory(db, input());
    if (outcome.kind !== "created") return assert.fail("expected creation");

    assert.equal(archiveMemory(db, outcome.memory.id), true);
    assert.equal(getMemory(db, outcome.memory.id)?.status, "archived");
    assert.equal(listMemories(db, PROJECT, { status: "active" }).length, 0);
    db.close();
  });

  it("records when a memory was last used", () => {
    const db = freshDb("touch");
    const outcome = saveMemory(db, input());
    if (outcome.kind !== "created") return assert.fail("expected creation");

    assert.equal(outcome.memory.lastAccessedAt, null);
    touchMemory(db, outcome.memory.id, new Date("2026-08-01T00:00:00Z"));
    assert.equal(getMemory(db, outcome.memory.id)?.lastAccessedAt, "2026-08-01T00:00:00.000Z");
    db.close();
  });
});

describe("searchMemories", () => {
  function seeded(name: string) {
    const db = freshDb(name);
    saveMemory(db, {
      projectId: PROJECT,
      type: "RULE",
      title: "Duplicate Stripe events must not create a second payment",
      content: "Webhook handling is idempotent, keyed on the Stripe event id.",
      source: "project_rule",
      tags: ["stripe", "idempotency"],
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "BUG",
      title: "Vite HMR port collision",
      content: "Multiple applications used the same port.",
      source: "verified_code",
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "NOTE",
      title: "Signage firmware",
      content: "The signage fleet runs firmware 4.2.",
      source: "inferred",
    });
    return db;
  }

  it("finds memories by term", () => {
    const db = seeded("find");
    const hits = searchMemories(db, "idempotency");

    assert.equal(hits.length, 1);
    assert.match(hits[0]?.memory.title ?? "", /Duplicate Stripe events/);
    db.close();
  });

  it("returns nothing for an unmatched term rather than everything", () => {
    const db = seeded("miss");
    assert.deepEqual(searchMemories(db, "kubernetes"), []);
    db.close();
  });

  it("filters by type", () => {
    const db = seeded("type-filter");
    const hits = searchMemories(db, "port collision", { type: "BUG" });
    assert.equal(hits.length, 1);
    assert.equal(searchMemories(db, "port collision", { type: "RULE" }).length, 0);
    db.close();
  });

  it("ranks an authoritative rule above a passing mention", () => {
    const db = freshDb("ranking");
    saveMemory(db, {
      projectId: PROJECT,
      type: "RULE",
      title: "Stripe webhooks must be idempotent",
      content: "Binding rule.",
      source: "project_rule",
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "NOTE",
      title: "Meeting notes",
      content: "We talked about stripe stripe stripe and webhooks at length.",
      source: "inferred",
    });

    const hits = searchMemories(db, "stripe webhooks");
    assert.equal(hits[0]?.memory.type, "RULE", "the binding rule should win");
    db.close();
  });

  it("excludes superseded memories by default", () => {
    const db = freshDb("superseded-search");
    saveMemory(db, {
      projectId: PROJECT,
      type: "DECISION",
      title: "Retry policy",
      content: "Retry three times.",
      source: "worker_statement",
    });
    saveMemory(db, {
      projectId: PROJECT,
      type: "DECISION",
      title: "Retry policy",
      content: "Retry five times with backoff.",
      source: "explicit_user",
    });

    const hits = searchMemories(db, "retry");
    assert.equal(hits.length, 1);
    assert.match(hits[0]?.memory.content ?? "", /five times/);
    db.close();
  });

  it("does not let user input act as an FTS5 operator", () => {
    const db = seeded("injection");
    // These would be syntax errors or change meaning if passed through raw.
    for (const query of ['stripe OR "', "NEAR(a b)", "stripe*", "(("]) {
      assert.doesNotThrow(() => searchMemories(db, query), `query broke search: ${query}`);
    }
    db.close();
  });

  it("quotes each term so a search means what was typed", () => {
    assert.equal(toMatchQuery("stripe webhook"), '"stripe" OR "webhook"');
    assert.equal(toMatchQuery('"exact phrase" other'), '"exact phrase" OR "other"');
    assert.equal(toMatchQuery("!!!"), "");
  });
});

describe("memory storage", () => {
  it("keeps short memories in the database", () => {
    const dir = join(home.dir, "memory-short");
    const result = writeMemoryBody(dir, "abc", "Title", "short content");

    assert.equal(result.externalized, false);
    assert.equal(result.bodyPath, null);
    assert.equal(result.stored, "short content");
  });

  it("writes long memories to Markdown and keeps a searchable excerpt", () => {
    const dir = join(home.dir, "memory-long");
    const content = "idempotency ".repeat(EXTERNALIZE_ABOVE_BYTES / 4);
    const result = writeMemoryBody(dir, "abc", "Long note", content);

    assert.equal(result.externalized, true);
    assert.ok(result.bodyPath !== null);
    assert.ok(result.stored.length < content.length);
    assert.match(result.stored, /full text in abc\.md/);
    assert.match(readFileSync(result.bodyPath as string, "utf8"), /^# Long note/);
  });

  it("renders a memory as Markdown with its provenance", () => {
    const db = freshDb("markdown");
    const outcome = saveMemory(db, input({ source: "inferred" }));
    if (outcome.kind !== "created") return assert.fail("expected creation");

    const markdown = toMarkdown(outcome.memory);
    assert.match(markdown, /source: inferred/);
    assert.match(markdown, /confidence: 0\.6/);
    db.close();
  });

  it("writes per-type digests that are readable without ctxd", () => {
    const db = freshDb("digests");
    saveMemory(db, input({ type: "RULE", title: "A binding rule", source: "project_rule" }));
    saveMemory(db, input({ type: "BUG", title: "A fixed bug", source: "verified_code" }));

    const dir = join(home.dir, "digests");
    mkdirSync(dir, { recursive: true });
    const written = writeMemoryDigests(dir, listMemories(db, PROJECT));

    assert.ok(written.includes("rules.md"));
    assert.match(readFileSync(join(dir, "rules.md"), "utf8"), /A binding rule/);
    assert.match(readFileSync(join(dir, "bugs.md"), "utf8"), /A fixed bug/);
    // A type with no memories still gets a file, saying so honestly.
    assert.match(readFileSync(join(dir, "tasks.md"), "utf8"), /No tasks recorded yet/);
    db.close();
  });
});
