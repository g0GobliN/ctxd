---
priority: P0
type: MEMORY
---

# Duplicate payments incident

A Stripe retry storm in March created 42 duplicate Payment rows because the
webhook handler checked for an existing payment without holding a reservation.
The fix was the unique index on `idempotency_keys.key` plus the reserve/complete
protocol. Do not replace the reservation with a plain SELECT-then-INSERT.
