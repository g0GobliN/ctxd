# ctxd — Build Tracker

Working checklist derived from `docs/plan.md` (spec v1.0, 3472 lines,
sections 0–91). Section refs like `§22` point back at the spec.

**Spec read: complete (all 92 sections).**

**Current state:** Phases 1 through 9 complete and verified. 365 tests passing,
three golden benchmarks green. All 15 MCP tools are live, and MCP has no
execution primitive at all — asserted by a test and a CI gate. Next action:
Phase 10 — optional local AI, embeddings and Tauri (§64–66), all of which must
stay optional: everything works offline without them.

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
| 10 | Optional local AI / embeddings / Tauri | 🔄 next |

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
- [ ] Deterministic extraction preferred; LLM extraction optional and never for
      trivial facts. Preserve raw conversations, agent outputs, snapshots,
      session/task history, receipts, original files.
- [ ] Interfaces `Summarizer`, `MemoryExtractor`, `EmbeddingProvider`,
      `Classifier`; optional Ollama/llama.cpp/Candle backends
- [ ] Offline mode (§66): search, memory, Git, tasks, sessions, token counting,
      context construction, diff analysis, verification, UI, CLI all work
      without any AI provider

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
- [ ] Docs (§76): README + `docs/{architecture,storage,context-engine,memory,
      diff-firewall,worker-output,mcp,cli,ui,security,development,roadmap}.md`.
      Documentation must reflect real implementation — never document fake
      features.
- [ ] Testing (§77): unit (config, paths, token estimation, ranking, dedup,
      compression, budget, receipts, change surface, formatting/comment/
      over-edit detection); integration (SQLite, migrations, FTS5, context
      engine, indexing, Git, diff firewall); e2e (`doctor`, `status`, `init`,
      `context`). Temp dirs only — **tests never touch `~/.ctxd`** or depend on
      the developer's machine.

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
