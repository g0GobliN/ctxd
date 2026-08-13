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
| `GET` | `/api/resume?project=&dir=` | — | The "what was I doing?" summary |
| `GET` | `/api/receipts/context?limit=` | — | Context Receipts, newest first |
| `GET` | `/api/receipts/change?limit=` | — | Change Receipts, newest first |
| `GET` | `/api/diff?dir=&task=` | — | A live Change Receipt for a working tree |
| `POST` | `/api/context` | ✔ | Build context for a task; returns the receipt |

`POST /api/context` requires the token because it writes a receipt, even though
it changes no project data.

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

## Status

The API is built and tested. The React interface that consumes it (§68–71 —
context inspector, memory viewer, task kanban, worker monitor, Git overview) is
not yet built.
