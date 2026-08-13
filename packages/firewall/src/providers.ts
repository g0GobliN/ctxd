import { createHash } from "node:crypto";
import {
  heuristicEstimator,
  type ContextItem,
  type Priority,
  type TaskSignals,
  type TokenEstimator,
} from "@ctxd/context";
import type { Db } from "@ctxd/db";
import {
  listMemories,
  searchMemories,
  touchMemory,
  type Memory,
  type SearchHit,
} from "@ctxd/memory";
import type { GitInfo } from "@ctxd/project";

/**
 * A source of context candidates other than the filesystem.
 *
 * Every provider returns items carrying a `reason`: the evidence for why the
 * item was retrieved. Nothing enters the context without one.
 */
export interface RetrievalProvider {
  readonly name: string;
  retrieve(signals: TaskSignals): ContextItem[];
}

function makeItem(
  id: string,
  path: string,
  content: string,
  type: ContextItem["type"],
  priority: Priority,
  mtime: number,
  reason: string,
  estimator: TokenEstimator,
): ContextItem {
  return {
    id,
    path,
    content,
    tokenCount: estimator.count(content),
    tokenCountType: estimator.accuracy,
    type,
    priority,
    mtime,
    hash: createHash("sha256").update(content).digest("hex"),
    reason,
  };
}

export interface MemoryProviderOptions {
  readonly limit?: number;
  readonly estimator?: TokenEstimator;
  /** Record that retrieved memories were used. */
  readonly touch?: boolean;
}

/**
 * Retrieve project memory relevant to the task.
 *
 * The query is the task's own vocabulary, so a task about Stripe idempotency
 * pulls in the rules, decisions and past bugs that bear on it — the knowledge a
 * new session would otherwise have to be told again.
 *
 * Importance carries over as context priority: a P0 rule stays mandatory once
 * it reaches the context engine.
 */
export function memoryProvider(
  db: Db,
  projectId: string,
  options: MemoryProviderOptions = {},
): RetrievalProvider {
  const estimator = options.estimator ?? heuristicEstimator;

  return {
    name: "memory",
    retrieve(signals) {
      // Mandatory memories are retrieved unconditionally. A binding rule that
      // happens not to share vocabulary with the task is still binding, and a
      // worker that never sees it will break it. Search decides what is
      // *relevant*; it does not get to decide what is *mandatory*.
      const mandatory = listMemories(db, projectId, {
        importance: "P0",
        status: "active",
        limit: 50,
      });

      const found =
        signals.terms.length === 0
          ? []
          : searchMemories(db, signals.terms.join(" "), {
              projectId,
              limit: options.limit ?? 12,
            }).map((hit: SearchHit) => hit.memory);

      const byId = new Map<string, Memory>();
      for (const memory of [...mandatory, ...found]) byId.set(memory.id, memory);

      return [...byId.values()].map((memory) => {
        if (options.touch === true) touchMemory(db, memory.id);

        const content = `# ${memory.title}\n\n${memory.content}\n`;
        const why =
          memory.importance === "P0"
            ? `mandatory project memory (${memory.type.toLowerCase()}, ${memory.source})`
            : `project memory (${memory.type.toLowerCase()}, ${memory.source}, confidence ${memory.confidence})`;

        return makeItem(
          `memory:${memory.id}`,
          `memory/${memory.type.toLowerCase()}/${slug(memory.title)}.md`,
          content,
          "memory",
          memory.importance,
          Date.parse(memory.updatedAt),
          why,
          estimator,
        );
      });
    },
  };
}

/**
 * Represent current Git state as a single context item.
 *
 * What changed right now is almost always relevant to what is being worked on,
 * so this is P1. It is a summary, not a diff dump: the branch, the changed
 * files and recent commit subjects. A worker that needs the diff itself can
 * ask Git, which remains the source of truth.
 */
export function gitProvider(
  git: GitInfo,
  options: { readonly estimator?: TokenEstimator; readonly now?: number } = {},
): RetrievalProvider {
  const estimator = options.estimator ?? heuristicEstimator;

  return {
    name: "git",
    retrieve() {
      if (git.insideWorkTree !== true) return [];

      const changes = git.changes ?? [];
      const commits = git.recentCommits ?? [];
      if (changes.length === 0 && commits.length === 0) return [];

      const lines = [
        `# Git state`,
        ``,
        `branch: ${git.branch ?? "unknown"}`,
        ``,
        `## Uncommitted changes (${changes.length})`,
        ``,
        ...(changes.length === 0
          ? ["none"]
          : changes.slice(0, 40).map((change) => `- ${change.status} ${change.path}`)),
        ``,
        `## Recent commits`,
        ``,
        ...(commits.length === 0
          ? ["none"]
          : commits.slice(0, 10).map((c) => `- ${c.hash.slice(0, 8)} ${c.subject}`)),
      ];

      return [
        makeItem(
          "git:state",
          "git/state.md",
          `${lines.join("\n")}\n`,
          "git",
          "P1",
          options.now ?? Date.now(),
          "current repository state",
          estimator,
        ),
      ];
    },
  };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
