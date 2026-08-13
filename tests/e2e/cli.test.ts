import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { createTempHome } from "../helpers/temp-home.ts";

const CLI = fileURLToPath(new URL("../../packages/cli/dist/index.js", import.meta.url));

const home = createTempHome();
after(() => home.cleanup());

interface RunResult {
  readonly stdout: string;
  readonly status: number;
}

function ctxd(args: readonly string[], env: NodeJS.ProcessEnv = home.env): RunResult {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, status: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
      status: failure.status ?? 1,
    };
  }
}

describe("ctxd --help", () => {
  it("lists the available commands", () => {
    const { stdout, status } = ctxd(["--help"]);
    assert.equal(status, 0);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /doctor/);
    assert.match(stdout, /status/);
  });

  it("is printed with no arguments too", () => {
    assert.match(ctxd([]).stdout, /Usage:/);
  });

  it("rejects an unknown command", () => {
    const { stdout, status } = ctxd(["frobnicate"]);
    assert.equal(status, 1);
    assert.match(stdout, /unknown command/);
  });
});

describe("ctxd doctor", () => {
  it("runs every check and creates the data directory", () => {
    const { stdout } = ctxd(["doctor"]);

    for (const label of ["SQLite", "FTS5", "Data directory", "Configuration", "Database", "Logging", "Git"]) {
      assert.match(stdout, new RegExp(label), `expected a ${label} check`);
    }
    assert.equal(existsSync(join(home.dir, "ctxd.db")), true);
    assert.equal(existsSync(join(home.dir, "context_receipts")), true);
  });

  it("explains how to fix anything it reports as failing", () => {
    const { stdout, status } = ctxd(["doctor"]);
    const failing = stdout
      .split("\n")
      .filter((line) => line.startsWith("✗"))
      .map((line) => line.slice(2).split("  ")[0]?.trim() ?? "");

    assert.equal(status === 0, failing.length === 0);
    for (const name of failing) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(stdout, new RegExp(`^${escaped}:`, "m"), `${name} should come with a fix`);
    }
  });

  it("supports --help without touching the environment", () => {
    const { stdout, status } = ctxd(["doctor", "--help"]);
    assert.equal(status, 0);
    assert.match(stdout, /ctxd doctor/);
  });
});

describe("ctxd init", () => {
  it("registers a project and indexes it", () => {
    const fresh = createTempHome();
    try {
      const env = { ...process.env, CTXD_HOME: fresh.dir };
      const project = join(fresh.dir, "sample");
      mkdirSync(join(project, "src"), { recursive: true });
      writeFileSync(join(project, "package.json"), JSON.stringify({ name: "sample-app" }));
      writeFileSync(join(project, "tsconfig.json"), "{}");
      writeFileSync(join(project, "src/index.ts"), "export const start = () => {};");
      writeFileSync(join(project, ".env"), "SECRET=nope");

      const { stdout, status } = ctxd(["init", "--dir", project], env);
      assert.equal(status, 0);
      assert.match(stdout, /Registered project/);
      assert.match(stdout, /sample-app/);
      assert.match(stdout, /language\s+typescript/);
      // package.json + tsconfig.json + src/index.ts, never the .env
      assert.match(stdout, /indexed\s+3 files \(3 new/);

      const again = ctxd(["init", "--dir", project], env);
      assert.match(again.stdout, /Refreshed project/);
      assert.match(again.stdout, /3 unchanged/);
    } finally {
      fresh.cleanup();
    }
  });

  it("reports honestly when nothing can be detected", () => {
    const fresh = createTempHome();
    try {
      const env = { ...process.env, CTXD_HOME: fresh.dir };
      const project = join(fresh.dir, "mystery");
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, "notes.txt"), "nothing to go on");

      const { stdout, status } = ctxd(["init", "--dir", project], env);
      assert.equal(status, 0);
      assert.match(stdout, /runtime\s+not detected/);
      assert.match(stdout, /No manifest files found/);
    } finally {
      fresh.cleanup();
    }
  });

  it("supports --help", () => {
    const { stdout, status } = ctxd(["init", "--help"]);
    assert.equal(status, 0);
    assert.match(stdout, /ctxd init/);
  });
});

describe("ctxd context", () => {
  it("builds a context and writes a receipt", () => {
    const fresh = createTempHome();
    try {
      const env = { ...process.env, CTXD_HOME: fresh.dir };
      const project = join(fresh.dir, "ctxproj");
      mkdirSync(join(project, "src"), { recursive: true });
      writeFileSync(join(project, "src/webhook.ts"), "export const handleWebhook = () => 'idempotency';");
      writeFileSync(join(project, "src/camera.ts"), "export const decodeFrame = () => 0;");

      const { stdout, status } = ctxd(
        ["context", "--task", "Fix webhook idempotency", "--dir", project, "--budget", "5000"],
        env,
      );

      assert.equal(status, 0);
      assert.match(stdout, /CONTEXT RECEIPT/);
      assert.match(stdout, /src\/webhook\.ts/);
      assert.match(stdout, /Estimated context avoided/);
      assert.ok(!stdout.includes("$"), "a receipt must never imply a monetary saving");
      assert.equal(readdirSync(join(fresh.dir, "context_receipts")).length, 1);
    } finally {
      fresh.cleanup();
    }
  });

  it("requires a task", () => {
    const { stdout, status } = ctxd(["context"]);
    assert.equal(status, 1);
    assert.match(stdout, /--task is required/);
  });

  it("supports --help", () => {
    assert.match(ctxd(["context", "--help"]).stdout, /ctxd context/);
  });
});

describe("ctxd memory", () => {
  it("records, lists and searches memory, and enforces authority", () => {
    const fresh = createTempHome();
    try {
      const env = { ...process.env, CTXD_HOME: fresh.dir };
      const project = join(fresh.dir, "memproj");
      mkdirSync(project, { recursive: true });
      writeFileSync(join(project, "package.json"), JSON.stringify({ name: "mem-app" }));

      assert.equal(ctxd(["init", "--dir", project], env).status, 0);

      const added = ctxd(
        [
          "memory", "add", "--dir", project,
          "--type", "RULE", "--source", "project_rule",
          "--title", "No duplicate payments",
          "--content", "A duplicate event must never create a second payment.",
        ],
        env,
      );
      assert.equal(added.status, 0);
      assert.match(added.stdout, /Recorded/);
      assert.match(added.stdout, /importance\s+P0/);

      // An inference must not be able to overwrite a project rule.
      const refused = ctxd(
        [
          "memory", "add", "--dir", project,
          "--type", "RULE", "--source", "inferred",
          "--title", "No duplicate payments",
          "--content", "Duplicates are fine.",
        ],
        env,
      );
      assert.equal(refused.status, 2);
      assert.match(refused.stdout, /may not override/);

      assert.match(ctxd(["memory", "list", "--dir", project], env).stdout, /No duplicate payments/);
      assert.match(
        ctxd(["memory", "search", "--dir", project, "duplicate"], env).stdout,
        /No duplicate payments/,
      );
    } finally {
      fresh.cleanup();
    }
  });

  it("requires the project to be registered first", () => {
    const fresh = createTempHome();
    try {
      const env = { ...process.env, CTXD_HOME: fresh.dir };
      const project = join(fresh.dir, "unregistered");
      mkdirSync(project, { recursive: true });

      const { stdout, status } = ctxd(["memory", "list", "--dir", project], env);
      assert.equal(status, 1);
      assert.match(stdout, /no project registered/);
    } finally {
      fresh.cleanup();
    }
  });

  it("supports --help", () => {
    assert.match(ctxd(["memory", "--help"]).stdout, /ctxd memory/);
  });
});

describe("ctxd status", () => {
  it("works outside an initialised project", () => {
    const fresh = createTempHome();
    try {
      const { stdout, status } = ctxd(["status"], { ...process.env, CTXD_HOME: fresh.dir });
      assert.equal(status, 0);
      assert.match(stdout, /^ctxd\s+\d+\.\d+\.\d+/m);
      assert.match(stdout, /mode\s+balanced/);
      assert.match(stdout, /database\s+not created yet/);
    } finally {
      fresh.cleanup();
    }
  });

  it("reports the database once doctor has created it", () => {
    ctxd(["doctor"]);
    const { stdout } = ctxd(["status"]);
    assert.match(stdout, /database\s+ok — schema v\d+/);
  });

  it("supports --help", () => {
    const { stdout, status } = ctxd(["status", "--help"]);
    assert.equal(status, 0);
    assert.match(stdout, /ctxd status/);
  });
});
