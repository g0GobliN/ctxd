import type { TokenCountType } from "./types.js";

export interface TokenEstimator {
  count(text: string): number;
  readonly accuracy: TokenCountType;
}

/**
 * Deterministic token estimate.
 *
 * Word-ish runs cost roughly one token per four characters (with a floor of
 * one), each punctuation mark costs one, and each newline costs one. This
 * matches the rough shape of byte-pair encoders closely enough to make budget
 * decisions, and it is stable: the same text always yields the same number.
 *
 * It is an ESTIMATE. Every receipt records `"estimated"`, and no monetary
 * saving is ever derived from it. A provider-specific tokenizer can implement
 * the same interface later and report `"exact"`.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;

  let tokens = 0;
  const pattern = /[A-Za-z0-9_]+|\n|[^\sA-Za-z0-9_]/g;

  for (const [match] of text.matchAll(pattern)) {
    if (match === "\n") {
      tokens += 1;
    } else if (/^[A-Za-z0-9_]+$/.test(match)) {
      tokens += Math.max(1, Math.ceil(match.length / 4));
    } else {
      tokens += 1;
    }
  }

  return tokens;
}

export const heuristicEstimator: TokenEstimator = {
  count: estimateTokens,
  accuracy: "estimated",
};
