import { homedir } from "node:os";
import { isAbsolute, resolve, relative } from "node:path";

/**
 * Expand a leading `~` to the current user's home directory.
 *
 * ctxd never hardcodes a user-specific absolute path; configuration stores
 * `~/.ctxd` and it is resolved at runtime against the real home directory.
 */
export function expandTilde(input: string, home: string = homedir()): string {
  if (input === "~") return home;
  if (input.startsWith("~/")) return resolve(home, input.slice(2));
  return input;
}

/** True when `child` is the same path as `parent` or nested inside it. */
export function isSubPath(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
