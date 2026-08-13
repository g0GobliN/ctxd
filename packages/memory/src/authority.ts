import type { Memory, MemorySource } from "./types.js";

/**
 * Authority order, strongest first:
 *
 *   explicit user instruction
 *     > project rule
 *     > accepted decision
 *     > verified code state
 *     > verified Git history
 *     > worker statement
 *     > inferred memory
 *
 * Lower index means higher authority.
 */
const AUTHORITY_ORDER: readonly MemorySource[] = [
  "explicit_user",
  "project_rule",
  "accepted_decision",
  "verified_code",
  "verified_git",
  "worker_statement",
  "inferred",
];

/** Rank of a source; smaller is more authoritative. */
export function authorityRank(source: MemorySource): number {
  return AUTHORITY_ORDER.indexOf(source);
}

/** True when `a` outranks `b`. */
export function outranks(a: MemorySource, b: MemorySource): boolean {
  return authorityRank(a) < authorityRank(b);
}

/** Sources that represent something a human or the repository actually stated. */
export function isInferred(source: MemorySource): boolean {
  return source === "inferred" || source === "worker_statement";
}

export interface OverrideDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Decide whether a new memory may replace an existing one.
 *
 * The rule that matters: an inferred memory must never silently override an
 * explicit instruction or a project rule. It can be recorded alongside — the
 * conflict is surfaced rather than resolved by whoever wrote last.
 *
 * Equal authority is allowed to update: a newer explicit instruction is simply
 * the developer changing their mind.
 */
export function canOverride(incoming: Memory, existing: Memory): OverrideDecision {
  if (existing.status !== "active") {
    return { allowed: true, reason: "existing memory is not active" };
  }

  if (outranks(incoming.source, existing.source)) {
    return {
      allowed: true,
      reason: `${incoming.source} outranks ${existing.source}`,
    };
  }

  if (incoming.source === existing.source) {
    return { allowed: true, reason: "same authority, treated as an update" };
  }

  return {
    allowed: false,
    reason:
      `${incoming.source} may not override ${existing.source} ` +
      `(${existing.title}); record it separately and resolve the conflict explicitly`,
  };
}

/**
 * Default confidence for a source.
 *
 * Anything a human or the repository stated directly is certain. Everything
 * derived carries visible doubt, so nothing downstream can mistake a guess for
 * a fact.
 */
export function defaultConfidence(source: MemorySource): number {
  switch (source) {
    case "explicit_user":
    case "project_rule":
      return 1;
    case "accepted_decision":
      return 0.95;
    case "verified_code":
    case "verified_git":
      return 0.9;
    case "worker_statement":
      return 0.7;
    case "inferred":
      return 0.6;
  }
}
