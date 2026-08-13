import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { isGitRepository, readDiff } from "@ctxd/diff";
import {
  buildCorrectionContext,
  formatVerification,
  verify,
  type ArchitectureRule,
  type CheckKind,
} from "@ctxd/verify";

export const VERIFY_HELP = `ctxd verify — run the project's own checks against a worker's changes

Usage:
  ctxd verify [--task <text>] [--dir <path>] [options]

Options:
  --task <text>     What the worker was asked to do
  --dir <path>      Repository to verify (default: .)
  --only <kinds>    Comma-separated: typecheck, lint, test, build
  --rules <file>    JSON file of architecture rules (§44)
  --correction      On failure, print the compact correction context (§43)
  --dry-run         Show which checks would run, without running them
  --json            Print the result as JSON
  -h, --help        Show this help

ctxd runs the project's own scripts — it does not reimplement your test runner,
and it never reports a check as passed unless that check actually ran.

On failure, --correction prints only the failure and the code it points at.
Never resend the original context: the worker already has it.

Exit codes: 0 PASS · 1 FAIL · 2 NEEDS_REVIEW`;

const CHECK_KINDS: readonly CheckKind[] = ["typecheck", "lint", "test", "build"];

function loadRules(path: string): readonly ArchitectureRule[] {
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { rules?: unknown }).rules;

  if (!Array.isArray(list)) {
    throw new Error("expected a JSON array of rules, or an object with a \"rules\" array");
  }

  return list.map((entry, index) => {
    const rule = entry as Partial<ArchitectureRule>;
    if (
      typeof rule.id !== "string" ||
      typeof rule.rule !== "string" ||
      typeof rule.appliesTo !== "string" ||
      typeof rule.forbids !== "string"
    ) {
      throw new Error(`rule ${index} needs id, rule, appliesTo and forbids as strings`);
    }
    return {
      id: rule.id,
      rule: rule.rule,
      appliesTo: rule.appliesTo,
      forbids: rule.forbids,
      ...(Array.isArray(rule.except) ? { except: rule.except as readonly string[] } : {}),
    };
  });
}

export function verifyCommand(argv: readonly string[]): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(`${VERIFY_HELP}\n`);
    return 0;
  }

  let values;
  try {
    ({ values } = parseArgs({
      args: argv as string[],
      options: {
        task: { type: "string" },
        dir: { type: "string" },
        only: { type: "string" },
        rules: { type: "string" },
        correction: { type: "boolean" },
        "dry-run": { type: "boolean" },
        json: { type: "boolean" },
      },
      allowPositionals: false,
      strict: true,
    }));
  } catch (error) {
    process.stderr.write(`ctxd verify: ${(error as Error).message}\n\n${VERIFY_HELP}\n`);
    return 1;
  }

  const dir = resolve(values.dir ?? ".");

  let only: CheckKind[] | undefined;
  if (values.only !== undefined) {
    only = values.only.split(",").map((kind) => kind.trim().toLowerCase() as CheckKind);
    const unknown = only.filter((kind) => !CHECK_KINDS.includes(kind));
    if (unknown.length > 0) {
      process.stderr.write(
        `ctxd verify: unknown check(s) ${unknown.join(", ")}; expected ${CHECK_KINDS.join(", ")}\n`,
      );
      return 1;
    }
  }

  let rules: readonly ArchitectureRule[] = [];
  if (values.rules !== undefined) {
    try {
      rules = loadRules(resolve(values.rules));
    } catch (error) {
      process.stderr.write(`ctxd verify: could not read rules — ${(error as Error).message}\n`);
      return 1;
    }
  }

  // Architecture rules are checked against the diff, so they need Git.
  const files = isGitRepository(dir) ? readDiff({ cwd: dir }).files : [];
  if (!isGitRepository(dir) && rules.length > 0) {
    process.stderr.write(
      `ctxd verify: ${dir} is not a git repository, so architecture rules cannot be checked\n`,
    );
    return 1;
  }

  const result = verify({
    cwd: dir,
    files,
    rules,
    ...(only === undefined ? {} : { only }),
    ...(values["dry-run"] === true ? { dryRun: true } : {}),
  });

  if (values.json === true) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatVerification(result)}\n`);
  }

  if (values.correction === true && result.status !== "PASS") {
    const correction = buildCorrectionContext({
      task: values.task ?? "(no task supplied)",
      result,
      readFile: (path) => {
        try {
          return readFileSync(isAbsolute(path) ? path : join(dir, path), "utf8");
        } catch {
          return undefined;
        }
      },
    });

    if (correction.text !== "") {
      process.stdout.write(`\n${"─".repeat(60)}\n${correction.text}\n`);
      process.stdout.write(
        `\n(${correction.estimatedTokens} estimated tokens — the original context was not resent)\n`,
      );
    }
  }

  if (result.status === "FAIL") return 1;
  if (result.status === "PASS") return 0;
  return 2;
}
