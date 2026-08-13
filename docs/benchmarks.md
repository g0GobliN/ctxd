# Benchmarks and performance

Retrieval quality is measured, not argued about. That is the point of a
deterministic engine: the same fixture and the same task produce byte-identical
output, so a change either improves the numbers or it does not.

## Scenarios

Each scenario is a realistic repository with declared expectations. The runner
discovers them automatically — a new scenario is a directory with a
`benchmark.json` and a `project/`.

| Scenario | Task | Tests |
|---|---|---|
| `stripe-webhook` | Fix Stripe webhook idempotency | The original: a bug fix in application source, with duplicated docs and a large irrelevant remainder |
| `auth-migration` | Migrate session auth to JWT access tokens | A different domain vocabulary, phrased as a migration rather than a fix |
| `vite-build-error` | Fix the Vite HMR port collision | The answer lives in configuration files and a recorded bug memory, not in application source at all |

One benchmark proves the engine works on one task. Several prove it has not been
*fitted* to that task, which is the real risk with a hand-tuned ranking
function. The scenarios differ deliberately along the axes most likely to expose
overfitting: domain vocabulary, task phrasing, and where the answer lives.

## What each scenario asserts

- Candidate context exceeds the declared floor — the fixture exerts real
  selection pressure rather than being a toy directory
- Final context is within budget, and not empty
- Every `MUST_INCLUDE` file is present
- Every `SHOULD_INCLUDE` file is present
- No `MUST_EXCLUDE` file reached the context
- Near-duplicate documents were detected and the stronger copy kept
- Every P0 item survived
- Secrets were never collected — each fixture contains a real `.env`, or the
  assertion would prove nothing
- A receipt was produced that accounts for **every** candidate
- Every included and excluded item carries a reason
- The whole build is byte-identical on a second run

## Results

Measured with a 10,000 token budget:

| Scenario | Candidate | Final | Estimated context avoided |
|---|---|---|---|
| `stripe-webhook` | 77,305 | 5,670 | 71,635 |
| `auth-migration` | 151,279 | 4,517 | 146,762 |
| `vite-build-error` | 148,750 | 2,122 | 146,628 |

Counts are estimates from a local heuristic tokenizer, never provider billing
units.

`vite-build-error` returns far less than its budget, which is the intended
behaviour: leftover budget is not a reason to send a file. The task needs a
handful of config files and one bug memory, so that is what it gets.

## Regenerating fixtures

```bash
node --experimental-strip-types scripts/generate-fixture.ts     # stripe-webhook
node --experimental-strip-types scripts/generate-benchmarks.ts  # the others
```

Fixtures are deterministic: fixed content, fixed mtimes. `.env` files are
gitignored, so a fresh checkout must regenerate before the secret assertions
mean anything — the benchmark says so explicitly when it finds one missing.

Shared generation machinery lives in `scripts/fixture-kit.ts`. Bulk modules are
deliberately verbose and plausible; a repository of obviously-fake files would
be trivially easy to rank.

## Adding a scenario

1. Generate a fixture under `tests/fixtures/benchmarks/<name>/project/`
2. Write `tests/fixtures/benchmarks/<name>/benchmark.json`
3. Run the suite — the runner picks it up with no further wiring

The specification lists more worth building: `database-migration`,
`payment-flow`, `api-refactor`, `frontend-bug`.

## Performance (§72)

| Target | Spec | Measured |
|---|---|---|
| CLI startup | <200ms | ~180ms (bare Node is ~140ms) |
| FTS5 search | <100ms | ~1ms over 500 memories |
| Memory lookup | <100ms | ~1ms |

`tests/integration/performance.test.ts` asserts these. Each measurement is the
**median** of several runs after an untimed warm-up: a single sample on a shared
machine measures the machine's mood, not the code. Budgets sit well above the
measured figures and well below a known regression, so a failure means something
got structurally slower — an unindexed query, a full-table scan, work moved into
module load.

### Startup

Commands are loaded on demand. Importing every command up front pulled in the
whole dependency graph — including better-sqlite3's native binding — before
ctxd had read its arguments, costing roughly **840ms** on every invocation.
`ctxd --version` has no business paying to open a database driver.

Lazy dispatch brought that to ~180ms, of which ~140ms is Node itself. Commands
that genuinely need the database still pay for it when they run.

> **Do not sacrifice correctness for a benchmark.** A faster context build that
> drops an architectural rule is a worse build.
