import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { emitEvent } from "@ctxd/events";
import { countMemories, saveMemory } from "@ctxd/memory";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The graph endpoint (§4, UI-3).
 *
 * The graph is assembled server-side so the interface lays out a decision
 * rather than making one. These tests pin the part that matters: a node with no
 * evidence behind it reports that, rather than a plausible number.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;

const PROJECT = "graph-project";

interface Graph {
  core: { version: string; mode: string; workersAttached: number; workersKnown: number };
  context: { candidateTokens: number | null; finalTokens: number | null; accuracy: string };
  memory: { total: number; byType: Record<string, number> };
  repository: { git: string };
  verification: { status: string; at: string | null; source: string };
  tasks: { total: number; inProgress: number };
  workers: { id: string; connection: string; openEnded: boolean }[];
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

async function graph(): Promise<Graph> {
  const response = await fetch(`${api.url}/api/graph`);
  assert.equal(response.status, 200);
  return (await response.json()) as Graph;
}

describe("engineering graph (§4)", () => {
  it("reports unknown for context before any receipt exists", async () => {
    const data = await graph();

    // No context has been built, so there are no token counts. Zero would read
    // as "nothing was avoided", which is a different and false claim (§37).
    assert.equal(data.context.candidateTokens, null);
    assert.equal(data.context.finalTokens, null);
    assert.equal(data.context.accuracy, "unknown");
  });

  it("reports verification as unknown when none has been recorded", async () => {
    const data = await graph();
    assert.equal(data.verification.status, "unknown");
    assert.equal(data.verification.at, null);
    assert.equal(data.verification.source, "none");
  });

  it("counts memory from the database, not from a capped listing", async () => {
    for (let index = 0; index < 60; index += 1) {
      saveMemory(db, {
        projectId: PROJECT,
        type: "fact",
        title: `memory ${index}`,
        content: `content ${index}`,
        source: "worker_statement",
      });
    }

    const data = await graph();
    // The listing route caps at 50. A count taken from a listing would report
    // the cap and stop being true exactly when the project outgrew it.
    assert.equal(data.memory.total, 60);
    assert.equal(countMemories(db, PROJECT).total, 60);
  });

  it("breaks memory down by type", async () => {
    const data = await graph();
    assert.equal(data.memory.byType["fact"], 60);
  });

  it("reports no workers before any event names one", async () => {
    const data = await graph();
    assert.deepEqual(data.workers, []);
    assert.equal(data.core.workersAttached, 0);
  });

  it("shows a worker once the log has seen it", async () => {
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });

    const data = await graph();
    const claude = data.workers.find((worker) => worker.id === "claude");
    assert.equal(claude?.connection, "connected");
    assert.equal(claude?.openEnded, true);
    assert.equal(data.core.workersAttached, 1);
  });

  it("stops counting a worker as attached once it leaves", async () => {
    emitEvent(db, { projectId: PROJECT, type: "worker_disconnected", worker: "claude" });

    const data = await graph();
    assert.equal(data.core.workersAttached, 0);
    assert.equal(data.core.workersKnown, 1);
  });

  it("reports the real Git state rather than a placeholder", async () => {
    const data = await graph();
    assert.equal(typeof data.repository.git, "string");
    assert.notEqual(data.repository.git, "");
  });
});
