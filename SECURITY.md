# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/g0GobliN/ctxd/security/advisories/new).

Please include:

- what an attacker can do, and what they need to start (local user? a malicious
  repository? a connected AI worker?)
- steps to reproduce, ideally a minimal repository or command
- the ctxd version or commit, your OS and Node version

You will get an acknowledgement within **7 days** and an assessment within
**14 days**. If a fix is warranted we will agree a disclosure timeline with you
and credit you in the release notes unless you prefer otherwise.

ctxd is a small volunteer project with no bug bounty. What we can offer is a
prompt, honest response.

## What ctxd is designed to protect

ctxd is local-first. There is no server, no account and no cloud component, so
the threat model is not "someone attacks our service". It is:

**1. Secrets must not leak into a model's context.**

`.env` files, key material and anything under `secrets/` or `private/` are
never indexed. `.gitignore` and `.ctxdignore` are honoured. Logging passes
every field through redaction, so an API key cannot reach a log file even if
something upstream collected it by mistake.

*A bug here — any path by which a secret reaches a context, a receipt or a log
— is a genuine vulnerability. Please report it.*

**2. Path confinement.**

File reads through progressive retrieval and MCP are confined to the project
root. `../../` is refused, not served. Progressive retrieval must never become
an arbitrary file-read primitive for a connected agent.

**3. No arbitrary execution.**

No MCP tool executes shell commands. ctxd reads Git; it never writes to a
repository and never runs code on a worker's behalf.

**4. An AI worker cannot rewrite your rules.**

Worker-supplied memory is recorded as `worker_statement` and cannot claim
`explicit_user` or `project_rule` authority. A worker's conclusion that
contradicts something you stated is refused, and the conflict reported. A path
that lets an agent silently overwrite a higher-authority memory is a security
issue, not merely a bug.

**5. Local network surface.**

The future HTTP API binds to `127.0.0.1` only, never `0.0.0.0` by default.

## What is out of scope

- **A malicious repository you deliberately point ctxd at.** ctxd reads files;
  it does not sandbox them. Do not index a repository you would not open in
  your editor.
- **Another local user on your machine.** `~/.ctxd` is created `0700` and files
  `0600`, but ctxd does not defend against an attacker who already has your
  user account.
- **What you choose to send to a model.** ctxd reduces and explains context; it
  cannot know that a file you asked for is sensitive. Read the receipt.
- **Third-party AI providers.** What a worker does with the context it receives
  is between you and that provider.

## Supported versions

ctxd is pre-1.0. Only the latest `main` receives fixes. Once released versions
exist, this section will list them.

## Hardening notes

- `~/.ctxd` is created with mode `0700`; config, receipts and memory files with
  `0600`.
- Configuration must never contain secrets, and ctxd never writes one there.
- Token counts, receipts and logs are local files. They may contain excerpts of
  your source, so treat `~/.ctxd` as sensitive as the repositories it indexes.
