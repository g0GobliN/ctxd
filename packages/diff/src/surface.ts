/**
 * Change surface (§51).
 *
 * The measurable shape of a change: how many files, how many lines, how much of
 * it is presentation, how much of it the task did not ask for. Every number
 * here is counted from the diff — none is inferred, and none of them is a
 * judgement on its own.
 */

import { changedLines, countModifiedLines, type FileDiff } from "./parse.js";
import { analyzeFileNoise, type FileNoise } from "./noise.js";
import { expectedScope, isRelated, isTestPath, type ExpectedScope } from "./scope.js";
import { extensionOf } from "./syntax.js";

/** Manifests whose contents define the project's dependencies. */
const DEPENDENCY_MANIFESTS: readonly string[] = [
  "package.json", "cargo.toml", "pyproject.toml", "requirements.txt", "go.mod",
  "gemfile", "composer.json", "build.gradle", "build.gradle.kts", "pom.xml",
  "pubspec.yaml", "mix.exs", "project.clj", "podfile", "package.swift",
];

/** Files a tool writes, not a person. */
const LOCK_FILES: readonly string[] = [
  "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "npm-shrinkwrap.json",
  "cargo.lock", "poetry.lock", "gemfile.lock", "composer.lock", "go.sum",
  "pubspec.lock", "mix.lock", "podfile.lock",
];

const GENERATED_PATH = /(^|\/)(dist|build|out|coverage|node_modules|vendor|__generated__|generated)(\/|$)/i;
const GENERATED_NAME = /\.(min\.(js|css)|d\.ts|snap|pb\.go|generated\.[a-z]+)$/i;

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

export function isLockFile(path: string): boolean {
  return LOCK_FILES.includes(baseName(path));
}

export function isGeneratedFile(path: string): boolean {
  return isLockFile(path) || GENERATED_PATH.test(path) || GENERATED_NAME.test(path);
}

/**
 * Does this file change the project's dependencies?
 *
 * For a lock file or a plain requirements list, any change is a dependency
 * change. For a manifest that also holds scripts and metadata, only lines that
 * look like a dependency entry count — editing a `description` field is not a
 * dependency change and should not be reported as one.
 */
export function isDependencyChange(file: FileDiff): boolean {
  const name = baseName(file.path);
  if (isLockFile(file.path)) return true;
  if (!DEPENDENCY_MANIFESTS.includes(name)) return false;
  if (name === "requirements.txt" || name === "go.mod") return true;

  const entry = /^\s*["']?[@\w][\w.\-/]*["']?\s*[:=]\s*["'][~^><=*\d]/;
  const gradle = /^\s*(implementation|api|compileOnly|testImplementation|classpath)\s/;
  const xml = /^\s*<(dependency|artifactId|version)>/;

  return changedLines(file).some(
    (line) => entry.test(line.text) || gradle.test(line.text) || xml.test(line.text),
  );
}

export interface FileSurface {
  readonly path: string;
  readonly oldPath: string;
  readonly kind: FileDiff["kind"];
  readonly binary: boolean;
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly linesModified: number;
  readonly related: boolean;
  readonly relatedReason: string;
  readonly test: boolean;
  readonly generated: boolean;
  readonly dependency: boolean;
  readonly noise: FileNoise;
}

export interface ChangeSurface {
  readonly files_changed: number;
  readonly lines_added: number;
  readonly lines_removed: number;
  readonly lines_modified: number;
  /** Lines a runtime can observe, after presentation churn is discounted. */
  readonly semantic_lines: number;
  readonly formatting_lines: number;
  /** Files whose entire change is presentation. */
  readonly formatting_only_changes: number;
  /** Files whose entire semantic change is comments. */
  readonly comment_only_changes: number;
  /** Files whose entire semantic change is import statements. */
  readonly import_only_changes: number;
  readonly dependency_changes: number;
  readonly rename_changes: number;
  readonly generated_file_changes: number;
  readonly test_file_changes: number;
  readonly whole_file_rewrites: number;
  readonly unrelated_files: readonly string[];
  readonly files: readonly FileSurface[];
  readonly expected: ExpectedScope;
}

export interface SurfaceOptions {
  readonly task?: string | undefined;
  readonly expectedPaths?: readonly string[] | undefined;
  readonly scope?: ExpectedScope | undefined;
}

/** Measure a parsed diff against what the task led ctxd to expect. */
export function computeChangeSurface(
  diffFiles: readonly FileDiff[],
  options: SurfaceOptions = {},
): ChangeSurface {
  const expected = options.scope ?? expectedScope({
    task: options.task,
    expectedPaths: options.expectedPaths,
  });

  const files: FileSurface[] = diffFiles.map((file) => {
    const text = changedLines(file).map((line) => line.text).join("\n");
    const relation = isRelated(file.path, expected, text);

    return {
      path: file.path,
      oldPath: file.oldPath,
      kind: file.kind,
      binary: file.binary,
      linesAdded: file.linesAdded,
      linesRemoved: file.linesRemoved,
      linesModified: countModifiedLines(file),
      related: relation.related,
      relatedReason: relation.reason,
      test: isTestPath(file.path),
      generated: isGeneratedFile(file.path),
      dependency: isDependencyChange(file),
      noise: analyzeFileNoise(file),
    };
  });

  // A test file that shares no vocabulary with the task is still expected work
  // when the task's own files were touched — §51 calls it "potentially
  // acceptable", so it is not reported as unrelated.
  const hasRelatedSource = files.some((file) => file.related && !file.test);
  const unrelated = files
    .filter((file) => !file.related && !(file.test && hasRelatedSource))
    .map((file) => file.path);

  const sum = (pick: (file: FileSurface) => number): number =>
    files.reduce((total, file) => total + pick(file), 0);

  return {
    files_changed: files.length,
    lines_added: sum((file) => file.linesAdded),
    lines_removed: sum((file) => file.linesRemoved),
    lines_modified: sum((file) => file.linesModified),
    semantic_lines: sum((file) => file.noise.semanticLines),
    formatting_lines: sum((file) => file.noise.formattingLines),
    formatting_only_changes: files.filter((file) => file.noise.formattingOnly).length,
    comment_only_changes: files.filter((file) => file.noise.commentOnly).length,
    import_only_changes: files.filter((file) => file.noise.importOnly).length,
    dependency_changes: files.filter((file) => file.dependency).length,
    rename_changes: files.filter((file) => file.kind === "renamed").length,
    generated_file_changes: files.filter((file) => file.generated).length,
    test_file_changes: files.filter((file) => file.test).length,
    whole_file_rewrites: files.filter((file) => file.noise.wholeFileRewrite).length,
    unrelated_files: unrelated,
    files,
    expected,
  };
}

/** Files that carry the substance of the change, for correction context. */
export function primaryFiles(surface: ChangeSurface, limit = 5): readonly FileSurface[] {
  return [...surface.files]
    .filter((file) => !file.generated && !file.binary)
    .sort((a, b) => b.noise.codeLines - a.noise.codeLines || a.path.localeCompare(b.path))
    .slice(0, limit);
}

/** Extension histogram, used by the CLI summary. */
export function extensionCounts(surface: ChangeSurface): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of surface.files) {
    const extension = extensionOf(file.path);
    counts.set(extension, (counts.get(extension) ?? 0) + 1);
  }
  return counts;
}
