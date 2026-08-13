/**
 * Deterministic task signal extraction.
 *
 * V1 normalises and filters; there is no model involved and no attempt to
 * pretend at understanding. The interface is shaped so richer task
 * understanding can replace the internals without changing callers.
 */

/** Common English words that carry no retrieval signal. */
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does",
  "for", "from", "get", "has", "have", "how", "if", "in", "into", "is", "it",
  "its", "make", "of", "on", "or", "our", "out", "so", "than", "that", "the",
  "their", "then", "there", "these", "they", "this", "to", "up", "use", "was",
  "we", "were", "what", "when", "where", "which", "why", "will", "with",
  // Verbs that appear in nearly every engineering task description.
  "add", "change", "create", "fix", "implement", "improve", "remove", "update",
]);

export interface TaskSignals {
  /** The task text exactly as the developer wrote it. */
  readonly raw: string;
  /** Normalised, de-duplicated, stop-word-free terms, in first-seen order. */
  readonly terms: readonly string[];
  /** Adjacent term pairs, used to reward exact phrase matches. */
  readonly phrases: readonly string[];
}

/**
 * Split text into lowercase alphanumeric terms.
 *
 * `camelCase` and `snake_case` identifiers are also split into their parts, so
 * a task mentioning "idempotency" matches `idempotencyKey`.
 */
export function normalizeTerms(text: string): string[] {
  const terms: string[] = [];

  for (const [chunk] of text.matchAll(/[A-Za-z0-9]+/g)) {
    const parts = chunk
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .split(/\s+/)
      .map((part) => part.toLowerCase());

    for (const part of parts) {
      if (part.length > 1) terms.push(part);
    }
    if (parts.length > 1) {
      terms.push(chunk.toLowerCase());
    }
  }

  return terms;
}

/** Extract retrieval signals from a task description. */
export function extractTaskSignals(task: string): TaskSignals {
  const all = normalizeTerms(task);
  const kept = all.filter((term) => !STOP_WORDS.has(term));

  const terms: string[] = [];
  for (const term of kept) {
    if (!terms.includes(term)) terms.push(term);
  }

  const phrases: string[] = [];
  for (let i = 0; i + 1 < kept.length; i += 1) {
    const phrase = `${kept[i]} ${kept[i + 1]}`;
    if (!phrases.includes(phrase)) phrases.push(phrase);
  }

  return { raw: task, terms, phrases };
}

export function isStopWord(term: string): boolean {
  return STOP_WORDS.has(term.toLowerCase());
}
