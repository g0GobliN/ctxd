import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { DEFAULT_CONFIG, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { readEvents } from "@ctxd/events";
import { detectProject, upsertProject } from "@ctxd/project";
import { createTools, type ToolDefinition } from "@ctxd/mcp";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * MCP as an event producer (§6, §7).
 *
 * The MCP process is where worker activity is observable, so it is the first
 * producer. What it may claim is deliberately narrow.
 */

const home = createTempHome();
after(() => home.cleanup());

let counter = 0;

interface Harness {
  readonly db: Db;
  readonly projectId: string;
  call(name: string, args?: Record<string, unknown>): { text: string; isError?: boolean };
}

function harness(name: string, worker?: string, register = true): Harness {
  const root = join(home.dir, `events-${name}`);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: `events-${name}` }));
  writeFileSync(
    join(root, "src/webhook.ts"),
    "export function handleWebhook() { return 'stripe idempotency'; }",
  );

  const db = openDatabase(join(home.dir, `events-${name}-${(counter += 1)}.db`));
  migrate(db);

  const detected = detectProject(root);
  const projectId = register ? upsertProject(db, detected).id : "";

  const tools = new Map(
    createTools({
      db,
      paths: resolvePaths({ env: { CTXD_HOME: home.dir } }),
      config: DEFAULT_CONFIG,
      cwd: root,
      worker,
    }).map((tool: ToolDefinition) => [tool.name, tool]),
  );

  return {
    db,
    projectId,
    call(toolName, args = {}) {
      const tool = tools.get(toolName);
      if (tool === undefined) throw new Error(`no such tool: ${toolName}`);
      return tool.handler({ dir: root, ...args });
    },
  };
}

describe("MCP event production (§7)", () => {
  it("records a context request and what it produced", () => {
    const h = harness("context", "claude");
    h.call("ctx_context_build", { task: "fix stripe webhook idempotency" });

    const types = readEvents(h.db, h.projectId).map((event) => event.type);
    assert.deepEqual(types, ["context_requested", "context_built"]);
    h.db.close();
  });

  it("carries counts, never the assembled context", () => {
    const h = harness("payload", "claude");
    h.call("ctx_context_build", { task: "fix stripe webhook idempotency" });

    const built = readEvents(h.db, h.projectId).find((event) => event.type === "context_built");
    assert.ok(built !== undefined);
    assert.equal(typeof built.data["candidateTokens"], "number");
    assert.equal(typeof built.data["finalTokens"], "number");

    // Every local process can read the stream. The context is the one thing
    // here worth exfiltrating, so it stays out of the payload entirely.
    const serialised = JSON.stringify(built.data);
    assert.doesNotMatch(serialised, /handleWebhook/);
    assert.doesNotMatch(serialised, /export function/);
    h.db.close();
  });

  it("attributes activity to the worker the developer configured", () => {
    const h = harness("claimed", "cursor");
    h.call("ctx_context_build", { task: "add a retry" });

    const events = readEvents(h.db, h.projectId);
    assert.equal(events[0]?.worker, "cursor");
    h.db.close();
  });

  it("records no worker when none was configured", () => {
    const h = harness("unclaimed");
    h.call("ctx_context_build", { task: "add a retry" });

    // §37: a default of "claude" would be a guess. UNKNOWN is the honest value,
    // and null is how the log says UNKNOWN.
    const events = readEvents(h.db, h.projectId);
    assert.equal(events[0]?.worker, null);
    h.db.close();
  });

  it("still serves a tool call when there is no project to log against", () => {
    const h = harness("unregistered", "claude", false);
    const result = h.call("ctx_context_build", { task: "fix the webhook" });

    // No registered project means no foreign key, so nothing is recorded. The
    // work must still happen: the log is a side record, not a precondition.
    assert.notEqual(result.isError, true);
    h.db.close();
  });

  it("does not fail a tool call when the log cannot be written", () => {
    const h = harness("broken-log", "claude");
    h.db.exec("DROP TABLE events");

    const result = h.call("ctx_context_build", { task: "fix the webhook" });

    assert.notEqual(result.isError, true);
    assert.match(result.text, /Context Receipt|CONTEXT RECEIPT|included/i);
    h.db.close();
  });
});
