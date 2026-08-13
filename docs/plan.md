# ctxd — MASTER ENGINEERING SPECIFICATION
# Version 1.0
# Status: FINAL
# Build from zero.

============================================================
0. INSTRUCTIONS TO THE IMPLEMENTING AI
============================================================

You are responsible for implementing this project from zero.

Project name:

ctxd

Do not ask me to restate requirements contained in this document.

Do not skip phases.

Do not silently simplify important requirements.

Do not build fake functionality.

Do not claim a feature works unless you actually tested it.

Before implementing each phase:

1. Inspect the current repository.
2. Understand the current implementation.
3. Make a concise implementation plan.
4. Implement the smallest correct change.
5. Run relevant tests.
6. Run typecheck.
7. Run lint if configured.
8. Verify actual behavior.
9. Update documentation.
10. Only then proceed to the next phase.

If an implementation decision is not explicitly specified:

- choose the simplest robust solution
- preserve local-first architecture
- avoid unnecessary dependencies
- avoid cloud services
- avoid unnecessary AI calls
- keep provider independence
- prefer deterministic algorithms
- preserve original data
- optimize for correctness over superficial token reduction

Do not build future features prematurely.

The project should become progressively more capable while keeping
the core small, understandable, testable, and deterministic.

============================================================
1. WHAT IS ctxd?
============================================================

ctxd is a:

LOCAL-FIRST AI ENGINEERING MANAGER
+
CONTEXT FIREWALL
+
TOKEN OPTIMIZER
+
PERSISTENT ENGINEERING MEMORY
+
AI WORKER MANAGER
+
DIFF FIREWALL

It is NOT primarily an AI chatbot.

It is NOT another IDE.

It is NOT another coding agent.

It is NOT a cloud SaaS.

It is NOT dependent on one AI provider.

The human developer is the CTO.

Claude Code, Cursor, and future AI systems are workers.

ctxd is the persistent engineering layer between:

- the developer
- the repository
- project knowledge
- engineering memory
- tasks
- Git
- AI workers

The fundamental architecture is:

Human
  ↓
ctxd
  ↓
Context Firewall
  ↓
Minimum useful context
  ↓
Claude / Cursor / other worker
  ↓
Code changes
  ↓
Diff Firewall
  ↓
Verification
  ↓
Persistent memory
  ↓
Checkpoint / handoff

The most important principle is:

STORAGE IS CHEAP.
MODEL CONTEXT IS EXPENSIVE.

ctxd may store large amounts of local information.

It should provide only the minimum useful information required for
a particular task.

But:

MINIMUM CONTEXT DOES NOT MEAN MINIMUM INFORMATION.

The actual objective is:

MINIMUM USEFUL CONTEXT
+
MAXIMUM RELEVANT INFORMATION
+
MINIMUM NECESSARY CHANGE
+
MINIMUM USEFUL EXPLANATION
+
MAXIMUM CORRECTNESS

============================================================
2. CORE DESIGN PHILOSOPHY
============================================================

Every token sent to an external model must have a reason to exist.

Every line changed by an AI worker should have a reason to exist.

Every explanation produced by an AI worker should have a reason to exist.

ctxd therefore optimizes three things:

1. INPUT CONTEXT
2. CODE CHANGE SURFACE
3. OUTPUT EXPLANATION

The three optimization layers are:

                ┌──────────────────────┐
                │   PROJECT KNOWLEDGE  │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │   CONTEXT FIREWALL   │
                │                      │
                │ retrieve             │
                │ rank                 │
                │ deduplicate          │
                │ compress             │
                │ budget               │
                └──────────┬───────────┘
                           ↓
                    AI WORKER
                           ↓
                ┌──────────────────────┐
                │    DIFF FIREWALL     │
                │                      │
                │ detect over-editing  │
                │ detect noise         │
                │ analyze scope        │
                │ verify changes       │
                └──────────┬───────────┘
                           ↓
                ┌──────────────────────┐
                │ WORKER OUTPUT FILTER │
                │                      │
                │ concise report       │
                │ no repeated context  │
                │ no unnecessary text  │
                └──────────────────────┘

============================================================
3. PRIMARY GOALS
============================================================

Eventually ctxd must provide:

1. Persistent local project memory.
2. Intelligent context retrieval.
3. Token-aware context construction.
4. Context deduplication.
5. Context ranking.
6. Context compression.
7. Project/file relevance detection.
8. Git awareness.
9. Task management.
10. Session management.
11. Checkpoints.
12. Cross-agent handoffs.
13. Claude Code integration.
14. Cursor integration.
15. MCP access.
16. Verification of worker changes.
17. Token/context statistics.
18. Context Receipts.
19. Change Receipts.
20. Local web dashboard.
21. Worker management.
22. AI over-edit detection.
23. Architecture/rule drift detection.
24. Eventually an "AI developer under me" workflow.

The core must remain useful without cloud services.

============================================================
4. DO NOT BUILD THESE INITIALLY
============================================================

Do NOT initially build:

- cloud backend
- user accounts
- SaaS billing
- telemetry
- mandatory external AI
- vector database
- embeddings
- autonomous multi-agent system
- Electron
- complex desktop packaging
- browser extension
- full IDE
- AST-heavy code intelligence
- provider-specific hardcoding
- large local AI model
- deployment automation
- unrestricted shell execution

These may be future features.

The first priority is the Context Firewall.

The second priority is proving that ctxd can reduce unnecessary
AI context without reducing task correctness.

The third priority is reducing unnecessary AI-generated code changes.

============================================================
5. ARCHITECTURE
============================================================

Conceptual architecture:

                     HUMAN
                       │
                       ▼
                ┌─────────────┐
                │    ctxd     │
                │             │
                │ Engineering │
                │   Manager   │
                └──────┬──────┘
                       │
      ┌────────────────┼────────────────┐
      │                │                │
      ▼                ▼                ▼
    CLI               MCP            HTTP API
      │                │                │
      │                │                ▼
      │                │             React UI
      │                │
      ▼                ▼
  Developer       Claude / Cursor
  terminal          workers
                       │
                       ▼
                      Git
                       │
                       ▼
                  Repository

Important:

MCP is the bridge between ctxd and AI workers.

ctxd must NOT depend directly on Claude internals.

ctxd must NOT depend directly on Cursor internals.

Claude and Cursor are replaceable workers.

The core must remain provider-independent.

============================================================
6. TECHNOLOGY
============================================================

Use:

- TypeScript
- Node.js 24+
- ESM
- strict TypeScript
- pnpm
- SQLite
- better-sqlite3
- SQLite WAL
- SQLite foreign keys
- SQLite FTS5
- React for future UI
- local HTTP API for future UI
- Node built-in parseArgs where practical

Do not add unnecessary dependencies.

Use established libraries only when they clearly reduce complexity.

Prefer standard Node APIs where practical.

============================================================
7. INITIAL MONOREPO
============================================================

Do NOT create 12 packages immediately.

Start with five:

ctxd/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── config.ts
│   │       ├── paths.ts
│   │       ├── logger.ts
│   │       └── types.ts
│   │
│   ├── db/
│   │   └── src/
│   │       ├── connection.ts
│   │       ├── migrations.ts
│   │       └── schema.ts
│   │
│   ├── context/
│   │   └── src/
│   │       ├── types.ts
│   │       ├── estimator.ts
│   │       ├── ranking.ts
│   │       ├── dedup.ts
│   │       ├── budget.ts
│   │       ├── compression.ts
│   │       ├── firewall.ts
│   │       └── receipt.ts
│   │
│   ├── cli/
│   │   └── src/
│   │       ├── index.ts
│   │       └── commands/
│   │           ├── doctor.ts
│   │           ├── status.ts
│   │           └── context.ts
│   │
│   └── utils/
│       └── src/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── docs/
├── scripts/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json

Later add only when justified:

- memory
- search
- git
- workers
- mcp
- api
- ui

Do not split packages merely for theoretical architecture purity.

============================================================
8. LOCAL STORAGE
============================================================

Default:

~/.ctxd/

Structure:

~/.ctxd/
├── config.json
├── ctxd.db
├── projects/
├── archive/
├── snapshots/
├── context_receipts/
├── change_receipts/
├── logs/
├── cache/
└── exports/

Do not assume the directory exists.

Create it safely when required.

Allow configurable storage location.

Never hardcode a user-specific absolute path.

============================================================
9. CONFIGURATION
============================================================

Global config:

~/.ctxd/config.json

Initial defaults:

{
  "mode": "balanced",
  "context": {
    "safetyMarginTokens": 2000,
    "outputReserveTokens": 5000
  },
  "storage": {
    "directory": "~/.ctxd"
  },
  "ui": {
    "host": "127.0.0.1",
    "port": 4317
  },
  "logging": {
    "level": "info"
  },
  "workers": {
    "defaultOutputMode": "minimal"
  }
}

Validate configuration.

Supported modes:

cheap
balanced
full

cheap:
Aggressive optimization.

balanced:
Normal optimization.

full:
Preserve more context.

No secrets should be stored in configuration.

============================================================
10. DATABASE
============================================================

Use better-sqlite3.

Verify FTS5 availability.

Enable:

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

Phase 1 requires only:

meta

The meta table tracks schema version.

Do not build a giant migration framework.

Use a simple versioned migration mechanism.

Never silently modify schema.

Later tables:

projects
memories
decisions
tasks
task_steps
sessions
snapshots
messages
files
file_chunks
git_commits
git_changes
worker_runs
context_requests
context_items
token_usage
rules
bugs
experiments
change_receipts

Use prepared SQL statements.

============================================================
11. CLI
============================================================

Use Node's:

node:util parseArgs

Initial commands:

ctxd --help

ctxd doctor

ctxd status

ctxd context

Later:

ctxd init
ctxd search
ctxd memory
ctxd task
ctxd checkpoint
ctxd compact
ctxd handoff
ctxd resume
ctxd review
ctxd decisions
ctxd bugs
ctxd session
ctxd stats
ctxd efficiency
ctxd export
ctxd import
ctxd ui

Every command must support:

--help

============================================================
12. PHASE 1 — FOUNDATION
============================================================

Deliver:

1. pnpm monorepo
2. strict TypeScript
3. ESM
4. CLI skeleton
5. configuration loader
6. data directory
7. SQLite connection
8. initial migration
9. logging
10. ctxd doctor
11. ctxd status
12. tests
13. architecture documentation

Do NOT build:

- UI
- MCP
- embeddings
- memory engine
- worker manager
- cloud

Target:

less than one focused day.

============================================================
13. ctxd doctor
============================================================

Check:

- Node version
- SQLite availability
- FTS5 availability
- global ctxd directory
- configuration
- database
- logging
- Git availability

Example:

ctxd doctor

✓ Node 24.x
✓ SQLite
✓ FTS5
✓ Database
✓ Configuration
✓ Logging
✓ Git

Failures must explain how to fix them.

Never claim a check passed unless it was actually performed.

============================================================
14. ctxd status
============================================================

Show:

- ctxd version
- config path
- data directory
- mode
- database status
- current project if available
- Git repository if available

It must work outside a ctxd-initialized project.

============================================================
15. PHASE 1.5 — CONTEXT ENGINE
============================================================

This is the most important early milestone.

Implement:

ctxd context \
  --task "Fix Stripe webhook idempotency" \
  --dir ./tests/fixtures/project \
  --budget 10000

The Context Engine must also be exposed as a pure function for tests.

============================================================
16. BENCHMARK FIXTURE
============================================================

Create a realistic fixture repository containing approximately:

- 20 source files
- 5 documentation files
- 3 previous session files
- 5 memory records
- project metadata
- relevant Stripe/idempotency files
- irrelevant files
- duplicate documentation
- different priority memories
- realistic file timestamps

The candidate context must be:

>50,000 estimated tokens.

The exact number does not need to be exactly 50,000.

Tests must assert:

candidate tokens > 50,000

============================================================
17. ContextItem
============================================================

Define:

id
path
content
tokenCount
tokenCountType
type
priority
mtime
hash
score
relevance
reason

Types:

source
documentation
memory
session
project
configuration
git
other

============================================================
18. TOKEN ESTIMATION
============================================================

Do NOT pretend to know exact provider token counts.

Define:

interface TokenEstimator {
  count(text: string): number;
  readonly accuracy: "estimated" | "exact";
}

V1 uses a deterministic heuristic.

Mark:

token_count_estimation: "estimated"

Later provider-specific tokenizers can be plugged in.

Never claim estimated savings are exact billing savings.

============================================================
19. CANDIDATE COLLECTION
============================================================

Pipeline:

1. Walk directory.
2. Respect ignore rules.
3. Read eligible files.
4. Classify files.
5. Estimate tokens.
6. Detect priority metadata.
7. Calculate hashes.
8. Collect timestamps.
9. Create ContextItems.

No network calls.

No LLM.

No embeddings.

============================================================
20. DEDUPLICATION
============================================================

Exact duplicates:

Use content hashes.

Near duplicates:

1. normalize whitespace
2. normalize line endings
3. generate deterministic shingles/signatures
4. calculate similarity

If similarity >0.90:

Treat as near duplicate.

Keep strongest version based on:

1. explicit priority
2. P0/P1
3. recency
4. source quality

Never delete original information.

Only exclude weaker copies from current context.

============================================================
21. PRIORITY MODEL
============================================================

P0 — Mandatory
P1 — Current
P2 — Relevant
P3 — Background
P4 — Archive

P0 examples:

- explicit user rules
- security constraints
- active task
- critical architecture decisions

P1:

- current files
- recent errors
- recent changes
- active task details

P2:

- related architecture
- related bugs
- related decisions

P3:

- general project information

P4:

- old sessions
- historical context

Budget pressure removes:

P4 before P3
P3 before P2
P2 before P1

Never sacrifice required P0/P1 context merely to improve compression.

============================================================
22. DETERMINISTIC RELEVANCE RANKING
============================================================

Use configurable weights.

Initial:

keyword = 3.0
fileType = 1.5
priority = 2.0
recency = 0.5
path = 2.0
tokenCost = 0.1

Conceptually:

score =
  keywordMatch(task, content) * keywordWeight
  + pathRelevance(task, path) * pathWeight
  + fileTypeScore(type) * fileTypeWeight
  + priorityScore(priority) * priorityWeight
  + recencyScore(mtime) * recencyWeight
  - tokenCostPenalty(tokens) * tokenCostWeight

These values are experimental.

Do not claim they are scientifically optimal.

Make them configurable.

Normalize:

- case
- punctuation
- whitespace

Ignore obvious stop words.

Use term frequency/relevance.

Path names matter.

Example:

Task:

Stripe webhook idempotency

Higher relevance:

payment/webhook.ts
payment/idempotency.ts
stripe/adapter.ts

Lower relevance:

camera/device.ts
signage/qr.ts

No embeddings.

No LLM.

============================================================
23. CONTEXT BUDGET
============================================================

Example:

10,000 tokens.

Do NOT simply truncate the final string.

Algorithm:

1. collect candidates
2. deduplicate
3. rank
4. identify mandatory P0/P1
5. reserve budget
6. include highest-value items
7. compress large items
8. recalculate token count
9. continue until budget is reached
10. verify final total <= budget

The final context MUST be <= configured budget.

Important:

50k → 10k is not the definition of success.

The true objective is:

MINIMUM USEFUL CONTEXT.

A 2k context that loses critical architecture is worse than a 9k
context that preserves it.

Optimize for correctness.

============================================================
24. DETERMINISTIC COMPRESSION
============================================================

V1 compression must NOT call an LLM.

Source files:

- preserve imports where useful
- preserve exports
- preserve function/class signatures
- preserve relevant sections
- preserve surrounding context
- omit clearly unrelated sections

Markdown:

- preserve headings
- preserve important sections
- preserve relevant paragraphs
- remove obvious boilerplate where safe

Session logs:

- use structured summaries if available
- otherwise omit low-priority sessions

Do not implement AST-heavy chunking yet.

V1:

- headings
- exports
- signatures
- logical sections
- regex-based extraction

AST-aware chunking is a future optimization.

Never modify the original file.

Compression only changes the context representation.

============================================================
25. CONTEXT RECEIPT
============================================================

Every context build produces a Context Receipt.

Produce:

1. JSON
2. human-readable text

Store:

~/.ctxd/context_receipts/

Fields:

request_id
timestamp
project
task
budget
candidate_total_tokens
final_total_tokens
token_count_estimation
removed_tokens
included_items
excluded_items

removed_tokens:

duplicate_tokens
irrelevant_tokens
low_priority_tokens
compressed_tokens

Included item:

path
token_count
reason
score
priority

Excluded item:

path
token_count
reason
score
priority

Example:

CONTEXT RECEIPT #1842

Task:
Stripe webhook idempotency

Candidate:
51,382 estimated tokens

Budget:
10,000

Final:
9,006 estimated tokens

Reduction:
42,376 estimated tokens

Included:

✓ payment/webhook.ts
reason: direct task relevance
priority: P1

✓ payment/idempotency.ts
reason: direct implementation relevance
priority: P1

✓ architecture.md
reason: relevant architecture constraint
priority: P0

Excluded:

× camera/stream.ts
reason: unrelated

× signage/device.ts
reason: unrelated

× old-session-12.md
reason: low priority + unrelated

Token estimation:
estimated

Never say:

"You saved exactly $X"

unless actual provider billing data is available.

============================================================
26. GOLDEN CONTEXT BENCHMARK
============================================================

Create:

tests/fixtures/benchmarks/

Benchmark:

stripe-webhook

Each benchmark supports:

MUST_INCLUDE
SHOULD_INCLUDE
MUST_EXCLUDE

Example:

MUST_INCLUDE:
payment/webhook.ts
payment/idempotency.ts

SHOULD_INCLUDE:
stripe/adapter.ts
architecture.md

MUST_EXCLUDE:
camera/stream.ts
signage/device.ts

Tests:

✓ required context included
✓ irrelevant context excluded
✓ duplicates removed
✓ budget respected
✓ P0/P1 preserved
✓ receipt generated

Future benchmarks:

auth-migration
database-migration
vite-build-error
payment-flow
api-refactor
frontend-bug

Keep benchmark infrastructure extensible.

============================================================
27. PHASE 2 — PROJECT INTELLIGENCE
============================================================

Implement:

ctxd init

It must:

1. detect Git repository
2. identify repository root
3. generate stable project ID
4. detect runtime
5. detect language
6. detect package manager
7. detect framework
8. inspect important configuration
9. inspect repository structure
10. inspect recent Git commits
11. create project metadata
12. create local project storage
13. generate agent integration instructions

Support:

package.json
pnpm-lock.yaml
package-lock.json
yarn.lock
bun.lock
tsconfig.json
vite.config.*
next.config.*
nuxt.config.*
Cargo.toml
pyproject.toml
requirements.txt
go.mod
pom.xml
build.gradle*
settings.gradle*
Dockerfile
docker-compose*
README.md

Do not infer solely from folder names.

Inspect actual files.

============================================================
28. INCREMENTAL INDEXING
============================================================

Track:

path
mtime
size
hash
language
imports
exports

Only reprocess changed files.

Respect:

.gitignore

.ctxdignore

Example:

.env
.env.*
node_modules
dist
build
coverage
secrets
private/

Never index secrets by default.

============================================================
29. GIT AWARENESS
============================================================

Track:

branch
status
recent commits
changed files
diff summaries

Later:

git_commits
git_changes

Do not replace Git.

Git remains the source of truth for repository history.

============================================================
30. PHASE 3 — PERSISTENT MEMORY
============================================================

Memory types:

FACT
DECISION
ARCHITECTURE
CONSTRAINT
RULE
BUG
TASK
NOTE
EXPERIMENT
PREFERENCE
FILE
SNAPSHOT
SESSION
CONVERSATION

Fields:

id
project_id
type
title
content
importance
confidence
source
created_at
updated_at
last_accessed_at
hash
status
tags

Use SQLite for:

- metadata
- relationships
- indexing
- search

Use Markdown/JSON for large durable human-readable knowledge.

Do not put every huge blob directly into SQLite.

Project storage:

~/.ctxd/projects/<project-id>/

project.md
architecture.md
stack.md
rules.md
decisions.md
bugs.md
tasks.md
sessions/
snapshots/
memory/

============================================================
31. MEMORY AUTHORITY
============================================================

Authority order:

explicit user instruction
>
project rule
>
accepted decision
>
verified code state
>
verified Git history
>
worker statement
>
inferred memory

Inferred memory must never silently override explicit rules.

Semantic memories have confidence.

Example:

confidence: 0.95
source: explicit_user

or:

confidence: 0.67
source: inferred_from_worker

User-provided explicit facts have highest authority.

============================================================
32. SEARCH
============================================================

Use SQLite FTS5 for V1.

Support:

- terms
- phrases
- project filtering
- memory type filtering
- priority
- recency
- weighted fields

Do NOT add vector DB.

Do NOT require embeddings.

Future:

FTS5 + optional local embeddings.

Potential local backends:

Ollama
llama.cpp
Candle

But local AI remains optional.

============================================================
33. PHASE 4 — PRODUCTION CONTEXT FIREWALL
============================================================

Production pipeline:

raw candidates
↓
filter
↓
deduplicate
↓
rank
↓
retrieve memory
↓
select files
↓
chunk
↓
compress
↓
budget
↓
final context
↓
receipt

Use:

- SQLite metadata
- FTS5
- Git
- memory
- project structure
- task state
- file relevance
- recency
- priority
- configurable weights

Agents should be able to request more context incrementally.

Conceptually:

Agent:
"I need information about Stripe webhook retry behavior."

ctxd:

ctx_search("Stripe webhook retry")

Then:

ctx_get(...)
ctx_file(...)
ctx_decision(...)
ctx_history(...)

Do not immediately return the entire project.

============================================================
34. PHASE 5 — MCP
============================================================

Implement MCP after Context Firewall stability.

Expose tools such as:

ctx_status
ctx_search
ctx_get
ctx_memory_save
ctx_memory_update
ctx_task_get
ctx_task_update
ctx_decision_get
ctx_file_search
ctx_file_get
ctx_context_build
ctx_checkpoint
ctx_handoff
ctx_project_summary

Names may be refined.

Keep them obvious.

MCP must use the same core services as CLI.

Do NOT duplicate business logic.

============================================================
35. CLAUDE CODE INTEGRATION
============================================================

Generate project-level instructions for Claude Code.

Instructions should communicate:

ctxd is persistent engineering memory.

Before complex tasks:

- inspect current task
- search relevant memory
- respect project rules
- retrieve only relevant context

Do not request entire repository memory.

After meaningful work:

- update task state
- record important decisions
- record unresolved issues
- create checkpoint when appropriate

Claude should retrieve additional context through MCP.

============================================================
36. CURSOR INTEGRATION
============================================================

Generate equivalent Cursor project instructions.

Cursor and Claude must use the same ctxd project memory.

Architecture:

Claude
   ↓
ctxd
   ↑
Cursor

Same source of truth.

Neither worker owns project memory.

ctxd owns persistent engineering state.

============================================================
37. CROSS-WORKER HANDOFFS
============================================================

Implement:

ctxd handoff

Handoff contains:

task
objective
completed work
remaining work
decisions
constraints
known bugs
files changed
Git state
last worker
recommended next worker

Example:

TASK:
Stripe idempotency

DONE:

- idempotency keys
- persistence

REMAINING:

- retry handling
- integration tests

IMPORTANT:
Do not create duplicate Payment records.

LAST WORKER:
Claude

RECOMMENDED:
Cursor

============================================================
38. TASK MANAGEMENT
============================================================

Statuses:

BACKLOG
PLANNED
IN_PROGRESS
BLOCKED
REVIEW
DONE
CANCELLED

Fields:

id
title
description
priority
status
project
parent_task
worker
created_at
updated_at
completed_at

Support task decomposition.

============================================================
39. SESSIONS
============================================================

Implement:

ctxd session start
ctxd session status
ctxd session end
ctxd resume

Store:

start
end
project
task
worker activity
Git changes
decisions
memories
errors

ctxd resume must produce a useful continuation summary.

============================================================
40. CHECKPOINTS
============================================================

Checkpoint contains:

objective
completed work
remaining work
decisions
constraints
changed files
known errors
next action
worker
Git state

Original session data remains archived.

============================================================
41. LONG-TERM ENGINEERING MANAGER
============================================================

Eventually the manager should:

1. understand task
2. inspect repository
3. retrieve context
4. plan
5. choose worker
6. monitor worker
7. verify changes
8. update memory
9. create handoff

BUT:

Do not call an LLM when deterministic tooling can solve the problem.

Examples:

search → ripgrep / indexed search
status → Git
tests → package scripts
typecheck → TypeScript
build → package scripts
dependency information → package manager

Use AI reasoning only when needed.

============================================================
42. WORKER ABSTRACTION
============================================================

Define:

interface Worker {
  id: string;
  name: string;
  capabilities: string[];
  status(): Promise<unknown>;
}

Possible workers:

claude
cursor
local

Future workers may be added.

Do not hardcode provider-specific logic into the core.

============================================================
43. VERIFICATION ENGINE
============================================================

After worker changes:

Run appropriate verification:

git diff
git status
typecheck
tests
lint
build
architecture checks

Result:

PASS
FAIL
NEEDS_REVIEW

If failure occurs:

DO NOT resend the entire original context.

Build compact correction context containing:

- failed command
- error
- relevant changed file
- relevant surrounding code
- task requirement
- relevant rule/decision

This is critical for token efficiency.

============================================================
44. ARCHITECTURE DRIFT DETECTION
============================================================

Allow rules such as:

Frontend must not access database directly.

If changed file violates known rule:

Report:

ARCHITECTURE DRIFT DETECTED

Rule:
Frontend must not access database.

Violation:
apps/portal/src/foo.ts

V1 may use deterministic pattern/rule checks.

Do not require an LLM for every check.

============================================================
45. DECISIONS
============================================================

Example:

DECISION #43

Question:
Should Portal access Firebase directly?

Decision:
No.

Reason:
API owns business/data access.

Status:
ACTIVE

Provide:

ctxd decisions
ctxd decision
ctxd decision add

Important decisions must be surfaced when relevant files/modules
are touched.

============================================================
46. BUG MEMORY
============================================================

Example:

BUG #91

Problem:
Vite HMR port collision.

Cause:
Multiple applications using same port.

Fix:
Dedicated ports with strictPort.

Status:
RESOLVED

When relevant areas are touched, surface previous bugs.

============================================================
47. FILE/MODULE EXPLANATIONS
============================================================

Allow explanations to be attached to files/modules.

Example:

FILE:
apps/api/src/payment/idempotency.ts

WHY:
Stripe may retry requests.

IMPORTANT:
Do not remove without reviewing Decision #42.

This protects intentional unusual code from AI cleanup.

============================================================
48. TOKEN STATISTICS
============================================================

Track:

request_id
worker
task
input_tokens
output_tokens_estimate
memory_tokens
file_tokens
instruction_tokens
removed_tokens
deduplicated_tokens
compressed_tokens
final_tokens
timestamp

Distinguish:

exact
estimated
unknown

Never claim exact provider billing unless actual billing data exists.

============================================================
49. EFFICIENCY
============================================================

Implement:

ctxd stats
ctxd efficiency

Example:

Today

Requests: 41

Raw candidate context:
680k estimated

Final context:
291k estimated

Removed:

Duplicate:
94k

Irrelevant:
137k

Compression:
82k

Estimated context avoided:
389k

Use:

"estimated context avoided"

Never:

"you saved $X"

unless actual billing data exists.

============================================================
50. CODE CHANGE MINIMIZER / DIFF FIREWALL
============================================================

This is a first-class ctxd feature.

AI workers frequently make unnecessarily large changes.

Examples:

1. One-line fix reformats an entire file.
2. Small change rewrites an entire function.
3. AI changes unrelated variable names.
4. AI changes unrelated imports.
5. AI adds unnecessary comments.
6. AI adds excessive documentation.
7. AI performs unrelated cleanup.
8. AI refactors surrounding code.
9. AI modifies unrelated dependencies.
10. AI changes multiple unrelated files.
11. AI duplicates helpers.
12. AI adds unnecessary defensive code.
13. AI changes whitespace/line endings across the file.

ctxd must detect this.

IMPORTANT:

Do NOT blindly rewrite worker code.

Do NOT automatically remove code simply because the diff is large.

Do NOT assume a large diff is wrong.

The goal is:

MINIMUM NECESSARY CHANGE

while preserving:

- behavior
- correctness
- tests
- architecture
- security
- business logic

============================================================
51. CHANGE SURFACE
============================================================

Every task should have an expected change scope.

Example:

Task:
Fix Stripe webhook idempotency.

Expected:

payment/webhook.ts
payment/idempotency.ts

Potentially acceptable:

related test file

Unexpected:

camera/
signage/
unrelated frontend files
package upgrades

Calculate:

files_changed
lines_added
lines_removed
lines_modified
unrelated_files
formatting_only_changes
comment_only_changes
import_only_changes
dependency_changes
rename_changes
generated_file_changes

Example:

Expected files:
2

Actual files:
7

ctxd:

CHANGE SURFACE WARNING

Expected:
2 files

Actual:
7 files

Potentially unrelated:
5 files

Do not automatically reject.

Classify and request review when appropriate.

============================================================
52. AI OVER-EDIT DETECTION
============================================================

Detect signals:

- unusually large line count increase
- unusually large line count decrease
- entire-file rewrite
- high percentage of unchanged content represented as changed
- formatting-only changes
- comment-only changes
- unrelated files
- unrelated imports
- dependency changes
- broad refactoring
- unrelated symbol renames
- generated documentation
- duplicated logic
- duplicated comments

Calculate:

change_efficiency_score

This is NOT a correctness score.

It measures how focused the change appears to be.

Example:

Task:
"Fix null check in payment webhook."

Worker:

2 files
+180 lines
-95 lines

ctxd:

CHANGE SURFACE: HIGH

Potential over-editing detected.

Likely causes:

- broad refactor
- formatting changes
- unrelated cleanup

Recommendation:

Review diff before continuing.

============================================================
53. FORMATTING NOISE DETECTION
============================================================

Detect:

- indentation-only changes
- line-ending changes
- quote-style changes
- import reordering
- whitespace-only changes
- formatter-only changes
- whole-file formatting

Separate:

semantic changes

from:

presentation-only changes

Example:

Semantic changes:
4 lines

Formatting changes:
312 lines

Report:

LARGE FORMATTING-ONLY CHANGE DETECTED

Do not automatically revert.

Do not destroy the worker's work.

Allow a future safe cleanup/revert mechanism after verification.

============================================================
54. COMMENT NOISE REDUCTION
============================================================

AI-generated comments must be treated carefully.

Preserve comments that communicate:

- WHY unusual behavior exists
- security constraints
- business rules
- external API quirks
- intentional workarounds
- architectural constraints
- non-obvious invariants

Flag or optionally remove comments that merely describe:

- obvious syntax
- obvious variable names
- obvious control flow
- what the next line literally does

Example:

KEEP:

// Stripe can retry the same event, so this must remain idempotent.

Potentially unnecessary:

// Check if the event exists.
if (event) {
}

Important:

Do not blindly delete comments.

The goal is to move durable reasoning into ctxd memory/decisions
where appropriate instead of repeatedly bloating source files.

============================================================
55. SMALL-FIX PROTECTION
============================================================

If the task is identified as a small change:

Examples:

- one bug fix
- one condition
- one typo
- one configuration value
- one API parameter
- one test assertion

ctxd should establish a small expected change surface.

Example:

Task:
"Change webhook retry limit from 3 to 5."

Expected:

1 file
1-5 changed lines

If worker produces:

8 files
+240 lines
-120 lines

ctxd should flag:

SMALL TASK / LARGE CHANGE MISMATCH

Potential unnecessary work detected.

Require review before considering the task complete.

============================================================
56. CHANGE RECEIPT
============================================================

Every meaningful worker run should produce a Change Receipt.

Fields:

request_id
task
worker
files_changed
lines_added
lines_removed
formatting_only_changes
comment_only_changes
unrelated_files
dependency_changes
risk
change_efficiency_score
verification_status

Example:

CHANGE RECEIPT

Task:
Fix Stripe webhook idempotency

Changed:
1 file

Added:
4 lines

Removed:
2 lines

Unrelated changes:
0

Formatting-only:
0

Comment-only:
0

Dependency changes:
0

Assessment:
Minimal focused change

Verification:
PASS

Store:

~/.ctxd/change_receipts/

============================================================
57. DIFF FIREWALL DECISION
============================================================

The Diff Firewall should classify:

FOCUSED
ACCEPTABLE
BROAD
SUSPICIOUS
NEEDS_REVIEW

Do not make arbitrary judgments.

Use evidence:

- task scope
- changed files
- relevant context
- Git diff
- architecture rules
- tests
- dependency changes
- formatting noise
- comment noise

============================================================
58. WORKER RESPONSE COMPRESSION
============================================================

AI worker text output is also expensive.

Default worker output mode:

minimal

Modes:

minimal
normal
detailed

Routine worker responses should be structured.

Example:

Changed:
- apps/api/src/payment/webhook.ts
- tests/payment/webhook.test.ts

Result:
Stripe webhook idempotency fixed.

Tests:
31 passed.

Notes:
Existing idempotency key is now reused on retries.

Avoid unnecessary:

- repeating the task
- repeating repository context
- entire code blocks
- entire diffs
- unchanged code
- long explanations
- obvious summaries

Detailed output remains available on request.

Default:

MINIMUM USEFUL REPORT

============================================================
59. DUPLICATE EXPLANATION PREVENTION
============================================================

Do not repeatedly send information already known.

If the worker already knows:

task
architecture
rules
decision
file contents

do not resend the same information unless:

- context changed
- information became stale
- worker explicitly requests it
- verification failure requires it

This is context delta management.

Prefer:

previous context
+
delta

over:

entire context again

============================================================
60. CORRECTION CONTEXT
============================================================

When verification fails:

Do NOT resend the original task context.

Build:

CORRECTION CONTEXT

Containing only:

- original requirement
- failed command
- relevant error
- relevant changed file
- relevant code region
- relevant rule
- relevant decision
- previous attempted solution if necessary

Example:

Original task:
Fix webhook idempotency.

Failure:
Test expected 409 but received 200.

Relevant file:
payment/webhook.ts

Relevant rule:
Duplicate Stripe event must not create a second payment.

Send only this correction context.

============================================================
61. CONTEXT DELTA MANAGEMENT
============================================================

When a worker continues a task:

Do not repeatedly resend:

- full project summary
- full architecture
- entire files
- entire task history

Instead maintain:

BASE CONTEXT
+
TASK DELTA
+
CHANGE DELTA
+
ERROR DELTA

This should significantly reduce repeated context.

============================================================
62. SECURITY
============================================================

ctxd is local but security is still important.

Requirements:

- HTTP server binds to 127.0.0.1 only
- never bind 0.0.0.0 by default
- no telemetry
- no cloud database
- never log secrets
- redact environment variables
- do not index .env by default
- do not unnecessarily send secrets to workers
- support .gitignore
- support .ctxdignore
- do not expose credentials through MCP unnecessarily
- protect mutating APIs
- require confirmation for dangerous operations

Future UI must use local authentication/token protection.

Do NOT expose arbitrary shell execution through MCP.

============================================================
63. COMMAND EXECUTION
============================================================

Create controlled command execution.

Categories:

READ_ONLY
SAFE_MUTATING
DANGEROUS

Examples:

READ_ONLY:

git status
git diff
rg
find
ls

SAFE:

tests
typecheck
lint
build

DANGEROUS:

rm
git reset
git clean
deployment commands
credential operations

Require explicit confirmation for dangerous commands.

Never expose unrestricted remote shell execution.

============================================================
64. MEMORY EXTRACTION
============================================================

After meaningful work, optionally extract:

facts
decisions
constraints
bugs
next steps

Prefer deterministic extraction.

LLM extraction may be added later.

Never make an external AI call merely to store a trivial fact.

Never destroy original information.

Preserve:

- raw conversations
- agent outputs
- snapshots
- session history
- task history
- context receipts
- change receipts
- original files

Compression only affects model-facing context.

============================================================
65. OPTIONAL LOCAL AI
============================================================

Design interfaces:

Summarizer
MemoryExtractor
EmbeddingProvider
Classifier

Potential backends:

Ollama
llama.cpp
Candle

But local AI is optional.

The core must work without AI.

============================================================
66. OFFLINE MODE
============================================================

When AI provider is unavailable:

ctxd must still support:

- local search
- memory
- Git
- tasks
- sessions
- token counting
- context construction
- diff analysis
- verification
- UI
- CLI

Graceful degradation is mandatory.

============================================================
67. PHASE 5+ UI
============================================================

Do NOT build UI during Phase 1 or 1.5.

Later:

React
+
local HTTP API

Command:

ctxd ui

Browser:

http://127.0.0.1:4317

Eventually package with Tauri.

Do NOT use Electron.

The UI is NOT another IDE.

It is:

- dashboard
- memory viewer
- task manager
- worker monitor
- context debugger
- token statistics
- Git overview
- change/diff inspector
- configuration

The brain remains ctxd core.

============================================================
68. CONTEXT INSPECTOR
============================================================

For every context request show:

Request
Worker
Task
Budget

Included:

Project rules
Task
Memory
Files
Git changes

Excluded:

Irrelevant files
Duplicates
Old sessions

Also:

candidate tokens
final tokens
estimated reduction

Allow inspecting individual items and why they were included/excluded.

============================================================
69. WORKER MONITOR
============================================================

Show:

Claude Code
Cursor
Local tools

For each:

status
current task
last task
last activity
context usage
last error

============================================================
70. TASK UI
============================================================

Kanban:

BACKLOG
PLANNED
IN PROGRESS
BLOCKED
REVIEW
DONE

Keep it lightweight.

============================================================
71. GIT UI
============================================================

Show:

branch
status
recent commits
changed files
diff summary
change efficiency
over-edit warnings

Do not replace Git.

============================================================
72. PERFORMANCE
============================================================

Target:

CLI startup:
<200ms where practical

SQLite search:
<100ms for normal projects

Memory lookup:
<100ms

Status:
near instant

UI:
fast localhost load

Do not sacrifice correctness for arbitrary benchmarks.

============================================================
73. INCREMENTAL PROCESSING
============================================================

Never rescan everything unnecessarily.

Track:

path
mtime
size
hash

Only process changed files.

Cache where useful.

Invalidate intelligently.

When file changes:

file changed
↓
invalidate relevant index
↓
update metadata

Do NOT automatically send changed files to AI.

============================================================
74. EXPORT / IMPORT
============================================================

Support:

ctxd export
ctxd import

Export should be human-readable where possible.

Allow moving ctxd knowledge to another machine.

Avoid proprietary lock-in.

============================================================
75. LOGGING
============================================================

Levels:

debug
info
warn
error

Provide:

ctxd logs

Never log:

API keys
passwords
tokens
.env values
credentials

Use structured logging.

============================================================
76. DOCUMENTATION
============================================================

Create:

README.md

docs/
├── architecture.md
├── storage.md
├── context-engine.md
├── memory.md
├── diff-firewall.md
├── worker-output.md
├── mcp.md
├── cli.md
├── ui.md
├── security.md
├── development.md
└── roadmap.md

Documentation must reflect actual implementation.

Never document fake features.

============================================================
77. TESTING
============================================================

Write tests from the beginning.

Unit:

- configuration
- paths
- token estimation
- ranking
- deduplication
- compression
- budget logic
- receipt generation
- change-surface calculation
- formatting detection
- comment detection
- over-edit detection

Integration:

- SQLite
- migrations
- FTS5
- context engine
- project indexing
- Git
- diff firewall

E2E:

ctxd doctor
ctxd status
ctxd init
ctxd context

Tests must use temporary directories.

Do NOT modify:

~/.ctxd

during tests.

No test should depend on the user's actual machine.

============================================================
78. QUALITY RULES
============================================================

Use:

- strict TypeScript
- no unnecessary any
- ESM
- clear interfaces
- small modules
- dependency inversion where useful
- no circular dependencies
- prepared SQL
- secure defaults
- explicit error handling
- graceful shutdown
- structured logging

Avoid abstraction for abstraction's sake.

============================================================
79. IMPLEMENTATION ORDER
============================================================

Implement in exactly this general order:

PHASE 1
Foundation

↓

PHASE 1.5
Context Engine Prototype

↓

PHASE 2
Project Intelligence

↓

PHASE 3
Memory

↓

PHASE 4
Production Context Firewall

↓

PHASE 5
MCP + Claude/Cursor integration

↓

PHASE 6
Tasks + Sessions + Checkpoints + Handoffs

↓

PHASE 7
Worker management + Verification + Diff Firewall

↓

PHASE 8
React UI + Local API

↓

PHASE 9
Optimization + Benchmarks

↓

PHASE 10
Optional local AI / embeddings / Tauri

Do not reverse this order without a strong technical reason.

============================================================
80. PHASE 1 EXIT CRITERIA
============================================================

Must pass:

pnpm install
pnpm build
pnpm typecheck
pnpm test

And:

ctxd --help
ctxd doctor
ctxd status

SQLite:

✓ opens
✓ WAL enabled
✓ foreign keys enabled
✓ FTS5 available
✓ migration version tracked

No:

✓ cloud services
✓ telemetry
✓ secrets logged
✓ fake checks

============================================================
81. PHASE 1.5 EXIT CRITERIA
============================================================

Must pass:

Candidate >50k estimated tokens.

Final <= configured budget.

Context Receipt generated.

Golden benchmark passes.

Required context preserved.

Irrelevant context excluded.

Duplicates removed.

All processing local.

No LLM calls.

No embeddings.

No cloud.

============================================================
82. DIFF FIREWALL EXIT CRITERIA
============================================================

Must demonstrate:

1. Small task + small diff = focused.
2. Small task + huge diff = warning.
3. Formatting-only noise detected.
4. Comment-only noise detected.
5. Unrelated files detected.
6. Dependency changes detected.
7. Large refactor detected.
8. Relevant large change is not automatically rejected.
9. Change Receipt generated.
10. Verification result recorded.

Example:

Task:

"Change retry count from 3 to 5."

Good:

1 file
2 changed lines

Warning:

12 files
+430 lines
-390 lines

ctxd must explain WHY it considers the second change suspicious.

============================================================
83. LONG-TERM MANAGER
============================================================

Eventually the developer should be able to say:

"Take care of this issue."

ctxd should:

1. understand repository
2. inspect memory
3. create task
4. create plan
5. choose worker
6. build minimal context
7. assign work
8. monitor worker
9. verify
10. detect failures
11. create correction context
12. retry when appropriate
13. analyze change surface
14. detect unnecessary edits
15. record decisions
16. create checkpoint
17. report result

Worker could be:

Claude
Cursor
another provider
local model

Worker is replaceable.

ctxd remains the persistent engineering layer.

============================================================
84. EXAMPLE FUTURE WORKFLOW
============================================================

Developer:

"Make the payment system production ready."

ctxd:

"I'll inspect the current architecture and existing work."

↓

Retrieve relevant knowledge.

↓

Create task.

↓

Build minimal context.

↓

Choose worker.

↓

Worker implements.

↓

Diff Firewall analyzes changes.

↓

Verification runs.

↓

If failure:

Build compact correction context.

↓

Worker fixes.

↓

Verify again.

↓

Update memory.

↓

Create checkpoint.

↓

Report:

Production-readiness task completed.

Files changed: 18
Tests added: 31
Tests passing: 31
Architecture violations: 0

Candidate context:
47k estimated

Final context:
11k estimated

Estimated context avoided:
36k

Change surface:
Focused

Unrelated changes:
0

Formatting noise:
0

3 decisions recorded.
2 bugs resolved.
1 checkpoint created.

Ready for human review.

============================================================
85. WHAT ctxd MUST NEVER BECOME
============================================================

Do not turn ctxd into:

- another ChatGPT
- another Cursor
- another Claude Code
- another IDE
- a cloud SaaS
- a giant autonomous agent framework
- an unnecessary vector database
- a black-box AI memory system
- a telemetry platform

The intelligence should come primarily from:

local project state
+
Git
+
memory
+
search
+
deterministic algorithms
+
task state
+
verification

AI is an optional reasoning layer.

============================================================
86. MOST IMPORTANT DISTINCTION
============================================================

ctxd is NOT primarily an AI chatbot.

ctxd is:

LOCAL ENGINEERING MEMORY
+
CONTEXT FIREWALL
+
TOKEN OPTIMIZER
+
DIFF FIREWALL
+
AI WORKER MANAGER

Models are replaceable.

Repository belongs to developer.

Memory belongs to developer.

Decisions belong to developer.

Tasks belong to developer.

Git history belongs to developer.

Claude and Cursor are workers.

ctxd is the persistent engineering layer.

============================================================
87. FINAL OPTIMIZATION PRINCIPLE
============================================================

Never optimize for:

"send the smallest possible context."

Optimize for:

"send the smallest context that still contains enough information
to correctly complete the task."

Never optimize for:

"make the smallest possible diff."

Optimize for:

"make the smallest necessary change that correctly solves the task."

Never optimize for:

"produce the shortest possible explanation."

Optimize for:

"produce the shortest explanation that communicates everything
the developer actually needs to know."

Therefore the ultimate objective is:

MINIMUM USEFUL CONTEXT
+
MINIMUM NECESSARY CHANGE
+
MINIMUM USEFUL OUTPUT
+
MAXIMUM RELEVANT INFORMATION
+
MAXIMUM CORRECTNESS

============================================================
88. PRIVACY PRINCIPLE
============================================================

Never sacrifice local privacy for convenience.

Default:

local
private
offline-capable
no telemetry
no cloud
no secret indexing

External AI calls must happen only through explicitly configured
workers/integrations.

Do not silently upload project data anywhere.

Compression does NOT mean deletion.

Archive useful information locally.

Retrieve selectively.

Compress for the model.

Preserve the original.

============================================================
89. FIRST PROOF
============================================================

Do not measure success by the beauty of the UI.

The first proof that ctxd works is:

A developer has a large amount of local project knowledge.

ctxd understands the task.

ctxd identifies relevant information.

ctxd removes unnecessary information.

ctxd preserves important information.

ctxd builds compact context.

ctxd explains exactly what it included and why.

Claude/Cursor can work effectively with that context.

The developer does not repeatedly explain the project.

Then the worker makes changes.

ctxd analyzes the diff.

ctxd detects unnecessary changes.

ctxd detects formatting/comment noise.

ctxd detects unrelated edits.

ctxd verifies the actual change.

ctxd produces a concise result.

That is the foundation.

============================================================
90. FIRST IMPLEMENTATION ACTION
============================================================

Start now.

Do NOT ask for clarification unless the repository contains
a genuinely blocking ambiguity that cannot be resolved from this
specification.

First:

1. Inspect repository/environment.
2. Create Phase 1 implementation plan.
3. Create monorepo.
4. Implement foundation.
5. Run tests.
6. Run typecheck.
7. Run ctxd doctor.
8. Run ctxd status.
9. Verify Phase 1.
10. Immediately implement Phase 1.5.
11. Create 50k+ token benchmark fixture.
12. Implement deterministic Context Firewall.
13. Generate Context Receipts.
14. Run golden benchmark.
15. Verify actual results.
16. Only then proceed to Phase 2.

Do not build UI yet.

Do not add cloud.

Do not add embeddings.

Do not add LLM-dependent compression.

Do not build autonomous agents yet.

Do not over-engineer.

Build the smallest correct system first.

But do NOT choose a weak algorithm merely because it is easy.

Where an algorithm is important to the core product, design the
interface and scoring model so it can be improved without rewriting
the architecture.

The Context Firewall and Diff Firewall are the core intellectual
property of ctxd.

Build them cleanly.

============================================================
91. FINAL DEFINITION OF SUCCESS
============================================================

ctxd succeeds when this becomes possible:

Developer:

"Fix Stripe webhook idempotency."

ctxd:

- understands the task
- searches local engineering memory
- identifies relevant files
- identifies relevant decisions
- identifies relevant rules
- removes duplicate information
- removes unrelated information
- compresses large files deterministically
- creates <= budget context
- produces Context Receipt

Worker:

- receives only useful context
- implements the fix
- avoids unrelated refactoring
- produces concise output

ctxd:

- inspects Git diff
- calculates change surface
- detects formatting noise
- detects unnecessary comments
- detects unrelated files
- verifies tests/typecheck/build
- creates Change Receipt
- records important decision
- updates task
- creates checkpoint
- preserves history

Developer receives:

WHAT CHANGED
WHY
VERIFICATION
WHAT NEEDS REVIEW

Nothing important is lost.

Nothing unnecessary is repeatedly sent.

That is ctxd.

BUILD IT.