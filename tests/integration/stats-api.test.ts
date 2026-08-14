import { strict as assert } from "node:assert";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { startApiServer, type ApiServer } from "@ctxd/api";
import { DEFAULT_CONFIG, ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { collectStats, windowSince } from "@ctxd/stats";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The token monitor endpoint (UI-7).
 *
 * The point of the route is that the interface stops doing arithmetic. So the
 * test that matters is not "does it return a number" but "does it return the
 * same number `ctxd stats` returns" — the two disagreeing is the failure mode
 * the route exists to remove.
 */

const home = createTempHome();
const paths = resolvePaths({ env: { CTXD_HOME: home.dir } });

let db: Db;
let api: ApiServer;

interface StatsResponse {
  readonly window: string;
  readonly scope: string;
  readonly since: string | null;
  readonly context: {
    readonly requests: number;
    readonly candidateTokens: number;
    readonly finalTokens: number;
    readonly avoidedTokens: number;
    readonly accuracy: string;
  };
  readonly change: { readonly reviews: number; readonly meanEfficiency?: number };
  readonly unreadable: readonly string[];
  readonly error?: string;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function writeContextReceipt(id: string, timestamp: string, candidate: number, final: number) {
  writeFileSync(
    join(paths.contextReceiptsDir, `${id}.json`),
    JSON.stringify({
      request_id: id,
      timestamp,
      project: "stats-project",
      task: "fixture",
      budget: 10_000,
      candidate_total_tokens: candidate,
      final_total_tokens: final,
      token_count_estimation: "estimated",
      removed_tokens: {
        duplicate_tokens: 0,
        irrelevant_tokens: candidate - final,
        low_priority_tokens: 0,
        compressed_tokens: 0,
      },
      included_items: [],
      excluded_items: [],
      warnings: [],
    }),
  );
}

before(async () => {
  ensureDataDir(paths);
  mkdirSync(paths.contextReceiptsDir, { recursive: true });
  mkdirSync(paths.changeReceiptsDir, { recursive: true });

  db = openDatabase(paths.dbFile);
  migrate(db);

  // One today, one four days back, one forty days back — enough to tell the
  // windows apart without any of them being empty by accident.
  writeContextReceipt("today", new Date().toISOString(), 50_000, 9_000);
  writeContextReceipt("recent", daysAgo(4), 30_000, 6_000);
  writeContextReceipt("old", daysAgo(40), 20_000, 5_000);

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

async function stats(query = ""): Promise<{ status: number; body: StatsResponse }> {
  const response = await fetch(`${api.url}/api/stats${query}`);
  return { status: response.status, body: (await response.json()) as StatsResponse };
}

describe("token monitor endpoint (UI-7)", () => {
  it("counts every receipt on disk by default", async () => {
    const { status, body } = await stats();
    assert.equal(status, 200);
    assert.equal(body.window, "all");
    assert.equal(body.since, null);
    assert.equal(body.context.requests, 3);
    assert.equal(body.context.candidateTokens, 100_000);
    assert.equal(body.context.finalTokens, 20_000);
    assert.equal(body.context.avoidedTokens, 80_000);
  });

  it("agrees exactly with what ctxd stats computes", async () => {
    const { body } = await stats("?window=7d");
    const direct = collectStats({
      contextReceiptsDir: paths.contextReceiptsDir,
      changeReceiptsDir: paths.changeReceiptsDir,
      since: windowSince("7d"),
    });

    // The whole reason the route exists: one implementation, so the panel and
    // the command cannot report different totals for the same receipts.
    assert.equal(body.context.requests, direct.context.requests);
    assert.equal(body.context.candidateTokens, direct.context.candidateTokens);
    assert.equal(body.context.avoidedTokens, direct.context.avoidedTokens);
  });

  it("narrows to the requested window", async () => {
    const week = await stats("?window=7d");
    const month = await stats("?window=30d");
    const all = await stats("?window=all");

    assert.equal(week.body.context.requests, 2);
    assert.equal(month.body.context.requests, 2);
    assert.equal(all.body.context.requests, 3);

    // Each window states its own cutoff, so a reader can tell what a figure
    // covers without recomputing it.
    assert.notEqual(week.body.since, null);
    assert.equal(week.body.scope, "last 7 days");
  });

  it("labels the counting method rather than implying precision", async () => {
    const { body } = await stats("?window=all");
    // §18/§49: a heuristic tokenizer produces estimates, and every surface
    // that shows the number has to say so.
    assert.equal(body.context.accuracy, "estimated");
  });

  it("reports unknown mean efficiency rather than zero with no reviews", async () => {
    const { body } = await stats("?window=all");
    assert.equal(body.change.reviews, 0);
    // 0.00 would read as "every change was unfocused", which is a claim about
    // changes that were never reviewed (§37).
    assert.equal(body.change.meanEfficiency, undefined);
  });

  it("rejects a window it does not define instead of guessing one", async () => {
    const { status, body } = await stats("?window=last-fortnight");
    assert.equal(status, 400);
    assert.match(body.error ?? "", /window/);
  });

  it("names a receipt it could not read rather than dropping it silently", async () => {
    writeFileSync(join(paths.contextReceiptsDir, "corrupt.json"), "{ this is not json");

    const { body } = await stats("?window=all");
    // The total is now incomplete. Saying which file is missing is what keeps
    // an incomplete number from passing as a wrong one.
    assert.equal(body.unreadable.length, 1);
    assert.match(body.unreadable[0] ?? "", /corrupt\.json$/);
    assert.equal(body.context.requests, 3);
  });
});
