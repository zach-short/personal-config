# PASSOFF: {{PROJECT_NAME}} (the board)

**What is next.** One row per item; each item's standalone prompt is its own file in
`{{ITEMS_DIR}}/`. What is true lives in `{{LEDGER_FILE}}`. **Check "Files it owns" against every
open item before starting one**: two items naming the same file never run at the same time,
whatever their lanes say.

Status vocabulary, and no other words: `OPEN` · `IN FLIGHT` · `DONE, <date>` ·
`COMMITTED, <date>, <short hash>` · `HELD` · `SETTLED AS NO` · `SUPERSEDED`. `DONE` names the day
the item closed; the record is the close-out section of its item file, and the code is not in a
commit yet. `COMMITTED` adds the short hash once the commit exists. `HELD` always names
what it waits on. `SUPERSEDED` always names what replaced it, and `SETTLED AS NO` always carries
its reason, in the item file, because its whole job is to not be re-proposed. Every cell is one
line.

Lanes run in parallel, each in its own worktree; items inside a lane run in order.

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 1 | <!-- first task --> | `OPEN` | {{MODEL_DEFAULT}} | A | - | - |

Each item's prompt is `{{ITEMS_DIR}}/<n>-<slug>.md`, named once when the row is added. A
`COMMITTED` item's file moves to the archive at the next fold, and its row leaves this table with
it; the archive index line keeps what the row said, and its number is never reused. A `DONE`
item's file stays until its commit exists. `personal-config fold board` does it.{{NO_GIT_FOLD}}
