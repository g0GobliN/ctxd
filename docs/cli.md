# CLI reference

Every command supports `--help`. Every command works offline.

```
ctxd <command> [options]
```

## Environment

| Command | Purpose |
|---|---|
| `ctxd doctor` | Verify the local environment |
| `ctxd status` | Version, storage, database, project, Git |
| `ctxd logs` | Read the local log |

`doctor` runs nine checks — Node, SQLite, FTS5, data directory, configuration,
database, logging, Git, offline capability. Each performs real work; **a check
never claims success without executing**. Failures carry a concrete remedy and
the command exits 1.

```bash
ctxd logs --level error --lines 100
ctxd logs --grep webhook --json
```

## Projects

| Command | Purpose |
|---|---|
| `ctxd init` | Register and index a project |

Detection reads real manifest files — `package.json`, lockfiles, `tsconfig.json`,
`Cargo.toml`, `go.mod`, `pyproject.toml`, framework configs — and records the
evidence for every conclusion. Nothing is inferred from directory names.

Project identity anchors to the Git root commit where one exists, so memory
stays attached to the project even if the repository is moved or re-cloned.
Without Git, the absolute path is the anchor.

## Context

| Command | Purpose |
|---|---|
| `ctxd context` | Build the minimum useful context for a task |
| `ctxd search` | Expand context incrementally |
| `ctxd stats` | What ctxd kept out of the model's context |
| `ctxd efficiency` | The reduction, on its own |

```bash
ctxd context --task "Fix the webhook retry logic" --budget 10000
ctxd context --task "…" --context        # print the context instead of the receipt
ctxd context --task "…" --json           # the receipt as JSON
```

`--dir` sets the **collection scope**: files come from the directory you point
at, not the whole repository. Project identity still comes from the repository
root, so memory and Git state follow the project.

Exit code `2` means a warning was recorded — for instance a mandatory item that
would not fit.

## Knowledge

| Command | Purpose |
|---|---|
| `ctxd memory` | Record and search project knowledge |
| `ctxd decision` / `ctxd decisions` | Record and surface decisions |
| `ctxd bug` | Record and surface previous bugs |
| `ctxd explain` | Attach a WHY note to a file or module |

```bash
ctxd decision add --title "Idempotency keys are permanent" \
  --question "May a key be reused after expiry?" --decision "No." \
  --reason "Stripe may retry long after the key would have expired." \
  --file src/payment/idempotency.ts

ctxd decision for src/payment/idempotency.ts
```

Records attached to files are **surfaced automatically by `ctxd diff`** when
those files change. See [memory.md](memory.md).

## Work

| Command | Purpose |
|---|---|
| `ctxd task` | Track units of work |
| `ctxd session` | Track a working session |
| `ctxd checkpoint` | Record where the work stands |
| `ctxd handoff` | Everything another worker needs; `--to <w> --accept` actually moves the work |
| `ctxd resume` | What was I doing? |

See [work.md](work.md).

## Reviewing a worker's changes

| Command | Purpose |
|---|---|
| `ctxd diff` | Inspect changes before accepting them |
| `ctxd verify` | Run the project's own checks |

```bash
ctxd diff --task "Change the retry limit from 3 to 5"
ctxd diff --staged --json
ctxd verify --only typecheck,test --correction
```

`ctxd diff` exits `2` when the change is worth reviewing. `ctxd verify` exits
`0` for PASS, `1` for FAIL, `2` for NEEDS_REVIEW.

Neither writes to Git. See [diff-firewall.md](diff-firewall.md) and
[verification.md](verification.md).

## Workers and interface

| Command | Purpose |
|---|---|
| `ctxd mcp` | Run the MCP server |
| `ctxd ui` | Serve the local API and interface |
| `ctxd desktop` | The same interface in a window — needs the Tauri shell built ([ui.md](ui.md)) |

```bash
claude mcp add ctxd -- ctxd mcp --dir /path/to/project --worker claude
ctxd ui --print-token
```

## Portability

| Command | Purpose |
|---|---|
| `ctxd export` | Take your knowledge elsewhere |
| `ctxd import` | Bring knowledge from another machine |

```bash
ctxd export --dir . --out knowledge.json
ctxd import knowledge.json --dir . --dry-run
```

Import never deletes and never overwrites. A record already present is skipped;
a conflicting one is reported so you decide. Exit code `2` means conflicts were
found.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Error — bad input, missing project, failed verification |
| `2` | Attention needed — warnings, a change worth reviewing, import conflicts |

## Conventions

Output goes to stdout; diagnostics and logs go to stderr, so stdout stays
parsable. Token counts are always labelled **estimated** — ctxd has no billing
data and never reports a cost.

Startup is around 180ms because commands are loaded on demand: `ctxd --version`
does not pay to open a database driver.
