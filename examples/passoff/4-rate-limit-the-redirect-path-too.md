# 4. Rate-limit the redirect path too

*Opened 2026-09-06.* **`SETTLED AS NO`, 2026-09-08.**

The redirect path makes exactly one database read and no write; a rate limiter would add a
lookup to the hottest path in the system to defend against traffic the system is designed to
absorb. The API's existing limiter (`internal/middleware/ratelimit.go:18`) covers link
*creation*, which is the expensive side. Revisit only if redirect volume itself becomes a cost.

Its row stays on the board and this file keeps the reason, so it is not re-proposed.
