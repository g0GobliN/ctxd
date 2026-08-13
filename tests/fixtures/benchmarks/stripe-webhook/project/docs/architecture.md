# Architecture

The service is a payment gateway in front of Stripe.

## Layers

- `src/payment` — webhook handling, idempotency, persistence
- `src/stripe` — the only module allowed to talk to the Stripe SDK
- `src/platform` — database, config, logging
- `src/camera`, `src/signage`, `src/kiosk` — unrelated store-hardware services

## Idempotency

Stripe retries webhook deliveries. Every webhook is processed under a
reservation held in `idempotency_keys`, keyed by the Stripe event id. A
duplicate delivery must return the original result rather than creating a
second Payment.

Concurrent deliveries of the same event resolve as: the first caller acquires
the reservation, later callers receive 409 and Stripe retries.

## Constraints

- No module outside `src/stripe` may import the Stripe SDK.
- No module outside `src/platform` may open a database connection.
- The frontend must never access the database directly.
