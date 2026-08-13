import type { ContextItemType, Priority } from "./types.js";

const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "rs", "java", "kt",
  "rb", "php", "cs", "c", "h", "cpp", "hpp", "swift", "scala", "sql", "sh",
]);

const CONFIG_FILENAMES = new Set([
  "package.json", "tsconfig.json", "pnpm-workspace.yaml", "pnpm-lock.yaml",
  "package-lock.json", "yarn.lock", "bun.lock", "dockerfile", "docker-compose.yml",
  "docker-compose.yaml", "cargo.toml", "pyproject.toml", "requirements.txt",
  "go.mod", "pom.xml", ".ctxdignore", ".gitignore",
]);

const CONFIG_EXTENSIONS = new Set(["json", "yaml", "yml", "toml", "ini", "env"]);

function extensionOf(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

/**
 * Classify a file from its path alone.
 *
 * Deterministic and cheap: no content inspection, no guessing. Directory
 * conventions (`sessions/`, `memory/`) are recognised because ctxd itself
 * writes them.
 */
export function classifyItem(relativePath: string): ContextItemType {
  const path = relativePath.toLowerCase();
  const base = basenameOf(path);
  const ext = extensionOf(path);
  const segments = path.split("/");

  if (segments.includes("sessions") || base.startsWith("session")) return "session";
  if (segments.includes("memory") || segments.includes("memories")) return "memory";
  if (segments.includes(".git")) return "git";

  if (base === "project.md") return "project";
  if (CONFIG_FILENAMES.has(base)) return "configuration";
  if (CONFIG_EXTENSIONS.has(ext)) return "configuration";
  if (SOURCE_EXTENSIONS.has(ext)) return "source";
  if (ext === "md" || ext === "mdx" || ext === "txt" || ext === "rst") return "documentation";

  return "other";
}

/** Paths whose contents constrain how the project may be changed. */
const MANDATORY_PATTERN = /(^|\/)(rules|constraints|security|architecture-rules)\.(md|txt)$/;
const DECISION_PATTERN = /(^|\/)(decisions|bugs|architecture)\.(md|txt)$/;

/**
 * Default priority for an item, used when nothing more specific is known.
 *
 * Explicit `priority:` front matter always wins over this policy — see
 * `readFrontMatterPriority`. The policy itself is intentionally conservative:
 * only rules, constraints and security documents are treated as mandatory,
 * because P0 consumes budget before anything else is considered.
 */
export function defaultPriority(relativePath: string, type: ContextItemType): Priority {
  const path = relativePath.toLowerCase();

  if (MANDATORY_PATTERN.test(path)) return "P0";
  if (type === "session") return "P4";
  if (DECISION_PATTERN.test(path)) return "P2";

  switch (type) {
    case "source":
      return "P2";
    case "memory":
      return "P2";
    case "project":
      return "P3";
    case "documentation":
      return "P3";
    case "configuration":
      return "P3";
    case "git":
      return "P4";
    default:
      return "P4";
  }
}

const PRIORITY_PATTERN = /^\s*priority\s*:\s*(P[0-4])\s*$/im;

/**
 * Read an explicit `priority: P0` declaration from YAML front matter.
 *
 * Returns undefined when the file has no front matter block or no priority
 * key, so the caller can fall back to the default policy.
 */
export function readFrontMatterPriority(content: string): Priority | undefined {
  if (!content.startsWith("---")) return undefined;

  const end = content.indexOf("\n---", 3);
  if (end === -1) return undefined;

  const block = content.slice(3, end);
  const match = PRIORITY_PATTERN.exec(block);
  return match === null ? undefined : (match[1]?.toUpperCase() as Priority);
}
