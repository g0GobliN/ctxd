import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { DEFAULT_CONFIG, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { getMemory, listMemories, saveMemory } from "@ctxd/memory";
import { detectProject, upsertProject } from "@ctxd/project";
import { createTask, startSession } from "@ctxd/work";
import { createTools, type ToolDefinition } from "@ctxd/mcp";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

let counter = 0;

interface Harness {
  readonly db: Db;
  readonly root: string;
  readonly projectId: string;
  readonly tools: Map<string, ToolDefinition>;
  call(name: string, args?: Record<string, unknown>): { text: string; isError?: boolean };
}

function harness(name: string, register = true): Harness {
  const root = join(home.dir, `mcp-${name}`);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: `mcp-${name}` }));
  writeFileSync(
    join(root, "src/webhook.ts"),
    "export function handleWebhook() { return 'stripe idempotency'; }",
  );

  const db = openDatabase(join(home.dir, `mcp-${name}-${(counter += 1)}.db`));
  migrate(db);

  const detected = detectProject(root);
  const projectId = register ? upsertProject(db, detected).id : "";

  const tools = new Map(
    createTools({
      db,
      paths: resolvePaths({ env: { CTXD_HOME: home.dir } }),
      config: DEFAULT_CONFIG,
      cwd: root,
    }).map((tool) => [tool.name, tool]),
  );

  return {
    db,
    root,
    projectId,
    tools,
    call(toolName, args = {}) {
      const tool = tools.get(toolName);
      if (tool === undefined) throw new Error(`no such tool: ${toolName}`);
      return tool.handler({ dir: root, ...args });
    },
  };
}

describe("MCP tool surface", () => {
  it("exposes only tools whose services exist", () => {
    const h = harness("surface");
    const names = [...h.tools.keys()];

    for (const expected of [
      "ctx_status",
      "ctx_project_summary",
      "ctx_context_build",
      "ctx_search",
      "ctx_get",
      "ctx_decision_get",
      "ctx_file_search",
      "ctx_file_get",
      "ctx_memory_save",
      "ctx_memory_update",
    ]) {
      assert.ok(names.includes(expected), `missing tool: ${expected}`);
    }

    // Unlocked in Phase 6, once the services behind them existed.
    for (const workTool of ["ctx_task_get", "ctx_task_update", "ctx_checkpoint", "ctx_handoff"]) {
      assert.ok(names.includes(workTool), `missing tool: ${workTool}`);
    }
    h.db.close();
  });

  it("gives every tool a description and an object schema", () => {
    const h = harness("schemas");
    for (const tool of h.tools.values()) {
      assert.ok(tool.description.length > 20, `${tool.name} needs a real description`);
      assert.equal(tool.inputSchema["type"], "object", `${tool.name} schema should be an object`);
    }
    h.db.close();
  });
});

describe("ctx_status and ctx_project_summary", () => {
  it("reports a registered project", () => {
    const h = harness("status");
    const status = h.call("ctx_status");

    assert.ok(status.isError !== true);
    assert.match(status.text, /ctxd \d+\.\d+\.\d+/);
    assert.match(status.text, /project: mcp-status/);
    h.db.close();
  });

  it("says plainly when a directory is not registered", () => {
    const h = harness("unregistered", false);
    assert.match(h.call("ctx_status").text, /not registered/);

    const summary = h.call("ctx_project_summary");
    assert.equal(summary.isError, true);
    assert.match(summary.text, /ctxd init/);
    h.db.close();
  });

  it("surfaces binding rules in the project summary", () => {
    const h = harness("summary");
    saveMemory(h.db, {
      projectId: h.projectId,
      type: "RULE",
      title: "Never log personal data",
      content: "Redact names before logging.",
      source: "project_rule",
    });

    const summary = h.call("ctx_project_summary");
    assert.match(summary.text, /Binding rules \(1\)/);
    assert.match(summary.text, /Never log personal data/);
    h.db.close();
  });
});

describe("ctx_context_build", () => {
  it("returns context and a receipt", () => {
    const h = harness("build");
    const result = h.call("ctx_context_build", { task: "Fix stripe idempotency", budget: 4000 });

    assert.ok(result.isError !== true);
    assert.match(result.text, /src\/webhook\.ts/);
    assert.match(result.text, /CONTEXT RECEIPT/);
    assert.match(result.text, /Estimated context avoided/);
    h.db.close();
  });

  it("can return the receipt alone", () => {
    const h = harness("build-receipt");
    const result = h.call("ctx_context_build", {
      task: "Fix stripe idempotency",
      receipt_only: true,
    });

    assert.match(result.text, /CONTEXT RECEIPT/);
    assert.ok(!result.text.includes("handleWebhook"), "receipt_only should omit file contents");
    h.db.close();
  });

  it("requires a task", () => {
    const h = harness("build-no-task");
    const result = h.call("ctx_context_build", {});
    assert.equal(result.isError, true);
    h.db.close();
  });
});

describe("memory tools", () => {
  it("records a worker's conclusion with worker authority", () => {
    const h = harness("save");
    const result = h.call("ctx_memory_save", {
      title: "Webhook retries are unbounded",
      content: "Observed in the Stripe dashboard.",
      type: "FACT",
    });

    assert.ok(result.isError !== true);
    const stored = listMemories(h.db, h.projectId);
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.source, "worker_statement");
    assert.ok((stored[0]?.confidence ?? 1) < 1, "a worker's claim carries visible doubt");
    h.db.close();
  });

  it("refuses to let a worker claim the developer's authority", () => {
    const h = harness("authority");

    for (const source of ["explicit_user", "project_rule"]) {
      const result = h.call("ctx_memory_save", {
        title: "Pretend rule",
        content: "Should not be accepted.",
        source,
      });
      assert.equal(result.isError, true, `${source} should be refused`);
      assert.match(result.text, /may not record memory as/);
    }

    assert.equal(listMemories(h.db, h.projectId).length, 0);
    h.db.close();
  });

  it("refuses to overwrite a higher-authority memory", () => {
    const h = harness("conflict");
    saveMemory(h.db, {
      projectId: h.projectId,
      type: "RULE",
      title: "No duplicate payments",
      content: "A duplicate event must not create a second payment.",
      source: "project_rule",
    });

    const result = h.call("ctx_memory_save", {
      title: "No duplicate payments",
      content: "Actually duplicates are fine.",
      type: "RULE",
    });

    assert.equal(result.isError, true);
    assert.match(result.text, /Raise the conflict with the developer/);
    h.db.close();
  });

  it("supersedes on update rather than destroying history", () => {
    const h = harness("update");
    const created = saveMemory(h.db, {
      projectId: h.projectId,
      type: "NOTE",
      title: "Retry count",
      content: "Three.",
      source: "worker_statement",
    });
    if (created.kind !== "created") return assert.fail("expected creation");

    const result = h.call("ctx_memory_update", {
      id: created.memory.id,
      content: "Five, with backoff.",
    });

    assert.ok(result.isError !== true);
    assert.equal(getMemory(h.db, created.memory.id)?.status, "superseded");
    assert.equal(listMemories(h.db, h.projectId, { status: "active" }).length, 1);
    h.db.close();
  });

  it("finds a saved memory through search and fetches it by id", () => {
    const h = harness("roundtrip");
    h.call("ctx_memory_save", {
      title: "Idempotency uses the event id",
      content: "Keyed on the Stripe event id.",
      type: "DECISION",
    });

    const found = h.call("ctx_search", { query: "idempotency" });
    assert.match(found.text, /Idempotency uses the event id/);
    assert.match(found.text, /tokens to fetch/);

    const id = /id: (\S+)/.exec(found.text)?.[1];
    assert.ok(id !== undefined);
    assert.match(h.call("ctx_get", { id }).text, /Keyed on the Stripe event id/);
    h.db.close();
  });
});

describe("work tools", () => {
  it("creates, lists and updates tasks through MCP", () => {
    const h = harness("tasks");
    const created = createTask(h.db, { projectId: h.projectId, title: "Fix idempotency" });

    assert.match(h.call("ctx_task_get").text, /Fix idempotency/);
    assert.match(h.call("ctx_task_get", { id: created.id }).text, /status: BACKLOG/);

    const updated = h.call("ctx_task_update", { id: created.id, status: "IN_PROGRESS" });
    assert.ok(updated.isError !== true);
    assert.match(updated.text, /IN_PROGRESS/);
    h.db.close();
  });

  it("rejects an unknown task status", () => {
    const h = harness("bad-status");
    const created = createTask(h.db, { projectId: h.projectId, title: "Task" });

    const result = h.call("ctx_task_update", { id: created.id, status: "ALMOST_DONE" });
    assert.equal(result.isError, true);
    h.db.close();
  });

  it("records a checkpoint and builds a handoff", () => {
    const h = harness("checkpoint");
    createTask(h.db, { projectId: h.projectId, title: "Fix idempotency" });
    startSession(h.db, { projectId: h.projectId, worker: "claude" });

    const checkpoint = h.call("ctx_checkpoint", { next_action: "Run the tests" });
    assert.ok(checkpoint.isError !== true);
    assert.match(checkpoint.text, /Run the tests/);

    const handoff = h.call("ctx_handoff", { to: "cursor" });
    assert.match(handoff.text, /RECOMMENDED: cursor/);
    h.db.close();
  });
});

describe("file tools", () => {
  it("searches indexed files and reads one", () => {
    const h = harness("files");
    h.db
      .prepare(
        `INSERT INTO files (project_id, path, size, mtime, hash, language, item_type, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(h.projectId, "src/webhook.ts", 60, 0, "hash", "typescript", "source", "2026-08-01");

    assert.match(h.call("ctx_file_search", { query: "webhook" }).text, /src\/webhook\.ts/);
    assert.match(h.call("ctx_file_get", { path: "src/webhook.ts" }).text, /handleWebhook/);
    h.db.close();
  });

  it("refuses to read outside the project root", () => {
    const h = harness("escape");
    const result = h.call("ctx_file_get", { path: "../../../etc/passwd" });

    assert.equal(result.isError, true);
    assert.match(result.text, /outside the project root/);
    h.db.close();
  });

  it("treats a LIKE wildcard in a query as a literal", () => {
    const h = harness("like");
    h.db
      .prepare(
        `INSERT INTO files (project_id, path, size, mtime, hash, language, item_type, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(h.projectId, "src/webhook.ts", 60, 0, "hash", "typescript", "source", "2026-08-01");

    // "%" must not match everything.
    assert.match(h.call("ctx_file_search", { query: "%" }).text, /No indexed file matches/);
    h.db.close();
  });
});
