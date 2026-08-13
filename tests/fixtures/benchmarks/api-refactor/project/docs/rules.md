---
priority: P0
---

# Project rules

These rules are binding.

1. A handler must never talk to the database directly; it goes through a service.
2. Error status codes follow docs/api-conventions.md.
3. Only `src/platform` may open database connections.
