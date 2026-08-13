/**
 * Optional local AI (§65).
 *
 * These are interfaces and nothing else. ctxd ships no model, calls no API, and
 * bundles no backend — this package exists so that a local model *could* be
 * plugged in without the rest of the system being rewritten around it.
 *
 * The rule that governs every type here: **the core must work without AI.**
 * Every capability below has a deterministic path that runs when no provider is
 * configured, which is the normal case. A provider is an accelerator, never a
 * dependency.
 *
 * Nothing in this package may import a network primitive. A backend that talks
 * to Ollama over HTTP belongs behind this interface in its own package, opted
 * into explicitly — not here, where it would quietly make the core reach out.
 */

/** Why a capability is unavailable, so a caller can explain rather than guess. */
export type UnavailableReason =
  | "no-provider-configured"
  | "provider-unreachable"
  | "provider-refused"
  | "disabled-by-config";

export interface Unavailable {
  readonly ok: false;
  readonly reason: UnavailableReason;
  readonly detail: string;
}

export interface Available<T> {
  readonly ok: true;
  readonly value: T;
  /** Which backend answered, recorded so an AI-derived result is traceable. */
  readonly provider: string;
}

/**
 * The result of any optional-AI call.
 *
 * Deliberately not a thrown error: an absent provider is the expected state,
 * not an exception. Callers must handle `ok: false` as ordinary control flow,
 * which is what makes graceful degradation the default rather than an
 * afterthought (§66).
 */
export type AiResult<T> = Available<T> | Unavailable;

export function unavailable(reason: UnavailableReason, detail: string): Unavailable {
  return { ok: false, reason, detail };
}

export function available<T>(value: T, provider: string): Available<T> {
  return { ok: true, value, provider };
}

export interface SummarizeOptions {
  /** Upper bound on the summary, in estimated tokens. */
  readonly maxTokens?: number;
  /** What the summary is for, so a backend can shape it. */
  readonly purpose?: "session" | "handoff" | "memory" | "diff";
}

/**
 * Condenses text.
 *
 * ctxd's deterministic summarisers — session summaries, handoff documents,
 * checkpoint bodies — already do this without a model. A Summarizer is for
 * cases where prose quality genuinely matters and the user has opted in.
 */
export interface Summarizer {
  readonly name: string;
  summarize(text: string, options?: SummarizeOptions): Promise<AiResult<string>>;
}

/** A candidate memory, before anything is written. */
export interface ExtractedMemory {
  readonly type: "FACT" | "DECISION" | "CONSTRAINT" | "BUG" | "TASK";
  readonly title: string;
  readonly content: string;
  /** 0–1. A low-confidence extraction must not read like a stated rule (§31). */
  readonly confidence: number;
  /** The span of the input this came from, so it can be checked. */
  readonly evidence: string;
}

export interface ExtractOptions {
  /** Skip anything the deterministic extractor already found. */
  readonly exclude?: readonly string[];
}

/**
 * Proposes memories from a body of text.
 *
 * §64 is explicit that deterministic extraction is preferred and that an
 * external call must never be made merely to store a trivial fact. An
 * implementation is therefore expected to be consulted *after* the
 * deterministic pass, on what it did not resolve — never instead of it.
 *
 * Anything produced here is a proposal. It is stored with source `inferred`
 * and its own confidence, so it can never outrank something the developer
 * stated.
 */
export interface MemoryExtractor {
  readonly name: string;
  extract(text: string, options?: ExtractOptions): Promise<AiResult<readonly ExtractedMemory[]>>;
}

export interface EmbeddingProvider {
  readonly name: string;
  /** Vector width, so an index can refuse a mismatched provider. */
  readonly dimensions: number;
  embed(texts: readonly string[]): Promise<AiResult<readonly (readonly number[])[]>>;
}

export interface Classification {
  readonly label: string;
  readonly confidence: number;
}

export interface Classifier {
  readonly name: string;
  classify(text: string, labels: readonly string[]): Promise<AiResult<Classification>>;
}

/**
 * Everything optional, in one place.
 *
 * A field left undefined is the normal configuration. `hasAny` exists so the
 * CLI and UI can state plainly that no provider is configured rather than
 * silently behaving differently.
 */
export interface AiProviders {
  readonly summarizer?: Summarizer;
  readonly memoryExtractor?: MemoryExtractor;
  readonly embeddings?: EmbeddingProvider;
  readonly classifier?: Classifier;
}

export function hasAny(providers: AiProviders): boolean {
  return (
    providers.summarizer !== undefined ||
    providers.memoryExtractor !== undefined ||
    providers.embeddings !== undefined ||
    providers.classifier !== undefined
  );
}

/**
 * The providers ctxd uses when none are configured — which is always, today.
 *
 * Every method reports unavailability with a reason. Returning a plausible
 * fabricated answer would be far worse than returning nothing: a summary no
 * model produced, presented as one, is exactly the kind of invented signal this
 * project refuses to emit.
 */
export const NO_PROVIDERS: AiProviders = {};

const NONE = "none";

export const nullSummarizer: Summarizer = {
  name: NONE,
  summarize: async () =>
    unavailable("no-provider-configured", "no summarizer is configured; ctxd summarises deterministically"),
};

export const nullMemoryExtractor: MemoryExtractor = {
  name: NONE,
  extract: async () =>
    unavailable(
      "no-provider-configured",
      "no memory extractor is configured; deterministic extraction is used",
    ),
};

export const nullEmbeddingProvider: EmbeddingProvider = {
  name: NONE,
  dimensions: 0,
  embed: async () =>
    unavailable("no-provider-configured", "no embedding provider is configured; search uses FTS5"),
};

export const nullClassifier: Classifier = {
  name: NONE,
  classify: async () =>
    unavailable("no-provider-configured", "no classifier is configured"),
};
