import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Memory } from "./types.js";

/**
 * Content longer than this is written to a Markdown file and only excerpted in
 * the database. Large blobs do not belong in SQLite, and durable engineering
 * knowledge should stay readable without a query tool.
 */
export const EXTERNALIZE_ABOVE_BYTES = 8 * 1024;

/** Excerpt kept in the database (and indexed) for an externalised memory. */
export const EXCERPT_BYTES = 2 * 1024;

export interface ExternalizedContent {
  /** What goes in the database — the whole text, or an excerpt of it. */
  readonly stored: string;
  /** Set when the full text was written to a file. */
  readonly bodyPath: string | null;
  readonly externalized: boolean;
}

function memoryFileName(id: string): string {
  return `${id}.md`;
}

/**
 * Decide where a memory's text lives and write the Markdown copy.
 *
 * Short memories live entirely in the database. Long ones are written to
 * `~/.ctxd/projects/<project>/memory/<id>.md`, with an excerpt kept in the
 * database so search still finds them — the excerpt is what FTS5 indexes, and
 * that limitation is deliberate rather than hidden.
 */
export function writeMemoryBody(
  memoryDir: string,
  id: string,
  title: string,
  content: string,
): ExternalizedContent {
  if (Buffer.byteLength(content, "utf8") <= EXTERNALIZE_ABOVE_BYTES) {
    return { stored: content, bodyPath: null, externalized: false };
  }

  mkdirSync(memoryDir, { recursive: true, mode: 0o700 });
  const path = join(memoryDir, memoryFileName(id));
  writeFileSync(path, `# ${title}\n\n${content}\n`, { mode: 0o600 });

  return {
    stored: `${content.slice(0, EXCERPT_BYTES)}\n\n… full text in ${memoryFileName(id)}`,
    bodyPath: path,
    externalized: true,
  };
}

/** Render a memory as Markdown with front matter, for human-readable export. */
export function toMarkdown(memory: Memory): string {
  return `---
id: ${memory.id}
type: ${memory.type}
importance: ${memory.importance}
confidence: ${memory.confidence}
source: ${memory.source}
status: ${memory.status}
tags: ${memory.tags.join(", ")}
created: ${memory.createdAt}
updated: ${memory.updatedAt}
---

# ${memory.title}

${memory.content}
`;
}

/**
 * Write the per-type digest files the project storage layout expects
 * (`rules.md`, `decisions.md`, `bugs.md`, …), so the knowledge is readable
 * without ctxd installed.
 */
export function writeMemoryDigests(projectDir: string, memories: readonly Memory[]): string[] {
  const groups: readonly (readonly [string, readonly Memory["type"][]])[] = [
    ["rules.md", ["RULE", "CONSTRAINT"]],
    ["decisions.md", ["DECISION"]],
    ["bugs.md", ["BUG"]],
    ["architecture.md", ["ARCHITECTURE"]],
    ["tasks.md", ["TASK"]],
  ];

  const written: string[] = [];

  for (const [file, types] of groups) {
    const matching = memories.filter(
      (memory) => types.includes(memory.type) && memory.status === "active",
    );

    const heading = file.replace(".md", "");
    const body =
      matching.length === 0
        ? `No ${heading} recorded yet.\n`
        : matching
            .map(
              (memory) =>
                `## ${memory.title}\n\n` +
                `- importance: ${memory.importance}\n` +
                `- source: ${memory.source} (confidence ${memory.confidence})\n\n` +
                `${memory.content}\n`,
            )
            .join("\n");

    writeFileSync(join(projectDir, file), `# ${heading}\n\n${body}`, { mode: 0o600 });
    written.push(file);
  }

  return written;
}
