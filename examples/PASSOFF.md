<!-- personal-config v0.1.0 · 2026-09-15 · config e3a91f04 · standard v1.0.0 -->
# PASSOFF — leaflet (the board)

**What is next.** One row per item, one standalone prompt per item below the board. What is true
lives in `HANDOFF.md`. **Check "Files it owns" against every open item before starting one** —
two items naming the same file never run at the same time, whatever their lanes say.

> **This is an example.** `leaflet` is a fictional repo. Copy the shape, not the facts.

Status vocabulary, and no other words: `OPEN` · `IN FLIGHT` · `DONE — HANDOFF n` · `HELD` ·
`SETTLED AS NO` · `SUPERSEDED`. `DONE` always points at the ledger step that is the real record.
`HELD` always names what it waits on. `SUPERSEDED` always names what replaced it.
`SETTLED AS NO` always carries its reason, because its whole job is to not be re-proposed.

Lanes run in parallel, each in its own worktree; items inside a lane run in order.

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 1 | Give the click sweep backpressure | `OPEN` | Default | A | — | `internal/clicks/sweep.go`, `migrations/` |
| 2 | Custom short codes, reserved-word list | `OPEN` | Default | B | — | `internal/shortcode/`, `web/app/new/` |
| 3 | Dashboard tests | `HELD` | Mechanical | B | item 2 — it changes the form | `web/app/**/*.test.tsx` |
| 4 | Rate-limit the redirect path too | `SETTLED AS NO` | — | — | — | — |
| 5 | Short codes from the row id — superseded by the 2026-08-30 opaque-codes decision | `SUPERSEDED` | — | — | — | — |
| 6 | CI, and the web test glob | `DONE — HANDOFF 4` | Default | A | — | `.github/workflows/ci.yml` |

**Do not paste a prompt marked DONE** — a fresh session would build it again.

---

### 1. Give the click sweep backpressure

*Opened 2026-09-05, out of HANDOFF 3, which shipped the sweep and noted this as owed.*

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
4. **Record it.** Append the next free ledger step — read `HANDOFF.md` for the number. Name what
   changed, why, and what is now fixed. Add any new file to the code map.

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

---

### 2. Custom short codes, with a reserved-word list

*Opened 2026-09-10, out of the owner wanting `leaflet.sh/docs` to be theirs to set.*

**Model: Default. Lane B. Waits on nothing.**

<!-- A standalone prompt in the same nine-part shape as item 1: orientation and session rules
     inline, why it exists in product terms, what is fixed with citations, numbered steps each
     carrying its reason, the owner's calls, the negative list, and the hand-back. -->

---

### 3. Dashboard tests

*Opened 2026-09-08, out of HANDOFF 4 — the web test glob had been passing having run nothing.*

**Model: Mechanical. Lane B. Waits on item 2**, which changes the new-link form this would test.

<!-- Held until item 2 lands. Writing these first means writing them twice. -->

---

### 4. Rate-limit the redirect path too

*Opened 2026-09-06.* **`SETTLED AS NO`, 2026-09-08.**

The redirect path makes exactly one database read and no write; a rate limiter would add a
lookup to the hottest path in the system to defend against traffic the system is designed to
absorb. The API's existing limiter (`internal/middleware/ratelimit.go:18`) covers link
*creation*, which is the expensive side. Revisit only if redirect volume itself becomes a cost.

Kept on the board with its reason so it is not re-proposed.

---

### 5. Short codes derived from the row id

*Opened 2026-08-30.* **`SUPERSEDED` by the 2026-08-30 settled decision in `HANDOFF.md`**, which
replaced it with opaque random codes plus collision retry. Sequential codes leak how many links
exist and let anyone enumerate every link in the system.
