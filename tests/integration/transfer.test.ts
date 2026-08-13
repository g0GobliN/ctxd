import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * Export and import (§74).
 *
 * The promise is that knowledge can leave. So these tests move it: export from
 * one ctxd home, import into a second, empty one, and check it arrived — which
 * is the only way to prove there is no lock-in.
 *
 * The CLI is driven as a subprocess because the round trip is the product;
 * calling the functions directly would skip the part a user relies on.
 */

const CLI = fileURLToPath(new URL("../../packages/cli/dist/index.js", import.meta.url));

const source = createTempHome();
const destination = createTempHome();

let projectA: string;
let projectB: string;
let exportFile: string;

function ctxd(home: string, args: readonly string[]): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, CTXD_HOME: home },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, out: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

function makeProject(base: string, name: string): string {
  const root = join(base, name);
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name }));
  writeFileSync(join(root, "src/index.ts"), "export const value = 1;\n");
  return root;
}

before(() => {
  projectA = makeProject(source.dir, "project-a");
  projectB = makeProject(destination.dir, "project-b");
  exportFile = join(source.dir, "knowledge.json");

  assert.equal(ctxd(source.dir, ["init", "--dir", projectA]).code, 0);
  assert.equal(ctxd(destination.dir, ["init", "--dir", projectB]).code, 0);

  const recorded = ctxd(source.dir, [
    "decision", "add",
    "--dir", projectA,
    "--title", "Idempotency keys are permanent",
    "--question", "May a key be reused after expiry?",
    "--decision", "No.",
    "--reason", "Stripe may retry an event long after the key would have expired.",
    "--status", "ACTIVE",
    "--file", "src/payment/idempotency.ts",
  ]);
  assert.equal(recorded.code, 0, recorded.out);
});

after(() => {
  source.cleanup();
  destination.cleanup();
});

describe("export (§74)", () => {
  it("writes JSON a person can read without ctxd", () => {
    const result = ctxd(source.dir, ["export", "--dir", projectA, "--out", exportFile]);
    assert.equal(result.code, 0, result.out);

    const payload = JSON.parse(readFileSync(exportFile, "utf8")) as {
      format: number;
      ctxdVersion: string;
      project: { name: string };
      memories: { title: string; type: string }[];
      tasks: unknown[];
    };

    assert.equal(payload.format, 1);
    assert.ok(payload.ctxdVersion.length > 0);
    assert.equal(payload.project.name, "project-a");
    assert.equal(payload.memories.length, 1);
    assert.equal(payload.memories[0]?.title, "Idempotency keys are permanent");
    assert.equal(payload.memories[0]?.type, "DECISION");
    assert.ok(Array.isArray(payload.tasks));
  });

  it("writes to stdout when no file is given", () => {
    const result = ctxd(source.dir, ["export", "--dir", projectA]);
    assert.equal(result.code, 0);
    const payload = JSON.parse(result.out) as { memories: unknown[] };
    assert.equal(payload.memories.length, 1);
  });

  it("explains itself when the directory is not a ctxd project", () => {
    const result = ctxd(source.dir, ["export", "--dir", source.dir]);
    assert.equal(result.code, 1);
    assert.match(result.out, /ctxd init/);
  });
});

describe("import (§74)", () => {
  it("moves knowledge to a machine that has never seen it", () => {
    // The destination starts empty — this is the whole point of the feature.
    const before = ctxd(destination.dir, ["decisions", "--dir", projectB]);
    assert.match(before.out, /No decisions recorded yet/);

    const result = ctxd(destination.dir, ["import", exportFile, "--dir", projectB]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /imported 1 memories/);

    const after_ = ctxd(destination.dir, ["decisions", "--dir", projectB]);
    assert.match(after_.out, /Idempotency keys are permanent/);
  });

  it("is idempotent — importing twice changes nothing the second time", () => {
    const again = ctxd(destination.dir, ["import", exportFile, "--dir", projectB]);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /skipped 1 already present/);
  });

  it("reports what a dry run would do without doing it", () => {
    const fresh = makeProject(destination.dir, "project-c");
    assert.equal(ctxd(destination.dir, ["init", "--dir", fresh]).code, 0);

    const dry = ctxd(destination.dir, ["import", exportFile, "--dir", fresh, "--dry-run"]);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /would import 1 memories/);

    // Nothing was written.
    const listed = ctxd(destination.dir, ["decisions", "--dir", fresh]);
    assert.match(listed.out, /No decisions recorded yet/);
  });

  it("refuses a file it does not understand rather than half-importing", () => {
    const bad = join(destination.dir, "bad.json");

    writeFileSync(bad, "{not json");
    assert.match(ctxd(destination.dir, ["import", bad, "--dir", projectB]).out, /not valid JSON/);

    writeFileSync(bad, JSON.stringify({ format: 99, memories: [], tasks: [] }));
    assert.match(
      ctxd(destination.dir, ["import", bad, "--dir", projectB]).out,
      /written by a newer ctxd/,
    );

    writeFileSync(bad, JSON.stringify({ format: 1 }));
    assert.match(ctxd(destination.dir, ["import", bad, "--dir", projectB]).out, /missing "memories"/);
  });

  it("reports a missing file clearly", () => {
    const result = ctxd(destination.dir, [
      "import",
      join(destination.dir, "nope.json"),
      "--dir",
      projectB,
    ]);
    assert.equal(result.code, 1);
    assert.match(result.out, /could not read/);
  });
});

describe("logs (§75)", () => {
  it("says plainly when there is nothing to show", () => {
    const result = ctxd(source.dir, ["logs"]);
    assert.equal(result.code, 0);
    assert.match(result.out, /No log files/);
  });

  it("renders records and filters by level", () => {
    const logFile = join(source.dir, "logs", "test.log");
    mkdirSync(join(source.dir, "logs"), { recursive: true });
    writeFileSync(
      logFile,
      [
        JSON.stringify({ time: "2026-08-13T10:00:00.000Z", level: "debug", msg: "starting up" }),
        JSON.stringify({ time: "2026-08-13T10:00:01.000Z", level: "error", msg: "it broke", code: 7 }),
        "{truncated",
        "",
      ].join("\n"),
    );

    const all = ctxd(source.dir, ["logs"]);
    assert.equal(all.code, 0);
    assert.match(all.out, /starting up/);
    assert.match(all.out, /it broke/);
    assert.match(all.out, /could not be parsed/);

    const errorsOnly = ctxd(source.dir, ["logs", "--level", "error"]);
    assert.match(errorsOnly.out, /it broke/);
    assert.ok(!errorsOnly.out.includes("starting up"), "debug records should be filtered out");

    const grepped = ctxd(source.dir, ["logs", "--grep", "broke"]);
    assert.match(grepped.out, /it broke/);
    assert.ok(!grepped.out.includes("starting up"));

    const raw = ctxd(source.dir, ["logs", "--json"]);
    assert.match(raw.out, /"level":"error"/);
  });

  it("rejects an unknown level", () => {
    const result = ctxd(source.dir, ["logs", "--level", "chatty"]);
    assert.equal(result.code, 1);
    assert.match(result.out, /--level must be one of/);
  });
});
