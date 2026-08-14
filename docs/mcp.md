# MCP

ctxd exposes its services to AI workers over the Model Context Protocol.

**MCP is a bridge, not the core.** Every tool calls the same functions the CLI
calls. There is no second implementation to drift, and no behaviour that exists
only when a worker is connected.

## Running it

```bash
ctxd mcp --dir /path/to/project --worker claude
```

`--worker` names which worker this server is wired up to, so its activity can be
attributed in the interface. ctxd **cannot verify the name**: the transport shows
that a client attached, not what it is, and any local process could claim to be
Claude. The name is recorded as a claim — the same treatment `worker_statement`
gets below — and without it, activity is recorded with no worker rather than a
guessed one. See [events.md](events.md).

The server speaks JSON-RPC on stdin/stdout, so nothing else may write to stdout
while it runs.

Register with Claude Code:

```bash
claude mcp add ctxd -- ctxd mcp --dir /path/to/project
```

Or with any MCP client:

```json
{
  "mcpServers": {
    "ctxd": { "command": "ctxd", "args": ["mcp", "--dir", "/path/to/project"] }
  }
}
```

`ctxd init` writes both snippets to `~/.ctxd/projects/<id>/mcp-setup.md`, filled
in with the real path.

## Tools

| Tool | Purpose |
|------|---------|
| `ctx_status` | ctxd state; whether this directory is a registered project |
| `ctx_project_summary` | Stack, indexed file count, binding rules |
| `ctx_context_build` | Minimum useful context for a task, plus a receipt |
| `ctx_search` | Search project memory; returns summaries with fetch costs |
| `ctx_get` | Fetch one memory in full |
| `ctx_decision_get` | Decisions already taken |
| `ctx_file_search` | Find indexed files by path |
| `ctx_file_get` | Read one file, confined to the project root |
| `ctx_history` | Recent commits |
| `ctx_memory_save` | Record a decision, constraint or bug |
| `ctx_memory_update` | Revise a memory, superseding the previous version |
| `ctx_task_get` | List open tasks, or fetch one with its subtasks |
| `ctx_task_update` | Move a task's status, priority or assignee |
| `ctx_checkpoint` | Record where the work stands |
| `ctx_handoff` | Everything another worker needs to continue; `accept` moves the work |

A tool is added only once the service behind it exists. The four work tools
above were withheld through Phase 5 for exactly that reason: a tool that cannot
do what its name promises is worse than no tool, because a worker would call
it, believe the result, and act on nothing.

## A worker cannot promote itself

`ctx_memory_save` refuses `explicit_user` and `project_rule` as sources. A
worker records its conclusions as `worker_statement`, which carries visible
confidence below 1 and sits near the bottom of the authority order.

The consequence matters: when a worker's finding contradicts something the
developer stated, the write is **refused** and the conflict is reported. The
worker is told to raise it with the developer rather than overwrite it. An AI
cannot quietly rewrite the rules it was given.

## Safety

- File reads are confined to the project root; `../../` is refused, not served.
- `ctx_file_search` escapes `LIKE` wildcards, so `%` matches a literal percent
  rather than every file.
- No tool executes shell commands. There is no arbitrary execution surface.
- A throwing tool returns an error to the caller rather than dropping the
  connection.

## Boundaries

The server serves one directory, fixed by `--dir` at startup.

Every tool takes an optional `dir` so a caller can name a package inside a
monorepo. It must resolve inside the served directory; anything else is refused.
Without that rule the parameter is a filesystem escape rather than a
convenience, because every path guard downstream confines reads relative to the
resolved root.

A worker may record memory only as `worker_statement` or `inferred`. See
[memory.md](memory.md).

There is no tool that runs a command, and the package contains no
process-spawning primitive at all — asserted by a test and a CI gate.
