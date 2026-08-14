import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { emitEvent, EVENT_TYPES } from "@ctxd/events";
import {
  detailFor,
  labelFor,
  LABELS,
  mergeEvents,
} from "../../packages/ui/src/activity-format.ts";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The activity stream (UI-5).
 *
 * Exit criterion: every displayed line corresponds to a real stored event.
 * Two halves to that, and both are checked here — nothing the core emits goes
 * unrendered, and nothing renders that the core does not emit.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;

const PROJECT = "activity-project";

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

async function delivered(limit = 200): Promise<WireEvent[]> {
  const response = await fetch(`${api.url}/api/events/recent?limit=${limit}`);
  assert.equal(response.status, 200);
  return ((await response.json()) as { events: WireEvent[] }).events;
}

describe("activity stream (UI-5)", () => {
  it("has wording for every event type the core can emit", () => {
    for (const type of EVENT_TYPES) {
      assert.ok(
        LABELS[type] !== undefined,
        `${type} can be stored but the stream has no wording for it`,
      );
    }
  });

  it("carries no wording for an event type nothing emits", () => {
    const known = new Set<string>(EVENT_TYPES);
    for (const type of Object.keys(LABELS)) {
      // A label with no producer behind it is a line the interface is prepared
      // to show and ctxd can never justify. Removing the producer without
      // removing the label is exactly how that happens.
      assert.ok(known.has(type), `the stream words "${type}", which nothing emits`);
    }
  });

  it("shows an unrecognised type rather than dropping the event", () => {
    // The event happened. Hiding it because this build has no wording would
    // make the stream quietly incomplete.
    assert.equal(labelFor("something_a_later_version_emits"), "something_a_later_version_emits");
  });

  it("renders one line per stored event and no more", async () => {
    emitEvent(db, { projectId: PROJECT, type: "worker_connected", worker: "claude" });
    emitEvent(db, {
      projectId: PROJECT,
      type: "context_built",
      worker: "claude",
      data: { candidateTokens: 51_200, finalTokens: 9_100 },
    });
    emitEvent(db, { projectId: PROJECT, type: "worker_disconnected", worker: "claude" });

    const stored = await delivered();
    const rendered = mergeEvents([], stored, 200);

    assert.equal(rendered.length, stored.length);
    assert.deepEqual(
      rendered.map((event) => event.id),
      stored.map((event) => event.id),
    );
  });

  it("never shows one event twice when history and stream overlap", async () => {
    const stored = await delivered();
    const overlapping = stored[0];
    assert.ok(overlapping !== undefined);

    // The stream opens while the history request is in flight, so the same row
    // arrives twice. Two lines would read as two things having happened.
    const rendered = mergeEvents([overlapping], stored, 200);
    assert.equal(rendered.length, stored.length);
    assert.equal(rendered.filter((event) => event.id === overlapping.id).length, 1);
  });

  it("reports the reduction from the numbers the event actually carries", async () => {
    const built = (await delivered()).find((event) => event.type === "context_built");
    assert.ok(built !== undefined);

    const detail = detailFor(built);
    assert.ok(detail !== undefined);
    assert.match(detail, /51,200/);
    assert.match(detail, /9,100/);
    // §18/§49: never presented as an exact billing figure.
    assert.match(detail, /estimated/);
  });

  it("says nothing rather than something generic when the event carries nothing", async () => {
    emitEvent(db, { projectId: PROJECT, type: "checkpoint_created", worker: "claude" });

    const event = (await delivered()).find((entry) => entry.type === "checkpoint_created");
    assert.ok(event !== undefined);
    assert.deepEqual(event.data, {});
    assert.equal(detailFor(event), undefined);
  });

  it("distinguishes a check that failed from one that could not run", async () => {
    emitEvent(db, {
      projectId: PROJECT,
      type: "verification_finished",
      worker: "claude",
      data: { status: "NEEDS_REVIEW", checks: 5, failed: 0, unavailable: 2 },
    });

    const event = (await delivered()).find((entry) => entry.type === "verification_finished");
    assert.ok(event !== undefined);

    const detail = detailFor(event);
    assert.ok(detail !== undefined);
    assert.match(detail, /NEEDS_REVIEW/);
    // Folding "could not run" into "passed" is the failure §58 exists to stop.
    assert.match(detail, /2 unavailable/);
  });
});
