# The local HTTP API

`ctxd ui` serves a small HTTP API on the loopback interface so a local
interface can read the same services the CLI and MCP server use. Business logic
is never duplicated per entry point.

```bash
ctxd ui                 # http://127.0.0.1:4317
ctxd ui --port 0        # any free port
ctxd ui --print-token   # print the local API token
```

There is no cloud component, no telemetry and no remote access path.

## Security (§62)

**Binds `127.0.0.1` only.** Passing `0.0.0.0` is refused unless the caller opts
in explicitly — the server will not quietly expose itself.

Loopback alone is not enough, though: every process on the machine can reach it,
and any web page the user visits can try to. So three checks run on every
request.

| Check | Rejects |
|---|---|
| `Host` must be a loopback name | DNS rebinding — a name the attacker controls that resolves to 127.0.0.1 |
| `Origin`, when present, must be loopback | A page on another site scripting the API |
| Token on mutating routes | Another local process changing project memory |

Reads are open to any loopback caller, which keeps the UI usable without a
login. Writes need the token:

```
Authorization: Bearer <token>
```

The token is generated on demand, stored `0600` inside the `0700` data
directory, and never leaves the machine. Comparison is timing-safe.

Request bodies are capped at 1 MB, and responses carry `X-Content-Type-Options:
nosniff` and `Cache-Control: no-store` — the API answers data, never markup.

## Routes

| Method | Path | Token | Returns |
|---|---|---|---|
| `GET` | `/api/health` | — | Liveness and version |
| `GET` | `/api/status` | — | Version, mode, data dir, project count, Git summary |
| `GET` | `/api/projects` | — | Registered projects |
| `GET` | `/api/memory?q=&limit=` | — | FTS5 search, or a project's memories |
| `GET` | `/api/tasks?project=` | — | Tasks |
| `GET` | `/api/session?project=` | — | Last session and latest checkpoint |
| `GET` | `/api/workers?project=` | — | Workers: `state` from recorded sessions, plus `connection` from the event log — see [workers.md](workers.md) |
| `GET` | `/api/config` | — | Configuration file path, storage directory and current values |
| `GET` | `/api/resume?project=&dir=` | — | The "what was I doing?" summary |
| `GET` | `/api/receipts/context?limit=` | — | Context Receipts, newest first |
| `GET` | `/api/receipts/change?limit=` | — | Change Receipts, newest first |
| `GET` | `/api/diff?dir=&task=` | — | A live Change Receipt for a working tree |
| `GET` | `/api/stats?window=&limit=` | — | Token and change statistics — `window` is `today`, `7d`, `30d` or `all` |
| `GET` | `/api/graph?project=` | — | The engineering graph: core, workers, memory, repository, verification |
| `GET` | `/api/events?after=` | — | Live event stream (SSE) — see [events.md](events.md) |
| `GET` | `/api/events/recent?limit=` | — | Recent events as JSON, newest first |
| `POST` | `/api/context` | ✔ | Build context for a task; returns the receipt |
| `POST` | `/api/memory` | ✔ | Record a memory — `title`, `content`, `type`, `source`, `importance`, `tags` |
| `POST` | `/api/tasks` | ✔ | Create a task — `title`, `description`, `priority`, `status`, `worker`, `parentTask` |
| `PATCH` | `/api/tasks` | ✔ | Update a task by `id`; omitted fields are left alone |
| `POST` | `/api/session` | ✔ | Start a session — `worker`, `task`, `branch` |
| `POST` | `/api/checkpoint` | ✔ | Record a checkpoint — `objective`, `completed`, `remaining`, `next`, `task`, `worker` |
| `POST` | `/api/projects` | ✔ | Register a directory — `dir`, `index` |
| `POST` | `/api/handoff` | ✔ | Assemble a handoff; with `to`, move the work — `to`, `from`, `task`, `note` |
| `POST` | `/api/verify` | ✔ | Run the project's own checks — `only`, `dryRun`, `timeoutMs` |
| `GET` | `/api/agent` | — | Which workers ctxd can start, and why not for the rest |
| `POST` | `/api/agent` | ✔ | Run a task: context → routing → worker → change review — `task`, `budget`, `worker`, `model`, `applyEdits`, `timeoutMs` |

`POST /api/context` requires the token because it writes a receipt, even though
it changes no project data.

## Writes

Every mutating route calls the same function the CLI calls — `saveMemory`,
`createTask`, `createCheckpoint`, `startSession`. None of them reimplements a
rule, because a second copy of an authority rule is a second place it can be
wrong, and the copy that disagrees would be the one nobody tested.

A write names its project in the body as `project`, or in `?project=`, or not at
all — in which case the only registered project is used. An id that does not
resolve is a `404`, never a silent write to the default.

### Authority is not bypassed

`saveMemory` can refuse a write whose authority is too low to override what is
already recorded. That refusal is passed through as **`409`** with its reason,
the same answer a worker gets from MCP:

```json
{ "error": "refused: … — \"Never edit generated files\" has higher authority" }
```

### Why these routes accept sources MCP refuses

`ctx_memory_save` restricts a worker to `worker_statement` and `inferred`,
because a worker cannot assert `verified_code`, `verified_git` or
`accepted_decision` (§6, [workers.md](workers.md)).

The caller here is not a worker. Mutating routes require the local token, which
is stored `0600` inside a `0700` directory and treated as a credential precisely
because it authorises changes to project memory (§62). Holding it means being
the developer at the keyboard — the same authority
`ctxd memory add --source accepted_decision` already has from a terminal.

Restricting the interface below the CLI would add no safety. It would only mean
leaving the window to record a decision, and `@ctxd/memory`'s authority rules
apply either way.

### `POST /api/projects` reads a directory the caller names

That is a real capability, and it is why the route is token-gated. What it
records is metadata only: indexing stores path, size, mtime, hash, language and
type, and never file content (§8). Registering a directory does not make its
contents readable through the API.

A path that does not exist is a `400`. `detectProject` does not require the
directory to be there — a missing path looks identical to one with no manifests
— so the route checks explicitly rather than registering a project nothing can
ever index.

### `POST /api/verify` runs commands, and that is not a §63 exception

§63 forbids exposing shell execution **to a worker** through MCP, and a CI gate
asserts `@ctxd/mcp` cannot even import `@ctxd/verify`. Both still hold: nothing
here is reachable from the MCP surface.

What runs is not arbitrary either. `discoverChecks` reads the project's own
manifest and runs the typecheck, lint, test and build scripts it already
defines. The request chooses among those by `kind`; it cannot supply a command.

Two honest limits:

- **It is synchronous.** A long test run holds the server until it finishes, so
  the interface waits. `timeoutMs` bounds it.
- **`dryRun` reports what would run** without running it, which is also the
  right answer to "what does verification mean in this project?"

### `POST /api/agent` starts an AI

The one route that runs a model. It is a deliberate departure from the
specification's *Never: autonomous multi-agent orchestration*, made by the
project owner and recorded in [plan-tracker.md](plan-tracker.md) rather than
absorbed silently.

Four things bound it:

- **ctxd opens no socket.** It starts Claude Code, authenticated by the
  developer's own subscription. No API key is handled, stored or requested, and
  the `no-network` CI gate is untouched.
- **`applyEdits` is off by default.** Without it the worker reads and reports;
  the working tree is not touched.
- **Nothing is committed, reverted or accepted.** A run ends with a Change
  Receipt (§50).
- **The context is the same one `ctxd context` builds**, to the same budget,
  producing the same auditable receipt.

`GET /api/agent` reports runnable workers. Cursor appears with
`available: false` and the reason — it is an editor with no headless mode, so
work reaches it through `POST /api/handoff` rather than by being started. Model
choice is deterministic, from the size of the built context (§41).

A machine with no runnable worker answers `409`, not `500`: the request was
understood, and the machine is why it cannot be carried out.

### What still has no write route

`ctxd export`/`import` and `ctxd doctor` remain CLI-only. `doctor` lives in
`@ctxd/cli`, and `@ctxd/api` cannot import from it without inverting the
dependency — moving `runDoctor` into the core is the prerequisite, and has not
been done.

Receipts are read from the filesystem rather than the database, because they are
files by design — portable and readable without ctxd (§74).

## Errors

Errors are JSON with a stated reason, never an empty success:

```json
{ "error": "no project is registered — run: ctxd init" }
```

| Status | Meaning |
|---|---|
| `400` | Bad input, with the offending field named |
| `401` | Mutating route without a valid token |
| `403` | Host or Origin rejected |
| `404` | Unknown route, or no project registered |
| `405` | Known path, wrong method |
| `413` | Body over 1 MB |

## `/api/stats`

The aggregation is `@ctxd/stats` — the same module `ctxd stats` runs — so the
interface and the command cannot report different totals for the same receipts.
The window names are defined there too, so there is one definition of `7d`
rather than one per caller.

The response echoes what it covers, because a figure whose scope is implied by
whichever tab is highlighted is a figure waiting to be misread:

```json
{
  "window": "7d",
  "scope": "last 7 days",
  "since": "2026-08-07T09:14:02.118Z",
  "context": { "requests": 12, "candidateTokens": 422903, "avoidedTokens": 414911,
               "accuracy": "estimated" },
  "change": { "reviews": 3, "meanEfficiency": 0.81 },
  "unreadable": []
}
```

`unreadable` lists receipt files that could not be parsed. They are missing from
the totals above it, and saying so is what keeps an incomplete number from
passing as a wrong one. `meanEfficiency` is absent rather than `0` when nothing
has been reviewed — zero would claim every change was unfocused.

An undefined window is a `400`, not a guess.

## Status

The API is built and tested, and the React interface that consumes it is built
too — see [ui.md](ui.md) for the panels it serves. Every route in the table
above is live; the interface performs no aggregation of its own.
