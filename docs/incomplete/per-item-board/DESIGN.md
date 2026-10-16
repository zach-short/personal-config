# Design: one file per board item, and a ledger that holds only what is true

**Status.** `RATIFIED` 2026-10-15. Amended the same day at GATE 2 with D16 and D17 (`PLAN.md` §7.1). Amended 2026-10-16 with D18 (board item 107). Opened as `SCOPE.md` on 2026-10-15 by Opus 5.5, answered in
full at GATE 1 the same day (every recommendation taken, `SCOPE.md` §7), and turned into this file
the same day by Opus 5.5. No board row carries this work yet; the rows come after GATE 2 (`PLAN.md`
§6). The standard moves to 2.0.0.

`SCOPE.md` is not in git at the time of writing. It is committed beside this file, unchanged, as the
gate record, and removed in the first build commit, so the scope exactly as the gate saw it is
`git show <that commit>:docs/incomplete/per-item-board/SCOPE.md`, found with
`git log --diff-filter=A -- docs/incomplete/per-item-board/SCOPE.md`. Its options section, Q1 to Q8
with each option's defense and the strongest argument against it, is carried into the decisions
below, so nothing the gate weighed is lost from this file.

From here the design is frozen. It changes by a new dated `D<n>` or an `As built:` note, never by
an edit to a decision in place. `PLAN.md` beside it is Stage 4 and ends at GATE 2.

**Labels.** G1 onward in §1 are the ground truth. G1 to G33 are the rows of the scope's §1 table in
order, unchanged; this file does not repeat them. G34 onward were found while writing this design
and are stated in full. Decision Dn records the answer to the gate's question n, so D1 to D10 follow
the scope's ten questions in order. D11 onward are consequences the gate's answers force, decided
here because each one has a single answer once the gate's answers are fixed; each says which answer
forces it.

**Typography.** The board writes a `DONE` status with an em dash (U+2014) between the word and
its pointer. This repo's prose hook rejects that character anywhere in a markdown file, code
included, so this file and `PLAN.md` write it as a hyphen: `DONE - 2026-10-15` here means the
board's em-dash form. The code keeps accepting both, as `board-status` does at `61a3b6e`.

## 1. What exists, verified 2026-10-15

The scope's §1 table is the ground truth the gate saw (G1 to G33). Nine further facts came out of
reading the code for this design. Three of them change what the build must do; the plan's §0 table
continues from G43.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G34 | `trackMode: tracked` does not mean the ledger and board are tracked | This repo records `"trackMode": "tracked"` and ignores both files by hand. `renderIgnore` adds the two names to an ignore file in untracked mode only, so `trackMode` says what `setup` wrote, not what git holds | `.personal-config.json`; `.gitignore:10-11`; `git check-ignore -v HANDOFF.md PASSOFF.md`; `src/render/repo.ts:410-440` |
| G35 | `archived-citations` treats every top-level directory in an archive as a moved name | `archivedInfo` lists the archive's directories; the rule reports any live line that contains one of those names | `src/doctor/index.ts:135-146`; `src/doctor/rules/archived-citations.ts:9-30` |
| G36 | So an archive folder named `passoff/` makes every live mention of the word a finding | The word is in the live folder's name, in `personal-config passoff next`, in every rendered skill that names the command, and in this file | follows from G35 and D6, D7 |
| G37 | `write-plan` has no removal | Every planned change is a create or an edit. `archive` moves folders with `rename` and `gitMove` outside the plan, so a move gets no preview line, no backup and no undo | `src/lib/write-plan.ts`; `src/commands/archive.ts:1,8-14` |
| G38 | Dials are answers inside `.personal-config.json`, not top-level keys | `doctor.ledgerCharCeiling` is read from `config.answers`, and the rule is built per root for that reason | `src/doctor/index.ts:57-62`; `src/doctor/rules/ledger-fold-ceiling.ts:15` |
| G39 | A 200-character cap on every cell removes about a quarter of a large table, not most of it | ezhomesteading's table is 101,016 characters in 180 rows; the excess over 200 across all cells is 28,610. Capped, the table is about 76,000 | count per column, 2026-10-15, over `~/Projects/ezhomesteading/PASSOFF.md` |
| G40 | After the cap, `DONE` rows are most of every table | Capped `DONE` rows against all other rows: ezhomesteading 52,070 against 24,116; personal-config 25,956 against 1,382; felto 13,953 against 2,225; usdeed 9,304 against 395 | same count, four boards |
| G41 | "Files it owns" is the column the cap cuts most often | Cells over 200 by column. personal-config: files 22, waits on 10, none else. ezhomesteading: files 54, task 52, status 43, waits on 6. felto: files 18. usdeed: status 19, files 6 | same count |
| G42 | The collision check compares exact path tokens | `sharedFiles` splits the cell on commas and semicolons and intersects the tokens. `src/` and `src/lib/x.ts` do not match | `src/lib/board.ts:140-155` |

G39 and G40 correct the scope's §5, which said the cell rule was what kept the change from saving
less than half of what it looked like. The cell rule removes a quarter of a large table. What is
left is mostly `DONE` rows, which §2.1 keeps on the board forever and the gate did not reopen.
`PLAN.md` §7 asks about it. G41 and G42 together mean a 200-character cap on "Files it owns" pushes
a writer from file paths to directory paths, and directory paths miss collisions the check catches
at `61a3b6e`. `PLAN.md` §7 asks about that too.

## 2. What this is, and what it is not

The scope's §2 stands unchanged. Two additions, both forced by §1:

- **In scope:** a removal in `write-plan` (G37), because a fold that moves an item file must delete
  the live copy, and CLAUDE.md requires every write to go through the plan with a preview and a
  backup.
- **In scope:** `archived-citations` learns that the archive's items folder is a mirror of a live
  folder and not a moved effort (G35, G36).

## 3. Decisions

### D1. One file per item in `passoff/`; the board keeps the table (Q1, A)

`PASSOFF.md` holds the status vocabulary, the lane note and the table, and nothing below the table.
Each item is one file, `passoff/<n>-<slug>.md`, holding the dated paragraph saying why it exists,
the prompt, any claim note, and at close its close-out section. An `OPEN`, `IN FLIGHT`, `HELD`,
`SUPERSEDED` or `SETTLED AS NO` item's file stays in the folder: the last two carry a reason written
nowhere else, and `board-status` reads it. A `DONE` item's file leaves at the next fold (D6).

**The defense.** A session reads the table and one file. Two sessions on two items write two files,
which removes the one write the collision column cannot see. `passoff next` prints one file, and
closing an item becomes a move the fold already knows how to do safely.

**What it beat.** B (one file, read by section) still pays the whole table and every prompt on any
read that is not a careful slice, and leaves every writer on one file. C (a Profile P folder per
item) is ceremony for a two-hour task, and the standard's own choice document says so
(`docs/choices/work-profile.md`).

**What it costs, accepted.** A number in the `#` cell and a number in a filename can drift; D11
gives the drift one detector. A folder of many files is a listing cost; the fold keeps it to the
open items.

### D2. Every cell is one line; `DONE - <date>`; the record is the item file (Q2, A)

A closed row reads `DONE - 2026-10-15`. The record is the item file the row's number names: live in
`passoff/` until the fold, then in `<archiveHome>/passoff/`. The commit, what shipped and what was
learned go in that file's close-out section (§4.1). Every cell is one line and at most 200
characters by default (D9).

`board-status` checks a `DONE - <date>` row the way it now checks a step citation: the date must be
an ISO date, and the item file must exist live or in the archive. Where the archive home cannot be
read (another machine, no `archiveHome`), the rule reports nothing, the same as it does at `61a3b6e` for a
missing ledger. This keeps the fix that `DONE - HANDOFF 999` forced: a pointer that points at
nothing is a finding.

**The defense.** It works the same in a tracked and an untracked repo, and Zach's repos split seven
untracked to three tracked (G20). `DONE` still points at the record (§2.3).

**What it beat.** B (`DONE - <commit>`) has no commit to name in an untracked repo, where the move
to the archive is not a commit. C keeps the step log, which D3 removes.

**What it costs, accepted.** A date alone does not tell two same-day closes apart. It does not have
to: the number in the row's own `#` cell names the file.

### D3. The ledger keeps its standing sections only (Q3, A)

The ledger's sections, in order: Orientation, Environment, Settled, Code map, Invariants, Known
facts and quirks, Log (D4), Style rules. The numbered step log leaves. What a step recorded goes to
the item's close-out section. A durable fact learned on the way goes to Known facts, as the
close-out already asks.

Because the ledger is now small, it is read in full again: the Orientation's read order is the
ledger, then the table, then the session's own item file. This repo's router, which since `61a3b6e`
says "search it", keeps saying so until the ledger is under the ceiling; the template says "read
it" once the log is gone (§4.3).

**The defense.** 98.5% of ezhomesteading's ledger is step log (G7). The standing sections are the
half a session needs at start, and they fit the 60,000-character ceiling without a fold. The item
number is already a permanent address that nothing may reuse, so the step number was a second
address for the same work.

**What it beat.** B (one-line steps) keeps two records per item and a number no reader needs. C
(the 1.2.0 fold) leaves 85% of a ledger in place (G12).

**What it costs, accepted.** The ledger stops being one timeline. D4 gives a thin one back.

*As built, 2026-10-15 (Phase 5):* this holds where a board is written. The light track writes no
board and so no item files, and a step's record has nowhere else to go, so its ledger keeps the
numbered step log (`templates/HANDOFF.light.md`, the 1.x short ledger unchanged) and its config
carries no `ledgerFrozenAt`. Every rule reads it as a 1.x ledger (D12).

### D4. Work that is not an item gets a dated one-line log (Q4, A)

A `## Log` section in the ledger, where the step log was. One line per event, unnumbered, oldest
first, each line ending in a pointer:

```
- 2026-10-15 · closed item 83
- 2026-10-14 · autopilot run 3 · docs/incomplete/autopilot-2026-10-14/STATE.md
- 2026-10-15 · log frozen at step 105 · HANDOFF-log.md in the archive
```

Every item close writes one line, citing the item by number only (D13). Work that is not an item
(an `/autopilot` run, a scope session that built nothing, a one-off fix the owner asked for in
chat) writes one line with a path. The fold moves lines older than the retention dial (90 days) to
the archive's existing `<LEDGER>-log.md` (D6).

**The defense.** It is the timeline D3 removes, at about a hundred characters per event, and it
needs no number because each line points at something that has one.

**What it beat.** B (a row for every piece of work) lengthens the table, which every session reads.
C (Known facts only) has nowhere for an autopilot run's findings, which are not facts about the
code.

### D5. Migration is forward only, from a frozen log (Q5, A)

`personal-config fold migrate` converts one repo, once:

1. The whole step log, stubs and the newest bodies alike, is appended to the archive's
   `<LEDGER>-log.md` under a dated header, and read back.
2. Every `DONE` item's prompt still on the board is appended to `<BOARD>-closed.md`, as the 1.2.0
   fold does, and read back.
3. Every other item's section (`OPEN`, `IN FLIGHT`, `HELD`, `SUPERSEDED`, `SETTLED AS NO`) is
   written to its own file in `passoff/`, by `headingBlock`, and read back.
4. Only then are the live documents cut: the board to its table, the ledger's step log to an empty
   `## Log` carrying one line (`log frozen at step N`), and `.personal-config.json` gains
   `ledgerFrozenAt: N` and `itemsDir`.

`board-status` accepts `DONE - <LEDGER> n` for any `n` at or below `ledgerFrozenAt`, without reading
the ledger, because the log that held `n` is now in the archive. A repo with no `ledgerFrozenAt`
and a step log is a 1.x repo, and every rule reads it as it does under 1.2.0 (D12).

Rows are not rewritten. A `DONE - HANDOFF 24` stays as it is. Over-long cells are reported by D9's
rule and shortened by hand, because a cut through prose needs judgment and a cut through "Files it
owns" can lose a collision (G42).

**The defense.** Part 7 says the archive is not reshaped (G27). The stubs stay findable in the
archive log. It is the existing fold with one new destination and one new config key.

**What it beat.** B (convert every archived step body into an item file) is a many-to-one mapping
with holes, and rewrites 484k and 378k bytes of append-only archive in this repo alone.

**What it costs, accepted.** Two shapes live in the archive for ever, and one table carries both
`DONE - HANDOFF 24` and `DONE - 2026-10-15`.

*As built, 2026-10-15 (Phase 5):* `setup` writes `ledgerFrozenAt` too, which §4.4 gave to
`fold migrate` alone. A ledger `setup` creates in the 2.0.0 shape gets `0`, because the ledger
half reads as migrated from that key only: without it, `handoff step` offers step 1 and the log
never folds. A re-run carries a migrated repo's own number over, because `setup` rewrites the
config whole, and dropping the key sends every `DONE - HANDOFF n` row back to a ledger with no
steps. A 1.x ledger gets no key.

### D6. A closed item's file goes to `<archiveHome>/passoff/` (Q6, A)

The fold's board half becomes: for each `DONE` row whose item file is still in `passoff/`, write
the file to `<archiveHome>/passoff/<same name>`, read it back byte for byte, add an index line, and
only then remove the live file. A file already in the archive with identical bytes is not written
again; one with different bytes stops the fold for that item and says so, because neither copy can
be judged the real one by a tool.

The index line, under `## Closed` by the existing `withIndexLine`:

```
- **passoff/83-build-delegate.md** ✅ - item 83, closed 2026-10-15.
```

The removal goes through `write-plan` as a planned removal, with a preview line and a backup, so
`personal-config undo` restores the live file (D14).

**The defense.** It mirrors the live folder, the safety order applies unchanged (append, read back,
cut), and the index already lists closed work one line each.

**What it beat.** B (in-tree `passoff/done/`) is the folder nobody reads that the archive home
exists to prevent. C (append to `PASSOFF-closed.md`) is one file that only grows, which is the
problem being solved.

**What it costs, accepted.** In a tracked repo the file leaves git with its history, as the archive
home's own choice document says.

### D7. The folder is `passoff/`, derived from the board's name (Q7)

The folder name is the board file's stem, lowercased: `PASSOFF.md` gives `passoff/`, `BOARD.md`
gives `board/`. `itemsDir` in `.personal-config.json` overrides it, and `setup` writes it.

The file name is `<n>-<slug>.md`. `<n>` is the `#` cell verbatim, `1.5` included. The slug is the
task title lowercased, every run of characters outside `a-z0-9` replaced by one hyphen, trimmed of
hyphens, and cut at a hyphen to at most 48 characters (DIAL-5). It is derived once, when the file
is created, and never regenerated: a later edit to the row's title does not rename the file. Every
reader keys on the leading `<n>-` only, so `1-…` never matches `15-…` or `1.5-…`.

The file's first line is `# <n>. <Title>`, so the number is in the file as well as its name.

*As built, 2026-10-15 (Phase 1):* a title with no letters or digits, such as `???`, gets the slug
`item`, because an empty slug would give `<n>-.md` or `<n>.md`, and every reader keys on the
`<n>-` of a name in the shape. A single word longer than 48 characters has no hyphen to cut at and
is cut at 48.

**The defense.** The same word as the board file, so a reader who knows one knows the other.

### D8. Standard 2.0.0 (Q8)

One version covers both standards (G28). `DONE` changes meaning and the ledger loses a section the
1.x text calls permanent, so a 1.2.0 skill text reading a 2.0.0 board misreads it. A major number
tells an adopter that re-adapting is required.

### D9. The row cell ceiling is 200 characters (gate question 9)

A new doctor rule, `row-cell-ceiling`, reports every table cell longer than the ceiling, one
finding per cell, citing the row's line and naming the column. It is not fixable: only a person can
decide which words leave a cell and where they go. The ceiling is the answer
`doctor.rowCellCeiling`, read the way `doctor.ledgerCharCeiling` is (G38). A cell that holds a line
break in its source is also a finding, since the table syntax cannot carry one and a row that
contains one is two rows.

Whether "Files it owns" is under this ceiling is `PLAN.md` §7 question 2 (G41, G42).
*Answered by D17, 2026-10-15:* it is not.

### D10. The lead keeps every write to the table (gate question 10)

Under `/autopilot` and `/delegate`, only the lead session edits `PASSOFF.md`: claims, status cells,
new rows. A builder may write its own item file's close-out section only when the items folder is
tracked, because an untracked folder does not exist in the builder's worktree (G21). "Tracked" is
read from git (`git check-ignore`), never from `trackMode`, because the two disagree in this repo
(G34). Where the folder is untracked, the builder's report carries the close-out text and the lead
writes it.

*As built, 2026-10-15 (Phase 6):* `/delegate` reads "tracked" per item file, with
`git ls-files --error-unmatch <itemsDir>/<n>-<slug>.md` in the primary checkout. A file that no
ignore rule hides but that was never committed is not in a builder's worktree either, and
`git check-ignore` would call it tracked. Where the file is tracked, the lead adds its sign-off
lines (models, verdict, findings, commit state) to the close-out section the builder wrote, in the
builder's worktree, so the whole record lands in the builder's commit and the primary checkout
holds no edit to a file the builder's branch also changes. `/autopilot`'s rule that a builder
stops on a file outside "Files it owns" names the builder's own item file as its one exception.

### D11. One reader for an item, with the file as the unit (forced by D1)

A new module, `src/lib/items.ts`, is the only code that finds an item's text. It holds the name rule
(D7), the slug rule, the lookup by number over a listing of the folder, and the board-section
fallback (D12). It is pure over a listing it is handed (`{name, text}[]`), so it is tested by
calling it. Two thin loaders sit beside it: a synchronous one for `doctor` rules, whose `check` is
synchronous, and an asynchronous one for commands.

`passoff next`, `passoff claim`, `board-status`, `unfolded` and `fold` reach item text only through
it. `numberedSection` and `headingBlock` stay in `markdown.ts` and are called only by `items.ts`
(the fallback) and by `fold migrate` (the lift).

A second doctor rule, `item-files`, reports what only a reader of both the table and the folder can
see: a file whose number has no row; two files with one number; a non-`DONE` row with no file and
no section; a file whose `# <n>.` heading disagrees with its name; and a file outside the name
shape.

**The defense.** Three readers of one section drifting is the scope's first hazard. One module, and
one fixture read by all of them, is how it is proved.

### D12. A 2.0.0 CLI reads a 1.x board and ledger unchanged (forced by D5 and D8)

Until a repo runs `fold migrate`, it has no `itemsDir` key and no `passoff/` folder. `items.ts`
then falls back to the item's section on the board, and every rule and command behaves as it does
under 1.2.0. Where both a file and a section exist for one number, the file wins and `item-files`
reports the section as left behind.

**The defense.** Sixteen adapted standards cannot all move on the day the CLI ships (G31's hazard
in the scope). A CLI that broke every unmigrated repo would make the migration an emergency.

*As built, 2026-10-15 (Phase 6):* the skill texts follow this decision too. A skill is installed
once per machine and read in every repo (`PLAN.md` G66), so each 2.0.0 record instruction in
`/handoff`, `/passoff`, `/close-out`, `/clean-up`, `/delegate` and `/autopilot` carries one
sentence for a board with no items folder beside it: there the record is a ledger step at the next
free number, and the row reads `DONE - <LEDGER> n`. The light track, which writes no board, keeps
the 1.x record in its skills: a numbered step and no item file (D3 As built).

### D13. A log line for a closed item cites the number, not the path (forced by D4 and G35)

`- 2026-10-15 · closed item 83`, never a path into `passoff/`. The item number is the permanent
address (§2.1), and the file is found by it (D2). A path would also go stale at the next fold and
trip `archived-citations` for text that is historical by design.

### D14. Removal is a planned change (forced by D6 and G37)

`write-plan` gains a removal: it appears in the preview as a removed file, it is backed up like an
edit, `commitPlan` deletes it, and `undo` restores it. The fold's board half and `fold migrate` are
its only callers in this effort. `archive`'s existing `rename` is not changed here (§6).

### D15. The archive's items folder is not a moved name (forced by D6 and G35)

`archivedInfo` skips the archive directory whose name equals the repo's items folder name. Item
files moved there are found by number, never by citing their path (D13), so the rule has nothing
to check in that folder, and without the skip it reports every live mention of the word `passoff`
(G36).

### D16. A `DONE` row leaves the table at the fold, with its file (GATE 2 question 1, A; 2026-10-15)

When the fold moves a `DONE` item's file to the archive (D6), it removes the row from the table in
the same plan, after the file is read back and the index line is written. The index line carries
what the row said, so D6's line becomes
`- **passoff/83-build-delegate.md** ✅ - item 83, <task cell>, closed 2026-10-15.` The next free
item number is the highest of the board's rows, the live folder's files and the archive folder's
files, and `item-files` reports a row whose number the archive already holds. A `Waits on` cell
naming a closed item resolves through the archive index. 1.x boards are untouched: a row whose
status is `DONE - <LEDGER> n` stays, because it has no item file to move with (D5).

**Supersedes** the half of §2.1 that says a `DONE` row never leaves the board. The other half
stands: an item number is never reused, and a session never deletes a row by hand.

**The defense.** After the cell ceiling, `DONE` rows are 52,000 of ezhomesteading's 76,000 table
characters and 26,000 of this repo's 27,000 (G40). The collision check reads only `IN FLIGHT` rows,
and the index line keeps the number taken. Doing it in 2.0.0 avoids a second major version.

**What it beat.** Keeping §2.1 as written, which leaves the table growing one line per closed item
for ever.

*Amended 2026-10-16 by D18:* a migrated board's `DONE` row with no item file now leaves the table
too, with an archive file written for it. The sentence "1.x boards are untouched" holds for a board
with no items folder only.

### D17. "Files it owns" is exempt from the row cell ceiling (GATE 2 question 2, A; 2026-10-15)

`row-cell-ceiling` checks every column except the one whose header starts with "files". **Amends**
D9, whose ceiling otherwise stands.

**The defense.** It is the most-cut column (G41), and the collision check compares exact path
tokens (G42): a writer who shortens paths to directories to fit 200 characters makes the check
miss collisions it catches at `61a3b6e`. The ceiling exists for prose, and this cell is data.

**What it beat.** A separate 400-character ceiling, which still pushes a long list toward
directories; and capping it like every cell, as GATE 1's answer reads literally.

### D18. A migrated board's `DONE` row with no file leaves the table with a file written for it (2026-10-16)

Decided by Zach at ezhomesteading's workflow-refinement GATE 2, 2026-10-16 12:18 EDT: his answer to
that plan's BD-2 was "Amend D16 upstream" (`~/Projects/ezhomesteading/docs/incomplete/workflow-refinement/PLAN.md`
§7, the decision in its §1). **Amends** D16's last two sentences.

On a migrated board (D12: its items folder exists), `fold board` treats a `DONE` row that has no
item file, live or archived, as D16 treats a row with one, except that the file is written rather
than moved. In order, in the one fold:

1. Write `<archiveHome>/<itemsDir>/<n>-<slug>.md` (D7's name, from the task cell). It holds
   `# <n>. <task>`, the row as it stood, header and all, its line copied byte for byte, and where
   the record is: the ledger step its status cell names, in the archive's `<LEDGER>-log.md` when
   the step is at or below `ledgerFrozenAt`; and the section in the archive's `<BOARD>-closed.md`
   that holds its prompt or its range's shared context, where one exists.
2. Read the archive file back byte for byte.
3. Write the index line, which keeps the row's task and status cells:
   `- **passoff/24-build-the-thing.md** ✅ - item 24, <task cell>, <status cell>, folded <date>.`
4. Cut the row from the table, in the same `commitPlan` as the index line.

A row whose number the archive already holds under another name or other bytes is not touched;
that is `item-files`' finding. A `DONE` row with a live file keeps D16's path. A board with no items
folder is still untouched: its rows keep `DONE - <LEDGER> n`, and a citation of the row resolves on
the table.

**The defense.** 1.x `DONE` rows are most of a migrated board: on ezhomesteading, 127 of 194 rows
and 80,465 bytes, which keep a session's start read near 40k tokens where the budget is 15k
(that `PLAN.md` §0.1 and §0.2). Writing the file keeps D16's invariant that a row leaves the table
only once its words are in the archive, read back. The file is found by number (D13), so the 285
citations there of `DONE` rows with no section anywhere (§0.3) still resolve.

**What it beat.** Keeping D16 as written and accepting the 40k start; and a one-off script that
folds the rows outside `commitPlan`, with no preview, no backup and no read-back (that design's
option A3).

**What it costs, accepted.** The archive's items folder holds two shapes: a moved item file with a
close-out, and a written file holding only a row and pointers. The written file's first line names
the task, as a moved file's does, so every reader keyed on `# <n>.` reads both.

## 4. The shapes

### 4.1 An item file

```markdown
# 83. Build `/delegate`: one ratified row through a builder and an auditor

*Opened 2026-10-04, out of the delegate-autopilot plan (Phase 1).*

> **Claimed `IN FLIGHT` 2026-10-05.**

**Model: Opus 5.5. Lane B. Waits on items 77, 78, 79.**

<the standalone prompt, Part 3, unchanged>

## Close-out, 2026-10-06

Done 2026-10-06, Opus 5.5, on `delegate-skill`, commit `abc1234`.
<What changed and why.> <What is now fixed.> <Which questions it answered.>
<New files, added to the code map.> **Left owed:** <what this did not do>.
```

The close-out section is what the step body was. A `SUPERSEDED` item's file names its replacement;
a `SETTLED AS NO` item's file carries its dated reason. `board-status` reads both there.

### 4.2 The board

The header paragraph, the status vocabulary with `DONE - <date>` in place of `DONE - HANDOFF n`,
the lane note, the table. One sentence under the table says where the prompts are: "Each item's
prompt is `passoff/<n>-<slug>.md`. A `DONE` item's file moves to the archive at the next fold; its
row stays here."

### 4.3 The ledger

The 1.2.0 sections minus the step log, plus `## Log` in its place (D4). The heading paragraph says
"Read in full, every session. Standing sections are edited in place; the log is one line per event
and is folded after 90 days." The step-log rules (next free number, never edit another's step) move
to the item file's close-out: the file is the writer's own, so the second rule holds by
construction.

### 4.4 `.personal-config.json`

Two new top-level keys beside `ledgerFile` and `boardFile`: `itemsDir` (written by `setup`, and by
`fold migrate` when absent) and `ledgerFrozenAt` (written by `fold migrate` only). One new answer,
`doctor.rowCellCeiling`.

### 4.5 Commands

| Command | 1.x repo (D12) | 2.0.0 repo |
|---|---|---|
| `passoff next` | unchanged | prints the row summary and the item file, with its path |
| `passoff claim <n>` | unchanged | the status cell on the board, the claim note in the item file; refuses if either file changed between read and write |
| `handoff step` | unchanged | says the log is frozen at `ledgerFrozenAt`, prints the close-out scaffold and a log-line scaffold; still writes nothing |
| `fold board` | unchanged | moves `DONE` item files to the archive (D6) |
| `fold ledger` | unchanged | moves log lines older than `--log-days` to the archive log (D4) |
| `fold migrate` | converts the repo (D5) | refuses: already migrated |

### 4.6 The banner hook

It gains one clause: after `Next open: 83 · <title>`, the item's path when the file exists, so a
session opens the one file it needs. It still never orders a full read.

## 5. Dials

| # | Dial | Default | Where it lives |
|---|---|---|---|
| DIAL-1 | Row cell ceiling | 200 characters | answer `doctor.rowCellCeiling` |
| DIAL-2 | Items folder name | board stem, lowercased | `itemsDir` |
| DIAL-3 | Ledger character ceiling | 60,000, unchanged | answer `doctor.ledgerCharCeiling` |
| DIAL-4 | Log retention | 90 days | `fold ledger --log-days` |
| DIAL-5 | Slug length | 48 characters | a constant in `items.ts`, beside its reason |
| DIAL-6 | Frozen log's highest step | read from the ledger at migration | `ledgerFrozenAt` |
| DIAL-7 | Closed-file destination | `<archiveHome>/passoff/` | derived from `archiveHome` and `itemsDir` |
| DIAL-8 | `unfolded` threshold for item files | any `DONE` file still live, one finding per board | `unfolded.ts` |

DIAL-5 is a constant and not config because a slug is derived once and never regenerated: changing
the length later renames nothing, so there is nothing for a repo to tune. DIAL-8 is a change from
the 400-line threshold: a live `DONE` file costs nothing until a session lists the folder, but it is
one move to fix, so the finding is cheap and the threshold is not needed.

## 6. Rules that survive unchanged

- Part 3, the pass-off prompt's nine parts. The prompt moves into a file; its content does not
  change.
- Profile P and its stages, and the `archive` command, including its use of `rename`.
- The status words themselves. Only the tail of `DONE` changes.
- The row is never deleted by a session (§2.1), and an item number is never reused. Whether a
  `DONE` row may leave the table at the fold is `PLAN.md` §7 question 1, not decided here.
  *Superseded in part by D16, 2026-10-15:* the fold now moves a `DONE` row off the table. A session
  still never deletes a row by hand, and a number is still never reused.
- `SUPERSEDED` and `SETTLED AS NO` keep their text, now in their files.
- The fold's safety order: append, read back, then cut. `missingFromArchive`'s byte-for-byte check
  is the model for the item-file read-back.
- `passoff claim`'s re-read guard. It now guards two files.
- The collision check: `ownedFiles`, `sharedFiles`, and checking against `IN FLIGHT` rows.
- Part 7's rule against retrofitting the archive. `PASSOFF-closed.md` and `HANDOFF-log.md` are only
  ever appended to.
- Standing sections are edited in place and never folded.
- The ledger and board file names, and the adopted-name rule (§0.2).
- `setup`'s preview, stamp, backup and undo (`planned`, `resolvePlan`, `commitPlan`).
- `stamp-drift` stays an advisory. `upgrade` stays read-only on an adapted copy.

## 7. Hazards this work walks into

The scope's §5 stands. Corrected and added:

- **The cell rule saves less than the scope said** (G39, G40). Capped, ezhomesteading's table is
  still about 76,000 characters, 52,000 of them `DONE` rows.
- **A cap on "Files it owns" weakens the collision check** (G41, G42) unless that column is exempt
  or the writer keeps file paths.
- **`trackMode` is not git** (G34). Any code that decides "is the folder tracked" from the config
  is wrong in this repo.
- **`archived-citations` and the word `passoff`** (G35, G36). The rule change in D15 must land in
  the same phase as the first archive write to `passoff/`, or every repo's doctor turns red at once.
- **A removal in `write-plan` is new to a core module** (G37). Every command commits through it, so
  a removal that is not backed up, or that `undo` does not restore, is a data loss in an untracked
  file, which no gate sees.
- **The standard is edited in substance.** This repo's CLAUDE.md says only the version line of
  `standard/` is in scope. GATE 1's Q8 answer is the owner's permission for this effort, and the
  plan names the phase that uses it. Board item 82, `OPEN`, also names `standard/CHANGELOG.md`,
  `standard/VERSION` and the boilerplate, so the two cannot run at once.
- **`DONE - HANDOFF n` in other places.** The memory directory and archived files cite step
  numbers. `ledgerFrozenAt` keeps a board's citations valid; prose citations elsewhere resolve in
  the archive log, and nothing checks them, as under 1.2.0.

## 8. Gate record

GATE 1, 2026-10-15: the questions, their options and Zach's answers are `SCOPE.md` §6 and §7, in
the commit named in the status paragraph. GATE 2 is `PLAN.md` §7.
