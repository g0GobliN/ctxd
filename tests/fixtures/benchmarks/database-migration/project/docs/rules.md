---
priority: P0
---

# Project rules

These rules are binding.

1. A migration must never expand and contract in the same step.
2. Migrations are append-only. Never edit one that has already run.
3. Every migration runs inside a transaction.
4. Only `src/platform` and `src/database` may open database connections.
