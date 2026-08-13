---
priority: P1
---

# Migration policy

Every schema change ships as three migrations, not one:

1. **Expand** — add the new shape, leave the old one in place.
2. **Backfill** — populate the new shape for existing rows.
3. **Contract** — drop the old shape, only once every reader has shipped.

A migration that expands and contracts in one step breaks any process still
running the previous release, which during a rolling deploy is all of them.

Migrations are append-only. Never edit one that has run anywhere.
