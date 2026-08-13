/**
 * Expected change surface (§51, §55).
 *
 * Before judging a diff, ctxd forms an expectation from the task itself: a task
 * that says "change the retry limit from 3 to 5" should touch about one file,
 * and a task that says "migrate the payment module to the new client" should
 * not. The expectation is deliberately coarse — it decides whether a diff is
 * worth a second look, never whether it is correct.
 */

import { extractTaskSignals, normalizeTerms } from "@ctxd/context";

export type TaskSize = "small" | "medium" | "large" | "unknown";

export interface ExpectedScope {
  readonly size: TaskSize;
  /** Files a task of this size would normally touch, excluding tests. */
  readonly files: number | undefined;
  /** Semantic lines a task of this size would normally change. */
  readonly lines: number | undefined;
  /** Terms drawn from the task, used to judge whether a file is related. */
  readonly terms: readonly string[];
  /** Paths the caller declared in advance as in scope. */
  readonly declaredPaths: readonly string[];
  /** How the size was decided, for the receipt. */
  readonly reason: string;
}

export interface ScopeOptions {
  readonly task?: string | undefined;
  /** Paths the caller knows are in scope (e.g. from the task record). */
  readonly expectedPaths?: readonly string[] | undefined;
  /** Override the inferred task size. */
  readonly size?: TaskSize | undefined;
}

/** Phrases that mark a task as a single small edit (§55). */
const SMALL_MARKERS: readonly RegExp[] = [
  /\btypo\b/,
  /\bone[- ]lin(e|er)\b/,
  /\bsingle (line|file|condition|value|flag|check)\b/,
  /\bnull check\b/,
  /\boff[- ]by[- ]one\b/,
  /\bfrom \d+ to \d+\b/,
  /\bchange .* to \d+\b/,
  /\bbump\b/,
  /\brename (the )?(variable|constant|field|parameter)\b/,
  /\b(config|configuration) value\b/,
  /\benv(ironment)? variable\b/,
  /\b(api )?parameter\b/,
  /\btest assertion\b/,
  /\bdefault value\b/,
  /\btimeout value\b/,
  /\b(retry|rate) limit\b/,
  /\bflip (the )?flag\b/,
  /\bfix (the )?(condition|comparison|operator|sign|spelling)\b/,
];

/** Phrases that mark a task as inherently broad. */
const LARGE_MARKERS: readonly RegExp[] = [
  /\brefactor(ing)?\b/,
  /\bmigrat(e|ion|ing)\b/,
  /\brewrite\b/,
  /\bredesign\b/,
  /\bre[- ]?architect\b/,
  /\bport (to|from)\b/,
  /\bupgrade\b/,
  /\bintroduce\b/,
  /\badd support for\b/,
  /\bnew (module|package|service|feature)\b/,
  /\bacross the (codebase|repo|project)\b/,
  /\bextract .* into\b/,
  /\bsplit .* into\b/,
];

const SIZE_BUDGET: Readonly<Record<Exclude<TaskSize, "unknown">, { files: number; lines: number }>> = {
  small: { files: 2, lines: 20 },
  medium: { files: 5, lines: 200 },
  large: { files: 20, lines: 1500 },
};

/**
 * Infer how large a change the task should produce.
 *
 * "large" wins over "small" when both match: "refactor the retry limit" is a
 * refactor, and treating it as a one-liner would produce a false alarm on a
 * legitimate diff.
 */
export function inferTaskSize(task: string | undefined): { size: TaskSize; reason: string } {
  if (task === undefined || task.trim() === "") {
    return { size: "unknown", reason: "no task description supplied" };
  }

  const lower = task.toLowerCase();

  const large = LARGE_MARKERS.find((pattern) => pattern.test(lower));
  if (large !== undefined) {
    return { size: "large", reason: `task describes broad work (${large.source})` };
  }

  const small = SMALL_MARKERS.find((pattern) => pattern.test(lower));
  if (small !== undefined) {
    return { size: "small", reason: `task describes a single small edit (${small.source})` };
  }

  return { size: "medium", reason: "no size markers in the task description" };
}

/** Build the expectation a diff will be measured against. */
export function expectedScope(options: ScopeOptions = {}): ExpectedScope {
  const inferred = inferTaskSize(options.task);
  const size = options.size ?? inferred.size;
  const reason = options.size === undefined
    ? inferred.reason
    : `size overridden to "${options.size}" by the caller`;

  const budget = size === "unknown" ? undefined : SIZE_BUDGET[size];
  const declaredPaths = options.expectedPaths ?? [];

  // Declaring more paths than the size budget allows means the declaration is
  // the better information; trust it.
  const files = budget === undefined
    ? undefined
    : Math.max(budget.files, declaredPaths.length);

  return {
    size,
    files,
    lines: budget?.lines,
    terms: options.task === undefined ? [] : extractTaskSignals(options.task).terms,
    declaredPaths,
    reason,
  };
}

const TEST_PATH = /(^|\/)(tests?|__tests__|spec|e2e)(\/|$)|\.(test|spec)\.[a-z]+$/i;

export function isTestPath(path: string): boolean {
  return TEST_PATH.test(path);
}

/** Path terms, minus directory noise that would match almost any task. */
const PATH_NOISE = new Set([
  "src", "lib", "app", "apps", "packages", "index", "main", "dist", "build",
  "test", "tests", "spec", "specs", "ts", "js", "tsx", "jsx", "py", "go", "rs",
  "md", "json", "yaml", "yml", "the", "new", "core",
]);

/**
 * Is this file plausibly part of the task?
 *
 * Relatedness is evidence-based: the path shares vocabulary with the task, or
 * the changed lines themselves mention the task's terms, or the caller declared
 * the path in advance. A file that matches none of those is *reported* as
 * potentially unrelated — never rejected (§51).
 */
export function isRelated(
  path: string,
  scope: ExpectedScope,
  changedText: string,
): { related: boolean; reason: string } {
  if (scope.terms.length === 0) {
    return { related: true, reason: "no task description to judge relatedness against" };
  }

  for (const declared of scope.declaredPaths) {
    if (path === declared || path.startsWith(`${declared}/`)) {
      return { related: true, reason: `declared in scope (${declared})` };
    }
  }

  const taskTerms = new Set(scope.terms);
  const pathTerms = normalizeTerms(path).filter((term) => !PATH_NOISE.has(term));
  const pathMatch = pathTerms.find((term) => taskTerms.has(term));
  if (pathMatch !== undefined) {
    return { related: true, reason: `path mentions "${pathMatch}"` };
  }

  const contentTerms = new Set(normalizeTerms(changedText));
  const contentMatch = scope.terms.find((term) => term.length > 3 && contentTerms.has(term));
  if (contentMatch !== undefined) {
    return { related: true, reason: `changed lines mention "${contentMatch}"` };
  }

  return { related: false, reason: "no shared vocabulary with the task" };
}
