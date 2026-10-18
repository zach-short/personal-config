# Scope: an autonomous mode for `/autopilot` and `/delegate`

**Status:** `RATIFIED` 2026-10-16: the seven questions in section 6 were asked in chat the same
day, and every recommendation was taken (section 7). Opened 2026-10-16 as `SCOPING` by a Fable 5.1
session in worktree `committed-status-f2d341` at `2eff50c`. Owner: Zach. Nothing is built. The next
step is a design and a plan (`DESIGN.md`, `PLAN.md`) in this folder, then build rows on the board.

**Why this exists.** The owner wants one `/autopilot` session, with Fable in charge, to run every
row on three boards until they are done: build, audit, commit, merge, push, remove the worktrees,
update the board, and fold closed items into the archive, with nobody at the keyboard. On
2026-10-16 the `agent-pushes` commit policy landed (`6c312ea`): no commit guard, and the agent may
run `git add`, `git commit` and `git push`. The two skills do not yet use that permission. Their
text still forbids a merge, holds every owner question, keeps every Deep row, audits every row,
and reads one board. Each of those is a stop. This document lays out the choices that would
remove the stops, with a recommendation for each. It decides nothing.

## 1. What exists, verified 2026-10-16

Every claim was checked by this session on 2026-10-16. Line numbers are in the worktree at
`2eff50c`, which is `main`.

### The skills as rendered

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | The builder never merges or pushes | Under `agent-commits` and `agent-pushes` alike the brief says "Commit on your own worktree branch ... Never push and never merge." | `src/render/skills.ts:302-308` |
| G2 | The rundown never merges | Its last section says "No branch is pushed or merged." under both policies | `src/render/skills.ts:399-403`; `templates/skills/autopilot.md:256` |
| G3 | `agent-pushes` is read as `agent-commits` | `agentCommits()` returns true for both, and the comment says so: the policy "changed what the agent may do in the owner's session, not what a builder subagent does" | `src/render/skills.ts:272-281` |
| G4 | Signed-off rows stack on branches | A row whose predecessor was signed off in this run "builds from that row's worktree branch", and the merge order is the owner's | `src/render/skills.ts:387-393`; `templates/skills/autopilot.md:58` |
| G5 | The worktree step removes only merged, clean worktrees | `git merge-base --is-ancestor <branch> <base>` must exit 0 and `status --porcelain` must print nothing; "This step merges nothing" | `src/render/skills.ts:885-913`; `templates/skills/delegate.md:134` |
| G6 | So under `agent-commits` nothing is removed | The auditor's worktree is kept "until the builder's branch is merged", and nothing in either skill merges it | `src/render/skills.ts:313-319` |
| G7 | Every row gets an auditor | "Use the Default tier, or Deep for a Deep item and for an item the owner named load-bearing" | `templates/skills/delegate.md:94-99` |
| G8 | Owner questions hold rows | A builder's question "is answered here, never by asking"; one that implements a settled decision is taken and logged; "Anything else holds the row" | `templates/skills/autopilot.md:182-185` |
| G9 | Only the person lifts Deep rows | "It is not Deep, or the person lifted it in the opening round. Only the person lifts a Deep row." The second call asks which rows; "none is the default" | `templates/skills/autopilot.md:66`, `:111` |
| G10 | Scope-first rows never run | "Its prompt does not say to scope first." is a condition of runnable | `templates/skills/autopilot.md:59` |
| G11 | A Deep row written mid-run cannot be lifted | `/audit` writes security rows as Deep and says "It is never built in this run: the Deep lift question came" before the row existed | `templates/skills/audit.md:135` |
| G12 | One board per run | `/autopilot` reads `{{BOARD_FILE}}`, runs in the primary checkout, and its run folder is under that repo | `templates/skills/autopilot.md:12`, `:39`, `:123` |
| G13 | Only the orchestrator writes the board and the ledger | Builders do not edit them; the lead writes the record into the builder's worktree copy of the item file so it lands in the builder's commit | `templates/skills/delegate.md:60`; `src/render/skills.ts:457-482` |
| G14 | A worktree cannot be the lead | `/delegate` and `/autopilot` both stop when `git rev-parse --show-toplevel` is not the first path of `git worktree list` | `templates/skills/delegate.md:33-35`; `templates/skills/autopilot.md:39-40` |
| G15 | The tests pin the no-merge text | `expect(text).toContain('Never push and never merge.')` under `agent-commits`; `'No branch is pushed or merged.'` under `agent-commits`; the `agent-pushes` loops check only for unfilled tokens | `tests/delegate-skill.test.ts:178-185`; `tests/autopilot-skill.test.ts:142-148`, `:214-220` |

### The commit policy seam

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G16 | `agent-pushes` writes one line | `Claude may run \`git add\`, \`git commit\` and \`git push\`.` in `commits.md`, and the same line in each router | `src/render/rules.ts:78`, `:87`; `src/render/context.ts:178-179` |
| G17 | No guard under `agent-pushes` | The commit guard is not installed, and a re-run removes one an earlier run installed. The guard also blocked `merge`, `rebase`, `pull` and `gh pr merge` under every other policy | `docs/choices/commit-policy.md:102-107`; `HANDOFF.md:95-96` (main checkout) |
| G18 | All three target repos run `agent-pushes` | `"commitPolicy": "agent-pushes"` in each `.personal-config.json` | `~/Projects/personal-config/.personal-config.json:21`; `~/Projects/ezhomesteading/.personal-config.json`; `~/Projects/wk/.personal-config.json:21` |
| G19 | The completion gate reads `gateCommand` from the working directory | `config=".personal-config.json"`, read with `sed`; a worktree has no such file, so the hook exits 0 there | `templates/hooks/completion-gate.sh:139-146` |
| G20 | Two of the three repos have no `gateCommand` | personal-config: `bun run typecheck && bun run lint && bun test && bun run doctor examples`. ezhomesteading: `""`. wk: `""`. ezhomesteading's gates are eleven fenced lines in its `CLAUDE.md`; wk's `Commands` section is an unfilled template comment | the three `.personal-config.json` files; `~/Projects/ezhomesteading/CLAUDE.md:59-72`; `~/Projects/wk/CLAUDE.md:32-37` |

### The runs so far

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G21 | personal-config, 2026-10-15 | Row 89 built, two Fable audits, `DONE` and not committed; row 90 `HELD` on that commit; rows 91 to 93 behind it. Three worktrees left. The run ended in 32 minutes because nothing else could launch | `docs/incomplete/autopilot-2026-10-15/RUNDOWN.md` (main checkout), paragraph 1 and Warnings |
| G22 | ezhomesteading, 2026-10-16 | Six rows `DONE`, none committed; row 192 held on wording the opening round did not ask; row 195 held on row 185's commit; ten auditor worktrees and one empty builder worktree left; six decisions waiting for the owner, four of them copy | `~/Projects/ezhomesteading/docs/incomplete/autopilot-2026-10-16/RUNDOWN.md`, paragraph 1, Decisions, Warnings |
| G23 | The 2026-10-03 landing was a separate session | 26 branches through one integration branch, merged, not pushed; rows went `DONE` only after it. D19 then kept landing out of the skills | `docs/incomplete/delegate-autopilot/DESIGN.md:73` (G28), `:494` |
| G24 | Worktrees left at 2026-10-16 | personal-config: 5 worktrees, 6 unmerged branches. ezhomesteading: 13 worktrees. On 2026-10-15 one projects folder held 36, about 55 GB | `git worktree list` in each; `src/render/skills.ts:866-868` |
| G25 | A lead's `git -C` into an agent's worktree is not verified | The 2026-10-15 rundown says "The harness refuses `git -C` on another agent's worktree. Both auditors reproduced the change by `cp`." Both cases were agent to agent. No record shows the lead session running git inside an agent's worktree, or being refused | the two rundowns, Warnings |
| G26 | The owner's landing at 2026-10-16 is a hand-written skill | `/land-worktrees` surveys, predicts merge trees, gates a trial tree, and hands the owner `land.sh`; "Merge commits are commits, and commits are the owner's." It is not shipped, so no template can name it | `~/.claude/skills/land-worktrees/SKILL.md` |
| G27 | A sweep of dirty auditor worktrees is ratified and unbuilt | worktree-sweep: archive a patch, then remove each auditor worktree of a `COMMITTED` item, in `/clean-up`, after the owner's yes; it waits on the `COMMITTED` status landing on `main`, which it has not | `~/Projects/archive/personal-config/worktree-sweep/SCOPE.md`, sections 6 and 7; `git merge-base --is-ancestor 0ac7cf1 main` exits 1 |

### The three repos

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G28 | personal-config's board | One `OPEN` row, 110, "Scope first; the library and the home menu are Zach's calls at GATE 1", and its item file says "do not pick either before he answers" | `PASSOFF.md:113` (main checkout); `passoff/110-make-a-bare-personal-config-open-a-guided-setup.md:6-7` |
| G29 | ezhomesteading's board | 72 rows, 65 not finished | `grep -cE '^\| [0-9]+ \|' ~/Projects/ezhomesteading/PASSOFF.md` |
| G30 | wk's board is empty | One placeholder row, `<!-- first task -->`. `HANDOFF.md`'s Environment table has no commands. `grep -rni mvp` over its `HANDOFF.md`, `PASSOFF.md`, `CLAUDE.md` and `docs/` prints nothing | `~/Projects/wk/PASSOFF.md:19`; `~/Projects/wk/HANDOFF.md:19-24` |
| G31 | wk is a worktree tool | "wk makes warm git workspaces for parallel agents ... wk also judges which worktrees are finished and removes them." P1 of four phases; the design lives in ezhomesteading `docs/incomplete/landing-layer/`. ezhomesteading rows 196, 199 and 200 are about it | `~/Projects/wk/README.md:3-5`; `~/Projects/ezhomesteading/PASSOFF.md:92-95` |
| G32 | The ledger and board are untracked in personal-config and ezhomesteading | `HANDOFF.md`, `PASSOFF.md` and `passoff/` are untracked, so a worktree never sees them and `doctor` lies there | `CLAUDE.md`, "Gates that lie"; ezhomesteading `.personal-config.json` `"trackMode": "untracked"` |

### The harness

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G33 | The timer clamps to one hour | `ScheduleWakeup` delays are clamped to `[60, 3600]` seconds | the tool's definition in this session, 2026-10-16 |
| G34 | A subagent's worktree is the session repo's | `isolation: "worktree"` "gives the agent its own git worktree (auto-cleaned if unchanged)". It is a worktree of the repository the session runs in; nothing offers another repository | the Agent tool's definition, 2026-10-16 |
| G35 | A session cannot start a session from an automated turn | "On a turn that another session's message or an automated event started, the app refuses a start: propose instead." A `/loop` wake is an automated turn | this session's system prompt, 2026-10-16 |
| G36 | A returned builder can be continued | `SendMessage` to the agent's id "continue[s] a previously spawned agent with its context intact"; `/delegate` step 4 already uses it for fix rounds | the Agent tool's definition; `templates/skills/delegate.md:123-124` |
| G37 | `cd` moves the session's working directory | The standing orders forbid it for the lead; an agent in a worktree runs git as plain commands from its own directory | `templates/skills/autopilot.md:269-271` |

### The owner's statement on git, added 2026-10-16

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G38 | Under `agent-pushes` no generated text may discourage git use | The owner, quoted by the session that started this one: "There can be no remnants of discouraging Claude from using Git. In any capacity." and "From here on out, I have no issue with Claude doing anything itself related to Git. Including adding committing merging patching etc" | cross-session message from `local_7673e55b`, 2026-10-16 |
| G39 | The rule line names three verbs | `Claude may run \`git add\`, \`git commit\` and \`git push\`.` in three places, and a test pins it as `MAY_PUSH` | `src/render/rules.ts:87`; `src/render/context.ts:178-179`; `src/questions/practices-policy.ts:147-149`; `tests/agent-pushes.test.ts:33`, `:54`, `:78`, `:196` |
| G40 | Sentences that reserve git for the owner, rendered under `agent-pushes` | "Never push and never merge." (G1); "No branch is pushed or merged." (G2); "This step merges nothing, so it never merges into a branch the repo marks as protected, or into any other." in the worktree step | `src/render/skills.ts:305`, `:402`, `:907` |
| G41 | Sentences that state a harness refusal or a verified breakage, not a reservation | "never `git -C` on another worktree, which isolation refuses"; "Never `git apply -N`: on git 2.49.0 it replaced the auditor's whole index"; the builder's "never through a shell variable or `git -C`" for the preflight merge | `templates/skills/autopilot.md:271`; `templates/skills/delegate.md:109`; `src/render/skills.ts:347`; `templates/skills/delegate.md:66-68` |

### Prior decisions this scope touches

| Decision | What it says | What this scope does to it |
|---|---|---|
| D6 (delegate-autopilot) | Deep rows are held unless the owner names them; a lifted row gets a Deep builder and a Deep review | Keeps the review. Adds a way to name every Deep row at once, rows written mid-run included |
| D7 | Every row gets an auditor; two fix rounds, then held | Section 3.4 offers a dial |
| D8 | Owner questions are asked up front; otherwise the row is held | Section 3.2 offers a decider |
| D9 | Only the orchestrator writes the board and the ledger | Unchanged |
| D19 | The landing process stays out of this effort | Reversed under `agent-pushes` only, by section 3.1. The design needs a dated supersession pointer when this is ratified |
| D24 | A row after a signed-off, uncommitted row builds from its branch under `agent-commits` | Under `agent-pushes` the predecessor lands first, so the row builds from the base. `agent-commits` keeps D24 |
| worktree-sweep (ratified 2026-10-15) | `/clean-up` archives a patch and removes each auditor worktree of a committed item | Mostly made moot under `agent-pushes`: a landed row's worktrees pass G5's existing check. It stays needed for `print-blocks` and `agent-commits` |

## 2. What this is, and what it is not

**This is** a mode of the two shipped skills, rendered only where the commit policy is
`agent-pushes`, in which a run: lands each signed-off row (merge to the base, gates on the landed
tree, push, remove the worktrees); answers the questions a builder raises, by severity, through a
decider on the right tier, each answer written with its reversal; scopes a "scope first" row
inside the run; audits by tier instead of every row; and has a documented way to run three
repositories to completion. It is skill text in `templates/skills/{autopilot,delegate}.md`, a
policy seam in `src/render/skills.ts` beside `agentCommits()`, tests with a violating and a
passing case for each new sentence, and the long forms that describe the skills and the commit
policy. It lands as one `setup` re-run on each machine.

**This also is**, from G38: a sweep of everything the tool renders under `agent-pushes` for a
sentence that reserves a git action for the owner, and its replacement with the step that does
the action (the land step for G40's three sentences) or with the permission line (G39). A
sentence that states a harness refusal or a verified breakage (G41) is a fact about git or the
harness and stays, worded as a fact: "isolation refuses `git -C` on another worktree" rather than
"never run". The build's done-when includes a grep of the rendered output under `agent-pushes`
for the reserving forms (`never (push|merge)`, `no branch is pushed`, `commits are the owner's`,
`pushing is`), and a test that pins the grep empty.

**This is not:**

- A CLI command. No `personal-config land`. The merge, the gates and the push are git and the
  repo's own commands, written in skill text, as every other step of these skills is.
- A change to `print-blocks`, `agent-commits` or `no-rule`. Under those three policies both
  skills render exactly as at `2eff50c`. D24 and the worktree-sweep scope stand there.
- A change to `standard/`. Its content is frozen except its version line. Part 7's closing ritual
  and Part 11's commit line already say what `agent-pushes` allows.
- A `wk` integration. `wk` is the owner's tool, not shipped here, so a template cannot name it
  (S1). Setting `wk` up in three repos is a board row in each, not a feature of these skills.
- The definition of `wk`'s MVP. Its board has one placeholder row (G30). Until rows exist there,
  a run in `wk` has nothing to do. That definition is the owner's, separately.
- Watching CI, or deploying. A push runs CI and nothing else ("Merged is not shipped",
  `CLAUDE.md`). A red CI on the base after a landing is loud and the owner's.
- A conflict resolver. A merge conflict outside the files a row owns holds the row (section 3.1).
- A fix for the two worktree sessions whose branches sit unmerged in this repo at `2eff50c` (G24).
  `/land-worktrees` does that.

## 3. Options

Each option has its defense and the strongest argument against it. The recommended option is
marked.

### 3.1 The land step (blocker 1)

Every option shares the trigger: a row has passed `/delegate` step 4 (clean or non-blocking
findings) and its record is written. Every option runs the gates again on the exact tree that
lands, because the audit ran on the builder's tip against the base as it was then, and the base
may have moved. Every option ends with `git push` of the base, never `--force`, and removes the
row's worktrees by the existing merged-and-clean check (G5), which now passes.

**A. The builder lands its own branch; the lead fast-forwards and pushes.** *Recommended.*
The lead sends the builder, by `SendMessage` (G36), one more step: from its own worktree, run
`git merge <base>` as a plain command (a fast-forward when the base has not moved, a merge commit
when it has); on a conflict in a file the row owns, resolve it and say so; on a conflict in any
other file, `git merge --abort` and report; then run every gate the row's done-when names and the
repo's `gateCommand` where one is set, and report each with its output. The lead then runs, in
the primary checkout, `git merge --ff-only <the builder's branch>`, then `git push`, then the
worktree step. A refused fast-forward or a refused push holds the row's landing, with git's
output under **Held**.

*The defense.* No new tool and no `git -C` into an agent's worktree, which is unverified (G25).
The gates run where the dependencies already are: the builder ran the fresh-checkout recipe
before its first gate. A fast-forward into the primary checkout cannot take a parallel session's
staged files into a commit, and git refuses it when a dirty tracked file would be overwritten;
`/land-worktrees` rests on the same fact. The tree the gates saw is the tree that lands, byte for
byte, because the fast-forward moves a ref and writes no new tree.

*The strongest argument against it.* It asks a returned subagent to do more work, and a
subagent that has run long may be near its budget: the relay contract then produces a pass-off
instead of a landing, and the lead must spawn a fresh builder in the same worktree, which the
Agent tool cannot do (it makes a new worktree). The fallback is option B for that row. It also
puts merge commits named `Merge branch 'main' into worktree-agent-...` on the base whenever the
base moved; a `rebase` would avoid them, and a rebase rewrites the commit the auditor reproduced,
so it is not offered.

**B. The lead merges in the primary checkout and gates a clean export.** The lead runs
`git merge --no-ff <branch>` in the primary checkout, exports `HEAD` with `git archive | tar -x`
into a fresh temp directory (Part 6's "build HEAD in isolation"), runs the fresh-checkout recipe
and the gates there, then pushes. A red gate is followed by `git reset --hard ORIG_HEAD`.

*The defense.* The lead does everything; no subagent is continued. The gated tree is exactly
`HEAD`, with none of the primary checkout's uncommitted edits in it.

*The strongest argument against it.* The export has no `node_modules`, no `.env`, no generated
files: the recipe runs from nothing for every row, which in ezhomesteading means `bun install`,
three copied files and a Go toolchain, several minutes a row. `git reset --hard` in the owner's
primary checkout is one of the five discard commands the guard existed to block, and under
`agent-pushes` nothing blocks it. And a merge conflict lands in the owner's working tree, where the
owner may be editing.

**C. Land once, at the end of the run, like `land.sh`.** Every signed-off row stacks on its
predecessor's branch during the run (G4, as at `2eff50c`); at the end the lead predicts one merged tree,
gates it once, commits it and pushes.

*The defense.* One gate run for the whole run, one push, and the merge order is checked across
every row at once, which is how the 2026-10-03 landing worked.

*The strongest argument against it.* A run that stops early (a cap, a crash, a sleeping machine)
lands nothing, which is the `2eff50c` state. One red gate at the end names no row. And every later row
built on a stack: when the auditor's finding on row 1 forces a fix, rows 2 and 3 were built on the
version before the fix.

### 3.2 Questions during the run: the decider (blocker 2, first half)

At `2eff50c` a builder's question is taken only when it implements a decision the row or the design
already made; anything else holds the row (G8). The 2026-10-16 run left six decisions, four of
them copy (G22).

**A. A decider by severity, with the item's own words binding.** *Recommended.* The lead sorts
each question by what a wrong answer would do, not by how large the question looks:

- *Caught at once*: a gate or the eye shows a wrong answer (a copy variant, a casing, a default
  value, a file to add to the row's list when it is in no other open row's list). The lead takes
  it itself and logs it with a reversal, as it does at `2eff50c` for settled decisions.
- *Looks right until tested*: the answer picks between designs, changes a flow, or touches a shared
  primitive. A Default subagent reads the row, the question and the code it names, decides, and
  returns the decision and its reversal in a few lines.
- *Compiles, passes every gate, wrong in production*: money, sync or merge rules, a notification,
  data deleted, a migration, a public contract, a cross-row file. A Deep subagent decides, or
  holds the row when it finds the question is the owner's.

A question is never decided, whatever its severity, when the item file says it is the owner's
("Zach's call", "do not pick before he answers", "Ask before building" with no answer in the
opening round), or when the answer would widen "Files it owns" into a file another open row
lists. Those hold the row, as at `2eff50c`. Every decision goes under **Judgment calls** with its
reversal and the decider's model, and the rundown's **Decisions waiting for the owner** becomes
**Decisions taken for the owner**, each with its reversal, so the morning read is the same length
and every line is reversible. The decider is a subagent for the same reason the auditor is: a
fresh context that reads the code, where the lead reads only reports.

*The defense.* The run keeps moving on the questions that stop it most often, which the two
rundowns show are copy and small widenings (G22). The item file's own words stay the strongest
rule, so an owner who wants a call kept writes it there, where it already is for row 110 (G28).
The Deep tier decides exactly the questions whose wrong answer is silent, which is what the tier
is for.

*The strongest argument against it.* A decision that compiles is the silent failure the hold
existed to prevent, and a reversal line is only useful to someone who reads it. Copy chosen by an
agent is copy the owner did not choose, and the copy-registers practice ("ask three registers")
exists because the owner wants to pick. It is accepted here because every decision is reversible
by one listed step and the owner asked for a run that does not stop.

**B. A decider for build questions only; copy and product questions hold.** As A, but a copy
variant, a wording, or anything the row calls the owner's holds the row.

*The defense.* The owner's taste stays the owner's.

*The strongest argument against it.* On 2026-10-16 four of six holds were copy. The run would
still stop on most of what stops it at `2eff50c`.

**C. Hold everything, as at `2eff50c`.** The run builds what it can and lists the rest.

*The defense.* Nothing is decided for the owner.

*The strongest argument against it.* It is the `2eff50c` state, which the owner asked to leave.

### 3.3 Scope-first rows (blocker 2, second half)

A row whose prompt says "scope first" never runs (G10). `/scope` is four stages: read, ground
truth, the scope document, and a gate asked in chat.

**A. A scoper writes the document; a Deep decider answers the gate under the same rules as 3.2.**
*Recommended.* The lead spawns a Default subagent in its own worktree with `/scope`'s text and the
row's prompt; it returns the scope document with every option carrying a recommendation, written
to the row's `docs/incomplete/<slug>/`. The lead then sends the gate questions to a Deep decider
with the document. Each question is answered by its recommendation unless the decider finds a
reason in the document or the code not to, and each answer is written into the document's answer
section as "decided by <model> in `<run folder>`, <date>, reversal: ...". A question the item file
or the document marks as the owner's holds the row with the document written, so the owner's
morning starts at the gate, not at a blank folder. A row that passes its gate is `OPEN` with the
document as its design input, and the next wake may launch it.

*The defense.* The ground truth and the options get written either way, which is most of a
scope's cost. The item file's words still bind (row 110 holds on "Zach's calls at GATE 1" by its
own text, G28). A Deep decider on a gate is a Deep review of a design, which the tiers already
prefer over a Deep build.

*The strongest argument against it.* A gate question is the one place the owner's product sense
enters, and a recommendation written by a Default scoper and taken by a Deep decider is two
agents agreeing with each other. The guard is the item file: an owner who wants the gate writes
"owner's call" in the row, and `/passoff`'s template can carry that line.

**B. Scope only; hold at the gate.** The scoper writes the document; the row holds for the owner.

*The defense.* Every gate stays the owner's, and the morning starts at a finished document.

*The strongest argument against it.* Every scope-first row still stops the run.

**C. Leave scope-first rows out, as at `2eff50c`.**

*The strongest argument against it.* personal-config's only open row is scope-first (G28).

### 3.4 The audit dial (blocker 3)

**A. By tier, with escalation triggers.** *Recommended.* Deep and Default rows are audited as
at `2eff50c` (Deep review for Deep and load-bearing rows, Default review for Default rows). Mechanical and
Light rows land on their gates, with no auditor, because their tier is defined as work "where the
whole check is the gates and reading the output". A Mechanical or Light row is audited after all
when any trigger fires: it touched a file outside its "Files it owns", it needed a fix round or a
relay pass, it claimed a number, its diffstat exceeds a dial (section 4), or the decider marked it
load-bearing while answering a question on it. The opening round offers this and option B.

*The defense.* It follows the tier table's own words: a Mechanical row's check is the gates. The
triggers catch a row that was tiered too low, which is the failure D7 worried about. The saving is
one Default agent per Mechanical row, and the 2026-10-16 run spent ten of nineteen agents on
audits.

*The strongest argument against it.* D7 rejected "review Deep rows only" because a Default auditor
found five defects on an ordinary Default row. That evidence is about Default rows, which stay
audited; no run has measured what an auditor finds on a Mechanical row. Under autonomous landing
an unaudited row is pushed, not left in a worktree for the owner, so the cost of a miss went up at
the same time.

**B. Every row, as at `2eff50c` (D7).**

*The defense.* Known, and the only option with evidence behind it.

*The strongest argument against it.* Twice the agents on rows whose check is the gates.

**C. Deep and load-bearing rows only.** Rejected by D7 on evidence; listed so it is not re-proposed.

### 3.5 Running across repositories (blocker 4)

The owner's order is: `wk` to its MVP, then `wk` set up in three repos, then the boards of
personal-config and ezhomesteading. The second step is a row in each repo that waits on a row in
`wk`.

**A. One session per repository, started together, with cross-repository "Waits on".**
*Recommended.* The owner opens one `/autopilot` in each primary checkout and answers each opening
round in the same minutes. A row's "Waits on" may name another repository's item as
`<absolute path> item <n>`. On every wake a run reads that board by path, and a row whose wait is
not `DONE` there holds; a run with nothing in flight and at least one cross-repository wait does
not end but holds on the holding wake (3600 seconds, G33) and reads again. The run folder gains a
**Waits elsewhere** line per such row.

*The defense.* It uses nothing unverified: each lead runs in its own primary checkout (G14), its
subagents' worktrees belong to its own repository (G34), and its timer is its own. Three boards
run in parallel where they can, which the serial options cannot. The one new thing, a path in a
"Waits on" cell, is text the lead already reads.

*The strongest argument against it.* Three opening rounds and three rundowns, three sessions to
keep open, and a usage budget split three ways with no shared cap: three runs each freezing at 75%
of the five-hour window see the same window, so each must take a third of the default share, which
the opening round has to say. A run that only waits burns a wake an hour for nothing.

**B. One session chains the next repository at the end of its run.** The rundown's last step
starts a new session in the next repository with the remaining queue.

*The defense.* One opening round for everything, and the order is serial by construction.

*The strongest argument against it.* The app refuses a session start on a turn an automated event
began (G35), and every wake of a run is such a turn. The end of a run is a wake. This would need
the owner's own message to start each next session, which is three sessions started by hand with
extra steps.

**C. One session, repositories in sequence, from a folder above them.** The lead runs with a
queue of boards by absolute path and spawns builders for each.

*The strongest argument against it.* The Agent tool's worktree belongs to the session's repository
(G34), and a session above three repositories has none; the lead would `git worktree add` each
builder's worktree itself and tell the subagent to `cd` there, which G37's standing order forbids
for a reason, and which no run has done. Both skills require the primary checkout (G14). This is
a different tool, not a mode.

### 3.6 Where the mode is switched on

**A. The land step renders under `agent-pushes`; the rest is the opening round.** *Recommended.*
A new `agentPushes()` seam in `src/render/skills.ts` beside `agentCommits()` renders the land step,
the rewritten builder rule (G1) and the rewritten rundown section (G2), and drops `AFTER_UNCOMMITTED`'s
branch-stacking sentence (G4) for a sentence that says a predecessor lands first. The decider, the
scope-first rule, the audit dial and the cross-repository wait are questions in the opening round,
each with a default marked recommended, so a person on `agent-pushes` can still choose at `2eff50c`'s
holds for one run. Under the other three policies both skills render byte for byte as at `2eff50c`.

*The defense.* Pushing is the permission that makes landing possible, so the land step has exactly
one switch, the one the owner already answered. The run-level choices stay where every other cap
is, in the opening round, and need no new question, long form or catalog entry.

*The strongest argument against it.* The opening round grows by one call. A person who wants the
decider off on every run answers it every time.

**B. A new `you`-phase question, `autonomy`, with its long form.** The decider, dial and
scope-first behaviour become config, rendered into the skill text.

*The strongest argument against it.* A fifth answer about commits and agency, a new long form, a
catalog rebuild and a profile change, for choices that may differ run to run. It can be added later
if the opening round proves tiresome.

### 3.7 What the run commits at its end

Under `agent-pushes`, with the rows landed, two things are left uncommitted in a repository that
tracks them: the run folder (`docs/incomplete/autopilot-<date>/`, tracked in personal-config) and
what `/clean-up`'s fold moved (closed item files and their rows, where the board is tracked).
At `2eff50c` `/clean-up` posts the commit blocks and stops.

**A. The run commits and pushes them, naming the exact files.** *Recommended.* After the fold,
the lead runs `git add <exact files>` and `git commit <the same files> -m "autopilot run <date>"`
in the primary checkout, then pushes. Untracked records (G32) are left as they are. A fold's
removals are included, because the fold waited for the item's commit, which the land step made.

*The strongest argument against it.* It is a commit in the owner's primary checkout, where another
session may be mid-edit; naming the files keeps the collision out of the commit, but not out of the
working tree.

**B. Print the blocks, as at `2eff50c`.**

*The strongest argument against it.* The run ends with one thing left for the owner to paste, after
landing everything else itself.

### 3.8 The rule line under `agent-pushes` (G38, G39)

The one line in `commits.md`, each router and Part 11 names three verbs. The owner wants every git
action covered. Three wordings, in the plain register the other rule lines use:

**A. "Claude may run any git command, including `git add`, `git commit`, `git merge` and
`git push`."** *Recommended.* The general permission first, then the four verbs a reader looks for.

*The defense.* "Any git command" is the owner's statement in five words, and the examples keep the
line greppable where the old one was.

*The strongest argument against it.* The line names no exception, so a reader who wants one for
a destructive command finds none. That matches G38; the land step's text describes what the step
does, which is to push without `--force`, and the rule line is where the permission lives.

**B. "Claude runs git itself: add, commit, merge, rebase, push, and the rest."** Shorter, verbs
as words.

*The strongest argument against it.* It drops the backticked commands a reader greps for, and
"the rest" is vague.

**C. "Git is Claude's to run, in full. Nothing here reserves a git command for the owner."** Two
sentences, the second aimed at the sweep in section 2.

*The strongest argument against it.* It is a sentence about the document, not about what to do.

Whatever the wording, it replaces `AGENT_PUSHES` in `src/render/rules.ts`, `commitRuleLine` in
`src/render/context.ts`, the `agent-pushes` paragraph in `src/questions/practices-policy.ts`, the
`MAY_PUSH` constant in `tests/agent-pushes.test.ts`, and the quoted line in
`docs/choices/commit-policy.md` and `docs/choices/commit-policy-practice.md`; then `catalog.json`
is rebuilt.

## 4. Dials

Each is a number or a choice the design leaves open, with a recommended default, and belongs in
the skill's defaults table so the opening round can offer it.

| Dial | Default | Why this value |
|---|---|---|
| Gates at the land step | Every gate the row's done-when names, plus `gateCommand` where set | Two of three repos have no `gateCommand` (G20); the item file is the only list every repo has |
| A gate that cannot run here | Recorded as skipped, listed under **Not verified**, does not block the landing | The auditor accepted the same skip; CI runs it on the pushed base. Loud, not silent |
| Conflict at the land step | Resolved by the builder in a file the row owns; any other file holds the row | A conflict outside the row's list is the undeclared overlap of 2026-10-03 (DESIGN G31) |
| Push | After each landing; a refused push stops pushing for the run and the rundown says how far ahead the base is | A run that dies mid-way has landed and pushed what it finished |
| Deep rows | Opening round offers "all, including rows written during the run", "named rows", "none" | G11: a row written mid-run cannot be named at the start |
| Decider questions per row | 3, then the row is held | A row that keeps asking was scoped wrong, as D7 says of fix rounds |
| Decider tiers | Caught at once: the lead. Looks right until tested: Default. Silent in production: Deep | The tier table's own three tests |
| Audit dial | By tier with triggers (3.4 A); the alternative is every row | Section 3.4 |
| Audit trigger: diffstat | More than 300 lines changed, or more than 8 files | A Mechanical row above that size is a sweep that should have been several rows |
| Cross-repository wait | Read on every wake; a run with only such waits holds on the holding wake | G33 clamps the wait to an hour |
| Five-hour share with several runs | Default share divided by the number of runs the owner says are open | Three runs read one window |
| Lander budget fallback | A builder that relays instead of landing is replaced by option 3.1 B for that row | The relay contract fires at two thirds of budget |
| End-of-run commit message | `autopilot run <date>` | Short, lowercase, the repo's style |

## 5. Hazards this work walks into

- **A landing is a push.** Under every other policy a wrong merge sat in a worktree until the
  owner looked. Under this mode it is on the remote before anyone looks. Every option in 3.1
  re-runs the gates on the landed tree for that reason, and nothing here force-pushes or rebases.
- **Two green rows can be wrong together.** The collision check keeps owned files disjoint, so a
  merge is usually clean; a semantic clash between two rows that touch different files passes the
  gates. No audit here sees the merged tree. The owner accepted the same risk on 2026-10-03.
- **`git -C` into an agent's worktree is unverified for the lead** (G25). Option 3.1 A avoids it;
  the worktree step (G5) already relies on `git -C <worktree> status`, and the runtime pass must
  record whether that call is refused.
- **The primary checkout is the owner's.** A fast-forward there is refused when it would overwrite
  a dirty tracked file, and the row holds. In personal-config the ledger, the board and the item
  files are untracked (G32), so they never block; a tracked board elsewhere would.
- **A worktree's gates lie.** `doctor` in a worktree cannot see untracked records, and Linux-only
  failures appear only on CI (`CLAUDE.md`, "Gates that lie"). The landed base can be red on CI
  while every local gate was green.
- **The remote can move.** The owner pushes from elsewhere; the run's push is refused as non-fast-
  forward. The dial says: stop pushing, keep landing locally, report. Never `--force`.
- **A decision that compiles.** Section 3.2's deciders exist for this, and the Deep tier takes the
  silent class. A reversal is only a reversal if someone reads the rundown.
- **Two agents agreeing is not an owner.** A Default scoper's recommendation taken by a Deep decider
  (3.3 A) is still agents. The item file's words are the only guard, and `/passoff`'s template
  should offer the "owner's call" line so it is easy to write.
- **The merge commits name agent branches.** `Merge branch 'main' into worktree-agent-a02d...` on
  the base, every time the base moved. Cosmetic, and the alternative rewrites audited commits.
- **D19 and D24 are superseded under one policy.** The design must carry a dated pointer, and
  `docs/choices/commit-policy.md` must say what `agent-pushes` now means for a run, or the long form
  and the skill disagree.
- **The tests pin the `2eff50c` words** (G15). Each new sentence needs its violating and passing case, and
  the `agent-pushes` loops that at `2eff50c` check only for unfilled tokens must check the land step is
  present there and absent under the other three.
- **`wk` has no rows** (G30). A run started there at 2026-10-16 ends at once. The owner defines the MVP
  as rows before any chain through `wk` means anything.
- **Three sessions, one usage window** (3.5 A). Each run's share must be divided, or the three
  together freeze each other at 25% apiece.
- **The run commits in the owner's checkout** (3.7 A). Named files keep a parallel session's edits
  out of the commit; they stay in the working tree for the owner to find.
- **Deleting a ban without its replacement.** If "Never push and never merge." leaves the builder
  brief before the land step exists, parallel builders merge on their own, each from its own base,
  with no gate on the landed tree. The sweep in section 2 and the land step in 3.1 ship in one
  change, and the test that pins the grep empty lives beside the test that pins the land step
  present.
- **The owner's own adapted files are outside this scope.** The adapted standards, memories,
  `/land-worktrees` and `/notes-to-board` carry the same reservations and are handled in another
  session (the starting session, 2026-10-16). This build edits none of them.

## 6. Open questions

Asked in chat on 2026-10-16, in one batch. The recommended answer is first in each part.

1. **The land step:** A, the builder merges the base and gates in its worktree, the lead
   fast-forwards and pushes after each row; or B, the lead merges in the primary checkout and gates
   a clean export; or C, land once at the end.
2. **The decider:** A, by severity with the item's own words binding, copy included; or B, build
   questions only, copy and product questions hold; or C, hold everything as at `2eff50c`.
3. **Scope-first rows:** A, a scoper writes the document and a Deep decider answers the gate under
   the same rules; or B, scope and hold at the gate; or C, leave them out.
4. **The audit dial:** A, by tier with escalation triggers; or B, every row as at `2eff50c`.
5. **Across repositories:** A, one session per repository with cross-repository "Waits on"; or
   B, chain sessions at the end of a run (unverified, G35); or C, one session above the repositories
   (not a mode, 3.5 C).
6. **The switch:** A, the land step under `agent-pushes` and the rest in the opening round; or B,
   a new `autonomy` question with a long form.
7. **End of run:** A, the run commits and pushes the run folder and the fold's moves, naming the
   files; or B, print the blocks.
8. **The rule line** (added 2026-10-16 after the owner's statement, G38): A, "Claude may run any
   git command, including `git add`, `git commit`, `git merge` and `git push`."; or B, "Claude
   runs git itself: add, commit, merge, rebase, push, and the rest."; or C, "Git is Claude's to
   run, in full. Nothing here reserves a git command for the owner."

## 7. Answers

Answered by the owner in chat on 2026-10-16, in two `AskUserQuestion` calls (four questions, then
three). Every part took the recommendation.

1. **The land step:** A. The builder merges the base into its branch from its own worktree,
   resolves a conflict only in a file its row owns, and re-runs the gates there. The lead
   fast-forwards the primary checkout, pushes, and removes the row's worktrees. After each row.
2. **The decider:** A. Questions are sorted by what a wrong answer does: caught at once, the lead
   decides; looks right until tested, a Default subagent; silent in production, a Deep subagent.
   Copy is included. A question the item file calls the owner's, or one that widens "Files it
   owns" into another open row's file, holds the row. Every decision is logged with its reversal
   and the decider's model.
3. **Scope-first rows:** A. A Default scoper writes the scope document in its worktree; a Deep
   decider answers the gate by each recommendation unless it finds a reason not to, written into
   the document with a reversal. A question the item file calls the owner's holds the row with the
   document written.
4. **The audit dial:** A. Deep and Default rows are audited as at `2eff50c`; Mechanical and Light
   rows land on their gates unless a trigger fires (a file outside the row's list, a fix round or a
   relay, a claimed number, a diffstat over the dial, or a load-bearing mark from the decider).
5. **Across repositories:** A. One `/autopilot` session per repository, opening rounds answered
   together; a "Waits on" cell may name another repository's item by absolute path, read on every
   wake; a run with only such waits holds on the holding wake.
6. **The switch:** A. The land step renders only under `commitPolicy: agent-pushes`, through a new
   `agentPushes()` seam beside `agentCommits()`. The decider, the scope-first rule, the audit dial
   and the cross-repository wait are opening-round questions with recommended defaults. No new
   config question.
7. **End of run:** A. The run commits and pushes the run folder and the fold's moves from the
   primary checkout, naming the exact files, with the message `autopilot run <date>`.
8. **The rule line:** A, asked and answered 2026-10-16 after the owner's statement (G38) reached
   this session: "Claude may run any git command, including `git add`, `git commit`, `git merge`
   and `git push`." It replaces the three-verb line in every place section 3.8 names, and the
   build sweeps every sentence G40 lists.

Still open for the design step: the exact opening-round wording for the new questions (the plain
register, D16); whether `/passoff`'s item template gains an "owner's call" line (hazards, section
5); the supersession pointers for D19 and D24 in `docs/incomplete/delegate-autopilot/DESIGN.md`;
and the `docs/choices/commit-policy.md` and `docs/choices/skills.md` paragraphs that say what
`agent-pushes` now means for a run.
