import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { readEvents } from "@ctxd/events";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The CLI as an event producer (§7).
 *
 * Driven as a real subprocess with `CTXD_HOME` pointed at a temp directory —
 * these commands open their own database, so calling the functions directly
 * would not exercise the path that actually runs.
 */

const home = createTempHome();
after(() => home.cleanup());

const CLI = resolve("packages/cli/dist/index.js");
let counter = 0;

interface Fixture {
  readonly dir: string;
  readonly slug: string;
  open(): Db;
}

function repo(name: string): Fixture {
  const slug = `cli-${name}-${(counter += 1)}`;
  const dir = join(home.dir, slug);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: `cli-${name}` }));
  writeFileSync(join(dir, "src/webhook.ts"), "export const timeout = 30;\n");

  const git = (...args: string[]): void => {
    execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  };
  git("init", "-q");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  git("add", ".");
  git("commit", "-qm", "initial");

  return {
    dir,
    slug,
    open() {
      const db = openDatabase(join(home.dir, "ctxd.db"));
      migrate(db);
      return db;
    },
  };
}

function ctxd(fixture: Fixture, ...args: string[]): string {
  try {
    return execFileSync(process.execPath, [CLI, ...args], {
      cwd: fixture.dir,
      env: { ...process.env, CTXD_HOME: home.dir },
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    // verify exits non-zero on FAIL and NEEDS_REVIEW, which is a result rather
    // than a crash; the events are still what is under test.
    return String((error as { stdout?: string }).stdout ?? "");
  }
}

/**
 * This fixture's project, matched by its unique directory.
 *
 * Every fixture shares one `CTXD_HOME`, so the registry accumulates a project
 * per test. Taking the first row would read whichever test ran earliest.
 */
function projectId(fixture: Fixture): string {
  const db = fixture.open();
  const row = db.prepare("SELECT id FROM projects WHERE root LIKE ?").get(`%${fixture.slug}%`) as
    | { id: string }
    | undefined;
  db.close();
  assert.ok(row !== undefined, `no project registered for ${fixture.slug}`);
  return row.id;
}

describe("CLI event production (§7)", () => {
  it("records a change analysis when diff runs", () => {
    const fixture = repo("diff");
    ctxd(fixture, "init");
    writeFileSync(join(fixture.dir, "src/webhook.ts"), "export const timeout = 60;\n");

    ctxd(fixture, "diff", "--task", "change the timeout to 60");

    const db = fixture.open();
    const analyzed = readEvents(db, projectId(fixture)).filter(
      (event) => event.type === "change_analyzed",
    );
    assert.equal(analyzed.length, 1);
    assert.equal(typeof analyzed[0]?.data["classification"], "string");
    db.close();
  });

  it("carries the verdict and counts, never the diff itself", () => {
    const fixture = repo("diff-payload");
    ctxd(fixture, "init");
    writeFileSync(join(fixture.dir, "src/webhook.ts"), "export const timeout = 60;\n");

    ctxd(fixture, "diff", "--task", "change the timeout");

    const db = fixture.open();
    const analyzed = readEvents(db, projectId(fixture)).find(
      (event) => event.type === "change_analyzed",
    );
    const serialised = JSON.stringify(analyzed?.data ?? {});

    // Every local process can read the stream, so the changed source stays out.
    assert.doesNotMatch(serialised, /timeout = 60/);
    assert.match(serialised, /"filesChanged":/);
    db.close();
  });

  it("attributes a change to the worker named on the command", () => {
    const fixture = repo("diff-worker");
    ctxd(fixture, "init");
    writeFileSync(join(fixture.dir, "src/webhook.ts"), "export const timeout = 60;\n");

    ctxd(fixture, "diff", "--task", "change the timeout", "--worker", "claude");

    const db = fixture.open();
    const analyzed = readEvents(db, projectId(fixture)).find(
      (event) => event.type === "change_analyzed",
    );
    assert.equal(analyzed?.worker, "claude");
    db.close();
  });

  it("brackets a verification run with a start and a finish", () => {
    const fixture = repo("verify");
    ctxd(fixture, "init");

    ctxd(fixture, "verify");

    const db = fixture.open();
    const types = readEvents(db, projectId(fixture))
      .map((event) => event.type)
      .filter((type) => type.startsWith("verification_"));
    assert.deepEqual(types, ["verification_started", "verification_finished"]);
    db.close();
  });

  it("records nothing for a dry run, which verifies nothing", () => {
    const fixture = repo("dry-run");
    ctxd(fixture, "init");

    ctxd(fixture, "verify", "--dry-run");

    const db = fixture.open();
    const verification = readEvents(db, projectId(fixture)).filter((event) =>
      event.type.startsWith("verification_"),
    );
    assert.equal(verification.length, 0);
    db.close();
  });

  it("still works in a directory that is not a registered project", () => {
    const fixture = repo("unregistered");
    writeFileSync(join(fixture.dir, "src/webhook.ts"), "export const timeout = 60;\n");

    // No `ctxd init`, so there is no project to attach an event to. The command
    // must still do its work: the log is a side record, not a precondition.
    const output = ctxd(fixture, "diff", "--task", "change the timeout");
    assert.match(output, /CHANGE RECEIPT|files changed|Files changed/i);
  });
});
