<div align="center">

# ctxd

**A context firewall for AI coding agents.**

Local-first engineering memory that gives Claude Code, Cursor and friends the
*minimum useful context* for a task — and explains every token it sent.

[![CI](https://github.com/g0GobliN/ctxd/actions/workflows/ci.yml/badge.svg)](https://github.com/g0GobliN/ctxd/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A524-brightgreen)](https://nodejs.org)

</div>

---

## The problem

You paste your repo into an AI agent. It gets 60,000 tokens, most of it
irrelevant, and still misses the one architectural rule that mattered. Next
session you explain the same project again. And again.

Meanwhile the agent "helpfully" reformats a file you asked it to change one
line in.

## What ctxd does

```
$ ctxd context --task "Fix Stripe webhook idempotency" --budget 10000

CONTEXT RECEIPT 87f27bbb

Candidate: 76,182 estimated tokens
Final:     4,547 estimated tokens
Estimated context avoided: 71,635

Included (16):
  ✓ docs/rules.md                       [P0]  reason: mandatory (P0)
  ✓ src/payment/webhook.ts              [P2]  reason: direct task relevance
  ✓ src/payment/idempotency.ts          [P2]  reason: direct task relevance
  ✓ memory/decision/idempotency-key.md  [P1]  reason: project memory (accepted_decision)
  …

Excluded (61):
  × src/camera/stream.ts           — no task relevance
  × docs/architecture-overview.md  — duplicate of docs/architecture.md
  × .ctxd/sessions/session-2.md    — low priority
```

76k tokens of candidate context became 4.5k — and every inclusion and exclusion
has a stated reason. Not compression: **selection you can audit**.

> **Storage is cheap. Model context is expensive.**
> Every token sent to a model should have a reason to exist.

## Principles

- **Local-first.** No cloud, no accounts, no telemetry. Your repository, memory
  and decisions never leave your machine.
- **Deterministic.** No embeddings, no LLM in the core. The same inputs produce
  byte-identical output, which is why it can be benchmarked.
- **Auditable.** Every context build produces a receipt. Nothing is included
  without a reason, and nothing is dropped silently.
- **Provider-independent.** Claude, Cursor and whatever comes next are
  *workers*. They are replaceable; your memory is not.
- **Honest.** Token counts are labelled estimates, never dollar figures.
  Unavailable signals read as zero rather than being invented.

## Install

Requires **Node.js 24+** and **pnpm**.

```bash
git clone https://github.com/g0GobliN/ctxd.git
cd ctxd
pnpm install
pnpm build

node packages/cli/dist/index.js doctor
```

`doctor` verifies Node, SQLite, FTS5, storage, config, the database, logging and
Git. Every check actually runs — none reports success without executing.

## Quickstart

```bash
# 1. Register your project. Detection reads real manifest files,
#    never guesses from directory names.
ctxd init --dir .

# 2. Build context for a task
ctxd context --task "Fix the webhook retry logic" --budget 10000

# 3. Record what a future session could not infer from the code
ctxd memory add --type DECISION --source accepted_decision \
  --title "Retry with exponential backoff" \
  --content "Fixed intervals caused a thundering herd under load."

# 4. Keep work across interruptions
ctxd session start --worker claude
ctxd checkpoint --next "Fix the 409 path then rerun tests"
ctxd resume
ctxd handoff --to cursor
```

## Connect an AI worker

```bash
claude mcp add ctxd -- ctxd mcp --dir /path/to/project
```

Claude Code and Cursor then share one project memory — neither owns it. The
agent asks ctxd for context instead of reading your whole repository, and
records what it learns.

Crucially: **a worker cannot overwrite what you told it.** Agent conclusions are
stored as `worker_statement` with visible confidence. If one contradicts a rule
you stated, the write is refused and the conflict reported.

## How it works

```
task ──► signals ──► candidates ──► dedup ──► rank ──► budget ──► receipt
                          ▲                              │
                     memory + git                  compression
```

| Stage | What it does |
|-------|--------------|
| **Signals** | Normalise the task into terms and phrases |
| **Candidates** | Walk the repo honouring `.gitignore`/`.ctxdignore`; never index secrets |
| **Retrieval** | Pull in relevant project memory and current Git state |
| **Dedup** | Drop exact and near-duplicate copies (shingles + Jaccard > 0.90) |
| **Rank** | Weighted signals: keyword, path, file type, priority, recency, token cost |
| **Budget** | Select the set that fits; compress what doesn't; **never truncate** |
| **Receipt** | Explain every inclusion and exclusion |

Two rules do most of the work:

- **Leftover budget is not a reason to send a file.** An item with no
  connection to the task is excluded even when there is room. This is why a
  10k budget often returns 4.5k.
- **Search decides what is relevant; it does not decide what is mandatory.**
  Every P0 rule is retrieved whether or not it shares vocabulary with the task.

Deep dive: [docs/context-engine.md](docs/context-engine.md).

## Commands

| Command | Purpose |
|---------|---------|
| `ctxd doctor` | Verify the local environment |
| `ctxd status` | Version, storage, database, project, Git |
| `ctxd init` | Register and index a project |
| `ctxd context` | Build minimum useful context for a task |
| `ctxd search` | Expand context incrementally |
| `ctxd memory` | Record and search project knowledge |
| `ctxd task` | Track units of work |
| `ctxd session` | Track a working session |
| `ctxd checkpoint` | Record where the work stands |
| `ctxd handoff` | Everything another worker needs |
| `ctxd resume` | What was I doing? |
| `ctxd mcp` | Run the MCP server |

Every command supports `--help`.

## Project status

**Early but real.** Phases 1–6 of the [specification](docs/plan.md) are built,
tested and documented — 212 tests, including a golden benchmark that turns a
76k-token fixture repository into 4.5k while keeping everything the task needs.

| Phase | Status |
|-------|--------|
| 1 · Foundation | ✅ |
| 1.5 · Context engine | ✅ |
| 2 · Project intelligence | ✅ |
| 3 · Persistent memory | ✅ |
| 4 · Production context firewall | ✅ |
| 5 · MCP + worker integration | ✅ |
| 6 · Tasks, sessions, checkpoints, handoffs | ✅ |
| 7 · Verification + Diff Firewall | 🚧 next |
| 8 · Web UI | ⬜ |
| 9 · Optimisation + benchmarks | ⬜ |
| 10 · Optional local AI | ⬜ |

Not built yet: worker verification, the diff firewall, the web UI. Nothing in
this repository calls a network service or an AI model.

APIs may change before 1.0.

## Documentation

| Document | Contents |
|----------|----------|
| [architecture.md](docs/architecture.md) | Packages, dependencies, schema |
| [context-engine.md](docs/context-engine.md) | Ranking, selection, compression, receipts |
| [memory.md](docs/memory.md) | Memory types, authority order, FTS5 search |
| [work.md](docs/work.md) | Tasks, sessions, checkpoints, handoffs |
| [mcp.md](docs/mcp.md) | The MCP tool surface |
| [development.md](docs/development.md) | Building, testing, conventions |
| [plan.md](docs/plan.md) | The full specification |

## Contributing

Contributions are very welcome — especially benchmark scenarios, which is how
retrieval quality gets measured rather than argued about.

Start with [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
pnpm install && pnpm build && pnpm test
```

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Security issues: see [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE) © the ctxd authors.
