# Runtime pass: one file per board item

Each entry names where to look and what the right answer is (`docs/AGENT-PRACTICES.md` Part 7).
Zach walks them; a walked entry gets the date and what was seen. Phases 1 to 7 closed without a
runtime-pass file, so Phase 8 (board item 94) wrote every phase's entries here on 2026-10-16, after
this repo had run on the 2.0.0 shape for a day. An entry marked "seen by the agent" was checked
from a session, with the command named; nothing here was walked by Zach yet.

## Phase 1. The item reader and doc kinds (HANDOFF 108, board row 87)

1. **The archive's item folder does not read as uncited.**
   - *Where.* This repo: `bun run src/cli.ts doctor . ~/Projects/archive/personal-config`.
   - *Right answer.* No finding names `passoff`. The archive root reports one finding,
     `worktree-drafts-2026-10-04/` with no index line, which is older than this effort: the
     archive's git history (`git log -p -- personal-config/INDEX.md`, three commits) never held a
     line for it. **Seen by the agent 2026-10-16.**

## Phase 2. Readers and rules onto items (HANDOFF 109, board row 88)

2. **`passoff next` reads the item from its file.**
   - *Where.* This repo: `bun run src/cli.ts passoff next`.
   - *Right answer.* It prints item 94's title, model, lane, "Waits on" and "Files it owns", then
     the prompt from `passoff/94-migrate-this-repo-to-2-0-0-and-walk-the-runtime.md`.
     **Seen by the agent 2026-10-16** (the first four lines).

3. **`passoff claim` writes both files.**
   - *Where.* A scratch copy of this repo, never the live board: `bun run src/cli.ts passoff
     claim <n>` on an `OPEN` row.
   - *Right answer.* The row's status cell reads `IN FLIGHT` with the date, and the item file
     gains the claim note under its `# <n>.` line. Not walked: it writes the board.

## Phase 3. Removal and the two new folds (HANDOFF 112, board row 89)

4. **A fold moves closed item files to the archive.**
   - *Where.* `~/Projects/archive/personal-config/passoff/` and the archive's `INDEX.md`.
   - *Right answer.* Ten item files (86, 95 to 100, 102 to 104), each with a `## Close-out`
     section and one index line, committed in the archive as `28f8833` and `33914d6`. None of the
     ten is left in this repo's `passoff/`. **Seen by the agent 2026-10-16.**

5. **`undo` after a fold brings the item file back.**
   - *Where.* A scratch copy of a migrated repo: `fold`, then `personal-config undo`.
   - *Right answer.* `diff -r` of the live `passoff/` before and after is empty. Proved on a
     fixture in Phase 3; not walked on a real repo.

## Phase 4. `fold migrate` (HANDOFF 114, board row 90)

6. **The migration of this repo lost no text.**
   - *Where.* The backup the run took, `~/.config/personal-config/backups/2026-10-15T19-14-43-001/`,
     against `~/Projects/archive/personal-config/HANDOFF-log.md`, `PASSOFF-closed.md`, both
     `passoff/` folders and the live `HANDOFF.md`.
   - *Right answer.* All 117 step lines of the old ledger are in the archive log. Every line of
     the old board's 17 numbered sections is in an item file or in `PASSOFF-closed.md`. The live
     ledger keeps every standing section, `## Style rules` included, with `## Log` in place of
     `## Step log`. **Seen by the agent 2026-10-16.**

## Phase 5. Templates, render and the banner (HANDOFF 115, board row 91)

7. **The banner names the item file.**
   - *Where.* The first lines of a new session in this repo.
   - *Right answer.* `Next open: 94 · ... · passoff/94-migrate-this-repo-to-2-0-0-and-walk-the-runtime.md`.
     **Seen by the agent 2026-10-16**, at the start of item 94's session.

## Phase 6. The six skill texts (HANDOFF 116, board row 92)

8. **A close-out writes the item file and one log line.**
   - *Where.* The ten archived item files of entry 4, and `HANDOFF.md`'s `## Log`.
   - *Right answer.* Each file ends with a `## Close-out` section, and the log has one
     `closed item <n>` line for each, with no numbered step after 117. **Seen by the agent
     2026-10-16.**

## Phase 7. Standard 2.0.0 and the examples (HANDOFF 117, board row 93)

9. **This repo's adapted standard is at 2.0.0.**
   - *Where.* Line 1 of `docs/AGENT-PRACTICES.md`.
   - *Right answer.* The stamp ends `standard v2.0.0 · adapted`. **Seen by the agent 2026-10-16.**

10. **`upgrade` tells a 1.x repo to re-adapt.**
    - *Where.* Any repo still on 1.x, for example `~/Projects/felto`: `personal-config upgrade`.
    - *Right answer.* The 2.0.0 changelog entry, saying re-adapting is required and why. Not
      walked.

## Phase 8. This repo migrated (board item 94)

11. **The `setup` re-run kept the migration's config.**
    - *Where.* `.personal-config.json` in this repo, against the backup the run took,
      `~/.config/personal-config/backups/2026-10-16T15-14-01-000/`.
    - *Right answer.* `itemsDir` and `ledgerFrozenAt: 117` are kept, and so is `archiveHome`.
      **Seen by the agent 2026-10-16: wrong.** The run used the `starter` profile, not `zach`, and
      wrote `archiveHome: ""`. Since then `bun run src/cli.ts fold --dry-run` refuses with "no
      archive home recorded", so `/close-out` and `/clean-up` cannot fold an item here, and
      `board-status` cannot check a `DONE - <date>` row against the archive. The same run wrote
      the mechanical model as `Sonnet 5,5` into this config, the global answers in
      `~/.config/personal-config/config.json`, `docs/AGENT-PRACTICES.md` and three installed
      skills (`delegate`, `audit`, `autopilot`). The adapted standard records it as typed at
      GATE 0. On Zach's yes the same day, `archiveHome` was set back by hand to
      `~/Projects/archive/personal-config`, and `fold --dry-run` runs again. The model names,
      with the Default tier corrected to `Opus 5.5` too, are board item 106.

12. **A session starts with less to read.**
    - *Where.* Part 5's measure over this project's transcripts, and `wc -c` on the ledger and
       board.
    - *Right answer.* The fixed load at a session's first message is unchanged: a median of 80,876
      tokens over 16 sessions before the migration and 79,830 over 12 after it. Item 94's session
      began at 80,864, and item 90's, the closest earlier session opened the same way, at 80,865.
      The ledger and board are read by tool calls after that point, so the change shows in what a
      session reads: 171,033 characters before (`HANDOFF.md` 90,832, `PASSOFF.md` 80,201), about
      42,800 tokens, and 72,494 after (`HANDOFF.md` 32,344, `PASSOFF.md` 37,857, one item file
      2,293), about 18,100. No session ran on 2026-10-14, the day the plan names, so the earlier
      figures are from 2026-10-15 before 19:14 UTC. **Seen by the agent 2026-10-16.**
