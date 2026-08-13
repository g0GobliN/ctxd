---
priority: P2
type: MEMORY
---

# Stripe API version is pinned

The adapter pins apiVersion 2024-06-20. Upgrading changes the webhook event
payload shape and requires re-testing the webhook handler.
