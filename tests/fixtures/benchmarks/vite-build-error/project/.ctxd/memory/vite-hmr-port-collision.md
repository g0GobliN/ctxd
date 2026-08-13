---
priority: P1
type: MEMORY
---

# BUG #91 — Vite HMR port collision

Problem: hot reload updated the wrong application, and the dev build
sometimes failed outright with an address-in-use error.

Cause: multiple applications used the default Vite port. Without
`strictPort`, Vite silently fell back to the next free port, so the HMR client
connected to whichever server had claimed the expected one.

Fix: dedicated ports per application with `strictPort: true`, recorded in
docs/ports.md.

Status: RESOLVED. A recurrence means someone added an app without claiming a
port.
