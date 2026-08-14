import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { emitEvent } from "@ctxd/events";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The event stream over a real socket (§7).
 *
 * Driven through HTTP rather than by calling the handler, because the parts
 * worth testing are the ones a unit test would skip: whether a cursor survives
 * a reconnect, whether the server can still shut down with a stream open, and
 * whether an event written by a *different process* actually arrives.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;

const PROJECT = "stream-project";

before(async () => {
  ensureDataDir(paths);
  db = openDatabase(paths.dbFile);
  migrate(db);
  db.prepare(
    "INSERT INTO projects (id, root, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(PROJECT, home.dir, "fixture", "2026-01-01", "2026-01-01");

  api = await startApiServer({
    db,
    paths,
    config: DEFAULT_CONFIG,
    dir: process.cwd(),
    host: "127.0.0.1",
    port: 0,
    token: "test-token-not-a-real-secret",
  });
});

after(async () => {
  await api?.close();
  db?.close();
  home.cleanup();
});

/**
 * Open the stream and collect frames until `until` is satisfied.
 *
 * Always aborts before resolving: a test that leaves a stream open does not
 * fail the runner, it hangs it.
 */
async function collect(
  path: string,
  until: (text: string) => boolean,
  headers: Record<string, string> = {},
  timeoutMs = 5_000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${api.url}${path}`, {
      headers: { accept: "text/event-stream", ...headers },
      signal: controller.signal,
    });
    assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");

    const reader = response.body?.getReader();
    assert.ok(reader !== undefined);

    const decoder = new TextDecoder();
    let text = "";
    while (!until(text)) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    return text;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

describe("event stream (§7)", () => {
  it("opens with a comment, so the client knows it is connected", async () => {
    const text = await collect("/api/events", (seen) => seen.includes("connected at event"));
    assert.match(text, /: connected at event \d+/);
  });

  it("tells the browser how long to wait before reconnecting", async () => {
    const text = await collect("/api/events", (seen) => seen.includes("retry:"));
    assert.match(text, /retry: \d+/);
  });

  it("delivers an event written after the client subscribed", async () => {
    const stream = collect("/api/events", (seen) => seen.includes("event: context_built"));

    // Give the subscription a moment to establish before the write, so this
    // tests live delivery rather than replay.
    await new Promise((resolve) => setTimeout(resolve, 200));
    emitEvent(db, {
      projectId: PROJECT,
      type: "context_built",
      worker: "claude",
      data: { candidateTokens: 51_000, finalTokens: 9_000 },
    });

    const text = await stream;
    assert.match(text, /event: context_built/);
    assert.match(text, /"finalTokens":9000/);
  });

  it("delivers an event emitted by a different process", async () => {
    // The whole reason the log goes through SQLite (§7.1). MCP and the CLI are
    // separate processes from the API, so a stream that only sees in-process
    // emissions would be useless in the one case it exists for.
    const stream = collect("/api/events", (seen) => seen.includes("event: worker_connected"));
    await new Promise((resolve) => setTimeout(resolve, 200));

    const script = `
      import { openDatabase } from "@ctxd/db";
      import { emitEvent } from "@ctxd/events";
      const db = openDatabase(${JSON.stringify(paths.dbFile)});
      emitEvent(db, {
        projectId: ${JSON.stringify(PROJECT)},
        type: "worker_connected",
        worker: "cursor",
      });
      db.close();
    `;
    execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      stdio: "pipe",
    });

    const text = await stream;
    assert.match(text, /event: worker_connected/);
    assert.match(text, /"claimedWorker":"cursor"/);
  });

  it("presents the worker as claimed, never as verified", async () => {
    const stream = collect("/api/events", (seen) => seen.includes("event: worker_error"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    emitEvent(db, { projectId: PROJECT, type: "worker_error", worker: "claude" });

    const text = await stream;
    // The field name carries the caveat: nothing downstream can mistake a
    // self-declared name for an identity ctxd verified (§6).
    assert.match(text, /"claimedWorker":"claude"/);
    assert.doesNotMatch(text, /"worker":"claude"/);
  });

  it("replays only what a reconnecting client missed", async () => {
    const first = emitEvent(db, { projectId: PROJECT, type: "task_updated" });
    emitEvent(db, { projectId: PROJECT, type: "memory_updated" });

    // What a browser sends automatically after a dropped connection.
    const text = await collect(
      "/api/events",
      (seen) => seen.includes("event: memory_updated"),
      { "last-event-id": String(first.id) },
    );

    assert.match(text, /event: memory_updated/);
    assert.doesNotMatch(text, /event: task_updated/);
  });

  it("starts at the present when no cursor is given", async () => {
    // Written before anyone subscribes, so it belongs to history.
    emitEvent(db, { projectId: PROJECT, type: "checkpoint_created" });

    const stream = collect("/api/events", (seen) => seen.includes("event: change_analyzed"));
    await new Promise((resolve) => setTimeout(resolve, 200));
    emitEvent(db, { projectId: PROJECT, type: "change_analyzed" });

    const text = await stream;
    assert.match(text, /event: change_analyzed/);
    // History is a separate request; a fresh subscriber does not replay the log.
    assert.doesNotMatch(text, /event: checkpoint_created/);
  });

  it("accepts an explicit cursor", async () => {
    const marker = emitEvent(db, { projectId: PROJECT, type: "verification_started" });
    emitEvent(db, { projectId: PROJECT, type: "verification_finished" });

    const text = await collect(`/api/events?after=${marker.id}`, (seen) =>
      seen.includes("event: verification_finished"),
    );
    assert.match(text, /event: verification_finished/);
  });

  it("rejects a cursor that is not an event id", async () => {
    const response = await fetch(`${api.url}/api/events?after=yesterday`);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /after/);
  });

  it("serves recent events as ordinary JSON for the initial load", async () => {
    const response = await fetch(`${api.url}/api/events/recent?limit=5`);
    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      events: { id: number; type: string; claimedWorker: string | null }[];
      latestId: number;
    };
    assert.ok(body.events.length > 0);
    assert.ok(body.latestId > 0);
    // Newest first, so the panel renders without re-sorting.
    assert.ok((body.events[0]?.id ?? 0) >= (body.events[1]?.id ?? 0));
  });

  it("does not require a token, like every other read", async () => {
    const response = await fetch(`${api.url}/api/events/recent`);
    assert.equal(response.status, 200);
  });

  it("shuts down cleanly with a stream open", async () => {
    // The failure this guards against is `ctxd ui` hanging on exit because a
    // browser tab is still attached.
    const controller = new AbortController();
    const response = await fetch(`${api.url}/api/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    assert.ok(reader !== undefined);
    await reader.read();

    const separate = await startApiServer({
      db,
      paths,
      config: DEFAULT_CONFIG,
      dir: process.cwd(),
      host: "127.0.0.1",
      port: 0,
      token: "test-token-not-a-real-secret",
    });

    const streamed = await fetch(`${separate.url}/api/events`, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal,
    });
    assert.equal(streamed.status, 200);

    const closed = await Promise.race([
      separate.close().then(() => "closed" as const),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 3_000)),
    ]);

    controller.abort();
    assert.equal(closed, "closed");
  });
});
