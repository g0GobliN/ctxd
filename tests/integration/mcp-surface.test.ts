import { strict as assert } from "node:assert";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createTools, type ToolDefinition } from "@ctxd/mcp";
import { migrate, openDatabase, type Db } from "@ctxd/db";
import { DEFAULT_CONFIG, resolvePaths } from "@ctxd/core";
import { detectProject, upsertProject } from "@ctxd/project";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The MCP execution surface (§63).
 *
 * "Never expose arbitrary shell execution through MCP" is the kind of property
 * that is true until someone adds a convenient tool. These tests make it a
 * standing assertion rather than an observation: the package must contain no
 * process-spawning primitive, and no tool may offer to run a command.
 *
 * ctxd does have controlled execution — categorised, with dangerous commands
 * gated — but it lives in @ctxd/verify, behind the CLI, and is deliberately not
 * reachable from a worker.
 */

const MCP_SRC = fileURLToPath(new URL("../../packages/mcp/src/", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("the MCP package has no way to run a command (§63)", () => {
  it("imports no process-spawning primitive", () => {
    for (const file of sourceFiles(MCP_SRC)) {
      const source = readFileSync(file, "utf8");
      assert.ok(
        !/from\s*["']node:child_process["']/.test(source),
        `${file} imports node:child_process — MCP must not be able to spawn a process`,
      );
      assert.ok(
        !/\b(execSync|execFileSync|execFile|spawnSync|spawn|fork)\s*\(/.test(source),
        `${file} calls a process-spawning function`,
      );
      assert.ok(
        !/from\s*["']node:vm["']|\bnew Function\s*\(|\beval\s*\(/.test(source),
        `${file} evaluates code at runtime`,
      );
    }
  });

  it("exposes no tool that runs, executes or shells out", () => {
    const home = createTempHome();
    let db: Db | undefined;

    try {
      db = openDatabase(join(home.dir, "mcp.db"));
      migrate(db);

      const tools: ToolDefinition[] = createTools({
        db,
        paths: resolvePaths({ env: { CTXD_HOME: home.dir } }),
        config: DEFAULT_CONFIG,
        cwd: process.cwd(),
      });

      assert.ok(tools.length > 0, "expected a tool surface to inspect");

      const forbidden = /\b(exec|shell|bash|sh|cmd|spawn|run_command|terminal|eval)\b/i;
      for (const tool of tools) {
        assert.ok(
          !forbidden.test(tool.name),
          `tool "${tool.name}" names an execution capability`,
        );
      }

      // Every tool is a ctx_ data operation. A new tool outside that prefix is
      // not necessarily wrong, but it should be a deliberate decision rather
      // than something that arrives unnoticed.
      for (const tool of tools) {
        assert.match(tool.name, /^ctx_/, `unexpected tool outside the ctx_ surface: ${tool.name}`);
      }
    } finally {
      db?.close();
      home.cleanup();
    }
  });

  it("keeps controlled execution out of the worker-facing package", () => {
    // @ctxd/verify is where categorised execution lives. MCP must not depend
    // on it, or a worker would be one tool away from running commands.
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../packages/mcp/package.json", import.meta.url)), "utf8"),
    ) as { dependencies?: Record<string, string> };

    const dependencies = Object.keys(manifest.dependencies ?? {});
    assert.ok(
      !dependencies.includes("@ctxd/verify"),
      "MCP must not depend on @ctxd/verify: controlled execution is not a worker capability",
    );
  });
});

describe("a worker cannot claim authority it did not earn (§31)", () => {
  /**
   * Regression: `ctx_memory_save` refused only `explicit_user` and
   * `project_rule`, so a worker could write `accepted_decision` — which
   * outranks `verified_code` — and supersede a fact ctxd had verified, purely
   * by saying so. `verified_code` and `verified_git` were accepted too, and
   * both assert a verification ctxd performs, not one a worker can perform.
   *
   * The README promises a worker cannot overwrite what you told it. Authority
   * decides which record survives a conflict, so who may claim what is the
   * whole mechanism.
   */
  function tools() {
    const home = createTempHome();
    const root = join(home.dir, "project");
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "project" }));

    const db = openDatabase(join(home.dir, "mcp-auth.db"));
    migrate(db);
    upsertProject(db, detectProject(root));

    return {
      db,
      home,
      root,
      list: createTools({
        db,
        paths: resolvePaths({ env: { CTXD_HOME: home.dir } }),
        config: DEFAULT_CONFIG,
        cwd: root,
      }),
    };
  }

  it("accepts only the provenance a worker can honestly claim", () => {
    const { db, home, root, list } = tools();
    try {
      const save = list.find((tool) => tool.name === "ctx_memory_save");
      assert.ok(save);

      for (const source of ["worker_statement", "inferred"]) {
        const result = save.handler({ title: `t-${source}`, content: "c", source, dir: root });
        assert.notEqual(result.isError, true, `${source} should be accepted`);
      }

      for (const source of [
        "accepted_decision",
        "verified_code",
        "verified_git",
        "explicit_user",
        "project_rule",
      ]) {
        const result = save.handler({ title: `t-${source}`, content: "c", source, dir: root });
        assert.equal(result.isError, true, `${source} must be refused`);
        assert.match(result.text, /may not record memory as/);
      }
    } finally {
      db.close();
      home.cleanup();
    }
  });

  it("applies the same rule when updating memory", () => {
    const { db, home, root, list } = tools();
    try {
      const update = list.find((tool) => tool.name === "ctx_memory_update");
      assert.ok(update);

      const result = update.handler({
        title: "escalation",
        content: "c",
        source: "accepted_decision",
        dir: root,
      });
      assert.equal(result.isError, true);
    } finally {
      db.close();
      home.cleanup();
    }
  });
});
