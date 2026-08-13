import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { ensureDataDir, loadConfig, resolvePaths } from "@ctxd/core";
import { formatReceipt, writeReceipt } from "@ctxd/context";
import { migrate, openDatabase } from "@ctxd/db";
import { buildProjectContext } from "@ctxd/firewall";

export const CONTEXT_HELP = `ctxd context — build the minimum useful context for a task

Usage:
  ctxd context --task <text> [--dir <path>] [--budget <tokens>] [options]

Options:
  --task <text>      What the worker is being asked to do (required)
  --dir <path>       Directory to draw context from (default: .)
  --budget <tokens>  Maximum estimated tokens in the final context (default: 10000)
  --context          Print the assembled context instead of the receipt
  --json             Print the receipt as JSON
  --no-save          Do not write the receipt to ~/.ctxd/context_receipts
  -h, --help         Show this help

Everything runs locally: no network call, no model, no embeddings. Token
counts are estimates, never exact provider billing units.`;

export function contextCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${CONTEXT_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        task: { type: "string" },
        dir: { type: "string" },
        budget: { type: "string" },
        context: { type: "boolean" },
        json: { type: "boolean" },
        "no-save": { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd context: ${(error as Error).message}\n\n${CONTEXT_HELP}\n`);
    return 1;
  }

  const task = values.task;
  if (task === undefined || task.trim() === "") {
    process.stderr.write(`ctxd context: --task is required\n\n${CONTEXT_HELP}\n`);
    return 1;
  }

  const budget = values.budget === undefined ? 10000 : Number.parseInt(values.budget, 10);
  if (!Number.isInteger(budget) || budget <= 0) {
    process.stderr.write(`ctxd context: --budget must be a positive integer\n`);
    return 1;
  }

  const dir = resolve(values.dir ?? ".");
  const paths = resolvePaths();
  const config = loadConfig(paths.configFile).config;

  let result;
  const db = openDatabase(paths.dbFile);
  try {
    ensureDataDir(paths);
    migrate(db);
    result = buildProjectContext({
      task,
      dir,
      budget,
      db,
      config,
      touchMemories: true,
    });
  } catch (error) {
    process.stderr.write(`ctxd context: ${(error as Error).message}\n`);
    return 1;
  } finally {
    db.close();
  }

  if (values["no-save"] !== true) {
    try {
      writeReceipt(paths.contextReceiptsDir, result.receipt);
    } catch (error) {
      process.stderr.write(`ctxd context: could not save receipt (${(error as Error).message})\n`);
    }
  }

  if (values.context === true) {
    process.stdout.write(result.context);
  } else if (values.json === true) {
    process.stdout.write(`${JSON.stringify(result.receipt, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatReceipt(result.receipt)}\n`);
    if (result.project === undefined) {
      process.stdout.write(
        `\nThis directory is not a registered ctxd project, so no project memory ` +
          `was available. Run: ctxd init --dir ${dir}\n`,
      );
    } else {
      const sources = Object.entries(result.retrieved)
        .filter(([, count]) => count > 0)
        .map(([name, count]) => `${name}: ${count}`);
      if (sources.length > 0) {
        process.stdout.write(`\nRetrieved beyond the filesystem — ${sources.join(", ")}\n`);
      }
    }
  }

  // A context that could not carry a mandatory item is a warning, not a
  // silent success.
  return result.selection.warnings.length > 0 ? 2 : 0;
}
