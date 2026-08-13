---
priority: P1
type: MEMORY
---

# Decision #58 — access token lifetime

Question: how long should a JWT access token live?

Decision: 15 minutes, with a refresh token rotating on each use.

Reason: tokens cannot be revoked. A long lifetime converts a single stolen
token into a long-lived compromise.

Status: ACTIVE.
