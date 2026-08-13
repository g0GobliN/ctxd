import { readFileSync } from "node:fs";

/**
 * Always ignored, whether or not an ignore file mentions them.
 *
 * Secrets are never indexed by default: `.env` files, key material and
 * anything under a `secrets` or `private` directory stay out of context.
 */
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  ".git/",
  ".env",
  ".env.*",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  "secrets/",
  "private/",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "*.jks",
  "*.keystore",
  // SSH private keys carry no extension, so they need naming individually.
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  // Files whose whole purpose is holding a credential.
  ".npmrc",
  ".netrc",
  ".pgpass",
  ".htpasswd",
  "credentials",
  "*.log",
  "*.tsbuildinfo",
  ".DS_Store",
];

export interface IgnoreRule {
  readonly source: string;
  readonly pattern: string;
  readonly directoryOnly: boolean;
  readonly anchored: boolean;
  readonly regex: RegExp;
}

function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i] as string;
    if (char === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 1;
        if (glob[i + 1] === "/") i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if ("\\^$.|+()[]{}".includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  // Case-insensitive on purpose. Windows and macOS filesystems are themselves
  // case-insensitive, so `.ENV` and `.env` are the same file there — matching
  // case-sensitively would collect a secret that the user believes is ignored.
  // The trade is asymmetric: over-ignoring costs one file, under-ignoring leaks
  // a credential to a model.
  return new RegExp(`^${out}$`, "i");
}

/**
 * Compile ignore patterns.
 *
 * This is a deliberate subset of gitignore syntax: comments, blank lines,
 * directory-only patterns, anchored patterns and `*` / `**` / `?` globs.
 * Negation (`!`) is not supported — an unsupported line is skipped rather
 * than silently misinterpreted as something it is not.
 */
export function compileIgnoreRules(
  patterns: readonly string[],
  source: string,
): IgnoreRule[] {
  const rules: IgnoreRule[] = [];

  for (const line of patterns) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;

    const directoryOnly = trimmed.endsWith("/");
    const withoutSlash = directoryOnly ? trimmed.slice(0, -1) : trimmed;
    const anchored = withoutSlash.startsWith("/");
    const pattern = anchored ? withoutSlash.slice(1) : withoutSlash;
    if (pattern === "") continue;

    rules.push({
      source,
      pattern,
      directoryOnly,
      anchored,
      regex: globToRegExp(pattern),
    });
  }

  return rules;
}

/** Read and compile an ignore file. A missing file yields no rules. */
export function readIgnoreFile(path: string): IgnoreRule[] {
  try {
    return compileIgnoreRules(readFileSync(path, "utf8").split("\n"), path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Test a repository-relative POSIX path against compiled rules.
 *
 * An unanchored pattern matches any path segment, mirroring gitignore.
 */
export function isIgnored(
  relativePath: string,
  rules: readonly IgnoreRule[],
  isDirectory: boolean,
): boolean {
  const segments = relativePath.split("/");

  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory) {
      // A directory-only rule still excludes everything beneath it, which the
      // walker handles by never descending; a file path only matches if one of
      // its parent segments matches.
      if (segments.slice(0, -1).some((segment) => rule.regex.test(segment))) return true;
      continue;
    }

    if (rule.anchored) {
      if (rule.regex.test(relativePath)) return true;
      continue;
    }

    if (rule.regex.test(relativePath)) return true;
    if (segments.some((segment) => rule.regex.test(segment))) return true;
  }

  return false;
}
