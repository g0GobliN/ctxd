import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { emitEvent } from "@ctxd/events";
import {
  activeElements,
  applyPulse,
  elementsForEvent,
  HIGHLIGHT_MS,
  workerEdgeKey,
  workerKey,
  type Pulses,
} from "../../packages/ui/src/live.ts";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The live graph (UI-4).
 *
 * The exit criterion is that a *real* worker event visibly changes the graph,
 * so these tests start at the producer and end at the mapping the renderer
 * consumes. Events are emitted through `@ctxd/events` and read back over the
 * HTTP route the browser actually calls, rather than being hand-written as
 * fixtures — a fixture would prove the mapping is self-consistent and nothing
 * about whether it matches what ctxd emits.
 *
 * What is not asserted here is pixels. The renderer turns an element key into a
 * class; the decision of *which* keys light up is the part that can be wrong in
 * a way that misleads, and that is the part under test.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;

const PROJECT = "live-graph-project";

/** The wire shape `/api/events` and `/api/events/recent` produce. */
interface WireEvent {
  readonly id: number;
  readonly type: string;
  readonly timestamp: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly taskId: string | null;
  readonly claimedWorker: string | null;
  readonly data: Record<string, string | number | boolean | null>;
}

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

/** Read the log back the way the interface does. */
async function delivered(): Promise<WireEvent[]> {
  const response = await fetch(`${api.url}/api/events/recent?limit=50`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as { events: WireEvent[] };
  return payload.events;
}

async function newest(type: string): Promise<WireEvent> {
  const found = (await delivered()).find((event) => event.type === type);
  assert.ok(found !== undefined, `no ${type} event was delivered`);
  return found;
}

describe("live graph (UI-4)", () => {
  it("lights the worker that a real transport event names", async () => {
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });

    const event = await newest("worker_connected");
    const lit = elementsForEvent(event);

    // The path a connection actually takes: the worker, its edge, and the core
    // it attached to. Memory is not touched by attaching, so it stays dark.
    assert.ok(lit.includes(workerKey("claude")));
    assert.ok(lit.includes(workerEdgeKey("claude")));
    assert.ok(lit.includes("core"));
    assert.ok(!lit.includes("memory"));
  });

  it("lights the retrieval edge when context is built", async () => {
    emitEvent(db, {
      projectId: PROJECT,
      type: "context_built",
      worker: "claude",
      data: { candidateTokens: 42_000, finalTokens: 8_000 },
    });

    const lit = elementsForEvent(await newest("context_built"));
    assert.ok(lit.includes("memory"));
    assert.ok(lit.includes("edge:memory"));
    assert.ok(lit.includes("core"));
    // Retrieval runs no checks, so claiming the verification path carried
    // traffic would be drawing something that did not happen.
    assert.ok(!lit.includes("verification"));
  });

  it("lights verification, not the repository, when a run is recorded", async () => {
    emitEvent(db, { projectId: PROJECT, type: "verification_finished", worker: "claude" });

    const lit = elementsForEvent(await newest("verification_finished"));
    assert.ok(lit.includes("verification"));
    assert.ok(lit.includes("edge:verification"));
    assert.ok(!lit.includes("repository"));
  });

  it("lights the repository when a change is analysed", async () => {
    emitEvent(db, { projectId: PROJECT, type: "change_analyzed", worker: "claude" });

    const lit = elementsForEvent(await newest("change_analyzed"));
    assert.ok(lit.includes("repository"));
    assert.ok(lit.includes("edge:repository"));
    // `ctxd diff` inspects the tree; it runs nothing. Lighting verification
    // here would imply a check that never ran.
    assert.ok(!lit.includes("verification"));
  });

  it("attributes nothing to a worker when the event names none", async () => {
    emitEvent(db, { projectId: PROJECT, type: "context_requested" });

    const event = await newest("context_requested");
    assert.equal(event.claimedWorker, null);

    const lit = elementsForEvent(event);
    assert.ok(lit.includes("core"));
    // §37: an unattributed event lights no worker. Picking whichever worker is
    // on screen would invent the attribution the producer declined to make.
    assert.ok(!lit.some((key) => key.startsWith("worker:")));
    assert.ok(!lit.some((key) => key.startsWith("edge:worker:")));
  });

  it("holds a pulse briefly and then lets it go", async () => {
    const event = await newest("worker_connected");
    const at = 1_000_000;

    const pulses: Pulses = applyPulse(new Map(), event, at);

    assert.ok(activeElements(pulses, at).has(workerKey("claude")));
    assert.ok(activeElements(pulses, at + HIGHLIGHT_MS - 1).has(workerKey("claude")));

    // Once the window closes the graph is still again. A pulse that never
    // expired would leave the picture claiming activity long after it stopped.
    assert.equal(activeElements(pulses, at + HIGHLIGHT_MS).size, 0);
  });

  it("keeps the newest pulse when the same element fires twice", async () => {
    const first = await newest("worker_connected");
    const second = await newest("context_built");

    let pulses: Pulses = applyPulse(new Map(), first, 1_000);
    pulses = applyPulse(pulses, second, 1_000 + HIGHLIGHT_MS - 10);

    // The core was touched by both. It stays lit from the later one rather
    // than expiring on the earlier one's schedule.
    assert.ok(activeElements(pulses, 1_000 + HIGHLIGHT_MS + 5).has("core"));
  });
});
