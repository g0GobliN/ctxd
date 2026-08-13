/**
 * Line-level syntax heuristics shared by the noise detectors.
 *
 * These are regex heuristics, not parsers. That is a deliberate V1 choice: the
 * Diff Firewall only ever *reports*, so a misread line costs a slightly wrong
 * statistic, never a destroyed edit. Every detector here is deterministic — the
 * same line always classifies the same way.
 */

export type CommentStyle = "c-like" | "hash" | "sql" | "markup" | "none";

const C_LIKE = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts", "java", "c", "h", "cc",
  "cpp", "hpp", "cs", "go", "rs", "swift", "kt", "kts", "scala", "php", "dart",
  "css", "scss", "less", "proto",
]);

const HASH = new Set([
  "py", "rb", "sh", "bash", "zsh", "fish", "yml", "yaml", "toml", "ini", "cfg",
  "conf", "pl", "r", "jl", "ex", "exs", "nix", "tf", "dockerfile", "makefile",
  "gitignore", "env",
]);

const SQL = new Set(["sql", "hs", "lua", "elm"]);
const MARKUP = new Set(["html", "htm", "xml", "svg", "vue", "svelte", "md", "mdx"]);

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return name;
  return name.slice(dot + 1);
}

export function commentStyle(path: string): CommentStyle {
  const extension = extensionOf(path);
  if (C_LIKE.has(extension)) return "c-like";
  if (HASH.has(extension)) return "hash";
  if (SQL.has(extension)) return "sql";
  if (MARKUP.has(extension)) return "markup";
  return "none";
}

/**
 * Is this line entirely a comment?
 *
 * Trailing comments on a code line do not count: changing the code is a
 * semantic change regardless of the comment riding along with it.
 */
export function isCommentLine(line: string, style: CommentStyle): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false;

  switch (style) {
    case "c-like":
      return (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*/") ||
        trimmed.startsWith("*")
      );
    case "hash":
      return trimmed.startsWith("#");
    case "sql":
      return trimmed.startsWith("--");
    case "markup":
      return trimmed.startsWith("<!--") || trimmed.startsWith("-->");
    case "none":
      return false;
  }
}

/** Strip comment markers so the prose can be inspected on its own. */
export function commentText(line: string): string {
  return line
    .trim()
    .replace(/^(\/\/+|\/\*+|\*+\/?|#+|--+|<!--|-->)/, "")
    .replace(/(\*\/|-->)$/, "")
    .trim();
}

const IMPORT_PATTERNS: readonly RegExp[] = [
  /^import\s/,
  /^export\s+(?:\*|\{)/,
  /^export\s+.*\sfrom\s/,
  /^from\s+\S+\s+import\s/,
  /^(?:const|let|var)\s+.*=\s*require\(/,
  /^require\(/,
  /^use\s+[\w:]+;/,
  /^#include\s/,
  /^using\s+[\w.]+;/,
];

/** Is this line an import/require/use statement? */
export function isImportLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") return false;
  return IMPORT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Reduce a line to its semantic content.
 *
 * Two lines with the same normalised form differ only in presentation:
 * indentation, internal whitespace, line endings, quote style or a trailing
 * semicolon or comma. This is the single decision that separates the semantic
 * diff from the formatting diff, so it is intentionally conservative — it
 * collapses only differences that no runtime can observe.
 */
export function normalizePresentation(line: string): string {
  return line
    .replace(/\r$/, "")
    .replace(/'/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[;,]+$/, "")
    .trim();
}

/** A multiset of normalised lines, used to pair removals with additions. */
export function countByNormalized(lines: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = normalizePresentation(line);
    if (key === "") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
