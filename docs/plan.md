# ctxd 2.0 — MASTER IMPLEMENTATION PROMPT
# Existing Repository Upgrade
# Status: FINAL
#
# IMPORTANT:
# This is NOT a greenfield project.
# ctxd 1.0 already exists in this repository.
#
# DO NOT rebuild existing functionality.
# DO NOT replace working architecture unnecessarily.
# DO NOT restart from Phase 1.
#
# Your job is to AUDIT the existing repository,
# understand what is already implemented,
# then build ctxd 2.0 on top of it.

============================================================
1. WHAT ctxd IS
============================================================

ctxd is a:

LOCAL-FIRST ENGINEERING MEMORY
+
CONTEXT FIREWALL
+
TOKEN OPTIMIZER
+
AI WORKER MANAGER
+
CHANGE/DESCRIPTION NOISE FILTER
+
DEVELOPER CONTROL CENTER

It is NOT:

- another chatbot
- another IDE
- a cloud SaaS
- a replacement for Claude
- a replacement for Cursor
- a coding model

Claude and Cursor are workers.

ctxd is the engineering layer between:

developer
repository
memory
tasks
Git
AI workers
verification

Core principle:

STORAGE IS CHEAP.
MODEL CONTEXT IS EXPENSIVE.

Therefore:

Store as much useful engineering knowledge locally as necessary.

Send only the minimum useful context to AI workers.

Every token sent to an AI worker should have a reason.

============================================================
2. CRITICAL: THIS REPOSITORY ALREADY HAS ctxd 1.0
============================================================

Before changing ANYTHING:

AUDIT THE ENTIRE REPOSITORY.

Do not assume the specification describes an empty repository.

Inspect:

packages/
docs/
tests/
scripts/
database/schema
API routes
UI
MCP
CLI
diff engine
verification
stats
worker logic
session events
task system
memory system
Git integration

Read the existing:

README
architecture documentation
API documentation
UI documentation
plan tracker
database schema
package manifests
tests

Find what is already implemented.

Create an internal implementation matrix:

FEATURE | EXISTS | PARTIAL | MISSING | FILES | TESTS

At minimum audit:

- context engine
- context receipts
- memory
- search
- project indexing
- Git
- tasks
- sessions
- checkpoints
- handoffs
- workers
- MCP
- API
- React UI
- diff firewall
- over-edit detection
- comment bloat detection
- noise detection
- scope analysis
- verification
- token statistics
- session_events
- configuration
- security
- local storage

Do NOT rebuild existing functionality.

Extend existing services.

Reuse existing types.

Reuse existing database tables.

Reuse existing API routes.

Reuse existing UI components.

Reuse existing diff/verification logic.

Only introduce new abstractions when the current architecture genuinely cannot support the feature.

============================================================
3. AUDIT RESULT — ALREADY PERFORMED
============================================================

The §2 audit has been done. These are findings from the actual
repository, not assumptions. Re-verify anything that looks stale, but
do not redo the audit from zero.

IMPLEMENTATION MATRIX

FEATURE                  STATE     WHERE
context engine           EXISTS    packages/context
context receipts         EXISTS    packages/context/src/receipt.ts
memory + FTS5 search     EXISTS    packages/memory
project indexing / Git   EXISTS    packages/project
tasks (incl. subtasks)   EXISTS    packages/work/src/tasks.ts
sessions / checkpoints   EXISTS    packages/work
handoffs                 EXISTS    packages/work/src/checkpoints.ts
MCP (15 tools)           EXISTS    packages/mcp
local HTTP API           EXISTS    packages/api/src/routes.ts
React UI (8 panels)      EXISTS    packages/ui/src
over-edit detection      EXISTS    packages/diff/src/overedit.ts
comment analysis         EXISTS    packages/diff/src/comments.ts
noise detection          EXISTS    packages/diff/src/noise.ts
scope analysis           EXISTS    packages/diff/src/scope.ts
change receipts          EXISTS    packages/diff/src/receipt.ts
verification             EXISTS    packages/verify
token statistics         EXISTS    packages/stats (supports `since`)
schema migrations        EXISTS    packages/db/src/migrations.ts

live event transport     MISSING   no SSE, WebSocket or polling anywhere
/api/stats               MISSING   UI sums receipts client-side today
                                   (packages/ui/src/panels.tsx:22)
events table             MISSING   see §7 — session_events cannot hold it
worker on ContextReceipt MISSING   see §16 — blocks per-worker context
live worker connection   MISSING   see §6 — derived from session rows only
verification runs table  MISSING   see §21 — freshness comes from receipts
Tauri shell              MISSING   deliberately last (§26)

Everything marked EXISTS is reused, not rebuilt. The 2.0 delta is the
MISSING rows plus the graph itself.

CORRECT ALSO:

docs/api.md says the React interface "is not yet built". It is built.
That file's route table also omits /api/workers and /api/config, both
of which exist. Fix before planning against it (§29).

============================================================
4. THE REAL ctxd 2.0 GOAL
============================================================

The major new experience is:

A developer opens ctxd.

Instead of seeing a traditional dashboard first,

they see the ENGINEERING GRAPH.

Example:

                         ┌─────────────┐
                         │   WORKER    │
                         │    LOCAL    │
                         └──────┬──────┘
                                │
                                │
┌──────────────┐         ┌──────▼──────┐         ┌──────────────┐
│   CURSOR     │────────▶│             │◀────────│    CLAUDE    │
│   WORKER     │         │    ctxd     │         │    WORKER    │
└──────────────┘         │    CORE     │         └──────────────┘
                         │             │
                         │ Context     │
                         │ Memory      │
                         │ Tasks       │
                         │ Git         │
                         │ Verification│
                         │ Token       │
                         └──────┬──────┘
                                │
                                │
                         ┌──────▼──────┐
                         │    REPO     │
                         │    / GIT    │
                         └─────────────┘

The graph is the HOME SCREEN.

ctxd is the central node.

Workers connect to ctxd.

Repository connects to ctxd.

Memory connects to ctxd.

Context flows through ctxd.

The graph should visually communicate:

WHO IS CONNECTED
WHAT IS ACTIVE
WHAT IS HAPPENING
WHERE CONTEXT IS FLOWING
HOW MUCH CONTEXT IS BEING USED
WHICH WORKER IS WORKING
WHETHER A WORKER IS WAITING
WHETHER A WORKER HAS FAILED
WHETHER ctxd is currently building context
WHETHER verification is running

============================================================
5. GRAPH DESIGN
============================================================

Use the existing React UI.

Do NOT create a second UI application.

Do NOT create a separate frontend unless absolutely necessary.

For V1 of the graph:

Use hand-written SVG + React.

Do NOT immediately add React Flow or another large graph framework.

Reason:

The initial graph contains only a small number of important nodes.

The graph should remain lightweight.

Nodes:

CENTER:

ctxd Core

Possible surrounding nodes:

Claude
Cursor
Local Worker
Repository
Git
Memory
Context Engine
Verification

The graph should support:

- drag
- pan
- zoom
- collapse
- node selection
- node details
- connection visualization
- live status
- animated activity

Connections should visually show direction.

Example:

Claude
  │
  │ context request
  ▼
ctxd
  │
  │ retrieve
  ▼
Memory

or:

ctxd
  │
  │ minimal context
  ▼
Cursor

or:

Cursor
  │
  │ code changes
  ▼
Repository

or:

Repository
  │
  │ verification
  ▼
ctxd

============================================================
6. CONNECTION STATES
============================================================

DO NOT FAKE worker connection state.

Only display states that are backed by actual data.

Minimum states:

CONNECTED
WAITING
DISCONNECTED
ERROR

If the system cannot honestly determine a state:

UNKNOWN

Do not convert UNKNOWN into CONNECTED.

Do not infer connection state merely because a worker has a session row.

Implement real event tracking.

MCP and worker integrations should emit events such as:

worker_connected
worker_disconnected
worker_request_started
worker_request_finished
worker_error
context_requested
context_built
verification_started
verification_finished
memory_updated
task_updated
checkpoint_created

WORKER IDENTITY IS CLAIMED, NOT VERIFIED

This constrains what CONNECTED is allowed to mean.

The MCP server knows one thing for certain: a client attached to the
transport, and when it detached. That is a real, observable fact.

It does NOT know who that client is. Worker identity is self-declared
per call — packages/mcp/src/tools.ts takes `worker` as a parameter.
Any local process can start the MCP server and call itself Claude.

Therefore:

"Claude is connected"

is dishonest. The honest statement is:

"a client is attached and claims to be Claude"

The codebase already has exactly this discipline for memory: a worker
may only write source `worker_statement` or `inferred`, never
`verified_code` or `verified_git`, because those assert something the
worker is not positioned to assert (packages/mcp/src/tools.ts:139-153).

Apply the same rule to connection state.

Store the attachment as fact.
Store the identity as a claim.
Render the claim as a claim.

EXISTING API CONTRACT

GET /api/workers currently returns state: active | idle | unknown,
derived from session rows (packages/api/src/routes.ts:181-235).

Do not silently redefine those strings. Either extend the response with
a separate live-connection field, or version the route. The existing UI
Workers panel must keep working through the change.

STORAGE

Use the existing session_events infrastructure only where an event
genuinely belongs to a session. It cannot carry the rest — see §7.

============================================================
7. EVENT TRANSPORT
============================================================

The current repository does not have a proper live event transport.

Implement this BEFORE attempting live graph animation.

Primary transport:

Server-Sent Events (SSE)

Example:

GET /api/events

The server streams ctxd events.

The React UI subscribes once.

Do not repeatedly reload the entire application.

Event structure:

{
  "id": "...",
  "type": "worker_request_started",
  "timestamp": "...",
  "projectId": "...",
  "workerId": "...",
  "taskId": "...",
  "data": {}
}

Use the existing event/session data as the durable source where appropriate.

The event stream is the live transport.

Do not make the browser responsible for inventing state.

The API remains authoritative.

------------------------------------------------------------
7.1 THE PROCESS BOUNDARY — DECIDE THIS FIRST
------------------------------------------------------------

This is the hard part of UI-1 and the plan above skips it.

The events do not originate where the SSE stream lives.

MCP runs as its own stdio process, started by Claude or Cursor.
The HTTP API runs as a separate process, started by `ctxd ui`.
The CLI is a third process.

An event emitted inside the MCP process cannot reach an SSE handler in
the API process by function call. There must be a channel.

DECISION: the channel is SQLite.

Every producer — MCP, CLI, API — appends the event to a durable table.
The API process tails that table and fans out to connected SSE clients.

Reasons:

- SQLite is already the shared state between all three processes
- it is already WAL and already concurrent-safe
- it works identically on Windows, macOS and Linux, where named pipes
  and unix sockets do not
- events survive a UI restart, so the activity stream has history
  instead of starting empty every launch
- no new dependency, no second daemon, no port

Do NOT introduce a message broker, a socket server or a daemon process.

------------------------------------------------------------
7.2 session_events CANNOT HOLD THESE EVENTS
------------------------------------------------------------

Check the schema before assuming it can:

  session_id TEXT NOT NULL REFERENCES sessions(id)
  -- packages/db/src/schema.ts:165

NOT NULL. A worker_connected event happens before any session exists,
so it has no session_id and cannot be stored there.

Add a new table via a migration — packages/db/src/migrations.ts already
supports this cleanly:

  events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  TEXT     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    session_id  TEXT     NULL REFERENCES sessions(id) ON DELETE SET NULL,
    task_id     TEXT     NULL REFERENCES tasks(id)    ON DELETE SET NULL,
    worker      TEXT     NULL,
    type        TEXT     NOT NULL,
    data        TEXT     NOT NULL,
    created_at  TEXT     NOT NULL
  ) STRICT;

Everything except project_id, type and created_at is nullable, because
an event that has no task is not an event with a fake task.

session_events stays as it is. It is the per-session narrative record
and it is not being replaced.

The monotonic `id` is the SSE cursor: a reconnecting client sends
Last-Event-ID and receives only what it missed. Do not invent a
separate cursor scheme.

------------------------------------------------------------
7.3 SSE CONSTRAINTS
------------------------------------------------------------

- tail by polling the events table on a modest interval; do not busy-loop
- send a periodic comment heartbeat so dead connections are noticed
- cap concurrent subscribers and bound the per-client buffer; a slow
  reader must not grow API memory without limit
- close every stream on shutdown — `ctxd ui` must still exit cleanly,
  and an open SSE handle is the classic reason a Node process will not
- the stream is a read route, so it follows the existing read rules:
  loopback Host and Origin checks, no token. Be aware this means every
  local process can read task titles and worker activity, exactly as it
  can already read /api/tasks. Do not put file contents or memory bodies
  in the event payload — send identifiers and let the client fetch.

============================================================
8. /api/stats
============================================================

Create a proper stats endpoint if it does not already exist.

The UI must NOT calculate engineering verdicts itself.

The backend owns statistics.

Provide data such as:

requests
context requests
candidate tokens
final tokens
estimated context avoided
duplicate tokens
irrelevant tokens
compressed tokens
worker activity
verification status
changes
over-edit detections
comment bloat
noise
scope violations

Support time ranges.

At minimum:

today
7d
30d

Example:

{
  "period": "today",
  "requests": 41,
  "candidateTokens": 680000,
  "finalTokens": 291000,
  "estimatedContextAvoided": 389000,
  "duplicateTokens": 94000,
  "irrelevantTokens": 137000,
  "compressedTokens": 82000
}

Always distinguish:

EXACT
ESTIMATED
UNKNOWN

Never claim exact billing savings unless actual provider billing information exists.

Use wording:

estimated context avoided

NOT:

money saved

unless real billing data exists.

============================================================
9. TOKEN MONITOR
============================================================

The graph/home screen should include a compact token monitor.

Example:

TODAY

Context requested:
680k estimated

Context delivered:
291k estimated

Estimated avoided:
389k

Efficiency:
57%

Breakdown:

duplicates
irrelevant
low priority
compression

Allow clicking the monitor to open the full context inspector.

Reuse existing stats/context systems.

Do not create duplicate token calculation logic.

============================================================
10. CONTEXT FLOW VISUALIZATION
============================================================

When a worker requests context:

animate:

WORKER
  ↓
ctxd
  ↓
Memory / Git / Files
  ↓
Context Firewall
  ↓
compact context
  ↓
WORKER

The animation should be subtle.

Do not create a distracting "AI sci-fi" interface.

This is a developer engineering tool.

Visual language:

technical
dark
clean
calm
dense
precise

Avoid:

huge gradients
marketing cards
unnecessary animations
fake AI effects

============================================================
11. THE MOST IMPORTANT ADDITION:
    CHANGE FIREWALL
============================================================

ctxd must not only optimize INPUT context.

It should also optimize/control OUTPUT changes.

AI workers frequently over-edit.

Example:

Developer asks:

"Change this one line."

Worker changes:

1 requested line

but produces:

47 changed lines
18 comments
12 formatting-only changes
2 unrelated files

ctxd should detect this.

The goal:

SMALL REQUEST
↓
SMALL CHANGE

unless the worker can justify why a larger change was necessary.

Existing diff modules must be reused and improved.

Use existing capabilities for:

- over-edit
- scope
- comments
- noise
- classification
- change receipts

Do not recreate these modules.

============================================================
12. SMALL-FIX SCOPE ANALYSIS
============================================================

When the user asks for a small change:

Extract expected scope from the task.

Examples:

"change this line"
"fix this typo"
"rename this variable"
"change the timeout"
"add one condition"

Expected scope is small.

After worker changes:

Calculate:

requested scope
actual scope

Example:

Requested:
1 line

Actual:
34 lines

Then:

SCOPE EXCEEDED

This does NOT automatically mean the worker is wrong.

Instead classify:

EXPECTED
POSSIBLY JUSTIFIED
SUSPICIOUS
CLEARLY UNRELATED

Example:

Task:
Change timeout from 30s to 60s.

Actual:

config.ts +1/-1

Result:

EXPECTED

Another:

Task:
Change timeout from 30s to 60s.

Actual:

12 files
+438 lines
+200 comments

Result:

SUSPICIOUS

============================================================
13. COMMENT BLOAT DETECTION
============================================================

AI workers often add excessive comments.

ctxd should detect:

- comments added
- comments removed
- comment/code ratio change
- boilerplate comments
- comments that simply restate code
- generated explanatory blocks
- unnecessary TODO-style comments

Example:

Before:

20 comment lines
100 code lines

After:

58 comment lines
104 code lines

Report:

COMMENT BLOAT

+38 comment lines
+4 code lines

Comment/code ratio increased significantly.

Classify comments:

USEFUL
NEUTRAL
REDUNDANT
SUSPICIOUS

Do NOT delete comments automatically.

Report and optionally recommend cleanup.

============================================================
14. CODE CHURN / NOISE
============================================================

Detect:

format-only changes
whitespace-only changes
import reorder
line ending changes
generated files
lockfile noise
unrelated file changes
large rewrites
rename noise

Example:

Task:

"Fix login button disabled state."

Worker changed:

8 relevant lines
+
1,200 formatting changes

Report:

HIGH CHANGE NOISE

Relevant:
8 lines

Noise:
1,200 lines

This should affect the Change Receipt.

============================================================
15. CHANGE RECEIPT
============================================================

Every meaningful worker change should produce a Change Receipt.

Example:

CHANGE RECEIPT

Task:
Fix login button disabled state

Worker:
Claude

Files changed:
3

Relevant changes:
8 lines

Total changed:
1,208 lines

Noise:
1,200 lines

Comment additions:
+38

Unrelated files:
2

Scope:
EXCEEDED

Verdict:
REVIEW REQUIRED

Reasons:

- excessive formatting changes
- comment bloat
- unrelated files

The receipt must be machine-readable and human-readable.

Reuse existing Change Receipt infrastructure.

============================================================
16. WORKER PANEL
============================================================

The graph nodes represent workers.

Clicking Claude opens a worker detail panel.

Example:

CLAUDE

Status:
WORKING

Task:
Stripe webhook idempotency

Started:
12:42

Last activity:
12:47

Context:

Input:
8.7k estimated

Budget:
10k

Recent:

context built
files retrieved
worker request
changes detected

Changes:

4 files
+42
-18

Change firewall:

SCOPE: OK
NOISE: LOW
COMMENTS: OK

Verification:

Tests: PASS
Typecheck: PASS
Build: PASS

All values must come from actual backend data.

If a value is unavailable:

UNKNOWN

Never invent.

------------------------------------------------------------
16.1 THE CONTEXT FIGURE IN THIS PANEL IS NOT YET BACKED
------------------------------------------------------------

As written, the "Input 8.7k / Budget 10k" line above is precisely the
value §37 forbids. Resolve it rather than shipping the contradiction.

ContextReceipt has no worker field:

  request_id, timestamp, project, task, budget,
  candidate_total_tokens, final_total_tokens, ...
  -- packages/context/src/receipt.ts:32-48

So there is no way to attribute a context request to Claude rather than
to Cursor. Per-worker context usage is currently unknowable.

ChangeReceipt, by contrast, DOES carry worker
(packages/diff/src/receipt.ts:40), which is why the Changes and Change
Firewall rows in this panel are backed today and the Context rows are not.

Fix in UI-2, in this order:

1. add an optional `worker` field to ContextReceipt
2. accept it on POST /api/context and on the MCP context tool
3. record it against the same claimed-identity rule as §6 — the worker
   names itself, so this is provenance, not proof
4. treat receipts written before the field existed as UNKNOWN; receipts
   are files on disk and old ones will never have it

Until step 1 lands, the panel shows:

Context:
UNKNOWN

not a plausible-looking number.

============================================================
17. WORKER CONNECTIONS
============================================================

Support:

Claude
Cursor
Local

Architecture must remain provider-independent.

Use an interface such as:

interface Worker {
  id: string
  name: string
  capabilities: string[]
  status(): Promise<WorkerStatus>
}

Do not hardcode Claude into the core.

Do not hardcode Cursor into the core.

The worker manager should treat them as replaceable workers.

============================================================
18. CLAUDE + CURSOR
============================================================

Claude and Cursor share the same ctxd project state.

Architecture:

Claude
   ↓
ctxd

Cursor
   ↓
ctxd

Both access:

same memory
same tasks
same decisions
same rules
same Git state
same context engine
same checkpoints
same handoffs

No separate memories.

No duplicate project state.

ctxd is the source of truth.

============================================================
19. CROSS-WORKER HANDOFF
============================================================

Support:

Claude → Cursor

Cursor → Claude

Example:

Claude:

implemented backend

remaining:
frontend integration

Cursor:

recommended next worker

Handoff includes:

task
objective
completed
remaining
decisions
constraints
bugs
files changed
Git state
last worker
recommended next worker

Use existing checkpoint/handoff infrastructure where possible.

============================================================
20. LIVE ACTIVITY STREAM
============================================================

Add an activity stream.

Example:

12:42
Claude connected

12:43
Task started:
Stripe webhook idempotency

12:44
Context requested

12:44
51k → 9k estimated context

12:45
4 files changed

12:46
Change firewall:
scope OK

12:47
Tests PASS

12:47
Checkpoint created

This must be powered by actual events.

Do not fake activity.

============================================================
21. VERIFICATION PANEL
============================================================

Verification must show freshness.

Never simply show:

Tests: PASS

Instead:

Tests:
PASS
4m ago

or:

PASS
2026-08-14 02:41

If no recent verification exists:

UNKNOWN
Not recently verified

Use actual verification/change receipt data.

Reuse existing verification package.

SOURCE OF THE FRESHNESS FIGURE

There is no verification-runs table. Verification runs on demand and
its result is not persisted as a first-class record.

What IS persisted is ChangeReceipt.verification_status alongside
ChangeReceipt.timestamp (packages/diff/src/receipt.ts:37, 65). That
pair is the honest source: a status and the moment it was true.

So the panel reports the status of the last review, aged — never a
current claim about the working tree, which may have changed since.

If the newest receipt is older than the newest working-tree change:

UNKNOWN
Not verified since last edit

A verification-runs table is a reasonable later addition. Do not add it
in 2.0 unless the receipt route proves insufficient.

============================================================
22. REPOSITORY NODE
============================================================

Repository/Git is a first-class graph node.

Show:

repository
branch
clean/dirty
changed files
recent commit
last verification
current task

Click opens Git panel.

Do not replace Git.

ctxd observes and explains Git state.

============================================================
23. MEMORY NODE
============================================================

Memory is another graph node.

Show:

memories
decisions
rules
bugs
architecture
recent updates

Click opens existing memory UI.

The graph should show activity when memory is retrieved or updated.

============================================================
24. CONTEXT FIREWALL NODE
============================================================

Context should be visible as a major part of the central ctxd node.

Show:

Candidate:

51k

Final:

9k

Reduction:

42k

Then allow inspection.

Show:

Included:

rules
task
memory
files
Git

Excluded:

irrelevant
duplicates
old sessions

Every item should have a reason.

Reuse existing Context Receipt UI.

============================================================
25. MAIN SCREEN LAYOUT
============================================================

The HOME screen should primarily be the graph.

Suggested layout:

┌──────────────────────────────────────────────────────────────┐
│ ctxd                               project     status         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   CURSOR                          CLAUDE                     │
│     ● ───────────────┐      ┌────────────── ●               │
│                      │      │                               │
│                      ▼      ▼                               │
│                    ┌────────────┐                           │
│                    │    ctxd    │                           │
│                    │    CORE    │                           │
│                    └────────────┘                           │
│                      │      │                               │
│                      │      │                               │
│              ┌───────┘      └────────┐                      │
│              ▼                        ▼                      │
│           MEMORY                    REPO                     │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Activity                         Token / Context              │
│ ─────────────────────           ─────────────────────         │
│ Claude working                  51k → 9k                     │
│ Context built                   82% efficient                │
│ Tests passed                    Today                        │
└──────────────────────────────────────────────────────────────┘

Do not make this look like a generic SaaS dashboard.

The graph is the product identity.

============================================================
26. RESPONSIVE / DESKTOP WINDOW
============================================================

The user wants this to feel like a PC application rather than
a website.

Architecture:

FIRST:

Existing local browser UI.

SECOND:

Package the same UI into a desktop window.

Use:

Tauri 2

But ONLY after the graph and live system work correctly.

Do NOT rewrite the application for Tauri.

The React UI remains the frontend.

Tauri is only the shell.

Expected experience:

ctxd
→ opens a small native desktop window
→ local ctxd UI
→ no cloud
→ no login
→ no browser tab required

Possible future:

system tray
quick status
open dashboard
pause worker
view current task

Do not implement the tray before core desktop packaging works.

============================================================
27. Tauri SECURITY
============================================================

Tauri must not expose unrestricted shell access.

Use strict permissions.

Do not allow arbitrary browser JavaScript to execute shell commands.

Keep:

CLI
core
API
MCP

as the actual engineering interfaces.

Tauri is presentation/package layer.

============================================================
28. API AUTH / SECURITY
============================================================

HTTP server:

127.0.0.1 only.

Never default to:

0.0.0.0

Mutating operations must be protected.

Use a local access token or equivalent mechanism.

Never expose unrestricted:

shell execution
file deletion
credential operations

Redact:

API keys
passwords
tokens
.env values
credentials

Never index secrets by default.

Respect:

.gitignore
.ctxdignore

============================================================
29. DOCUMENTATION
============================================================

First inspect existing docs.

Correct stale documentation.

In particular:

docs/api.md

must reflect actual routes.

Do not document:

"UI does not exist"

if UI already exists.

Document:

actual routes
actual UI
actual worker state
actual events

Create/update:

docs/architecture.md
docs/api.md
docs/ui.md
docs/events.md
docs/workers.md
docs/change-firewall.md
docs/security.md
docs/desktop.md
docs/roadmap.md
docs/plan-tracker.md
docs/storage.md

docs/plan-tracker.md is how 1.0 actually landed: every phase had
checkboxes and exit criteria, and nothing was marked done without them.
Extend it with the UI-0 to UI-12 phases below. Do not start a second
tracker file.

docs/storage.md must gain the new events table.

docs/roadmap.md currently lists the event transport nowhere and Tauri
under "Not built". Move Tauri to 2.0 scope and add the events table,
/api/stats and the graph.

Documentation must match implementation.

Never write fake future behavior as current behavior.

============================================================
30. PHASE ORDER
============================================================

DO NOT use the old greenfield Phase 1 → Phase 10 plan.

ctxd 1.0 already exists.

Use this 2.0 plan:

------------------------------------------------------------
UI-0 — AUDIT + DOCUMENTATION CORRECTION
------------------------------------------------------------

The audit itself is done — see §3. What remains here is the correction
work it produced.

Tasks:

1. fix docs/api.md: the UI exists; add /api/workers and /api/config
2. extend docs/plan-tracker.md with the UI phases below
3. confirm the §3 matrix still matches the tree before building on it

Exit criteria:

- no doc states that a built feature is unbuilt
- docs/api.md route table matches packages/api/src/routes.ts exactly
- plan tracker carries UI-0 to UI-12 with exit criteria

------------------------------------------------------------
UI-1 — EVENT TRANSPORT
------------------------------------------------------------

Read §7.1 to §7.3 first. The process boundary is the design problem
here; SSE is the easy half.

Implement, in order:

1. migration adding the `events` table (§7.2)
2. an emit path in @ctxd/core or @ctxd/db that every process can call
3. producers: MCP first, then API, then CLI
4. GET /api/events — SSE, tailing the table, Last-Event-ID cursor
5. one subscription in the React UI, not one per panel

Support:

worker events
context events
task events
memory events
verification events
Git-related events
change firewall events

Exit criteria:

- an event emitted by the MCP process appears in a browser attached to
  the API process — this is the whole point of the phase
- reconnect with Last-Event-ID replays only what was missed
- no fake event data
- `ctxd ui` still exits cleanly with a subscriber attached
- events survive a UI restart
- a slow client cannot grow API memory without bound

------------------------------------------------------------
UI-2 — REAL WORKER STATE + RECEIPT PROVENANCE
------------------------------------------------------------

Implement:

CONNECTED
WAITING
DISCONNECTED
ERROR
UNKNOWN

backed by the transport-level attachment facts from §6, with identity
rendered as a claim rather than as proof.

Also in this phase, because the worker panel is blocked without it:

- add optional `worker` to ContextReceipt (§16.1)
- thread it through POST /api/context and the MCP context tool
- older receipts without the field read UNKNOWN

Exit criteria:

- state changes from real events
- UNKNOWN remains UNKNOWN when no evidence exists
- no fake connected state
- the UI never presents a claimed worker identity as verified
- GET /api/workers keeps its existing contract; the Workers panel still
  works unchanged
- a context receipt written by Claude is distinguishable from one
  written by Cursor

------------------------------------------------------------
UI-3 — GRAPH HOME SCREEN
------------------------------------------------------------

Build:

ctxd central node
Claude
Cursor
Repository
Memory
Context
Verification

Use hand-written SVG.

Exit criteria:

- graph renders
- nodes are real
- data comes from backend
- existing panels remain accessible

------------------------------------------------------------
UI-4 — LIVE GRAPH
------------------------------------------------------------

Connect graph to SSE.

Animate:

context request
context retrieval
worker activity
verification
memory updates

Exit criteria:

A real worker/context event changes the graph.

------------------------------------------------------------
UI-5 — ACTIVITY STREAM
------------------------------------------------------------

Implement activity feed.

Exit criteria:

Every displayed event corresponds to a real event.

------------------------------------------------------------
UI-6 — CHANGE FIREWALL UI
------------------------------------------------------------

Surface existing:

over-edit
scope
comment bloat
noise
unrelated changes
change receipts

Exit criteria:

A small-change benchmark produces a real warning.

------------------------------------------------------------
UI-7 — TOKEN MONITOR
------------------------------------------------------------

Implement:

TODAY
7D
30D

Use /api/stats.

Exit criteria:

No client-side recomputation of backend verdicts.

------------------------------------------------------------
UI-8 — VERIFICATION FRESHNESS
------------------------------------------------------------

Show:

PASS
FAIL
UNKNOWN

with timestamps/age.

Exit criteria:

Never show stale PASS as current.

------------------------------------------------------------
UI-9 — GRAPH INTERACTION
------------------------------------------------------------

Implement:

pan
zoom
drag
collapse
node selection
detail panel

Exit criteria:

Graph remains usable with 10+ nodes.

------------------------------------------------------------
UI-10 — DESKTOP SHELL
------------------------------------------------------------

Add Tauri 2.

Do not rewrite core.

Do not rewrite React UI.

Exit criteria:

ctxd launches as a local desktop window.

CLI continues working independently.

------------------------------------------------------------
UI-11 — CROSS-WORKER HANDOFF
------------------------------------------------------------

Improve:

Claude ↔ Cursor

handoffs.

Exit criteria:

Task can move from one worker to another without losing context.

------------------------------------------------------------
UI-12 — FINAL BENCHMARK
------------------------------------------------------------

Run benchmarks for:

context reduction
retrieval quality
small fixes
over-edit
comment bloat
noise
worker handoff
verification

============================================================
31. IMPORTANT: CHANGE FIREWALL IS A CORE FEATURE
============================================================

ctxd has TWO firewalls:

INPUT FIREWALL:

Large repository knowledge
↓
relevant context
↓
small useful context

OUTPUT FIREWALL:

AI worker output
↓
Git diff
↓
scope analysis
↓
noise analysis
↓
comment analysis
↓
verification
↓
human review

Therefore:

ctxd controls BOTH directions.

This is a major identity of ctxd.

============================================================
32. SMALL CHANGE BENCHMARK
============================================================

Create a golden benchmark.

Three golden benchmarks already exist, with a harness and fixtures under
tests/fixtures/benchmarks — including stripe-webhook. Add this scenario
to that harness. Do not build a second benchmark mechanism, and see
docs/benchmarks.md for how a scenario is added.

Task:

"Change the Stripe webhook timeout from 30 seconds to 60 seconds."

Expected:

1 relevant file
1-2 lines changed

The benchmark should flag:

multiple unrelated files
large formatting changes
large comment additions
large rewrites
unrelated refactoring

Example failure:

Expected:
1 file

Actual:
9 files

Result:

SCOPE EXCEEDED

Noise:
HIGH

Comment bloat:
HIGH

Verdict:
REVIEW REQUIRED

============================================================
33. TOKEN + CHANGE OPTIMIZATION
============================================================

ctxd should measure:

INPUT:

candidate context
final context
estimated avoided context

OUTPUT:

requested scope
actual scope
noise
comments
unrelated files
verification

This allows the UI to eventually show:

TOKEN EFFICIENCY
+
CHANGE EFFICIENCY

Example:

TODAY

Context:

680k → 291k

Estimated avoided:
389k

Changes:

Relevant:
1,420 lines

Noise:
312 lines

Comment bloat:
48 lines

Scope violations:
3

The goal is not merely:

"less tokens"

The goal is:

LESS WASTED CONTEXT
+
LESS WASTED CODE CHURN

============================================================
34. DO NOT OVER-AUTOMATE
============================================================

ctxd should detect problems.

It should not silently destroy worker changes.

Never automatically:

delete comments
delete files
rewrite code
discard changes
reset Git
clean working tree

Instead:

detect
explain
recommend
require approval when destructive

============================================================
35. PERFORMANCE
============================================================

Target:

CLI startup:
<200ms where practical

API:
fast localhost response

SSE:
low latency

SQLite:
fast normal queries

UI:
fast initial load

Graph:
smooth interaction

Do not sacrifice correctness for arbitrary benchmarks.

Cache intelligently.

Use:

mtime
size
hash

to avoid unnecessary rescanning.

============================================================
36. TESTING
============================================================

Run existing tests first.

Then add tests.

Unit:

events
worker state
graph transformation
scope analysis
comment analysis
noise analysis
token stats

Integration:

SSE
API stats
worker events
change receipts

E2E:

real context request
real worker event
real graph update
real small-change detection

Use temporary test directories.

Do not modify the user's real ~/.ctxd.

The suite runs under `node --test` across tests/unit, tests/integration
and tests/e2e. An SSE test that leaves a stream open will hang the
runner rather than fail it — close every subscription in teardown, and
assert that the server exits with a client attached.

379 tests pass today. Run them before touching anything, so a later
failure is attributable.

============================================================
37. ABSOLUTE RULE:
    NEVER FAKE DATA
============================================================

This is critical.

If data does not exist:

show:

UNKNOWN

not:

PASS

not:

CONNECTED

not:

8.7k / 10k

not:

Tests PASS

unless backed by actual data.

Every displayed metric must have a real source.

============================================================
38. DO NOT REBUILD WHAT EXISTS
============================================================

If you discover:

memory already works:

reuse it.

context receipt already works:

reuse it.

diff firewall already works:

reuse it.

verification already works:

reuse it.

stats already work:

reuse them.

task system already works:

reuse it.

Git integration already works:

reuse it.

UI panels already exist:

connect them.

The purpose of 2.0 is:

CONNECT
UNIFY
VISUALIZE
EXTEND

not:

REWRITE

============================================================
39. DEVELOPMENT WORKFLOW
============================================================

Before each phase:

1. inspect
2. understand
3. identify existing implementation
4. identify missing pieces
5. plan smallest change
6. implement
7. test
8. typecheck
9. verify
10. update docs

Never claim success without testing.

After each phase provide:

WHAT CHANGED
FILES
TESTS
RESULT
REMAINING

============================================================
40. FINAL UX
============================================================

The finished ctxd should feel like:

"my engineering command center"

not:

"another AI chat application"

The developer opens it and immediately understands:

WHAT IS HAPPENING?

WHO IS WORKING?

WHAT CONTEXT IS BEING USED?

HOW MUCH CONTEXT WAS REDUCED?

WHAT CHANGED?

DID THE AI OVER-EDIT?

DID IT ADD USELESS COMMENTS?

DID IT TOUCH UNRELATED FILES?

DID TESTS PASS?

WHAT DOES CLAUDE KNOW?

WHAT DOES CURSOR KNOW?

WHAT DOES ctxd REMEMBER?

WHAT SHOULD HAPPEN NEXT?

============================================================
41. LONG-TERM MANAGER
============================================================

Eventually the user should be able to say:

"Take care of this issue."

ctxd:

1. understands task
2. retrieves memory
3. inspects Git
4. builds minimal context
5. selects worker
6. sends work
7. monitors worker
8. receives changes
9. runs change firewall
10. verifies
11. detects failures
12. creates correction context
13. asks worker to correct
14. verifies again
15. records decisions
16. updates memory
17. creates checkpoint
18. reports result

Example final report:

TASK COMPLETED

Worker:
Claude

Files changed:
4

Tests:
31/31 PASS

Typecheck:
PASS

Context:

Candidate:
47k estimated

Final:
11k estimated

Estimated context avoided:
36k

Change Firewall:

Scope:
OK

Noise:
LOW

Comment bloat:
NONE

Architecture violations:
0

Memory:

3 decisions recorded
2 bugs resolved
1 checkpoint created

Ready for human review.

============================================================
42. FINAL ARCHITECTURAL PRINCIPLE
============================================================

ctxd is the persistent engineering layer.

Claude is a worker.

Cursor is a worker.

Future models are workers.

Local models are workers.

The repository belongs to the developer.

Memory belongs to the developer.

Tasks belong to the developer.

Decisions belong to the developer.

Git belongs to the developer.

ctxd coordinates them.

The core remains:

LOCAL
PRIVATE
OFFLINE-CAPABLE
PROVIDER-INDEPENDENT
NO TELEMETRY
NO CLOUD BY DEFAULT

============================================================
43. START NOW
============================================================

DO NOT ask me to restate this.

DO NOT start rebuilding ctxd from zero.

START WITH:

1. Inspect the actual repository.
2. Audit all existing functionality.
3. Build the implementation matrix.
4. Identify the exact 2.0 delta.
5. Correct stale documentation.
6. Implement UI-1 event transport.
7. Implement real worker state.
8. Build the central graph.
9. Connect the graph to real events.
10. Surface the existing Change Firewall.
11. Add /api/stats where missing.
12. Add verification freshness.
13. Add graph interaction.
14. Add Tauri only after the web UI is complete.
15. Run the complete test suite.
16. Report actual results.

DO NOT:

- rebuild existing features
- create fake data
- add cloud services
- add telemetry
- add embeddings just for the UI
- add an LLM just to calculate statistics
- create a second frontend
- create a giant graph dependency without justification
- make Tauri the foundation
- expose unrestricted shell execution
- automatically delete worker changes
- hide uncertainty

The first milestone is:

REAL EVENTS
↓
REAL WORKER STATES
↓
CENTRAL ctxd GRAPH
↓
REAL CONTEXT FLOW
↓
REAL CHANGE FIREWALL
↓
REAL TOKEN MONITOR

The final product should feel like a developer has a
small engineering organization living inside their computer:

             CURSOR
                \
                 \
                  ctxd
                 / | \
                /  |  \
           CLAUDE MEMORY REPO
                 |
            VERIFICATION

ctxd remembers.
ctxd filters.
ctxd coordinates.
ctxd measures.
ctxd protects.
ctxd verifies.

The AI workers do the coding.

ctxd manages the engineering context around them.

BUILD THIS.