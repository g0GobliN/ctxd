---
priority: P1
type: MEMORY
---

# Decision #42 — idempotency keyed by Stripe event id

Question: what should the idempotency key be for webhook processing?
Decision: the Stripe event id, not the payment intent id.
Reason: one payment intent produces several events; keying on the intent would
collapse distinct events. Status: ACTIVE.
