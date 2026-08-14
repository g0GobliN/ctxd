import { parseArgs } from "node:util";
import { basename, resolve } from "node:path";
import { ensureDataDir, resolvePaths } from "@ctxd/core";
import { migrate, openDatabase } from "@ctxd/db";
import { formatMemoryMatches, memoriesForPaths, type MemoryMatch } from "@ctxd/memory";
import { detectProject, findProjectByRoot } from "@ctxd/project";
import { record } from "../events.js";
import {
  analyzeWorkingTree,
  formatChangeReceipt,
  isGitRepository,
  writeChangeReceipt,
  type DiffScope,
  type VerificationStatus,
} from "@ctxd/diff";

export const DIFF_HELP = `ctxd diff — inspect a worker's changes before accepting them

Usage:
  ctxd diff [--task <text>] [--dir <path>] [options]

Options:
  --task <text>       What the worker was asked to do; sets the expected scope
  --dir <path>        Repository to inspect (default: .)
  --staged            Inspect the index only, instead of all uncommitted work
  --range <rev>       Inspect a revision range, e.g. main...HEAD
  --path <path>       Limit to a path; repeatable
  --expect <path>     Declare a path as in scope; repeatable
  --worker <name>     Worker that made the change (default: unknown)
  --verification <s>  Record a verification result: PASS, FAIL or NEEDS_REVIEW
  --json              Print the Change Receipt as JSON
  --no-save           Do not write the receipt to ~/.ctxd/change_receipts
  --no-memory         Do not surface decisions, bugs or file notes
  -h, --help          Show this help

ctxd reads the diff and never writes to Git. It does not revert formatting,
delete comments or reject a change — a large diff is not wrong by itself. It
reports what changed, what the task did not ask for, and why.

Exit code 2 means the change is worth reviewing before continuing.`;

const VERIFICATION_VALUES: readonly VerificationStatus[] = [
  "PASS",
  "FAIL",
  "NEEDS_REVIEW",
  "UNKNOWN",
];

export function diffCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${DIFF_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        task: { type: "string" },
        dir: { type: "string" },
        staged: { type: "boolean" },
        range: { type: "string" },
        path: { type: "string", multiple: true },
        expect: { type: "string", multiple: true },
        worker: { type: "string" },
        verification: { type: "string" },
        json: { type: "boolean" },
        "no-save": { type: "boolean" },
        "no-memory": { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd diff: ${(error as Error).message}\n\n${DIFF_HELP}\n`);
    return 1;
  }

  if (values.staged === true && values.range !== undefined) {
    process.stderr.write("ctxd diff: --staged and --range cannot be combined\n");
    return 1;
  }

  let verification: VerificationStatus | undefined;
  if (values.verification !== undefined) {
    const upper = values.verification.toUpperCase() as VerificationStatus;
    if (!VERIFICATION_VALUES.includes(upper)) {
      process.stderr.write(
        `ctxd diff: --verification must be one of ${VERIFICATION_VALUES.join(", ")}\n`,
      );
      return 1;
    }
    verification = upper;
  }

  const dir = resolve(values.dir ?? ".");
  if (!isGitRepository(dir)) {
    process.stderr.write(
      `ctxd diff: ${dir} is not a git repository.\n` +
        "The Diff Firewall reads changes from Git; run this inside a repository.\n",
    );
    return 1;
  }

  const scope: DiffScope =
    values.range !== undefined ? "range" : values.staged === true ? "staged" : "working";

  let analysis;
  try {
    analysis = analyzeWorkingTree({
      cwd: dir,
      scope,
      project: basename(dir),
      ...(values.range === undefined ? {} : { range: values.range }),
      ...(values.task === undefined ? {} : { task: values.task }),
      ...(values.path === undefined ? {} : { paths: values.path }),
      ...(values.expect === undefined ? {} : { expectedPaths: values.expect }),
      ...(values.worker === undefined ? {} : { worker: values.worker }),
      ...(verification === undefined ? {} : { verification }),
    });
  } catch (error) {
    process.stderr.write(`ctxd diff: ${(error as Error).message}\n`);
    return 1;
  }

  const { receipt } = analysis;

  // §45, §46, §47: a decision, a past bug or a file note is only worth
  // recording if it comes back when the code it concerns is touched. This is
  // that moment.
  let matches: readonly MemoryMatch[] = [];
  if (values["no-memory"] !== true && receipt.files_changed > 0) {
    try {
      const paths = resolvePaths();
      const db = openDatabase(paths.dbFile);
      try {
        migrate(db);
        const project = findProjectByRoot(db, detectProject(dir).root);
        if (project !== undefined) {
          matches = memoriesForPaths(
            db,
            project.id,
            receipt.files.map((file) => file.path),
            { limit: 10 },
          );
        }
      } finally {
        db.close();
      }
    } catch {
      // Surfacing memory is an enhancement to the review, not a precondition
      // for it. An unreadable database must not stop the diff being reported.
    }
  }

  if (values["no-save"] !== true) {
    try {
      const paths = resolvePaths();
      ensureDataDir(paths);
      writeChangeReceipt(paths.changeReceiptsDir, receipt);
    } catch (error) {
      process.stderr.write(`ctxd diff: could not save receipt (${(error as Error).message})\n`);
    }
  }

  // The verdict and the counts behind it. The receipt id is included so the
  // interface can open the full analysis; the diff itself never travels on the
  // event stream, which every local process can read.
  record(dir, "change_analyzed", {
    worker: values.worker,
    data: {
      requestId: receipt.request_id,
      classification: receipt.classification,
      risk: receipt.risk,
      filesChanged: receipt.files_changed,
      semanticLines: receipt.semantic_lines,
      formattingLines: receipt.formatting_lines,
      unrelatedFiles: receipt.unrelated_files.length,
      verificationStatus: receipt.verification_status,
    },
  });

  if (values.json === true) {
    process.stdout.write(
      `${JSON.stringify({ ...receipt, relevant_memory: matches }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(`${formatChangeReceipt(receipt)}\n`);
    if (matches.length > 0) {
      process.stdout.write(`\n${"─".repeat(60)}\n${formatMemoryMatches(matches)}\n`);
    }
    if (receipt.files_changed === 0) {
      process.stdout.write("\nNo changes found in the selected scope.\n");
    } else if (values.task === undefined) {
      process.stdout.write(
        "\nNo --task was given, so no file could be judged unrelated. " +
          "Pass --task to get a change surface warning.\n",
      );
    }
  }

  const needsReview =
    receipt.classification === "NEEDS_REVIEW" ||
    receipt.classification === "SUSPICIOUS" ||
    receipt.classification === "BROAD";
  return needsReview ? 2 : 0;
}
