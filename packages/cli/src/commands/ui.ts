import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { startApiServer, ensureToken } from "@ctxd/api";
import { ensureDataDir, loadConfig, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";

export const UI_HELP = `ctxd ui — serve the local API for the ctxd interface

Usage:
  ctxd ui [--dir <path>] [--port <n>] [options]

Options:
  --dir <path>     Directory the interface inspects (default: .)
  --port <n>       Port to listen on (default: 4317, 0 for any free port)
  --host <addr>    Address to bind (default: 127.0.0.1)
  --print-token    Print the local API token and exit
  --verbose        Log each request
  -h, --help       Show this help

The API binds the loopback interface only. It is not reachable from another
machine, sends nothing anywhere, and reads the same services the CLI uses.

Routes that change state require the local token:
  Authorization: Bearer <token>`;

export async function uiCommand(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${UI_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        dir: { type: "string" },
        port: { type: "string" },
        host: { type: "string" },
        "print-token": { type: "boolean" },
        verbose: { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd ui: ${(error as Error).message}\n\n${UI_HELP}\n`);
    return 1;
  }

  const paths = resolvePaths();
  ensureDataDir(paths);

  if (values["print-token"] === true) {
    process.stdout.write(`${ensureToken(paths.dataDir)}\n`);
    return 0;
  }

  const config = loadConfig(paths.configFile).config;
  const dir = resolve(values.dir ?? ".");

  const port = values.port === undefined ? config.ui.port : Number.parseInt(values.port, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    process.stderr.write("ctxd ui: --port must be between 0 and 65535\n");
    return 1;
  }

  const db = openDatabase(paths.dbFile);
  migrate(db);

  let api;
  try {
    api = await startApiServer({
      db,
      paths,
      config,
      dir,
      port,
      host: values.host ?? config.ui.host,
      ...(values.verbose === true
        ? { onRequest: (line: string) => process.stdout.write(`  ${line}\n`) }
        : {}),
    });
  } catch (error) {
    db.close();
    process.stderr.write(`ctxd ui: ${(error as Error).message}\n`);
    return 1;
  }

  process.stdout.write(
    `ctxd api listening on ${api.url}\n` +
      `  inspecting: ${dir}\n` +
      `  token:      ctxd ui --print-token\n` +
      "\nLocal only — nothing is sent anywhere. Press Ctrl+C to stop.\n",
  );

  // Shut the socket and the database down cleanly so a restart does not hit a
  // stale WAL or a port still in TIME_WAIT.
  await new Promise<void>((resolvePromise) => {
    const stop = (): void => {
      process.stdout.write("\nstopping…\n");
      void api.close().then(() => {
        db.close();
        resolvePromise();
      });
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });

  return 0;
}
