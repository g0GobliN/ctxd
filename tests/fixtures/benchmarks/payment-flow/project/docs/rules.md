---
priority: P0
---

# Project rules

These rules are binding.

1. Payment must be taken before an order is recorded. An order with no charge
   ships goods; a charge with no order can be reconciled.
2. Only `src/payment` may talk to the payment provider.
3. Money is integer cents. Never a float.
4. Only `src/platform` may open database connections.
