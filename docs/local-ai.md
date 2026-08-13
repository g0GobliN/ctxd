# Optional local AI

ctxd ships **no model**, calls **no API**, and bundles **no backend**.

`@ctxd/ai` is a set of interfaces so that a local model *could* be plugged in
later without the rest of the system being rewritten around it. Today nothing
implements them, and that is the normal, supported configuration.

One rule governs the whole package: **the core must work without AI** (§65).
Every capability has a deterministic path that runs when no provider is
configured. A provider is an accelerator, never a dependency.

## The interfaces (§65)

| Interface | For | What runs instead today |
|---|---|---|
| `Summarizer` | Condensing prose | Deterministic session, handoff and checkpoint summaries |
| `MemoryExtractor` | Proposing memories from text | `extractDeterministic` — pattern-based, no model |
| `EmbeddingProvider` | Vector search | SQLite FTS5 |
| `Classifier` | Labelling text | Explicit types chosen by the caller |

Every method returns `AiResult<T>` — either a value with the provider that
produced it, or an `Unavailable` carrying a reason. An absent provider is
**not** an exception: it is the expected state, so callers handle it as ordinary
control flow. That is what makes graceful degradation the default rather than an
afterthought.

The null implementations report unavailability rather than returning a plausible
answer. A summary no model produced, presented as one, is exactly the kind of
invented signal this project refuses to emit.

A backend that talks to Ollama or llama.cpp over HTTP belongs **behind** this
interface, in its own package, opted into explicitly. It must not live here,
where it would quietly make the core reach out — a CI gate asserts this package
imports no network primitive and declares no non-ctxd dependency.

## Deterministic extraction (§64)

`extractDeterministic` finds the things worth remembering using patterns, with
no model involved. It runs whether or not a provider is configured.

It recognises decisions ("we decided", "Decision:"), constraints ("must not",
"never", "only … may"), bugs ("root cause", "regression", "caused by"), next
steps ("Next:", "still needs") and explicitly marked facts.

Three properties matter more than coverage:

- **It proposes, never writes.** The caller decides what becomes memory.
- **Every candidate carries the sentence it came from.** An extraction a person
  cannot check is worse than no extraction.
- **It is conservative.** Facts are only extracted when explicitly marked;
  inferring them from ordinary prose produces noise that trains people to
  ignore the feature.

Anything a provider proposes later is stored with source `inferred` and its own
confidence, so it can never outrank something the developer stated (§31).

`worthConsultingProvider` encodes §64's instruction that an external call must
never be made merely to store a trivial fact: it returns `true` only when a text
is long enough that something was probably missed *and* the deterministic pass
found little.

## Nothing is destroyed (§64)

Extraction reads. Raw conversations, agent outputs, snapshots, session and task
history, context receipts, change receipts and original files are all preserved
exactly as they were. Compression only ever affects the model-facing context,
never what is stored.

## Offline mode (§66)

"Graceful degradation is mandatory" is easy to write and easy to quietly break,
so the guarantee is data rather than prose — a capability table that `ctxd
doctor` reads and the test suite asserts.

```
$ ctxd doctor
…
✓ Offline  all 11 capabilities work without AI (no provider configured)
```

| Capability | Without any AI provider |
|---|---|
| Local search | SQLite FTS5; no embeddings required |
| Project memory | SQLite plus Markdown, deterministic authority order |
| Git awareness | Read-only inspection; Git stays the source of truth |
| Tasks | Local SQLite |
| Sessions and checkpoints | Local; resume and handoff assembled deterministically |
| Token counting | Local heuristic estimator, always labelled an estimate |
| Context construction | Collection, dedup, ranking, budget, compression |
| Diff analysis | The Diff Firewall parses Git output |
| Verification | Runs the project's own typecheck, lint, test, build |
| Interface | Static files from the local API |
| CLI | Every command |

If a future change makes one of these depend on a model, the table has to change
too — and the test asserting they are all offline-capable fails. That is the
point.
