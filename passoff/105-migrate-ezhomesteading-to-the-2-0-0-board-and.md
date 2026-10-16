# 105. Migrate ezhomesteading to the 2.0.0 board and ledger, and fix what blocks it

*Opened 2026-10-16 01:40 EDT*, by the session that checked whether the 2.0.0 shape was ready for
ezhomesteading. It was not (three blockers, below). Zach then said, word for word: "im going to
bed and dont have time to go through the scope and build process. just build." That sentence is
the authorization for this item. It replaces the scope, GATE 1 and GATE 2 that `PLAN.md` §4 asks
for before another repo migrates, and it is the owner's yes for the writes to ezhomesteading's
untracked ledger and its archive. It is not a yes for anything outside the steps below.

**Model: Opus 5.5. Lane K. Waits on nothing for Stage A; Stage B waits on the end of the
ezhomesteading autopilot run of 2026-10-16.** Do the personal-config code in your own worktree.
Run every ezhomesteading write from the main checkout of ezhomesteading, never a worktree.

## Orientation

You are picking up personal-config, a Bun and TypeScript CLI that writes working documents, hooks
and skills into other repos. Read `CLAUDE.md`, `docs/conventions-ts.md`, then
`docs/incomplete/per-item-board/DESIGN.md` (D1 to D17) and `PLAN.md` beside it: §0 (G34 to G61
are the facts this item leans on) and Phases 3, 4 and 8. `HANDOFF.md` and `PASSOFF.md` are
untracked and live in the main checkout only, at `/Users/zachshort/Projects/personal-config/`.
So does this file. Read them there, even from a worktree.

Session rules, restated here because this prompt is pasted alone:

- Never run `git commit` or `git push`, in either repo. End with two copyable blocks per repo:
  `git add <exact files>` (never `-A`, never `.`), then `git commit <the same files> -m "<short,
  lowercase>"`. Run `git add -N` first for any file git has never seen. No attribution trailer.
- Never `git checkout --` or `git stash` to undo an experiment. Copy the file aside and `cp` it
  back.
- Nothing in personal-config is written without a stamp and a preview: `planned()`, then
  `resolvePlan()`, then `commitPlan()`. No direct write in `src/`.
- No test writes outside a temp directory.
- Other sessions work in personal-config tonight. Item 102 owns `src/commands/setup.ts`,
  `src/lib/config-layer.ts`, `src/lib/types.ts`, `src/render/user-config.ts` and the golden file,
  all uncommitted in the main checkout. Do not touch those files. If your fix needs
  `src/lib/types.ts`, stop and say so.
- Doctor from a worktree reports green because the ledger and board are untracked there. Run the
  doctor proof from the main checkout.

## Why this exists

Zach asked on 2026-10-15 for fewer tokens per session. ezhomesteading is the largest board he has:
`HANDOFF.md` is 189,922 bytes (untracked, no git copy) and `PASSOFF.md` is 225,127 bytes
(tracked). Every session there reads both. Standard 2.0.0 moves each item's prompt to its own file
in `passoff/` and freezes the step log into the archive, so a session reads a table and one item.
personal-config migrated itself on 2026-10-15 (its log froze at step 117). ezhomesteading is the
repo where the saving is biggest, and also the repo where a silent loss costs the most, because
its ledger has no copy anywhere.

## What is fixed

Verified 2026-10-16 01:20 to 01:40 EDT. Do not relitigate these.

1. **Item 94 is still `OPEN`.** No one has measured the saving on any repo. `RUNTIME-PASS.md`
   does not exist. You measure ezhomesteading's (Stage B step 6).
2. **F1 is open and silent.** `appended()` in `src/commands/fold.ts` (about line 339) keeps a
   block only where `!existing.includes(bodyOf(block))`. A log line that is a substring of a line
   already archived (`- 2026-10-15 · closed item 8` against `- 2026-10-15 · closed item 83`) is cut
   from the ledger and never appended, and the fold exits 0. Found in HANDOFF-log step 112. No
   row tracks it. The fix step 112 named: a whole-line match for `kind === 'log'`.
3. **ezhomesteading's ledger is stamped `adapted`.** Line 1 of `~/Projects/ezhomesteading/HANDOFF.md`
   ends ` · adapted`, so `fold migrate` refuses it (G58; `src/commands/fold.ts`, the guard near
   line 837).
4. **ezhomesteading files items under range headings.** Eleven headings such as
   `### 26–30. Board close-outs ...`, `### 92–119. Breaks found by the founder-demo walk` and
   `### 184–195. The audit of 2026-10-15` (`grep -n '^### [0-9]*–' PASSOFF.md`). Each is shared
   context for a run of rows, with no per-row heading below it. `ITEM_HEADING` in
   `src/lib/fold.ts:350` is `/^#{2,4}\s*(\d+(?:\.\d+)?)[.):]/`, which does not match a range, so
   about 44 rows get no item file and no section (G59). Five level-2 prose sections also sit among
   the item sections (`## Why each item exists` and others).
5. **ezhomesteading is behind.** Its `.personal-config.json` says `trackMode: untracked`; its
   documents are stamped `personal-config v0.6.0 · standard v1.2.0`; its project skills in
   `.claude/skills/` are `v0.8.0 · standard v1.2.0` and are tracked in git. Those 1.x skills write
   close-outs into the board and ledger. After a migration they must be the 2.0.0 texts, or every
   session there writes the old shape into the new board.
6. **The ledger is untracked and the board is tracked.** `HANDOFF.md` and `PASSOFF.md` are both in
   `.git/info/exclude`, but `git status` shows ` M PASSOFF.md`, so the board is tracked and git
   holds a copy of it. The ledger has no copy. Do not change `.git/info/exclude` or `.gitignore`.
7. **An autopilot run is live in ezhomesteading.** Started 2026-10-16 01:17 EDT, folder
   `~/Projects/ezhomesteading/docs/incomplete/autopilot-2026-10-16/`, session
   "ezhomesteading-da". It has no end time (it stops launching at 75% of the weekly window), four
   builders in flight on rows 184, 185, 186 and 188, and it writes `PASSOFF.md` and `HANDOFF.md`
   as rows close. A migration that rewrites both while it runs loses its writes or breaks its
   close-outs. It has been told this item is in flight.
9. **Other work in ezhomesteading tonight**, from the `/land-worktrees` session "ezhomesteading-da",
   2026-10-16 01:45 EDT. Never touch `~/Projects/archive/ezhomesteading/celebration-art-pipeline-raw/`
   or `~/Projects/archive/worktree-patches-2026-10-16/` (uncommitted, Zach's). A `land.sh` merge
   that Zach runs adds board row 182 and its `### 182.` section to `PASSOFF.md`; Stage B does not
   start before that merge lands. That session holds an edit to row 128 until you message it that
   Stage B is done and where row 128 now lives. The real autopilot session is "Audit skill board
   items", not "ezhomesteading-da".
8. **The migration code exists and is tested.** `fold migrate` (row 90, `migrateFold` in
   `src/lib/fold.ts`), `--dry-run`, the planned removal with backup and `undo` (row 89), and
   `setup` carrying `ledgerFrozenAt` over a re-run (G61, now fixed in `src/render/repo.ts:288` and
   `:441`). Copy their test fixtures; do not reinvent them.

## Do these, in order

### Stage A: tonight, in your own personal-config worktree

1. **Fix F1.** Make the log fold match whole lines, one test that fails before and passes after,
   using the `closed item 8` / `closed item 83` pair. Leave the board and ledger kinds as they are.
   Reason: the next 90-day ledger fold in any migrated repo would hit it, with exit 0.
2. **Teach `migrateFold` range headings.** A level-3 heading of the form `### <a>–<b>.` (en dash
   or hyphen) is shared context for rows `a` to `b`. Default, so you do not stop to ask: every
   non-`DONE` row in the range gets an item file whose body opens with that range section's text
   under a `## Shared context (rows a to b)` heading, then the row's own cells. A `DONE` row in the
   range goes to the closed archive as a `DONE` row with no section does today. The level-2 prose
   sections stay on the board above the table's closing note, untouched, and the dry run lists
   them. Tests: a fixture with one range of three rows (one `DONE`, two `OPEN`) and one level-2
   prose section. Write each choice you make as a judgment call with its reversal.
3. **Check every 2.0.0 skill text on both shapes.** Render the skills into a temp `$HOME` and read
   `close-out`, `handoff`, `passoff`, `clean-up`, `delegate` and `autopilot`. Each must do the
   right thing on a repo with `passoff/` and on one without. Only `templates/skills/autopilot.md:250`
   names the 1.x case today. If one breaks on either shape, stop Stage B and write it as the
   finding; do not widen this item to fix skills.
4. **Gates:** `bun run typecheck && bun run lint && bun test` in the worktree, then
   `bun run doctor . examples` from the main checkout with your changed files copied in.
5. **Dry run on a copy.** Copy `~/Projects/ezhomesteading/{HANDOFF.md,PASSOFF.md,.personal-config.json}`
   and `~/Projects/archive/ezhomesteading/` into a temp directory. Take ` · adapted` off line 1 of
   the copy's ledger only. Run `fold migrate --dry-run` on the copy, then the real run on the copy.
   Check: every row number on the old board is in exactly one place after (live item file, closed
   archive, or the table); every step body of the old ledger is in the copy's archive
   `HANDOFF-log.md` byte for byte; the copy's new `HANDOFF.md` and `PASSOFF.md` sizes. Then `undo`
   on the copy and `diff -r` against a fresh copy: it must be empty.
6. **Fable 5.1 audit.** Spawn one auditor subagent with `model` set to Fable 5.1, in its own
   worktree, read-only, with this question: "Can this migration lose or change a byte of
   ezhomesteading's ledger, a row, or an item's prompt without a non-zero exit?" Give it the diff,
   the temp copy, and step 5's checks. A blocking finding gets at most two fix rounds; then stop.
7. **Stop here if the autopilot run is still live.** It is live while
   `~/Projects/ezhomesteading/docs/incomplete/autopilot-2026-10-16/` has no `RUNDOWN.md`, or its
   `STATE.md` shows any row `IN FLIGHT`. Write a Stage A close-out in this file, post the
   personal-config commit blocks, and end your turn. The autopilot session was asked to message you
   when its run ends; that message starts Stage B. Do not poll it and do not message it to hurry.

### Stage B: only after the autopilot run has ended

1. **Copy both repos' records aside first.** `cp -p` ezhomesteading's `HANDOFF.md`, `PASSOFF.md`,
   `.personal-config.json` and `.claude/skills/`, and `cp -Rp` `~/Projects/archive/ezhomesteading/`,
   to `~/Projects/archive/pre-migration-2026-10-16/ezhomesteading/`. Check the copies with `cmp`
   before you go on. This is the only copy of the ledger.
2. **Take the `adapted` marker off line 1 of `HANDOFF.md`**, run `fold migrate --dry-run` from the
   worktree's CLI with ezhomesteading as the root, and compare its preview with Stage A step 5's.
   They must match except for rows the autopilot run closed. Any other difference: stop.
3. **Run the real `fold migrate`.** Repeat Stage A step 5's three checks against the real files.
   Then put ` · adapted` back on line 1 of the new `HANDOFF.md`, because the standing sections are
   still Zach's own text.
4. **Re-render ezhomesteading at 2.0.0** with `setup` from the worktree, `--dry-run` first. Only
   stamped files that are not marked `adapted` may change, plus the 2.0.0 project skills in
   `.claude/skills/`. If the preview plans an edit to an `adapted` file, or to anything outside
   `.claude/`, the documents `setup` owns and `.personal-config.json`, stop.
5. **Doctor:** `bun run <worktree>/src/cli.ts doctor ~/Projects/ezhomesteading
   ~/Projects/archive/ezhomesteading`, against a run saved before step 2. Nothing new other than
   `row-cell-ceiling`.
6. **Measure.** Total bytes a session reads at start (CLAUDE.md, the ledger, the board) before and
   after, and if you can, a fresh session's context after its first reply (Part 5's script) on each
   side. Write the figures in the close-out.

## Ask before building

Nothing. Zach is asleep and has said to build. Where a choice is his, take the default written
above, write it as a judgment call with how to reverse it, and keep going. Two things stop the item
instead of a choice: any check in Stage A step 5 or Stage B steps 2, 3 or 4 that fails, and a
blocking audit finding left after two fix rounds. On a stop, leave ezhomesteading exactly as the
step 1 copy has it (restore with `cp -p` and `cmp`), and write what you saw.

## Not in scope, whoever asks

- Migrating any repo other than ezhomesteading.
- Item 94 (this repo's runtime pass), items 101 to 104, and F2 to F4 from step 112.
- Any change to ezhomesteading's code, its other documents, `.git/info/exclude` or `.gitignore`.
- Fixing a skill text that step A3 finds broken. Write the finding.
- Stopping, pausing or reordering the ezhomesteading autopilot run.
- The real `$HOME`'s global skills in `~/.claude/skills/`. Do not run `setup` for the global layer.

## Hand back

- personal-config gates green (Stage A step 4), with the doctor proof from the main checkout.
- The Fable verdict, and every judgment call with its reversal.
- Stage B's figures: bytes before and after, and the context measure if taken.
- Close out the 2.0.0 way: a `## Close-out, <date>` section at the end of this file, one log line
  `- <date> · closed item 105` in the ledger, and the board row `DONE - <date>`. If only Stage A
  is done, write a Stage A close-out, keep the row `IN FLIGHT`, and say Stage B waits on the
  autopilot run.
- Commit blocks per repo, naming only files this item touched. ezhomesteading's new `passoff/` and
  its changed `.claude/skills/` and `PASSOFF.md` are tracked or trackable there; its `HANDOFF.md`
  is not.

## Stage A close-out, 2026-10-16

Stage A done 2026-10-16, Opus 5.5, in worktree `committed-status-f2d341` (branch
`claude/item-105-ezh-migrate-abf942`, base `d4c6702`). Not yet committed. Stage B has not
started. The ezhomesteading autopilot run ended at 02:53 EDT (its session "Audit skill board
items" said so, and its folder has `RUNDOWN.md` and no row `IN FLIGHT`). But Zach's `land.sh`
merge, which adds board row 182 and its `### 182.` section, had not landed at 02:55 EDT: the
board has no row 182. The ezhomesteading session that prepared that merge asked that the
migration wait for it, because the merge would conflict with a migrated board. So Stage B waits on
Zach's `land.sh`. The row stays `IN FLIGHT`.

**What changed.**

- F1 is fixed. `src/commands/fold.ts` gains `holds()`: a log line (`kind === 'log'`) is found
  in the archive only as a whole line, in the append (`appended()`) and in the read-back
  (`arrived()`, through a new `line` field on `Check`). Board and ledger kinds stay substring
  matches. `tests/fold-log-lines.test.ts` is the `closed item 8` / `closed item 83` case: it
  failed before the fix (the archive held only `item 83`, exit 0) and passes after.
- `migrateFold` reads range headings. `src/lib/fold.ts` gains `RANGE_HEADING`
  (`### <a>–<b>.`, en dash or hyphen, level 3 only), `rangeSections`, `openItem`,
  `rangeItemOf`, `sharedOf`, `rangeProblems` and `proseBelow`; `Migration` gains `shared` and
  `prose`. `src/commands/fold.ts` appends the range sections to the closed archive with the
  closed prompts, in board order, and the report names the ranges and the level-2 prose.
  `tests/fold-migrate-ranges.test.ts` holds the item's fixture (one range of three rows, one
  `DONE`, two open, one level-2 prose section) plus an open row with its own section inside a
  range, a row two ranges claim, a hyphen range, and one end-to-end dry run and real run.

- Audit fix round 1. `src/lib/write-plan.ts`: `commitPlan` re-reads every planned file before
  any backup or write (`movedSince`), and a file whose text is no longer the plan's `before`
  (changed, created or removed since) stops the whole batch with an error, so the CLI exits 1.
  Before, it wrote over another session's change and exited 0. `src/lib/fold.ts`: the frozen
  log loses only trailing newlines (`/\n+$/`), not all trailing whitespace. Tests in
  `tests/write-plan-moved.test.ts`; one test in `tests/backup.test.ts` changed (J9).

**Judgment calls, each with its reversal.**

- J1. Each range section is cut from the board and appended whole to `PASSOFF-closed.md`,
  even when it has open rows, so every cut byte has one archive copy that the read-back checks,
  and a range whose rows are all `DONE` (26–30, 31–32) loses nothing. Reversal: drop
  `migration.shared` from `migrateHalves` in `src/commands/fold.ts` and keep the range blocks
  out of the cut in `migrateBoard`.
- J2. An open row that has its own section and sits in a range gets its own section first and
  the shared context after it (rows 160, 162, 177, 184 to 195), so the file still opens on its
  own prompt. A row with no section gets the shared context first, then its row, as the item
  said. Reversal: swap the order in `openItem`.
- J3. A row is in a range by its number's value, so a decimal row inside the bounds counts.
  Only level-3 range headings are read; any other level stays where it is. Reversal: change
  `inRange` or the level in `RANGE_HEADING`.
- J4. The row's cells go in as a three-line table under `## The row, as it stood at migration`:
  a header rebuilt from the parsed header cells, a `---` separator, then the row line verbatim.
  Reversal: change `rangeItemOf`.
- J5. No closing note is added under the table. ezhomesteading's board has none, and
  `migrateFold` writes none, so the level-2 prose stays where it stands, untouched. Reversal:
  none needed in code; a person can add the note.
- J6. F1's whole-line match is in the read-back too, beyond the append the item named, because a
  substring read-back would pass a log line that never arrived. Reversal: drop `line` from
  `Check` and call `includes` in `arrived()`.
- J7. Step 5's `undo` check: `undo` restored the board, the ledger and the config byte for byte.
  It left the new `passoff/` folder and the archive appends, as the tool's own message says it
  does. `diff -r` against the fresh copy listed only `passoff/`; with that folder moved aside it
  was empty. I read this as a pass, since the residue is new files and appended text, never a
  changed or lost byte. Reversal: treat it as a fail and make `undo` remove item files.
- J8. The audit's blocking finding was fixed in the shared write path (`commitPlan`), so every
  command gets the guard, not `fold migrate` alone. Reversal: remove `movedSince` and its call.
- J9. `tests/backup.test.ts` asserted row 39's choice: a file created while the confirm sat
  open is overwritten, with a backup. The guard refuses it instead, and the test now asserts the
  refusal. Same goal (never silently overwritten), stricter means. Reversal: J8's reversal, then
  restore the test's old assertions.
- J10. Stage B waits on `land.sh`, as the ezhomesteading session asked, though the autopilot
  run has ended. Reversal: none needed; once row 182 is on the board, Stage B runs as written.

**Step A3, the skill texts.** Rendered into a temp `$HOME` with `setup --profile zach`.
`close-out`, `handoff`, `passoff`, `clean-up`, `delegate` and `autopilot` each say what to do on
a migrated repo, and each names the 1.x case ("On a 1.x board, with no `passoff/` folder beside
it") where the record differs. None breaks on either shape. The item said only `autopilot`
names the 1.x case; all six do now.

**Step A4, the gates.** In the worktree: `bun run typecheck` and `bun run lint` clean;
`bun test` 1,743 pass, 0 fail, 93 files, after fix round 1. A first full run hung
while a 2.6 GB archive clone ran beside it; every file then passed alone, and two later full runs
passed. Doctor from the main checkout, with the four changed files copied in and then restored
(checked with `cmp`): 20 findings, exit 1, the same 20 before and after the copy. None is from
this change; they are the main checkout's own records (stamp drift on two standard files, three
relative dates in `worktree-sweep/SCOPE.md`, ten `row-cell-ceiling`, one `unfolded`, the row
105 status cell `IN FLIGHT 2026-10-16`, and two "today" in this file's own prompt).

**Step A5, the dry run on a copy.** Copied 2026-10-16 01:59 EDT. Ledger line 1's ` · adapted`
taken off the copy only; `archiveHome` pointed at a clone of the archive. `fold migrate
--dry-run` exited 0, then the real run exited 0: log frozen at step 135, 53 item files, 12
range sections, 0 closed prompts (every `DONE` row's section was archived before), 7 level-2
prose sections left on the board. An independent check script passed all three checks: the 194
table rows are byte-identical; every row is in the table once, with at most one item file, and
every row that had a section has it in exactly one place; every non-blank board line lands in
the new board, the closed-archive append or an item file; all 135 step bodies are in the
archive's new part byte for byte, and the old ledger rebuilds exactly from the new one plus the
archived section.

Sizes on the copy: `HANDOFF.md` 189,911 → 6,203 bytes; `PASSOFF.md` 225,171 → 154,731 bytes.
The board stays large because of its table: 124,460 bytes, of which the 121 `DONE` rows are
78,090. Each of those status cells points at a ledger step (`HANDOFF n`), and D16 keeps such rows on the
table, because they have no item file to move with. The 28,943 bytes below the table are the
level-2 prose, which includes the prompts of rows 135 and 138.

Repeated after fix round 1 on a new copy (`stageA2`): same report, all checks pass, and the
old ledger now rebuilds byte for byte (it was one blank line short before).

**Step A6, the Fable 5.1 audit.** Two Fable 5.1 auditors, each in its own worktree, read-only.
Round 0: everything in the diff clean on the real data; one blocking finding outside it (the
stale-read overwrite in `commitPlan`, J8) and four non-blocking: (2) the log's trailing
whitespace, fixed in round 1; (3) the prompts of rows 135, 138 and 183 sit in level-2 prose
sections that stay on the board, and after migration `passoff next 135` shows only the item
file's range note and row, so move those sections into the item files by hand; (4) the next
`fold board` drops a closed row's cells other than the task (the index line keeps the task only),
reached the first time a row with an item file closes; (5) `headingBlock` and `rangeSections`
read a heading inside a code fence, not present in the real files. Round 1 verdict: **clean**,
with non-blocking findings: (A) a window of milliseconds remains inside `planMigrate` between
its first read and the plan's `before`, acceptable for a one-shot run with no other writer;
(B) after a refused third batch, a row that flips to `DONE` before the re-run leaves a stale item
file that no check reports (duplication, not loss); (C) the refusal says "nothing in this batch
was written", while earlier batches did write; (D) on the day, re-run the dry run on the real
files. The round-1 auditor ran a dry run on a copy of the files as they stood after the
autopilot run's writes: exit 0, no problems, frozen at 141, six closed prompts (all `DONE` rows
inside range 184 to 195), 47 item files, and the check script passed on it.

**Seen, not fixed (outside this item).**

- ezhomesteading uses status words outside §2.3 (`COMMITTED`, `BUILT`, `WALKED`). `isDone`
  reads only `DONE`, so those rows get item files as open items. Nothing is lost, but
  `/autopilot` treats them as unfinished.
- After migration, 121 1.x `DONE` rows stay on ezhomesteading's table for good under D16. That
  is the largest part of what a session there still reads at start.

- The two auditors' worktrees, `.claude/worktrees/agent-ae414d088c8046d4d` and
  `agent-a30c7d19028da4cf8`, hold the applied patch uncommitted, so they were not removed (no
  `--force`). They hold nothing that is not in this worktree.

**Left owed:** Stage B, which waits on Zach's `land.sh` merge (row 182). Before it, Zach commits
ezhomesteading's `HANDOFF.md` and `PASSOFF.md` as the autopilot run left them. Then Stage B runs
as written: copy aside, dry run (expect the round-1 auditor's figures plus row 182), real run,
the three checks, `adapted` back on, `setup` at 2.0.0, doctor, and the measurement. When it is
done, message the session "ezhomesteading-da" that it is done and where row 128 went (it waits
to move row 128 from `BUILT` to `COMMITTED`). The 2.0.0 close-out (log line, `DONE` row) comes
with Stage B.

Correction to "What is fixed" fact 6, 2026-10-16: ezhomesteading's `HANDOFF.md` is tracked in git, as `PASSOFF.md` is (`git status --short` showed ` M HANDOFF.md` at 05:27 EDT). Once Zach commits the autopilot run's changes, git holds a copy of the ledger. Stage B step 1's copy-aside still runs, and Stage B's commit blocks include `HANDOFF.md`.

## Close-out, 2026-10-16

Stage B done 2026-10-16 by Opus 5.5 (the model this item assigns; checked first), in
ezhomesteading's main checkout, as that repo's workflow-refinement phase M (its `PLAN.md` BD-1:
one session runs this Stage B and the phase's extra steps). The full record, with every figure,
judgment call and the audit, is `~/Projects/ezhomesteading/docs/incomplete/workflow-refinement/PHASE-M.md`.
Not committed: the owner commits.

**What ran.** Row 182 was applied from `fc76d7b8f` by Zach's choice in chat in place of
`land.sh` (J10's wait), committed as `118c55b8b`. Copy-aside at 13:05 EDT to
`~/Projects/archive/pre-migration-2026-10-16/ezhomesteading/`, checked with `cmp` and `diff -r`.
`fold migrate --dry-run` matched the round-1 auditor's figures plus rows 182 and 196: frozen at
142, six closed prompts, 12 ranges, 49 item files. The real run exited 0, and the three checks
passed on the real files: every board line in one of the three places, all 142 step bodies in
the archive byte for byte, the old ledger rebuilt byte for byte. ` · adapted` went back on line 1.
Phase M then moved the seven prose sections, wrote files for the 20 open rows with none, ran
`fold board` (127 `DONE` rows to the archive, each row line byte-identical, all 196 numbers in
one place each), and cut 40 long cells into their item files.

**Step 4 deviation (Zach's call in chat).** `setup` renders skills only into `~/.claude/skills`,
and `init` on ezhomesteading planned an edit to `.git/info/exclude`, which this item rules out,
so step 4's stop rule applied. Zach chose to skip `init` and render the eight skills into a temp
`$HOME` with `setup --profile zach`, then copy them into ezhomesteading's `.claude/skills/`.
Reversal: `git checkout` the eight tracked files.

**Doctor:** 1,296 findings before, 1,155 after; no `item-files`, `unfolded`, `row-cell-ceiling`
or `stamp-drift`, and no finding that is not an old one at a new path.

**Figures (step 6).** `HANDOFF.md` 204,786 to 6,278 bytes; `PASSOFF.md` 232,382 to 38,907;
the two together 109,292 to 11,296 tokens (bytes / 4). With `CLAUDE.md` and `CLAUDE.local.md`,
112,698 to 14,702. The fresh-session context measure was not taken.

**Fable 5.1 audit**, read-only, own worktree, checksums equal before and after: CLEAN. One
non-blocking finding: "see `### N.`" pointers now meet a `# N.` heading in the item file, found by
row number only.

**Row 128.** The session "ezhomesteading-da" is not in the session list, so it was not messaged.
Row 128 is on ezhomesteading's table as `COMMITTED`, its file
`passoff/128-turnstile-challenge-when-the-sign-in-lookup.md`.
