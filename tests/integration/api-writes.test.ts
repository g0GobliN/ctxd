import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { detectProject, upsertProject } from "@ctxd/project";
import { getMemory, saveMemory } from "@ctxd/memory";
import { getTask } from "@ctxd/work";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The mutating routes added in 2.1 (writes.ts).
 *
 * Driven over a real socket for the same reason as api.test.ts: the token gate
 * and the status codes are most of what is worth asserting, and both live in
 * the transport.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;
let projectId: string;
let root: string;

const TOKEN = "test-token-not-a-real-secret";

before(async () => {
  ensureDataDir(paths);
  db = openDatabase(paths.dbFile);
  migrate(db);

  root = mkdtempSync(join(tmpdir(), "ctxd-api-writes-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture" }));
  projectId = upsertProject(db, detectProject(root)).id;

  api = await startApiServer({
    db,
    paths,
    config: DEFAULT_CONFIG,
    dir: root,
    host: "127.0.0.1",
    port: 0,
    token: TOKEN,
  });
});

after(async () => {
  await api?.close();
  db?.close();
  home.cleanup();
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

/**
 * `null` means "send no token"; omitting the argument sends the real one.
 *
 * Deliberately not `undefined`: a default parameter treats an explicitly passed
 * `undefined` as absent, so `send(..., undefined)` would have sent the token
 * and every no-token assertion would have passed while testing nothing.
 */
async function send(
  method: string,
  path: string,
  body: unknown,
  token: string | null = TOKEN,
): Promise<Response> {
  return fetch(`${api.url}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
}

describe("the token gate covers every write (§62)", () => {
  it("refuses each mutating route without the token", async () => {
    const routes: [string, string, unknown][] = [
      ["POST", "/api/memory", { title: "t", content: "c" }],
      ["POST", "/api/tasks", { title: "t" }],
      ["PATCH", "/api/tasks", { id: "x", status: "DONE" }],
      ["POST", "/api/session", {}],
      ["POST", "/api/checkpoint", {}],
    ];

    for (const [method, path, body] of routes) {
      const response = await send(method, path, body, null);
      assert.equal(response.status, 401, `${method} ${path} should require the token`);
    }
  });

  it("does not leak the token in the refusal", async () => {
    const response = await send("POST", "/api/memory", { title: "t", content: "c" }, null);
    const text = await response.text();
    assert.ok(!text.includes(TOKEN), "the refusal must not echo the expected token");
  });
});

describe("POST /api/memory", () => {
  it("records a memory the CLI would record identically", async () => {
    const response = await send("POST", "/api/memory", {
      title: "Retry with exponential backoff",
      content: "Fixed intervals caused a thundering herd under load.",
      type: "DECISION",
      source: "accepted_decision",
      tags: ["retry", "load"],
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as { outcome: string; memory: { id: string } };
    assert.equal(payload.outcome, "created");

    // Present in the store, not merely echoed back by the handler.
    const stored = getMemory(db, payload.memory.id);
    assert.ok(stored !== undefined);
    assert.equal(stored?.type, "DECISION");
    assert.equal(stored?.source, "accepted_decision");
  });

  it("accepts a source the MCP surface refuses a worker", async () => {
    // The distinction 2.1 rests on: holding the local token is the developer's
    // authority, not a worker's claim. See writes.ts.
    const response = await send("POST", "/api/memory", {
      title: "Uses SQLite with FTS5",
      content: "Confirmed by reading packages/db.",
      type: "NOTE",
      source: "verified_code",
    });
    assert.equal(response.status, 200);
  });

  it("reports an authority refusal as 409 with its reason", async () => {
    // A rule the developer stated, which a lower-authority write must not
    // overwrite.
    saveMemory(db, {
      projectId,
      type: "RULE",
      title: "Never edit generated files",
      content: "They are rewritten by the build.",
      source: "accepted_decision",
    });

    const response = await send("POST", "/api/memory", {
      title: "Never edit generated files",
      content: "Actually it is fine to edit them.",
      type: "RULE",
      source: "inferred",
    });

    assert.equal(response.status, 409);
    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /refused/i);
    assert.match(payload.error, /higher authority/i);
  });

  it("rejects an unknown source rather than silently defaulting", async () => {
    const response = await send("POST", "/api/memory", {
      title: "t",
      content: "c",
      source: "vibes",
    });
    assert.equal(response.status, 400);
  });

  it("requires a title and content", async () => {
    assert.equal((await send("POST", "/api/memory", { content: "c" })).status, 400);
    assert.equal((await send("POST", "/api/memory", { title: "t" })).status, 400);
  });
});

describe("tasks", () => {
  it("creates a task and then moves it", async () => {
    const created = await send("POST", "/api/tasks", {
      title: "Fix the webhook retry logic",
      priority: "P1",
    });
    assert.equal(created.status, 200);
    const task = (await created.json()) as { id: string; status: string };
    assert.equal(task.status, "BACKLOG");

    const moved = await send("PATCH", "/api/tasks", { id: task.id, status: "IN_PROGRESS" });
    assert.equal(moved.status, 200);

    assert.equal(getTask(db, task.id)?.status, "IN_PROGRESS");
  });

  it("leaves omitted fields alone on a PATCH", async () => {
    const created = await send("POST", "/api/tasks", {
      title: "Keep my description",
      description: "the original",
    });
    const task = (await created.json()) as { id: string };

    await send("PATCH", "/api/tasks", { id: task.id, status: "REVIEW" });

    const stored = getTask(db, task.id);
    assert.equal(stored?.description, "the original");
    assert.equal(stored?.status, "REVIEW");
  });

  it("refuses a status outside the known set", async () => {
    const created = await send("POST", "/api/tasks", { title: "t" });
    const task = (await created.json()) as { id: string };

    const response = await send("PATCH", "/api/tasks", { id: task.id, status: "ALMOST_DONE" });
    assert.equal(response.status, 400);
  });

  it("refuses a PATCH that changes nothing", async () => {
    const created = await send("POST", "/api/tasks", { title: "t" });
    const task = (await created.json()) as { id: string };

    const response = await send("PATCH", "/api/tasks", { id: task.id });
    assert.equal(response.status, 400);
  });

  it("reports an unknown task as 404", async () => {
    const response = await send("PATCH", "/api/tasks", { id: "no-such-task", status: "DONE" });
    assert.equal(response.status, 404);
  });
});

describe("sessions and checkpoints", () => {
  it("starts a session and returns the same one when called twice", async () => {
    const first = await send("POST", "/api/session", { worker: "claude" });
    assert.equal(first.status, 200);
    const one = (await first.json()) as { id: string };

    const second = await send("POST", "/api/session", { worker: "claude" });
    const two = (await second.json()) as { id: string };

    // A project has at most one open session; a second start must not split
    // activity across two records.
    assert.equal(two.id, one.id);
  });

  it("records a checkpoint against the project root", async () => {
    const response = await send("POST", "/api/checkpoint", {
      next: "Fix the 409 path then rerun tests",
      worker: "claude",
    });
    assert.equal(response.status, 200);

    const checkpoint = (await response.json()) as { id: string; nextAction?: string };
    assert.ok(checkpoint.id);
  });
});

describe("POST /api/projects", () => {
  it("registers a directory, then reports a re-register as refreshed", async () => {
    const fresh = mkdtempSync(join(tmpdir(), "ctxd-api-init-"));
    writeFileSync(join(fresh, "package.json"), JSON.stringify({ name: "registered-here" }));

    try {
      const first = await send("POST", "/api/projects", { dir: fresh });
      assert.equal(first.status, 200);
      const registered = (await first.json()) as {
        outcome: string;
        project: { id: string; name: string };
        indexed?: { total: number };
      };
      assert.equal(registered.outcome, "registered");
      assert.equal(registered.project.name, "registered-here");
      assert.ok((registered.indexed?.total ?? 0) >= 1);

      // The same directory again is a refresh, not a second project.
      const second = await send("POST", "/api/projects", { dir: fresh });
      const refreshed = (await second.json()) as { outcome: string; project: { id: string } };
      assert.equal(refreshed.outcome, "refreshed");
      assert.equal(refreshed.project.id, registered.project.id);
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });

  it("reports a directory that does not exist rather than registering nothing", async () => {
    const response = await send("POST", "/api/projects", {
      dir: join(tmpdir(), "ctxd-definitely-not-here-9f3a"),
    });
    assert.equal(response.status, 400);
  });

  it("requires the token, since it reads a directory the caller names", async () => {
    const response = await send("POST", "/api/projects", { dir: root }, null);
    assert.equal(response.status, 401);
  });
});

describe("POST /api/verify", () => {
  it("reports what would run without running it", async () => {
    // dryRun keeps the suite from shelling out to the fixture's scripts, and
    // is also the honest default for "show me what verification means here".
    const response = await send("POST", "/api/verify", { dryRun: true });
    assert.equal(response.status, 200);

    const result = (await response.json()) as { status: string; checks: unknown[] };
    assert.ok(typeof result.status === "string");
    assert.ok(Array.isArray(result.checks));
  });

  it("refuses a check kind it does not know", async () => {
    const response = await send("POST", "/api/verify", { dryRun: true, only: ["deploy"] });
    assert.equal(response.status, 400);
  });

  it("requires the token, since it runs the project's commands", async () => {
    const response = await send("POST", "/api/verify", { dryRun: true }, null);
    assert.equal(response.status, 401);
  });
});

describe("POST /api/handoff", () => {
  it("assembles a handoff without moving anything when no worker is named", async () => {
    const response = await send("POST", "/api/handoff", {});
    assert.equal(response.status, 200);

    const payload = (await response.json()) as { moved: boolean; handoff: unknown };
    assert.equal(payload.moved, false);
    assert.ok(payload.handoff !== undefined);
  });

  it("moves the work when a worker is named, and reports what it could not do", async () => {
    const created = await send("POST", "/api/tasks", { title: "Hand this over" });
    const task = (await created.json()) as { id: string };

    const response = await send("POST", "/api/handoff", {
      to: "cursor",
      task: task.id,
      note: "the 409 path is the remaining bit",
    });
    assert.equal(response.status, 200);

    const payload = (await response.json()) as {
      moved: boolean;
      toWorker: string;
      warnings: readonly string[];
    };
    assert.equal(payload.moved, true);
    assert.equal(payload.toWorker, "cursor");
    // Warnings are part of the answer, not swallowed.
    assert.ok(Array.isArray(payload.warnings));
  });

  it("refuses an empty worker name rather than recording a move to nobody", async () => {
    const response = await send("POST", "/api/handoff", { to: "   " });
    const payload = (await response.json()) as { moved: boolean };
    assert.equal(payload.moved, false, "a blank worker must not count as naming one");
  });
});

describe("project scoping", () => {
  it("reports an unknown project id rather than writing to the default", async () => {
    const response = await send("POST", "/api/memory", {
      project: "not-a-real-project",
      title: "t",
      content: "c",
    });
    assert.equal(response.status, 404);
  });

  it("writes to the project at the served directory, not the first registered one", async () => {
    // The bug this pins: resolving an absent project to "the first registered
    // row" is harmless for a read and wrong for a write. A server inspecting
    // one repository must not file memory against another.
    const other = mkdtempSync(join(tmpdir(), "ctxd-api-writes-other-"));
    writeFileSync(join(other, "package.json"), JSON.stringify({ name: "other" }));
    const otherId = upsertProject(db, detectProject(other)).id;

    let scoped: ApiServer | undefined;
    try {
      assert.notEqual(otherId, projectId, "the fixtures must be distinct projects");

      scoped = await startApiServer({
        db,
        paths,
        config: DEFAULT_CONFIG,
        dir: other,
        host: "127.0.0.1",
        port: 0,
        token: TOKEN,
      });

      const response = await fetch(`${scoped.url}/api/memory`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ title: "Scoped to the served directory", content: "c" }),
      });
      assert.equal(response.status, 200);

      const payload = (await response.json()) as { memory: { id: string } };
      assert.equal(
        getMemory(db, payload.memory.id)?.projectId,
        otherId,
        "the write must land in the project the server was pointed at",
      );
    } finally {
      await scoped?.close();
      rmSync(other, { recursive: true, force: true });
    }
  });
});
