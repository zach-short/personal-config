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

Added by Phase 1, re-checked at `fc296fc` on 2026-10-15. G35, G38 and G42 hold as written.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G50 | `archived-citations` sees an archive only when the archive sits inside the doctor root | Each root is checked alone: `runDoctorOn` collects one root's docs, and every doc under an archive index's directory is excluded. An archive home outside the repo (this repo's case) gives the rule nothing to report, before or after D15. G36's hazard is real for an in-tree archive home and for a root that encloses several repos' archives (`doctor ~/Projects/archive` style) | `src/doctor/index.ts` `runDoctorOn`, `archivedInfo`; Phase 1 proof |
| G51 | `archive-index` reports an archive `passoff/` folder that has no index line | "`passoff/` exists but has no line in this index". D6's line `- **passoff/<file>** ...` contains `passoff/` and clears it once one item is folded; an empty folder made ahead of a fold, or a fold that writes the file before its line, trips it. Not in Phase 1's files | `src/doctor/rules/archive-index.ts`; Phase 1 proof, scratch archive |
| G52 | The ledger's next free step was 108 on 2026-10-15, not 107 | Step 107 recorded the design itself | `bun run src/cli.ts handoff step`, 2026-10-15 |

Added by Phase 2, re-checked at `5eb3590` on 2026-10-15. G38, G42 and G45 hold as written.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G53 | None of the three proof repos has an items folder, and a 1.x board can carry `DONE` with a date and no step | `ls ~/Projects/{ezhomesteading,felto,usdeed}/passoff` finds nothing. ezhomesteading row 148 reads `DONE 2026-10-13: P0 to P6 committed ...`, a finding at `5eb3590`. So D12 holds only if "migrated" is read from the folder on disk, and only the exact cell `DONE - <date>` is the new form | `ls`; `~/Projects/ezhomesteading/PASSOFF.md:171`; baseline `doctor` run |
| G54 | `parseBoard` keeps column positions but not the header's names | `BoardColumns` holds seven indexes; `row-cell-ceiling` has to name the column of each cell it reports, so `Board` gains the header cells. `src/lib/board.ts` is not in this phase's row | `src/lib/board.ts` `headerColumns` |

Added by Phase 3, re-checked at `189642d` on 2026-10-15. G37, G38 and G50 hold as written.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G55 | G51 is wrong: D6's item line does not clear `archive-index` | The rule reads a folder as cited only on `- **<name>/**`, the name followed at once by `/**`. `- **passoff/83-x.md**` does not match it, so the first item fold turned the archive's doctor red. The fold writes a `- **passoff/** ...` folder line once, beside the item lines | `src/doctor/rules/archive-index.ts` `citedFolders`; regex run 2026-10-15 |
| G56 | `--log-days` cannot reach `fold` inside Phase 3's files | `parseArgs` rejects an unknown flag in `checkUsage`, and the value needs a field on `Cli`. The flag needs `src/lib/args.ts`, `src/lib/types.ts` and the help line in `src/cli.ts`. The lead allowed those three files for this phase on 2026-10-15, and the flag is wired there | `src/lib/args.ts` `OPTIONS`; `src/lib/types.ts` `Cli` |
| G57 | `restore` already brings back a removed file | `copyTo` creates parent folders, so a removed item file, and its folder if it was emptied, comes back without a change to `backup.ts`. `undo` still deletes nothing this tool created, so the archive's copy stays after an undo | `src/lib/disk.ts` `copyTo`; `src/lib/backup.ts` `restore` |

Added by Phase 4, re-checked at `fe0187a` on 2026-10-15. G44 and G53 hold as written.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G58 | ezhomesteading's ledger is stamped `adapted` | Line 1 ends ` · adapted`, so `fold migrate` refuses it until the marker is off | `~/Projects/ezhomesteading/HANDOFF.md:1` |
| G59 | ezhomesteading files items under range headings | Eleven `### 26–30.`-style headings and five level-2 prose sections sit among the item sections. `ITEM_HEADING` does not match a range, so they stay on the board, and their 44 rows have no file and no section | `grep -n '^#' PASSOFF.md` on a copy |
| G60 | This repo's ledger has 113 steps; the next free number was 114 | Step 114 recorded Phase 4 | `bun run src/cli.ts handoff step`, 2026-10-15 |

Added by Phase 5, re-checked at `41b23ee` on 2026-10-15. G34, G43 and G53 hold as written.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G61 | `setup` rewrites `.personal-config.json` whole | The config is planned with `overwrite` and no stamp, so the stamp guard passes it. A re-run after `fold migrate` dropped `ledgerFrozenAt` and any `itemsDir` override, and every `DONE - HANDOFF n` row then pointed at a ledger with no steps. Phase 8 step 2 is exactly that re-run | `src/render/repo.ts` `renderRepoConfig`; `src/lib/write-plan.ts` `stampGuard` |
| G62 | The ledger side reads as migrated only from `ledgerFrozenAt` | Without the key, a fresh ledger with `## Log` gets "the next free number is 1" from `handoff step`, and `fold ledger` and `unfolded` never touch its log. The board side reads from the folder (G53), so the two halves can disagree | `src/commands/handoff.ts` `runHandoff`; `src/doctor/rules/unfolded.ts` |
| G63 | A stamp is line 1 of every stamped markdown file | `withStamp` prepends it, and `headingNumberOf` reads the first line only, so a stamped item file fails `item-files` (D7) | `src/lib/stamp.ts` `withStamp`; `src/lib/items.ts` `headingNumberOf` |
| G64 | This machine's prose hook rejects every em dash in a markdown file, templates included; the code accepts a hyphen in both places a template writes one | `DONE - <date>` and `-` for an empty cell parse as their em-dash forms | `~/.claude/hooks/no-em-dash.sh`; `src/doctor/rules/board-status.ts` `doneDate`; `src/lib/board.ts` `isNone` |
| G65 | The golden test failed before this phase, on the `/autopilot` key only | 3 failures at `41b23ee` in a full `bun test`. A recompute in a clean `HOME` gives the committed hash, and after this phase three full runs pass. The cause was not found; it looks like order-dependent state in the shared test `HOME` | `tests/tracks.test.ts`; baseline run 2026-10-15 |

Added by Phase 6, re-checked at `8152a42` on 2026-10-15. G48, G63 and G64 hold as written; G48's
item 85 is `DONE - HANDOFF 111`, and its findings became rows 95 to 98, of which row 95 changes
`templates/skills/{delegate,autopilot}.md` and waits on this phase.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G66 | A skill is installed once per machine, and every repo reads the same text | `renderSkill` plans `~/.claude/skills/<name>/SKILL.md`. The last `setup` run wins, and until each of the other repos migrates (§4) a 2.0.0 skill is read beside a 1.x board | `src/render/skills.ts` `renderSkill`; `src/lib/paths.ts` `claudeSkillsDir` |
| G67 | The prose hook checks the whole file after an edit, so a template it rejects cannot be edited in part | It runs on Write and Edit and reads the file's full text: an em dash, a contraction or a banned word anywhere in it is reported. `handoff.md`, `passoff.md`, `close-out.md` and `clean-up.md` held 27 em dashes and two contractions in trigger phrases (`what's`) | `~/.claude/hooks/no-em-dash.sh` `run_checks`; `grep -c` 2026-10-15 |
| G68 | `/audit` writes each row's prompt with no named place, and reads the next free number from the board alone | "a table line ... and a standalone prompt that cites the report"; "Read the next free row number from the board file". On a 2.0.0 board the prompt belongs in an item file, and D16 takes the number from the board, the folder and the archive. Not in this phase's files | `templates/skills/audit.md` section 5, step 2 |
| G69 | `/autopilot`'s standing order stops a builder on any file outside "Files it owns" | An item file is never listed there, so D10's builder close-out would stop every tracked build | `templates/skills/autopilot.md` section 9 |

Added by Phase 7, re-checked at `8152a42` on 2026-10-15, with Phase 6 signed off and not
committed in the same checkout. G43 holds (`/PART0-PROMPT.md` is still the one uncommitted line in
`.gitignore`). G47 is resolved: item 82 is `DONE - HANDOFF 110` and handed its standard edit to
this phase (`~/Projects/archive/personal-config/context-ceilings/SCOPE.md` §7). G64 holds.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G70 | G67 holds for Write only | On Edit the hook reads `.tool_input.new_string`, so an edit is checked on its new text alone. The standard keeps its em dashes outside the edited sections; the new text carries none | `~/.claude/hooks/no-em-dash.sh` `post` |
| G71 | Sentences outside this phase's sections still describe the 1.x shape | Long standard: the "five words" paragraph (`:9`), §0.2's Profile L bullet (`:107-108`), R12's "line in the ledger step" (`:235`), Part 3's template step "Record it" (`:480`), Part 12's ledger row (`:1107`). Short standard: "What done means here", "Sizing a session" and "Closing a piece of work" each say "ledger step". GATE 1's Q8 permission names sections, so these are held for the owner | `grep -n 'step' standard/*.md`, 2026-10-15 |
| G72 | Item 82's `{{DATE_MEASURED}}` row is in Appendix A, not Appendix B | `:1141` is the placeholder table, Appendix A. The edit lands there as item 82's text says; Appendix A is added to this phase's sections for that row only | `standard/AGENT-PRACTICES.boilerplate.md:1129-1141` |
| G73 | The short standard's "The ledger" section is rendered for the light track too | `renderShortStandard` cuts only "What is next" for a track that writes no board, and the light track keeps a numbered step log (D3 As built). The section has to describe both. It has no `{{ITEMS_DIR}}` token, and adding one is `src/render/short-standard.ts`, outside this row | `src/render/short-standard.ts` `pipeline`, `placeholders` |
| G74 | `item-files` needs a file for every non-`DONE` row of a migrated board | The example board has five non-`DONE` rows, so the example folder holds five files, not one | `src/doctor/rules/item-files.ts`; `examples/PASSOFF.md` |
| G75 | This machine's global ignore names files, not `passoff/` | `git check-ignore -v examples/passoff/1-x.md` exits 1. The re-include is for an adopter whose global ignore does name the folder, as `/HANDOFF.md` once hid `examples/HANDOFF.md` | `~/.config/git/ignore`; `.gitignore` |

Added by Phase 8, re-checked at `94260bc` on 2026-10-16. G44, G52 and G60 are superseded: the log
froze at step 117.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G76 | This repo was migrated before Phase 8's session opened | `fold migrate` ran on 2026-10-15 at 19:14 UTC; `.personal-config.json` gained `itemsDir: passoff` and `ledgerFrozenAt: 117`. No transcript in this project shows the run | `~/.config/personal-config/backups/2026-10-15T19-14-43-001/manifest.json`; transcript search 2026-10-16 |
| G77 | A `setup` re-run with another profile empties `archiveHome` | The 2026-10-16 run used `starter` and wrote `archiveHome: ""`, after which `fold` refused. It kept `itemsDir` and `ledgerFrozenAt`, so G61's fix holds for those two keys only | backup `2026-10-16T15-14-01-000` against `.personal-config.json`; `bun run src/cli.ts fold --dry-run` |

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

**Status:** `BUILT 2026-10-15` (board item 87, HANDOFF 108). Deviations:

- Scope item 3: `Doc.itemsDir` is optional. Every doc `collectDocs` builds carries it; about a
  dozen test files build a `Doc` by hand, and a required field would have touched each one
  outside this phase's files. A Phase 2 rule reading it treats absent as "no items folder".
- D7: a title with no letters or digits gets the slug `item`, so its file keeps the
  `<n>-<slug>.md` shape (written under D7 as an As built note).
- Done when: the planned proof cannot fail (G50), so a second scratch tree was added, with the
  archive copy inside the root beside copies of this repo's ledger, board and `CLAUDE.md`. That
  tree gave 17 `archived-citations` findings before the change, 16 naming `passoff`, and 1 after,
  the same `worktree-drafts-2026-10-04` citation as before.

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

**Status:** `BUILT 2026-10-15` (board item 88, HANDOFF 109). Deviations:

- D12: a repo is read as 2.0.0 when its items folder exists on disk, never from the config
  (`itemsDir` always has a default). Only then does `DONE - <date>` pass, `item-files` run, or
  `passoff next` print the next free number (G53).
- D16: `item-files` reports an archived number only on a row that is not `DONE`. A `DONE` row
  whose file is archived is the record `board-status` accepts (D2), as the BD-3 fixture's item 7
  is; the hazard is a new row taking an old number.
- D9: `Board` gained `header` in `src/lib/board.ts`, outside this phase's row, so the rule can
  name a cell's column (G54). The log-line reader is a new `src/lib/log.ts`, so Phase 3's
  `fold ledger --log-days` reads lines the same way `unfolded` does.
- Scope item 8: the agreement test and the command tests are a new `tests/item-readers.test.ts`
  (X1, a new file per area) in place of additions to `cli.test.ts`, `doctor.test.ts` and
  `board-status-shapes.test.ts`, which are unchanged.
- Done when: the gate is not green. `doctor .` reports the two `ledger-fold-ceiling` findings
  Phase 1 left owed and 10 new `row-cell-ceiling` findings on this repo's own board, all "Waits
  on" cells of `DONE` rows. D5 says those are shortened by hand; that is Zach's call. The D12
  proof holds: only `row-cell-ceiling` findings differ on ezhomesteading (101), felto (0) and
  usdeed (19), the counts G41 predicts.

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

**Status:** `BUILT 2026-10-15` (board item 89, HANDOFF 112). As built: the read-back compares raw bytes, so a file that is not valid UTF-8 never folds and is held (D6 holds; no byte-write path through `write-plan`). A board or `INDEX.md` whose stamp is guarded holds the whole item half (D16 holds). A first fold also writes a `- **passoff/** ...` folder line (G55). `--log-days` needed `src/lib/args.ts`, `src/lib/types.ts` and `src/cli.ts` (G56).

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

**Status:** `BUILT 2026-10-15` (board item 90, HANDOFF 114). As built: the log section ends at the first heading of any level after the last step, as `blockStops` has it (D5 holds). A block counts for a row only where its heading names that row's own number, because `headingBlock` opens on `### 5.1.` for item 5. A numbered section no row names stays on the board and is reported. The board's `---` separators between items are dropped. A board, ledger or config marked `adapted` refuses the migration whole (G58).

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

**Status:** `BUILT 2026-10-15` (board item 91, HANDOFF 115). Deviations:

- Scope item 2 and D12: the first item file is written only where the repo has no board and no
  items folder on disk. A 1.x repo that re-runs `setup` gains no folder, so it stays 1.x. The
  scan reads the folder and `ledgerFrozenAt` (G61), which needed `src/lib/discover.ts`,
  `src/lib/types.ts` and `tests/helpers.ts`, outside this row.
- §4.4: `setup` writes `ledgerFrozenAt`, which §4.4 gives to `fold migrate` only. It writes 0 for
  a ledger it creates in the 2.0.0 shape (G62), and carries a migrated repo's own number over
  (G61). A 1.x ledger gets no key. Written under D5 as an As built note.
- D3: the light track keeps its numbered step log, in a new `templates/HANDOFF.light.md` that is
  the 1.x `HANDOFF.short.md` byte for byte. It writes no board and so no item files, and D3 moves
  a step's record into an item file. `HANDOFF.short.md` is the 2.0.0 ledger for non-code + full.
  Written under D3 as an As built note.
- §4.2: the board's closing sentence follows D16 (the row leaves with its file), not §4.2's "its
  row stays here".
- D7: the item file carries no stamp (G63), as `fold migrate`'s files do not; the stamp test in
  `tests/render.test.ts` names it as its one exception. It still goes through `planned()`.
- G64: the templates write `DONE - <date>` and `-` with a hyphen; the four rewritten files carry no
  em dash. `templates/CLAUDE.local.md` (outside this row) names the folder too, since it is the
  untracked router.
- Scope item 4: the new tests are `tests/item-render.test.ts` and `tests/banner-item-path.test.ts`
  (X1); `hooks.test.ts` and `folder-render.test.ts` are unchanged. `tracks.test.ts` and
  `render.test.ts` changed for the golden file, the stamp exception and the non-code read order.
- Known effect, not fixed: a second `setup` run rewrites `PART0-PROMPT.md`, because its list of
  written files no longer holds the item file. The prompt is pasted once and is never tracked.

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

**Status:** `BUILT 2026-10-15` (board item 92, HANDOFF 116). Deviations:

- D12: every 2.0.0 record instruction carries one 1.x sentence, "On a 1.x board, with no
  `<itemsDir>/` folder beside it", that names the step and `DONE - <LEDGER> n`, because the skills
  are installed once per machine (G66). Written under D12 as an As built note.
- D10: "tracked" is read with `git ls-files --error-unmatch <item file>`, not `git check-ignore`,
  because a file that is not ignored but was never committed is not in a builder's worktree
  either. The lead's sign-off lines join the builder's close-out section in the builder's
  worktree. Written under D10 as an As built note.
- D6 and D16: in git, `/close-out` and `/clean-up` fold an item only after the owner has committed
  its close-out, because a fold takes the file out of the tree. The item just closed folds at the
  next close-out or at `/clean-up`, and `unfolded` reports it until then.
- G67: the four templates the hook checks were rewritten with no em dash and no contraction, and
  every string `skills.ts` renders into the six skills lost its em dashes too. Two trigger phrases
  changed: `what's the state` is now `what is the state`, and `archive what's done` is now
  `archive what is done`. The light track's prose moved with it (wording only).
- G69: the standing order in `/autopilot` section 9 names the builder's own item file as its one
  exception. Found by reading `/delegate` and `/autopilot` together, as "Watch for" asked.
- Scope item 2: `tests/tracks.test.ts` (its change-log comment) and `tests/golden/full-track.json`
  changed too: the six skill keys moved in all three variants, 83 keys still, no other key moved.
- G68 is left owed to board item 99.

Phase 5 left the light track on a numbered step log (D3 As built), so a skill text that says
"write the close-out in the item file" keeps the step for a repo with no board.

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

**Status:** `BUILT 2026-10-15` (board item 93, HANDOFF 117). Item 82's standard edit landed here
(GATE 2 question 4, A). Deviations:

- Scope item 1: Part 9's router template names neither the ledger nor the board, so it needed no
  edit. Appendix A's `{{DATE_MEASURED}}` row changed too, for item 82 (G72).
- Scope item 2: the short form's "The ledger" also describes the numbered step log, because the
  light track renders it and keeps one (G73, D3 As built). Item 82's sentence for "Sizing a
  session" was reworded, because the short form has no Part 5.
- Scope item 3: the changelog heading keeps its em dash, because `src/lib/changelog.ts` `ENTRY`
  parses only that form and `upgrade` would drop the entry otherwise.
- Scope item 4: five item files, not one (G74), and item 6 folded into the example archive with
  its index lines. Every example file's stamp reads `standard v2.0.0`.
- Outside the row: `src/doctor/scan.ts` gives a board the items folder beside it (D1), and
  `tests/doc-kinds.test.ts` proves it. Without it `doctor .` read `examples/PASSOFF.md` against the
  root's folder. `tests/golden/full-track.json` and `tests/tracks.test.ts` moved for the adapted
  standard, one key per variant.
- Held for the owner: the sentences of G71, and the two the review added (short form line 17,
  the long form's Part 5 rule on compaction).

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

**Status:** `BUILT 2026-10-16` (board item 94, its close-out in the item file). Deviations:

- Scope items 1 to 3 were done before the session for item 94 opened: `fold migrate` ran on
  2026-10-15 (G76), `setup` re-rendered on 2026-10-16, and items 86, 95 to 100 and 102 to 104 closed
  in the new shape. The session proved the copy from the run's backup and wrote scope item 4.
- BD-6: item 94 closed in the 2.0.0 shape, because the ledger was already frozen.
- Done when: the pre-migration `doctor` run was rebuilt from the backup over `git archive HEAD`.
  Nothing new comes from the migration (item 94's close-out names the findings). No session ran on
  2026-10-14, so the earlier context figures are from 2026-10-15 before the migration.
- The `setup` re-run dropped `archiveHome` (G77), the hazard G61 named for `ledgerFrozenAt`.

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
