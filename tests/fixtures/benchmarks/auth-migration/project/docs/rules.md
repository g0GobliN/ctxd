---
priority: P0
---

# Project rules

These rules are binding. A change that violates one is wrong even if the
tests pass.

1. Access tokens must never live longer than 15 minutes.
2. Only `src/auth` may verify credentials.
3. Only `src/platform` may open database connections.
4. Password hashes must never be logged, returned by an API, or copied into a
   token claim.
5. A signature comparison must be timing-safe.
