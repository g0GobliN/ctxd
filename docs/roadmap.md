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

655 tests. Seven context benchmarks and three change benchmarks. CLI startup
~180ms; FTS5 search and memory lookup ~1ms over 500 memories.

## 2.0 — complete

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
| UI-10 | Tauri 2 shell — packaging only, never the foundation | ✅ |
| UI-11 | Cross-worker handoff | ✅ |
| UI-12 | Benchmarks, including the small-change scenarios | ✅ |

## 2.1 / 2.2 — the desktop as the whole surface

The panels record as well as display, and the goal is that nothing requires a
terminal. Registering a project, building context, recording memory, creating
and moving tasks, starting a session, checkpointing, handing work to another
worker and running verification each have a route that calls the same core
function the CLI calls.

Authority rules are not bypassed — a refusal comes back as a `409` with its
reason. Project selection is pinned in the interface and applied to reads and
writes together, so switching cannot leave the panels showing one project while
a write lands in another.

Mutating routes need the local token. A browser is told it once in Settings; the
**desktop window is never asked** — `ctxd desktop` hands it to the Tauri shell,
which injects it into its own webview, so the token is never served over HTTP.
See [api.md](api.md), [ui.md](ui.md) and [desktop.md](desktop.md).

`ctxd export`/`import` and `ctxd doctor` are what remain CLI-only. `runDoctor`
lives in `@ctxd/cli`, and `@ctxd/api` cannot import from it without inverting
the dependency.

## 2.3 — the agent loop

Give a task to the window and ctxd runs the whole loop: it selects the context,
chooses a worker and model, starts Claude Code, and puts what comes back through
the Diff Firewall.

**This overrides the *Never* entry below on autonomous orchestration**, at the
project owner's explicit direction. What did not change: ctxd opens no socket of
its own — it starts Claude Code, authenticated by the developer's subscription,
so no API key is ever handled. Edits are off by default, and nothing is
committed, reverted or accepted; a run ends with a Change Receipt a person still
has to agree with.

Routing reports Cursor as **unrunnable, with the reason** — it is an editor with
no headless mode, so work reaches it through a handoff rather than by being
started. Model choice is deterministic, from the size of the built context.

Measured on this repository: 1,561,289 candidate tokens → 5,950 sent → correct
answer in one turn. See [plan-tracker.md](plan-tracker.md).

## Not built

**A desktop installer.** The Tauri shell itself is built and verified — see
[desktop.md](desktop.md) — but [`tauri.conf.json`](../packages/desktop/tauri.conf.json)
sets `"bundle": { "active": false }`, so there is no `.msi`, `.dmg` or
`.AppImage` to download. The window is also not self-contained: it needs the
Node API running beside it, so an installer today would deliver something that
cannot start on its own. Shipping one means deciding whether to bundle a Node
runtime as a Tauri sidecar or to treat the app as a companion to the CLI
install.

The shell is also unverified on macOS and Linux. It builds and runs on
Windows 11; nobody has built it elsewhere.

**A system tray.** §26 lists a tray, quick status and pause-worker as a possible
future, and says plainly not to implement it before core desktop packaging
works.

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
- ~~**Autonomous multi-agent orchestration.**~~ **Overridden in 2.3.** ctxd now
  starts a worker and runs the loop. It is still the memory and the firewall,
  and the agents are still replaceable workers — but it no longer only waits to
  be called. Recorded rather than deleted, because the reasoning behind the
  original position still explains the shape of what was built.
- **An IDE.** The brain stays in core. Since 2.1 the interface can record what
  the CLI records, but it still renders decisions rather than making any.
- **Exact cost figures.** ctxd has no billing data. Estimates are labelled
  estimates.

## Contributing

Benchmark scenarios first — they are how retrieval quality gets measured rather
than argued about. See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[development.md](development.md).
