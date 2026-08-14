/**
 * Starting a worker and reading what it did.
 *
 * ctxd spawns Claude Code's headless mode rather than calling a model API. That
 * is deliberate on three counts:
 *
 * 1. **No API key.** The CLI is already authenticated by the developer's
 *    subscription. ctxd never handles a credential it would then have to store.
 * 2. **ctxd stays provider-independent** (§42). It starts a *worker*; it does
 *    not become one. Swapping in another runnable CLI is a new entry in
 *    `route.ts`, not a change to the core.
 * 3. **The `no-network` guarantee survives.** ctxd itself still opens no
 *    socket. The worker reaches the network, which is what a worker is for.
 */

import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import type { ModelChoice, RunnableWorker } from "./route.js";

/** How long a worker may run before ctxd stops waiting. */
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export interface WorkerRunResult {
  readonly ok: boolean;
  /** What the worker said when it finished. */
  readonly result: string;
  readonly sessionId?: string;
  readonly turns?: number;
  /** Reported by the worker. On a subscription this is notional, not a bill. */
  readonly reportedCostUsd?: number;
  readonly durationMs: number;
  /** Populated when the run failed rather than the task failing. */
  readonly error?: string;
}

/**
 * Is Claude Code installed?
 *
 * Probed by running it, not by looking for a file: a path that exists and a
 * binary that runs are different claims, and §13 does not allow reporting the
 * first as the second.
 */
export function claudeRunner(): RunnableWorker {
  const base = { id: "claude", name: "Claude Code", command: "claude" } as const;

  try {
    const version = execFileSync("claude", ["--version"], {
      encoding: "utf8",
      timeout: 20_000,
      shell: process.platform === "win32",
    }).trim();

    return { ...base, available: true, detail: version };
  } catch (error) {
    return {
      ...base,
      available: false,
      detail: `not installed or not on PATH (${(error as Error).message.split("\n")[0]})`,
    };
  }
}

/**
 * Cursor, reported honestly.
 *
 * Listed so the interface can say why it was not used, rather than leaving a
 * worker the developer pays for silently missing from the picture.
 */
export function cursorRunner(): RunnableWorker {
  return {
    id: "cursor",
    name: "Cursor",
    command: "",
    available: false,
    detail:
      "an editor with no headless mode — it connects to ctxd over MCP and asks " +
      "for context, and work reaches it with a handoff rather than by being run",
  };
}

export function runners(): RunnableWorker[] {
  return [claudeRunner(), cursorRunner()];
}

export interface RunWorkerOptions {
  readonly cwd: string;
  readonly prompt: string;
  readonly model: ModelChoice;
  readonly timeoutMs?: number;
  /**
   * Let the worker edit files without asking.
   *
   * Off by default. §34 forbids over-automation, and a run that rewrites a
   * working tree unasked is exactly that — the caller has to say so.
   */
  readonly applyEdits?: boolean;
  /** MCP servers the worker should load, as a JSON string. */
  readonly mcpConfig?: string;
}

/**
 * Run a worker to completion and parse its result.
 *
 * `--output-format json` gives one JSON object on stdout, which is why this
 * does not have to parse prose. A worker that writes something else is treated
 * as a failed run rather than having its output guessed at.
 */
export function runWorker(options: RunWorkerOptions): Promise<WorkerRunResult> {
  const started = Date.now();

  // The prompt goes on **stdin**, never in argv.
  //
  // A built context is multi-line and full of quotes, braces and backslashes.
  // Passed as an argument on Windows — where `claude` is a `.cmd` shim and so
  // has to be spawned through a shell — cmd.exe re-parses all of it. The
  // observed failure was the worker exiting 0 in 117ms having produced no
  // output at all, which reads like a crash and is actually a mangled command
  // line. Stdin has no quoting rules to get wrong.
  const args = [
    "-p",
    "--output-format",
    "json",
    "--model",
    options.model,
    // The worker works in the project, and only in the project.
    "--add-dir",
    options.cwd,
  ];

  if (options.applyEdits === true) {
    args.push("--permission-mode", "acceptEdits");
  }
  if (options.mcpConfig !== undefined) {
    args.push("--mcp-config", options.mcpConfig);
  }

  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: options.cwd,
      // Windows resolves `claude` to a .cmd/.ps1 shim, which cannot be
      // executed without a shell.
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Written and closed immediately: the worker waits for end-of-input before
    // it starts, so leaving stdin open would hang until the timeout.
    child.stdin.on("error", () => {
      // A worker that died before reading stdin surfaces through `close`
      // below; an EPIPE here would otherwise crash the process.
    });
    child.stdin.end(options.prompt);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    const timer = setTimeout(() => {
      child.kill();
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        result: "",
        durationMs: Date.now() - started,
        error: `could not start the worker: ${error.message}`,
      });
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - started;

      let parsed: Record<string, unknown> | undefined;
      try {
        parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
      } catch {
        parsed = undefined;
      }

      if (parsed === undefined) {
        resolve({
          ok: false,
          result: "",
          durationMs,
          // The worker's own stderr is more useful than an exit code, so it
          // travels rather than being replaced by a generic message.
          error:
            stderr.trim() !== ""
              ? stderr.trim().split("\n").slice(-5).join("\n")
              : `the worker exited ${code} without a JSON result`,
        });
        return;
      }

      const isError = parsed["is_error"] === true || code !== 0;
      resolve({
        ok: !isError,
        result: typeof parsed["result"] === "string" ? parsed["result"] : "",
        ...(typeof parsed["session_id"] === "string"
          ? { sessionId: parsed["session_id"] }
          : {}),
        ...(typeof parsed["num_turns"] === "number" ? { turns: parsed["num_turns"] } : {}),
        ...(typeof parsed["total_cost_usd"] === "number"
          ? { reportedCostUsd: parsed["total_cost_usd"] }
          : {}),
        durationMs,
        ...(isError ? { error: `the worker reported a failure (exit ${code})` } : {}),
      });
    });
  });
}
