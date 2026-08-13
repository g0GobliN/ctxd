# The interface

```bash
pnpm build:all   # build the core packages and the interface bundle
ctxd ui          # http://127.0.0.1:4317
```

The interface is a **viewer**, not a second brain. It renders what the core
services already decided and never recomputes a verdict of its own — anything it
shows can be obtained from the CLI, and it agrees with the CLI because both read
the same receipts. ctxd is not an IDE; the brain stays in `core`.

React and Vite are **build-time only**. The output is static HTML, CSS and one
JavaScript file, served by the local API. Nothing is fetched from a CDN, so the
interface works with no network at all (§66).

## Panels

| Panel | Shows |
|---|---|
| **Dashboard** | Version, mode, project count, receipts on disk, estimated context avoided, Git state, storage location |
| **Context** | The context inspector (§68) — per request: task, budget, candidate vs final tokens, and **why each item was included or excluded** |
| **Changes** | The change inspector (§71) — live Diff Firewall analysis of the working tree, plus saved Change Receipts |
| **Memory** | Project memory with FTS5 search, showing each memory's source and confidence |
| **Tasks** | A kanban of tracked work by status |
| **Resume** | The "what was I doing?" summary |

The context inspector is the panel that matters. It shows the candidate-to-final
reduction as a proportion, lists every included item with its reason and every
excluded item with its reason, and labels the counts as **estimated** — never a
dollar figure (§18, §49).

## How it is served

The API serves the interface itself, so the browser sees one origin: the
loopback `Origin` check stays satisfied and there is no second server to run.

Static responses carry a strict `Content-Security-Policy` (`default-src 'self'`,
no framing, no form submission), `X-Content-Type-Options: nosniff`, and
`Cache-Control: no-cache` — serving a stale bundle would show an interface that
disagrees with the API behind it.

Every requested path is resolved and then checked to be inside the asset root.
Traversal attempts — `../`, percent-encoded variants, embedded NUL bytes — are
refused and reported as an ordinary 404, revealing nothing about the disk. A
path with no file extension falls back to `index.html` so a reload on any view
still loads the app, while a genuinely missing script still reports as missing.

## Development

```bash
ctxd ui                          # terminal 1: the API on 4317
pnpm --filter @ctxd/ui dev       # terminal 2: Vite on 4318, proxying /api
```

The dev server proxies `/api` to the real API so the browser still sees a single
origin.

## Dependencies

The interface is the only part of ctxd with a dependency tree, and it is
build-time only: `react`, `react-dom`, `vite`, `@vitejs/plugin-react` and their
transitive packages. Nothing ships into the core packages, and the built bundle
contains no dependency on anything remote.

There is no router (six panels are component state), no CSS framework, and no
state library. Each would be a dependency added for tidiness rather than need.

## Not built yet

§69's worker monitor and §70's settings editor. Worker status is available from
the core (`@ctxd/verify` exposes it, honestly reporting `unknown` when ctxd
cannot determine it), but no panel renders it yet.
