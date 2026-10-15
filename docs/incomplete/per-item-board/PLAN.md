# Plan: one file per board item, and a ledger that holds only what is true

**Status.** `PLANNED` 2026-10-15, approved at GATE 2 the same day: every recommendation taken (§7).
Design: `DESIGN.md`, `RATIFIED` 2026-10-15, D1 to D17 (GATE 2 added D16 and D17). Written by
Opus 5.5 in the same session as the design. Board items 87 to 94 carry Phases 1 to 8, lane E.

`DESIGN.md`'s typography note holds here: `DONE - <date>` in this file means the board's em-dash
form.

## 0. Facts verified 2026-10-15 (supersede the design where they differ)

Checked at `61a3b6e`, the same day as the design, so G1 to G42 stand. New facts:

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G43 | The tree is clean except for files that are not this effort's | `.gitignore` is modified (adds `/PART0-PROMPT.md`), from another session; `docs/incomplete/per-item-board/` is untracked | `git status --short`, 2026-10-15 |
| G44 | This repo's ledger has 106 steps; the next free number is 107 | `fold migrate` in Phase 8 freezes at whatever the highest is that day, read from the file | `bun run src/cli.ts handoff step`, 2026-10-15 |
| G45 | Eight modules parse the board or the ledger | `src/commands/handoff.ts`, `passoff.ts`, `src/doctor/rules/board-status.ts`, `step-numbers.ts`, `src/lib/board.ts`, `fold.ts`, `ledger.ts`, `markdown.ts`; six test files exercise them directly | `grep -rl 'numberedSection\|headingBlock\|parseBoard\|ledgerSteps' src tests` |
| G46 | 45 test files name the board or the ledger | Phase-by-phase lists below name the ones each phase is expected to touch; the rest only read a rendered name and should need no edit | `grep -rl 'PASSOFF\|boardFile\|ledgerFile\|HANDOFF' tests \| wc -l` |
| G47 | Board item 82 (`OPEN`, Fable 5.1) names `standard/AGENT-PRACTICES.boilerplate.md`, `standard/CHANGELOG.md` and `standard/VERSION` | Phase 7 owns the same three files | `PASSOFF.md` row 82 |
| G48 | Board item 85 (`OPEN`) may add rows that change `templates/skills/autopilot.md` | Phase 6 owns that file | `PASSOFF.md` row 85 |
| G49 | A phase's fixed reading is about 9k tokens before the code | `CLAUDE.md` 3,468, `docs/conventions-ts.md` 7,681, `DESIGN.md` 26,199 characters, plus this file's phase section | `wc -c`, 2026-10-15 |

## 1. Decisions taken since ratification

Build-level calls. Each has a one-line reversal so a later deviation can cite it.

- **BD-1.** The migration is `personal-config fold migrate`, a third target of the existing command,
  not a new command. It shares the archive checks, the confirm and the safety order. *Reversal:*
  move it to `personal-config migrate` with the same body.
- **BD-2.** `row-cell-ceiling` and `item-files` are two rules, one file each, each with a violating
  and a passing fixture test, as CLAUDE.md asks of every rule. *Reversal:* merge them under one id.
- **BD-3.** The shared fixture that proves D11 (one reader) is a module, `tests/item-fixture.ts`,
  that builds a board, a folder and an archive in a temp directory. It is not under
  `tests/fixtures/`, which is generated and ignored. *Reversal:* move it into `make-fixtures.ts`.
- **BD-4.** `handoff step` in a migrated repo exits 0 and prints the two scaffolds. It does not
  refuse, because sessions run it by habit and a refusal reads as a broken tool. *Reversal:* exit 1
  with the same text.
- **BD-5.** The 1.x fallback (D12) carries no warning in 2.0.0. `stamp-drift` already tells a repo
  it is behind. *Reversal:* an advisory finding from `item-files` when a repo has board sections
  and no `itemsDir`.
- **BD-6.** Until Phase 8 migrates this repo, every phase closes out the 1.x way: a ledger step and
  `DONE - HANDOFF n`. The tool is changed before the repo that builds it is moved. *Reversal:*
  migrate first, which means building Phases 1 to 4 against a board the old CLI cannot read.
- **BD-7.** The CLI's own version and the root `CHANGELOG.md` are release work and are not in this
  plan. *Reversal:* add them to Phase 7.

## 2. Phases

One lane, run in order. The phases share `src/doctor/index.ts`, `src/lib/repo-config.ts` and the
ledger, and this repo keeps one builder at a time because the ledger is a shared append target no
collision check sees.

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | The item reader and doc kinds | Default | none | comfortable | One new module and three small edits; everything after reads through it |
| 2 | Readers and rules onto items | Default | none | full | Every reader moves in one phase, so the D11 fixture proves them together |
| 3 | Removal and the two new folds | Default | one Deep review | full | A core write path gains a delete; a mistake loses an untracked file and no gate sees it |
| 4 | `fold migrate` | Default | one Deep review | full | The one command that rewrites a live ledger and board wholesale |
| 5 | Templates, render and the banner | Default | none | comfortable | What `setup` writes for a new repo; the golden file shows every change |
| 6 | The six skill texts | Default | none | comfortable | Copy a session obeys; each skill has its own test file |
| 7 | Standard 2.0.0 and the examples | Default | one Deep review | comfortable | Adopted elsewhere; wrong text passes every gate |
| 8 | Migrate this repo, and the runtime pass | Default | none | comfortable | Zach present: it writes untracked files and the archive |

Every phase is Default because every phase's failure is loud to a test or a hand-run except three,
and those three get a narrow Deep review instead of a Deep driver (Part 5: a Deep phase is half the
room). Each review is a subagent on Fable 5.1 in its own worktree, reads the phase's diff and the
decisions it cites, and returns a verdict and findings only. The lead checks the review
worktree's diffstat is empty when it returns.

### Phase 1. The item reader and doc kinds

**Status:** `PLANNED`.

**Scope**

1. New `src/lib/items.ts` (D7, D11, D12): `slugOf(title)`, `itemFileName(number, title)`,
   `findItem(listing, number)` keyed on the leading `<n>-` only, `itemText(listing, board, number)`
   returning the file's text or the board section's, and which of the two it came from. Pure over a
   `{name, text}[]` listing. Two loaders: `listItemsSync(dir)` for rules and `listItems(dir)` for
   commands, both returning `[]` where the folder is absent.
2. `src/lib/repo-config.ts`: `DocNames` gains `items`, defaulting to the board stem lowercased;
   `readDocNames` reads `itemsDir`. New `readLedgerFrozenAt(repoDir): number | null`.
3. `src/doctor/scan.ts`: a new `DocKind`, `item`, for a markdown file directly inside the root's
   items folder. `Doc` gains `itemsDir`, so a rule can find the folder beside a board.
4. `src/doctor/index.ts`: `archivedInfo` skips the archive directory named like the items folder
   (D15).
5. Tests: new `tests/items.test.ts` (names `1`, `1.5`, `15`, `10`; a slug at the length limit; a
   title with only punctuation; a file and a section for one number); new `tests/item-fixture.ts`
   (BD-3); `tests/doc-kinds.test.ts`, `tests/doc-names.test.ts`, `tests/archived-citations.test.ts`
   extended.

**Subagents:** none.

**Done when**

- `bun run typecheck && bun run lint && bun test && bun run doctor . examples` is green.
- Proof a gate cannot give: a scratch copy of this repo's archive with an empty `passoff/` folder
  added, run as `bun run src/cli.ts doctor . <scratch archive>`, reports exactly the
  `archived-citations` findings the real archive reports before the phase, and none naming `passoff`. Both
  outputs are pasted in the close-out.

**Watch for:** `findItem` matched by prefix without the hyphen, which makes `1` find `15-…`. The
test for `1` against a folder holding `15-…` and `1.5-…` is the guard.

### Phase 2. Readers and rules onto items

**Status:** `PLANNED`. Waits on Phase 1.

**Scope**

1. `src/commands/passoff.ts`: `next` prints the item through `itemText`, with the file's path
   when it is a file. `claim` writes the status cell on the board and the claim note under the
   file's `# <n>.` line (§4.1), and refuses when either file changed between read and write. A 1.x
   board behaves exactly as now.
2. `src/doctor/rules/board-status.ts`: `DONE - <ISO date>` passes when the item file exists live or
   in `<archiveHome>/<itemsDir>/`, and reports nothing when the archive cannot be read (D2).
   `DONE - <LEDGER> n` passes without reading the ledger when `n <= ledgerFrozenAt` (D5).
   `SUPERSEDED` and `SETTLED AS NO` read their text through `itemText`.
3. New `src/doctor/rules/row-cell-ceiling.ts` (D9), built per root from the
   `doctor.rowCellCeiling` answer like `ledgerFoldCeiling`. Every column except "Files it owns"
   (D17).
4. New `src/doctor/rules/item-files.ts` (D11): orphan file, duplicate number, non-`DONE` row with
   neither file nor section, heading and name disagreeing, a name outside the shape, and a number
   with both a file and a section.
5. `src/doctor/rules/unfolded.ts`: on a migrated board, one finding when any `DONE` row's file is
   still live (DIAL-8). On a migrated ledger, one finding when log lines are older than 90 days.
6. `src/commands/handoff.ts`: in a migrated repo, the frozen-log message and the two scaffolds
   (BD-4).
7. D16: the next free item number is the highest of the board's
   rows, the live folder's files and the archive folder's files, and `item-files` reports a number
   on the board that the archive already holds.
8. Tests: new `tests/row-cell-ceiling.test.ts`, `tests/item-files.test.ts`; `board-status.test.ts`,
   `board-status-shapes.test.ts`, `doctor.test.ts`, `cli.test.ts` extended. One new test reads the
   BD-3 fixture through `passoff next`, `board-status` and `unfolded` and asserts they agree on
   every item.

**Subagents:** none.

**Done when**

- The gate command is green.
- Proof a gate cannot give: before the first edit, `bun run src/cli.ts doctor` is run read-only on
  `~/Projects/ezhomesteading`, `~/Projects/felto` and `~/Projects/usdeed` and the output saved in
  the scratchpad. After the phase, the same runs show the same findings plus `row-cell-ceiling`
  ones and nothing else. A 1.x repo that changes in any other way means D12 is broken.

**Watch for:** `board-status` is synchronous and handed one doc. Reading the archive folder from it
is a second filesystem read per board, which is fine, but a missing `archiveHome` must mean
"cannot verify", never "the record is missing".

### Phase 3. Removal and the two new folds

**Status:** `PLANNED`. Waits on Phase 2.

**Scope**

1. `src/lib/write-plan.ts` and `src/lib/backup.ts` (D14): a planned removal. It shows in the
   preview as removed, is backed up before the delete, and `personal-config undo` restores it.
2. `src/lib/fold.ts`: `itemFold(board, listing)` returns the `DONE` rows whose file is live, with
   the file text; `logFold(ledger, days, date)` returns log lines older than `days`.
3. `src/commands/fold.ts`: the board half on a migrated repo writes each file to
   `<archiveHome>/<itemsDir>/`, reads it back byte for byte, writes the index line, then removes the
   live file (D6). An archive file with different bytes stops that item. The ledger half on a
   migrated repo appends old log lines to `<LEDGER>-log.md` and cuts them. New flag `--log-days`
   (DIAL-4). 1.x repos fold exactly as now.
4. D16: the board half also removes the row from the table once
   the index line is written, and the index line carries the row's task text.
5. Tests: new `tests/fold-items.test.ts`; `fold.test.ts`, `backup.test.ts` extended; a test that
   `undo` after a board fold restores the live item file byte for byte.

**Subagents:** one Fable 5.1 review, own worktree, verdict only. Its brief: the diff of
`write-plan.ts`, `backup.ts`, `fold.ts` and `commands/fold.ts`, and D6, D14 and Part 7's folding
section. The question it answers: can any path remove a live file whose bytes are not in the
archive, or leave a removal `undo` cannot restore?

**Done when**

- The gate command is green, and the review's findings are fixed or written down as held.
- Proof a gate cannot give: in a temp copy of a migrated fixture repo, a fold followed by
  `personal-config undo` leaves the live folder identical to before (`diff -r` empty, pasted).

**Watch for:** the backup must be taken before the delete in the same `commitPlan`, and the
read-back must run between the archive write and the removal, not after both.

### Phase 4. `fold migrate`

**Status:** `PLANNED`. Waits on Phase 3.

**Scope**

1. `src/lib/fold.ts`: `migrateFold(board, ledger, date)` computes, touching no disk, the four
   outputs of D5: the archive log text, the closed-prompt text, one item file per non-`DONE`
   section (named by D7, lifted by `headingBlock`), and the cut board and ledger.
2. `src/commands/fold.ts`: the `migrate` target. Order: append both archive files, read back;
   write the item files, read back; then cut both live documents and write `itemsDir` and
   `ledgerFrozenAt` to `.personal-config.json`, all in one confirmed plan. Refuses on a repo that
   already has `ledgerFrozenAt`, and on a board where two sections share a number.
3. Tests: new `tests/fold-migrate.test.ts`, covering a bold-form and a list-form ledger, a board
   with a nested `#### SCOPE` heading under an item (the case `headingBlock` exists for), a
   `1.5` item, and a second run that refuses.

**Subagents:** one Fable 5.1 review, as in Phase 3. The question: is there a ledger or board this
tool already reads where the migration loses or misplaces text?

**Done when**

- The gate command is green, and the review's findings are fixed or held.
- Proof a gate cannot give: copies of this repo's real `HANDOFF.md` and `PASSOFF.md`, with a temp
  archive, migrated in a temp directory. Every non-`DONE` section appears byte for byte in its
  file; every step line appears in the archive log; `doctor` on the result reports only
  `row-cell-ceiling` findings; `undo` restores both live files (`cmp` silent). Repeated on copies
  of ezhomesteading's two files, read-only on the originals.

**Watch for:** the cut ledger must keep every standing section, including Style rules after the
log. `blockStops` exists because a last step once swallowed `## Style rules`.

### Phase 5. Templates, render and the banner

**Status:** `PLANNED`. Waits on Phase 4.

**Scope**

1. `templates/PASSOFF.md` (§4.2), `templates/HANDOFF.md` and `templates/HANDOFF.short.md` (§4.3),
   and a new `templates/item.md` (§4.1).
2. `src/render/repo.ts`: the first item file, `passoff/1-first-task.md`, written beside the board;
   `itemsDir` in the rendered config; the router's board line names the folder; in untracked mode
   the ignore entries add `/<itemsDir>/`, anchored.
3. `templates/hooks/session-banner.sh`: the item's path after the next open title (§4.6).
4. Tests: `tracks.test.ts`, `render.test.ts`, `hooks.test.ts`, `folder-render.test.ts`, and the
   golden `tests/golden/full-track.json`.

**Subagents:** none.

**Done when**

- The gate command is green.
- Proof a gate cannot give: `setup --dry-run` against a fresh temp repo, once tracked and once
  untracked, read by hand. The tree shows `passoff/1-first-task.md`, the untracked ignore entry is
  `/passoff/`, and the banner run in that repo prints the item's path.

**Watch for:** the light track writes no board (`hasBoard`), so it must write no items folder and
no ignore line for one.

### Phase 6. The six skill texts

**Status:** `PLANNED`. Waits on Phase 5. Check board item 85's state first (G48).

**Scope**

1. `src/render/skills.ts` and `templates/skills/{handoff,passoff,close-out,clean-up,delegate,autopilot}.md`:
   the record is the item file's close-out section plus one log line; `DONE - <date>`; `/clean-up`
   folds item files and log lines; `/delegate`'s `RECORD` writes the close-out (or carries it in the
   report when the folder is untracked, D10); `/autopilot` writes a log line for its run, not a
   step.
2. Tests: `skills.test.ts`, `clean-up-skill.test.ts`, `delegate-skill.test.ts`,
   `autopilot-skill.test.ts`.

**Subagents:** none.

**Done when**

- The gate command is green.
- Proof a gate cannot give: `grep -n 'step' ` over the six rendered skills from a `setup --dry-run`
  shows no instruction to write a numbered ledger step, and each remaining hit is read and named in
  the close-out.

**Watch for:** `/delegate` and `/autopilot` were reviewed by Fable on 2026-10-05. A change that
reads well alone can break an agreement between the two texts; read both together before closing.

### Phase 7. Standard 2.0.0 and the examples

**Status:** `PLANNED`. Waits on Phase 6. Item 82 waits on this phase for its
standard edit (GATE 2 question 4, A).

**Scope**

1. `standard/AGENT-PRACTICES.boilerplate.md`: §2.1 (both files, and D16: a `DONE` row leaves the
   table at the fold, its archive index line carrying what it said), §2.3 (`DONE - <date>`), Part 7
   step 1 and folding, Part 9's router line, Appendix B. GATE 1's Q8 answer is the owner's
   permission for this edit (DESIGN.md §7).
2. `standard/AGENT-PRACTICES.short.md`: "The ledger" and "What is next".
3. `standard/CHANGELOG.md` (a 2.0.0 entry saying re-adapting is required and why) and
   `standard/VERSION`.
4. `examples/HANDOFF.md`, `examples/PASSOFF.md` and a new `examples/passoff/` with one open item;
   `.gitignore` re-includes `examples/passoff/`.
5. `docs/choices/work-profile.md` and `docs/choices/archive-home.md` where they describe the board
   or the fold.

**Subagents:** one Fable 5.1 review, own worktree, verdict only, of the standard diff against D1 to
D15. The question: does any sentence still describe the 1.x shape, or contradict another?

**Done when**

- The gate command is green, and the review's findings are fixed or held.
- Proof a gate cannot give: `grep -n 'HANDOFF [0-9]\|step log\|below the board'` over both standards
  and the examples, every hit read and either changed or named in the close-out as intended.

**Watch for:** `standard/` is byte for byte except its version line in every other effort. This
phase is the exception, and only for the sections listed.

### Phase 8. Migrate this repo, and the runtime pass

**Status:** `PLANNED`. Waits on Phase 7. Zach present.

**Scope**

1. `bun run src/cli.ts fold migrate --dry-run`; Zach reads the preview; then the real run, with
   Zach's yes in chat.
2. `personal-config setup` in this repo, to re-render `docs/AGENT-PRACTICES.md` at 2.0.0, the router
   and the skills.
3. The board rows this work closed are marked; the first item close-out is written in the new
   shape.
4. New `RUNTIME-PASS.md` beside this file, with the entries from every phase.

**Subagents:** none.

**Done when**

- The gate command is green, and `bun run src/cli.ts doctor . ~/Projects/archive/personal-config`
  reports nothing new against the run saved before the migration, other than `row-cell-ceiling`.
- Proof a gate cannot give: a fresh session in this repo, started after the migration, has its
  context measured after its first reply (Part 5's script). The figure, and the same measure from a
  session started the day before the migration, go in the close-out.

**Watch for:** the ledger and board here are untracked. The read-back is the only copy check, because
git holds no copy of either file.

## 3. Dials

`DESIGN.md` §5, DIAL-1 to DIAL-8, unchanged. Nothing in this plan adds a dial.

## 4. Seams reserved, deliberately not built

- **`passoff new <title>`**, a command that adds a row and creates the file with its slug. Sessions
  write both by hand in 2.0.0, and `item-files` catches a bad name.
- **Migrating the other eight repos.** Each is its own board row after Phase 8, because each needs
  its owner's yes for a write to untracked files and its archive.
- **A rule that checks prose citations of step numbers** in memory files and other documents.
- **Removing the 1.x fallback** (D12) in a later major version.
- **A builder writing its own item file in an untracked repo**, through the report-and-lead route of
  D10 or some other route. Not built beyond D10.

## 5. Repo hazards, with live numbers

- HEAD `61a3b6e`; ledger at 106 steps, next free 107 (G44). Each phase reads the number fresh.
- Item 82 and Phase 7 own the same three `standard/` files (G47). Item 85 may touch
  `templates/skills/autopilot.md`, which Phase 6 owns (G48).
- `.gitignore` carries another session's uncommitted line (G43). Phase 7 edits the same file; its
  commit block names only the lines it added, and Zach decides.
- `tests/fixtures/` is generated and never committed. The BD-3 fixture lives outside it.
- `bun test` greps `src/`, `templates/` and `standard/` for personal strings. The slug examples in
  templates must be generic (`1-first-task.md`).

## 6. Session protocol

Read `docs/AGENT-PRACTICES.md` by heading: Part 2 for the shapes, Part 5 for the budget, Part 7 for
closing. Then `CLAUDE.md`, `docs/conventions-ts.md`, `DESIGN.md`, and this file's phase section.
Each phase is one session and one board row; the rows are written after GATE 2, one per phase,
one lane letter not in use on the board, with the files each phase's scope names. Each phase
closes out the 1.x way until Phase 8 (BD-6). Commit blocks only: `git add <exact files>`, then `git commit <the same files> -m "..."`.

## 7. GATE 2

Asked 2026-10-15 in one batch, the turn this file was finished.

1. **`DONE` rows leave the table at the fold?** After the cap, `DONE` rows are 52,000 of
   ezhomesteading's 76,000 table characters and 26,000 of this repo's 27,000 (G40). §2.1 keeps them
   forever, and the gate did not reopen that.
   - **A. Yes, in 2.0.0.** *Recommended.* The fold moves the row with its file, and the index line
     (D6) carries what the row said. The next free number reads the board and both folders. One
     major version instead of two.
   - **B. No.** §2.1 stands. The table keeps growing one line per closed item.
2. **Is "Files it owns" under the 200-character cap?** It is the most-cut column (G41), and the
   collision check compares exact paths (G42).
   - **A. Exempt that column.** *Recommended.* The cap is for prose; the files cell is the
     collision check's data.
   - **B. A separate, higher ceiling for it** (400).
   - **C. Cap it like every cell**, as GATE 1's answer reads literally.
3. **The phase shape:** eight phases, one lane, Default drivers, three Fable reviews (Phases 3, 4
   and 7).
   - **A. As planned.** *Recommended.*
   - **B. One Fable review only**, at Phase 4.
4. **Item 82 and Phase 7 share three files.**
   - **A. Item 82's standard edit waits for 2.0.0.** *Recommended.* Its scope stage touches only a
     new folder and can run now; a ceiling change then lands on 2.0.0.
   - **B. Phase 7 waits for item 82 to close.**
5. **This repo migrates in Phase 8; the other eight repos get their own rows afterwards.**
   - **A. Yes.** *Recommended.*
   - **B. Migrate ezhomesteading in Phase 8 as well**, since it is the largest.

### 7.1 Answers, 2026-10-15

Zach took every recommendation in one reply, the turn after the batch was asked: "GATE 2: take
every recommendation (1A, 2A, 3A, 4A, 5A)."

1. **1A.** A `DONE` row leaves the table at the fold, with its file. Recorded as `DESIGN.md` D16.
2. **2A.** "Files it owns" is exempt from the row cell ceiling. Recorded as `DESIGN.md` D17.
3. **3A.** Eight phases, one lane, Default drivers, Fable reviews at Phases 3, 4 and 7.
4. **4A.** Item 82's standard edit waits for Phase 7 (item 93). Its scope stage can run now.
5. **5A.** Phase 8 migrates this repo only. The other eight repos get their own rows after it.

The plan is approved and authorizes the whole run (§2.2, GATE 2). Board items 87 to 94 carry
Phases 1 to 8 in order, lane E.
