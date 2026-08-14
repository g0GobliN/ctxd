import { strict as assert } from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { createTempHome } from "../helpers/temp-home.ts";

/**
 * The desktop shell command (UI-10, §67).
 *
 * The exit criterion has two halves — `ctxd` opens a local window, and **the
 * CLI keeps working independently**. Only the second is testable without a
 * compiled Rust binary, and it is the half that matters more: the shell is
 * packaging (§67), so nothing about ctxd may depend on it existing. A test
 * suite that could only run where a Rust toolchain is installed would make the
 * shell a foundation, which is exactly what 2.0 says it must never be.
 *
 * So these tests assert the shell is optional, and that its absence is reported
 * as a missing build with the command that fixes it — never as a broken
 * feature (§13).
 */

const CLI = fileURLToPath(new URL("../../packages/cli/dist/index.js", import.meta.url));

const home = createTempHome();
after(() => home.cleanup());

/**
 * The environment every spawn here uses.
 *
 * Spelled out rather than taken from `home.env` alone so the isolation is
 * visible at the point of use: a subprocess inherits the environment, and a
 * CLI spawned without this override would write to the developer's real
 * `~/.ctxd`. `tests/unit/test-hygiene.test.ts` enforces it rather than trusting
 * anyone to remember.
 */
const ISOLATED: NodeJS.ProcessEnv = { ...process.env, CTXD_HOME: home.dir };

interface RunResult {
  readonly output: string;
  readonly status: number;
}

function ctxd(args: readonly string[]): RunResult {
  try {
    const output = execFileSync(process.execPath, [CLI, ...args], {
      env: ISOLATED,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { output, status: 0 };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    return {
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
      status: failure.status ?? 1,
    };
  }
}

describe("ctxd desktop (UI-10)", () => {
  it("is listed as a command", () => {
    const { output, status } = ctxd(["--help"]);
    assert.equal(status, 0);
    assert.match(output, /desktop/);
  });

  it("has its own help, like every other command", () => {
    const { output, status } = ctxd(["desktop", "--help"]);
    assert.equal(status, 0);
    assert.match(output, /ctxd desktop/);
    assert.match(output, /--no-window/);
    // The help says how to build the shell, because the shell is not built by
    // `pnpm build` and a developer hitting this needs the next command.
    assert.match(output, /cargo build/);
  });

  it("rejects bad input rather than ignoring it", () => {
    // Both checks share this test because each costs a process spawn, and this
    // file already runs alongside the rest of the suite in parallel. Test load
    // is not free: it is what starves the polling in the event-stream tests.
    const port = ctxd(["desktop", "--port", "99999", "--no-window"]);
    assert.equal(port.status, 1);
    assert.match(port.output, /--port must be between 0 and 65535/);

    assert.equal(ctxd(["desktop", "--wat"]).status, 1);
  });

  it("serves the same loopback API without a window", async () => {
    // The half of the shell that is pure ctxd: the interface and its data come
    // from the local API, so the window is genuinely only a viewer.
    const child = spawn(process.execPath, [CLI, "desktop", "--no-window"], {
      env: ISOLATED,
      stdio: ["ignore", "pipe", "pipe"],
    });

    try {
      const url = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no URL was printed")), 20_000);
        let buffered = "";

        child.stdout.on("data", (chunk: Buffer) => {
          buffered += chunk.toString();
          const match = /listening on (http:\/\/\S+)/.exec(buffered);
          if (match?.[1] !== undefined) {
            clearTimeout(timer);
            resolve(match[1]);
          }
        });
        child.once("error", reject);
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error(`exited early: ${buffered}`));
        });
      });

      // §62: loopback and nothing else, in the desktop path exactly as in `ctxd ui`.
      assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);

      const response = await fetch(`${url}/api/health`);
      assert.equal(response.status, 200);
      const body = (await response.json()) as { ok: boolean };
      assert.equal(body.ok, true);
    } finally {
      child.kill();
    }
  });

  it("leaves every other command working whether or not the shell is built", () => {
    // The point of §67: the shell is packaging. An unrelated command must not
    // care that a Rust binary is missing, or the desktop build would have
    // become a dependency of the CLI rather than a wrapper around it.
    //
    // `status` rather than `doctor`: it proves the same thing and `doctor` runs
    // every environment check, which is the slowest command in the suite.
    const status = ctxd(["status"]);
    assert.equal(status.status, 0);
    assert.match(status.output, /ctxd/);
    assert.doesNotMatch(status.output, /desktop/i);
  });
});
