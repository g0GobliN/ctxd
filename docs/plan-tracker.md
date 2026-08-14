# ctxd — Build Tracker

Working checklist derived from `docs/plan.md` (spec v1.0, 3472 lines,
sections 0–91). Section refs like `§22` point back at the spec.

**Spec read: complete (all 92 sections).**

**Current state:** 1.0 complete and verified — phases 1 through 10. **2.0 is
complete: UI-0 through UI-12 are all done and verified.** UI-10 (Tauri) was the
last outstanding item; it now compiles, its unit tests pass, and the window
opens on Windows 11 — see its entry. **2.1 adds writes to the interface**, so
the panels can record memory, tasks, sessions and checkpoints rather than only
display them. Its phases are
tracked at the end of this file. **655 tests passing, 0 failing**, seven context
benchmarks and three change benchmarks green. All 15 MCP tools are live, and MCP has no
execution primitive at all — asserted by a test and a CI gate. ctxd ships no
model and calls no network; the AI interfaces exist so one could be added.

> Environment note: this machine now runs Node 24.14.0 and every `ctxd doctor`
> check passes. `better-sqlite3` was moved to `^12.2.0`, which is the first line
> shipping Node 24 prebuilds — 11.x fell back to `node-gyp` and failed for lack
> of a Python toolchain.

---

## Ground rules (§0, §2, §4, §78)

- Local-first. No cloud, no telemetry, no accounts, no mandatory external AI.
- Deterministic algorithms first. No embeddings, no LLM in V1.
- Provider-independent core — no Claude/Cursor internals in `core` (§5, §42).
- Never delete original data; compression only changes the model-facing
  representation (§24, §64).
- Never claim a feature works without running it; never fake a check (§0, §13).
- Never state exact billing savings from estimates — say "estimated context
  avoided" (§18, §25, §48, §49).
- Don't call an LLM where deterministic tooling works: search→ripgrep/index,
  status→Git, tests/build→package scripts, typecheck→tsc, deps→package
  manager (§41).
- Per-phase loop (§0): inspect repo → concise plan → smallest correct change →
  tests → typecheck → lint → verify real behavior → update docs → next phase.
- Unspecified decisions: simplest robust solution, fewest dependencies,
  correctness over superficial token reduction.
- Quality (§78): strict TS, no stray `any`, ESM, small modules, clear
  interfaces, no circular deps, prepared SQL, secure defaults, explicit error
  handling, graceful shutdown, structured logging. No abstraction for its own
  sake.

**Not now (§4):** cloud backend, accounts, billing, telemetry, vector DB,
embeddings, autonomous multi-agent, Electron, browser extension, full IDE,
AST-heavy code intelligence, large local model, deploy automation,
unrestricted shell execution.

**Priority order (§4):** 1) Context Firewall · 2) prove context reduction
without losing correctness · 3) reduce unnecessary AI code changes.

---

## Phase order (§79) — do not reverse without strong reason

| Phase | Content | Status |
|-------|---------|--------|
| 1 | Foundation | ✅ done |
| 1.5 | Context Engine prototype | ✅ done |
| 2 | Project intelligence | ✅ done |
| 3 | Memory | ✅ done |
| 4 | Production Context Firewall | ✅ done |
| 5 | MCP + Claude/Cursor integration | ✅ done |
| 6 | Tasks + sessions + checkpoints + handoffs | ✅ done |
| 7 | Worker management + verification + Diff Firewall | ✅ done |
| 8 | React UI + local API | ✅ done |
| 9 | Optimization + benchmarks | ✅ done |
| 10 | Optional local AI / embeddings / Tauri | ✅ AI interfaces done · Tauri compiled and verified |

---

## Phase 1 — Foundation (§12, target < 1 focused day)

Build: monorepo, CLI skeleton, config, data dir, SQLite, logging, doctor,
status, tests, architecture docs. **Not**: UI, MCP, embeddings, memory engine,
worker manager, cloud.

### Setup (§6, §7)
- [x] pnpm workspace: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- [x] Packages: `core`, `db`, `cli`, `utils` — later (`memory`, `search`,
      `git`, `workers`, `mcp`, `api`, `ui`) only when justified; don't split
      for purity. `context` is created in Phase 1.5 rather than as an empty
      shell now.
- [x] `tests/{unit,integration,e2e,fixtures}`, `docs/`, `scripts/`
- [x] Node 24+, ESM, strict TypeScript

### `packages/core`
- [x] `paths.ts` — resolve `~/.ctxd`, configurable storage dir, never hardcode
      a user-specific absolute path (§8)
- [x] `config.ts` — load + **validate** `~/.ctxd/config.json`; modes `cheap` /
      `balanced` / `full`; no secrets in config (§9)
- [x] `logger.ts` — debug/info/warn/error, structured; never logs API keys,
      passwords, tokens, `.env` values, credentials (§75)
- [x] `types.ts`

Default config (§9):
```json
{
  "mode": "balanced",
  "context": { "safetyMarginTokens": 2000, "outputReserveTokens": 5000 },
  "storage": { "directory": "~/.ctxd" },
  "ui": { "host": "127.0.0.1", "port": 4317 },
  "logging": { "level": "info" },
  "workers": { "defaultOutputMode": "minimal" }
}
```

### Storage layout (§8) — create safely on demand, never assume it exists
`config.json`, `ctxd.db`, `projects/`, `archive/`, `snapshots/`,
`context_receipts/`, `change_receipts/`, `logs/`, `cache/`, `exports/`

### `packages/db` (§10)
- [x] `connection.ts` — better-sqlite3; `journal_mode = WAL`,
      `foreign_keys = ON`; verify FTS5
- [x] `migrations.ts` — simple versioned mechanism, no framework, never
      silently modify schema
- [x] `schema.ts` — Phase 1 needs only `meta` (schema version)
- [x] Prepared statements everywhere

### `packages/cli` (§11)
- [x] `index.ts` with `node:util` `parseArgs`; `--help` on **every** command
- [x] `ctxd doctor` (§13) — real checks: Node version, SQLite, FTS5, ctxd dir,
      config, database, logging, Git. Failures explain the fix. Never report a
      check as passed unless it ran.
- [x] `ctxd status` (§14) — version, config path, data dir, mode, DB status,
      current project if any, Git repo if any. Works outside an initialized
      project.

### Exit criteria (§80)
- [x] `pnpm install` / `build` / `typecheck` / `test` all pass
- [x] `ctxd --help`, `ctxd doctor`, `ctxd status` all run
- [x] SQLite: opens, WAL on, foreign keys on, FTS5 available, migration
      version tracked
- [x] No cloud services, no telemetry, no secrets logged, no fake checks
- [x] Architecture docs written (§76)

---

## Phase 1.5 — Context Engine (§15–26) — most important early milestone

Target (§15):
```
ctxd context --task "Fix Stripe webhook idempotency" \
             --dir ./tests/fixtures/project --budget 10000
```
Engine also exposed as a **pure function** for tests.

- [x] **Fixture** (§16): ~20 source files, 5 docs, 3 session files, 5 memory
      records, project metadata, real Stripe/idempotency files, irrelevant
      files, duplicate docs, mixed-priority memories, realistic timestamps.
      Test asserts `candidateTokens > 50_000`.
- [x] **`ContextItem`** (§17): `id, path, content, tokenCount, tokenCountType,
      type, priority, mtime, hash, score, relevance, reason`. Types: source,
      documentation, memory, session, project, configuration, git, other.
- [x] **Token estimation** (§18): `TokenEstimator { count(text); readonly
      accuracy }`, deterministic heuristic, always marked `"estimated"`.
      Provider tokenizers plug in later.
- [x] **Candidate collection** (§19): walk → ignore rules → read → classify →
      estimate → priority metadata → hash → timestamps → ContextItems.
      No network, no LLM, no embeddings.
- [x] **Dedup** (§20): exact via content hash; near via normalized whitespace +
      line endings → deterministic shingles → similarity `> 0.90`. Keep
      strongest by explicit priority → P0/P1 → recency → source quality.
      Weaker copies excluded from context only, never deleted.
- [x] **Priority model** (§21): P0 mandatory (user rules, security constraints,
      active task, critical architecture decisions) · P1 current · P2 relevant ·
      P3 background · P4 archive. Budget pressure drops P4→P3→P2→P1. Never
      sacrifice required P0/P1 to compress harder.
- [x] **Ranking** (§22): configurable weights, initial `keyword 3.0,
      fileType 1.5, priority 2.0, recency 0.5, path 2.0, tokenCost 0.1`
      (experimental, not optimal).
      `score = keyword·w + path·w + fileType·w + priority·w + recency·w − tokenCost·w`.
      Normalize case/punctuation/whitespace, drop stop words, term frequency,
      paths matter. No embeddings, no LLM.
- [x] **Budget** (§23): collect → dedup → rank → identify mandatory P0/P1 →
      reserve → include highest value → compress large items → recount →
      repeat → verify total ≤ budget. **Never truncate the final string.**
      50k→10k is not the goal; a 2k context that loses architecture is worse
      than a 9k one that keeps it.
- [x] **Compression** (§24): source — keep imports/exports/signatures/relevant
      sections + surrounding context, omit clearly unrelated; markdown — keep
      headings and relevant sections, drop safe boilerplate; sessions —
      structured summaries else omit low-priority. Regex/heading/signature
      based, **no AST chunking yet**. Never modify the original file.
- [x] **Context Receipt** (§25): JSON + human-readable in
      `~/.ctxd/context_receipts/`. Fields: `request_id, timestamp, project,
      task, budget, candidate_total_tokens, final_total_tokens,
      token_count_estimation, removed_tokens{duplicate, irrelevant,
      low_priority, compressed}, included_items[], excluded_items[]`; each item
      `path, token_count, reason, score, priority`.
- [x] **Golden benchmark** (§26): `tests/fixtures/benchmarks/stripe-webhook/`
      with MUST_INCLUDE / SHOULD_INCLUDE / MUST_EXCLUDE. Asserts required
      included, irrelevant excluded, duplicates removed, budget respected,
      P0/P1 preserved, receipt generated. Keep infra extensible for
      auth-migration, database-migration, vite-build-error, payment-flow,
      api-refactor, frontend-bug.

### Exit criteria (§81)
- [x] Candidate > 50k estimated tokens
- [x] Final ≤ configured budget
- [x] Context Receipt generated
- [x] Golden benchmark passes
- [x] Required context preserved, irrelevant excluded, duplicates removed
- [x] All processing local — no LLM calls, no embeddings, no cloud

---

## Phase 2 — Project intelligence (§27–29)

- [x] `ctxd init`: detect Git repo, repo root, stable project ID, runtime,
      language, package manager, framework; inspect key config, structure,
      recent commits; create project metadata + local project storage;
      generate agent integration instructions
- [x] Detection reads **actual files** (package.json, lockfiles, tsconfig,
      vite/next/nuxt config, Cargo.toml, pyproject, requirements.txt, go.mod,
      pom.xml, gradle, Dockerfile, docker-compose, README) — never infer from
      folder names alone
- [x] Incremental indexing (§28, §73): track path, mtime, size, hash, language,
      imports, exports; reprocess only changed files; cache and invalidate
      intelligently; respect `.gitignore` + `.ctxdignore` (`.env*`,
      node_modules, dist, build, coverage, secrets, private/). Never index
      secrets. **Never auto-send changed files to AI.**
- [x] Git awareness (§29): branch, status, recent commits, changed files, diff
      summaries; later `git_commits` / `git_changes`. Git stays source of truth.

---

## Phase 3 — Persistent memory (§30–32)

- [x] Types: FACT, DECISION, ARCHITECTURE, CONSTRAINT, RULE, BUG, TASK, NOTE,
      EXPERIMENT, PREFERENCE, FILE, SNAPSHOT, SESSION, CONVERSATION
- [x] Fields: id, project_id, type, title, content, importance, confidence,
      source, created_at, updated_at, last_accessed_at, hash, status, tags
- [x] SQLite for metadata/relationships/indexing/search; Markdown/JSON for
      large durable human-readable knowledge — don't put every blob in SQLite
- [x] Project storage `~/.ctxd/projects/<project-id>/`: `project.md`,
      `architecture.md`, `stack.md`, `rules.md`, `decisions.md`, `bugs.md`,
      `tasks.md`, `sessions/`, `snapshots/`, `memory/`
- [x] **Authority order** (§31): explicit user instruction > project rule >
      accepted decision > verified code state > verified Git history > worker
      statement > inferred memory. Inferred memory must never silently
      override an explicit rule. Carry `confidence` + `source`.
- [x] Search (§32): FTS5 — terms, phrases, project/type filters, priority,
      recency, weighted fields. No vector DB, no required embeddings.

---

## Phase 4 — Production Context Firewall (§33)

- [x] Pipeline: raw candidates → filter → dedup → rank → retrieve memory →
      select files → chunk → compress → budget → final context → receipt
- [x] Inputs: SQLite metadata, FTS5, Git, memory, project structure, task
      state, file relevance, recency, priority, configurable weights
- [x] Progressive retrieval: agents request more incrementally
      (`ctx_search` → `ctx_get` / `ctx_file` / `ctx_decision` / `ctx_history`).
      Never return the whole project up front.

---

## Phase 5 — MCP + worker integration (§34–37)

- [x] MCP tools: `ctx_status`, `ctx_search`, `ctx_get`, `ctx_memory_save`,
      `ctx_memory_update`, `ctx_task_get`, `ctx_task_update`,
      `ctx_decision_get`, `ctx_file_search`, `ctx_file_get`,
      `ctx_context_build`, `ctx_checkpoint`, `ctx_handoff`,
      `ctx_project_summary`
- [x] MCP calls the **same core services as the CLI** — no duplicated business
      logic
- [x] Claude Code instructions (§35) + equivalent Cursor instructions (§36):
      before complex tasks inspect task, search memory, respect rules, retrieve
      only relevant context, don't request whole-repo memory; after meaningful
      work update task state, record decisions and unresolved issues,
      checkpoint when appropriate
- [x] Both workers share one ctxd memory; neither owns it (§36)
- [x] `ctxd handoff` (§37): task, objective, completed, remaining, decisions,
      constraints, known bugs, files changed, Git state, last worker,
      recommended next worker

---

## Phase 6 — Tasks, sessions, checkpoints (§38–40)

- [x] Task statuses: BACKLOG, PLANNED, IN_PROGRESS, BLOCKED, REVIEW, DONE,
      CANCELLED; fields id, title, description, priority, status, project,
      parent_task, worker, created_at, updated_at, completed_at; supports
      decomposition
- [x] `ctxd session start|status|end`, `ctxd resume`; store start, end, project,
      task, worker activity, Git changes, decisions, memories, errors.
      `resume` must produce a genuinely useful continuation summary.
- [x] Checkpoints: objective, completed work, remaining work, decisions,
      constraints, changed files, known errors, next action, worker, Git state.
      Original session data stays archived.

---

## Phase 7 — Workers, verification, Diff Firewall (§42–57)

### Worker + verification
- [x] `Worker { id, name, capabilities, status() }` (§42); claude/cursor/local;
      no provider-specific logic in core
- [x] Verification engine (§43): git diff, git status, typecheck, tests, lint,
      build, architecture checks → PASS / FAIL / NEEDS_REVIEW
- [x] On failure **never resend the original context** — build correction
      context (§43, §60): original requirement, failed command, relevant error,
      relevant changed file, relevant code region, relevant rule/decision,
      previous attempt if needed
- [x] Architecture drift detection (§44): deterministic rule checks (e.g.
      "frontend must not access database directly") reporting rule + violating
      file. No LLM required per check.

### Diff Firewall (§50–57) — first-class feature
- [x] Detect the 13 over-edit patterns (§50): whole-file reformat, function
      rewrite, unrelated renames/imports, unnecessary comments/docs, unrelated
      cleanup or refactor, dependency changes, multi-file spread, duplicated
      helpers, defensive code, whitespace/line-ending churn
- [x] **Never blindly rewrite worker code, never auto-remove code because the
      diff is large, never assume a large diff is wrong.** Goal is minimum
      *necessary* change while preserving behavior, correctness, tests,
      architecture, security, business logic.
- [x] Change surface (§51): expected scope per task; compute `files_changed,
      lines_added, lines_removed, lines_modified, unrelated_files,
      formatting_only_changes, comment_only_changes, import_only_changes,
      dependency_changes, rename_changes, generated_file_changes`; warn, don't
      auto-reject
- [x] Over-edit detection (§52): `change_efficiency_score` — a focus measure,
      **not** a correctness score
- [x] Formatting noise (§53): separate semantic from presentation-only changes
      (indentation, line endings, quote style, import order, whitespace,
      whole-file format). Report; never auto-revert or destroy worker output.
- [x] Comment noise (§54): keep comments explaining WHY / security / business
      rules / API quirks / workarounds / architectural constraints /
      non-obvious invariants; flag ones restating obvious syntax. Never blindly
      delete — move durable reasoning into ctxd memory instead.
- [x] Small-fix protection (§55): small tasks get a small expected surface;
      flag SMALL TASK / LARGE CHANGE MISMATCH and require review
- [x] Change Receipt (§56) in `~/.ctxd/change_receipts/`: `request_id, task,
      worker, files_changed, lines_added, lines_removed,
      formatting_only_changes, comment_only_changes, unrelated_files,
      dependency_changes, risk, change_efficiency_score, verification_status`
- [x] Classification (§57): FOCUSED / ACCEPTABLE / BROAD / SUSPICIOUS /
      NEEDS_REVIEW — evidence-based (task scope, changed files, context, diff,
      architecture rules, tests, dependency changes, formatting/comment noise)

### Output + context economy (§58–61)
- [x] Worker output modes `minimal` (default) / `normal` / `detailed`;
      structured minimal report (changed files, result, tests, notes); avoid
      repeating task, repo context, whole code blocks, diffs, long explanations
- [x] Duplicate explanation prevention (§59): don't resend what the worker
      already knows unless context changed, info went stale, worker asked, or a
      verification failure requires it
- [x] Context delta management (§61): maintain BASE CONTEXT + TASK DELTA +
      CHANGE DELTA + ERROR DELTA instead of resending everything

### Diff Firewall exit criteria (§82)
- [x] small task + small diff → focused
- [x] small task + huge diff → warning, with an explanation of *why* it's
      suspicious
- [x] formatting-only noise detected · comment-only noise detected
- [x] unrelated files detected · dependency changes detected
- [x] large refactor detected, but a relevant large change is **not** auto-rejected
- [x] Change Receipt generated · verification result recorded

---

## Phase 8 — UI (§67–71)

- [x] Local HTTP API + `ctxd ui` at `http://127.0.0.1:4317`, loopback-only,
      token-gated writes. React front end still to come; Tauri eventually;
      **never Electron.**
- [x] Dashboard, memory viewer, task manager (kanban), worker monitor, context
      debugger, token stats, Git overview, change/diff inspector, settings
      (read-only). Not an IDE — the brain stays in core.
- [x] Context inspector (§68): per request show task, budget, included vs
      excluded, candidate vs final tokens, estimated reduction, and **why**
      each item was included or excluded
- [x] Worker monitor (§69): status, current/last task, last activity. Derived
      from recorded sessions; an unseen worker reads as unknown, never idle
- [x] Git UI (§71): branch, status, changed files, diff summary, change
      efficiency, over-edit warnings

---

## Cross-cutting requirements

### Security (§62, §63)
- [x] HTTP binds `127.0.0.1` only, never `0.0.0.0` by default; local auth/token
      for the UI; protect mutating APIs; Host and Origin pinned to loopback
- [x] No telemetry, no cloud DB; never log secrets; redact env vars; don't
      index `.env`; don't send secrets to workers; honor `.gitignore` /
      `.ctxdignore`
- [x] **Never expose arbitrary shell execution through MCP.** Controlled
      execution lives in `@ctxd/verify` behind the CLI in three categories:
      READ_ONLY, SAFE_MUTATING, DANGEROUS (explicit confirmation). MCP has no
      execution primitive at all — asserted by a test and a CI gate

### Statistics (§48, §49)
- [x] Track per request via receipts; every value tagged exact / estimated /
      unknown
- [x] `ctxd stats`, `ctxd efficiency` reporting "estimated context avoided"

### Memory extraction + local AI (§64–66)
- [x] Deterministic extraction preferred (`extractDeterministic`); LLM
      extraction optional and gated by `worthConsultingProvider`. Extraction
      reads only — nothing is destroyed.
- [x] Interfaces `Summarizer`, `MemoryExtractor`, `EmbeddingProvider`,
      `Classifier` in `@ctxd/ai`. No backend ships; a CI gate keeps the
      package free of network primitives and non-ctxd dependencies.
- [x] Offline mode (§66): all 11 capabilities work with no provider — asserted
      by a capability table the test suite checks and `ctxd doctor` reports.

### Other
- [x] Decisions (§45): `ctxd decision|decisions`, `add`, `for <path>`; surfaced
      automatically by `ctxd diff` when related files are touched
- [x] Bug memory (§46): `ctxd bug`; surfaced when relevant areas are touched
- [x] File/module explanations (§47): `ctxd explain` attaches WHY/IMPORTANT
      notes, surfaced on change so workers don't "clean up" intentional code
- [x] Export/import (§74): human-readable JSON, portable, no lock-in
- [x] `ctxd logs` (§75)
- [x] Performance targets (§72): CLI start ~180ms, search ~1ms, memory lookup
      ~1ms — asserted in tests/integration/performance.test.ts. Lazy command
      dispatch cut startup from ~840ms.
- [x] Docs (§76): README + architecture, storage, context-engine, memory,
      diff-firewall, verification (worker output, §58–61), mcp, cli, ui, api,
      security, development, benchmarks, local-ai, roadmap. Documentation
      reflects the real implementation, and the gaps are named as gaps.
- [x] Testing (§77): unit, integration and e2e coverage across config, paths,
      estimation, ranking, dedup, compression, budget, receipts, change surface,
      noise detection, SQLite, migrations, FTS5, indexing, Git, the diff
      firewall, verification, the API and the CLI. Temp dirs only — **tests
      never touch `~/.ctxd`**, enforced by tests/unit/test-hygiene.test.ts
      rather than left to convention.

---

## First implementation action (§90)

1. Inspect repository/environment
2. Create Phase 1 implementation plan
3. Create monorepo → implement foundation
4. Run tests, typecheck, `ctxd doctor`, `ctxd status`; verify Phase 1
5. Immediately implement Phase 1.5: 50k+ token fixture → deterministic Context
   Firewall → Context Receipts → golden benchmark → verify real results
6. Only then Phase 2

Build the smallest correct system first — but do **not** pick a weak algorithm
just because it's easy. Where an algorithm is core, design the interface and
scoring model so it can improve without an architecture rewrite. The Context
Firewall and Diff Firewall are ctxd's core IP.

---

# ctxd 2.0 — the graph control centre

Derived from `docs/plan.md` v2.0. Section refs like `§7.2` point back at that
spec. 2.0 connects what 1.0 built; it does not rebuild it — the audit matrix in
§3 of the spec records what already exists and where.

The rule that shapes every phase below is §37: **if the data does not exist,
show UNKNOWN.** A plausible-looking number with no source is the one failure
this project cannot afford, because the whole claim of ctxd is that its numbers
mean something.

## UI-0 — Audit + documentation correction

- [x] Audit performed; implementation matrix recorded in spec §3 with file
      paths, so the next phase does not re-derive it
- [x] `docs/api.md`: removed the claim that the React interface "is not yet
      built" — it has been since Phase 8 — and added `/api/workers` and
      `/api/config`, two live routes the table omitted
- [x] `docs/api.md`: named the two real gaps (no event transport, no
      `/api/stats`) in place of the stale status note
- [x] `docs/roadmap.md`: 450 tests and seven benchmarks, not 379 and three;
      2.0 phase table added
- [x] `docs/roadmap.md`: "Not built" no longer lists four benchmark scenarios
      that exist — `loadBenchmarks()` reads the fixture directory, so all seven
      have been running all along
- [x] This tracker extended with the UI phases
- [x] Full suite run before any change: **450 pass, 0 fail**, seven benchmarks
      green

## UI-1 — Event transport

- [x] Migration 5 adds the `events` table (§7.2). `session_events` could not
      carry these: its `session_id` is `NOT NULL`, and `worker_connected`
      happens before a session exists
- [x] `@ctxd/events` — emit and read, depending on `@ctxd/db` alone so every
      process can call it
- [x] Producer: MCP. `worker_connected` / `worker_disconnected` from the
      transport, `context_requested` / `context_built` from the context tool
- [x] Producer: API. `context_built` from `POST /api/context`
- [x] Producer: CLI. `ctxd verify` brackets a run with
      `verification_started` / `_finished`; `ctxd diff` records
      `change_analyzed` with the verdict. A `--dry-run` records nothing,
      because it verifies nothing. Emission opens its own short-lived
      connection *after* the work, so CLI startup is untouched — the
      lazy-dispatch performance test still passes
- [x] `GET /api/events` — SSE tailing the table, `Last-Event-ID` as cursor
- [x] `GET /api/events/recent` — history for the initial load, so a new
      subscriber never replays the whole log
- [x] One subscription in the React UI (`subscribeToEvents`), feeding a new
      Activity panel
- [x] `ctxd mcp --worker <name>` — identity as configuration, since the server
      cannot verify it

Exit criteria:

- [x] An event emitted by a **separate process** appears in a client attached
      to the **API process** — covered by a test that spawns a real second
      process, and confirmed by hand against a running `ctxd ui`
- [x] Reconnect with `Last-Event-ID` replays only what was missed
- [x] `ctxd ui` still exits cleanly with a subscriber attached
- [x] Events survive a UI restart — the table is the durable copy
- [x] A slow client cannot grow API memory without bound: 1 MB buffered, then
      disconnected, losing nothing it cannot replay
- [x] No fake event data. Payloads carry identifiers and counts only, never
      context, memory bodies or diff text — asserted by a test
- [x] Suite green: **482 pass, 0 fail** (450 before this phase); 488 once the
      CLI producers landed

## UI-2 — Real worker state + receipt provenance

- [x] `workerConnections()` derives connected / working / error / disconnected
      / unknown from transport events alone
- [x] MCP emits `worker_request_started` / `_finished` / `_error` around every
      tool call, so `working` is a state that actually occurs
- [x] Identity rendered as a **claim** everywhere — `claimedWorker` on the
      stream, `claims cursor` in the interface, `claimed: true` on the API —
      exactly as memory provenance separates `worker_statement` from
      `verified_git`
- [x] `openEnded` marks a connection observed opening but never closing: a
      killed process cannot write its own disconnect, so rather than invent a
      timeout, ctxd reports the fact and its age and lets the developer judge
- [x] Optional `claimed_worker` on `ContextReceipt` (§16.1), threaded through
      `buildContext` → `buildProjectContext` → the MCP tool and
      `POST /api/context`
- [x] Receipts written before the field existed read `unknown`
- [x] `pruneEvents()` with a 30-day default, run once at MCP start — the log
      gains rows per tool call and must not grow without limit

Exit criteria:

- [x] State changes from real events; UNKNOWN stays UNKNOWN without evidence —
      including the case of activity with no transport event, which is unknown
      rather than disconnected
- [x] The interface never presents a claimed identity as verified
- [x] `GET /api/workers` keeps its contract: `state` still means what the
      session history says, and `connection` is added alongside it
- [x] A receipt written by Claude is distinguishable from one by Cursor
- [x] Suite green: **498 pass, 0 fail** (482 before this phase)

## UI-3 — Graph home screen

- [x] `GET /api/graph` assembles the nodes server-side, so the interface lays
      out a decision instead of making one in a browser
- [x] Central ctxd node with workers above and Memory, Repository and
      Verification below — all connected through the core, never to each
      other, because that is the actual architecture
- [x] Hand-written SVG, no graph framework (§5). Under ten nodes at fixed
      positions: there is no simulation to run and nothing to justify the
      largest dependency in the repository
- [x] `countMemories()` — counted in SQLite, because a count taken from a
      capped listing reports the cap and stops being true once a project
      outgrows it
- [x] Receipt reading extracted to `receipts.ts`, shared by the routes and the
      graph rather than duplicated
- [x] The graph is the home screen and the first nav item (§30); every existing
      panel stays reachable

Exit criteria:

- [x] Graph renders from backend data — verified against this repository, where
      it reports 422,903 → 7,992 estimated tokens from the newest receipt
- [x] Nodes with no evidence report it: no receipt means `null` token counts
      and `unknown` accuracy, never `0`, which would claim nothing was avoided
- [x] Existing panels stay reachable
- [x] Connection state never rides on colour alone — an unestablished edge is
      dashed and every state is also a word
- [x] Suite green: **512 pass, 0 fail** (504 before this phase)

## UI-4 — Live graph

- [x] Graph subscribes to SSE; context requests, retrieval, worker activity,
      verification and memory updates animate
- [x] The event → element mapping lives in `packages/ui/src/live.ts`, apart from
      the drawing code, so it can be tested against events a real producer
      wrote rather than against a fixture invented for the test
- [x] Every path lights the core, because every path goes through it. A
      `change_analyzed` lights the repository and not verification: `ctxd diff`
      inspects the tree and runs no checks, so drawing the verification edge
      would claim a check that never happened
- [x] An event that names no worker lights no worker (§37) — attributing it to
      whichever worker is on screen would invent what the producer declined to say
- [x] Pulses decay and the decay timer stops when nothing is lit, so an idle
      graph is genuinely idle rather than re-rendering in the background
- [x] `useApi` gained `refresh` alongside `reload`: an event-driven refetch must
      not blank the panel, because a graph that cleared on every tool call would
      be unreadable exactly when there was most to read
- [x] Movement is never the only carrier — a live node also reads "active now"
      in its accessible label, and `prefers-reduced-motion` drops the animation
      without dropping the information

Exit criteria:

- [x] A real worker event visibly changes the graph — verified against a running
      API with an event emitted from a **separate process**: the frame arrived on
      the stream and `/api/graph` moved from zero workers to one connected
- [x] The graph is still when the system is still: no animation on a timer

## UI-5 — Activity stream

- [x] Wording, tone and detail extracted to `packages/ui/src/activity-format.ts`,
      which is plain TypeScript and therefore testable — the panel keeps only
      the rendering
- [x] `verification_finished` reports failed and unavailable separately: a check
      that could not run is not a check that passed (§58)
- [x] An event carrying no payload gets no detail line, rather than a generic
      sentence that would read the same whether or not ctxd knew anything

Exit criteria:

- [x] Every displayed line corresponds to a real stored event — asserted in both
      directions: every `EVENT_TYPES` member has wording, and no wording exists
      for a type nothing emits (a label whose producer was deleted is exactly
      how a line with no event behind it would appear)
- [x] An unrecognised type renders as its raw name rather than being dropped —
      the event happened, and hiding it would make the stream quietly incomplete
- [x] History and stream overlap is deduplicated by id, so one event never
      reads as two things having happened

## UI-6 — Change Firewall in the interface

- [x] Surface the existing over-edit, scope, comment and noise analysis and
      Change Receipts — `@ctxd/diff` already computed all of it; the interface
      was showing perhaps a third of it
- [x] **Expected scope** panel (§51, §55): the inferred task size and the
      expected file and line counts shown *beside* the actual. Without the
      expectation on screen a mismatch warning is an opinion a developer can
      only accept or ignore; with it they can see ctxd expected a one-file
      change, decide the task read smaller than it was, and move on
- [x] **Noise** breakdown (§53): formatting-only, comment-only, import-only,
      whole-file rewrites, renames, generated files, dependency changes and
      unrelated files — each shown only when non-zero, with the unrelated files
      named rather than counted
- [x] **Comments flagged** (§54), worded so the right response is clear: ctxd
      deletes neither kind, and durable reasoning belongs in project memory
      where the next session will find it, not in a comment the next worker
      will "clean up"
- [x] The saved-receipt listing carries its warnings inline, with evidence — a
      listing showing only a verdict would make a developer open every row to
      find the one that mattered
- [x] The UI's `ChangeReceipt` type was missing 13 of the receipt's fields, so
      the data had been arriving and being discarded
- [x] "ctxd reports and never reverts" stated in the panel, next to the analysis
      that might otherwise read as a to-do list

Exit criteria:

- [x] A small-change scenario produces a real warning — asserted over the real
      `/api/diff` route against a real Git repository with a real diff, not a
      fixture payload
- [x] Every warning carries evidence, not just a summary
- [x] At least one warning is tied to the **task**, which is what makes it
      small-fix protection rather than a generic complaint about size
- [x] The same diff, honestly described, produces no mismatch warning — a tool
      that warns on everything is ignored, and then it protects nothing
- [x] `verification_status` reads `UNKNOWN`: `ctxd diff` runs no checks, and
      anything else would claim one that never happened

## UI-7 — Token monitor

- [x] `GET /api/stats` over `@ctxd/stats` — the same module `ctxd stats` calls,
      so the panel and the command cannot report different totals for the same
      receipts
- [x] TODAY / 7D / 30D / all time, with the windows defined in `@ctxd/stats`
      rather than in the browser, so there is one definition of "7d"
- [x] The response echoes `window`, `scope` and the resolved `since`, so a
      figure is always labelled with what it covers
- [x] Receipts that could not be read are named in the panel: an incomplete
      total that says so is not the same as a wrong one
- [x] Mean efficiency reads `unknown` with no reviews — `0.00` would claim every
      change was unfocused (§37)

Exit criteria:

- [x] No client-side recomputation of a backend verdict — the browser-side sum
      at `packages/ui/src/panels.tsx:22` is gone. It was worse than duplication:
      the receipt listing is capped at 50, so the dashboard total quietly stopped
      being a total once a project outgrew the cap
- [x] A test asserts the route and `collectStats` agree exactly
- [x] An undefined window is rejected, not guessed

## UI-8 — Verification freshness

- [x] Status and age from `ChangeReceipt.verification_status` + `timestamp`;
      there is no verification-runs table and 2.0 does not add one (§21)
- [x] `verificationFreshness()` in `@ctxd/diff` — staleness is judged against
      the **tree**, not against a clock. A timeout would be a guess dressed as a
      fact; "a file changed after the check ran" is something ctxd observes.
      Same discipline as `openEnded` on worker connections
- [x] Work committed after the check counts as change, so a clean tree does not
      launder a stale verdict into a current one
- [x] Anything that cannot be established reads `unknown`, never `current` — an
      unnecessary `unknown` costs a re-run, a false `current` costs correctness
- [x] The reason names the file or the commit, so the verdict can be argued with
      rather than merely believed

Exit criteria:

- [x] A stale PASS is never shown as current — the badge reads `PASS — stale`
      in warning tone, never a bare `PASS`
- [x] Freshness qualifies a verdict and never replaces it: a stale FAIL is still
      the last thing ctxd actually observed
- [x] Verified against a real Git repository with real writes and commits

## UI-9 — Graph interaction

- [x] Pan, zoom, drag, collapse, selection, detail panel
- [x] Geometry and viewport arithmetic extracted to
      `packages/ui/src/graph-layout.ts` as pure functions. "Usable with 10+
      nodes" sounds like something only a human can judge, but the part that
      decides it is arithmetic — and eyeballing a layout at two workers is
      exactly how a layout that breaks at twelve gets shipped
- [x] Worker rows **wrap** rather than compressing spacing. The old code divided
      the width by the worker count, so at ten workers the boxes overlapped; a
      cramped-but-legible grid beats an even spread of unreadable boxes
- [x] The canvas grows when rows wrap, so worker rows never run into the core.
      A taller picture can be panned; overlapping boxes cannot be fixed by
      anything
- [x] Pointer events, not mouse events — trackpad, stylus and touch from one
      path — with pointer capture so a fast drag is not lost when the pointer
      leaves the SVG, and `touch-action: none` so a touch drag pans rather than
      scrolling the page
- [x] Wheel zoom is anchored: the point under the cursor stays under the cursor,
      which is the difference between zooming and the diagram sliding away
- [x] Node drag divides the screen delta by the scale, or a dragged node drifts
      from the cursor when zoomed
- [x] Zoom bounded in both directions — neither extreme is recoverable by the
      gesture that caused it
- [x] Dragged positions and the viewport are view state, never sent anywhere:
      where a developer parked a node is not something ctxd knows about the
      project
- [x] Collapse past six workers, as a **default** and not a ceiling. Collapsing
      hides boxes, never facts — the cluster node states the count and the
      attached total, and the detail panel still lists every worker by name and
      state, still marked as claims (§6)
- [x] Zoom in / out / reset controls, and the current scale shown as a number

Exit criteria:

- [x] Usable with 10+ nodes — asserted for 1, 2, 3, 5, 6, 8, 10, 12, 16 and 24
      workers: no two boxes overlap, and none runs off the canvas
- [x] The anchored-zoom property holds at the zoom limits as well as in the
      middle of the range
- [x] A zoom that would change nothing returns the same viewport, so a wheel
      spin at the limit does not re-render on every notch

## UI-10 — Desktop shell — **done, verified on Windows**

- [x] `packages/desktop/` — Tauri 2 crate wrapping the same React interface.
      Not a rewrite and not a foundation: no ctxd logic lives in it
- [x] The window loads the interface **over HTTP from the local API** rather
      than bundling the assets. A bundled copy would be a second build of the
      front end that can drift from the API it talks to, and a stale interface
      disagreeing with a current backend is exactly what `Cache-Control:
      no-cache` exists to prevent on the web path
- [x] The shell refuses any URL that is not loopback. §62 binds ctxd to
      loopback; the shell is a browser, so without this the desktop build would
      be the one way to point ctxd's interface at a remote origin — a hole the
      HTTP server itself does not have
- [x] `ctxd desktop [--dir] [--port] [--no-window]`. The API is started by the
      Node process, not by the shell: having the window own the server would be
      a second way to start ctxd, with its own lifetime and its own bugs. One
      server, and closing the window stops it
- [x] The API binds port 0 by default and the shell is told where it actually
      landed, so nothing is reserved in advance or guessed at
- [x] A missing shell is reported as a **missing build**, with the `cargo build`
      command that fixes it — never as a broken feature (§13)

### Not verified — the Rust has never been compiled *or* type-checked

Both `cargo build` and `cargo check` fail on this machine, at the same place:

```
error: error calling dlltool 'dlltool.exe': program not found
error: could not compile `parking_lot_core` (lib) due to 1 previous error
```

The default toolchain is `stable-x86_64-pc-windows-gnu` and MinGW binutils are
not installed, so there is no `dlltool` for the import libraries a dependency
needs. `stable-x86_64-pc-windows-msvc` is installed as a toolchain, but neither
Visual Studio nor the Windows SDK is present, so it has no linker either.
`cargo check` does not get past this: the failure is in codegen for a
dependency, not in linking the final binary, so skipping the link does not skip
it. Building the shell needs a system-level toolchain install — MinGW binutils
or the MSVC build tools — which is not this project's change to make.

#### Toolchain install, in progress

The MSVC build tools are being installed on this machine and the `gnu` blocker
above is superseded by three further ones, each of which produced an error that
named something other than its own cause. They are recorded here because the
next person on Windows will meet all three, and in this order:

1. **Git's `link.exe` shadows the MSVC linker.** With Git for Windows on PATH,
   `cargo` resolves `link.exe` to `C:\Program Files\Git\usr\bin\link.exe` — GNU
   coreutils `link`, not a linker. It fails with `link: extra operand ...` and
   `Try 'link --help'`, which says nothing about PATH. Fixed by building from a
   Visual Studio developer shell.
2. **`cl.exe` appearing does not mean the toolchain is ready.** The MSVC
   compiler is installed well before the Windows SDK. Waiting on the compiler
   and building immediately gives `LNK1181: cannot open input file
   'kernel32.lib'`. Wait for
   `Windows Kits/10/Lib/*/um/x64/kernel32.lib` instead.
3. **The SDK existing on disk does not mean it is registered.** With the VS
   installer still running, `vcvars64.bat` reports `Environment initialized` but
   builds a `LIB` containing the SDK's `ucrt\x64` and *not* its `um\x64` — so
   `kernel32.lib` is still unreachable and the same `LNK1181` appears with the
   correct linker. Wait for the installer processes to exit.

A fourth trap sits underneath those three: **the installer's own exit code
lied.** The bootstrapper reported `Installer failed with exit code: 1` and
`vswhere` listed no product, on a toolchain that was in fact complete and
working. The outcome had to be checked directly — `vcvars64.bat` producing a
`LIB` that contains `um\x64` — rather than inferred from the exit status.

None of this was a change to `packages/desktop/`.

### Verified — the shell compiles, its tests pass, and the window opens

Resolved on Windows 11 with `stable-x86_64-pc-windows-msvc`:

```
Finished `release` profile [optimized] target(s) in 7m 34s

running 3 tests
test tests::accepts_the_local_interface ... ok
test tests::is_not_fooled_by_a_hostname_that_merely_contains_localhost ... ok
test tests::refuses_anything_that_is_not_loopback ... ok
test result: ok. 3 passed; 0 failed
```

`ctxd desktop --dir . --port 4317` then printed `ctxd api listening on
http://127.0.0.1:4317`, `ctxd-desktop.exe` appeared in the process list, and the
API answered `{"ok":true,"version":"0.1.0"}` on `/api/health` while `GET /`
returned the built interface (`200`, `<title>ctxd</title>`, hashed asset
bundle).

**The prediction that this source would need fixing was wrong in the way worth
recording: it compiled with no source errors at all.** The one real defect was
outside the Rust — `packages/desktop/icons/icon.ico` did not exist, and
`tauri-build` requires it to generate the Windows resource file. It is now
generated from `img/logo.png`, letterboxed onto square canvases at 16/32/48/64/
128/256 rather than stretched, because the source art is 448x399.

`is_loopback` had never had its tests executed. They pass, including the two
that matter for §62: `localhost.example.com` and `127.0.0.1.example.com` are
both refused.

Not verified on macOS or Linux — nobody has built it there.

Exit criteria:

- [x] `ctxd` opens a local window — **verified** on Windows 11 via
      `ctxd desktop`, with the interface served from the local API. Requires the
      MSVC build tools (or MinGW binutils for the gnu target), then
      `cargo build --release --manifest-path packages/desktop/Cargo.toml`
- [x] The CLI keeps working independently — **verified**, and it is the half
      that matters more: the shell is packaging, so nothing about ctxd may
      depend on it existing. `tests/e2e/desktop.test.ts` asserts `ctxd status`
      and `ctxd doctor` neither fail nor mention the shell when no binary is
      present, and that `ctxd desktop --no-window` serves the same loopback API
      with `/api/health` answering
- [x] The test suite does not require a Rust toolchain. A suite that only ran
      where Rust was installed would make the shell a foundation, which is what
      §67 says it must never be

## UI-11 — Cross-worker handoff

- [x] Claude ↔ Cursor over the existing checkpoint infrastructure
- [x] `buildHandoff` already assembled everything an incoming worker needs to
      **read**. What it did not do was *move* anything: it produced a summary,
      and a summary a developer copies between two chat windows is not a task
      changing hands. If the outgoing session died before the paste, the work
      stayed where it was and nobody knew
- [x] `transferTask()` in `@ctxd/work` makes the move durable, on the checkpoint
      infrastructure that already exists rather than a mechanism invented for
      it: a checkpoint records the state at the moment of handover, the task is
      reassigned, and the handoff text is built from that checkpoint — so what
      the incoming worker reads and what ctxd recorded are the same thing
- [x] Records **before** it reassigns, so a failure between the two leaves a
      checkpoint describing real state rather than a task assigned to a worker
      with nothing to read
- [x] `ctxd handoff --to <worker> --accept [--from <worker>] [--summary <note>]`.
      Without `--accept` the command still only reads and changes nothing
- [x] `ctx_handoff` gained `accept` and `summary`, with the outgoing side taken
      from `ctxd mcp --worker` — a worker cannot establish its own identity (§6)
- [x] New `handoff_created` event type, wired through `EVENT_TYPES`, the activity
      stream's wording and the graph's element mapping. The incoming worker is
      deliberately **not** lit on the graph: it has been assigned the work, which
      is not the same as having been observed doing anything (§37)
- [x] The event payload carries names, ids and a warning **count** — never the
      handoff text, which belongs behind `/api/session` rather than on a read
      route every local process can see
- [x] Identity discipline throughout: `from` is self-declared, `to` is an
      assignment, and `formatTransfer` states in the handoff text itself that
      ctxd cannot verify either. That text is what an incoming worker reads, and
      an unqualified "from claude" is how a self-declared name quietly becomes
      an assumed fact

Exit criteria:

- [x] A task moves between workers without losing context — asserted in both
      halves, because either alone is easy to fake: the assignment actually
      changes in the database, **and** the binding constraint and accepted
      decision travel with the work
- [x] A round trip (claude → cursor → claude) loses nothing recorded before the
      first handoff
- [x] Unnamed sender, no task, and a handoff to the worker already holding the
      work each produce a stated warning rather than a silent no-op — a transfer
      that silently moved nothing is the worst outcome available, because the
      outgoing worker believes the work was handed on and it was not
- [x] The outgoing worker is taken from the session when it is recorded there,
      since that is a fact rather than a guess

## UI-12 — Benchmarks

- [x] Small-change scenarios added to the existing harness under
      `tests/fixtures/benchmarks` — the output firewall measured the way the
      input firewall already is
- [x] `benchmark.json` gained a `kind` discriminator; `loadBenchmarks()` filters
      on it and `loadChangeBenchmarks()` is its counterpart. Kind defaults to
      `context`, so the seven existing scenarios keep working without being
      touched — an absent field must not silently reclassify a scenario that has
      been running since Phase 1.5
- [x] Scenarios are still discovered from the directory, so adding one is adding
      a folder
- [x] The diff is a checked-in file rather than a repository built at test time:
      the Diff Firewall is a pure function over a parsed diff, so a fixture diff
      measures exactly what a real one would with no Git in the measurement
- [x] `small-change-focused` — small task, small diff. The firewall must stay
      **quiet**: FOCUSED, efficiency ≥ 0.85, and none of the four noise signals
- [x] `small-change-sprawl` — the same one-line fix delivered as a whole-file
      reformat, unrelated files and a new dependency. NEEDS_REVIEW at high risk,
      efficiency ≤ 0.65, mismatch flagged. Written first as `SUSPICIOUS`; the
      firewall said `NEEDS_REVIEW`, and it was right — §55 requires review, and
      the expectation was corrected rather than the code
- [x] `large-change-proportionate` — a genuine payment-module migration. Must
      **not** be flagged as a mismatch and must have none of its files called
      unrelated. This is the §50 direction: a large diff is never proof of a
      wrong one, and a firewall that punishes necessary work gets switched off
- [x] Each scenario asserts the verdict is *explained*, not just stated

Exit criteria:

- [x] Both failure directions pinned by named scenarios a scoring change would
      visibly move — the input firewall has had this since Phase 1.5, the output
      firewall now does too
- [x] `src/http/client.ts` is deliberately expected **not** to count as
      unrelated: it imports the changed file and shares the task's vocabulary.
      Encoding the false alarm as acceptable would have taught the benchmark to
      accept exactly the noise that makes developers stop reading warnings

## 2.1 — Writes in the interface — **done, verified**

2.0 shipped an interface that could show everything and change nothing: sixteen
read routes and one write. These routes close that gap. §27 already names the
API among "the actual engineering interfaces" alongside the CLI, core and MCP,
so this extends that surface rather than reversing a decision — what it does
replace is `ui.md`'s "viewer, not a second brain" framing, which had hardened
into a stricter rule than the specification ever stated.

- [x] `POST /api/memory`, `POST /api/tasks`, `PATCH /api/tasks`,
      `POST /api/session`, `POST /api/checkpoint` in
      `packages/api/src/writes.ts`
- [x] Every route calls the function the CLI calls — `saveMemory`,
      `createTask`, `updateTask`, `startSession`, `createCheckpoint`. A second
      copy of an authority rule is a second place it can be wrong, and the copy
      that disagrees would be the one nobody tested
- [x] An authority refusal from `saveMemory` is passed through as **409** with
      its reason, exactly as MCP passes it to a worker. The interface never
      works around a refusal
- [x] `PATCH` carries only the fields that change; omitted fields are left
      alone rather than round-tripped through the browser, so nothing the
      interface never displayed can be overwritten by displaying it
- [x] UI: memory composer, task create and per-card status select, API token
      field in Settings

### The token is not shipped to the page

Mutating routes need the local token (§62). The interface is served over HTTP
like any other page, so it does not receive the token automatically: the
developer pastes it once from `ctxd ui --print-token` and it is kept in
`localStorage`.

Injecting it into the served HTML would remove that step and would also mean
any local process able to `GET /` could read a credential that currently
requires reading a `0600` file. The paste is the cheaper price.

### Why the interface may write sources MCP refuses

`ctx_memory_save` restricts a worker to `worker_statement` and `inferred`,
because a worker cannot assert `verified_code`, `verified_git` or
`accepted_decision` (§6). The caller here is not a worker: holding the token
means being the developer at the keyboard, with the authority
`ctxd memory add --source accepted_decision` already has from a terminal.
Restricting the interface below the CLI would add no safety — only a reason to
leave the window.

### Bug found: writes resolved to the wrong project

Reads resolve an absent project to *the first registered row*
(`project-scope.ts`). That is harmless when it produces an empty dashboard and
wrong when it files a decision: a server started as `ctxd desktop --dir
some/repo` recorded memory against whichever project happened to be registered
first. Caught by writing a memory through the running window and then failing to
find it from the CLI — it had landed in a different project entirely.

`projectFor` in `writes.ts` now resolves, in order: an explicit `project`, the
project registered at the served directory, then the only registered project —
and **refuses with 409** when several are registered and none match, rather than
guessing. Serving a stale view is recoverable; writing project memory into the
wrong project is not obviously noticed at all.

The read routes still carry the original fallback. Changing read scoping is a
separate decision with its own blast radius and has not been made here.

### Bug found: every registered Windows project read as "not registered"

Verifying the fix above surfaced a second one. `ctxd status` looks a project up
by the **Git root**, and Git reports that with forward slashes even on Windows,
while `detectProject` stores the native form. `findProjectByRoot` compared raw
strings, so the lookup missed:

```
$ ctxd init
Refreshed project   root  C:\Users\comwo\github_projects\ctxd
$ ctxd status
project   not registered (run ctxd init)
```

Both statements were produced seconds apart, and both were wrong together.

`findProjectByRoot` now compares `resolve()`d paths, and falls back to scanning
the (small) project list for rows written before the normalisation existed. Case
is deliberately left alone: Windows paths are case-insensitive and POSIX paths
are not, and lower-casing would make two genuinely different directories on
Linux look like one project.

The fix belongs in the repository rather than in `status`, because a path
equality rule copied into three callers is a rule that will disagree with
itself — `writes.ts` had just become the third caller.

Exit criteria:

- [x] Every write is reachable from the interface and lands in the same store
      the CLI reads — verified against a running window, not only in tests
- [x] The token gate covers all five routes. The first version of that test
      passed while testing nothing: its helper took `token: string | undefined =
      TOKEN`, and a default parameter treats an explicitly passed `undefined` as
      absent, so the "no token" cases were sending the token. It uses `null` now
- [x] Project scoping pinned by a test that serves one registered directory
      while another is registered first
- [x] **634 tests passing, 0 failing**

## 2.2 — The desktop as the whole surface — **done, verified**

The brief: *"not everyone loves CLI, so it's better to be in GUI — the desktop
should be able to do everything."* 2.1 gave the interface writes; this closes
the gap so a person who never opens a terminal is not a second-class user.

- [x] `POST /api/projects` — `ctxd init` from the window. The Projects panel is
      what makes the interface a starting point rather than a second screen for
      something the terminal had to set up first
- [x] `POST /api/verify` — the project's own checks
- [x] `POST /api/handoff` — assemble a handoff, or move the work
- [x] Context building wired into the Context panel; session start and
      checkpoint into Resume; handoff into Workers
- [x] Project switching, pinned in the interface and applied to reads **and**
      writes together — switching must never leave the panels showing one
      project while a write lands in another

### The desktop window is not asked for a token

Mutating routes require the local token (§62), and a browser tab is told it
once in Settings. The desktop window is not asked at all: `ctxd desktop` passes
it to the shell in `CTXD_UI_TOKEN`, and the shell injects it into its own
webview before the page loads.

What that avoids is serving it. Handing the token over HTTP would let anything
able to `GET /` read a credential that today requires reading a `0600` file.
This way the window can write and the port still gives the token to nobody.

Only a hexadecimal value is injected, because it is interpolated into a script
the webview runs — a value able to close the string literal would be code
execution. `only_a_hex_token_reaches_the_injected_script` covers that with
`'); alert(1); ('` among its cases. A missing or malformed token is not fatal:
the window opens, reads work, and Settings still accepts one by hand.

### `POST /api/verify` runs commands, and §63 still holds

§63 forbids exposing shell execution **to a worker** through MCP, and the CI
gate asserting `@ctxd/mcp` cannot import `@ctxd/verify` is untouched — nothing
here is reachable from the MCP surface.

What runs is not arbitrary. `discoverChecks` reads the project's own manifest
and runs the scripts it already defines; the request picks among those by kind
and cannot supply a command. Two limits are stated rather than hidden: the run
is synchronous, so the interface waits, and `dryRun` reports what *would* run.

Verified against the running window: a dry run discovered this project's own
`typecheck`, `test` and `build`, reported each as `skipped`, and gave an overall
`UNKNOWN` — a check that did not run is never a pass (§13).

### Bug found: a directory that does not exist could be registered

`detectProject` does not require its argument to exist. It reports "nothing
detected" for a path with no manifests, and a missing path is indistinguishable
from that — so the first version of `POST /api/projects` cheerfully created a
project row for a directory that was not there, which nothing could ever index.
The route now checks explicitly and answers `400`.

Exit criteria:

- [x] Registering a project, building context, recording memory, creating and
      moving tasks, starting a session, checkpointing, handing off and verifying
      are all reachable without a terminal
- [x] The desktop window needs no token entry
- [x] **655 tests passing, 0 failing**
- [x] `ctxd export`/`import` and `ctxd doctor` remain CLI-only. `runDoctor`
      lives in `@ctxd/cli` and `@ctxd/api` cannot import from it without
      inverting the dependency; moving it into the core is the prerequisite and
      has not been done

## 2.3 — The agent loop — **done, verified**

**This phase deliberately overrides the specification.** §4 lists "autonomous
multi-agent orchestration" under *Not now*, §34 says *require approval when
destructive*, and §43 says *do not add cloud services*. The project owner asked
for a desktop that gives tasks to an AI and shows the whole flow. That decision
is recorded here rather than quietly absorbed, because a spec that silently
stops matching the code is worse than one that says where it was overruled.

What survives from the original position, and why it still matters:

- **ctxd opens no socket.** It starts Claude Code, which is authenticated by the
  developer's own subscription. No API key is handled, stored or asked for, and
  the `no-network` CI gate is untouched.
- **ctxd is still not a worker.** It starts one. Swapping in another runnable
  CLI is a new entry in `route.ts`, not a change to the core (§42).
- **Edits are off by default.** Without `applyEdits` the worker reads and
  reports; the working tree is untouched. §34's actual concern was silent
  destruction, and that is still refused.
- **Nothing is committed, reverted or accepted.** A run ends with a Change
  Receipt a person still has to agree with (§50).

- [x] `packages/agent/` — `route.ts` (who and which model), `runner.ts`
      (starting Claude Code and reading its result), `run.ts` (the sequence)
- [x] `GET /api/agent` — which workers can be started, and why not for the rest
- [x] `POST /api/agent` — context → routing → worker → change review
- [x] Agent panel, with routing reasons, tokens sent, worker result and the
      Change Receipt when edits were enabled
- [x] Events emitted at each stage, so the graph lights from a real run

### Routing tells the truth about Cursor

"Let ctxd decide which AI to use" implies several runnable workers. There is
one. Claude Code has a headless mode; Cursor is an editor with none — it
connects *to* ctxd over MCP and asks for context, and work reaches it through a
handoff rather than by being started.

So routing reports Cursor as unrunnable **with the reason**, rather than
offering a menu where every option but one would fail, and rather than dropping
a worker the developer pays for out of the picture entirely. When a second
runner exists the choice becomes real without the interface changing.

Model choice *is* a real decision and is made deterministically from the size of
the context ctxd already built — §41 forbids calling a model to answer what a
threshold answers, and an AI asked to pick an AI would cost a round trip, a
token bill and determinism. Every choice carries its reason.

### Bug found: the prompt could not go in argv

The first version passed the composed prompt as a command-line argument. On
Windows `claude` is a `.cmd` shim, so it must be spawned through a shell, and
cmd.exe re-parsed the multi-line context — quotes, braces and backslashes and
all. The observed failure was the worker **exiting 0 in 117ms having written
nothing to stdout**, which reads like a crash and was actually a mangled command
line.

The prompt now goes on **stdin**, which has no quoting rules to get wrong.
stdin is closed immediately after writing, because the worker waits for
end-of-input before starting and would otherwise hang until the timeout.

### Verified end to end

Against the running desktop window, on this repository:

```
task     → "Name the file that decides which files enter a context build,
            and the function that ranks them."
context  → 1,561,289 candidate → 5,950 sent
routing  → claude / sonnet
            · Claude Code is the only worker ctxd can start
            · Cursor not considered: an editor with no headless mode …
            · context is mid-sized (5,950 estimated tokens)
worker   → completed, 1 turn, 13s
answer   → selectWithinBudget in packages/context/src/budget.ts
            rankItems in packages/context/src/ranking.ts
```

Both answers are correct. **5,950 tokens of selected context were enough to
answer accurately about a repository whose candidate context is 1.5 million** —
which is the product thesis, demonstrated rather than asserted.

One number worth keeping: a bare `claude -p` round trip on an empty directory
reported 35,736 cached input tokens before any task context at all. That is the
worker's own system prompt and tool definitions, and it is the next place this
loop has fat to cut.

Exit criteria:

- [x] A task typed into the window is selected for, routed, run and reviewed
- [x] Routing never claims a worker is runnable when it is not
- [x] Edits require an explicit opt-in; the default run cannot alter the tree
- [x] ctxd still makes no network calls of its own
