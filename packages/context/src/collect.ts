import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { classifyItem, defaultPriority, readFrontMatterPriority } from "./classify.js";
import { heuristicEstimator, type TokenEstimator } from "./estimator.js";
import {
  compileIgnoreRules,
  DEFAULT_IGNORE_PATTERNS,
  isIgnored,
  readIgnoreFile,
  type IgnoreRule,
} from "./ignore.js";
import type { ContextItem } from "./types.js";

export interface CollectOptions {
  readonly estimator?: TokenEstimator;
  /** Files larger than this are skipped entirely. */
  readonly maxFileBytes?: number;
  /** Extra ignore patterns, applied on top of defaults and ignore files. */
  readonly ignore?: readonly string[];
}

export interface CollectResult {
  readonly items: readonly ContextItem[];
  /** Paths skipped, with the reason — surfaced for debugging, never silent. */
  readonly skipped: readonly { readonly path: string; readonly reason: string }[];
}

const DEFAULT_MAX_FILE_BYTES = 512 * 1024;

function toPosix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

/** Files containing NUL bytes are binary and are never useful as context. */
function looksBinary(buffer: Buffer): boolean {
  const window = buffer.subarray(0, Math.min(buffer.length, 8000));
  return window.includes(0);
}

/**
 * Walk a directory and build context candidates.
 *
 * Everything here is local and deterministic: no network, no model, no
 * embeddings. Ignore rules are honoured so secrets never enter the candidate
 * pool in the first place.
 */
export function collectCandidates(root: string, options: CollectOptions = {}): CollectResult {
  const estimator = options.estimator ?? heuristicEstimator;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  const rules: IgnoreRule[] = [
    ...compileIgnoreRules(DEFAULT_IGNORE_PATTERNS, "default"),
    ...compileIgnoreRules(options.ignore ?? [], "options"),
    ...readIgnoreFile(join(root, ".gitignore")),
    ...readIgnoreFile(join(root, ".ctxdignore")),
  ];

  const items: ContextItem[] = [];
  const skipped: { path: string; reason: string }[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      skipped.push({ path: toPosix(relative(root, dir)), reason: (error as Error).message });
      return;
    }

    // Sort so the candidate set is identical on every run and every platform.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      const relativePath = toPosix(relative(root, absolute));

      if (entry.isDirectory()) {
        if (isIgnored(relativePath, rules, true)) continue;
        walk(absolute);
        continue;
      }

      if (!entry.isFile()) continue;
      if (isIgnored(relativePath, rules, false)) continue;

      let stats;
      try {
        stats = statSync(absolute);
      } catch (error) {
        skipped.push({ path: relativePath, reason: (error as Error).message });
        continue;
      }

      if (stats.size > maxFileBytes) {
        skipped.push({ path: relativePath, reason: `larger than ${maxFileBytes} bytes` });
        continue;
      }

      let buffer;
      try {
        buffer = readFileSync(absolute);
      } catch (error) {
        skipped.push({ path: relativePath, reason: (error as Error).message });
        continue;
      }

      if (looksBinary(buffer)) {
        skipped.push({ path: relativePath, reason: "binary" });
        continue;
      }

      const content = buffer.toString("utf8");
      const type = classifyItem(relativePath);
      const priority = readFrontMatterPriority(content) ?? defaultPriority(relativePath, type);

      items.push({
        id: relativePath,
        path: relativePath,
        content,
        tokenCount: estimator.count(content),
        tokenCountType: estimator.accuracy,
        type,
        priority,
        mtime: stats.mtimeMs,
        hash: createHash("sha256").update(buffer).digest("hex"),
      });
    }
  }

  walk(root);
  return { items, skipped };
}

/** Total estimated tokens across candidates, before any optimisation. */
export function totalTokens(items: readonly ContextItem[]): number {
  return items.reduce((sum, item) => sum + item.tokenCount, 0);
}
