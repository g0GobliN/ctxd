# Security model

ctxd's threat model is unusual: the software it protects you from is the
software you invited in. An AI worker has your repository, your shell and your
goodwill. Most of what follows is about limiting what that worker can reach and
making everything it does visible.

For reporting a vulnerability, see [SECURITY.md](../SECURITY.md).

## Local-first, by construction

No cloud, no accounts, no telemetry. ctxd makes no outbound network call — not
for analytics, not for updates, not for a model.

This is enforced, not promised: a CI gate fails the build if a network primitive
(`fetch`, `WebSocket`, `node:http`, `node:net`, …) appears in any local-first
package — context, core, db, memory, project, work, firewall, diff, verify,
stats or ai.

The only components that open a socket are the local API, which binds loopback,
and the MCP server, which speaks a protocol over stdio.

## Secrets are never collected

Refused at **collection** time and at **retrieval** time, so a secret cannot
reach the index, a receipt, a log or a worker:

- `.env` and every variant
- `*.pem`, `*.key`, `*.p12`
- anything under `secrets/` or `private/`
- everything `.gitignore` and `.ctxdignore` exclude

Matching is case-insensitive. Windows and macOS filesystems are themselves
case-insensitive, so `.ENV` and `.env` are the same file there, and matching
case-sensitively would collect a secret the user believes is ignored. The trade
is asymmetric: over-ignoring costs one file, under-ignoring leaks a credential
to a model.

Both gates matter, and for a while only the first existed. `ctx_file_get` — the
MCP tool a worker calls to read a file — confined reads to the project root but
applied no ignore rules. `.env`, `id_rsa` and everything under `secrets/` live
*inside* the root, so containment admitted them and returned their contents
verbatim. Collection had refused those files all along, which made "ctxd never
sends secrets to workers" true of the pipeline and false of the one path a
worker actually drives. Progressive retrieval now applies exactly the rules
collection applies, and refuses with a `SecretFileError`.

The golden benchmarks assert the collection half against fixtures that
**contain a real `.env`** — the assertion would prove nothing against a
repository with no secret in it. The retrieval half is asserted separately,
including that no partial content escapes.

Logs pass every field through `redactSecrets()` before writing, so a credential
collected by mistake upstream still cannot land in a log file.

## No arbitrary execution through MCP (§63)

A worker cannot make ctxd run a command. The MCP package contains no
process-spawning primitive, evaluates no code at runtime, exposes no tool naming
an execution capability, and does not depend on `@ctxd/verify`.

Asserted by a test **and** a CI gate, because a property like this stays true
only until someone adds a convenient tool.

Controlled execution does exist — for `ctxd verify` — behind the CLI:

| Category | Examples | Runs? |
|---|---|---|
| `READ_ONLY` | `git status`, `git diff`, `rg`, `ls` | Yes |
| `SAFE_MUTATING` | tests, typecheck, lint, build | Yes |
| `DANGEROUS` | `rm`, `git reset`, `git clean`, `git push`, deploys, credential tools | Only with explicit confirmation |

**An unrecognised command is refused, not assumed safe.** No shell is used: the
binary and its arguments are separate values, so a filename containing `;` or
`&` is a filename. Where Windows forces a shell — package managers ship `.cmd`
shims Node cannot spawn directly — any argument that could change the command's
meaning is refused rather than escaped.

## The local API (§62)

Binds `127.0.0.1`. Binding a public interface is refused unless explicitly
opted into.

Loopback alone is not enough: every process on the machine can reach it, and any
page you visit can try to. Three checks run on every request.

| Check | Stops |
|---|---|
| `Host` must be a loopback name | DNS rebinding — a name the attacker controls resolving to 127.0.0.1 |
| `Origin`, when present, must be loopback | A page on another site scripting the API |
| Token on mutating routes | Another local process changing your project memory |

The token is generated on demand, stored `0600` inside the `0700` data
directory, compared timing-safely, and never leaves the machine. Reads are open
to loopback callers so the interface works without a login; writes are not.

Request bodies are capped at 1 MB. Responses carry `X-Content-Type-Options:
nosniff` and `Cache-Control: no-store`.

Static assets carry a strict `Content-Security-Policy` (`default-src 'self'`, no
framing, no form submission). Every requested path is resolved and then checked
to be inside the asset root; traversal attempts, percent-encoded variants and
embedded NUL bytes are refused and reported as an ordinary 404, revealing
nothing about the disk.

## Git is read-only

ctxd never writes to a repository. No `add`, no `stash`, no index mutation, no
commit. Untracked files are read from disk rather than staged — a firewall that
modified the repository it inspects would be a worse problem than the one it
detects.

Git remains the source of truth for history.

## A worker cannot overwrite what you said

Memory carries a source, and source determines authority (§31):

```
explicit user instruction > project rule > accepted decision >
verified code state > verified Git history > worker statement > inferred
```

An agent's conclusion is stored as `worker_statement` with visible confidence.
If it contradicts a rule you stated, **the write is refused and the conflict
reported**. Inferred memory can never silently override an explicit rule.

Because authority decides which record survives a conflict, *who may claim what*
is the whole mechanism. Through MCP a worker may write only `worker_statement`
or `inferred` — the two sources describing its own epistemic position. Every
other source is refused: `explicit_user` and `project_rule` are the developer's
authority, `accepted_decision` means a team accepted it, and `verified_code` and
`verified_git` mean *ctxd* checked.

That gate was once narrower, refusing only the two developer sources. A worker
could write `accepted_decision` — which outranks `verified_code` — and supersede
a fact ctxd had verified, purely by saying so.

## The Diff Firewall never destroys work

It reports and classifies. It does not revert formatting, delete comments,
reject a change or rewrite a worker's files. A large diff is not wrong by
itself, and a tool that silently rewrote an agent's output would destroy work it
does not understand.

## Nothing is destroyed

Superseded memories are archived, not deleted. Compression affects only the
model-facing context. Raw sessions, agent output, snapshots, receipts and
original files are preserved.

## Honest reporting

Token counts are labelled **estimated**; ctxd has no billing data and never
reports a cost. An unavailable signal reads as unknown rather than being
invented — a worker ctxd has not seen is `unknown`, not `idle`, and a check that
did not run is never reported as passed.

## What ctxd does not defend against

- A worker that edits files directly. ctxd inspects changes *after* the fact;
  it is not a sandbox.
- A malicious local process running as you. It could read `~/.ctxd` directly.
- Secrets already committed to your repository. ctxd skips the usual locations,
  but a key pasted into a source file is source code as far as any tool can tell.
