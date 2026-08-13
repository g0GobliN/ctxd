---
priority: P0
---

# Project rules

These rules are binding.

1. Every dev server must set `strictPort: true`. A silent port fallback is
   worse than a failure — it produces an app that appears to work while hot
   reload updates a different application.
2. Each application owns a dedicated port. Ports are recorded in
   docs/ports.md and must not be reused.
3. Build output goes to `dist`; nothing else may be committed.
