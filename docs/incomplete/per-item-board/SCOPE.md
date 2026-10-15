# SCOPE: one file per board item, and a ledger that holds only what is true

**Status:** `RATIFIED` 2026-10-15: GATE 1 answered the same day, every recommendation taken (§7).
Opened 2026-10-15 as `SCOPING`. Owner: Zach. One repo, `personal-config`, at `61a3b6e`
(`point instead of ordering full reads`). The standard moves to 2.0.0 (§7, Q8).

**Why this exists.** On 2026-10-15 Zach asked for a plan to use fewer tokens across every project.
A scan of every transcript under `~/.claude/projects` (1401 sessions, 361k assistant turns, run
2026-10-15) put 65% of all cost in context re-sent on every turn, and 44% of those cache reads in
turns past the 250k Deep ceiling. The ledger and the board are read at the start of every session
in nine repos, and in the largest repo they are 632k characters together. Zach then asked whether
the board should be one file per item, read alone at the start of a chat, and what the ledger is
for and whether it can be condensed. This document lays out what exists and the choices that
decide the new shape. It decides nothing.

## 1. What exists, verified 2026-10-15

| Claim | Verified state | Citation |
|---|---|---|
| The standard defines the board as one file: a table, then one standalone prompt per item below it | Holds, in both standards | `docs/AGENT-PRACTICES.md:288-313`; `standard/AGENT-PRACTICES.short.md:104-112`; `templates/PASSOFF.md:3-4` |
| The standard defines the ledger as one file: standing sections, then a numbered append-only step log | Holds. Sections in order: Orientation, Environment, Settled, Code map, Invariants, Known facts, Step log, Style rules | `docs/AGENT-PRACTICES.md:259-286`; `templates/HANDOFF.md` |
| A `DONE` row points at the ledger step as the record | Holds: `DONE — HANDOFF 24`, and "`DONE` always points at the record" | `docs/AGENT-PRACTICES.md:299-301`, `:413`; `src/doctor/rules/board-status.ts:75,182` reads the live ledger's step numbers to check it |
| The row never leaves the board; the `DONE` prompt does; `SUPERSEDED` and `SETTLED AS NO` keep their sections | Holds, in the standard and in the fold | `docs/AGENT-PRACTICES.md:305-310`; `src/lib/fold.ts:58-70` |
| The ledger is ordered read first and in full | Holds in three places: the ledger template, the short standard, and the banner hook. R11 orders the standard in full | `templates/HANDOFF.md:3`; `standard/AGENT-PRACTICES.short.md:81,99-100`; `templates/hooks/session-banner.sh:15-16`; `docs/AGENT-PRACTICES.md:239-241` |
| This repo's router already points instead of ordering a full read | Holds since `61a3b6e` (2026-10-13): "Search it for the topic at hand" | `CLAUDE.md`, "Where work is written down"; `src/render/repo.ts:250-251` |
| The ledger is almost all step log in the largest repos | ezhomesteading: 359,358 chars, step log 354,113 (98.5%), Settled 253, Code map 3,169. felto: 222,197, step log 148,673 (67%), Style rules 40,051, Code map 17,791. personal-config: 58,491, step log 29,256 (50%) | Characters per `## ` section, counted 2026-10-15 over the three files |
| The board's weight is split between prompts and the rows table | ezhomesteading `PASSOFF.md`: 272,344 chars; the rows table 106,552 across 187 table lines; one prompt (chaos-testing P2) 120,929. felto: 298,831, four prompt bundles of 57k to 75k each | Same count, 2026-10-15 |
| `DONE` rows carry paragraphs in their cells | Holds. ezhomesteading row 7 is a multi-sentence note; usdeed row 37's status cell is ~2,000 chars, which `board-status` reports as not a status word | `~/Projects/ezhomesteading/PASSOFF.md` rows 3-12; `doctor` output 2026-10-15 for `usdeed/PASSOFF.md:37` |
| No doctor rule bounds the length of a row cell | Holds. `ls src/doctor/rules/` lists 15 rules (2026-10-15); none reads cell length. `board-status` reads the status word only | `src/doctor/rules/`; `src/doctor/rules/board-status.ts:56-60` |
| The fold already separates the two halves | Holds. `boardFold` lifts a `DONE` prompt whole by `headingBlock`; `ledgerFold` replaces a step body with a one-line stub and keeps the newest `DEFAULT_KEEP = 20` | `src/lib/fold.ts:58-70,95-109,25` |
| A fold leaves most of a ledger in place | Holds by the rule's own note: 145,950 chars became 123,774 after a fold (2026-10-13), because every step keeps a line and standing sections are never folded | `src/doctor/rules/ledger-fold-ceiling.ts:8-10`; `docs/AGENT-PRACTICES.md:887-889` |
| The ceiling rules fire across Zach's repos | `ledger-fold-ceiling` on 16 files in buy-in, cal.diy, circle-jerk, emoney, ezhomesteading, felto, furlough, portfolio and usdeed; `unfolded` on 10 of them | `bun run src/cli.ts doctor <the nine repos>`, 2026-10-15 |
| An item's section is found by its number heading, from one module | Holds. `numberedSection` (reader) and `headingBlock` (lifter) live in `markdown.ts`; `grep -rln 'numberedSection\|headingBlock' src/` returns that file and three callers: `passoff.ts`, `board-status.ts`, `fold.ts` | `src/lib/markdown.ts:46,79`; `src/commands/passoff.ts:141-150`; `src/doctor/rules/board-status.ts:168-170`; `src/lib/fold.ts:76-90` |
| The board table is the first table under the header, rows touching it; columns come from the header | Holds, so extra or reordered columns still parse | `src/lib/board.ts:36-55,77-88` |
| Item numbers are labels, not integers | Holds: `1`, `15`, `1.5` are all in use | `src/lib/board.ts:26` |
| Ledger steps are parsed from one module, in two heading forms, and the next number is max plus one | Holds | `src/lib/ledger.ts:40-53,97-99`; readers: `src/commands/handoff.ts`, `step-numbers`, `board-status`, `ledgerFold` |
| A document's kind comes from its basename; adopted names win | `HANDOFF.md` is `ledger`, `PASSOFF.md` is `board`, `INDEX.md` is `archive-index`, `SCOPE/DESIGN/PLAN/RUNTIME-PASS.md` are `project` | `src/doctor/scan.ts:62-69,78-84`; `src/lib/repo-config.ts:19-27` |
| The repo config names the two files and the archive home | `ledgerFile`, `boardFile`, `standardPath`, `archiveHome`, `trackMode` | `.personal-config.json:5-8`; `src/lib/repo-config.ts` |
| Tracking differs by repo | ezhomesteading, felto and furlough track both files; emoney, usdeed, portfolio, buy-in, cal.diy, circle-jerk and personal-config do not | `git -C ~/Projects/<repo> ls-files HANDOFF.md PASSOFF.md`, 2026-10-15 |
| An untracked ledger and board do not exist in a worktree, and a hook blocks edits to the main checkout from one | Holds, confirmed 2026-09-17 and 2026-10-02 | memory `worktree-gates-lie`; `~/.claude/hooks/personal-config/commit-guard.sh` |
| The ledger is a shared append target no collision check sees | Holds. `passoff claim` compares the files column only; two builders in one repo read the same next step number | memory `one-builder-per-repo`; `src/commands/passoff.ts:116-128` |
| `passoff claim` guards the one shared file by re-reading it before writing | Holds: it refuses when the file changed between parse and plan | `src/commands/passoff.ts:185-199` |
| The archive already receives folded text as two append-only files | `~/Projects/archive/personal-config/PASSOFF-closed.md` (377,871 bytes) and `HANDOFF-log.md` (483,958 bytes), both listed in `INDEX.md`. ezhomesteading also has an older hand-made `board-closed-items/CLOSED.md` (19,083 bytes) | `ls -la ~/Projects/archive/personal-config/`; `~/Projects/archive/ezhomesteading/board-closed-items/` |
| The short standard already names a companion file for what a ledger sheds | Holds: older steps "lose the rest to a companion file beside the ledger" | `standard/AGENT-PRACTICES.short.md:97-99` |
| Profile P is one folder per effort, and the two profiles are not exclusive | Holds | `docs/AGENT-PRACTICES.md:115-132,315-318`; `docs/choices/work-profile.md` |
| Part 7 forbids retrofitting archived work | Holds: "Do not retrofit" | `docs/AGENT-PRACTICES.md:906-910` |
| One version number covers both standards; adapted copies carry it in their stamp; `doctor` reports an older stamp as an advisory | Holds. `upgrade` is read-only on the adapted copy and writes an ask under `--write` | `standard/CHANGELOG.md:1-12`; `src/commands/upgrade.ts` header; `docs/incomplete/upgrade-command/DESIGN.md` |
| The CLI, tests, templates, skills and standard all assume one board file and one ledger file | 45 files cite them. Largest: `tests/fold.test.ts` (26 hits), `src/render/repo.ts` (23), `tests/doctor.test.ts` (21), `tests/tracks.test.ts` (20), `tests/board.test.ts` (19), `src/commands/fold.ts` (13). Six rendered skills name them: `/handoff`, `/passoff`, `/close-out`, `/clean-up`, `/delegate`, `/autopilot` | `grep -rlc 'PASSOFF\|HANDOFF\|boardFile\|ledgerFile' src templates standard tests`, 2026-10-15; `src/render/skills.ts:227,241-242,303-332,538-556` |
| The `/autopilot` skill writes a ledger step for the run itself, and only the lead writes the board and the ledger | Holds | `~/.claude/skills/autopilot/SKILL.md:17-18,213` |
| The first turn of a session is the fixed layer, not the documents | Median first-turn context is 80k to 94k across repos (cal.diy 114k), against 84k measured for the fixed layer in this repo. The documents land on turn two and later; the scan did not separate their cost per session | transcript scan, 2026-10-15; `get_usage` for this session |

## 2. What this is, and what it is not

**This is:**

- A change to §2.1 of the long standard and to "The ledger" and "What is next" in the short one,
  with the consequences in §2.3 (what `DONE` points at), Part 7 (folding), Part 9's router text
  and Appendix B.
- The two templates (`templates/HANDOFF.md`, `templates/PASSOFF.md`), the banner hook's ledger
  line, and the rendered skills that read or write the two files.
- The commands that read them: `passoff next` and `claim`, `handoff step`, `fold`, and the
  doctor rules `board-status`, `step-numbers`, `unfolded`, `ledger-fold-ceiling`, `scan`.
- A migration for the repos that already keep the old shape, bounded by Part 7's rule against
  retrofitting the archive.
- One standard version, and the `examples/` folder brought to the new shape.

**This is not:**

- A change to Profile P or its stages. A project folder stays what it is.
- A change to what a pass-off prompt contains (Part 3). The prompt moves; its nine parts do not.
- The context-size hook, the subagent model gate, or the always-on config cuts. Those are the
  plan's moves 1, 2 and 4 and have their own session card.
- The fold runs in the nine repos. They are a prerequisite and have their own card.
- A tracker, a database or a non-markdown format. Files stay markdown a person can read.
- A retrofit of `PASSOFF-closed.md`, `HANDOFF-log.md` or any archived folder.

## 3. Options

### Q1. Where an item's prompt lives

**A. One file per item in a folder beside the board; the board keeps the table.** *Recommended.*
`PASSOFF.md` holds the table and the status vocabulary. `passoff/<n>-<slug>.md` holds the item:
the dated "why it exists" paragraph, the prompt, and later its close-out. `OPEN`, `IN FLIGHT`,
`HELD`, `SUPERSEDED` and `SETTLED AS NO` files stay in the folder, because the last two carry a
reason written nowhere else. A `DONE` file leaves for the archive.

*The defense.* A session reads the table and its own file. In ezhomesteading that is the table
(bounded by Q2) plus one prompt instead of 272k characters. Two sessions on two items write two
files, which removes the one write the collision column cannot see. `passoff next` prints the
file; `claim` edits one cell. Closing an item is a move, and the fold's board half becomes that
move. `headingBlock` already knows where a section starts and ends, so the migration is the fold
pointed at a new destination.

*The strongest argument against it.* The number in the `#` cell and the number in the filename
can drift apart, and `1.5`-style ids need a filename rule. A folder of 187 files is a listing
cost in every `ls`. Every reader of `numberedSection` must learn a second location, and if that
is done in three places instead of one, they drift.

**B. Keep one file; tell sessions to read the table and their own section only.**
No code change beyond the skills and the banner.

*The defense.* Nothing to migrate.

*The strongest argument against it.* A file read is whole-file by default, and slicing by heading
is a sed call every session must get right. The rows table alone is 107k characters in
ezhomesteading, so even a perfect slice pays that. It leaves every writer on one file.

**C. Profile P for every item: a folder per item.**

*The defense.* The shape already exists, with doctor support for its four files.

*The strongest argument against it.* The standard's own choice document says it: ceremony for a
two-hour task, and a half-written `DESIGN.md` looks authoritative (`docs/choices/work-profile.md`).

### Q2. What a row holds, and what `DONE` points at

**A. The seven columns as they are; every cell is one line; `DONE — <date>`.** *Recommended.*
The record of a closed item is its own file, found by number in the archive. The close date goes
in the cell; the commit hash, what shipped and what was learned go in the file's close-out
section. A doctor rule bounds cell length (dial), so a reason or a note longer than a line goes
to the file.

*The defense.* It works the same in a tracked and an untracked repo, which Zach's repos split
seven to three on. `DONE` still "points at the record" (§2.3): the record is the file the number
names. The table shrinks to what the collision check and the banner need.

*The strongest argument against it.* A date is a weaker pointer than a step number: two items can
close on one day. The pointer only works while the archive is where the config says.

**B. `DONE — <commit>`.**

*The defense.* A hash is the strongest pointer git has, and `git show` finds the close.

*The strongest argument against it.* Seven of ten repos keep the board untracked, so the move to
the archive has no commit; the hash would name the work's commit, which may not exist yet when
the row closes.

**C. Keep `DONE — HANDOFF n`** by keeping a step log (see Q3 B).

### Q3. What the ledger keeps

**A. Standing sections only.** *Recommended.* Orientation, Environment, Settled, Code map,
Invariants, Known facts and quirks, Style rules. The numbered step log leaves. What a step
recorded goes to the item's file at close-out: what changed, why, what is fixed, which questions
it answered, what is left owed. A durable fact learned on the way goes to Known facts, as the
close-out already asks.

*The defense.* The sizes say which job the ledger does: 98.5% of ezhomesteading's is step log,
and its Settled section is 253 characters. The standing sections are the half a session needs at
start, and the 60,000-character ceiling then holds without a fold. The item number is already a
permanent address that nothing may reuse (§2.1), so the step number is a second address for the
same work.

*The strongest argument against it.* The ledger loses the single timeline. Git log gives it back
in three repos; the archive index gives a line per closed item in all of them. Work that is not
an item, such as an `/autopilot` run's own record or a scope session that built nothing, needs a
home (Q4). Every existing `DONE — HANDOFF n` citation points at a log that stops growing (Q5).

**B. Keep the log, but every step is one line from the day it is written.** The body goes to the
item file; the stub stays. The ledger grows one line per step.

*The defense.* Every citation keeps resolving, numbering is unchanged, `handoff step` is unchanged.

*The strongest argument against it.* Two records per item, and the stub is a pointer with no
content. In ezhomesteading that is still a line per step, and the number is a second id beside
the item number for no reader's benefit.

**C. Status quo with the fold.** Already shipped in 1.2.0.

*The strongest argument against it.* A fold leaves 85% of the ledger in place
(`ledger-fold-ceiling.ts:8-10`), and the file is still ordered read first.

### Q4. Where work that is not an item is recorded, under Q3 A

**A. A dated one-line log in the ledger, unnumbered, with a pointer per line.** *Recommended.*
`- 2026-10-15 · closed item 83 · passoff/83-….md (archived)`; `- 2026-10-14 · autopilot run 3,
STATE.md in docs/incomplete/…`. The fold moves lines older than a dial to the archive log.

*The defense.* It is the timeline Q3 A loses, at about a hundred characters per event, and it
needs no number because every line points at a file that has one.

*The strongest argument against it.* It is a log again, and it needs the fold to cover it or it
grows like the old one.

**B. Every piece of recorded work is a row.** A scope session is an item; an autopilot run is an
item.

*The defense.* One shape for everything.

*The strongest argument against it.* Rows for work nobody asked for as an item make the table
longer, and the table is what every session reads.

**C. Known facts only.** A run or a scope session leaves a fact or nothing.

*The strongest argument against it.* The autopilot skill's run record has findings that are not
facts about the code.

### Q5. Migration of a repo on the old shape

**A. Forward only: freeze the log, fold it to the archive whole, start item files for open rows.**
*Recommended.* The frozen log's highest number is written to `.personal-config.json`
(`ledgerFrozenAt`), and `board-status` accepts `DONE — HANDOFF n` for `n` at or below it. Open,
held, superseded and settled-as-no prompts move to files by the fold's own mechanism. `DONE`
prompts go to the archive as they do under 1.2.0.

*The defense.* It respects Part 7's rule: the archive is not reshaped. The stubs stay findable in
`HANDOFF-log.md`. It is the existing fold with one new destination and one new config key.

*The strongest argument against it.* Two shapes coexist in the archive for ever: appended logs
for the past, one file per item from the cut-over. An old `DONE — HANDOFF 24` and a new
`DONE — 2026-10-15` sit in one table.

**B. Convert: move every archived step body into the item file its `DONE — HANDOFF n` names.**

*The defense.* One shape.

*The strongest argument against it.* The mapping is many-to-one and sometimes missing (steps that
closed no item, items whose step is cited by several rows). It rewrites 484k and 378k bytes of
append-only archive in this repo alone, which Part 7 says not to do.

### Q6. Where a closed item's file goes

**A. `<archiveHome>/passoff/<n>-<slug>.md`, one file per item, with an index line.** *Recommended.*

*The defense.* It mirrors the live folder, the fold's safety order applies unchanged (append,
read back, cut), and the archive index already lists closed work one line each.

*The strongest argument against it.* In a tracked repo the file leaves git and its history with
it. The archive home's own choice document names this cost.

**B. In-tree `passoff/done/`.**

*The defense.* Tracked repos keep the record in git, and a worktree sees it.

*The strongest argument against it.* A folder of closed items in the tree is the folder nobody
reads that the archive home exists to prevent, and it is in every `ls` and every search.

**C. Append to `PASSOFF-closed.md`** as the 1.2.0 fold does.

*The defense.* Zero new shape in the archive.

*The strongest argument against it.* One file that only grows, which is the problem being solved,
moved one directory over.

### Q7. The folder's name

Derived from the board file's stem, lowercased, so a repo with `BOARD.md` gets `board/` with no
new question. Override key `itemsDir`. Three candidate defaults for `PASSOFF.md`:

- **`passoff/`** *Recommended.* Same word as the file, so a reader who knows one knows the other.
- **`items/`** Plain, but a second word for the same thing.
- **`board/`** Reads well, but the board is the table, and this folder is not the table.

File name: `<n>-<slug>.md`, where `<n>` is the `#` cell verbatim (`1.5` included) and the slug is
derived from the title once and never regenerated. The parser keys on the leading number only.

### Q8. The standard version

- **2.0.0.** *Recommended.* The `DONE` pointer changes meaning, the ledger loses a section the
  1.x text calls permanent, and a 1.2.0 skill text reading a 2.0.0 board misreads it. A major
  number tells an adopter that re-adapting is required, not optional.
- **1.3.0.** The file names and the table do not change, and the short standard already names a
  companion file. Against: an adapter reading "1.3.0" expects an additive change and gets a
  different ledger.

## 4. Dials

| Dial | Recommended default | Where it lives |
|---|---|---|
| Row cell maximum length | 200 characters; a doctor rule, not fixable | `doctor.rowCellCeiling` in `.personal-config.json` |
| Items folder name | the board file's stem, lowercased | `itemsDir`, written by `setup` |
| Ledger character ceiling | 60,000, unchanged; expected to hold without a fold once the log leaves | `doctor.ledgerCharCeiling` (exists) |
| One-line log retention (Q4 A) | 90 days, then folded to the archive log | `fold --log-days` |
| Frozen log's highest step | the number read from the file at migration | `ledgerFrozenAt` |
| Closed-file destination | `<archiveHome>/passoff/` | derived from `archiveHome` |
| Read order in the ledger's Orientation | the ledger in full (it is small), then the table, then the item | `templates/HANDOFF.md` |

## 5. Hazards this work walks into

- **Three readers of one section.** `passoff next`, `board-status` and `fold` all locate an
  item's section through `markdown.ts`. The new location must be added there, once, with the
  file as the unit, or the three drift. The test that proves it is one fixture read by all three.
- **Citations to step numbers.** `DONE — HANDOFF n` appears on every board, in the memory
  directory and in archived files. `archived-citations` matches paths, not numbers
  (`src/doctor/rules/archived-citations.ts`), so nothing reports a step citation that stops
  resolving. `ledgerFrozenAt` is what keeps them valid; the rule must read it.
- **The rows table is half the weight.** Moving prompts out of ezhomesteading's board saves 166k
  of 272k characters. The other 107k is in the cells. Without the cell-length rule the change
  saves less than half of what it looks like.
- **Untracked repos and worktrees.** An item file in an untracked `passoff/` is absent from a
  worktree, the same as the board is. A builder in a worktree can write its own item file only if
  the folder is tracked. `trackMode` already decides this per repo; the ignore entries
  (`src/render/repo.ts:416-440`) must add the folder, anchored to the root.
- **The fold's safety order.** Append to the archive, read it back, then cut. A move is one
  operation on disk but must still be verified by a read-back before the live file is edited.
- **`1.5` and other non-integer ids.** Filenames must carry them verbatim, and sorting a
  directory listing by name puts `10` before `2`; the parser sorts by the board's row order, not
  the listing.
- **Sixteen adapted standards and six rendered skills** carry 1.2.0 text that says "one prompt
  per item below the board". `upgrade` writes an ask, never the document; `doctor` reports the
  old stamp as an advisory only. A repo can run a 2.0.0 CLI against a 1.2.0 skill text until
  `setup` is re-run there. `stamp-drift` already fires in tv, wm-courses, usdeed-notes and
  swamp-magazine for older reasons.
- **Test surface.** `fold.test.ts` (26 references), `board.test.ts` (19), `doctor.test.ts` (21),
  `tracks.test.ts` (20) and the golden `full-track.json` all encode the one-file shape.
- **Autopilot's lead writes the ledger and the board alone.** With item files, builders could
  write their own file; the skill text must say whether they may, or the lead keeps that right
  and the collision rule is unchanged.
- **The one shared write that remains** is the status cell. `claim` guards it by re-read. Two
  sessions closing two rows at once still edit one file; the window is smaller, not zero.

## 6. Open questions for GATE 1

1. Q1: one file per item (A), the section-only read (B), or Profile P per item (C)?
2. Q2: `DONE — <date>` (A), `DONE — <commit>` (B), or keep step pointers (C)?
3. Q3: standing sections only (A), one-line steps (B), or the fold as shipped (C)?
4. Q4, if Q3 A: a dated one-line log (A), a row per piece of work (B), or Known facts only (C)?
5. Q5: forward-only migration with a frozen log (A), or convert the archive (B)?
6. Q6: closed files to `<archiveHome>/passoff/` (A), in-tree `passoff/done/` (B), or appended to
   `PASSOFF-closed.md` (C)?
7. Q7: `passoff/`, `items/` or `board/` as the default folder name?
8. Q8: standard 2.0.0 or 1.3.0?
9. Row cell ceiling: 200 characters, or another number?
10. May an autopilot builder write its own item file, or does the lead keep every write?

## 7. GATE 1 answers, 2026-10-15

Asked in chat in one batch on 2026-10-15, the turn the document was finished. Zach took every
recommendation in one reply. Each answer below is the decision; the defense and the argument it
beat stay in §3 under the same question number.

1. **Q1: A.** One file per item in `passoff/`, the board keeps the table. `OPEN`, `IN FLIGHT`,
   `HELD`, `SUPERSEDED` and `SETTLED AS NO` files stay in the folder; a `DONE` file leaves.
2. **Q2: A.** Every cell is one line. `DONE — <date>`; the record is the archived item file,
   found by number. The commit hash and what shipped go in the file's close-out section.
3. **Q3: A.** The ledger keeps its standing sections only: Orientation, Environment, Settled,
   Code map, Invariants, Known facts and quirks, Style rules. The numbered step log leaves. What a
   step recorded goes to the item's file at close-out; a durable fact goes to Known facts.
4. **Q4: A.** A dated one-line log in the ledger, unnumbered, one pointer per line, for work that
   is not an item. The fold moves lines older than the retention dial to the archive log.
5. **Q5: A.** Forward only. The log is frozen at its highest number, that number is written to
   `.personal-config.json` as `ledgerFrozenAt`, `board-status` accepts `DONE — HANDOFF n` at or
   below it, and the frozen log is folded to the archive whole. The archive is not reshaped.
6. **Q6: A.** A closed file goes to `<archiveHome>/passoff/<n>-<slug>.md`, one file per item,
   with an index line, under the fold's safety order: append, read back, then cut.
7. **Q7: `passoff/`.** Derived from the board file's stem, lowercased; `itemsDir` overrides it.
   File name `<n>-<slug>.md`, the `#` cell verbatim, the slug derived once and never regenerated.
8. **Q8: 2.0.0.**
9. **Row cell ceiling: 200 characters**, a doctor rule, not fixable, `doctor.rowCellCeiling`.
10. **The lead keeps every write to the table.** A builder writes its own item file only when the
    folder is tracked.

What this ratification opens: Stage 3 (`DESIGN.md`, decisions `D1` onward with their defenses and
the rules that survive unchanged) and Stage 4 (`PLAN.md`, phases with done-when), ending at GATE 2.
No code before GATE 2.
