<!-- personal-config v0.8.0 · 2026-10-15 · config 11fe5083 · standard v2.0.0 · adapted -->
# PASSOFF: leaflet (the board)

**What is next.** One row per item; each item's standalone prompt is its own file in
`passoff/`. What is true lives in `HANDOFF.md`. **Check "Files it owns" against every open item
before starting one**: two items naming the same file never run at the same time, whatever their
lanes say.

> **This is an example.** `leaflet` is a fictional repo. Copy the shape, not the facts.

Status vocabulary, and no other words: `OPEN` · `IN FLIGHT` · `DONE - <date>` · `HELD` ·
`SETTLED AS NO` · `SUPERSEDED`. `DONE` names the day the item closed; the record is the close-out
section of its item file. `HELD` always names what it waits on. `SUPERSEDED` always names what
replaced it, and `SETTLED AS NO` always carries its reason, in the item file, because its whole
job is to not be re-proposed. Every cell is one line.

Lanes run in parallel, each in its own worktree; items inside a lane run in order.

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 1 | Give the click sweep backpressure | `OPEN` | Default | A | - | `internal/clicks/sweep.go`, `migrations/` |
| 2 | Custom short codes, reserved-word list | `OPEN` | Default | B | - | `internal/shortcode/`, `web/app/new/` |
| 3 | Dashboard tests | `HELD` | Mechanical | B | item 2, which changes the form | `web/app/**/*.test.tsx` |
| 4 | Rate-limit the redirect path too | `SETTLED AS NO` | - | - | - | - |
| 5 | Short codes from the row id | `SUPERSEDED` | - | - | - | - |

Each item's prompt is `passoff/<n>-<slug>.md`, named once when the row is added. A `DONE` item's
file moves to the archive at the next fold, and its row leaves this table with it; the archive
index line keeps what the row said, and its number is never reused. `personal-config fold board`
does it. Item 6 is folded: its file and its index line are in the archive, so the next free
number is 7.
