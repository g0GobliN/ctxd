/**
 * Reading receipts off disk.
 *
 * Receipts are files by design — portable and readable without ctxd (§74) — so
 * they are read from the filesystem rather than the database.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CtxdPaths } from "@ctxd/core";
import type { ContextReceipt } from "@ctxd/context";
import type { ChangeReceipt } from "@ctxd/diff";

/**
 * List receipt files newest-first.
 *
 * A corrupt receipt is skipped rather than failing the whole listing; the
 * others are still worth showing.
 */
export function listReceipts(directory: string, limit: number): unknown[] {
  let names: string[];
  try {
    names = readdirSync(directory).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }

  const entries = names
    .map((name) => {
      const path = join(directory, name);
      try {
        return { name, path, mtime: statSync(path).mtimeMs };
      } catch {
        return undefined;
      }
    })
    .filter((entry): entry is { name: string; path: string; mtime: number } => entry !== undefined)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);

  const receipts: unknown[] = [];
  for (const entry of entries) {
    try {
      receipts.push(JSON.parse(readFileSync(entry.path, "utf8")));
    } catch {
      // See above: one unreadable file must not hide the rest.
    }
  }
  return receipts;
}

/** The newest Context Receipt, or undefined when none has been written. */
export function latestContextReceipt(paths: CtxdPaths): ContextReceipt | undefined {
  return listReceipts(paths.contextReceiptsDir, 1)[0] as ContextReceipt | undefined;
}

/** The newest Change Receipt, or undefined when none has been written. */
export function latestChangeReceipt(paths: CtxdPaths): ChangeReceipt | undefined {
  return listReceipts(paths.changeReceiptsDir, 1)[0] as ChangeReceipt | undefined;
}
