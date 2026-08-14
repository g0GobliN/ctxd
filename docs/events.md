# The event log

ctxd records what happened as it happens, so the interface can show activity
rather than a snapshot polled on a timer.

```bash
ctxd ui                              # the stream is served at /api/events
curl -N http://127.0.0.1:4317/api/events
```

Everything on the stream is an event a producer actually wrote. Nothing is
inferred from an absence, and nothing is synthesised to fill a gap — an
activity stream that invents a plausible line is worse than an empty one,
because it cannot be told apart from a real one (§37).

## Why it goes through SQLite

ctxd is not one process. The MCP server is started by the worker, the HTTP API
by `ctxd ui`, and the CLI by the developer. They share no memory, so an event
raised in one cannot reach a browser attached to another by function call.

They do share SQLite. A producer appends to the `events` table; the API process
tails it and forwards what it finds over Server-Sent Events.

```
MCP process ─┐
CLI process ─┼─► events table (SQLite) ─► API process ─► SSE ─► interface
API process ─┘
```

Polling a local table is not elegant, but it is honest about its cost and it
avoids a broker, a daemon and a second port. A file watcher fires on WAL
checkpoints rather than on rows, and a socket would need reinventing for
Windows. Because the table is durable, the log also survives a UI restart: the
activity panel opens with history instead of an empty list.

## The table

`session_events` already existed and stays as it is — the per-session narrative
record, summarised by checkpoints. It could not carry these events: its
`session_id` is `NOT NULL`, and a worker attaching happens before any session
exists.

```sql
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  task_id    TEXT REFERENCES tasks(id)    ON DELETE SET NULL,
  worker     TEXT,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
```

Everything except the project, type and time is nullable, because an event with
no task must record no task rather than a plausible one. Deleting a session sets
the reference null rather than cascading: what happened still happened, and an
append-only log that loses rows is not a record of anything.

## Event types

| Type | Written when |
|---|---|
| `worker_connected` / `worker_disconnected` | An MCP client attaches to or leaves the transport |
| `worker_request_started` / `worker_request_finished` | A worker request begins or ends |
| `worker_error` | A worker reports a failure |
| `context_requested` / `context_built` | The context firewall is asked, and answers |
| `verification_started` / `verification_finished` | `ctxd verify` runs — never for `--dry-run`, which verifies nothing |
| `memory_updated`, `task_updated`, `checkpoint_created` | Durable state changes |
| `handoff_created` | Work changes hands — `ctxd handoff --accept` or `ctx_handoff` with `accept` |
| `change_analyzed` | `ctxd diff` reviews a working tree |

`handoff_created` is distinct from `task_updated` because the interesting fact
is not that a field changed but that a *different worker* is expected to
continue — the one moment where context is most likely to be lost. Its payload
carries the two names, the task and checkpoint ids, and a warning count; never
the handoff text, which belongs behind `/api/session` rather than on a read
route every local process can see.

## Producers

| Process | Writes |
|---|---|
| MCP | Connect and disconnect, a start/finish pair per tool call, context requested and built, handoffs accepted |
| CLI | `ctxd verify`, `ctxd diff` and `ctxd handoff --accept` |
| API | `POST /api/context` |

The CLI holds no database connection between commands, so each emission opens
one, writes and closes — *after* the work it describes, never on the startup
path, so the CLI start time is unaffected.

Emission never throws and never prints anywhere. A command's job is the work it
was asked to do; recording that it happened is a side effect, and a side effect
that could fail the command would be worse than no record. In a directory that
is not a registered project nothing is written at all, and the command still
does its work.

## Worker identity is a claim

This is the constraint that shapes the whole feature.

The MCP server knows one thing for certain: a client attached to the transport,
and later it left. It does **not** know who that client is. Identity is
self-declared — `ctxd mcp --worker cursor` is the developer stating which worker
they wired up, and any local process could say the same thing.

So the field travels as `claimedWorker`, never `worker`, and the interface
renders it as "claims cursor" rather than as an identity ctxd vouches for. This
is the same discipline memory already follows, where a worker may write
`worker_statement` but never `verified_git`.

Without `--worker`, activity is recorded with no worker at all. A default of
`claude` would be a guess, and a guess is worse than an absence.

## Worker state

`GET /api/workers` answers two different questions per worker, and keeps them
apart:

- **`state`** — what the *session history* says: `active`, `idle` or `unknown`.
  Has this worker done work on this project?
- **`connection`** — what the *event log* says right now: `connected`,
  `working`, `error`, `disconnected` or `unknown`. Is it attached?

Collapsing them would lose one of the two, so they stay separate fields.

A worker with recorded activity but no transport event reads `unknown`, not
`disconnected`. Something used ctxd; whether it is still there was never
observed, and those are different answers.

`connection.openEnded` marks an attachment seen opening but never seen closing.
A process killed outright cannot write its own disconnect, so `connected` can
outlive the connection. Rather than invent a timeout and present the guess as
knowledge, ctxd reports the fact with its timestamp and lets the developer weigh
the age.

## Retention

The log gains rows with every tool call, so it is not kept forever.
`pruneEvents()` runs once when the MCP server starts and removes events older
than 30 days. Nothing durable is lost: sessions, checkpoints and receipts are
the permanent record, and the event log is the live view over them.

## What a payload may contain

Identifiers and counts. Never file contents, memory bodies or diff text.

The stream is a read route, so every process on the machine can subscribe, just
as every process can already read `/api/tasks`. A `context_built` event carries
the candidate and final token counts and the receipt id; the assembled context —
the one thing here worth exfiltrating — stays out of it. A client that wants the
detail fetches the receipt through a route that can decide whether to answer.

## Subscribing

```
GET /api/events              # from now on
GET /api/events?after=41     # from a known event id
Last-Event-ID: 41            # sent automatically by EventSource on reconnect
```

`Last-Event-ID` wins when both are present: it reflects what that client
actually received, while the URL is whatever the page happened to open with.

With no cursor the stream starts at the present, so a fresh subscriber never
triggers a replay of the whole log. History is a separate request:

```
GET /api/events/recent?limit=50   # newest first, plus latestId to stream from
```

Reconnection is `EventSource`'s own. The server replays only what was missed, so
a dropped connection costs nothing but the gap.

## Limits

| Limit | Value | Why |
|---|---|---|
| Concurrent streams | 16 | Each holds a timer and a socket; the interface opens one |
| Buffered per client | 1 MB | A reader that never drains would otherwise grow API memory without bound |
| Poll interval | 500ms | Local SQLite read; fast enough to feel live, slow enough to be free |
| Heartbeat | 20s | A dropped connection is indistinguishable from a quiet one until something is written |

A client that exceeds the buffer is disconnected rather than buffered. It loses
nothing: it reconnects with its own `Last-Event-ID`, and the log is the durable
copy — the stream is only a delivery mechanism.

Timers are unreferenced and every open stream is closed on shutdown, so `ctxd
ui` still exits promptly with a browser tab attached.

## Security

The stream follows the same rules as every other read (§62): loopback `Host` and
`Origin` checks, and no token, which is what keeps the interface usable without
a login. Writes still require the token.

That does mean any local process can watch project activity. This is the
existing posture for reads, not a new exposure — and it is the reason payloads
carry identifiers rather than content.
