/**
 * Deterministic memory extraction (§64).
 *
 * §64 is explicit: prefer deterministic extraction, and never make an external
 * AI call merely to store a trivial fact. This module is that preference made
 * real — it finds the things worth remembering using patterns, with no model
 * involved, and it runs whether or not a provider is configured.
 *
 * It is deliberately conservative. Everything it proposes carries the sentence
 * it came from, so a wrong extraction can be seen to be wrong rather than
 * quietly becoming project memory. Nothing here writes anything: extraction
 * proposes, the caller decides.
 *
 * Original information is never destroyed (§64). This reads text and returns
 * candidates; the source stays exactly as it was.
 */

import type { ExtractedMemory } from "./interfaces.js";

interface Pattern {
  readonly type: ExtractedMemory["type"];
  readonly pattern: RegExp;
  /** How sure the phrasing makes us. Explicit markers score higher. */
  readonly confidence: number;
}

/**
 * Phrasings that mark a sentence as worth remembering.
 *
 * Ordered by type. A sentence matching several patterns is classified by the
 * first match in this list, so an explicit "Decision:" heading wins over a
 * softer "we chose".
 */
const PATTERNS: readonly Pattern[] = [
  // Decisions — a choice was made and should not be relitigated by accident.
  { type: "DECISION", pattern: /^\s*decision\s*[:#]/i, confidence: 0.9 },
  { type: "DECISION", pattern: /\bwe (?:decided|agreed|chose|settled on)\b/i, confidence: 0.8 },
  { type: "DECISION", pattern: /\b(?:decided|agreed) (?:to|not to|against)\b/i, confidence: 0.75 },
  { type: "DECISION", pattern: /\bgoing with\b.*\binstead of\b/i, confidence: 0.7 },

  // Constraints — rules that outlive the change that prompted them.
  { type: "CONSTRAINT", pattern: /^\s*constraint\s*[:#]/i, confidence: 0.9 },
  { type: "CONSTRAINT", pattern: /\b(?:must not|may not|never)\b/i, confidence: 0.7 },
  { type: "CONSTRAINT", pattern: /\bmust (?:always|be|remain|stay)\b/i, confidence: 0.7 },
  { type: "CONSTRAINT", pattern: /\bonly\b.*\b(?:may|can|should)\b/i, confidence: 0.6 },

  // Bugs — so the same cause is recognised the second time.
  { type: "BUG", pattern: /^\s*bug\s*[:#]/i, confidence: 0.9 },
  { type: "BUG", pattern: /\broot cause\b/i, confidence: 0.85 },
  { type: "BUG", pattern: /\b(?:regression|race condition|deadlock|memory leak)\b/i, confidence: 0.75 },
  { type: "BUG", pattern: /\b(?:caused by|broke because|failed because)\b/i, confidence: 0.7 },

  // Next steps — the thing a future session would otherwise rediscover.
  { type: "TASK", pattern: /^\s*(?:next|todo|follow[- ]up)\s*[:#]/i, confidence: 0.85 },
  { type: "TASK", pattern: /\b(?:still needs?|remains? to|next step is)\b/i, confidence: 0.7 },

  // Facts — explicitly marked only. Inferring facts from prose produces noise.
  { type: "FACT", pattern: /^\s*(?:fact|note|finding)\s*[:#]/i, confidence: 0.8 },
  { type: "FACT", pattern: /\bturns out\b/i, confidence: 0.65 },
];

/** Sentences shorter than this carry no recoverable meaning. */
const MIN_SENTENCE = 20;
/** Longer than this and it is a paragraph, not a fact. */
const MAX_SENTENCE = 400;

/**
 * Split prose into sentences and list items.
 *
 * Markdown bullets and numbered steps are treated as units in their own right:
 * a decision written as a bullet is still a decision.
 */
export function splitStatements(text: string): string[] {
  const statements: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;

    // A bullet or heading is one statement, not several.
    if (/^(?:[-*+]|\d+[.)])\s+/.test(line) || /^#{1,6}\s/.test(line)) {
      statements.push(line.replace(/^(?:[-*+]|\d+[.)]|#{1,6})\s+/, "").trim());
      continue;
    }

    // Otherwise split on sentence endings, keeping abbreviations intact enough
    // for this purpose.
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z"'`])/)) {
      const trimmed = sentence.trim();
      if (trimmed !== "") statements.push(trimmed);
    }
  }

  return statements;
}

/** A short title from a statement: the first clause, capped. */
function titleOf(statement: string): string {
  const cleaned = statement.replace(/^\s*\w+\s*[:#]\s*/, "").trim();
  const firstClause = cleaned.split(/[,;:—–]/)[0] ?? cleaned;
  const title = (firstClause.length >= 12 ? firstClause : cleaned).trim();
  return title.length > 80 ? `${title.slice(0, 77).trimEnd()}…` : title;
}

export interface DeterministicExtractOptions {
  /** Statements already recorded, so the same fact is not proposed twice. */
  readonly exclude?: readonly string[];
  /** Drop anything below this confidence. */
  readonly minConfidence?: number;
  readonly limit?: number;
}

/**
 * Find the memories worth proposing from a body of text.
 *
 * Returns candidates, never writes. Each carries the sentence that produced it
 * as evidence, because an extraction a person cannot check is worse than no
 * extraction at all.
 */
export function extractDeterministic(
  text: string,
  options: DeterministicExtractOptions = {},
): ExtractedMemory[] {
  const minConfidence = options.minConfidence ?? 0.6;
  const excluded = new Set((options.exclude ?? []).map((entry) => entry.trim().toLowerCase()));

  const found: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const statement of splitStatements(text)) {
    if (statement.length < MIN_SENTENCE || statement.length > MAX_SENTENCE) continue;

    const key = statement.toLowerCase();
    if (seen.has(key) || excluded.has(key)) continue;

    const match = PATTERNS.find((candidate) => candidate.pattern.test(statement));
    if (match === undefined || match.confidence < minConfidence) continue;

    seen.add(key);
    found.push({
      type: match.type,
      title: titleOf(statement),
      content: statement,
      confidence: match.confidence,
      evidence: statement,
    });
  }

  found.sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title));
  return options.limit === undefined ? found : found.slice(0, options.limit);
}

/**
 * Is this worth asking a model about?
 *
 * §64: never make an external AI call merely to store a trivial fact. A
 * provider is only worth consulting when the deterministic pass found little
 * and there is enough text that something was probably missed.
 */
export function worthConsultingProvider(text: string, deterministic: readonly ExtractedMemory[]): boolean {
  const statements = splitStatements(text).length;
  if (statements < 8) return false;
  return deterministic.length * 4 < statements;
}
