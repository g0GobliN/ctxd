---
priority: P1
---

# API conventions

Every handler follows the same contract:

- `400` for a malformed request, with the offending field named
- `404` when the entity does not exist
- `500` only for genuinely unexpected failures

The repetition across handlers is deliberate duplication, not an accident — it
was left in place until there were enough handlers to see the right shared
shape. There are five now.
