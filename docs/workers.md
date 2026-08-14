# Workers

Claude Code, Cursor and anything else that talks to ctxd are **workers**. They
are replaceable; the memory they read and write is not. This document describes
what ctxd knows about a worker, what it refuses to claim, and where that shows
up.

## Identity is claimed, never verified

The MCP transport knows one thing for certain: a client attached, and later
detached. That is observable. **Who** that client is, is not.

Worker identity is self-declared — `ctxd mcp --worker claude` sets a name, and
any local process could start the server and pass the same flag. So ctxd stores
the attachment as fact and the name as a claim, and renders the claim as a
claim (§6).

This is the same discipline memory already had: a worker may write source
`worker_statement` or `inferred`, never `verified_code` or `verified_git`,
because those assert something a worker is not positioned to assert. See
[memory.md](memory.md).

Every worker record carries `claimed: true` alongside its connection, so no
consumer downstream can mistake the name for something ctxd checked.

## Two states, deliberately not merged

`GET /api/workers` returns two different fields, because they answer two
different questions.

| Field | Question | Source |
|---|---|---|
| `state` | Has this worker worked here? | `sessions` rows |
| `connection.state` | Is it attached right now? | the `events` log |

`state` is `active`, `idle` or `unknown`, derived from whether the newest
session for that worker has ended. It predates 2.0 and its meaning was not
redefined — §6 requires the existing contract to keep working, so the live
half was **added alongside** rather than folded in.

Collapsing the two would lose one of them. A worker with a finished session and
no event history is `idle` *and* `unknown`, and both facts are true.

## Connection states

From [`packages/events/src/workers.ts`](../packages/events/src/workers.ts).
One pass over the project's events, newest first, taking the first
state-defining event per worker.

| State | The last transport event was |
|---|---|
| `connected` | `worker_connected`, or a request that finished |
| `working` | `worker_request_started`, not yet finished |
| `error` | `worker_error` |
| `disconnected` | `worker_disconnected` |
| `unknown` | nothing was ever recorded |

`unknown` is not a failure mode, and it is never upgraded. A worker ctxd has
never seen is `unknown` — not idle, not disconnected. Absence of evidence is not
evidence, and the interface has to be able to tell the difference.

Events with no worker attached are skipped entirely. They happened, but they say
nothing about who was connected, and attributing them to whoever is on screen
would invent an attribution the producer declined to make (§37).

### `openEnded`

A connection observed opening but never observed closing sets `openEnded: true`.

That is true while a worker is genuinely attached — and equally true when its
process was killed outright, because a dead process writes no disconnect. So
ctxd reports the flag beside `since` rather than resolving it. A caller that
wants to weigh the age can. Inventing a timeout and calling the result knowledge
is the one thing this field exists to avoid.

## The registry is labels, not a permitted list

ctxd ships knowing three names:

| id | Name | Capabilities |
|---|---|---|
| `claude` | Claude Code | edit files, run commands, read context, write memory, MCP |
| `cursor` | Cursor | edit files, read context, write memory, MCP |
| `local` | Local worker | edit files, run commands, read context |

Nothing here changes ctxd's behaviour. A worker ctxd has never heard of works
exactly as well and simply carries its own name (§42) — it appears in
`/api/workers` with an empty capability list rather than being dropped.

Three groups end up in the response: known workers, workers seen only in session
rows, and workers seen only on the event log. The last group never opened a
session, but it connected to this project, and omitting it would make the
interface quieter than the truth.

## Where this surfaces

- **`GET /api/workers`** — the full list. See [api.md](api.md)
- **The Workers panel** — session state, live connection state, current and last
  task, last activity. See [ui.md](ui.md)
- **The graph** — worker nodes light from the event stream. An event naming no
  worker lights no worker. Past six workers the cluster collapses to one node,
  which states the count rather than hiding it
- **`ctxd handoff`** — moving work between workers. See [work.md](work.md)

## Retention

The event log is append-only during a session but not kept forever — it grows
with every tool call, and a table that only grows becomes a slow startup and a
large file on someone's laptop. The default is 30 days.

Nothing durable is lost when events are pruned: sessions, checkpoints and
receipts are the permanent record, and old events have already been summarised
into them.

## What ctxd will not do

- **Infer connection from a session row.** A session says work happened, not
  that a process is attached (§6)
- **Convert `unknown` into `connected`.** In either direction, a guess dressed
  as a state is worse than the gap
- **Verify a worker's name.** It cannot, so it says so instead
- **Let a worker promote its own claims.** See [mcp.md](mcp.md)
- **Orchestrate workers.** ctxd is the memory and the firewall; scheduling
  agents against each other is explicitly out of scope. See
  [roadmap.md](roadmap.md)
