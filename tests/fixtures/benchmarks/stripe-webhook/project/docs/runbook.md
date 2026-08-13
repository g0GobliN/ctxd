# Runbook

## Stripe webhook backlog

Symptoms: rising `webhook_queue_depth`, Stripe dashboard shows retries.

1. Check `idempotency_keys` for rows stuck in `reserved`.
2. Expire stale reservations older than the retry window.
3. Confirm the signature secret matches the Stripe dashboard.

## Card terminal offline

Unrelated to the payment API; see the kiosk runbook.
