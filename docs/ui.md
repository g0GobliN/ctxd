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
| **Graph** | The engineering graph (§4) — the home screen. Workers, the core, memory, repository and verification, with what each one actually knows |
| **Dashboard** | Version, mode, project count, receipts on disk, estimated context avoided, Git state, storage location |
| **Context** | The context inspector (§68) — per request: task, budget, candidate vs final tokens, and **why each item was included or excluded** |
| **Tokens** | The token monitor (§48, §49) — estimated context avoided over today, 7 days, 30 days or all time, aggregated by `@ctxd/stats` |
| **Changes** | The change inspector (§71) — live Diff Firewall analysis of the working tree: verdict, expected scope, noise breakdown, flagged comments and every file with its reason, plus saved Change Receipts |
| **Memory** | Project memory with FTS5 search, showing each memory's source and confidence |
| **Tasks** | A kanban of tracked work by status |
| **Resume** | The "what was I doing?" summary |
| **Activity** | The live event stream (§20) — what workers and ctxd are doing, as it happens. See [events.md](events.md) |
| **Workers** | Who has worked on the project (§69): session state, live connection state, current and last task, last activity |
| **Settings** | Configuration file, storage location and current values — read-only |

The context inspector is the panel that matters. It shows the candidate-to-final
reduction as a proportion, lists every included item with its reason and every
excluded item with its reason, and labels the counts as **estimated** — never a
dollar figure (§18, §49).

## The graph is live

The graph subscribes to the event stream. A node or edge lights up because a
producer wrote a row in the event log, and for no other reason — there is no
animation on a timer, so a still graph means a still system rather than a broken
subscription. The subtitle says which of those it is.

The mapping from event to element lives in `packages/ui/src/live.ts`, apart from
the drawing code, so it is tested against events real producers wrote rather
than against fixtures. Two rules shape it:

- **Every path lights the core**, because every path goes through it. That is
  the one claim the picture makes, and a traffic pattern that appeared to skip
  ctxd would contradict the architecture the diagram exists to show.
- **An event that names no worker lights no worker.** Attributing it to whoever
  is on screen would invent the attribution the producer declined to make (§37).

A `change_analyzed` lights the repository, not verification: `ctxd diff` inspects
the working tree and runs no checks, and drawing the verification edge would
claim a check that never happened.

Movement is never the only carrier. A live node also reads *active now* in its
accessible label, and `prefers-reduced-motion` drops the animation without
dropping the information.

### Interaction

Drag the background to pan, scroll to zoom, drag a node to move it, and use the
zoom and reset controls in the toolbar. Pointer events rather than mouse events,
so a trackpad, a stylus and a touch screen work from one path. Wheel zoom is
anchored — the point under the cursor stays under the cursor.

Past six workers the cluster collapses to a single node by default. That is a
default, not a ceiling: expanding always works, and collapsing hides boxes
rather than facts. The cluster node states the count and how many are attached,
and the detail panel still lists every worker by name and connection state, each
still marked as a claim.

The geometry lives in `packages/ui/src/graph-layout.ts` as pure functions, so
the property that actually decides whether the graph is usable — boxes not
landing on top of one another — is asserted for up to 24 workers rather than
eyeballed at two. Worker rows wrap and the canvas grows; the earlier code
divided the available width by the worker count, which overlapped the boxes
somewhere around ten.

Where a developer parked a node, and how far they zoomed, is view state. It is
never sent anywhere — it is not something ctxd knows about the project.

## The Change Firewall panel

`@ctxd/diff` has computed the whole analysis since Phase 7. What the interface
was missing was most of it — the UI's receipt type dropped thirteen fields on
the floor, so the data arrived and was discarded. The panel now shows:

- **Expected scope** (§51, §55) — the inferred task size and expected file and
  line counts, beside the actual. This is what makes a mismatch warning
  arguable: without the expectation on screen the verdict is an opinion a
  developer can only accept or ignore.
- **Noise** (§53) — formatting-only, comment-only, import-only, whole-file
  rewrites, renames, generated files, dependency changes and unrelated files.
  Unrelated files are named, not counted.
- **Comments flagged** (§54) — comments that restate the syntax. Comments
  explaining *why* are never flagged, and ctxd deletes neither kind; durable
  reasoning belongs in project memory, where the next session will find it
  rather than in a comment the next worker will "clean up".
- Warnings inline in the saved-receipt listing, with their evidence. A listing
  showing only a verdict would make a developer open every row to find the one
  that mattered.

ctxd reports and never reverts. Nothing in this panel is applied to the working
tree, no worker output is rewritten, and a large diff is never treated as proof
of a wrong one (§50) — see the `large-change-proportionate` benchmark, which
exists to fail if that ever stops being true.

## Verification freshness

The verification node reports a status **and** whether that status still
describes the tree in front of you. There is no verification-runs table (§21),
so the status comes from the newest Change Receipt — and a status shown without
regard to its age is the most dangerous number in the product, because a PASS
from before the last three edits reads exactly like a PASS from a moment ago.

Staleness is judged against the tree, not against a clock. A timeout would be a
guess dressed as a fact; *a file changed after the check ran* is something ctxd
can observe. Work committed after the check counts too, so a clean tree does not
launder a stale verdict into a current one. A stale PASS badges as `PASS —
stale`, never as a bare `PASS`, and the panel names the file or commit
responsible so the verdict can be argued with rather than merely believed.

Anything that cannot be established reads `unknown`, never `current`: an
unnecessary `unknown` costs a re-run, a false `current` costs correctness.

## The desktop shell

```bash
# once, and only where a Rust toolchain is installed
cargo build --release --manifest-path packages/desktop/Cargo.toml
ctxd desktop
```

`ctxd desktop` starts the same loopback API as `ctxd ui` and opens a Tauri
window onto it. The window loads the interface over HTTP rather than bundling
the assets, so there is one front end rather than two that can drift apart, and
the shell holds no ctxd logic at all — it is packaging (§67), never a
foundation.

The API is started by the Node process rather than by the shell. Having the
window own the server would be a second way to start ctxd, with its own lifetime
and its own bugs; this way there is one server, and closing the window stops it.
The API binds port 0 by default and the shell is told where it actually landed,
so no port is reserved in advance.

The shell refuses any URL that is not loopback. §62 binds ctxd to loopback, and
the shell is a browser — without that check the desktop build would be the one
way to point ctxd's interface at a remote origin, a hole the HTTP server itself
does not have.

> **Status: written, never compiled.** The `ctxd desktop` command is built and
> tested. The Rust crate in `packages/desktop/` has never been compiled or
> type-checked, because the machine it was written on has neither MinGW binutils
> nor the MSVC build tools. Expect to fix compile errors in it. Nothing else
> depends on it: every command works with the shell absent, and the test suite
> needs no Rust toolchain.

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

The graph is hand-written SVG. A graph library would be the largest dependency
in the repository, bought for one screen holding fewer than ten nodes at fixed
positions — there is no force simulation to run. It is assembled by
`GET /api/graph` rather than in React, for the same reason as everything else
here: the interface renders a decision, it does not make one.

There is no router (eleven panels are component state), no CSS framework, and no
state library. Each would be a dependency added for tidiness rather than need.

The interface performs no aggregation. The dashboard used to sum the receipt
listing in the browser; that made it a second place the total could be computed
and therefore a second place it could be wrong — and worse, the listing is
capped at 50, so the total quietly stopped being a total once a project outgrew
the cap. It now reads `/api/stats`, which is `@ctxd/stats`, which is what
`ctxd stats` runs.

## Settings

Read-only. The panel shows the configuration file's path, the storage directory
and the current values, and says plainly that ctxd does not write configuration
from the interface. `POST /api/config` does not exist — the file is the
interface, and a browser-driven write path into it would be a larger surface
than the feature is worth.
