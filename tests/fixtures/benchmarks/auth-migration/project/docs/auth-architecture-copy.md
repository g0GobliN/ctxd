---
priority: P3
---

# Authentication architecture

The API authenticates every request through `src/auth/middleware.ts`.

## Today

Opaque session identifiers stored in Postgres. Revocation is a row update, so
signing a user out is immediate and complete.

## Target

Short-lived JWT access tokens plus a long-lived refresh token. Access tokens
carry scopes so the API stops querying the user table on every request.

## The hard part

A JWT cannot be revoked before it expires. The migration therefore keeps the
access-token lifetime short (15 minutes) and holds a deny list of refresh
tokens. Anyone proposing a longer lifetime is re-opening a problem the session
store had already solved.

## Order of work

1. Issue both credentials.
2. Accept both in middleware.
3. Move clients to the token flow.
4. Delete the session path only when no client sends a cookie.

