import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { saveMemory } from "@ctxd/memory";
import { detectProject, upsertProject } from "@ctxd/project";
import {
  buildProjectContext,
  contextDecision,
  contextFile,
  contextGet,
  contextSearch,
  gitProvider,
  memoryProvider,
  PathEscapesProjectError,
} from "@ctxd/firewall";
import { extractTaskSignals } from "@ctxd/context";
import { createTempHome } from "../helpers/temp-home.ts";

const home = createTempHome();
after(() => home.cleanup());

const NOW = Date.parse("2026-08-01T00:00:00Z");
let counter = 0;

interface Fixture {
  readonly db: Db;
  readonly root: string;
  readonly projectId: string;
}

function fixture(name: string): Fixture {
  const root = join(home.dir, `fw-${name}`);
  mkdirSync(join(root, "src", "payment"), { recursive: true });
  mkdirSync(join(root, "src", "camera"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: `fw-${name}` }));
  writeFileSync(
    join(root, "src/payment/webhook.ts"),
    "export function handleWebhook() { return 'stripe idempotency'; }",
  );
  writeFileSync(join(root, "src/camera/stream.ts"), "export const decodeFrame = () => 0;");

  const db = openDatabase(join(home.dir, `fw-${name}-${(counter += 1)}.db`));
  migrate(db);
  const project = upsertProject(db, detectProject(root));

  return { db, root, projectId: project.id };
}

describe("memory provider", () => {
  it("retrieves memory matching the task", () => {
    const { db, projectId } = fixture("match");
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Idempotency key is the Stripe event id",
      content: "Keying on the payment intent would collapse distinct events.",
      source: "accepted_decision",
    });

    const items = memoryProvider(db, projectId).retrieve(
      extractTaskSignals("Fix Stripe webhook idempotency"),
    );

    assert.equal(items.length, 1);
    assert.match(items[0]?.path ?? "", /^memory\/decision\//);
    assert.match(items[0]?.reason ?? "", /accepted_decision/);
    db.close();
  });

  it("always retrieves mandatory memory, even when it shares no words with the task", () => {
    const { db, projectId } = fixture("mandatory");
    saveMemory(db, {
      projectId,
      type: "RULE",
      title: "Never log personal data",
      content: "Redact customer names before writing any log line.",
      source: "project_rule",
    });

    const items = memoryProvider(db, projectId).retrieve(
      extractTaskSignals("Fix Stripe webhook idempotency"),
    );

    assert.equal(items.length, 1, "a P0 rule must be retrieved regardless of vocabulary");
    assert.equal(items[0]?.priority, "P0");
    assert.match(items[0]?.reason ?? "", /mandatory/);
    db.close();
  });

  it("does not retrieve superseded memory", () => {
    const { db, projectId } = fixture("superseded");
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Retry policy",
      content: "Retry stripe webhooks three times.",
      source: "worker_statement",
    });
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Retry policy",
      content: "Retry stripe webhooks five times with backoff.",
      source: "explicit_user",
    });

    const items = memoryProvider(db, projectId).retrieve(extractTaskSignals("stripe retry"));
    assert.equal(items.length, 1);
    assert.match(items[0]?.content ?? "", /five times/);
    db.close();
  });

  it("returns nothing for a project with no memory", () => {
    const { db, projectId } = fixture("empty");
    const items = memoryProvider(db, projectId).retrieve(extractTaskSignals("anything at all"));
    assert.deepEqual(items, []);
    db.close();
  });
});

describe("git provider", () => {
  it("summarises working tree state as one P1 item", () => {
    const items = gitProvider(
      {
        available: true,
        insideWorkTree: true,
        branch: "main",
        changes: [{ status: "M", path: "src/payment/webhook.ts" }],
        recentCommits: [
          { hash: "abc123def", author: "Dev", date: "2026-08-01", subject: "Fix retry" },
        ],
      },
      { now: NOW },
    ).retrieve(extractTaskSignals("anything"));

    assert.equal(items.length, 1);
    assert.equal(items[0]?.priority, "P1");
    assert.match(items[0]?.content ?? "", /branch: main/);
    assert.match(items[0]?.content ?? "", /src\/payment\/webhook\.ts/);
    assert.match(items[0]?.content ?? "", /Fix retry/);
  });

  it("contributes nothing outside a repository", () => {
    const items = gitProvider({ available: true, insideWorkTree: false }).retrieve(
      extractTaskSignals("anything"),
    );
    assert.deepEqual(items, []);
  });

  it("contributes nothing when there is nothing to report", () => {
    const items = gitProvider({
      available: true,
      insideWorkTree: true,
      branch: "main",
      changes: [],
      recentCommits: [],
    }).retrieve(extractTaskSignals("anything"));
    assert.deepEqual(items, []);
  });
});

describe("buildProjectContext", () => {
  it("puts memory and files through the same pipeline", () => {
    const { db, root, projectId } = fixture("pipeline");
    saveMemory(db, {
      projectId,
      type: "RULE",
      title: "Duplicate stripe events must not create a second payment",
      content: "Webhook handling is idempotent.",
      source: "project_rule",
    });

    const result = buildProjectContext({
      task: "Fix Stripe webhook idempotency",
      dir: root,
      budget: 5000,
      db,
      now: NOW,
      requestId: "test",
      timestamp: "2026-08-01T00:00:00.000Z",
    });

    const paths = result.selection.included.map((entry) => entry.item.path);
    assert.ok(paths.includes("src/payment/webhook.ts"), "the relevant file should be included");
    assert.ok(
      paths.some((path) => path.startsWith("memory/rule/")),
      "the project rule should be included",
    );
    assert.ok(!paths.includes("src/camera/stream.ts"), "irrelevant files stay out");
    assert.equal(result.retrieved["memory"], 1);
    db.close();
  });

  it("records the memory's provenance as its reason in the receipt", () => {
    const { db, root, projectId } = fixture("provenance");
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Stripe idempotency approach",
      content: "Reserve then complete.",
      source: "accepted_decision",
    });

    const result = buildProjectContext({
      task: "Fix Stripe webhook idempotency",
      dir: root,
      budget: 5000,
      db,
      now: NOW,
    });

    const entry = result.receipt.included_items.find((item) => item.path.startsWith("memory/"));
    assert.ok(entry !== undefined, "memory should reach the receipt");
    assert.match(entry.reason, /accepted_decision|mandatory/);
    db.close();
  });

  it("works in an unregistered directory, with files alone", () => {
    const { db, root } = fixture("unregistered");
    db.prepare("DELETE FROM projects").run();

    const result = buildProjectContext({
      task: "Fix Stripe webhook idempotency",
      dir: root,
      budget: 5000,
      db,
      now: NOW,
    });

    assert.equal(result.project, undefined);
    assert.equal(result.retrieved["memory"], undefined);
    assert.ok(result.selection.included.length > 0, "files should still be selected");
    db.close();
  });

  it("stays within budget once memory is added", () => {
    const { db, root, projectId } = fixture("budget");
    for (let i = 0; i < 40; i += 1) {
      saveMemory(db, {
        projectId,
        type: "NOTE",
        title: `Stripe note ${i}`,
        content: `Idempotency detail number ${i}. ${"padding ".repeat(80)}`,
        source: "inferred",
      });
    }

    const result = buildProjectContext({
      task: "Fix Stripe webhook idempotency",
      dir: root,
      budget: 1500,
      db,
      now: NOW,
    });

    assert.ok(
      result.selection.finalTokens <= 1500,
      `final ${result.selection.finalTokens} exceeded budget`,
    );
    db.close();
  });

  it("is deterministic", () => {
    const { db, root, projectId } = fixture("deterministic");
    saveMemory(db, {
      projectId,
      type: "RULE",
      title: "Stripe rule",
      content: "Idempotent webhooks only.",
      source: "project_rule",
    });

    const options = {
      task: "Fix Stripe webhook idempotency",
      dir: root,
      budget: 4000,
      db,
      now: NOW,
      requestId: "fixed",
      timestamp: "2026-08-01T00:00:00.000Z",
    };

    assert.equal(buildProjectContext(options).context, buildProjectContext(options).context);
    db.close();
  });
});

describe("progressive retrieval", () => {
  it("returns summaries with a fetch cost, not full documents", () => {
    const { db, projectId } = fixture("progressive");
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Idempotency approach",
      content: `The long reasoning behind it. ${"detail ".repeat(200)}`,
      source: "accepted_decision",
    });

    const results = contextSearch(db, projectId, "idempotency");
    assert.equal(results.length, 1);

    const summary = results[0];
    assert.ok(summary !== undefined);
    assert.ok(summary.estimatedTokens > 100, "the summary should state the real fetch cost");
    assert.ok(summary.snippet.length < 200, "a search result must not be the whole document");
    db.close();
  });

  it("fetches the full body only when asked", () => {
    const { db, projectId } = fixture("fetch");
    const outcome = saveMemory(db, {
      projectId,
      type: "FACT",
      title: "Stripe retries",
      content: "Deliveries repeat.",
      source: "verified_code",
    });
    if (outcome.kind !== "created") return assert.fail("expected creation");

    const body = contextGet(db, outcome.memory.id);
    assert.equal(body?.content, "Deliveries repeat.");
    assert.equal(contextGet(db, "missing-id"), undefined);
    db.close();
  });

  it("lists decisions specifically", () => {
    const { db, projectId } = fixture("decisions");
    saveMemory(db, {
      projectId,
      type: "DECISION",
      title: "Use the event id",
      content: "Decided.",
      source: "accepted_decision",
    });
    saveMemory(db, {
      projectId,
      type: "BUG",
      title: "Port collision",
      content: "Fixed.",
      source: "verified_code",
    });

    const decisions = contextDecision(db, projectId);
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.type, "DECISION");
    db.close();
  });

  it("reads a file slice", () => {
    const { db, root } = fixture("slice");
    const slice = contextFile(root, "src/payment/webhook.ts", { fromLine: 1, toLine: 1 });

    assert.equal(slice?.fromLine, 1);
    assert.equal(slice?.toLine, 1);
    assert.match(slice?.content ?? "", /handleWebhook/);
    db.close();
  });

  it("refuses to read outside the project root", () => {
    const { db, root } = fixture("escape");

    assert.throws(() => contextFile(root, "../../../etc/passwd"), PathEscapesProjectError);
    assert.throws(() => contextFile(root, "/etc/passwd"), PathEscapesProjectError);
    db.close();
  });

  it("returns undefined for a missing file rather than throwing", () => {
    const { db, root } = fixture("missing");
    assert.equal(contextFile(root, "src/nope.ts"), undefined);
    db.close();
  });
});

describe("collection scope", () => {
  /**
   * Regression: `buildProjectContext` used to collect files from the detected
   * project root rather than the directory it was given. Inside a repository
   * that silently widened every request made from a subdirectory into a
   * whole-repository scan — and inflated "estimated context avoided" with
   * files nobody asked about.
   */
  it("collects only from the directory it was given", () => {
    const { db, root } = fixture("scope");

    const wholeProject = buildProjectContext({
      task: "stripe idempotency webhook",
      dir: root,
      budget: 10000,
      db,
      now: NOW,
    });

    const subdirectory = buildProjectContext({
      task: "stripe idempotency webhook",
      dir: join(root, "src", "payment"),
      budget: 10000,
      db,
      now: NOW,
    });

    const wholePaths = wholeProject.candidates.map((item) => item.path);
    const subPaths = subdirectory.candidates.map((item) => item.path);

    assert.ok(
      wholePaths.some((path) => path.includes("camera")),
      "the whole-project build should see the camera module",
    );
    assert.ok(
      !subPaths.some((path) => path.includes("camera")),
      `a build scoped to src/payment must not collect src/camera: ${JSON.stringify(subPaths)}`,
    );
    assert.ok(
      subPaths.some((path) => path.includes("webhook")),
      "the scoped build should still see the file it was pointed at",
    );

    db.close();
  });

  it("still anchors project identity to the repository root", () => {
    // The Git repository has to exist before the project is registered.
    // Registering first and initialising after would change the project's
    // identity — it anchors to the root commit — while the row's `root` column
    // stayed the same, and that column is UNIQUE.
    const root = join(home.dir, "fw-identity-git");
    mkdirSync(join(root, "src", "payment"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fw-identity-git" }));
    writeFileSync(
      join(root, "src/payment/webhook.ts"),
      "export function handleWebhook() { return 'stripe idempotency'; }",
    );

    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "ctxd test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "--quiet", "-m", "fixture"], { cwd: root });

    const db = openDatabase(join(home.dir, `fw-identity-git-${(counter += 1)}.db`));
    migrate(db);
    const registered = upsertProject(db, detectProject(root));

    const fromSubdirectory = buildProjectContext({
      task: "stripe idempotency webhook",
      dir: join(root, "src", "payment"),
      budget: 10000,
      db,
      now: NOW,
    });

    // Narrowing the file scope must not detach the build from its project:
    // memory and Git state still belong to the repository.
    assert.equal(fromSubdirectory.project?.id, registered.id);

    db.close();
  });
});

describe("progressive retrieval refuses secrets (§62)", () => {
  /**
   * Regression, and the most serious defect found in this codebase so far:
   * `contextFile` — reachable by a worker through the MCP tool `ctx_file_get` —
   * confined reads to the project root but applied no ignore rules. `.env`,
   * `id_rsa` and everything under `secrets/` live *inside* the root, so a
   * containment check admitted them and returned their contents verbatim.
   *
   * Collection refused those files all along, which made "ctxd never sends
   * secrets to workers" true of the pipeline and false of the one path a
   * worker actually drives.
   */
  function secretFixture(name: string): string {
    const root = join(home.dir, `secrets-${name}`);
    mkdirSync(join(root, "secrets"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name }));
    writeFileSync(join(root, ".env"), "STRIPE_API_KEY=sk_live_not_a_real_key\n");
    writeFileSync(join(root, ".ENV"), "CASE=variant\n");
    writeFileSync(join(root, "id_rsa"), "-----BEGIN OPENSSH PRIVATE KEY-----\n");
    writeFileSync(join(root, ".npmrc"), "//registry.example.com/:_authToken=token\n");
    writeFileSync(join(root, "secrets", "creds.txt"), "password=hunter2\n");
    writeFileSync(join(root, "src", "app.ts"), "export const value = 1;\n");
    return root;
  }

  it("refuses every secret a worker might ask for by name", () => {
    const root = secretFixture("refuse");

    for (const path of [".env", ".ENV", "id_rsa", ".npmrc", "secrets/creds.txt"]) {
      assert.throws(
        () => contextFile(root, path),
        (error: Error) => error.name === "SecretFileError",
        `${path} was readable`,
      );
    }
  });

  it("never returns secret content, even partially", () => {
    const root = secretFixture("content");

    for (const path of [".env", "id_rsa", "secrets/creds.txt"]) {
      let content = "";
      try {
        content = contextFile(root, path)?.content ?? "";
      } catch {
        content = "";
      }
      assert.ok(!content.includes("sk_live"), `${path} leaked a key`);
      assert.ok(!content.includes("hunter2"), `${path} leaked a password`);
      assert.ok(!content.includes("PRIVATE KEY"), `${path} leaked a private key`);
    }
  });

  it("honours .ctxdignore as well as the built-in patterns", () => {
    const root = secretFixture("ctxdignore");
    mkdirSync(join(root, "internal"), { recursive: true });
    writeFileSync(join(root, "internal", "notes.md"), "private notes\n");
    writeFileSync(join(root, ".ctxdignore"), "internal/\n");

    assert.throws(
      () => contextFile(root, "internal/notes.md"),
      (error: Error) => error.name === "SecretFileError",
    );
  });

  it("still reads ordinary source", () => {
    const root = secretFixture("source");
    const slice = contextFile(root, "src/app.ts");
    assert.equal(slice?.content.trim(), "export const value = 1;");
  });

  it("still refuses a path outside the project", () => {
    const root = secretFixture("escape");
    assert.throws(
      () => contextFile(root, "../../../etc/passwd"),
      (error: Error) => error.name === "PathEscapesProjectError",
    );
  });
});
