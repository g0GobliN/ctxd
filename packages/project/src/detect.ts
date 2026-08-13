import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { inspectGit, type GitInfo } from "./git.js";

export interface DetectedProject {
  readonly id: string;
  readonly root: string;
  readonly name: string;
  readonly vcs: string | null;
  readonly runtime: string | null;
  readonly language: string | null;
  readonly packageManager: string | null;
  readonly framework: string | null;
  /** Files that produced the conclusions above — the evidence trail. */
  readonly evidence: readonly string[];
  readonly git: GitInfo;
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function dependencyNames(pkg: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const section = pkg[field];
    if (typeof section === "object" && section !== null) {
      for (const name of Object.keys(section)) names.add(name);
    }
  }
  return names;
}

/** Lock files and manifests, in the order they are checked. */
const PACKAGE_MANAGER_FILES: readonly (readonly [string, string])[] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
  ["Cargo.lock", "cargo"],
  ["poetry.lock", "poetry"],
  ["uv.lock", "uv"],
  ["go.sum", "go"],
];

/** Framework markers: a dependency name, or a config file that must exist. */
const FRAMEWORK_DEPENDENCIES: readonly (readonly [string, string])[] = [
  ["next", "next.js"],
  ["nuxt", "nuxt"],
  ["@remix-run/react", "remix"],
  ["@sveltejs/kit", "sveltekit"],
  ["@angular/core", "angular"],
  ["astro", "astro"],
  ["vue", "vue"],
  ["react", "react"],
  ["svelte", "svelte"],
  ["@nestjs/core", "nestjs"],
  ["express", "express"],
  ["fastify", "fastify"],
  ["django", "django"],
  ["flask", "flask"],
];

const FRAMEWORK_FILES: readonly (readonly [RegExp, string])[] = [
  [/^next\.config\.[cm]?[jt]s$/, "next.js"],
  [/^nuxt\.config\.[cm]?[jt]s$/, "nuxt"],
  [/^astro\.config\.[cm]?[jt]s$/, "astro"],
  [/^svelte\.config\.[cm]?[jt]s$/, "sveltekit"],
  [/^vite\.config\.[cm]?[jt]s$/, "vite"],
  [/^angular\.json$/, "angular"],
];

/**
 * Identify a project by reading its files.
 *
 * Nothing is inferred from directory names: a folder called `api` proves
 * nothing, while a `go.mod` proves a great deal. Every conclusion records the
 * file that justified it, so a wrong answer can be traced rather than guessed
 * at.
 */
export function detectProject(dir: string): DetectedProject {
  const git = inspectGit(dir);

  // Git reports its top level with forward slashes even on Windows, while a
  // plain directory arrives with the platform's separators. Both must resolve
  // to the same string: `root` is the project's identity in the database and
  // is UNIQUE, so two spellings of one directory would split a project's
  // memory across two rows — and would do it silently, the moment a registered
  // directory gained a Git repository.
  const root = resolve(
    git.insideWorkTree === true && git.root !== undefined ? git.root : dir,
  );

  const evidence: string[] = [];
  const entries = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
    : [];
  const present = new Set(entries);

  let runtime: string | null = null;
  let language: string | null = null;
  let framework: string | null = null;
  let packageManager: string | null = null;
  let name = basename(root);

  const pkg = present.has("package.json") ? readJson(join(root, "package.json")) : undefined;
  if (pkg !== undefined) {
    evidence.push("package.json");
    runtime = "node";
    language = "javascript";
    if (typeof pkg["name"] === "string" && pkg["name"] !== "") name = pkg["name"];

    const deps = dependencyNames(pkg);
    if (deps.has("typescript") || present.has("tsconfig.json")) language = "typescript";

    const declared = pkg["packageManager"];
    if (typeof declared === "string" && declared.includes("@")) {
      packageManager = declared.split("@")[0] ?? null;
      evidence.push("package.json#packageManager");
    }

    for (const [dependency, label] of FRAMEWORK_DEPENDENCIES) {
      if (deps.has(dependency)) {
        framework = label;
        evidence.push(`package.json#${dependency}`);
        break;
      }
    }
  }

  if (present.has("tsconfig.json")) {
    evidence.push("tsconfig.json");
    language = "typescript";
    runtime ??= "node";
  }

  if (present.has("Cargo.toml")) {
    evidence.push("Cargo.toml");
    runtime = "rust";
    language = "rust";
  }

  if (present.has("go.mod")) {
    evidence.push("go.mod");
    runtime = "go";
    language = "go";
  }

  if (present.has("pyproject.toml") || present.has("requirements.txt")) {
    evidence.push(present.has("pyproject.toml") ? "pyproject.toml" : "requirements.txt");
    runtime = "python";
    language = "python";
  }

  if (present.has("pom.xml")) {
    evidence.push("pom.xml");
    runtime = "jvm";
    language = "java";
  }

  for (const entry of entries) {
    if (/^build\.gradle/.test(entry) || /^settings\.gradle/.test(entry)) {
      evidence.push(entry);
      runtime ??= "jvm";
      packageManager ??= "gradle";
      break;
    }
  }

  if (packageManager === null) {
    for (const [file, manager] of PACKAGE_MANAGER_FILES) {
      if (present.has(file)) {
        packageManager = manager;
        evidence.push(file);
        break;
      }
    }
  }

  if (framework === null) {
    for (const entry of entries) {
      const match = FRAMEWORK_FILES.find(([pattern]) => pattern.test(entry));
      if (match !== undefined) {
        framework = match[1];
        evidence.push(entry);
        break;
      }
    }
  }

  if (present.has("Dockerfile")) evidence.push("Dockerfile");
  for (const entry of entries) {
    if (entry.startsWith("docker-compose")) {
      evidence.push(entry);
      break;
    }
  }

  return {
    id: projectId(root, git),
    root,
    name,
    vcs: git.insideWorkTree === true ? "git" : null,
    runtime,
    language,
    packageManager,
    framework,
    evidence,
    git,
  };
}

/**
 * A stable project identifier.
 *
 * The root commit is preferred: it is immutable and survives the repository
 * being moved, renamed or cloned elsewhere, so project memory stays attached
 * to the project rather than to a path. Without Git (or without any commits)
 * the absolute path is the only stable anchor available.
 */
export function projectId(root: string, git: GitInfo): string {
  const anchor =
    git.rootCommit !== undefined && git.rootCommit !== ""
      ? `commit:${git.rootCommit}`
      : `path:${root}`;
  return createHash("sha256").update(anchor).digest("hex").slice(0, 16);
}
