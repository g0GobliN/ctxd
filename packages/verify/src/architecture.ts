/**
 * Architecture drift detection (§44).
 *
 * Rules are deterministic pattern checks: "files matching X must not reference
 * Y". No model is involved, and none is required — §44 is explicit that V1 uses
 * pattern rules and must not need an LLM per check.
 *
 * A rule reports the rule text and the violating file. It never edits anything.
 */

import type { FileDiff } from "@ctxd/diff";

export interface ArchitectureRule {
  readonly id: string;
  /** The rule as a person would state it, quoted verbatim in the report. */
  readonly rule: string;
  /** Files this rule governs, as a regular expression over the path. */
  readonly appliesTo: string;
  /** What those files must not contain. */
  readonly forbids: string;
  /** Paths exempt from the rule. */
  readonly except?: readonly string[];
}

export interface ArchitectureViolation {
  readonly ruleId: string;
  readonly rule: string;
  readonly path: string;
  /** The line that violates the rule, trimmed. */
  readonly line: string;
  readonly lineNumber: number | undefined;
}

interface CompiledRule {
  readonly definition: ArchitectureRule;
  readonly appliesTo: RegExp;
  readonly forbids: RegExp;
  readonly except: readonly RegExp[];
}

/**
 * Compile rules, discarding any whose patterns are invalid.
 *
 * A malformed rule is reported rather than silently ignored: a rule that never
 * fires because its regex does not compile would be worse than no rule, because
 * it would look like protection.
 */
export function compileRules(rules: readonly ArchitectureRule[]): {
  compiled: CompiledRule[];
  errors: string[];
} {
  const compiled: CompiledRule[] = [];
  const errors: string[] = [];

  for (const definition of rules) {
    try {
      compiled.push({
        definition,
        appliesTo: new RegExp(definition.appliesTo, "i"),
        forbids: new RegExp(definition.forbids, "i"),
        except: (definition.except ?? []).map((pattern) => new RegExp(pattern, "i")),
      });
    } catch (error) {
      errors.push(`rule "${definition.id}" has an invalid pattern: ${(error as Error).message}`);
    }
  }

  return { compiled, errors };
}

/**
 * Check the changed lines of a diff against the rules.
 *
 * Only *added* lines are checked. A rule that fired on removed lines would
 * report a violation the worker just deleted.
 */
export function detectDrift(
  files: readonly FileDiff[],
  rules: readonly ArchitectureRule[],
): { violations: ArchitectureViolation[]; errors: string[] } {
  const { compiled, errors } = compileRules(rules);
  const violations: ArchitectureViolation[] = [];

  for (const file of files) {
    if (file.binary) continue;

    for (const rule of compiled) {
      if (!rule.appliesTo.test(file.path)) continue;
      if (rule.except.some((pattern) => pattern.test(file.path))) continue;

      for (const hunk of file.hunks) {
        let lineNumber = hunk.newStart;
        for (const line of hunk.lines) {
          if (line.kind === "removed") continue;
          if (line.kind === "added" && rule.forbids.test(line.text)) {
            violations.push({
              ruleId: rule.definition.id,
              rule: rule.definition.rule,
              path: file.path,
              line: line.text.trim(),
              lineNumber,
            });
          }
          lineNumber += 1;
        }
      }
    }
  }

  return { violations, errors };
}

/** Render violations in the shape §44 specifies. */
export function formatDrift(violations: readonly ArchitectureViolation[]): string {
  if (violations.length === 0) return "No architecture drift detected.";

  const lines: string[] = ["ARCHITECTURE DRIFT DETECTED", ""];
  const byRule = new Map<string, ArchitectureViolation[]>();

  for (const violation of violations) {
    const bucket = byRule.get(violation.rule);
    if (bucket === undefined) byRule.set(violation.rule, [violation]);
    else bucket.push(violation);
  }

  for (const [rule, found] of byRule) {
    lines.push("Rule:", rule, "", "Violation:");
    for (const violation of found) {
      const where =
        violation.lineNumber === undefined ? violation.path : `${violation.path}:${violation.lineNumber}`;
      lines.push(`${where}`, `  ${violation.line}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Example rules, shipped as documentation rather than defaults.
 *
 * ctxd applies no architecture rule it was not given: every project's
 * boundaries are different, and a rule invented by the tool would fire on
 * correct code.
 */
export const EXAMPLE_RULES: readonly ArchitectureRule[] = [
  {
    id: "frontend-no-database",
    rule: "Frontend must not access the database directly.",
    appliesTo: "(^|/)(apps|packages)/(portal|web|frontend|ui)/",
    forbids: "\\b(createPool|new Pool|knex\\(|mongoose\\.|firebase-admin|prisma\\.\\$)",
  },
  {
    id: "core-no-provider-sdk",
    rule: "Core must not depend on a model provider SDK.",
    appliesTo: "(^|/)packages/core/",
    forbids: "@anthropic-ai/|openai|@google/gener",
  },
];
