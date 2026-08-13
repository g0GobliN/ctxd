---
priority: P1
type: MEMORY
---

# BUG #57 — popups clip inside scrolling containers

Problem: the select menu clipped inside the settings panel, exactly as the
date picker now does in the booking form.

Cause: absolute positioning inside an ancestor with overflow. The ancestor
establishes a new containing block, so the offsets are measured against the
wrong element.

Fix: the select menu was portalled to the document body and positioned against
the viewport. The date picker was never migrated.

Status: RESOLVED for the select menu only.
