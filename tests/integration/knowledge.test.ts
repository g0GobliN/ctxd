import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import {
  formatMemoryMatches,
  memoriesForPaths,
  pathAliases,
  saveMemory,
} from "@ctxd/memory";
import { detectProject, upsertProject } from "@ctxd/project";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * Decisions, bug memory and file explanations (§45, §46, §47).
 *
 * The feature is only worth anything if a record comes back at the moment the
 * code it concerns is edited — so these tests assert the matching, not just the
 * storage.
 */

const home = createTempHome();
let db: Db;
let projectId: string;

before(() => {
  const root = join(home.dir, "knowledge-project");
  mkdirSync(join(root, "src", "payment"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "knowledge-project" }));
  writeFileSync(join(root, "src/payment/idempotency.ts"), "export const key = 1;\n");

  db = openDatabase(join(home.dir, "knowledge.db"));
  migrate(db);
  projectId = upsertProject(db, detectProject(root)).id;
});

after(() => {
  db?.close();
  home.cleanup();
});

describe("path aliases", () => {
  it("offers the full path first and the module last", () => {
    const aliases = pathAliases("apps/api/src/payment/idempotency.ts");
    const names = aliases.map((entry) => entry.alias);

    assert.equal(names[0], "apps/api/src/payment/idempotency.ts");
    assert.ok(names.includes("idempotency.ts"));
    assert.ok(names.includes("idempotency"));
    assert.ok(names.includes("payment"));

    // Specificity must decrease, so the most precise match wins.
    for (let i = 1; i < aliases.length; i += 1) {
      assert.ok(
        (aliases[i]?.specificity ?? 0) <= (aliases[i - 1]?.specificity ?? 0),
        "aliases should be ordered from most to least specific",
      );
    }
  });

  it("does not offer generic directory names as identifiers", () => {
    const names = pathAliases("src/utils/index.ts").map((entry) => entry.alias);
    assert.ok(!names.includes("utils"), "'utils' identifies nothing");
    assert.ok(!names.includes("index"), "'index' identifies nothing");
  });

  it("ignores tokens too short to be meaningful", () => {
    const names = pathAliases("src/db/x.ts").map((entry) => entry.alias);
    assert.ok(!names.includes("db"), "two-character tokens would match everything");
    assert.ok(!names.includes("x"));
  });
});

describe("surfacing memory for touched files", () => {
  before(() => {
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Decision #42 — idempotency keys are permanent",
      content:
        "Question:\nMay an idempotency key be reused after expiry?\n\n" +
        "Decision:\nNo.\n\nReason:\nStripe may retry an event long after the key would have expired.\n\n" +
        "Status:\nACTIVE",
      source: "accepted_decision",
      importance: "P1",
      tags: ["src/payment/idempotency.ts"],
    });

    saveMemory(db, {
      projectId,
      type: "BUG",
      title: "BUG #91 — duplicate payments under retry",
      content:
        "Problem:\nA retried webhook created a second Payment.\n\n" +
        "Cause:\nThe idempotency check ran after the insert.\n\n" +
        "Fix:\nCheck before writing.\n\nStatus:\nRESOLVED",
      source: "explicit_user",
      importance: "P1",
      tags: ["src/payment/idempotency.ts"],
    });

    saveMemory(db, {
      projectId,
      type: "FACT",
      title: "Unrelated fact about the camera module",
      content: "The camera stream decodes at 30fps.",
      source: "worker_statement",
      importance: "P3",
    });
  });

  it("surfaces a decision when its file is touched", () => {
    const matches = memoriesForPaths(db, projectId, ["src/payment/idempotency.ts"]);
    const titles = matches.map((match) => match.memory.title);

    assert.ok(titles.some((title) => title.includes("Decision #42")));
    assert.ok(titles.some((title) => title.includes("BUG #91")));
  });

  it("says which path matched and how, rather than asserting relevance", () => {
    const matches = memoriesForPaths(db, projectId, ["src/payment/idempotency.ts"]);
    const first = matches[0];

    assert.ok(first);
    assert.equal(first.path, "src/payment/idempotency.ts");
    assert.equal(first.matched, "src/payment/idempotency.ts");
  });

  it("does not surface memories about other code", () => {
    const matches = memoriesForPaths(db, projectId, ["src/camera/stream.ts"]);
    assert.deepEqual(
      matches.map((match) => match.memory.title),
      [],
      "a payment decision must not attach itself to the camera module",
    );
  });

  it("excludes memory types that do not describe code", () => {
    const matches = memoriesForPaths(db, projectId, ["src/payment/idempotency.ts"]);
    assert.ok(
      !matches.some((match) => match.memory.type === "FACT"),
      "a loose FACT is not a decision, a bug or a file note",
    );
  });

  it("matches a module-level record for any file inside it", () => {
    saveMemory(db, {
      projectId,
      type: "CONSTRAINT",
      title: "Only src/payment may write Payment rows",
      content: "Every other module goes through the payment service.",
      source: "project_rule",
      importance: "P0",
    });

    const matches = memoriesForPaths(db, projectId, ["src/payment/refund.ts"]);
    assert.ok(
      matches.some((match) => match.memory.title.includes("Only src/payment")),
      "a constraint naming the module should surface for a new file in it",
    );
  });

  it("does not match a name embedded in a longer word", () => {
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Prepayments are calculated nightly",
      content: "The prepayments batch runs at 02:00.",
      source: "accepted_decision",
      importance: "P2",
    });

    const matches = memoriesForPaths(db, projectId, ["src/payment/refund.ts"]);
    assert.ok(
      !matches.some((match) => match.memory.title.includes("Prepayments")),
      "'payment' must not match inside 'prepayments'",
    );
  });

  it("renders matches as a prompt to check, not an instruction to stop", () => {
    const matches = memoriesForPaths(db, projectId, ["src/payment/idempotency.ts"]);
    const rendered = formatMemoryMatches(matches);

    assert.match(rendered, /RELEVANT PROJECT MEMORY/);
    assert.match(rendered, /Decision #42/);
    assert.match(rendered, /do not remove the/i);
    // It must show provenance, since authority depends on it (§31).
    assert.match(rendered, /source: accepted_decision/);
  });

  it("returns nothing for no paths", () => {
    assert.deepEqual(memoriesForPaths(db, projectId, []), []);
  });
});
