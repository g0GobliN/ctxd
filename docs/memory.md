# Memory

Project memory is the engineering knowledge that outlives a session: rules,
decisions, constraints, bugs, facts. It lives locally and is owned by the
developer, not by any AI worker.

## Types

`FACT`, `DECISION`, `ARCHITECTURE`, `CONSTRAINT`, `RULE`, `BUG`, `TASK`,
`NOTE`, `EXPERIMENT`, `PREFERENCE`, `FILE`, `SNAPSHOT`, `SESSION`,
`CONVERSATION`.

Each memory carries an id, project, type, title, content, importance (P0–P4),
confidence, source, status, tags, hash, timestamps and a last-accessed time.

## Authority

This is the part that matters most.

```
explicit user instruction
  > project rule
  > accepted decision
  > verified code state
  > verified Git history
  > worker statement
  > inferred memory
```

**An inferred memory must never silently override an explicit instruction.**
When a lower-authority memory contradicts a higher-authority one with the same
type and title, the save is *rejected and reported* — not written over the top.
`ctxd memory add` exits with status 2 and prints the memory that blocked it, so
the conflict is resolved deliberately rather than by whoever wrote last.

Equal authority is allowed to update: a newer explicit instruction is simply
the developer changing their mind. The previous memory is marked `superseded`
rather than deleted, and the new one records what it superseded, so the history
of a decision stays intact.

Confidence defaults by source — 1.0 for an explicit instruction or project
rule, 0.6 for an inference — so nothing downstream can mistake a guess for a
fact.

## Storage

SQLite holds metadata, relationships and the search index. Markdown holds
durable human-readable knowledge.

Content up to 8 KB lives in the database. Anything larger is written to
`~/.ctxd/projects/<project>/memory/<id>.md`, with a 2 KB excerpt kept in the
database. Search covers that excerpt rather than the whole document — a real
limitation, stated here rather than hidden.

Per-type digests (`rules.md`, `decisions.md`, `bugs.md`, `architecture.md`,
`tasks.md`) are rewritten under the project directory whenever memory changes,
so the knowledge is readable with nothing but a text editor. A type with no
entries still gets a file saying so.

## Search

SQLite FTS5 with the porter tokenizer. No vector database and no embeddings.

Fields are weighted — a term in the title outranks the same term buried in a
body — and results are re-scored by importance, confidence and recency, so a
low-confidence note does not beat a binding rule just by repeating a search
term.

Superseded and archived memories are excluded unless asked for: stale knowledge
resurfacing as current is worse than not finding it.

User input never acts as an FTS5 operator. Each term is quoted before it
reaches the engine, and quoted phrases in the input are preserved as phrases,
so a query means what was typed instead of erroring or silently changing
meaning.

## Commands

```bash
ctxd memory add --title "..." --content "..." [--type RULE] [--source project_rule]
ctxd memory list [--type DECISION]
ctxd memory show <id>
ctxd memory search <query>
```

The project must be registered with `ctxd init` first — memory is always
attached to a project, and a project's identity is anchored to its Git root
commit where one exists.
