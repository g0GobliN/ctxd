---
priority: P0
---

# Project rules

These rules are binding. A change that violates one is wrong even if the tests
pass.

1. A duplicate Stripe event must never create a second Payment record.
2. Only `src/stripe` may import the Stripe SDK.
3. Only `src/platform` may open database connections.
4. The frontend must not access the database directly.
5. Webhook handlers must be idempotent and must not block on external calls.
6. Secrets are read from configuration, never hard-coded and never logged.
