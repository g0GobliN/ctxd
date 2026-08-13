import { parseArgs } from "node:util";
import { resolvePaths } from "@ctxd/core";
import { collectStats, formatEfficiency, formatStats, startOfToday } from "@ctxd/stats";

export const STATS_HELP = `ctxd stats — what ctxd has kept out of the model's context

Usage:
  ctxd stats [--today] [--since <iso>] [--json]

Options:
  --today         Only receipts from today
  --since <iso>   Only receipts at or after this timestamp
  --limit <n>     Read at most this many receipts of each kind
  --json          Print the raw figures as JSON
  -h, --help      Show this help

Counts are estimates from a local heuristic tokenizer. ctxd has no billing data
and never reports a cost — only "estimated context avoided".`;

export const EFFICIENCY_HELP = STATS_HELP.replace(
  "ctxd stats — what ctxd has kept out of the model's context",
  "ctxd efficiency — the context reduction, on its own",
).replace("ctxd stats [", "ctxd efficiency [");

function run(argv: readonly string[], help: string, efficiencyOnly: boolean): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${help}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        today: { type: "boolean" },
        since: { type: "string" },
        limit: { type: "string" },
        json: { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd: ${(error as Error).message}\n\n${help}\n`);
    return 1;
  }

  if (values.today === true && values.since !== undefined) {
    process.stderr.write("ctxd: --today and --since cannot be combined\n");
    return 1;
  }

  let since: string | undefined;
  let scope = "all time";
  if (values.today === true) {
    since = startOfToday();
    scope = "today";
  } else if (values.since !== undefined) {
    if (!Number.isFinite(Date.parse(values.since))) {
      process.stderr.write(`ctxd: --since is not a valid timestamp: ${values.since}\n`);
      return 1;
    }
    since = values.since;
    scope = `since ${values.since}`;
  }

  let limit: number | undefined;
  if (values.limit !== undefined) {
    limit = Number.parseInt(values.limit, 10);
    if (!Number.isInteger(limit) || limit <= 0) {
      process.stderr.write("ctxd: --limit must be a positive integer\n");
      return 1;
    }
  }

  const paths = resolvePaths();
  const stats = collectStats({
    contextReceiptsDir: paths.contextReceiptsDir,
    changeReceiptsDir: paths.changeReceiptsDir,
    ...(since === undefined ? {} : { since }),
    ...(limit === undefined ? {} : { limit }),
  });

  if (values.json === true) {
    process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${efficiencyOnly ? formatEfficiency(stats, scope) : formatStats(stats, scope)}\n`,
    );
  }

  return 0;
}

export function statsCommand(argv: readonly string[]): number {
  return run(argv, STATS_HELP, false);
}

export function efficiencyCommand(argv: readonly string[]): number {
  return run(argv, EFFICIENCY_HELP, true);
}
