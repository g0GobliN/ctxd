import { strict as assert } from "node:assert";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Test hygiene (§77).
 *
 * "Tests never touch `~/.ctxd`" is a claim about every test that exists and
 * every test anyone adds later. Asserting it here makes it enforceable rather
 * than a convention people remember unevenly — a test that quietly wrote to the
 * developer's real storage would corrupt their project memory, and would only
 * be noticed long after the fact.
 */

const TESTS_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** This file, which necessarily contains the patterns it searches for. */
const SELF = fileURLToPath(import.meta.url);

function testFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    // Fixtures are inert data; they are not executed.
    if (entry.isDirectory()) return entry.name === "fixtures" ? [] : testFiles(path);
    if (path === SELF) return [];
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

/** Source with comments stripped, so prose about a rule does not trip it. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("tests never touch the developer's storage (§77)", () => {
  const files = testFiles(TESTS_ROOT);

  it("finds test files to check", () => {
    assert.ok(files.length > 5, `expected a test suite, found ${files.length} files`);
  });

  it("never resolves paths without an isolated CTXD_HOME", () => {
    for (const file of files) {
      const source = code(file);
      // `resolvePaths()` with no argument falls back to the real ~/.ctxd.
      const bare = source.match(/resolvePaths\(\s*\)/g);
      assert.equal(
        bare,
        null,
        `${file} calls resolvePaths() with no options — it would resolve the real ~/.ctxd`,
      );

      if (source.includes("resolvePaths(")) {
        assert.ok(
          source.includes("CTXD_HOME"),
          `${file} resolves paths without setting CTXD_HOME`,
        );
      }
    }
  });

  it("never references the home directory directly", () => {
    for (const file of files) {
      const source = code(file);
      assert.ok(
        !/\bhomedir\s*\(/.test(source),
        `${file} calls homedir() — tests must stay inside a temp directory`,
      );
      // A literal "~/.ctxd" is fine when it is only ever expanded against a
      // fake home — that is exactly what the path tests assert.
      if (/["'`]~\/\.ctxd/.test(source)) {
        assert.ok(
          /home:\s*["'`]/.test(source) || source.includes("CTXD_HOME"),
          `${file} references ~/.ctxd without supplying a fake home to expand it against`,
        );
      }
    }
  });

  it("runs the CLI only with an isolated CTXD_HOME", () => {
    for (const file of files) {
      const source = code(file);
      // A subprocess inherits the environment, so starting the CLI without an
      // override would write to the real storage directory.
      //
      // Every way a test can start a child process has to be covered, not just
      // the one that happened to be in use when this rule was written: a guard
      // that misses `spawn` is a guard that stops working the first time
      // someone needs a long-running child. This list grew by exactly that
      // route — `tests/e2e/desktop.test.ts` spawns `ctxd desktop --no-window`.
      const starts = [
        /execFileSync\([^)]*CLI/s,
        /execFile\([^)]*CLI/s,
        /\bspawn\(([^)]*)CLI/s,
        /spawnSync\([^)]*CLI/s,
        /\bfork\([^)]*CLI/s,
      ];
      if (!starts.some((pattern) => pattern.test(source))) continue;

      assert.ok(
        source.includes("CTXD_HOME") || source.includes('"--version"'),
        `${file} starts the CLI without an isolated CTXD_HOME`,
      );
    }
  });

  it("leaves the real storage directory untouched by this run", () => {
    // A belt-and-braces check on the property the rules above protect.
    const real = join(homedir(), ".ctxd");
    if (!existsSync(real)) return;

    const db = join(real, "ctxd.db");
    if (!existsSync(db)) return;

    const modified = statSync(db).mtimeMs;
    const startedAt = Date.now() - process.uptime() * 1000;
    assert.ok(
      modified < startedAt,
      "the real ~/.ctxd database was written during this test run",
    );
  });
});
