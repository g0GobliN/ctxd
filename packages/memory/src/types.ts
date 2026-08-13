import type { Priority } from "@ctxd/context";

export type MemoryType =
  | "FACT"
  | "DECISION"
  | "ARCHITECTURE"
  | "CONSTRAINT"
  | "RULE"
  | "BUG"
  | "TASK"
  | "NOTE"
  | "EXPERIMENT"
  | "PREFERENCE"
  | "FILE"
  | "SNAPSHOT"
  | "SESSION"
  | "CONVERSATION";

export const MEMORY_TYPES: readonly MemoryType[] = [
  "FACT",
  "DECISION",
  "ARCHITECTURE",
  "CONSTRAINT",
  "RULE",
  "BUG",
  "TASK",
  "NOTE",
  "EXPERIMENT",
  "PREFERENCE",
  "FILE",
  "SNAPSHOT",
  "SESSION",
  "CONVERSATION",
];

/**
 * Where a memory came from.
 *
 * This is not decoration: it determines authority. A statement inferred from a
 * worker's output must never quietly overrule something the developer said.
 */
export type MemorySource =
  | "explicit_user"
  | "project_rule"
  | "accepted_decision"
  | "verified_code"
  | "verified_git"
  | "worker_statement"
  | "inferred";

export const MEMORY_SOURCES: readonly MemorySource[] = [
  "explicit_user",
  "project_rule",
  "accepted_decision",
  "verified_code",
  "verified_git",
  "worker_statement",
  "inferred",
];

export type MemoryStatus = "active" | "superseded" | "archived";

export const MEMORY_STATUSES: readonly MemoryStatus[] = ["active", "superseded", "archived"];

export interface Memory {
  readonly id: string;
  readonly projectId: string;
  readonly type: MemoryType;
  readonly title: string;
  readonly content: string;
  readonly importance: Priority;
  /** 0–1. Anything below 1 is an inference, and is treated as one. */
  readonly confidence: number;
  readonly source: MemorySource;
  readonly status: MemoryStatus;
  readonly tags: readonly string[];
  readonly hash: string;
  /** Set when the full text lives in a Markdown file instead of the database. */
  readonly bodyPath: string | null;
  readonly supersedes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastAccessedAt: string | null;
}

export function isMemoryType(value: string): value is MemoryType {
  return (MEMORY_TYPES as readonly string[]).includes(value);
}

export function isMemorySource(value: string): value is MemorySource {
  return (MEMORY_SOURCES as readonly string[]).includes(value);
}

export function isMemoryStatus(value: string): value is MemoryStatus {
  return (MEMORY_STATUSES as readonly string[]).includes(value);
}
