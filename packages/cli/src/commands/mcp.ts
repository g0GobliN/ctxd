import { ensureDataDir, loadConfig, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";
import { runStdioServer } from "@ctxd/mcp";

export const MCP_HELP = `ctxd mcp — run the MCP server on stdio

Usage:
  ctxd mcp [--dir <path>] [--help]

Exposes ctxd to AI workers (Claude Code, Cursor) over the Model Context
Protocol. Every tool calls the same services as the CLI.

Register it with a worker, for example in Claude Code:

  claude mcp add ctxd -- ctxd mcp

The server speaks JSON-RPC on stdin/stdout, so nothing else may be written to
stdout while it runs.`;

export async function mcpCommand(argv: readonly string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${MCP_HELP}\n`);
    return 0;
  }

  const dirIndex = argv.indexOf("--dir");
  const cwd = dirIndex === -1 ? process.cwd() : (argv[dirIndex + 1] ?? process.cwd());

  const paths = resolvePaths();
  ensureDataDir(paths);
  const config = loadConfig(paths.configFile).config;

  const db = openDatabase(paths.dbFile);
  migrate(db);

  try {
    await runStdioServer({ db, paths, config, cwd });
    return 0;
  } finally {
    db.close();
  }
}
