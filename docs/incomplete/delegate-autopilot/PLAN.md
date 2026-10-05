# Plan: `/delegate` and `/autopilot` as skills the tool installs

Design: `DESIGN.md`, `RATIFIED` 2026-10-03 (D1 to D19). This plan turns it into three phases.

**Status.** `PLANNED` 2026-10-04, Opus 5.5 (board row 81). Approved at GATE 2 the same day: Zach
answered "all recommended", recorded in §7 with the questions as asked. Five of the answers are
design decisions and are `DESIGN.md` D20 to D24. The plan authorizes the whole run, and the phases
do not each need approval again. Board rows 83, 84 and 85 carry the three phases.

## 0. Facts verified 2026-10-04 (supersede the design where they differ)

A second pass, run on `3fadd95` in the primary checkout by the session that wrote the design.

### Re-check of G1 to G15

| # | At `3fadd95` | Citation |
|---|---|---|
| G1 | Holds | `src/render/skills.ts:17`, `:56-63` |
| G2 | Holds | `src/render/skills.ts:24`, `:45-48` |
| G3 | Holds as written; see G41 for what it does not say | `src/render/context.ts:77-99` |
| G4 | Holds; the question spans the cited lines exactly | `src/questions/you.ts:383-403`, `src/render/skills.ts:52` |
| G5 | Holds | `profiles/starter.json:23`, `profiles/pro.json:27`, `profiles/zach.json:27` |
| G6 | **Moved.** `dfdae1f` holds (ten files, `git show --stat dfdae1f`), but `tests/tracks.test.ts:281` pins five skills for code, full, *no git* (`CODE_FULL_NO_GIT`, `:56`), and stays five under D1. The code, full, git pin is the golden's key count, 68, at `:194` (G42) | `tests/tracks.test.ts:55-56`, `:194`, `:281` |
| G7 | Holds; the grep also prints `src/render/rules.ts:16`, `:129` and `src/questions/you.ts:256`, `:275`, all the routing answer's text or comments | `grep -rni delegate src templates`; `grep -rni autopilot src templates docs/choices profiles standard catalog.json README.md tests` printed nothing |
| G8 | Holds | `grep -rniE "ScheduleWakeup\|/loop\b\|get_usage" src templates docs/choices standard` printed nothing |
| G9 | Holds | `src/render/rules.ts:26`, `:109-111`, `:140-141` |
| G10 | Holds; `modelIds.mechanical` and `modelIds.light` are asked under the same ceiling condition, so the range is longer | `src/questions/you.ts:166`, `:184`, `:193`, `:233`; `src/questions/discover.ts:263-343` |
| G11 | Holds; 195 lines, the model line at `:152` | `standard/AGENT-PRACTICES.short.md` |
| G12 | Holds | `src/commands/passoff.ts:146`; `src/commands/context.ts:9`, `:22-23` |
| G13 | Holds; row 78 is still `OPEN` | `src/questions/you.ts:101`, `:107`, `:113`; `PASSOFF.md:88` |
| G14 | **Moved lines**, same behavior: the `guard` type and `stampGuard` | `src/lib/write-plan.ts:20`, `:101-108` |
| G15 | Holds; rows 77, 78 and 79 all `OPEN` | `PASSOFF.md:87-89` |

### New facts

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G40 | The gates are green on `3fadd95` | `bun run typecheck` exit 0, no output; `bun run lint` clean, 158 files; `bun test` 945 pass, 0 fail, 72 files; `bun run doctor . examples` no findings over 86 and 7 markdown files. The tree also held an uncommitted `.gitignore` change that is not this item's | run 2026-10-04 |
| G41 | Project folders write no board and no ledger | `renderWorkRecord` renders folders or the ledger and board, never both (`src/render/repo.ts:256`); the repo record's `ledgerFile` and `boardFile` are empty under `folders` (`:373-374`). `hasBoard` reads the weight only (`src/render/context.ts:98-100`), so a code, full target on folders reads `board: true` in the skill shape and has no board on disk | the code |
| G42 | The golden covers exactly the shape these skills render in | Three variants (`tracked`, `untracked`, `team`), each code, full, git, with `skills: all` and `modelRouting: delegate-or-stop` (`tests/tracks.test.ts:39-42`, `:164-180`; `tests/helpers.ts:156`). Each variant holds five skill keys and `~/.claude/rules/model-routing.md`; 68 keys in all (`:194`) | the files |
| G43 | The `skills` long form is wrong about a same-named skill | "If you already have a skill by one of these names, its file is backed up before it is replaced" (`docs/choices/skills.md`, "What it writes and where"). The stamp guard refuses a file with no stamp instead (G14). A hand-written `/delegate` is that case | the files |
| G44 | A personal skill wins over a project skill of the same name | "Enterprise over personal, and personal over project. With `deploy` in both `~/.claude/skills/` and the project's `.claude/skills/`, `/deploy` runs the personal one." Moving the folder out of `~/.claude/skills/` frees the name, whatever sets it | Context7 `/websites/code_claude`, page `slash-commands`, queried 2026-10-04 |
| G45 | What `disable-model-invocation: true` does | Only the person can invoke the skill; its description is not in the model's context; a model's call is blocked and Claude Code tells the model not to reproduce the steps another way | same page, "Control who invokes a skill" |
| G46 | This session's tools, 2026-10-04, desktop app | `ScheduleWakeup`; `AskUserQuestion` (1 to 4 questions per call, 2 to 4 options each, a header of at most 12 characters, `multiSelect`); `Agent` (`model`: `sonnet`, `opus`, `haiku`, `fable`; `isolation: "worktree"`; background by default); `Workflow`; and, as deferred tools, `SendMessage`, `Monitor`, `PushNotification` and `mcp__ccd_session_mgmt__get_usage`. This confirms G33, G38 and G39 in the desktop app. The plain terminal was not checked (R10) | this session's tool list |
| G47 | The tier ceiling, where a repo has one | The router carries a "Tier ceiling" section when the ceiling is below Deep and routing is `delegate-or-stop` (`src/render/repo.ts:182-200`); `.claude/settings.local.json` lists the allowed models (`src/render/ceiling.ts:13-40`); `/passoff` says never to assign above it (`templates/skills/passoff.md:17-18`) | the code |
| G48 | What `doctor` accepts for a `HELD` row | Its "Waits on" cell must contain a digit, a slash or a file extension (`NAMES_SOMETHING`, `src/doctor/rules/board-status.ts:105-111`) | the code |
| G49 | Zach's global prose hook covers templates written here | `~/.claude/hooks/no-em-dash.sh` blocks a `Write` or `Edit` of a prose file outside `/.claude/` carrying an em dash, a contraction or a listed phrase (its list at `:26`). The five shipped templates carry 41 em dashes between them (`grep -c` per file: `clean-up` 13, `scope` 14, `handoff` 6, `close-out` 5, `passoff` 3), so a new template copied from their style is blocked | the script; `templates/skills/*.md` |
| G50 | The next free numbers, as read now | The board ends at row 82 (`PASSOFF.md:92`) and the ledger at step 97 (`HANDOFF.md:1356`). Read both again before writing either | the files |
| G51 | `passoff next` takes board order | "The next `OPEN` row in board order ... nothing in the row says which of two lanes matters more" | `src/commands/passoff.ts:57-62` |
| G52 | A worktree session cannot write the primary checkout | HANDOFF 96: the harness refused an edit to the main checkout from a worktree session, and Zach inserted the rows by hand | `HANDOFF.md:1352` |
| G53 | G20's citation is stale | `HANDOFF.md:1456` predates the folds; step 92 is at `HANDOFF.md:1266`, and its audit paragraph at `:1274` | the file |

### Re-check for Phase 1, 2026-10-04, at `d9d7e1e` (rows 77, 78 and 79 committed)

| # | At `d9d7e1e` | Citation |
|---|---|---|
| G1 | Holds | `src/render/skills.ts:17`, `:56` |
| G2 | Holds | `src/render/skills.ts:24`, `:47` |
| G4 | Holds | `src/questions/you.ts:384-403`, the `all` label at `:393` |
| G9 | **Moved lines**, same text: "a Deep subagent never builds" | `src/render/rules.ts:143-144` |
| G14 | Holds | `src/lib/write-plan.ts:20`, `:35` |
| G41 | Holds | `src/render/context.ts:98-100`; `src/render/repo.ts:373-374` |
| G42 | **Moved.** Row 78 added `hooks/personal-config/commit-policy` to every variant, so the golden holds 71 keys, pinned at `tests/tracks.test.ts:225`; the no-git pin of five skills is at `:312`. Phase 1 takes the golden from 71 to 74, and Phase 2 from 74 to 77 | `tests/tracks.test.ts:225`, `:312`; `tests/golden/full-track.json` |
| G54 | An array `skills` answer renders no skill at all: `answer()` returns its fallback for a value that is not a string, so `renderSkills` reads `none` and `selected()` is never reached. Older than this effort, and outside its files | `src/render/context.ts:14-17`; `src/render/skills.ts`, `selected` |

### Re-check for Phase 2, 2026-10-05, at `f6f13ea` (row 83 committed)

G1, G2 and G4 hold at their Phase 1 lines (`src/render/skills.ts:19`, `:26`; `src/questions/you.ts:393`).
G42 holds at 74 keys (`tests/tracks.test.ts:232`), so Phase 2 takes the golden from 74 to 77. Part 5's
Default ceiling is still about 400k, measured 2026-08-16 (`standard/AGENT-PRACTICES.boilerplate.md:547`,
`:551`); row 82 is still `OPEN`, so D14's dated sentence cites that figure. G46 holds in this session:
`ScheduleWakeup` and `Agent` are loaded, and `SendMessage`, `PushNotification` and
`mcp__ccd_session_mgmt__get_usage` are deferred tools.

## 1. Decisions taken since ratification

Build-level calls that implement the design. Each carries its reversal. BD-14 and BD-15 change a
file a person reads, so they are named in GATE 2's question 7.

- **BD-1. The `model-routing.md` sentence renders only where both skills render, through one
  predicate exported from `src/render/skills.ts`.** The rules renderer reads it, as `hooks.ts`
  reads `wantsWriteDocHook` (HANDOFF 93), so the sentence and the skills cannot disagree. Under
  `warn-only` the rule has no "never builds" line, so it gets no sentence. *Reversal:* render the
  sentence wherever `delegate-or-stop` renders.
- **BD-2. The template writes the relay contract out in full, with DIAL-9's numbers, where the
  personal skill cited "Part 5's budget-relay contract".** Row 81's prompt removes the Part
  citations (G19); the contract is what the citation pointed at, and a builder's brief needs its
  text. *Reversal:* name the standard's section by its subject.
- **BD-3. `/autopilot` loads `/delegate` once, at its start, with the Skill tool.** Each load adds
  the skill's text to the orchestrator's context again, and the steps do not change between rows.
  *Reversal:* load it per row.
- **BD-4. `/autopilot`'s first line refuses a run the person did not type.** For a harness that
  ignores the frontmatter flag (D2's argument against). *Reversal:* delete the line.
- **BD-5. Both skills stop when they run outside the primary checkout.** The check is that `git
  rev-parse --show-toplevel` equals the first path `git worktree list` prints. The board and the
  ledger are written there (D9), and a worktree session cannot write it (G52). *Reversal:* drop the
  check.
- **BD-6. The auditor reproduces the builder's change in its own worktree.** Under `print-blocks`,
  from the builder's diff against `HEAD` plus its untracked files; under `agent-commits`, from the
  builder's branch. It never writes the builder's worktree, which is what keeps a review
  read-only (Part 4's rule on shared worktrees). *Reversal:* the auditor runs the gates in the
  builder's worktree.
- **BD-7. A run folder for a date already used takes a suffix**, `autopilot-<date>-2` and so on.
  *Reversal:* one folder per date, appended to.
- **BD-8. `STATE.md` and `RUNDOWN.md` use absolute times with their zone, and no relative-date
  word.** `doctor`'s `relative-dates` rule scans `docs/incomplete/` (D4's argument against).
  *Reversal:* none needed; a breach is a finding.
- **BD-9. After a stop cap, a blocking verdict holds the row; no new fix round starts.** D5 lets
  in-flight work finish and its reviews run; a fix round is new work. *Reversal:* allow fix rounds
  up to DIAL-6 after a cap.
- **BD-10. A row above the repo's tier ceiling is held, never lifted.** The ceiling is a per-repo
  budget the person set (G47, tier-ceiling D2). *Reversal:* let the opening round lift it as it
  lifts a Deep row.
- **BD-11. Only a person lifts a Deep row**: their own `/delegate` on that row, typed in the
  session, or an answer in the opening round. A `/delegate` the model loaded on its own lifts
  nothing. This is what D6's "the owner named it" means once `/delegate` stays model-invocable
  (D2). *Reversal:* none short of a new D6.
- **BD-12. `/autopilot` carries the hazards as standing orders** (`DESIGN.md` §4.2.9): `git -C`
  and absolute paths, stop on an ignored file that cannot be copied, no services outside the repo,
  numbers reported, stop on a file the row does not list. *Reversal:* drop any line.
- **BD-13. At the end, where a push notification tool exists, the run sends one line naming the
  rundown's path.** The overnight run did (G23). *Reversal:* drop it.
- **BD-14. The sentence and the label each arrive in two steps.** Phase 1 renders the sentence
  without its `/autopilot` clause and adds `/delegate` alone to the `all` label; Phase 2 gives both
  their final text (`DESIGN.md` §4.3, D16). Between the two commits, neither names a skill that
  does not yet exist. `model-routing.md`'s three golden hashes move in both phases. *Reversal:* one
  build phase for both skills.
- **BD-15. Phase 1 corrects the `skills` long form's "backed up before it is replaced"** (G43),
  and says how to take the shipped skill over a hand-written one: move the person's own folder out
  of `~/.claude/skills/` (G44), then run `setup`. *Reversal:* none; the sentence is false.
- **BD-16. A held row's "Waits on" cell names the file its reason is written in**, the run's
  `RUNDOWN.md` or the row's findings, so `doctor`'s `HELD` rule passes (G48). *Reversal:* any other
  wording with a digit, a slash or an extension.
- **BD-17. The Phase 1 `/delegate` text leaves out §4.1's `/autopilot` clauses**, the three
  places it says what happens "under `/autopilot`": an owner question the opening round asked, a
  Deep row the opening round lifted, and hand-back blocks that go to the rundown. BD-14 applies
  the same rule to the sentence and the label: between the two commits, nothing names a skill
  that does not exist yet. Phase 2 adds them, and owns `templates/skills/delegate.md` for it.
  *Reversal:* write the clauses now.
- **BD-18. `tests/clean-up-skill.test.ts` gains `delegate` in its list of what code + full + git
  installs.** The file is not in Phase 1's list, but its first test pins the exact skill names on
  that track, so it goes red the moment the offer changes. One name added, and the test's title.
  *Reversal:* none; the pin is wrong without it.
- **BD-19. The skill's tier table has two columns, Tier and Model**, where §4.1 asks for it "as
  `tierTable` renders it". The `<unset>` rule and the Light row's condition are `tierTable`'s; its
  "Use for" column is left out, because its text carries em dashes the template's style forbids,
  and the item names its own tier. *Reversal:* add the column with that text reworded.
- **BD-20. The `model-routing.md` sentence takes its form from the skills that render.** On a
  board both skills render and the sentence is §4.3's final form; on project folders `/delegate`
  renders alone (D22), and the sentence keeps its Phase 1 form, which names no `/autopilot`. This
  is BD-1 and BD-14 applied to D22's shape. *Reversal:* the final form everywhere `/delegate`
  renders.
- **BD-21. The Fable review's blocking findings are fixed in the text, each inside a ratified
  decision** (Phase 2, As built). A cap with rows still runnable ends the run once nothing is in
  flight (D5). Each wake launches before it checks the stop rules, and the run ends when nothing is
  in flight after the launches, except a hold with a timer (D3). Two runnable rows that overlap each
  other never launch together (§4.1 step 5). A hook-blocked commit under `agent-commits` is recorded
  as not committed, and its successor is held for it (D10, D24). A builder's question for the owner
  is taken only where it implements a settled decision, and otherwise holds the row (D8). `STATE.md`
  gains a **Reports** section holding everything the rundown needs, and the rundown is written from
  it (D13, D14). *Reversal:* none; each restores a decision the text broke.
- **BD-22. A lane runs in order through its finished rows only.** §4.2.2's "the first `OPEN` row of
  its lane" let a row run past a `HELD` predecessor. The text now requires every row before it in
  its lane to be `DONE`, `SUPERSEDED` or `SETTLED AS NO`, which is the reason §4.2.2 gives. *Reversal:*
  §4.2.2's words.
- **BD-23. `/delegate`'s auditor brief carries rules of its own**: no edit to the ledger, the board or
  the builder's worktree (D9); its worktree brought to the base branch before it reproduces the change;
  each gate reported with its output and its diffstat. A verdict without them is audited again once,
  then the item is held. An item that needs a Deep review the tier ceiling forbids is held (BD-10).
  On project folders the collision check reads the files a phase names, where it names them (D22).
  *Reversal:* drop any line.
- **BD-24. `/delegate` is loaded once and again after a compaction** (BD-3 amended). The wake prompt
  says to reload either skill when it is no longer in context. *Reversal:* BD-3's words.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | `/delegate`: the template, the offer, the tier names, the sentence's first form, the long form | Default | none | comfortable | `/autopilot` loads it, so it goes first and stands alone. Its golden diff (3 new keys, 3 moved) is read before the larger text moves anything |
| 2 | `/autopilot`, the final sentence and label, and one Deep review of both texts | Default | one Deep review (Fable 5.1) | full | The loop is the longest text and the silent failure (D15). The review waits until both texts exist, so one review covers both |
| 3 | The supervised runtime pass | the owner, with a Default session to set up and record | none | comfortable | Only a person can start `/autopilot` (D2), and a review of text cannot show the loop running (D15's argument against) |

All three run in lane B, in this order. Phases 1 and 2 each change `catalog.json`, `README.md` and
`CHANGELOG.md`, which rows 77 to 79 own, so Phase 1 waits on all three; it also waits on row 78 for
what `agent-commits` means (D10). Rows 78 and 79 are marked "scope first", so the wait may be long.
Board rows 83, 84 and 85 carry Phases 1, 2 and 3.

### Phase 1. `/delegate`

**Status.** `BUILT 2026-10-04`, not yet committed (HANDOFF 103). Board row 83.

**As built.** Opus 5.5, in the primary checkout on `main` at `d9d7e1e`, with no subagent, as the
phase says. Scope items 1 to 8 as written, with three build-level calls: BD-17 (no `/autopilot`
clause in the skill yet), BD-18 (`tests/clean-up-skill.test.ts` gains one name) and BD-19 (a
two-column tier table). The golden went from 71 to 74 keys (G42 moved), and the diff was exactly
three new `skills/delegate/SKILL.md` keys and three moved `rules/model-routing.md` hashes. Gates:
`bun run typecheck` 0, `bun run lint` clean over 162 files, `bun test` 1497 pass and 0 fail over
76 files, `bun run doctor . examples` no findings. The rendered skill was read against §4.1 step by
step, for a board and for project folders, under `print-blocks` and `agent-commits`; the rendered
`model-routing.md` holds the sentence once, between "that tier is for." and "Never do the work
yourself". `bun run setup --profile zach --yes --dry-run --projects-dir tests/fixtures` lists
`~/.claude/skills/delegate/SKILL.md` as "no stamp, left alone". Found and left open:
`docs/choices/config-weight.md` still says "five workflow skills" (`:6`, `:49`), a file outside
this phase's list; and G54.

**Scope.**

1. `templates/skills/delegate.md`, new: `DESIGN.md` §4.1, step by step, with D23's description. No
   em dash, contraction or listed phrase (G49), no model family name (D12), no Part number (BD-2).
   Variables: the four tier names; the commit clause for `print-blocks` and for `agent-commits`; the
   record step for a board and for project folders (D22); the ledger and board file names.
2. `src/render/skills.ts`: add `delegate` to what code, full, git is offered (D1), on both
   work-record shapes (D22). Its variables: tier names from `ctx.config.models`, `<unset>` where
   empty, the Light row only under `modelLightEnabled: yes` (as `tierTable` does,
   `src/render/rules.ts:94-107`); the commit clause from `commitPolicy`; the record shape from
   `workRecordShape`. Export the predicate BD-1 needs.
3. `src/render/rules.ts`: the sentence without its `/autopilot` clause, after `:141`, under BD-1's
   predicate (BD-14).
4. `src/questions/you.ts:393`: the `all` label gains `/delegate` (BD-14).
5. `docs/choices/skills.md`: `/delegate`'s entry, its defense, the strongest argument against it,
   what it writes, how to undo it, and which tracks get it; BD-15's correction.
   `docs/choices/model-routing.md`: one line under "What it writes and where" naming the exception
   and where it renders.
6. `README.md` (the skills row at `:73`, the uninstall list at `:338`), `CHANGELOG.md` (the
   `Unreleased` section), `bun run catalog`.
7. Tests. A new `tests/delegate-skill.test.ts` (X1): offered on code, full, git with `skills: all`,
   on a board and on project folders, where it records through the phase header (D22); not under `skills: none`, light, non-code full or code full without git (the `:281` pin stays
   five); each configured tier name appears in the rendered text and `<unset>` where a name is
   empty; the template holds none of `fable`, `opus`, `sonnet`, `haiku` and no `Part ` followed by a
   digit; the stamp sits below the frontmatter and no placeholder is left; each commit policy
   renders its clause; the rendered `model-routing.md` holds the sentence once under
   `delegate-or-stop` on that track, and not under `warn-only`, `skip`, `skills: none` or non-code
   full. The golden: 68 to 71 keys, plus the three `model-routing.md` hashes; update only the keys
   that move, with a scratch script, and add a docstring paragraph at `tests/tracks.test.ts:102-163`
   naming them, as the `/clean-up` paragraph does.
8. `RUNTIME-PASS.md`, new in this folder: Phase 1's entry, the skill in a live session on one
   ordinary row.

**Subagents.** None.

**Done when.** `bun run typecheck`, `bun run lint`, `bun test` and `bun run doctor . examples` exit
0. Then the proof a gate cannot give. Render code, full, git into a temporary home, or, where the
harness refuses a command that sets `HOME` (as it did in HANDOFF 92), print the rendered text from a
scratch script that calls `renderAll`. Read the rendered `SKILL.md` against `DESIGN.md` §4.1 step
by step, and the rendered `model-routing.md` for the sentence, once. On Zach's machine, `bun run
setup --profile zach --yes --dry-run --projects-dir tests/fixtures` shows
`~/.claude/skills/delegate/SKILL.md` refused for its missing stamp: that refusal is the proof that a
hand-written skill survives.

**Watch for.** The golden diff: exactly three new keys and three moved `model-routing.md` hashes,
and any other moved key stops the phase. The description decides when the model loads the skill,
so it is GATE 2's copy, word for word. The global hook on every template write (G49). The engine's
personal-string test.

### Phase 2. `/autopilot` and the Deep review

**Status.** `BUILT 2026-10-05`, not yet committed (HANDOFF 104). Board row 84.

**As built.** Opus 5.5, in the primary checkout on `main` at `f6f13ea`. Scope items 1 to 8 as written,
with BD-17 reversed (the `/autopilot` lines added to `/delegate` on a board only) and BD-20 to BD-24.
The golden went from 74 to 77 keys: three new `skills/autopilot/SKILL.md` keys and three moved
`rules/model-routing.md` hashes, as planned, and three moved `skills/delegate/SKILL.md` hashes, which
the watch line did not name and which this phase's own `delegate.md` edit moves. No other key moved.

*The Deep review.* One Fable 5.1 subagent (`model: fable`, `isolation: "worktree"`), 2026-10-05, read
only; its worktree was removed unchanged, and the scratch inputs were unchanged after it. Input: both
rendered skills under both commit policies, on a board and on project folders, the rendered
`model-routing.md` and `commits.md`, `DESIGN.md` §3 to §5 and this file's §1 and §3. Verdict: six
blocking and seven non-blocking findings, all fixed in this phase, none parked. Blocking: (1) a cap
with rows still runnable never ended the run; (2) without a timer the run ended before launching the
next rows; (3) two runnable rows that overlap each other launched together; (4) under `agent-commits`
a hook-blocked commit was recorded as a commit and the next row built on an empty branch; (5) a
builder's question for the owner had no route and could be signed off; (6) the rundown's content lived
only in context. Fixed by BD-21. Non-blocking: (7) the auditor's brief lacked the no-write rule and
gate output, and (8) its base-branch step, BD-23; (9) a Deep review above the ceiling, BD-23; (10) a
`HELD` row unblocked its lane, BD-22; (11) no timer and a limit, the stop rules; (12) no reload after a
compaction, BD-24; (13) project folders have no "Files it owns", BD-23. None changed a D decision, so
none went to Zach before its edit (R12).

Gates: `bun run typecheck` 0, `bun run lint` clean over 163 files, `bun test` 1520 pass and 0 fail over
77 files, `bun run doctor . examples` no findings. Both texts were rendered and read against §4.2 and
§4.1 after the fixes. `RUNTIME-PASS.md` carries Phase 2's entries and the supervised run.

**Scope.**

1. `templates/skills/autopilot.md`, new: `DESIGN.md` §4.2. Frontmatter with
   `disable-model-invocation: true` (D2) and D16's description. The dial defaults written once
   (D17, DIAL-11). The opening round's content fixed and its words left to the session (D21);
   board order when the caps bind (D20); a row after an uncommitted one held or branched (D24).
   BD-3, BD-4, BD-5, BD-7 to BD-13 and BD-16.
2. `src/render/skills.ts`: `autopilot` offered with `delegate`, where a board is written only
   (D22); its variables (tier names, the commit clause, the ledger and board names).
3. `src/render/rules.ts`: the sentence's final form, `DESIGN.md` §4.3.
4. `src/questions/you.ts:393`: D16's label.
5. `docs/choices/skills.md`: `/autopilot`'s entry. Its strongest argument against is D2's (an
   overnight loop in a beginner's list) and D11's (a harness change breaks the loop silently). What
   it writes: the skill file at setup, and at run time a folder in the repo (D4). The undo.
   `docs/choices/model-routing.md`: the line's final form.
6. `README.md`, `CHANGELOG.md`, `bun run catalog`.
7. Tests. A new `tests/autopilot-skill.test.ts`: offered where `/delegate` is, except on project
   folders (D22); its
   frontmatter carries `disable-model-invocation: true` and `/delegate`'s does not; each dial
   default appears once; the rundown's sections appear in D13's order; the template says four
   questions per call; no family name, no Part number, no placeholder left. The golden: 71 to 74
   keys, plus the three `model-routing.md` hashes again, with a docstring paragraph.
8. `RUNTIME-PASS.md`: Phase 2's entries, the supervised run among them (Phase 3's scope, written
   out).

**Subagents.** One Deep review, Fable 5.1, `model` passed explicitly, in a worktree of its own,
after the tests pass. Its input: both rendered `SKILL.md` files and `DESIGN.md` §3 and §4. Its
whole output is a verdict on six questions, each finding with a citation:

1. Followed literally, can `/autopilot` build a row it must hold: a Deep row not lifted, a row with
   an open owner question, a row whose files overlap a row in flight, a row above the ceiling, a
   row after an uncommitted one (D24)?
2. Can it stop before a cap, run past one, end with agents in flight, or go idle with nothing
   scheduled while work remains?
3. Does anything the run needs after an automatic compaction live only in context, not in
   `STATE.md`?
4. Can `/delegate` sign off a change its auditor did not reproduce, or let a builder or an auditor
   edit the board or the ledger?
5. Does any line contradict the rendered `model-routing.md` with §4.3's sentence, the commit rule
   for either policy, or D1 to D19?
6. Does any wording invite a question to the owner after the opening round, or a pick of copy?

Check its diffstat when it returns. Each finding is fixed in this phase or parked by Zach (R9), so
`templates/skills/delegate.md` and its suite are in this phase's files.

**Done when.** The four gates exit 0. The Deep verdict is recorded under this phase's `As built:`
note, each finding fixed or parked. Both texts rendered as in Phase 1 and read against
`DESIGN.md` §4. `RUNTIME-PASS.md` carries the supervised run's entry in the three-line form.

**Watch for.** The text is the product: an ambiguous line in the opening round becomes a wrong
night with nobody there. Row 82 may have changed Part 5's figure by then; D14's dated sentence cites
the figure as it stands at build time. The golden, as in Phase 1. G49.

### Phase 3. The supervised runtime pass

**Status.** Not started. Board row 85. Waits on row 84.

**Scope.**

1. *Before, a Default session with the owner.* Phases 1 and 2 committed. The shipped pair installed
   in the owner's real home by `personal-config setup`. On a machine with a hand-written
   `/delegate`, the owner first moves that folder out of `~/.claude/skills/`, and swaps it back
   after the pass (GATE 2 answer 6), because a personal skill wins over a project one (G44) and the
   pass would otherwise run the wrong `/delegate` without saying so.
2. *A scratch repo.* A new git repository outside this one, set up with `personal-config setup` for
   code work on the full setup in git with `skills: all`, its first commit made by the owner. Two
   rows in two lanes with no shared files: one Mechanical (add a file and a test for it), one
   Default (a small change with a gate). Each has a full prompt, a "Files it owns" cell and no
   owner question.
3. *The run.* The owner opens a session in the scratch repo on the Default tier, types
   `/autopilot`, answers the opening round with a 30-minute end time, and watches.
4. *What the right answer is.* The first call asks at most four questions. `STATE.md` appears under
   `docs/incomplete/autopilot-<date>/` before any builder starts. Each row is `IN FLIGHT` before
   its builder launches. Each builder runs in its own worktree on its row's family, and each row
   gets an auditor in a second worktree. Each signed-off row gets a ledger step naming its worktree
   and "not yet committed", and its row reads `DONE` against that step. `STATE.md` gains a reading
   per wake. No agent edits the board or the ledger except the orchestrator, and no agent commits
   under `print-blocks`. Launches stop by the 30-minute mark. `RUNDOWN.md` holds D13's sections in
   order, and the run's step points at it.
5. *After.* The results go under the entry in `RUNTIME-PASS.md`, each finding folds back as a new
   board item (Part 7), and `DESIGN.md` gets `As built:` notes where the run departed from a
   decision.

**Subagents.** None of its own. The run under test spawns its builders and auditors.

**Done when.** The entry is walked by the owner, its results are written, and every finding has a
board row or is parked by Zach. R10: "walked" here means seen running in a live session.

**Watch for.** G44. The commit guard blocks an agent's commit in the scratch repo as it does here,
which is correct under `print-blocks`. The scratch repo's first commit is the owner's.

## 3. Dials

DIAL-1 to DIAL-10 are the design's (§5), at their ratified values. One more comes from the plan.

| Dial | What it sets | Recommended value |
|---|---|---|
| DIAL-11 | How many `AskUserQuestion` calls of row questions the opening round may make, after the run questions | 3 calls, so at most 12 row questions. A row whose questions are not reached is held (D8) |

## 4. Seams reserved, deliberately not built

- **A usage gauge for the plain terminal** (O3, C1 B).
- **`/delegate` on the short track** (O1, B), and both skills without git (O1, C).
- **`/autopilot` on project folders** (D22): a second reading procedure over `PLANNED` phases.
- **Landing a run's worktrees** (D19).
- **A command that runs the loop** (`DESIGN.md` §2).
- **Part 5's re-measured ceilings**, board row 82 (D18).
- **A `doctor` rule for a run folder's shape.** The rundown's sections are fixed (D13); nothing
  checks them but a reader.
- **The release cut and the portfolio pin bump**, Zach's to run after Phase 2.

## 5. Repo hazards, with live numbers

- **G40's numbers are the baseline**: 945 tests, 72 files, 158 linted files, no `doctor` findings.
  A phase that ends below them has lost something.
- **The golden moves on purpose in Phases 1 and 2 only**: 68 keys to 71, then to 74, and the three
  `model-routing.md` hashes in each. Any other key that moves is a defect.
- **Zach's hand-written `/delegate`** is refused by the stamp guard on every `setup` run on his
  machine until he moves it (G14). The preview shows it; nothing is lost.
- **One builder per repo.** `HANDOFF.md` is a shared append target no collision check sees, so the
  phases run one at a time, and no other build runs in this repo alongside them.
- **A worktree's gates can lie here.** `HANDOFF.md` and `PASSOFF.md` are untracked, so `doctor` in
  a worktree never sees them, and a worktree starts from whatever base it was cut from. Build on
  `main`, or bring the worktree to `main` with `git merge --ff-only main` before the first gate.
- **Zach's global hook** (G49) blocks a prose write with an em dash, a contraction or a listed
  phrase outside `/.claude/`, this folder and `templates/` included.
- **Rows 77 to 79 are open**, and 78 and 79 are scope-first, so Phase 1 cannot start until three
  rows close.

## 6. Session protocol

Each phase is one session. Read `CLAUDE.md`, `docs/conventions-ts.md` and
`docs/AGENT-PRACTICES.md` in full, then `HANDOFF.md`, then this folder. Check the session's model
against the board row before anything else. Re-run the §0 checks the phase depends on and record
any that moved. Close each phase with the ritual in `docs/AGENT-PRACTICES.md` Part 7: the phase
header here becomes `BUILT <date>, commit <hash>`, `DESIGN.md` gets an `As built:` note under any
decision the build departed from, `RUNTIME-PASS.md` gets the phase's entries, `HANDOFF.md` gets one
step at the next free number, and the board row points at it. Never commit: print the two blocks,
`git add` with the exact files and `git commit` with the same files.

## 7. GATE 2

**Answers, given by Zach in chat, 2026-10-04: "all recommended".** Every question takes the option
marked recommended:

1. Board order, lowest row number first: `DESIGN.md` D20.
2. Fixed content, the session's words: D21. No register is chosen, because no fixed text ships.
3. `/delegate` on both work-record shapes, `/autopilot` only where a board is written: D22.
4. The plain description for `/delegate`: D23.
5. Under `print-blocks` the row is held for its predecessor's commit; under `agent-commits` it
   builds from the predecessor's branch: D24.
6. Zach moves his own `~/.claude/skills/delegate/` out for the supervised pass and swaps it back
   after (Phase 3, scope item 1).
7. The plan is approved as written. The phases above were brought in line with D20 to D24 the same
   turn.

The questions follow as they were asked, in one batch, in chat, on 2026-10-04.

1. **Which runnable rows go first when the caps allow fewer launches than are ready?**
   - *A. Board order, lowest row number first.* **Recommended.** `passoff next` already reads the
     board this way, because nothing in a row says which of two lanes matters more (G51), and the
     owner wrote the board in the order they meant. *Against:* a large low-numbered row takes a
     builder slot that two small rows could have used.
   - *B. Rows that other rows wait on, first.* *Against:* it needs a reliable reading of free-text
     "Waits on" cells, and a misreading reorders the night with nobody watching.
   - *C. The cheapest tier first.* *Against:* it reorders the owner's priorities by cost.
2. **Does the template fix the opening round's words, or only its content?**
   - *A. Fixed content, the session's words.* **Recommended.** The template fixes which questions
     are asked, their options and their defaults (`DESIGN.md` §4.2.3); the session words them,
     inside the person's chat-style rule where they chose one. *Against:* the wording drifts from
     run to run, and a reviewer cannot check the exact text a person will read.
   - *B. Fixed text in the template.* *Against:* seven questions of copy a person reads, which R7
     puts to you now, and fixed text cannot list more Deep rows than a question's four options
     allow. If B, choose a register. Plain, the full set: "When should this run stop launching new
     work?", "How many agents may run at once?", "This run needs auto mode on and the machine awake
     until it ends. Is that set?", "Deep is <name>, Default is <name>, Mechanical is <name>, passed
     as <families>. Is that right?", "Deep rows are held unless you name them. Which should this run
     build?", "Which other rows should get a Deep review?", "Which rows should this run leave out?"
     Warm, two samples: "How long should I keep working before I stop starting new rows?" and "I
     will keep going while you are away. Is auto mode on, and will the machine stay awake?" Terse,
     two samples: "Stop launching at?" and "Unattended: auto mode on, machine awake?"
3. **A code, full target in git on project folders has no board (G41). What do the skills do
   there?**
   - *A. `/delegate` on both shapes; `/autopilot` only where a board is written.* **Recommended.**
     `/delegate`'s source already runs a `PLANNED` phase (G17), and on folders it records through
     the phase header, as `/close-out` already does (`src/render/skills.ts:234-241`). Every step of
     `/autopilot` reads the board. *Against:* the settled `all` label names `/autopilot`, and a
     person on project folders who answers "all" does not get it, as a light setup does not get
     `/scope`.
   - *B. Both only where a board is written.* *Against:* it withholds a skill that works on
     folders.
   - *C. `/autopilot` also reads `PLANNED` phases from project folders.* *Against:* a second reading
     procedure, with no "Files it owns" table to check collisions against, which is a design
     section of its own.
4. **`/delegate`'s description (R7).** The line a person sees in the skills list, and the line
   that decides when the model loads it, so each variant keeps a "Use when" clause.
   - *Plain.* **Recommended.** "Build one ratified board row or planned phase with a builder
     subagent and a separate auditor, each in its own worktree on the right model, then sign it
     off. Use when a row has cleared its gate and you want it built, reviewed and recorded without
     opening a new session."
   - *Warm.* "Hand one ready row to a builder and a reviewer, each on the right model in its own
     worktree, and get it back checked and written up. Use when a row is ratified and you would
     rather not open a new session for it."
   - *Terse.* "Run one ratified row: build in a subagent, audit in a second, sign off. Use when a
     row has cleared its gate."
5. **A row that comes after a row this run signed off but did not commit**, in the same lane or
   through "Waits on". Its builder would start from a base without its predecessor's work.
   - *A. Under `print-blocks` it is held, waiting on the commit of its predecessor; under
     `agent-commits` its builder starts from the predecessor's branch.* **Recommended.** Nothing is
     built on work the owner has not seen, and where the agent commits, the branch is the base.
     *Against:* under `print-blocks`, each lane builds one row per run.
   - *B. Held under either policy until the predecessor is landed.* *Against:* `agent-commits`
     loses same-lane chains for no safety the branch does not already give.
   - *C. Stacked on the predecessor's uncommitted work, from a patch.* *Against:* a fix to the first
     row after the run breaks the second, and the merge order becomes the owner's puzzle.
6. **The supervised pass on your machine, which holds your own `/delegate`.** A personal skill wins
   over a project one (G44), so the pass would run yours.
   - *A. Move your `~/.claude/skills/delegate/` out of `~/.claude/skills/` for the pass, install the
     shipped pair with `setup`, and swap yours back after.* **Recommended**, because it is
     reversible. *Against:* during the pass your own `/delegate` is unavailable in every session.
   - *B. Retire yours and keep the shipped one.* *Against:* a change to your setup this effort does
     not need.
   - *C. Walk the pass on a machine or account with no personal `/delegate`.* *Against:* another
     machine to set up.
7. **Approve the plan as written?** Three phases in lane B, serial; a Default driver for Phases 1
   and 2, the owner with a Default session for Phase 3; one Deep review in Phase 2; BD-1 to BD-16;
   DIAL-1 to DIAL-11 at their recommended values. Two calls change files a person reads: BD-14 (the
   label and the sentence each arrive in two steps) and BD-15 (the `skills` long form's false
   sentence is corrected).
