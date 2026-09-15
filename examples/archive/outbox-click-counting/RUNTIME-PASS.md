# Runtime pass — outbox click counting

<!-- Example placeholder: in a real archive this is the closed runtime pass, walked by the owner. -->

Walked 2026-09-05 by the owner. One entry per behaviour, three lines each, in the shape Part 7 of
the standard gives: the goal in product terms, where to look, and what the right answer is —
including the fixture, as a query rather than an id that will rot.

- **Goal:** a click is counted without slowing the redirect.
  **Where:** `curl -I https://leaflet.sh/<code>` for any live code, then that link's row on the
  dashboard after the next sweep.
  **What the right answer is:** the 301 returns before any counter write (`internal/redirect/
  handler.go:44` makes one read and no write), and `SELECT count(*) FROM click_outbox` drops to
  zero once the sweep has run. Walked 2026-09-05: 301 in 11 ms, outbox drained on the next run.
