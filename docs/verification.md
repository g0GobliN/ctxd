# Verification and workers

After a worker changes code, ctxd runs the project's own checks and reports
`PASS`, `FAIL` or `NEEDS_REVIEW`.

Two rules matter more than the mechanics:

1. **A check that did not run is never reported as passed.**
2. **A check with nothing to verify is not a pass either.** A repository with no
   tests yields `NEEDS_REVIEW`, not a clean bill of health.

## Usage

```bash
ctxd verify --task "Fix the webhook retry limit" --correction
```

| Option | Effect |
|---|---|
| `--only <kinds>` | Comma-separated: `typecheck`, `lint`, `test`, `build` |
| `--rules <file>` | JSON architecture rules (§44) |
| `--correction` | On failure, print the compact correction context |
| `--dry-run` | Show which checks would run, without running them |

Exit codes: `0` PASS · `1` FAIL · `2` NEEDS_REVIEW

## Check discovery

§41: don't call a model where deterministic tooling works. ctxd reads the
project's manifest and runs what is actually there — it does not reimplement
your test runner.

- **Node** — `package.json` scripts, in preference order
  (`typecheck` / `type-check` / `tsc`, `test`, `lint`, `build`)
- **Rust** — `cargo check`, `cargo test`, `cargo build`
- **Go** — `go build ./...`, `go test ./...`
- **Python** — `pytest`

Checks run in a fixed order — typecheck, lint, test, build — so a fast, precise
failure surfaces before a slow one. Every check still runs after an earlier
failure: stopping early would hide a second problem behind the first.

## Controlled execution (§63)

ctxd never exposes arbitrary shell execution — not to a worker, not through MCP,
not through the CLI. Every command is sorted into one of three categories:

| Category | Examples |
|---|---|
| `READ_ONLY` | `git status`, `git diff`, `rg`, `ls` |
| `SAFE_MUTATING` | tests, typecheck, lint, build |
| `DANGEROUS` | `rm`, `git reset`, `git clean`, `git push`, deploys, credential tools |

**An unrecognised command is refused, not assumed safe.** `DANGEROUS` never runs
without explicit confirmation.

No shell is used: the binary and its arguments are passed as separate values, so
a filename containing `;` or `&` is an odd filename rather than a second
command. On Windows, where package managers are `.cmd` shims that Node cannot
spawn directly, a shell is required — so any argument that could change the
command's meaning is refused rather than escaped.

## Architecture drift (§44)

Deterministic pattern rules. No model is involved, and §44 is explicit that none
is required.

```json
[
  {
    "id": "frontend-no-database",
    "rule": "Frontend must not access the database directly.",
    "appliesTo": "^apps/portal/",
    "forbids": "openDatabase|firebase-admin",
    "except": ["^apps/portal/src/legacy/"]
  }
]
```

Only **added** lines are checked — a rule that fired on removed lines would
report a violation the worker just deleted. A rule whose pattern fails to
compile is reported as an error rather than silently never firing, because a
rule that looks like protection but never fires is worse than no rule.

Drift produces `NEEDS_REVIEW`, not `FAIL`: it is a design problem, and it needs
a person rather than a failure verdict.

ctxd ships **no default rules**. Every project's boundaries differ, and a rule
invented by the tool would fire on correct code.

## Correction context (§43, §60)

When verification fails, the wrong move is to resend the original context and
hope. The worker already has it; resending costs the whole budget again and
buries the one new fact — the error — in material already read.

A correction context carries only:

- the failed command and its result
- the relevant part of the error, with file and line extracted
- a window of code around each error location
- the original requirement
- any rule or decision that applies
- the previous attempt, *only* when it would otherwise be repeated — and it is
  the first thing dropped under budget pressure

File and line are parsed from the formats tsc, eslint, node, jest, vitest,
cargo, go and python actually emit. What was left out is listed, so an omission
is visible rather than silent.

## Worker abstraction (§42)

```ts
interface Worker {
  id: string;
  name: string;
  capabilities: readonly string[];
  status(): Promise<WorkerStatus>;
}
```

ctxd knows nothing about how any worker works: no provider SDK, no API call, no
provider-specific branch. `claude`, `cursor` and `local` are shipped as *labels*
— a worker ctxd has never heard of works exactly as well, carrying its own name.

A status ctxd cannot determine is reported as `unknown` with `source: "unknown"`,
never inferred and presented as fact.

## Output and context economy (§58–61)

The context firewall controls what goes to a worker; this controls what comes
back and what gets sent next turn.

**Output modes** — `minimal` (default), `normal`, `detailed`. A minimal report
omits the task text, the repository description, code blocks, the diff and prose
explanation. What remains: what changed, what happened, what could not be
inferred from the code.

**Context deltas** — ctxd maintains `BASE` + `TASK` + `CHANGE` + `ERROR` rather
than resending everything each turn. A delta already sent is skipped unless its
content changed: the delta key includes a digest of the content, so an edited
rule is resent while an unchanged one is not.

An `ERROR` delta is never skipped — it is the reason the turn is happening.
