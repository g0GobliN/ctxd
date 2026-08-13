# Tasks, sessions, checkpoints and handoffs

The state that lets work survive an interruption — a closed terminal, a
switched worker, a week away.

## Tasks

Statuses: `BACKLOG`, `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `REVIEW`, `DONE`,
`CANCELLED`. Fields: id, title, description, priority (P0–P4), status, project,
parent task, worker, timestamps.

```bash
ctxd task add --title "Fix Stripe webhook idempotency" --priority P1
ctxd task add --title "Add integration tests" --parent <id>
ctxd task list
ctxd task update <id> --status IN_PROGRESS
```

Tasks decompose: a subtask points at its parent, and listing a parent shows
subtask progress. Deleting a parent **orphans** its subtasks rather than
deleting them — losing planned work as a side effect of tidying up would be
worse than an orphan.

Reaching `DONE` or `CANCELLED` stamps `completed_at`. Reopening a closed task
clears it, so nothing keeps claiming it was finished.

By default `ctxd task list` hides terminal tasks; `--all` includes them.

## Sessions

```bash
ctxd session start --task <id> --worker claude
ctxd session note "added the reservation protocol"
ctxd session error "test expected 409 but received 200"
ctxd session status
ctxd session end
```

A project has at most one open session. Starting another while one is open
returns the existing one rather than silently splitting activity across two
records.

Events are append-only. Ending a session adds a summary; it does **not**
replace the record of what happened.

## Checkpoints

```bash
ctxd checkpoint --next "Fix the 409 path then rerun tests"
ctxd checkpoint list
```

A checkpoint records objective, completed work, remaining work, next action,
worker, branch, changed files and known errors.

Anything you do not supply is **derived from state ctxd already has**: the
objective from the active task, completed work from session activity, known
errors from recorded errors, changed files from Git. A checkpoint taken with no
arguments is still useful — which matters, because the moment you most need one
is the moment you are least inclined to write it.

The session and its events are left intact. A checkpoint summarises history; it
does not replace it.

## Handoffs

```bash
ctxd handoff --to cursor
```

Assembles the task, what is done, what remains, binding constraints, decisions,
known bugs, changed files, branch, the last worker and the recommended next
one.

It is built from recorded state rather than written by the outgoing worker. A
handoff that depended on someone remembering to write it would not survive an
interrupted session — which is exactly when it is needed.

## Resume

```bash
ctxd resume
```

Answers the question you actually have when you sit back down: what was I
doing, how far did I get, what is next. Summarises the open session, the last
checkpoint, open tasks, Git state and the binding rules.

When there is nothing to resume it says so plainly rather than inventing a
narrative.

## Through MCP

`ctx_task_get`, `ctx_task_update`, `ctx_checkpoint` and `ctx_handoff` expose the
same services to AI workers. They were deliberately withheld in Phase 5 until
the services behind them existed.
