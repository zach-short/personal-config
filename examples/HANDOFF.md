<!-- personal-config v0.5.0 · 2026-09-23 · config 11fe5083 · standard v1.2.0 · adapted -->
# HANDOFF — leaflet (the ledger)

**What is true.** Read first, every session. Append-only in the step log; standing sections are
edited in place when they go stale. Started 2026-08-30.

> **This is an example.** `leaflet` is a fictional repo — a small Go + TypeScript link-shortener
> — written to show what a filled ledger looks like after a few weeks. Copy the shape, not the
> facts.

## Orientation

leaflet turns long URLs into short ones and counts the clicks. A Go API over Postgres, a small
Next.js dashboard, deployed by pushing to `main`. One person decides everything here, and **they
are interactive** — when a decision is theirs, ask in chat, in the same turn, batched.

Read in this order: this file → `PASSOFF.md` (what is next) → `docs/AGENT-PRACTICES.md` (the
working standard) → `CLAUDE.md` (the router every session gets).

## Environment

Every command below was run before it was written down.

| Fact | Value | Source (verified 2026-09-12) |
|---|---|---|
| Go | 1.23.4 | `go version` |
| Bun | 1.2.9 | `bun --version` |
| Build | `go build ./... && bun run --cwd web build` | both run 2026-09-12, exit 0 |
| Test | `go test -race ./...` — 84 tests, 11 packages, 6.2s | run 2026-09-12, exit 0 |
| Lint | `golangci-lint run` — 0 issues at ratchet | run 2026-09-12, exit 0 |
| Typecheck | `bun run --cwd web typecheck` — 0 errors | run 2026-09-12, exit 0 |
| CI | `.github/workflows/ci.yml`: build, test, lint, typecheck | read 2026-09-12 |
| Migrations | `migrations/`, highest name `0019_click_index.sql` | `ls migrations` 2026-09-12 |

**Gates that lie.** `bun run --cwd web test` prints `ok` and exits 0 when no test files match
its glob — it did exactly that from 2026-09-02 until the glob was fixed in HANDOFF 4. Check the
test count, not the exit code.

**What an agent cannot verify here.** Whether a redirect actually redirects in a browser —
`curl -I` proves the 301 and the `Location` header, and that is as far as it goes. Every session
ends by naming the URL to open and what should appear, and waits.

## Settled

### 2026-08-30 — short codes are opaque, not sequential

Codes are 7 characters from a 58-character alphabet, generated randomly and checked for
collision, **not** base-58 of the row id. Sequential codes leak how many links exist and let
anyone enumerate every link in the system. Collisions are handled by retrying, capped at five
attempts (`internal/shortcode/generate.go:31`).

### 2026-09-05 — clicks are counted asynchronously

A redirect writes to an outbox table and returns; a sweep aggregates. A redirect must never wait
on a write to the counter — the counter is the least important thing on that path.

## Code map

- `cmd/api/main.go` — composition root; every dependency is wired explicitly here.
- `internal/shortcode/` — code generation and collision retry. Pure; fully tested.
- `internal/repository/` — every SQL statement in the codebase. Nothing else runs SQL.
- `internal/redirect/` — the hot path: lookup, outbox write, 301.
- `web/app/` — Next.js dashboard. `web/lib/api.ts` is the only typed client.
- `migrations/` — numbered, forward-only.

## Invariants

- **The redirect path makes exactly one database read.** A second query here is a latency
  regression that no gate will catch (`internal/redirect/handler.go:44`).
- **SQL exists only in `internal/repository/`.** Verified 2026-09-12:
  `grep -rn "SELECT\|INSERT" --include=*.go . | grep -v internal/repository/ | grep -v _test.go`
  returns nothing.
- **Migration numbers are claimed by reading `migrations/`, never from a number in a doc** —
  including this one.

## Known facts and quirks

- **`0014` exists twice on disk** (`0014_clicks.sql`, `0014_clicks_fix.sql`), so the file count
  is not the highest number. Read names, not counts.
- **A dev server already on :8080 is reused by the test runner**, which then tests the previous
  build. Kill any hand-started server before running `go test`.
- **`docs/README.md` claimed there was no rate limiting. That was wrong** — it has been live at
  `internal/middleware/ratelimit.go:18` since `a3f19c2` (2026-08-22). Corrected 2026-09-08; the
  wrong line is left in place marked wrong, per the standard's R5.

## Step log

Numbered, append-only. **Take the next free number by reading this file.** Do not edit a step
you did not write; append a correction as a new step.

Old steps are folded out to the archive and keep their number, title and date as one line
(`personal-config fold ledger`). A step is addressable forever — "step 4" is how everything
refers to that work — so the line stays even when the body goes. Standing sections above are
never folded; they are edited in place.

**1. Opened the ledger and the board.** Done 2026-08-30, on `main`. Ran every gate once and
recorded the real output above. Settled the short-code decision with the owner.
**Left owed:** no CI yet; the dashboard has no tests.

**2. Short-code generation, with collision retry.** Done 2026-09-01, on `main`.
`internal/shortcode/` plus 22 tests. Five-attempt cap chosen because a sixth collision at
current volume implies a bug, not bad luck. **Left owed:** nothing.

**3. Redirects and the click outbox.** Done 2026-09-05, on `main`. One read on the hot path;
counting moved to a sweep. Answered "do we count before or after the redirect" — after, and
asynchronously. **Left owed:** the sweep has no backpressure if it falls behind.

**4. CI, and the test glob that lied.** Done 2026-09-08, on `main`. Added
`.github/workflows/ci.yml`. Found the web test command exiting 0 having run nothing since
2026-09-02; fixed the glob, which turned up two genuinely failing tests. **Left owed:** the
dashboard still has no tests of its own — only the shared lib does.

**5. Corrected the rate-limiting claim.** Done 2026-09-12, Mechanical tier, on `main`. A doc
said rate limiting did not exist; a grep found it live since 2026-08-22. Recorded the disproof
beside the wrong claim rather than deleting it. **Left owed:** nothing.

## Style rules

The code standard is `docs/conventions-go.md` and `docs/conventions-typescript.md`, and **the
file extension decides which applies**. Where a formatter or linter settles something — gofmt,
golangci-lint, Biome — the config is the rule and this section says nothing.
