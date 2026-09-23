<!-- personal-config v0.5.0 · 2026-09-23 · config 11fe5083 · standard v1.2.0 · adapted -->
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

A `DONE` item's prompt is folded out to the archive at close-out; its row stays here forever,
with its pointer at the ledger step. `SUPERSEDED` and `SETTLED AS NO` keep their sections —
the replacement and the reason are written nowhere else. `personal-config fold board` does it.
Item 6 is folded: its row points at HANDOFF 4, and its prompt no longer lives here.

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

**Model: Default. Lane B. Waits on nothing.** Lane A has item 1 in the primary checkout, so
take a worktree: `git worktree add .claude/worktrees/item-2 main`, then `bun install --cwd web`
inside it before believing any gate.

You are picking up leaflet, a Go + TypeScript link shortener. Read `HANDOFF.md` first — the
gates, the invariants and the code map are there; do not re-derive them — then
`docs/AGENT-PRACTICES.md` in full, then `internal/shortcode/` and `web/app/new/`.

Session rules, inline: absolute dates only. Every claim carries a `file:line` or the command
that produced it. Grep before recording an absence. Ask the owner in chat, in one batch, in the
same turn, before building anything that depends on an answer. Never run `git commit` or
`git push` — print the two blocks instead.

**Why this exists.** Every code is random, which is right for links nobody has to remember — but
the owner wants `leaflet.sh/docs` and `leaflet.sh/hiring` to be theirs to set. A custom code is a
small feature with one sharp edge: a user who claims `api`, `admin` or `login` has taken a path
the app may need later, and a code printed on a flyer cannot be reassigned.

**What is fixed.** Read these before changing anything; do not relitigate them.

- **Random codes are the default and stay the default** — settled 2026-08-30, `HANDOFF.md`. A
  custom code is opt-in on the new-link form, never inferred.
- **Codes are 7 characters from a 58-character alphabet** (`internal/shortcode/generate.go:31`).
  A custom code may be longer, never shorter than 4, and only from the same alphabet.
- **The redirect path makes exactly one database read** (`internal/redirect/handler.go:44`).
  Custom codes live in the same column and the same index, so it stays one.
- **`web/lib/api.ts` is the only typed client.** The form talks to the API through it and
  nowhere else.

Do these, in order:

1. **Write the reserved list as data, not code.** One file, `internal/shortcode/reserved.go`,
   holding the words with a one-line reason each; the check reads the list. Seed it from the
   routes the API and the dashboard already serve (`grep -rn HandleFunc cmd/` and `ls web/app/`),
   so a live path can never be claimed.
2. **Validate in one place.** `internal/shortcode/` gains `ValidateCustom(code string) error`,
   and both the API handler and the form call it — the form for a fast message, the API because
   the form is not the only client.
3. **The form.** One optional field on `web/app/new/`, with loading, error and empty states
   through the shared component (`docs/conventions-typescript.md`, `D2`). The three messages it
   can show are the owner's to word (below).
4. **Record it.** Append the next free ledger step — read `HANDOFF.md` for the number. Name what
   changed, why, and what is now fixed. Add `reserved.go` to the code map.

**Ask before building:** the three messages a user sees when a code is taken, reserved, or
malformed — offer plain, warm and terse variants of each rather than picking. And whether the
owner may claim a reserved word themselves, which is a real question: `docs` is reserved
precisely so that the owner can have it.

**Not in scope, whoever asks:** editing a code after creation; anything in `internal/redirect/`;
the click sweep (item 1, Lane A).

**Hand back:** `go build ./...`, `go test -race ./...`, `golangci-lint run` and
`bun run --cwd web typecheck`, all green, with output quoted — and the web test count, not its
exit code (`HANDOFF.md`, gates that lie). A runtime entry: open `/new`, submit the code `docs`,
and say what the form showed. Then `git status --short` and the two commit blocks.

---

### 3. Dashboard tests

*Opened 2026-09-08, out of HANDOFF 4 — the web test glob had been passing having run nothing.*

**Model: Mechanical. Lane B. Waits on item 2**, which changes the new-link form this would test.
`HELD` until item 2 is `DONE` — writing these first means writing them twice. Same worktree as
item 2 once it lands, or a fresh one from `main`.

You are picking up leaflet, a Go + TypeScript link shortener. Read `HANDOFF.md` first — the
gates are there, and the web test gate is the one that lied — then `docs/AGENT-PRACTICES.md` in
full, then `docs/conventions-typescript.md`, then `web/app/`.

Session rules, inline: absolute dates only. Every claim carries a `file:line` or the command
that produced it. Grep before recording an absence. Never run `git commit` or `git push` — print
the two blocks instead. This is Mechanical-tier work: if a test fails for a reason you cannot
name in one sentence, stop and hand back rather than debugging into it.

**Why this exists.** From 2026-09-02 to 2026-09-08 the web test command exited 0 having run
nothing (`HANDOFF.md`, step 4). Fixing the glob turned up two real failures in the shared lib
and showed that the dashboard screens themselves have no tests — every one is checked by a
person opening it.

**What is fixed.** Read these before changing anything; do not relitigate them.

- **Tests are pure logic in a new file named for the feature** (`docs/conventions-typescript.md`,
  `X1`). No existing test file is appended to; each screen gets its own.
- **Every screen renders loading, error and empty through one component** (`D2`). That contract
  is what to test, not the pixels.
- **`web/lib/api.ts` is the only typed client**, so it is the only thing to mock.

Do these, in order:

1. **List the screens first**, with the states each can be in, as a table in your notes. That
   table is the work-list, and it is what you report against.
2. **One file per screen**, `web/app/<screen>/<screen>.test.tsx`, asserting the three states and
   the one happy path. Mock the client, never the network.
3. **Prove the gate sees them.** Run `bun run --cwd web test` and quote the test count; a count
   that did not go up means the glob still misses them.
4. **Record it.** Append the next free ledger step — read `HANDOFF.md` for the number — and
   close the "dashboard has no tests" line that steps 1 and 4 left owed.

**Ask before building:** nothing — the shape is settled by the conventions file. If a screen does
not fit the shared states component, stop and raise it; do not test around it.

**Not in scope, whoever asks:** fixing what the tests find — each finding becomes a new board
item with its citation; changing `web/lib/api.ts`; visual or snapshot testing.

**Hand back:** `bun run --cwd web typecheck` and `bun run --cwd web test`, green, with the test
count quoted before and after. No runtime entry — nothing here is user-visible. Then
`git status --short` and the two commit blocks.

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
