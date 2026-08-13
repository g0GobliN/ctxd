---
priority: P1
type: MEMORY
---

# Decision #31 — charge before recording the order

Question: should the order row be written before or after the charge?

Decision: after.

Reason: a declined charge must not leave a recorded order. The reverse failure —
a charge with no order — is recoverable by reconciliation.

Status: ACTIVE.
