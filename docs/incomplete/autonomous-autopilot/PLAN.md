# Plan: an autonomous mode for `/autopilot` and `/delegate`

**Status:** `PLANNED` 2026-10-16, written by the Fable 5.1 session that wrote `DESIGN.md`, in
worktree `autonomous-autopilot-design` from `main` at `4348b20`. GATE 2 is the owner's: the phases,
their order, lanes and dials below go to Zach before any code. Once approved, the plan authorizes
the whole run; no phase needs re-approval. Design: `DESIGN.md` beside this file, ratified
2026-10-16. Phase 0 (the rule line, design D8) is on `main` as `eecac7a` and is not a phase here.

## 0. Facts verified 2026-10-16 (supersede the design where they differ)

Verified at `4348b20`, the same day as the design. Nothing differs; the rows below are the ones a
phase reads first.

| Claim | Verified state | Citation |
|---|---|---|
| The policy seam is one function | `agentCommits()` returns true for `agent-commits` and `agent-pushes`; nothing reads `agent-pushes` alone | `src/render/skills.ts:278-281` |
| The six reserved sentences and their lines | builder rule `:305`; rundown `:402`; worktree limits `:907`; `/clean-up` archive `:606-608`, hand-back `:598-602`; `/close-out` fold timing `:773-774` | `src/render/skills.ts` |
| The tokens the templates carry | `/delegate`: `TIER_TABLE`, `TIER_HOLD`, `GATE_CLEARED`, `QUESTIONS_HELD`, `DEEP_LIFT`, `RECORD_FILES`, `RECORD_FILES_OBJECT`, `ITEM_FILE_RULE`, `COMMIT_RULE`, `AUDIT_SOURCE`, `AUDIT_KEPT`, `RECORD`, `HELD`, `OWNS`, `OWNS_PLURAL`, `CLAIM`, `WORKTREE_STEP`, `CONTEXT_RULE`. `/autopilot`: `BOARD_FILE`, `LEDGER_FILE`, `ITEMS_DIR`, `TIER_TABLE`, `AFTER_UNCOMMITTED`, `COMMIT_BLOCKS`. `/passoff`: `PROMPT_HOME`, `TRUTH`. `/clean-up`: `WHAT_MOVES`, `FINISHED`, `MOVE_STEPS`, `GREP_WHERE`, `LIVE_TEXT`, `HISTORICAL_TEXT`, `COMMIT_CLAUSE` | `grep -o '{{[A-Z_]*}}' templates/skills/*.md` |
| `fill()` leaves an unknown token in place, and `leftoverTokens()` reports it | every policy loop in both skill tests asserts `leftoverTokens(text)` is empty | `src/lib/template.ts:14-21`; `tests/delegate-skill.test.ts:258-266`; `tests/autopilot-skill.test.ts:214-220` |
| The byte-equality test | `expect(await read('agent-pushes')).toBe(commits)` for both skills | `tests/agent-pushes.test.ts:196-207` |
| The pins that stay | `/delegate` under `agent-commits`: "Never push and never merge." (`tests/delegate-skill.test.ts:178-185`); `/autopilot` under `agent-commits`: "No branch is pushed or merged." (`tests/autopilot-skill.test.ts:142-148`); "## 6. Remove the worktrees this run made" under the default policy (`:188`); "the commit is the owner's" (`tests/clean-up-skill.test.ts:69`); the fold timing (`tests/skills.test.ts:187`). All render `print-blocks` or `agent-commits`, which do not move | the files named |
| The golden renders `print-blocks` | three variants on `FULL`; 83 keys | `tests/tracks.test.ts:271-283`, `:299`, `:604` |
| Both templates forbid a model family name, a Part number and an em dash | pinned by a source read in each skill test | `tests/delegate-skill.test.ts:94-99`; `tests/autopilot-skill.test.ts:98-103` |
| The defaults table pins each value once | `text.split(value)` has length 2 for each default | `tests/autopilot-skill.test.ts:76-90` |
| The rundown's section order is pinned | eleven headings, in order, found after "Write `RUNDOWN.md`" | `tests/autopilot-skill.test.ts:92-114` |
| The worktree step is one function | `worktreeStep(n, maker, which)`, `worktreeCommands()`, `worktreeLimits(maker)` | `src/render/skills.ts:884-915` |
| `/passoff` renders on every track; `/autopilot` on code + full + git with a board | `offeredSkills()`; `rendersAutopilot(ctx)` already exists for `model-routing.md` | `src/render/skills.ts:150-168`, `:179-182` |
| The long forms are embedded in `catalog.json` | `bun run catalog` rebuilds it; Phase 0 rebuilt it | `package.json:42`; `git show --stat eecac7a` |
| The next free row is 112 | archive holds 108, 109, 111; the board's highest row is 110 | `ls ~/Projects/archive/personal-config/passoff`; `PASSOFF.md` (main checkout) |
| The four gates were green at `a589d4c` on 2026-10-16; `bun test` ran 1772 tests in 96 files in a clean copy | `CLAUDE.md` Commands; the standard's Part 6 | run 2026-10-16 |

## 1. Decisions taken since ratification

- BD-1. The G45 sweep (all six sentences) ships in Phase 1 with the land step, not split across
  phases, because the hazard "Deleting a ban without its replacement" applies to each sentence,
  and the grep test that pins the sweep empty can only pass once every sentence is gone. Reversal:
  move the `/clean-up` and `/close-out` sentences to Phase 3 and loosen the grep until then.
- BD-2. The decider, the scope-first run, the audit dial and the cross-board wait are one phase
  (Phase 2), because they share the Autonomy call, `STATE.md`'s sections and the wake procedure,
  and a phase per question would edit the same forty lines four times. Reversal: split Phase 2 at
  the Autonomy call, with the decider and the audit dial first.
- BD-3. The end-of-run commit and the `/passoff` sentence are Phase 3, after Phase 2, because the
  commit's file list names what Phase 2's state file sections produce. Reversal: fold Phase 3 into
  Phase 2.
- BD-4. The documents (D11, D12) are their own lane and run in parallel from the start, because
  every word is in the design and no file overlaps lane A. Reversal: hold them until Phase 3 lands.
- BD-5. The runtime pass is a board row (Phase 5), not a note: it re-runs `setup` on each machine,
  which is the only way the installed skills change, and one supervised landing is the proof no
  test can give. Reversal: leave it to the owner with no row.
- BD-6. The new test for the sweep and the land step lives in `tests/agent-pushes-skills.test.ts`,
  a file of its own, not appended to `tests/agent-pushes.test.ts` (X1: that file is lane-owned by
  Phase 0's rule-line pins and this one renders every file under one policy). Reversal: append.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | The seam, the land step and the sweep | Default | one Deep review of the rendered `/delegate` and `/autopilot` under `agent-pushes` | full | the land step is skill text whose wrong design compiles and passes every gate; the design carries its words, so the build places them and a narrow Deep review reads the result |
| 2 | The Autonomy call, the decider, scope-first rows, the audit dial, the cross-board wait | Default | one Deep review of the rendered `/autopilot` under `agent-pushes` | full | the decider's text decides questions unattended; same reasoning as Phase 1 |
| 3 | The end-of-run commit and the owner's-call sentence | Default | none; a Default auditor through `/delegate` | comfortable | two tokens and their tests; a wrong file list is loud at the first run |
| 4 | The pointers and the long forms | Mechanical | none | comfortable | every word is in D11 and D12; the check is a diff and `bun run catalog` |
| 5 | Re-run `setup` and walk one supervised landing | Default | none | comfortable | the runtime pass; it writes `RUNTIME-PASS.md` and the first entries of each unverified call |

Tiers by `model-routing.md`'s ladder. Phases 1 and 2 are Default with a Deep review because the
design already made the decisions and gives the words; a Deep builder would spend the tier's
reasoning on placing text, and the standard prefers one narrow Deep review of a load-bearing
artifact. Each is marked load-bearing on the board so `/delegate` gives it a Deep auditor.

**Lanes.** Phases 1, 2, 3 and 5 are lane A, in order: each edits `src/render/skills.ts` and the
two skill templates. Phase 4 is lane B and may run at once. Phase 5 waits on all four.

**Board rows.** 112 (Phase 1), 113 (Phase 2), 114 (Phase 3), 115 (Phase 4), 116 (Phase 5).

### Phase 1: the seam, the land step and the sweep

**Status:** not started. **Model: Default, load-bearing (Deep review). Lane A. Waits on nothing.**

Scope.

1. In `src/render/skills.ts`, add `agentPushes(ctx): boolean` beside `agentCommits()`, true for
   `commitPolicy === 'agent-pushes'` alone, with a comment that says why both exist (design D6).
   Rewrite `agentCommits()`'s comment: it no longer says the skills' text keeps no merge.
2. `delegateVars`: under `agentPushes`, `COMMIT_RULE` is design 4.1's builder rule; `LAND_STEP`
   is design 4.1's step 6, as written, with the bash block fenced; `WORKTREE_STEP` is
   `worktreeStep(7, ...)`. Under the other policies `LAND_STEP` is the empty string and nothing
   else moves. `RECORD` under `agentPushes`: the commit state reads "landed on <base> at <hash>, or
   held at the land step", the sign-off lines go into the land message where the item's file is
   tracked, and the log line, `DONE` and the blocks wait for step 6 (design 4.1, "Step 4").
3. In `templates/skills/delegate.md`, add `LAND_STEP` on its own line between section 5 and
   `WORKTREE_STEP`, with one blank line each side so the empty fill leaves one blank line.
4. `worktreeLimits(maker)` takes the policy: under `agentPushes` the sentence at `:907` becomes
   "The merge happened in the land step; this step only removes." `closeOutWorktreeStep()` and
   `delegateVars` pass it through; `/close-out` under `agent-pushes` gets the same sentence.
5. `autopilotVars`: under `agentPushes`, `AFTER_UNCOMMITTED` is design 4.2's section 2 text,
   `COMMIT_BLOCKS` is design 4.2's **Landed** section, and `LAND_ROUTE` is design 4.2's step 3
   sentence; `LAND_ROUTE` is empty under the other policies. Add `LAND_ROUTE` at the end of
   wake step 3 in `templates/skills/autopilot.md`.
6. `cleanUpVars` and `foldMove`: under `agentPushes`, the archive step's sentence, the hand-back
   clause and the fold timing line are design 4.3's. `itemFoldStep` under `agentPushes`: design
   4.3's `/close-out` line. These functions take the policy from the context; thread `ctx` or a
   boolean through `variables()` as the file already does for `commits`.
7. Tests. In `tests/delegate-skill.test.ts`: under `agent-pushes`, "## 6. Land it", the five
   numbered lines by phrase, "git merge --ff-only <the builder's branch>", "## 7. Remove the
   worktrees this run made", and the builder rule's "are the land step's (step 6)"; under
   `agent-commits` and `print-blocks`, none of them. In `tests/autopilot-skill.test.ts`: under
   `agent-pushes`, "is runnable once that row has landed", "**Landed**: for each row", and the
   step 3 sentence; under `agent-commits`, "No branch is pushed or merged." as before. In
   `tests/clean-up-skill.test.ts` and `tests/skills.test.ts`: the `agent-pushes` sentences present
   and the owner's sentences absent there, with the existing default-policy pins kept. In
   `tests/agent-pushes.test.ts`, replace the byte-equality describe (`:196-207`) with: under
   `agent-pushes` each skill contains "## 6. Land it" or "**Landed**" and none of the two G40
   sentences; under `agent-commits` the reverse; and `/delegate` under `agent-commits` equals
   itself at the previous render (read it twice and compare, so the test still proves that policy
   is deterministic). New `tests/agent-pushes-skills.test.ts` (BD-6): render every file with
   `renderAll` under `agent-pushes` on code + full + git with a board, join the contents, and
   assert design 4.5's regex does not match; a second test asserts the same regex does match the
   `agent-commits` render, so the regex is proven to see the sentences it is meant to see.

Subagents: the Deep review, through `/delegate` with the row marked load-bearing. Its brief: the
rendered `/delegate` and `/autopilot` under `agent-pushes`, design D1 and section 4.1, and one
question: does any sentence let a builder merge or push before the land step, or let the lead merge
in the primary checkout, or leave a reader of either skill under `agent-commits` with a changed
instruction.

Done when.

- `bun run typecheck && bun run lint && bun test` green, output pasted; lint output read, not
  only its exit code.
- `bun run doctor . examples` in the main checkout reports no new finding against `4348b20`'s 16.
- `git diff --stat` touches only `src/render/skills.ts`, `templates/skills/delegate.md`,
  `templates/skills/autopilot.md`, the five test files named and the new one.
- The new grep test passes under `agent-pushes` and its mirror fails to find the sentences only
  there: the `agent-commits` render still matches the regex, which proves the regex sees them.
- The golden test passes untouched: `git diff --stat tests/golden/` is empty.
- A person reads the rendered `/delegate` under `agent-pushes` once, top to bottom, and can say in
  one sentence who runs each of the seven git commands in step 6 and from where.

Watch for. The `agent-pushes` render of `/delegate` has a fenced `bash` block inside `LAND_STEP`;
the template literal in `skills.ts` must carry the backticks escaped or the block built from
`'```bash'` lines as `worktreeCommands()` does. The empty `LAND_STEP` must leave section 5 and
section 6 one blank line apart under the other policies, or those bytes move and the
`agent-commits` pins fail.

### Phase 2: the Autonomy call, the decider, scope-first rows, the audit dial, the cross-board wait

**Status:** not started. **Model: Default, load-bearing (Deep review). Lane A. Waits on 112.**

Scope.

1. `templates/skills/autopilot.md`, through tokens filled under `agentPushes` and empty otherwise:
   `AUTONOMY_CALL` after the second call (design 4.2, questions 8 to 11, as written);
   `DEEP_ROWS_OPTIONS` inside question 5 and `SHARED_WINDOW` inside question 1 (design 4.2,
   under "Question 5" and "Question 1"); `CROSS_BOARD` after the "Waits on" bullet and
   `SCOPE_FIRST` in place of the scope-first bullet in section 2; `SCOPE_RUN` after the
   launch paragraph in section 5 (design D3's procedure); `QUESTION_RULE` as the whole of wake
   step 4; `CROSS_BOARD_HOLD` in section 7; `DECISIONS_SECTION` as the rundown's section 7
   title; `EXTRA_DEFAULTS` as two rows at the end of the defaults table (design 4.2); the
   **Waits elsewhere** line and "scoped: <path>" in section 4 through `STATE_EXTRAS`. Where a
   token replaces an existing bullet or step, the fill under the other policies is that bullet's
   current bytes, so nothing moves there.
2. `templates/skills/delegate.md`: `AUDIT_DIAL` at the end of step 3's first paragraph
   (design 4.1, "Step 3"), empty under the other policies and on project folders.
3. `src/render/skills.ts`: the fills, each a short function, reading `agentPushes(ctx)`. The two
   default rows go through the same `text.split(value)` discipline the test enforces: each number
   written once in the skill.
4. Tests, in `tests/autopilot-skill.test.ts` and `tests/delegate-skill.test.ts`: under
   `agent-pushes`, the Autonomy call's four question titles in order after "**Second call**", "all
   of them, including rows written during the run", "read one window and the caps are joint", the
   three severity classes by their names, "owner's call", "The fourth question on one row holds
   it", "holds on the holding wake instead of ending", "**Decisions taken for the owner**",
   "not audited: <tier>, no trigger", the two new defaults each once; under `agent-commits`, none
   of them, and "**Decisions waiting for the owner**" as before. The rundown order test runs under
   both policies, with the section 7 title swapped.

Subagents: the Deep review, as Phase 1, with one question: can the decider's text be read as
answering a question the item file marks as the owner's, or as widening "Files it owns".

Done when.

- `bun run typecheck && bun run lint && bun test` green, output pasted.
- `bun run doctor . examples` in the main checkout: no new finding.
- `grep -c 'owner.s call' <rendered /autopilot under agent-pushes>` is at least 2 (the decider's
  mark and the Autonomy call's question 9), and 0 under `agent-commits`.
- The golden untouched.
- A person reads the Autonomy call once and can answer its four questions for one real board
  without opening the design.

Watch for. Question 5's new option text and question 1's added sentence sit inside numbered items
the template already holds; the token goes inside the item's text, not as a new item, or the
"At most four questions in each call" rule stops being true. The wake step 4 token replaces the
whole step under both policies, so the `2eff50c` text goes into the renderer verbatim for the other
three policies, and the autopilot-skill Deep-review pin "Anything else holds the row, with the
question under **Held**, even when the builder finished." must still pass under the default policy.

### Phase 3: the end-of-run commit and the owner's-call sentence

**Status:** not started. **Model: Default. Lane A. Waits on 113.**

Scope.

1. `templates/skills/autopilot.md`, section 8 step 4: `END_COMMIT` at the end of the step,
   filled under `agentPushes` with design 4.2's "Step 4 gains" text and empty otherwise.
2. `templates/skills/passoff.md`, part 7: `OWNERS_CALL` after "either answer may be no.",
   filled with design D10's sentence where `rendersAutopilot(ctx)` and `agentPushes(ctx)`, empty
   otherwise. `passoffVars` gains the context it needs; at `4348b20` it takes `shape` and `names` only.
3. Tests: `tests/autopilot-skill.test.ts`, under `agent-pushes`, "autopilot run <date>" and
   "Untracked records stay as they are"; absent under `agent-commits`. `tests/skills.test.ts` or
   the passoff test that exists: the sentence present under `agent-pushes` on a board, absent under
   `print-blocks`, on project folders and on the lighter setup.

Subagents: none. The auditor is `/delegate`'s Default one.

Done when.

- `bun run typecheck && bun run lint && bun test` green, output pasted.
- The golden untouched: `/passoff` under `print-blocks` renders the same bytes.
- `grep -n "git add" <rendered /autopilot under agent-pushes>` shows the end-of-run line naming
  the run folder's two files and the fold's tracked files, and no `-A` and no `.` anywhere in the
  skill.
- A person reads step 4 once and lists the files the run would commit on this repo's board: the
  two run-folder files and nothing else, because the board and item files are untracked here.

Watch for. The `passoff` long form (`docs/choices/skills.md`) says what `/passoff` writes; Phase 4
owns that file, so this phase does not touch it even if the sentence seems to belong there.

### Phase 4: the pointers and the long forms

**Status:** not started. **Model: Mechanical. Lane B. Waits on nothing.**

Scope.

1. `docs/incomplete/delegate-autopilot/DESIGN.md`: the three dated notes of design D11, placed
   under D19, under D24, and under section 6's first bullet, each as a new paragraph after the
   decision's last line. Edit no existing line.
2. `docs/incomplete/worktree-sweep/SCOPE.md`: the status-line sentence of design D11, appended to
   the existing status paragraph.
3. `docs/choices/commit-policy.md` and `docs/choices/skills.md`: the four paragraphs of design D12,
   placed where D12 says. Replace the one sentence D12 names (`skills.md:154`); add the rest.
4. `CHANGELOG.md`: the unreleased bullet's sentence, as design D12's last paragraph gives it.
5. `bun run catalog`; commit `catalog.json` with the long forms.

Subagents: none.

Done when.

- `bun run typecheck && bun run lint && bun test` green (the catalog test reads the long forms).
- `bun run doctor . examples` in the main checkout: no new finding; the design folders are scanned.
- `git diff --stat` touches exactly the five files named and `catalog.json`.
- `grep -n "landing it is yours" docs/choices/skills.md` prints the one line D12 keeps, inside
  "Under every commit policy but", and nothing else.
- `grep -n "no branch is pushed" CHANGELOG.md` prints nothing.
- A person reads the D19 and D24 notes once and can say which policy each decision still holds
  under.

Watch for. The delegate-autopilot design carries em dashes in prose that predates the style rule;
the three notes carry none, and the existing lines are not edited. `docs/choices/*.md` is embedded
in the catalog byte for byte, so a trailing newline change shows as a catalog diff.

### Phase 5: re-run `setup` and walk one supervised landing

**Status:** not started. **Model: Default. Lane A. Waits on 112, 113, 114, 115.**

Scope.

1. On this machine, `personal-config setup --profile zach --dry-run` from the main checkout, and
   read the preview: `/delegate`, `/autopilot`, `/passoff`, `/clean-up` and each repo's
   `/close-out` are listed to write; nothing under `standard/` moves. Then the real run.
2. In this repo, with one Mechanical row on the board that touches one file (the owner writes it),
   type `/autopilot` with the person at the keyboard, answer the opening round with the defaults,
   and watch one row build, land and push. Record in `RUNTIME-PASS.md`, three lines each: the land
   message as sent and the builder's report; the fast-forward and the push as run; the worktree
   step's removal; whether `git -C` into a lead-made landing worktree was run and refused or not
   (design hazard); the state file's **Landed** and **Judgment calls** sections.
3. Fold any finding back as a new row, not as a fix in this phase.

Subagents: none.

Done when.

- `RUNTIME-PASS.md` exists in this folder with the entries above, each dated absolutely.
- `git log --oneline -3` on `main` shows the landed row's commit and the run's own commit, and
  `git status --short` shows the ledger and board untracked as before.
- The owner has read the rundown's first paragraph in chat.

Watch for. The opening round needs a terminal with a person; no agent can drive it (CLAUDE.md,
"What an agent cannot verify here"). The row chosen must own one tracked file so the landing is
real and the diff is one line to read.

## 3. Dials

As the design's section 5. None is open; DIAL-10 (300 lines, 8 files) and DIAL-7 (3 questions) are
written into the defaults table by Phase 2 so the opening round can offer them.

## 4. Seams reserved, deliberately not built

- An `autonomy` config question with its own long form (scope 3.6 B). Reserved until the Autonomy
  call proves tiresome.
- A merge of the remote into the base when a push is refused. The run stops pushing instead
  (DIAL-4). A fetch-and-merge in the owner's primary checkout is the thing the design keeps out.
- A semantic check of the merged tree across two landed rows. Nothing audits the merge of two green
  rows; the owner accepted that on 2026-10-03 and the scope repeats it.
- `wk` in any template. The owner's tool; a row in each repo, not a feature here.
- A `doctor` rule that reads a "Waits on" naming another board and checks the path exists.
  Possible, not asked for.
- Re-rendering the installed skills on each machine inside a build phase. Phase 5 is that step,
  once, with the owner present.

## 5. Repo hazards, with live numbers

- `doctor .` in the main checkout sees untracked files a worktree cannot; 16 findings there on
  2026-10-16 against 3 in a clean copy. Each phase's doctor run happens in the main checkout, and
  "no new finding" is measured against that 16.
- `bun run lint` exits 0 on warnings. Read the output.
- The completion-gate hook runs nothing in a worktree.
- `bun test` green on macOS is not green on Linux where a test lists a directory; none of these
  phases lists one, and CI's Linux job is still the proof.
- `tests/golden/full-track.json` holds 83 hashes and renders `print-blocks`; a phase that moves a
  hash under that policy has broken the byte-for-byte rule, and the fix is the phase, not the
  golden.
- The main checkout's `CLAUDE.md` carried an uncommitted edit on 2026-10-16 that is not this
  effort's; no phase touches that file.
- Three other worktrees under `.claude/worktrees/` sat on unmerged branches on 2026-10-16
  (`bare-command-home`, `frame-fixes`, `affectionate-dijkstra-c91cec`). None owns the files these
  phases touch; `/land-worktrees` is theirs.

## 6. Session protocol

Read `CLAUDE.md`, `docs/conventions-ts.md` for any `.ts` edit, `DESIGN.md` beside this file, and
this file. One phase per session, in its own worktree, with the fresh-checkout recipe run before the
first gate. Git is the agent's to run in full: commit on the worktree branch naming the exact
files, run the gates, merge to `main` with `--ff-only` from the primary checkout, push, and remove
the worktree. No attribution trailer. Return the board row's close-out, the ledger's log line and
the item file's text to the main checkout, where the ledger and the board live.
