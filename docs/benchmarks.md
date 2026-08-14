# Benchmarks and performance

Retrieval quality is measured, not argued about. That is the point of a
deterministic engine: the same fixture and the same task produce byte-identical
output, so a change either improves the numbers or it does not.

There are two kinds. **Context scenarios** measure the input firewall: what
reached the model. **Change scenarios** measure the output firewall: what the
worker did with it. Both live under `tests/fixtures/benchmarks` and are told
apart by a `kind` field, which defaults to `context` — retrieval quality and
edit discipline are the two things ctxd claims to improve, and measuring only
one would leave half the claim unevidenced.

## Context scenarios

Each scenario is a realistic repository with declared expectations. The runner
discovers them automatically — a new scenario is a directory with a
`benchmark.json` and a `project/`.

| Scenario | Task | Tests |
|---|---|---|
| `stripe-webhook` | Fix Stripe webhook idempotency | The original: a bug fix in application source, with duplicated docs and a large irrelevant remainder |
| `auth-migration` | Migrate session auth to JWT access tokens | A different domain vocabulary, phrased as a migration rather than a fix |
| `vite-build-error` | Fix the Vite HMR port collision | The answer lives in configuration files and a recorded bug memory, not in application source at all |
| `database-migration` | Split the customer name column | The answer is an *ordered* set of files, where the newest migration matters more than an older one |
| `payment-flow` | Trace the checkout payment flow | A feature spanning four modules — a build that finds only the single best match fails |
| `api-refactor` | Share one request validation helper | A legitimately broad task, checking the engine does not punish breadth that was asked for |
| `frontend-bug` | Date picker clipping in a scroll panel | Component and stylesheet vocabulary; the fix is in a `.tsx` and a `.css` |

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

## Change scenarios

The output firewall, measured the way the input firewall is. A change scenario
is a directory with `"kind": "change"`, a unified diff, and the verdict the
firewall is expected to reach.

The diff is a checked-in file rather than a repository built at test time. The
Diff Firewall is a pure function over a parsed diff, so a fixture diff measures
exactly what a real one would, with no Git in the measurement.

| Scenario | Task | Tests |
|---|---|---|
| `small-change-focused` | Fix the off-by-one in the retry limit | The firewall staying **quiet**: FOCUSED, efficiency ≥ 0.85, none of the noise signals |
| `small-change-sprawl` | The same fix, delivered as a whole-file reformat plus unrelated files and a new dependency | Small-fix protection (§55): NEEDS_REVIEW at high risk, mismatch flagged, evidence attached |
| `large-change-proportionate` | Migrate the payment module to the new Stripe client | The §50 direction: a genuinely large, genuinely relevant change must **not** be flagged as a mismatch |

Two scenarios would not be enough, because the Diff Firewall can fail in two
opposite ways and only one of them is obvious. Missing a sprawling diff is the
failure people expect. Warning about a necessary one is the failure that gets
the tool switched off — so `large-change-proportionate` exists specifically to
fail if the scoring is tightened until honest work trips it.

`small-change-sprawl` was written expecting `SUSPICIOUS`. The firewall returned
`NEEDS_REVIEW`, and it was right: §55 says a small task with a large change must
*require review*. The expectation was corrected, not the code. The scenario also
deliberately expects `src/http/client.ts` **not** to count as unrelated — it
imports the changed file and shares the task's vocabulary, and encoding that
false alarm as acceptable would have taught the benchmark to accept exactly the
noise that makes developers stop reading warnings.

## Results

Measured with a 10,000 token budget:

| Scenario | Candidate | Final | Estimated context avoided |
|---|---|---|---|
| `stripe-webhook` | 76,558 | 4,678 | 71,880 |
| `auth-migration` | 150,532 | 3,357 | 147,175 |
| `vite-build-error` | 148,003 | 1,212 | 146,791 |
| `database-migration` | 147,933 | 1,069 | 146,864 |
| `payment-flow` | 145,811 | 1,882 | 143,929 |
| `api-refactor` | 112,198 | 3,538 | 108,660 |
| `frontend-bug` | 146,902 | 1,608 | 145,294 |

Counts are estimates from a local heuristic tokenizer, never provider billing
units.

Most scenarios return far less than their budget, which is the intended
behaviour: **leftover budget is not a reason to send a file.**

That rule was not being honoured until these scenarios were added. `payment-flow`
and `frontend-bug` both admitted an unrelated service module whose only tie to
the task was a single incidental word — an HR service whose SQL says `ORDER BY`
against a task mentioning "order". The relevance gate accepted any keyword score
above zero, so one coincidental term out of eight counted as a connection, and
the file was labelled "supporting context" while supporting nothing.

The gate now requires a keyword score of at least 0.12, which scales with the
task: on an eight-term task a lone stray match scores 0.10 and is dropped, while
on a three-term task a single genuine match scores 0.27 and is kept. A path
match remains sufficient on its own — directory and file names are chosen
deliberately, so a path hit is evidence in a way one word in a comment is not.

Every scenario got tighter as a result, with no required file lost.

## Regenerating fixtures

```bash
node --experimental-strip-types scripts/generate-fixture.ts       # stripe-webhook
node --experimental-strip-types scripts/generate-benchmarks.ts    # auth-migration, vite-build-error
node --experimental-strip-types scripts/generate-benchmarks-2.ts  # the remaining four
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

Every scenario the specification lists is now built. New ones are welcome — the
most useful are those that stress a retrieval property the existing seven do
not.

## Performance (§72)

| Target | Spec | Measured |
|---|---|---|
| CLI startup | <200ms | ~180ms (bare Node is ~140ms) |
| FTS5 search | <100ms | ~1ms over 500 memories |
| Memory lookup | <100ms | ~1ms |

`tests/integration/performance.test.ts` asserts the search and lookup figures as
the **median** of several runs after an untimed warm-up, in process against a
seeded database.

Startup is asserted *structurally* rather than by stopwatch: the suite runs test
files in parallel, and under that load bare Node alone takes hundreds of
milliseconds, so any wall-clock budget would measure the machine rather than the
code. The test instead requires the CLI entry point to import only what
`--version` needs, with every command reached through a dynamic import — the
property that produced the speed-up, which cannot drift with load.

### Startup

Commands are loaded on demand. Importing every command up front pulled in the
whole dependency graph — including better-sqlite3's native binding — before
ctxd had read its arguments, costing roughly **840ms** on every invocation.
`ctxd --version` has no business paying to open a database driver.

Lazy dispatch brought that to ~180ms, of which ~140ms is Node itself. Commands
that genuinely need the database still pay for it when they run.

> **Do not sacrifice correctness for a benchmark.** A faster context build that
> drops an architectural rule is a worse build.
