---
priority: P1
type: MEMORY
---

# BUG #12 — migration 006 caused a deploy outage

Problem: dropping products.price in the same migration that added
price_cents took the checkout API down for eleven minutes.

Cause: the old release was still reading products.price during the rolling
deploy.

Fix: expand, backfill, contract — as three separate migrations. This is why
docs/migrations.md exists.

Status: RESOLVED.
