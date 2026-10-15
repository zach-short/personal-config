# 1. Give the click sweep backpressure

*Opened 2026-09-05, when the sweep shipped with no backpressure (`internal/clicks/sweep.go`).*

**Model: Default. Lane A. Waits on nothing.**

You are picking up leaflet, a Go + TypeScript link shortener. Read `HANDOFF.md` first — the
gates, the invariants and the code map are there, and one gate lies; do not re-derive them —
then `docs/AGENT-PRACTICES.md` in full, then `internal/clicks/`.

Session rules, inline: absolute dates only. Every claim carries a `file:line` or the command
that produced it. Grep before recording an absence. Ask the owner in chat, in one batch, in the
same turn, before building anything that depends on an answer. Never run `git commit` or
`git push` — print the two blocks instead.

**Why this exists.** Clicks are counted through an outbox: a redirect writes a row and returns,
and a sweep aggregates. That keeps the redirect fast, which is the whole point. But the sweep
has no notion of falling behind — if it does, the outbox grows without limit and the first
symptom is a full disk, not a slow dashboard.

**What is fixed.** Read these before changing anything; do not relitigate them.

- **Clicks are counted asynchronously** — settled 2026-09-05, `HANDOFF.md`. The redirect must
  never wait on a counter write.
- **The redirect path makes exactly one database read** (`internal/redirect/handler.go:44`).
  Nothing you add may make it two.
- **SQL exists only in `internal/repository/`** — verified by grep 2026-09-12.
- **Migration numbers are claimed by reading `migrations/`.** `0014` exists twice, so the file
  count is not the highest number. Read names.

Do these, in order:

1. **Measure before changing.** Record the current outbox depth and the sweep's per-run
   duration, with the queries that produced them. A fix with no baseline cannot be shown to work.
2. **Add a depth metric and a threshold.** The threshold is a dial, not a constant hardcoded
   twice — put it in config with a recommended default and say what it is.
3. **Decide what happens at the threshold**, and bring it to the owner (below) rather than
   picking. Whatever it is, the redirect stays at one read.
4. **Record it.** Write this file's close-out section, add one log line to `HANDOFF.md`, and mark
   the row `DONE - <date>`. Name what changed, why, and what is now fixed. Add any new file to the
   code map.

**Ask before building:** at the threshold, does the outbox **drop** the oldest rows, **sample**
one in N, or **block** the write and let the redirect proceed uncounted? Dropping loses data
silently; sampling makes every count an estimate and the dashboard must say so; blocking is the
only one that keeps counts exact, and it is the one that admits clicks can go uncounted. This is
the owner's call, and the answer may be "none of these, leave it and alert instead."

**Not in scope, whoever asks:** the dashboard's rendering of counts; the rate limiter; anything
in `internal/redirect/`.

**Hand back:** `go build ./...`, `go test -race ./...` and `golangci-lint run`, all green, with
output quoted. A runtime entry: seed 10,000 outbox rows with the query given, run the sweep,
and say what the depth metric reported before and after. Then `git status --short` and the two
commit blocks.
