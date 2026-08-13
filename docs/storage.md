# Storage

Everything ctxd knows lives in one directory on your machine. Nothing is sent
anywhere, and nothing here needs ctxd to read it.

## Where

Resolution order, first match wins:

1. `CTXD_HOME` — used by the test suite, and by anyone running isolated instances
2. `storage.directory` in configuration
3. `~/.ctxd`

A leading `~` is expanded at runtime, so no user-specific absolute path is ever
written to disk. The directory is created on demand with mode `0700`; ctxd never
assumes it exists.

## Layout

```
~/.ctxd/
  config.json          configuration; never contains secrets
  ctxd.db              SQLite: metadata, relationships, FTS5 index
  api-token            local API token, 0600
  projects/            per-project human-readable storage
  archive/             superseded records, kept rather than deleted
  snapshots/           point-in-time captures
  context_receipts/    one JSON file per context build
  change_receipts/     one JSON file per change review
  logs/                newline-delimited JSON, secrets redacted at write time
  cache/               derived data, safe to delete
  exports/             ctxd export output
```

Per project:

```
projects/<project-id>/
  project.md               what this project is
  stack.md                 detected runtime, language, framework, evidence
  git.md                   repository state as last seen
  agent-instructions.md    what to tell Claude Code or Cursor
  mcp-setup.md             how to connect a worker
  memory/                  memory bodies as Markdown
  sessions/                session records
  snapshots/               project snapshots
```

## What goes in SQLite, and what does not

SQLite holds metadata, relationships and the search index: projects, files,
memories, tasks, sessions, checkpoints, plus an external-content FTS5 index kept
in sync by triggers.

Large, durable, human-readable knowledge lives in Markdown instead. Putting
every body in a database would make the most valuable thing ctxd stores —
project reasoning — unreadable without ctxd.

`files` records path, size, mtime, hash, language and type. **Never content.**
The repository stays the source of truth; the index only records what was seen,
so an unchanged file can be skipped next time.

## Receipts are files

Context and change receipts are written as individual JSON files, not database
rows. That is deliberate: a receipt is evidence, and evidence should outlive the
tool that produced it. `ctxd stats` and the interface both read the directory.

Receipts are written once and never rewritten.

## Nothing is destroyed

Superseded memories move to `archive/` rather than being deleted. Compression
changes only the model-facing context — never what is stored. Raw sessions,
agent output, snapshots, task history and original files are all preserved.

## What is never stored

`.env` files and their variants, private keys (`*.pem`, `*.key`, `*.p12`),
anything under `secrets/` or `private/`, and everything `.gitignore` or
`.ctxdignore` excludes. These are refused at collection time, so a secret cannot
reach the index, a receipt, a log or a worker.

Logs pass every field through `redactSecrets()` before writing, so a credential
collected by mistake upstream still cannot land in a log file.

## Schema versions

Migrations are an append-only array. `migrate()` reads the current version,
applies each pending migration inside a transaction, and records the new version
in the same transaction.

A database written by a **newer** ctxd raises `SchemaTooNewError` rather than
being downgraded. The schema is never silently altered.

| Version | Adds |
|---|---|
| 1 | `meta` |
| 2 | `projects`, `files` |
| 3 | `memories` + FTS5 index |
| 4 | `tasks`, `sessions`, `session_events`, `checkpoints` |

## Moving to another machine

```bash
ctxd export --dir . --out knowledge.json
ctxd import knowledge.json --dir .
```

Plain JSON with a documented shape. Import never deletes and never overwrites —
see [api.md](api.md) and the export section of the CLI reference.

## Deleting

`~/.ctxd` can be removed entirely. Your repositories are untouched: ctxd never
writes to them, and Git remains the source of truth for history.
