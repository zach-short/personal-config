# Design: an autonomous mode for `/autopilot` and `/delegate`

**Status:** `RATIFIED` 2026-10-16. The scope is `SCOPE.md` beside this file, ratified the same day
with every recommendation taken (its section 7). This file was written on 2026-10-16 by a Fable
5.1 session in worktree `autonomous-autopilot-design`, cut from `main` at `4348b20`. The scope
stays as its own file: its status line names `DESIGN.md` and `PLAN.md` as new files in this folder,
the ledger's log line for Phase 0 cites `SCOPE.md` by path from an untracked file a worktree cannot
repair, and nothing in it is restated here that a section number can point at. From here the
design is frozen: it changes by a new dated `D<n>` or an `As built:` note, never by an edit to a
decision in place. `PLAN.md` beside it is Stage 4.

**Labels.** `G1` to `G41` are the scope's ground truth, verified 2026-10-16 at `2eff50c`. `G42`
onward is what this session verified at `4348b20`, in section 1. `D1` to `D8` record the eight
answers in the scope's section 7, in order. `D9` to `D12` settle the four items the scope left open
for the design step. `DIAL-n` are section 5's. `BD-n` numbers are the plan's.

## 1. What exists, verified 2026-10-16

The scope's section 1 holds G1 to G41. Each row below was checked by this session on 2026-10-16
at `4348b20`, which was `main` when the worktree was cut. Line numbers are in that tree.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G42 | Phase 0 is on `main` | `eecac7a`, nine files: the rule line reads "Claude may run any git command, including `git add`, `git commit`, `git merge` and `git push`." in `rules.ts`, `context.ts`, `practices-policy.ts`, both commit-policy long forms, `catalog.json` and the changelog; the test pins the three-verb line as absent | `git show --stat eecac7a`; `tests/agent-pushes.test.ts:33-36`, `:78-90` |
| G43 | The two skills still read `agent-pushes` as `agent-commits` | `agentCommits()` returns true for both, and its comment says the skills' text "still says no branch is pushed or merged" | `src/render/skills.ts:271-281` |
| G44 | A test pins the two policies' skill texts as byte-equal | "the skills read agent-pushes as at least agent-commits": `expect(await read('agent-pushes')).toBe(commits)` for `/delegate` and `/autopilot` | `tests/agent-pushes.test.ts:196-207` |
| G45 | Six rendered sentences reserve a git action for the owner under `agent-pushes`, not three | G40's three, and: `/clean-up`'s archive step, "**the commit is the owner's**: post the blocks it prints and stop there for that folder"; `/clean-up`'s hand-back, "Then the commit blocks for everything the sweep changed"; `/close-out`'s fold timing, "Fold an item only once the owner has committed its close-out" | `src/render/skills.ts:305`, `:402`, `:907`, `:606-608`, `:598-602`, `:773-774` |
| G46 | Those sentences are pinned under the default policy only | `tests/clean-up-skill.test.ts:69` pins "the commit is the owner's"; `tests/skills.test.ts:187` pins the fold timing; both render `print-blocks` (`DEFAULT_ANSWERS`) | `tests/helpers.ts:159`; the two tests |
| G47 | The golden hashes render `print-blocks` | Every full-track variant uses `FULL`, whose commit policy is `print-blocks`; no hash moves on a change rendered under `agent-pushes` alone | `tests/tracks.test.ts:271-283`, `:604` |
| G48 | `/delegate` numbers its sections 0 to 5, then the worktree step as 6 | `worktreeStep(6, 'run', ...)` in `delegateVars`; "## 5. Several items at once" is literal in the template | `src/render/skills.ts:297`; `templates/skills/delegate.md:127` |
| G49 | The rundown's section 11 is the only policy seam in `/autopilot`'s end | `COMMIT_BLOCKS` at `templates/skills/autopilot.md:256`; steps 4 to 6 of section 8 are literal | `templates/skills/autopilot.md:243-262` |
| G50 | The worktree step's text is one function for `/delegate` and `/close-out` | `worktreeStep(n, maker, which)` calls `worktreeLimits(maker)`, which holds G40's third sentence | `src/render/skills.ts:884-915`; `closeOutWorktreeStep()` at `:857` |
| G51 | `/passoff` already renders two tokens | `PROMPT_HOME` and `TRUTH`, filled by `passoffVars` | `templates/skills/passoff.md:45-48` |
| G52 | The long form reserves the landing | "The builders' work stays in their worktrees; landing it is yours." | `docs/choices/skills.md:154` |
| G53 | The unreleased changelog says no branch is pushed | "`/delegate` and `/autopilot` read it as they read the agent may commit: the builder commits on its branch, and no branch is pushed." | `CHANGELOG.md:22-23` |
| G54 | The usage reading is the account's, not the session's | `get_usage`: "The plan limits are the account's either way", with percent used and reset time for the 5-hour and weekly windows | the tool's definition in this session, 2026-10-16 |
| G55 | The next free row number is 112 | The archive's `passoff/` holds 108, 109 and 111; the board's highest row is 110 | `ls ~/Projects/archive/personal-config/passoff`; `PASSOFF.md:15` (main checkout) |
| G56 | `doctor` scans this folder | `relative-dates` flags the relative-date words its pattern lists; `placeholders` flags a double-braced token in a prose line of any doc; `absence-evidence` flags an absence claim with no search beside it | `src/doctor/rules/relative-dates.ts:13`, `placeholders.ts:16`, `absence-evidence.ts:5` |
| G57 | `main` moved after the scope | `ea67b0c` folded three items; `4348b20` taught `doctor` a nested board; neither touches the skills, their templates or their tests | `git log --stat ea67b0c..4348b20` |

## 2. What this is, and what it is not

The scope's section 2 stands, with two additions.

**The sweep is G45, not G40.** Six sentences, in four skills, are replaced under `agent-pushes`
by the step that does the action: the land step for the builder's rule, the rundown's last section
and the worktree step; the run's own commit for `/clean-up`'s archive step and hand-back; the land
step's commit for `/close-out`'s fold timing. The grep that pins the sweep (D1) covers all six
forms, and the test lives beside the test that pins the land step present, because the two must
ship in one change (scope hazard "Deleting a ban without its replacement").

**One new sentence in `/passoff`** (D10). It renders only where `/autopilot` renders under
`agent-pushes`, so the golden (G47) and every other policy keep their bytes.

## 3. Decisions

D1 to D8 restate the scope's answers with the detail the build needs. Each carries its defense
where the detail goes past the scope, its supersession pointers, and its date. Where a decision
names words for a skill, section 4 carries them in full.

### D1. The land step: the builder merges the base and gates in its worktree; the lead fast-forwards and pushes (answer 1, A)

After `/delegate`'s step 4 signs a row off under `agent-pushes`, the lead sends the builder, with
`SendMessage`, one more step: commit the sign-off lines where the item's file is tracked; run
`git merge --no-edit <base>` from its own worktree as one plain command; resolve a conflict only in
a file the row's "Files it owns" lists, and abort on any other; run the install line and every gate
the row names plus the repo's gate command; report the merge result, each gate with its output and
an empty `git status --porcelain`. The lead then runs, with `git -C` on the primary checkout,
`git merge --ff-only <the builder's branch>` and `git push`, writes the log line and `DONE`, and
runs the worktree step. Under this policy `DONE` means the row's commits are on the base.

Four details the scope left to the design:

- **The sign-off lines travel in the land message.** At `2eff50c` the lead writes them into the
  builder's worktree copy of the item file (D10 of delegate-autopilot). Under `agent-pushes` the
  builder appends and commits them itself, so every git action in that worktree is the builder's
  and the lead never writes there. Where the item's file is untracked, the lead writes the whole
  close-out in the primary checkout, as at `2eff50c`, and nothing of it lands.
- **The record follows the landing.** The log line, `DONE - <date>` and the hand-back blocks are
  written after the fast-forward, not after the verdict. A refused fast-forward holds the row with
  git's output as its reason; a refused push lands the row and stops every later push in the run.
- **The budget fallback is a landing worktree of the lead's own**, not option 3.1 B. A builder that
  returns a pass-off instead of the land report is at its budget. The lead runs `git worktree add
  <fresh path> <the builder's branch>` from the primary checkout, runs the merge, the install line
  and the gates there with `git -C <that path>`, then fast-forwards and pushes as before, and removes
  that worktree in the worktree step.
- **A second landing attempt, then a hold.** When the fast-forward is refused because the base
  moved while the builder was gating (another row landed), the lead sends the land step again,
  once. A second refusal holds the row.

**Defense.** The fallback: option B merges in the owner's primary checkout and discards a red
result with `git reset --hard` there, which the scope itself named as its strongest argument
against; a worktree the lead makes is a tree nothing else edits, `git -C` into it is the lead's own
worktree and not an agent's (G25 does not apply), and the base is never touched until the gates are
green. It costs one install, which option B's export also paid. The record order: a `DONE` row
whose commits are not on the base is the state the two rundowns left (G21, G22), and a reader of
the board must be able to trust `DONE` without opening git. The lines in the message: a lead that
writes into a worktree it did not make is the one cross-worktree write left in the skills, and
removing it makes the builder the only writer of its branch.

**Supersedes:** delegate-autopilot D19 under `agent-pushes` only (D11 carries the pointer). Under
`print-blocks`, `agent-commits` and `no-rule` nothing changes. **Ratified** 2026-10-16, answer 1.

As built, 2026-10-16: the land step runs the gates again only where the merge changed HEAD. When the base has not moved since the builder's gates passed, `git merge --no-edit <base>` is a no-op, HEAD is the commit those gates passed on, and `--ff-only` lands that tree; a second full gate run then checks the same bytes twice, which in a repository with a build step is a whole build per row, a Light one-line change included. So step 2 now keeps `git rev-parse HEAD` before the merge, and step 4 opens by running it again: the same hash, from a merge that reported the branch already up to date, skips the install line and the gates, and the report reads `base unmoved, gates not re-run` with the hash the gates passed on. The hash is kept after step 1, so where the item file is tracked, step 1's sign-off commit is the one commit the skip lands ungated; it touches that file alone, and a repository that tracks its item files is the one this saving is for. Two more witnesses close the cases where the hash alone would lie. A conflict leaves HEAD unchanged with a half-merged index, so step 3 runs first: a resolved conflict is a merge commit, which moves HEAD and runs the gates, and an aborted merge holds the row before step 4. A merge commit blocked by a hook leaves HEAD unchanged too, so the skip also needs git's own "already up to date". A builder that committed anything but step 1's lines after its last gate run is sent to the gates by name. The moved base is unchanged: the merge moves HEAD and the gates run. The refused fast-forward is unchanged and is what guards the rest: `--ff-only` is refused exactly where the base took a commit after the builder's no-op merge, the resend merges a moved base, and the gates run. The budget fallback runs the same steps 1 to 5 in the lead's own worktree, so the same rule applies there, with the builder's branch tip before step 1 as the gated hash. The lead's paragraph says that such a report lands on the gates the builder already reported, and D4's "gates run again on the tree that lands" now reads "where the base moved" in the audit dial. Under `print-blocks`, `agent-commits` and `no-rule`, and on project folders, every render is byte for byte as before.

### D2. The decider: questions are decided in the run by severity, with the item file's words binding (answer 2, A)

Step 4 of `/autopilot`'s wake procedure, under `agent-pushes` with the opening round's default,
decides a builder's question instead of holding the row. The item file's words come first: a
question it marks as the owner's holds the row, and so does an answer that would widen "Files it
owns" into a file another open row lists. The marks are the phrase "owner's call", a name followed
by "'s call", "do not pick before", and an "Ask before building" entry the opening round did not
reach. Then the severity, by what a wrong answer does, going up a class when unsure:

- *Caught at once* (a gate or the eye shows it: a copy variant, a casing, a default value, a file
  to add that no other open row lists): the lead decides.
- *Looks right until tested* (a choice between designs, a flow, a shared primitive): a Default
  subagent decides.
- *Compiles and passes every gate, wrong in production* (money, sync or merge rules, a
  notification, data removed, a migration, a public contract, a file two rows touch): a Deep
  subagent decides, or holds the row when it finds the question is the owner's.

A decider runs in its own worktree, reads the item file, the question and the code it names, and
returns the decision, a one-line reversal, and whether the row is now load-bearing (an audit
trigger, D4). The lead sends the answer to the builder with `SendMessage` and logs it under
**Judgment calls** with the reversal and the decider's model. The fourth question on one row holds
it. The rundown's section 7 is retitled **Decisions taken for the owner**, each with its reversal
and its decider, followed by the decisions still waiting.

**Defense.** As the scope's 3.2 A. The marks are listed because a rule a decider has to interpret
is a rule it will interpret in its own favour; `/passoff` offers the first mark (D10) so an owner
can write it in three words.

**Supersedes:** delegate-autopilot D8 in part, under `agent-pushes` only: the opening round still
asks up front, and a question the round did not reach still holds. **Ratified** 2026-10-16, answer 2.

### D3. Scope-first rows are scoped in the run, and a Deep decider answers the gate (answer 3, A)

Under `agent-pushes` with the opening round's default, a row whose prompt says to scope first is
runnable for scoping. The lead spawns a Default subagent in its own worktree with `/scope`'s text
(its absolute path, read-only) and the row's prompt; it writes `docs/incomplete/<slug>/SCOPE.md`
with every option carrying a recommendation, commits it naming the file, and asks no gate. The lead
sends the document's open questions and its path to a Deep decider under D2's rules; it answers each
by its recommendation unless the document or the code gives a reason not to, and holds on a
question the item file or the document marks as the owner's. The scoper writes the answers under a
dated **Answers** section, each as "decided by <model> in `<run folder>`, <date>, reversal: ...",
commits, and the lead lands the branch by D1's land step with no audit: the Deep gate is its review.
The lead adds a dated note to the row's item file naming the document and the gate's outcome; the
row then counts as scoped, and a later wake may launch its build with the document as its design
input. A held gate holds the row with the document landed, so the owner's morning starts at the
gate.

**Defense.** As the scope's 3.3 A. Landing the document before the build means the builder reads it
from the base, where every worktree sees it, and that `doctor` scans it at the land step's gate.

**Supersedes:** nothing; G10's rule stands under the other policies. **Ratified** 2026-10-16,
answer 3.

### D4. Audits by tier, with escalation triggers (answer 4, A)

Under `agent-pushes` with the opening round's default, a Deep or Default row is audited as at
`2eff50c`. A Mechanical or Light row lands on its gates with no auditor unless a trigger fires: a
file outside its "Files it owns", a fix round or a relay pass, a number claimed, more than 300 lines
or 8 files in its diffstat, or a decider's load-bearing mark. The lead applies the triggers from the
builder's report, which already carries the diffstat, the files changed, the relay count and the
numbers claimed. An unaudited row is signed off on the builder's report with the verdict
"not audited: <tier>, no trigger", then landed by D1, where its gates run again on the tree that
lands.

**Supersedes:** delegate-autopilot D7 in part, under `agent-pushes` only: every Deep and Default
row still gets its auditor, and two fix rounds still hold a row. **Ratified** 2026-10-16, answer 4.

### D5. One session per repository, with a "Waits on" that may name another board (answer 5, A)

A "Waits on" cell may hold `<absolute path to the other board> item <n>`. On every wake, under
`agent-pushes`, the run reads that file by path: the wait is met when the row is `DONE` there, or
absent from both that table and the items folder beside it (the board's folder name lowercased,
as the standard names it). A run with nothing in flight and at least one such wait open holds on the
holding wake instead of ending, until its end time. `STATE.md` gains a **Waits elsewhere** line per
such row.

**The caps need no division.** The scope's hazard said three runs must each take a third of the
default share. G54 shows why they need not: the five-hour and weekly readings are the account's,
so three runs that freeze at 75% of the five-hour window freeze together, when the window is at
75%; and each run's weekly spend, read as its latest reading minus its start reading, includes the
other runs' spend, so the 25-point cap is joint and conservative by construction. The opening
round's budget question says, where several runs are open, that they read one window and the caps
are joint, and offers the person a larger weekly share for that reason.

**Supersedes:** the scope's hazard "Three sessions, one usage window" and DIAL "Five-hour share
with several runs", by G54. **Ratified** 2026-10-16, answer 5; the cap finding is this session's,
dated 2026-10-16.

### D6. The land step renders under `agent-pushes`; the rest is the opening round (answer 6, A)

A new `agentPushes(ctx)` in `src/render/skills.ts`, beside `agentCommits()`, returns true for
`commitPolicy: agent-pushes` alone. `agentCommits()` keeps returning true for both policies: the
builder commits on its branch either way. Every token that differs by this policy is filled from
`agentPushes()`, and under the other three policies every skill renders byte for byte as at
`4348b20`. The decider (D2), the scope-first rule (D3), the audit dial (D4) and the cross-board
wait (D5) are an **Autonomy call** in the opening round, four questions with the recommended
default first, rendered only under `agent-pushes`. No new config question, long form or catalog
entry.

**Supersedes:** nothing. **Ratified** 2026-10-16, answer 6.

As built, 2026-10-16: project folders under `agent-pushes` get no land step. Instead, the builder rule and the worktree step state who lands. The builder rule says the builder commits on its branch and the session lands that branch with `git merge --ff-only` and `git push` once the item is signed off. The worktree step, in `/delegate` (section 6) and in `/close-out` (section 4), opens by landing each signed-off branch from the primary checkout with `git -C`, never with `--force` or a rebase, and reports a refused fast-forward or push with git's output. A new `Landing` value in `src/render/skills.ts` (`none`, `step`, `direct`) carries the three cases, and `agentPushes()` still decides it. The land step was the first choice, but it needs more than a new record on folders. Its step 1 commits sign-off lines into a tracked item file, step 3 reads "Files it owns" and holds a row, its last paragraph writes a log line and `DONE`, and the claim commit before it exists because `passoff claim` edits the item file. A folder has none of these, and the lead's phase-header edits in the primary checkout would raise the same refused fast-forward that the claim commit fixed on a board, so the step would need its own folder rules. The two sentences carried the whole gap: they were the only folder text the 4.5 sweep matched. Under `print-blocks`, `agent-commits` and `no-rule` every render on both shapes is byte for byte as before, and a board under `agent-pushes` is unchanged.

### D7. The run commits and pushes its own folder and the fold's moves (answer 7, A)

After `/clean-up`'s fold, under `agent-pushes`, the lead runs from the primary checkout, with
`git -C`: `git add <the exact files>`, `git commit <the same files> -m "autopilot run <date>"`,
`git push`. The files are the run folder's `STATE.md` and `RUNDOWN.md`, and each tracked file the
fold moved, removed or changed. Untracked records stay as they are. Where the archive is its own
repository, the lead commits there too, naming its files, and pushes where it has a remote. The
fold's own timing rule reads, under this policy, "once every `DONE` item's tracked close-out is on
the base, which the land step did".

**Supersedes:** nothing. **Ratified** 2026-10-16, answer 7.

### D8. The rule line names any git command (answer 8, A)

"Claude may run any git command, including `git add`, `git commit`, `git merge` and `git push`."
Built as Phase 0 and on `main` as `eecac7a` (G42). Nothing in this effort touches it again.

**Ratified** 2026-10-16, answer 8. **Built** 2026-10-16.

### D9. The Autonomy call's content, in the plain register (open item 1)

Delegate-autopilot D21 fixes how the opening round is written: the template fixes each question's
content, options and default, and the session writes the words. So the wording this item asked
for is the template's content lines, in the register the other eleven questions use. They are
section 4.2's "Autonomy call". Question 5 (Deep rows) gains the option "all of them, including
rows written during the run" under `agent-pushes`, with none still the default: lifting a Deep row
is the owner's act (delegate-autopilot D6), and "all" is the owner naming every row at once.

**Defense.** The plain register is D16 of delegate-autopilot, and these lines match the shape of
"**Deep rows.** Which Deep rows to lift. Several may be chosen; none is the default." A copy
question in the owner's own chat would be R7's; these are a template's content, which D21 settled
as the engine's.

**Supersedes:** nothing. **Settled** by this design, 2026-10-16.

### D10. `/passoff` gains one sentence on the owner's call (open item 2)

Yes. Part 7 of `/passoff` gains, after "and that either answer may be no.": "Where a question must
wait for the owner even in an unattended run, write **owner's call** before it: `/autopilot`'s
decider holds a row on those words and never answers it." It renders through an `OWNERS_CALL`
token, filled only where `/autopilot` renders and the policy is `agent-pushes`; elsewhere it is
empty, so the golden (G47) and every other policy keep their bytes.

**Defense.** Two agents agreeing is not an owner (scope hazard). The item file's words are the only
guard, and a guard the writer has to invent each time is a guard that gets written three ways. The
sentence names the exact phrase D2 reads.

**Supersedes:** delegate-autopilot's "Rules that survive unchanged" first bullet, in part, under
`agent-pushes` only: `/passoff` and `/clean-up` no longer render the bytes they rendered at
`3fadd95` there (D11 carries the pointer). **Settled** by this design, 2026-10-16.

### D11. The supersession pointers, as dated notes under the decisions they touch (open item 3)

The delegate-autopilot design is frozen, so each pointer is a dated paragraph added under the
decision, never an edit to it. Three notes, in `docs/incomplete/delegate-autopilot/DESIGN.md`, in
these words:

Under D19:

> **Superseded in part, 2026-10-16, under `agent-pushes` only.** `docs/incomplete/autonomous-autopilot/DESIGN.md` D1 lands each signed-off row inside the run: the builder merges the base and gates in its worktree, the lead fast-forwards the primary checkout and pushes. Under `print-blocks`, `agent-commits` and `no-rule` this decision stands, and the landing stays out.

Under D24:

> **Superseded in part, 2026-10-16, under `agent-pushes` only.** A predecessor lands on the base before its successor launches (autonomous-autopilot D1), so the successor builds from the base and no branch stacks. Under `agent-commits` the branch stacking above stands; under `print-blocks` the hold stands.

Under section 6, first bullet:

> **Amended 2026-10-16.** Under `agent-pushes`, `/passoff` carries one added sentence (autonomous-autopilot D10) and `/clean-up` and `/close-out` carry the run's own commit in place of the owner's blocks (D7). The other policies render the bytes above.

One more pointer, in `~/Projects/archive/personal-config/worktree-sweep/SCOPE.md`'s status line: "Under
`agent-pushes` a landed row's worktrees pass the existing merged-and-clean check
(autonomous-autopilot D1, 2026-10-16); this sweep stays needed under `print-blocks` and
`agent-commits`."

**Settled** by this design, 2026-10-16.

### D12. The long-form paragraphs on what `agent-pushes` means for a run (open item 4)

Three edits, in these words. `catalog.json` is rebuilt after them.

In `docs/choices/commit-policy.md`, under "What it writes and where", after the paragraph that
ends "`git merge` and `git push`.":

> Under this answer the two skills that run a board also land what they build. `/delegate` gains a land step: after the audit, the builder merges the base into its branch from its own worktree, resolves a conflict only in a file its item lists, runs the gates again on the tree that lands, and the session fast-forwards your checkout and pushes. A row is `DONE` only once its commits are on the base. `/autopilot` decides the questions a builder raises, by how loud a wrong answer would be, and logs each with its reversal; a question the item file marks as the owner's still holds the row. At the end of a run it commits its own folder and what the fold moved, naming the files, and pushes. Under the other three answers both skills leave every branch in its worktree and every commit to you.

In `docs/choices/skills.md`, replacing "The builders' work stays in their worktrees; landing it is
yours." at the end of the `/autopilot` paragraph of "What it writes and where":

> Under every commit policy but **The agent may commit and push**, the builders' work stays in their worktrees and landing it is yours. Under that policy the run lands each signed-off row as it goes: the builder merges the base and runs the gates in its worktree, the session fast-forwards your checkout and pushes, and the row's worktrees go. The run's own folder and the fold's moves are committed and pushed at the end, with the files named.

In `docs/choices/skills.md`, after "so nothing is decided for you overnight." in the `/autopilot`
paragraph of "The defense":

> Under **The agent may commit and push** that changes: a question a builder raises is decided in the run, by a subagent on the tier a wrong answer calls for, and the rundown lists each decision with the one step that reverses it. Write **owner's call** in an item file before a question you want kept, and the run holds that row instead.

And in "The strongest argument against it", after the `/autopilot` paragraph's last sentence:

> Under **The agent may commit and push** a wrong merge is on the remote before anyone looks. Every landing re-runs the gates on the tree that lands, and nothing force-pushes or rebases, but a landed row that CI alone can fail is red on the base, not in a worktree.

The unreleased changelog bullet (G53) changes its sentence to: "`/delegate` and `/autopilot` read
it as they read the agent may commit, and land what they build: see the commit-policy long form."

**Settled** by this design, 2026-10-16.

## 4. The skill texts, outlined

The build's wording is free inside these limits: no em dash, no contraction, no AI-signal phrase,
no model family name (delegate-autopilot D12), no Part number of the standard, every token filled,
and under the other three policies not one byte moved. Where this section gives words in a fenced
block, the build places them as written, and the test pins the phrase.

### 4.1 `/delegate`

**The builder's rule (`COMMIT_RULE`, `agent-pushes`).** Replaces G40's first sentence:

```
Commit on your own worktree branch, naming the exact files in both the `git add` and
  the commit. The merge into the base and the push are the land step's (step 6), which this
  session sends you after the audit. If a hook blocks the commit, print the two commit blocks,
  do not work around it, and make the patch the auditor works from: <MAKE_PATCH> List in your
  report every file the change adds.
```

**Step 3, the audit dial (`AUDIT_DIAL`, `agent-pushes`, on a board).** One paragraph after "Where
the repo's tier ceiling is below Deep ...": under `/autopilot` with audits by tier, a Mechanical or
Light item lands on its gates with no auditor unless a trigger fires (D4's list, with the diffstat
numbers written once, in `/autopilot`'s defaults table); then step 4 signs it off on the builder's
report with the verdict "not audited: <tier>, no trigger".

**Step 4, the record (`RECORD`, `agent-pushes`).** The sign-off lines are the same; the commit
state reads "landed on <base> at <hash>, or held at the land step". Where the item's file is
tracked, the lines go into the land message (step 6), and the builder commits them. The log line,
`DONE - <date>` and the hand-back blocks wait for step 6's fast-forward.

**Step 6, the land step (`LAND_STEP`, `agent-pushes`; empty elsewhere).** Placed between "## 5.
Several items at once" and the worktree step, which becomes section 7:

```
## 6. Land it

After step 4 signs an item off, land it: the base takes the builder's branch, gated on the tree
that lands, and the push follows. The builder does the merge and the gates in its own worktree,
because its dependencies are there and that worktree is the one place this session never runs
git. Send it, with `SendMessage`, this step as it stands here, with `<base>`, the sign-off lines
and the gate list written in:

1. Where the item's file is tracked, append these sign-off lines to its close-out section:
   <the lines step 4 wrote>. Commit that file alone, naming it.
2. From your worktree's own directory, run `git merge --no-edit <base>` as one plain command,
   with the branch name written out. A fast-forward and a merge commit are both right.
3. On a conflict in a file your item's "Files it owns" lists, resolve it, `git add` that file,
   run `git commit --no-edit`, and say which file and how. On a conflict in any other file, run
   `git merge --abort` and report the file list: that is an undeclared overlap, and the row is
   held.
4. Run the fresh-checkout recipe's install line again, then every gate below: <the item's
   done-when gates, and the repo's gate command where it has one>. A gate that cannot run here
   is reported as skipped, with the reason.
5. Report: the merge result with `git rev-parse HEAD`, each gate with its output, and
   `git status --porcelain`, which must print nothing.

A builder that returns a pass-off instead of this report is at its budget. Land the row from a
worktree of your own: from the primary checkout, `git worktree add <a fresh path> <the builder's
branch>`, run steps 2 to 5 there with `git -C <that path>`, and remove that worktree in step 7.

Then, from the primary checkout, with `git -C` and the branch name written out:

    git merge --ff-only <the builder's branch>
    git push

Never `--force`, and never a rebase: the auditor reproduced the commits that land. A refused
fast-forward holds the row with git's output as its reason; where the base moved while the
builder was gating, send the message once more first. A refused push lands the row, stops every
later push in this session, and the rundown says how far ahead the base is. A red gate goes back
to the builder as a blocking finding, through step 4's fix round. A gate that could not run
here is listed under **Not verified**.

Only now write the record: the log line and `DONE - <date>` on the board, as step 4 says. Under
this policy a row is `DONE` when its commits are on the base. Then step 7 removes the row's
worktrees, whose branches the base now holds.
```

The two indented lines are a fenced `bash` block in the template.

**Section 7, the worktree step (`worktreeLimits`, `agent-pushes`).** G40's third sentence becomes
"The merge happened in the land step; this step only removes." The rest of the paragraph stands.

### 4.2 `/autopilot`

**The defaults table** gains, under `agent-pushes`, two rows written once: "Audit trigger: diffstat
| More than 300 lines changed, or more than 8 files" and "Decider questions per row | 3, then the
row is held".

**Section 2, which rows can run (`AFTER_UNCOMMITTED`, `agent-pushes`).** "A row whose predecessor
in its lane, or an item its "Waits on" names, was signed off in this run is runnable once that row
has landed (`/delegate`'s step 6): it builds from the base, which now holds the predecessor. A
predecessor whose landing is held holds it." Plus `CROSS_BOARD` (D5) after the "Waits on" bullet,
and `SCOPE_FIRST` replacing "Its prompt does not say to scope first." with: "Its prompt does not
say to scope first, or its item file carries a dated note that a run scoped it and its gate was
answered (section 5)."

**Section 3, the Autonomy call (`AUTONOMY_CALL`, `agent-pushes`).** After the second call:

```
**Autonomy call, after the second call. Four questions.** Each default is first and marked
recommended.

8. **Questions during the run.** Decide a builder's question here, by how loud a wrong answer
   would be, with the item file's own words binding and every decision logged with its reversal;
   or hold every row that asks, as the wake procedure's step 4 says without this answer.
9. **Scope-first rows.** Scope them in the run and answer the gate by each recommendation,
   holding only a question the item file or the document calls the owner's; or leave them out.
10. **Audits.** By tier: Deep and Default rows audited, Mechanical and Light rows landed on their
    gates unless a trigger fires; or every row.
11. **Other boards.** Read every "Waits on" that names another board by path on each wake, and
    hold instead of ending while such a wait is open; or treat such a wait as unmet.
```

Question 5 under `agent-pushes`: "**Deep rows.** Which Deep rows to lift: all of them, including
rows written during the run; the rows named; or none, the default." Question 1 gains one sentence
under `agent-pushes`: "Where several runs are open at once, say that they read one window and the
caps are joint, and offer a larger weekly share."

**Section 4, the state file** gains **Waits elsewhere** (D5) and, under **Rows**, "scoped: <path>"
where D3 ran.

**Section 5, scope-first rows (`SCOPE_RUN`, `agent-pushes`).** D3's procedure, as one paragraph
after the launch paragraph.

**Section 6, the wake procedure.** Step 3 gains (`LAND_ROUTE`): "Under this policy the record
follows the landing: route a signed-off row to `/delegate`'s step 6, and write the log line and
`DONE` when its fast-forward lands." Step 4 (`QUESTION_RULE`) is D2's text where the Autonomy
call's first answer is the default, and the `2eff50c` text otherwise, with the choice named in
the sentence.

**Section 7, stop rules** gains (`CROSS_BOARD_HOLD`): "A run with nothing in flight and at least one
open wait on another board holds on the holding wake instead of ending, until the end time."

**Section 8, the end.** Section 11 of the rundown (`COMMIT_BLOCKS`, `agent-pushes`): "**Landed**:
for each row, its branch, the merge commit or fast-forward, and whether the push went; the rows
landed and not pushed, with how far ahead the base is; and the exact files step 4 commits." Section
7 of the rundown is retitled by D2 (`DECISIONS_SECTION`). Step 4 gains (`END_COMMIT`), as the same
step: "Then commit the run from the primary checkout, with `git -C`: `git add <the run folder's
`STATE.md` and `RUNDOWN.md`, and each tracked file the fold moved, removed or changed>`, then
`git commit <the same files> -m "autopilot run <date>"`, then `git push`. Untracked records stay as
they are. Where the archive is its own repository, commit there too, naming its files, and push
where it has a remote."

### 4.3 `/clean-up` and `/close-out`

`/clean-up`'s archive step, under `agent-pushes`: "Uncommitted changes block it too: commit the
folder's final state yourself, naming its files, then `personal-config archive <slug> --move
--dry-run`, then again without `--dry-run`." Its hand-back clause: "Then commit everything the
sweep changed, naming the exact files, and push. **The archive may be its own repository**: its
commit is rooted there and names its own files, exactly as the command printed it." Its fold
step's timing line: "Run it only once every `DONE` item's tracked close-out is on the base, which
the land step did."

`/close-out`'s fold timing, under `agent-pushes`: "Fold an item only once its close-out is on the
base, so this item's file waits for the next close-out or for `/clean-up`." Its worktree step
takes the same `worktreeLimits` change as `/delegate`'s (4.1).

### 4.4 `/passoff`

D10's sentence, through the `OWNERS_CALL` token.

### 4.5 The tests

Each new rendered sentence gets a violating case (it is absent under `print-blocks` and
`agent-commits`) and a passing case (present under `agent-pushes`). The byte-equality test (G44)
becomes its opposite: under `agent-pushes` each skill contains the land step and not one of the six
reserved forms; under `agent-commits` it contains none of the land step and G40's two sentences as
before. One test renders every file under `agent-pushes` and pins this grep empty:

```
/never (push|merge)|no branch is pushed|commits? (is|are) the owner|pushing is|owner'?s commit|owner has committed|landing it is yours|merges nothing/i
```

"must never be merged" in `/close-out`'s proof sentence does not match it, and is a sentence about
claims, not git.

## 5. Dials

| Dial | Value | Why |
|---|---|---|
| DIAL-1 Gates at the land step | Every gate the row's done-when names, plus the repo's gate command where set | scope, section 4 |
| DIAL-2 A gate that cannot run at the land step | Skipped, listed under **Not verified**, does not block | scope, section 4 |
| DIAL-3 Conflict at the land step | Resolved by the builder in a file the row owns; any other file holds | scope, section 4 |
| DIAL-4 Push | After each landing; a refused push stops pushing for the run | scope, section 4 |
| DIAL-5 Landing attempts | 2, then the row is held | D1 |
| DIAL-6 Deep rows | all including rows written mid-run, named rows, or none (default) | D9 |
| DIAL-7 Decider questions per row | 3, then held | scope, section 4 |
| DIAL-8 Decider tiers | caught at once: the lead; looks right until tested: Default; silent in production: Deep | D2 |
| DIAL-9 Audit dial | by tier with triggers (default), or every row | D4 |
| DIAL-10 Audit trigger, diffstat | more than 300 lines, or more than 8 files | scope, section 4 |
| DIAL-11 Cross-board wait | read on every wake; a run with only such waits holds on the holding wake | D5 |
| DIAL-12 Several runs, one window | no division; the caps are joint by construction, and the opening round says so | D5, G54 |
| DIAL-13 Lander budget fallback | a landing worktree of the lead's own | D1 |
| DIAL-14 End-of-run commit message | `autopilot run <date>` | scope, section 4 |

## 6. Rules that survive unchanged

A build phase does not touch these, however helpful the edit looks.

- **The other three policies.** Under `print-blocks`, `agent-commits` and `no-rule` every skill
  renders the bytes it renders at `4348b20`. The golden (G47) proves it for `print-blocks`; the
  rewritten G44 test proves it for `agent-commits`.
- **`agentCommits()`** returns true for both policies. The builder commits on its branch under
  each.
- **`standard/`**, both files, byte for byte. Part 7 and Part 11 already say what `agent-pushes`
  allows.
- **The rule line** (D8, `eecac7a`) and `tests/agent-pushes.test.ts`'s pins on it.
- **G41's sentences.** "isolation refuses `git -C` on another worktree", "Never `git apply -N`",
  and the preflight merge's "never through a shell variable or `git -C`" are facts about the
  harness and git, and stay.
- **The audit of Deep and Default rows**, two fix rounds, the Deep lift as the owner's act (D6 and
  D7 of delegate-autopilot), and the orchestrator as the only writer of the board and the ledger
  (D9).
- **The opening round's first seven questions**, their options and defaults, except the two
  sentences D9 adds under `agent-pushes`.
- **The rundown's section order** (D13). One title changes under `agent-pushes` (D2).
- **`/audit`, `/scope`, `/handoff`** render as at `4348b20` under every policy.
- **No CLI command.** The land step is skill text and git.
- **`worktree-sweep`**, ratified and unbuilt, stays ratified for the other two policies (D11).

## 7. Hazards this work walks into

The scope's section 5 stands, with these changes and additions.

- **The sweep is six sentences, not three** (G45). A build that takes G40's list alone leaves
  `/clean-up` telling an agent under `agent-pushes` that the commit is the owner's, and the grep
  in 4.5 is what catches it.
- **The byte-equality test** (G44) fails the moment the land step renders. The build rewrites it
  in the same change, and the rewritten test is the proof that `agent-commits` did not move.
- **"Three sessions, one usage window" is withdrawn** (D5, G54). The hazard that replaces it: a
  run's weekly spend reading counts the other runs' spend, so one run may stop at the weekly cap
  that the three together reached. That is a conservative stop, and the opening round offers a
  larger share.
- **The lead's `git -C` into its own landing worktree** (D1 fallback) is a different thing from
  G25's unverified call into an agent's worktree. The runtime pass records the first time each is
  run.
- **A `git merge --no-edit` in a worktree where a hook runs.** A commit hook that blocks the
  builder's commit blocks its merge commit too; the builder reports it as it reports a blocked
  commit, and the row holds.
- **`doctor` at the land step sees only tracked files** (CLAUDE.md, "Gates that lie"). A scope
  document landed by D3 is tracked and is scanned; the board and the ledger are not.
- **This folder is scanned** (G56). Every date here is absolute, every token name here is written
  without braces outside a fence, and every absence names its search.
