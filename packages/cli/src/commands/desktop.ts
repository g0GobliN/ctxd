import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startApiServer } from "@ctxd/api";
import { ensureDataDir, loadConfig, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";

/**
 * `ctxd desktop` — the local interface in a window (UI-10, §67).
 *
 * The same API `ctxd ui` serves, with a Tauri window pointed at it instead of a
 * browser. Nothing about ctxd changes: the shell is packaging, never a
 * foundation, and every command keeps working whether or not it is built.
 *
 * The API is started here, in this process, rather than by the shell. It is a
 * Node server and the shell is a Rust binary; having the window own the server
 * would mean a second way to start ctxd, with its own lifetime and its own
 * bugs. This way there is one server, and closing the window stops it.
 */

export const DESKTOP_HELP = `ctxd desktop — the local interface in a window

Usage:
  ctxd desktop [--dir <path>] [--port <n>] [--no-window]

Options:
  --dir <path>     Directory the interface inspects (default: .)
  --port <n>       Port for the local API (default: 0, any free port)
  --no-window      Start the API and print the URL without opening a window
  -h, --help       Show this help

Starts the same loopback API as \`ctxd ui\` and opens a desktop window onto it.
The window is a viewer: the interface, the data and every decision behind them
come from the local API, exactly as they do in a browser.

The desktop shell is a Rust binary and is not built by \`pnpm build\`. Build it
once with:

  cargo build --release --manifest-path packages/desktop/Cargo.toml

Closing the window stops the API.`;

/** Where the compiled shell lands, release first. */
function findShell(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/commands → dist → packages/cli → packages
  const packages = resolve(here, "..", "..", "..");
  const target = join(packages, "desktop", "target");

  const suffix = process.platform === "win32" ? ".exe" : "";
  for (const profile of ["release", "debug"]) {
    const candidate = join(target, profile, `ctxd-desktop${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export async function desktopCommand(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${DESKTOP_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        port: { type: "string" },
        "no-window": { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd desktop: ${(error as Error).message}\n\n${DESKTOP_HELP}\n`);
    return 1;
  }

  const headless = values["no-window"] === true;
  const shell = findShell();

  if (shell === undefined && !headless) {
    // Named as a missing build rather than a broken feature, with the command
    // that fixes it — §13's rule for `doctor` applies to every failure message.
    process.stderr.write(
      "ctxd desktop: the desktop shell has not been built.\n" +
        "  Build it with: cargo build --release --manifest-path packages/desktop/Cargo.toml\n" +
        "  Or run the interface in a browser with: ctxd ui\n",
    );
    return 1;
  }

  const paths = resolvePaths();
  ensureDataDir(paths);
  const config = loadConfig(paths.configFile).config;
  const dir = resolve(values.dir ?? ".");

  // Any free port by default. The window is told where the API actually landed,
  // so nothing has to be reserved in advance or guessed at.
  const port = values.port === undefined ? 0 : Number.parseInt(values.port, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write("ctxd desktop: --port must be between 0 and 65535\n");
    return 1;
  }

  const db = openDatabase(paths.dbFile);
  migrate(db);

  let api;
  try {
    api = await startApiServer({ db, paths, config, dir, port, host: config.ui.host });
  } catch (error) {
    db.close();
    process.stderr.write(`ctxd desktop: ${(error as Error).message}\n`);
    return 1;
  }

  const shutdown = async (): Promise<void> => {
    await api.close();
    db.close();
  };

  if (headless) {
    process.stdout.write(
      `ctxd api listening on ${api.url}\n  inspecting: ${dir}\n` +
        "\nNo window requested. Press Ctrl+C to stop.\n",
    );
    await new Promise<void>((done) => {
      const stop = (): void => void shutdown().then(done);
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return 0;
  }

  process.stdout.write(`ctxd api listening on ${api.url}\n  inspecting: ${dir}\n`);

  const child = spawn(shell as string, [], {
    // The shell refuses anything that is not loopback, so this is the address
    // it will accept and the only kind the API ever binds (§62).
    //
    // The token travels the same way. Mutating routes require it, and a window
    // that could only read would make the desktop build the weakest way to use
    // ctxd. Handing it to the shell rather than serving it over HTTP keeps it
    // out of reach of anything that can merely reach the port: the shell puts
    // it into its own webview, and no request can ask the server for it.
    env: { ...process.env, CTXD_UI_URL: api.url, CTXD_UI_TOKEN: api.token },
    stdio: "inherit",
  });

  const code = await new Promise<number>((done) => {
    const stop = (): void => {
      child.kill();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);

    child.once("error", (error) => {
      process.stderr.write(`ctxd desktop: could not start the window (${error.message})\n`);
      done(1);
    });
    // Closing the window ends the command, which ends the API. One lifetime,
    // so a closed window never leaves a server listening behind it.
    child.once("exit", (status) => done(status ?? 0));
  });

  await shutdown();
  return code;
}
