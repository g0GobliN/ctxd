# Architecture

This document describes what exists today. It is updated as each phase lands,
and it never describes unimplemented features as if they worked.

Current phase: **9 (optimisation and benchmarks) complete**.

## Shape

```
                   HUMAN
                     │
                     ▼
                   ctxd
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
       CLI          MCP        HTTP API
        │            │            │
        ▼            ▼            ▼
   developer    Claude/Cursor   React UI
   terminal       workers       (loopback only)
```

ctxd is the persistent engineering layer. AI workers are replaceable: no
package depends on a specific provider, and none ever will — provider details
stay behind interfaces at the edges.

## Packages

The monorepo starts deliberately small. Packages are added only when a real
architectural need appears, not for symmetry.

| Package | Responsibility |
|---------|----------------|
| `@ctxd/utils` | Dependency-free helpers: path expansion, secret redaction, output formatting |
| `@ctxd/core` | Configuration, paths, logging, shared types |
| `@ctxd/db` | SQLite connection, pragmas, schema, migrations |
| `@ctxd/context` | The context firewall: collection, dedup, ranking, budget, compression, receipts |
| `@ctxd/project` | Project detection, incremental indexing, read-only Git inspection |
| `@ctxd/memory` | Project memory: authority, storage, FTS5 search |
| `@ctxd/firewall` | Composition root: memory and Git retrieval feeding the context engine |
| `@ctxd/diff` | The Diff Firewall: change surface, noise detection, over-edit signals, Change Receipts |
| `@ctxd/verify` | Workers, controlled execution, verification, architecture drift, correction context |
| `@ctxd/work` | Tasks, sessions, checkpoints, handoffs |
| `@ctxd/mcp` | Model Context Protocol server exposing the same services |
| `@ctxd/stats` | Aggregates receipts into token statistics and efficiency reports |
| `@ctxd/api` | Local HTTP API on 127.0.0.1, token-gated writes, serves the interface |
| `@ctxd/ui` | React interface, built by Vite to static files (build-time deps only) |
| `ctxd` | Argument parsing and commands — the published CLI package |

Dependency direction is strictly one-way:

```
utils ← core ────────────← cli
utils ← context ←─────────┘
        db ← project ←── firewall
        db ← memory ←────┘
                  firewall ← mcp ← cli
        context ← diff ← verify ← cli
        firewall + diff ←── api ← cli
                            api serves ui/dist (static)
```

`@ctxd/diff` depends on nothing but `@ctxd/context` (for token estimation and
term normalisation) and reads Git directly, so the Diff Firewall can be
exercised as a pure function over a parsed diff with no database involved.
`@ctxd/verify` builds on it: a correction context needs to know which file the
failure points at.

`@ctxd/firewall` is the composition root. It is a package rather than CLI code
because MCP and the HTTP API must call the same services — business logic is
never duplicated per entry point.

`@ctxd/db` deliberately does not depend on `@ctxd/core`: it takes a path and
returns a database, so it can be used from tests and future packages without
dragging configuration along.

Packages arrive with the phases that need them, not before. `@ctxd/ui` is the
only one with a dependency tree, and it is build-time only: React and Vite
produce static files, and nothing remote is fetched at runtime.

`@ctxd/context` depends only on `@ctxd/utils`, so the engine can be exercised
as a pure function without configuration or a database — which is what the
benchmark suite does.

## Configuration and paths

`resolvePaths()` is the single place that decides where data lives:

1. `CTXD_HOME` environment variable — used by tests, and by anyone running
   multiple isolated instances
2. `storage.directory` from configuration
3. `~/.ctxd`

A leading `~` is expanded at runtime against the real home directory, so no
user-specific absolute path is ever written to disk.

`loadConfig()` never throws on bad input. Invalid fields fall back to their
default and are returned as errors, so a malformed config produces a clear
report from `ctxd doctor` instead of a crash or, worse, silently changed
behaviour.

## Database

`openDatabase()` sets `journal_mode = WAL` and `foreign_keys = ON` on every
connection. FTS5 is verified by creating and dropping a temporary virtual
table — proving the module actually works rather than trusting a compile flag.

Migrations are an append-only array in `schema.ts`. `migrate()` reads the
current version from the `meta` table (absent table means version 0), applies
each pending migration inside a transaction, and records the new version in the
same transaction. A database written by a newer ctxd raises `SchemaTooNewError`
rather than being downgraded: the schema is never silently altered.

Schema version 1 creates `meta`. Version 2 adds `projects` and `files`.
Version 3 adds `memories` plus an external-content FTS5 index kept in sync by
triggers. Version 4 adds `tasks`, `sessions`, `session_events` and
`checkpoints`.

Foreign keys encode intent: deleting a project cascades to everything it owns,
while deleting a parent task sets its children's `parent_task` to NULL —
tidying up must not destroy planned work.

`files` records path, size, mtime, hash, language and type — never content. The
repository stays the source of truth; the index only records what was seen, so
an unchanged file can be skipped next time. Deleting a project cascades to its
file rows.

## Logging

Structured, newline-delimited JSON. Every field passes through
`redactSecrets()` before it is written, so passwords, API keys, tokens and
credentials cannot reach a log file even if something upstream collects them by
mistake. Records go to stderr by default, keeping stdout parsable.

`multiSink()` isolates sink failures — a full disk or a closed pipe must not
take down the CLI.

## CLI

`packages/cli/src/index.ts` selects a command from the first non-flag argument
and hands the remaining arguments over untouched, so each command owns its own
option parsing. Every command supports `--help`.

`doctor` runs eight checks — Node, SQLite, FTS5, data directory, configuration,
database, logging, Git. Each performs real work; a check never claims success
without executing. Failures carry a concrete remedy and the command exits 1.

`status` reads state without requiring an initialised project, so it works
anywhere, including outside a Git repository.

`context` builds the minimum useful context for a task and writes a receipt.
The engine itself is described in [context-engine.md](context-engine.md).

`memory` records and searches project knowledge; the authority rules are in
[memory.md](memory.md).

`search` expands context incrementally: summaries first, bodies only when
asked. File reads are confined to the project root.

`task`, `session`, `checkpoint`, `handoff` and `resume` carry work across
interruptions; see [work.md](work.md).

`diff` inspects a worker's changes and `verify` runs the project's own checks;
see [diff-firewall.md](diff-firewall.md) and [verification.md](verification.md).

`ui` serves the local HTTP API and the built interface on 127.0.0.1; see
[api.md](api.md) and [ui.md](ui.md).

`stats` and `efficiency` aggregate receipts into a reduction report; see
[benchmarks.md](benchmarks.md).

Commands are imported on demand. Loading them all up front dragged the whole
dependency graph — including the SQLite binding — into `ctxd --version`, which
cost roughly 840ms per invocation; lazy dispatch brings startup to ~180ms
against a bare-Node floor of ~140ms (§72).

`init` detects a project, registers it and indexes its files. Detection reads
real manifest files and records the evidence for every conclusion; nothing is
inferred from directory names. Project identity is anchored to the Git root
commit where one exists, so memory stays attached to the project even if the
repository is moved or re-cloned; without Git, the absolute path is the anchor.

Git access is read-only throughout. ctxd never writes to a repository, and Git
remains the source of truth for history.

## Testing

- **unit** — configuration validation, path resolution, redaction, logging
- **integration** — SQLite pragmas, FTS5, migrations, and the golden benchmark
- **e2e** — the CLI as a subprocess

Every test that touches storage runs against a temporary `CTXD_HOME` created by
`tests/helpers/temp-home.ts`. No test reads or writes the developer's real
`~/.ctxd`, and no test depends on the state of the host machine.
