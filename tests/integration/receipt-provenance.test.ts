import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { buildReceipt, formatReceipt, type ContextReceipt } from "@ctxd/context";
import { DEFAULT_CONFIG, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { buildProjectContext } from "@ctxd/firewall";
import { detectProject, upsertProject } from "@ctxd/project";
import { createTools } from "@ctxd/mcp";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * Who asked for a context build (§16.1, UI-2).
 *
 * ChangeReceipt has always recorded a worker; ContextReceipt did not, which is
 * why per-worker context usage could not be shown at all. The field is a claim,
 * and the tests below exist mostly to keep it one.
 */

const home = createTempHome();
after(() => home.cleanup());

let counter = 0;

function project(name: string): { db: Db; root: string } {
  const root = join(home.dir, `receipt-${name}`);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: `receipt-${name}` }));
  writeFileSync(
    join(root, "src/webhook.ts"),
    "export function handleWebhook() { return 'stripe idempotency'; }",
  );

  const db = openDatabase(join(home.dir, `receipt-${name}-${(counter += 1)}.db`));
  migrate(db);
  upsertProject(db, detectProject(root));
  return { db, root };
}

describe("context receipt provenance (§16.1)", () => {
  it("records the worker that asked", () => {
    const { db, root } = project("claimed");
    const result = buildProjectContext({
      task: "fix stripe webhook idempotency",
      dir: root,
      budget: 4000,
      db,
      config: DEFAULT_CONFIG,
      claimedWorker: "claude",
    });

    assert.equal(result.receipt.claimed_worker, "claude");
    db.close();
  });

  it("omits the field entirely when nobody said", () => {
    const { db, root } = project("unclaimed");
    const result = buildProjectContext({
      task: "fix stripe webhook idempotency",
      dir: root,
      budget: 4000,
      db,
      config: DEFAULT_CONFIG,
    });

    // Omitted rather than null: a reader cannot then mistake an explicit null
    // for a worker that named itself null.
    assert.equal("claimed_worker" in result.receipt, false);
    db.close();
  });

  it("carries the claim through the MCP tool", () => {
    const { db, root } = project("mcp");
    const tools = new Map(
      createTools({
        db,
        paths: resolvePaths({ env: { CTXD_HOME: home.dir } }),
        config: DEFAULT_CONFIG,
        cwd: root,
        worker: "cursor",
      }).map((tool) => [tool.name, tool]),
    );

    const result = tools.get("ctx_context_build")?.handler({ dir: root, task: "fix the webhook" });
    assert.match(result?.text ?? "", /claims cursor/);
    db.close();
  });

  it("reads a receipt written before the field existed as unknown", () => {
    // Exactly what is already on disk in every existing installation: receipts
    // are files, and old ones will never gain the field.
    const legacy = JSON.parse(
      JSON.stringify(
        buildReceipt({
          project: "demo",
          task: "an older request",
          candidateTokens: 100,
          duplicates: [],
          duplicateTokens: 0,
          selection: {
            budget: 50,
            finalTokens: 40,
            included: [],
            excluded: [],
            irrelevantTokens: 0,
            lowPriorityTokens: 0,
            compressedTokens: 0,
            warnings: [],
          },
          tokenCountType: "estimated",
          algorithmVersion: "test",
        }),
      ),
    ) as ContextReceipt;

    assert.equal(legacy.claimed_worker, undefined);
    assert.match(formatReceipt(legacy), /Worker:\s+unknown/);
  });

  it("renders a known worker as a claim, never as a fact", () => {
    const { db, root } = project("rendered");
    const result = buildProjectContext({
      task: "fix stripe webhook idempotency",
      dir: root,
      budget: 4000,
      db,
      config: DEFAULT_CONFIG,
      claimedWorker: "claude",
    });

    const text = formatReceipt(result.receipt);
    // The receipt is the document whose entire purpose is to be trustworthy,
    // so it must not launder a self-declared name into an established one.
    assert.match(text, /Worker:\s+claims claude/);
    db.close();
  });
});
