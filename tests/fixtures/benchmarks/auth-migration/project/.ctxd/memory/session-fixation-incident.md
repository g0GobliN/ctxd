---
priority: P1
type: MEMORY
---

# Session fixation incident, March

A session identifier was accepted from a query parameter as well as a
cookie, so a crafted link logged a victim into the attacker's session.

Fix: identifiers are read from the cookie only, and a new identifier is issued
on every privilege change. The JWT migration must not reintroduce credential
acceptance from the URL.
