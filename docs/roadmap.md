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

617 tests. Seven context benchmarks and three change benchmarks. CLI startup
~180ms; FTS5 search and memory lookup ~1ms over 500 memories.

## 2.0 — in progress

The graph control centre. See [plan.md](plan.md) for the full specification and
phase order; the short version is that 1.0 built the parts and 2.0 connects
them into one live view.

| Phase | Contents | State |
|---|---|---|
| UI-0 | Audit, stale documentation corrected | ✅ |
| UI-1 | `events` table + `GET /api/events` over SSE | ✅ |
| UI-2 | Real worker state; `claimed_worker` on Context Receipts | ✅ |
| UI-3 | Graph home screen, hand-written SVG | ✅ |
| UI-4 | Live graph driven by events | ✅ |
| UI-5 | Activity stream | ✅ |
| UI-6 | Change Firewall surfaced in the interface | ✅ |
| UI-7 | Token monitor via `/api/stats` | ✅ |
| UI-8 | Verification freshness | ✅ |
| UI-9 | Graph interaction — pan, zoom, drag, collapse | ✅ |
| UI-10 | Tauri 2 shell — packaging only, never the foundation | ⚠ partial |
| UI-11 | Cross-worker handoff | ✅ |
| UI-12 | Benchmarks, including the small-change scenarios | ✅ |

## Not built

**Tauri desktop shell — written, never compiled.** §67 calls it "eventually",
and 2.0 keeps it last: it is packaging around the same React interface, not a
foundation to build on. The interface runs in a browser against the local API
today, and that path is fully tested.

`packages/desktop/` holds a Tauri 2 crate and `ctxd desktop` starts the API and
would launch it. The TypeScript half is built and tested. The **Rust half has
never been compiled or even type-checked**: this machine has no `dlltool`
(MinGW binutils absent) and no MSVC linker (no Visual Studio or Windows SDK), so
`cargo build` and `cargo check` both fail inside a dependency's codegen. Treat
that source as written but entirely unverified.

To finish it, install MinGW binutils or the MSVC build tools, then:

```bash
cargo build --release --manifest-path packages/desktop/Cargo.toml
ctxd desktop
```

Nothing else depends on it. Every other command works with the shell absent,
which `tests/e2e/desktop.test.ts` asserts.

**An actual local-AI backend.** `@ctxd/ai` is interfaces only. A backend that
talks to Ollama or llama.cpp belongs behind them, in its own package, opted into
explicitly — never in the core, where it would quietly make ctxd reach out.

**More benchmark scenarios.** All seven §26 context scenarios exist —
`auth-migration`, `stripe-webhook`, `vite-build-error`, `database-migration`,
`payment-flow`, `api-refactor` and `frontend-bug` — alongside three change
scenarios covering the output firewall: `small-change-focused`,
`small-change-sprawl` and `large-change-proportionate`. Both runners pick up a
new fixture directory without any wiring. Further scenarios remain the
highest-value contribution: quality is measured, not argued about. See
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
