<div align="center">

# ctxd

**A context firewall for AI coding agents.**

Local-first engineering memory that gives Claude Code, Cursor and friends the
*minimum useful context* for a task — and explains every token it sent.

[![CI](https://github.com/g0GobliN/ctxd/actions/workflows/ci.yml/badge.svg)](https://github.com/g0GobliN/ctxd/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/g0GobliN/ctxd/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A524-brightgreen)](https://nodejs.org)

</div>

---

## Install

```bash
npm install -g @ctxd/cli
ctxd doctor
```

Requires **Node.js 24+**. `doctor` verifies Node, SQLite, FTS5, storage,
config, the database, logging, Git and offline capability — every check
actually runs.

## The problem

You paste your repo into an AI agent. It gets 60,000 tokens, most of it
irrelevant, and still misses the one architectural rule that mattered. Next
session you explain the same project again. And again.

## What it does

```
$ ctxd context --task "Fix Stripe webhook idempotency" --budget 10000

CONTEXT RECEIPT 87f27bbb

Candidate: 76,182 estimated tokens
Final:     4,547 estimated tokens
Estimated context avoided: 71,635

Included (16):
  ✓ docs/rules.md                       [P0]  reason: mandatory (P0)
  ✓ src/payment/webhook.ts              [P2]  reason: direct task relevance
  ✓ memory/decision/idempotency-key.md  [P1]  reason: project memory
  …

Excluded (61):
  × src/camera/stream.ts           — no task relevance
  × docs/architecture-overview.md  — duplicate of docs/architecture.md
```

Every inclusion and exclusion has a stated reason. Not compression:
**selection you can audit**.

> Storage is cheap. Model context is expensive.

## Quickstart

```bash
ctxd init                                              # register a project
ctxd context --task "Fix the webhook retry logic"      # build context
ctxd diff --task "Fix the webhook retry logic"         # inspect what an AI changed
ctxd verify                                            # run your own checks
ctxd ui                                                # http://127.0.0.1:4317
ctxd desktop                                           # the same, in a window
```

## Connect an AI worker

```bash
claude mcp add ctxd -- ctxd mcp --dir /path/to/project
```

Claude Code and Cursor then share one project memory — neither owns it. The
agent asks ctxd for context instead of reading your whole repository.

**A worker cannot overwrite what you told it.** Agent conclusions are stored as
`worker_statement` with visible confidence; one that contradicts a rule you
stated is refused and the conflict reported.

## The other direction

`ctxd diff` inspects what comes back — semantic change versus formatting noise
versus files the task never mentioned. It never edits, reverts or rejects
anything: a large diff is not wrong by itself, and the firewall makes the
*shape* of a change visible so a person can decide.

## Principles

- **Local-first.** No cloud, no accounts, no telemetry.
- **Deterministic.** No embeddings, no LLM in the core — which is why it can be
  benchmarked.
- **Auditable.** Every build produces a receipt.
- **Provider-independent.** Claude, Cursor and whatever comes next are
  *workers*. They are replaceable; your memory is not.
- **Honest.** Token counts are labelled estimates, never dollar figures.

## Documentation

Full docs, architecture and the specification live in the repository:
**[github.com/g0GobliN/ctxd](https://github.com/g0GobliN/ctxd)**

655 tests, seven context benchmarks and three change benchmarks.
APIs may change before 1.0.

## Licence

[MIT](https://github.com/g0GobliN/ctxd/blob/main/LICENSE) © the ctxd authors.
