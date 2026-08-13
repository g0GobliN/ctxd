# Context engine

The context engine is the Context Firewall: it turns a task plus a directory
into the smallest context that still contains everything needed to do the work.

It is entirely local and deterministic. No network call, no model, no
embeddings. The same inputs always produce byte-identical output, which is what
makes it benchmarkable.

## Pipeline

```
task ──► task signals ──► candidates ──► dedup ──► rank ──► budget ──► receipt
                                                              │
                                                        compression
```

Each stage lives in its own module in `packages/context/src`:

| Stage | Module | What it does |
|-------|--------|--------------|
| Task signals | `task.ts` | Normalise the task into terms and phrases |
| Candidates | `collect.ts` | Walk the directory, honour ignore rules, classify, estimate |
| Dedup | `dedup.ts` | Drop exact and near-duplicate representations |
| Rank | `ranking.ts` | Score each candidate from weighted signals |
| Budget | `budget.ts` | Choose the set that fits, compressing where needed |
| Compression | `compression.ts` | Shrink an item's representation deterministically |
| Receipt | `receipt.ts` | Explain exactly what was included and why |

`firewall.ts` composes them into `buildContext()`, a pure function of the
filesystem it is pointed at.

## Token estimation

Word runs cost roughly one token per four characters (minimum one),
punctuation and newlines cost one each. It is an **estimate** and is always
labelled as one. Receipts record `token_count_estimation: "estimated"`, and no
monetary figure is ever derived from it — a currency amount would imply a
precision that does not exist. A provider-specific tokenizer can implement the
same `TokenEstimator` interface later and report `"exact"`.

## Priority

`P0` mandatory, `P1` current, `P2` relevant, `P3` background, `P4` archive.
Budget pressure removes P4 before P3 before P2 before P1.

Priority comes from explicit `priority:` front matter when present. Otherwise a
conservative default policy applies: rules, constraints and security documents
are P0; sessions are P4; decisions, bugs and architecture documents are P2;
source and memory are P2; other documentation and configuration are P3.

A P0 item that cannot be fitted is **reported as a warning**, never dropped
silently. `ctxd context` exits with status 2 in that case.

## Ranking

```
score = keyword·3.0 + path·2.0 + fileType·1.5 + priority·2.0 + recency·0.5 − tokenCost·0.1
```

Every signal is normalised to [0, 1]. The weights are experimental starting
points, not optimal constants — they are configurable and versioned precisely
so they can be benchmarked and improved.

Signals that need later phases — semantic similarity, dependencies, memory,
architecture rules, git history, historical usefulness — are **absent**, not
faked. When they arrive they become additional terms with their own weights.

## Selection

Selection is not "sort by score and take the top N until full".

- Mandatory items are fitted first.
- An item that does not fit whole is compressed and retried; if it still does
  not fit it is excluded. **The final string is never truncated**, so a worker
  never receives a file that stops mid-line.
- Leftover budget is *not* filled with padding. An item with no keyword or path
  connection to the task is excluded with the reason `no task relevance`, even
  when there is room for it. Every token sent to a model must have a reason to
  exist, and "there was space" is not one.

That last rule is why a 10,000-token budget frequently produces a context of
half that size. Under-filling the budget is the correct outcome when nothing
else is relevant.

## Sources beyond the filesystem

`@ctxd/firewall` composes the engine with project memory and Git state. Those
candidates join the *same* pipeline — dedup, ranking, budget, compression,
receipt — so nothing enters the context by virtue of where it came from.

Every non-filesystem candidate arrives with a `reason` recording why it was
retrieved, which is what appears in the receipt. Items carrying a reason are
exempt from the task-relevance gate: a retrieval provider has already justified
them.

Two rules matter here:

- **Search decides what is relevant; it does not decide what is mandatory.**
  Every active P0 memory is retrieved unconditionally, whether or not it shares
  vocabulary with the task. A binding rule phrased in different words is still
  binding, and a worker that never sees it will break it.
- An unregistered directory still builds context from files alone. Degrading to
  fewer signals is correct; pretending memory exists when it does not is not.

## Deduplication

Exact duplicates are detected by content hash. Near duplicates use word-level
5-shingles hashed with FNV-1a and compared with Jaccard similarity; above
**0.90** the weaker copy is dropped, choosing by explicit priority, then
recency, then source quality, then path.

Nothing is deleted from disk. A duplicate is excluded from *this* context and
the exclusion is recorded in the receipt.

## Compression

Deterministic and regex-based; no model involved. Kept lines are:

- imports and exports at any depth
- declarations at module or class level
- class method signatures
- markdown headings, decorators, doc-comment openers
- any line matching the task's vocabulary, plus two lines either side

Indentation is load-bearing: a `const` at column 0 is part of the module's
shape, while an indented one is a local inside a function body. Treating every
binding as structural would mean source files never compress at all.

Everything else collapses into an explicit `… N lines omitted …` marker, so the
worker can see that material was left out rather than silently losing it.
Compression that does not actually reduce the token count is discarded, and the
file on disk is never modified.

## Receipts

Every build produces a receipt, in JSON and human-readable form, written to
`~/.ctxd/context_receipts/`. It records the candidate and final totals, the
tokens removed by duplication / irrelevance / low priority / compression, and
every included and excluded item with its reason, score and priority.

Reduction is always reported as **estimated context avoided**.

## Benchmarks

`tests/fixtures/benchmarks/<name>/` holds a `benchmark.json` describing the
task, budget, MUST_INCLUDE / SHOULD_INCLUDE / MUST_EXCLUDE sets and expected
deduplication, alongside a `project/` fixture repository. The runner discovers
scenarios automatically, so adding one means adding a directory.

`stripe-webhook` is the golden benchmark: a realistic payment service where
candidate context exceeds 50,000 estimated tokens. It asserts that the required
files survive, the irrelevant ones do not, secrets are never collected,
duplicates are removed, P0 is preserved, the receipt accounts for every
candidate, and the whole thing is deterministic.

Regenerate the fixture with:

```bash
node --experimental-strip-types scripts/generate-fixture.ts
```

The generator uses a fixed clock, so timestamps do not drift between runs.

## Algorithm versioning

`ALGORITHM_VERSION` in `types.ts` is recorded in every receipt. Bump it
whenever ranking, dedup or selection behaviour changes, so benchmark results
from different versions stay comparable.
