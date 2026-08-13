# Roadmap

What is built, what is not, and what deliberately never will be.

This describes the real state of the repository. Nothing below is documented as
working unless it is.

## Built

| Phase | Contents | State |
|---|---|---|
| 1 | Foundation — config, paths, SQLite, logging, `doctor`, `status` | ✅ |
| 1.5 | Context Engine — collection, dedup, ranking, budget, compression, receipts | ✅ |
| 2 | Project intelligence — detection, incremental indexing, Git awareness | ✅ |
| 3 | Persistent memory — types, authority order, FTS5 search | ✅ |
| 4 | Production Context Firewall — progressive retrieval | ✅ |
| 5 | MCP + worker integration — 15 tools | ✅ |
| 6 | Tasks, sessions, checkpoints, handoffs | ✅ |
| 7 | Workers, verification, architecture drift, Diff Firewall, output economy | ✅ |
| 8 | Local HTTP API + React interface | ✅ |
| 9 | Optimisation + benchmarks | ✅ |
| 10 | Optional local AI interfaces + offline guarantee | ✅ interfaces |

379 tests, three golden benchmarks. CLI startup ~180ms; FTS5 search and memory
lookup ~1ms over 500 memories.

## Not built

**Tauri desktop shell.** §67 calls it "eventually". The interface runs in a
browser against the local API today.

**An actual local-AI backend.** `@ctxd/ai` is interfaces only. A backend that
talks to Ollama or llama.cpp belongs behind them, in its own package, opted into
explicitly — never in the core, where it would quietly make ctxd reach out.

**More benchmark scenarios.** `database-migration`, `payment-flow`,
`api-refactor` and `frontend-bug` are listed in §26 and would be the highest-value
contribution: retrieval quality is measured, not argued about. See
[benchmarks.md](benchmarks.md) for how to add one.

**Provider tokenizers.** Token counts are a local heuristic, always labelled
estimated. A real tokenizer would plug in behind `TokenEstimator` and change the
label to `exact`.

**A safe formatting-cleanup mechanism.** §53 allows reverting presentation-only
churn *after* verification. The Diff Firewall detects it today and deliberately
does nothing about it.

## Never

From §4 and §85, these are decisions rather than gaps:

- **A cloud backend, accounts, billing or telemetry.** Local-first is the
  product, not a phase.
- **Electron.** Explicitly excluded.
- **A required vector database or embeddings.** Search is deterministic and
  benchmarkable. Embeddings may become optional; they will not become required.
- **An LLM in the core.** Determinism is why the engine can be benchmarked at
  all.
- **Arbitrary shell execution exposed to a worker.** Enforced by a test and a
  CI gate.
- **Autonomous multi-agent orchestration.** ctxd is the memory and the
  firewall; the agents are replaceable workers.
- **An IDE.** The brain stays in core; the interface is a viewer.
- **Exact cost figures.** ctxd has no billing data. Estimates are labelled
  estimates.

## Contributing

Benchmark scenarios first — they are how retrieval quality gets measured rather
than argued about. See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[development.md](development.md).
