# Contributing to ctxd

Thanks for considering it. ctxd is early, which means good contributions have
outsized impact — and that the design rules below matter more than usual.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

Requires **Node.js 24+** and **pnpm** (`corepack enable pnpm` is enough).

```bash
git clone https://github.com/g0GobliN/ctxd.git
cd ctxd
pnpm install
pnpm build
pnpm test
```

Then check your environment the way ctxd checks it:

```bash
node packages/cli/dist/index.js doctor
```

If `doctor` reports a failure it tells you how to fix it. If it reports success,
the check really ran.

## The rules that are not negotiable

These come from the [specification](docs/plan.md) and are the reason ctxd is
worth using. A PR that breaks one will be asked to change, however good the code
is otherwise.

1. **Never claim something works without running it.** No check reports success
   without executing. No README line describes a feature that does not exist.
2. **Local-first.** No cloud service, no telemetry, no accounts, no phoning
   home. The core makes no network calls at all.
3. **Deterministic core.** No embeddings and no LLM calls in the context engine.
   Same inputs, byte-identical output.
4. **Never destroy original data.** Compression changes what a *model* sees.
   Deduplication excludes a copy from *one context*. Files, sessions and
   superseded memories stay on disk.
5. **Every token needs a reason.** An item with no connection to the task is
   excluded even when budget remains. Leftover space is not a justification.
6. **Estimates stay labelled.** Token counts are estimates. Never present them
   as exact, and never convert them to a currency figure.
7. **Unavailable signals read as zero.** If a signal needs a phase that has not
   landed, it is absent — not faked with a plausible-looking number.
8. **Authority is enforced, not decorative.** An inferred memory must never
   silently override an explicit instruction.

## Where help is most valuable

**Benchmark scenarios.** This is the highest-leverage contribution. Retrieval
quality is measured, not argued about, and every new scenario makes the
measurement sharper. Add a directory under `tests/fixtures/benchmarks/`:

```
tests/fixtures/benchmarks/<name>/
├── benchmark.json     # task, budget, MUST_INCLUDE / SHOULD_INCLUDE / MUST_EXCLUDE
└── project/           # a realistic fixture repository
```

The runner discovers scenarios automatically. The spec suggests
`auth-migration`, `database-migration`, `vite-build-error`, `payment-flow`,
`api-refactor` and `frontend-bug` — all unclaimed.

**Ranking quality.** Weights in `packages/context/src/types.ts` are experimental
starting points, not optimal constants. If you can show a weighting that
improves benchmark results without regressing others, that is a great PR.

**Language detection.** `packages/project/src/detect.ts` covers Node, Rust, Go,
Python and JVM. More ecosystems, read from real manifest files, are welcome.

**Phase 7+ work.** The verification engine and Diff Firewall are next. Open an
issue before starting something large so we can agree the shape.

## Making a change

1. Open an issue first for anything non-trivial — it is cheaper to agree on an
   approach than to rewrite a finished PR.
2. Branch from `main`.
3. Make the smallest correct change.
4. Add tests. Every behaviour claim in a PR should have a test that would fail
   without it.
5. Run `pnpm build && pnpm test` before pushing.
6. Update the docs in the same PR. Documentation that lags the code is worse
   than none.

### Code style

- Strict TypeScript, ESM, `NodeNext` resolution — relative imports carry a
  `.js` extension because that is what the compiled output uses.
- `verbatimModuleSyntax` is on: type-only imports need `import type`.
- Prepared statements for all SQL.
- Small modules, explicit interfaces, no circular dependencies.
- Comments explain *why*, not what. If a line needs a comment to say what it
  does, rewrite the line.
- No new dependency unless it clearly reduces complexity. ctxd currently has
  two runtime dependencies and intends to keep the number embarrassing.

### Tests

```
tests/
├── unit/          pure logic
├── integration/   SQLite, the engine, MCP, benchmarks
├── e2e/           the CLI as a subprocess
└── fixtures/      benchmark repositories
```

Anything touching storage must use `createTempHome()` from
`tests/helpers/temp-home.ts`. **No test may touch a real `~/.ctxd`** or depend
on the state of the machine it runs on.

### Adding a migration

Append to `MIGRATIONS` in `packages/db/src/schema.ts` with the next version
number. Never edit a released migration.

### Adding an MCP tool

Only once the service behind it exists. A tool that cannot do what its name
promises is worse than no tool: an agent will call it, believe the result, and
act on nothing.

## Commit messages

Plain, imperative, explaining *why* where it is not obvious:

```
Retrieve mandatory memory regardless of task vocabulary

A P0 rule phrased in different words from the task was never reaching the
worker. Search decides what is relevant; it does not decide what is mandatory.
```

## Pull requests

Describe what changed and why, how you verified it, and anything you chose not
to do. If a benchmark number moved, say so — including if it moved the wrong
way. An honest regression report is more useful than a quiet one.

Reviews focus on: does it hold the rules above, is it tested, is it the
smallest change that solves the problem.

## Questions

Open an issue with the `question` label. If the docs did not answer it, that is
a documentation bug worth fixing too.
