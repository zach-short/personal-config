---
name: autopilot
description: Run the board unattended: each open row goes to its model in a worktree, is reviewed, and is reported back. Stops when the board is done or the budget you set is spent.
disable-model-invocation: true
---

# /autopilot

**Run only when the person typed `/autopilot` in this session.** If you loaded this skill on your
own, stop here and say so.

Runs every runnable row on the board (`{{BOARD_FILE}}`) through `/delegate`, several at once,
with nobody at the keyboard: one round of questions at the start, then builds, reviews and records
until the board is done or a cap is reached, then a rundown. Every row still gets its model, its
own worktree and an auditor. Only this session writes the board and the ledger
(`{{LEDGER_FILE}}`). Where the repo has a lane file, the person can choose to run `/audit` first:
its rows join the board, and the run builds the ones it can.

## The defaults

The opening round offers these, each one first and marked recommended, except where question 2
puts more first. The rows under more are that answer's values. They are written here once, and
the rest of this skill names them.

| Default | Value |
|---|---|
| Weekly usage, where a usage tool exists | Spend at most 25 points of the weekly window |
| Five-hour window, where a usage tool exists | Freeze launches at 75% of it, and resume after its reset |
| Agents in flight | 6, of which at most 4 are builders |
| Agents in flight under more | 1 for each whole GB of memory free at launch, at most 10 and never fewer than the default; 7 in 10 of them builders, rounded down |
| Heavy-build cap under more | 2 at once |
| Split | 2 to 4 sub-rows that build at once, plus 1 integration sub-row that runs last |
| End time | 8 hours after the start |
| Rows | No cap |
| Fix rounds per row | 2, then the row is held |
| Wake while holding | 3600 seconds |
| Wake while agents run | 1800 seconds |
| This session's context | No cap, recorded on every wake |
| Calls of row questions in the opening round | 3, so at most 12 row questions |
{{EXTRA_DEFAULTS}}

## 1. Before anything

1. **Run in the primary checkout.** If `git rev-parse --show-toplevel` is not the first path `git
   worktree list` prints, stop and say so: the board and the ledger are written there.
2. **Note which tools this session has**: a timer (`ScheduleWakeup`) and a usage tool (in the
   desktop app, `get_usage`). Both answers go into the state file, and both change the opening
   round.
3. **Load `/delegate` once, with the Skill tool.** Its steps run every row. Do not load it again
   for each row; load it again only when a compaction has taken it out of your context.
4. **Look for the lane file**, `docs/audit-lanes.md`. Where it exists, load `/audit` once, with the
   Skill tool, and read the lane file: the audit call offers its lanes and `/audit`'s defaults.
   Where it does not exist, ask no audit call, and run the board only.
5. **Read the time from `date`.** It is the run's start time under **Run**, and the time of the
   `/autopilot` message, the first line under **Owner** (section 4).

## 2. Which rows can run

A row is runnable when all of these hold:

- It is `OPEN`, and every row before it in its lane is finished (`COMMITTED`, `SUPERSEDED` or
  `SETTLED AS NO`), because the items in a lane run in order. A `HELD`, `IN FLIGHT` or `DONE` row
  ahead of it holds it back.
- Every item its "Waits on" names is `COMMITTED`, or has left the table at a fold.
{{CROSS_BOARD}}
{{AFTER_UNCOMMITTED}}
{{SCOPE_FIRST}}
- Its "Files it owns" overlaps no row marked `IN FLIGHT`, and no other row in the same launch.
  Check the whole launch set at once, as `/delegate`'s step 5 does; of two rows that overlap, the
  lower row number goes.
- Its tier maps to a model family, and it sits at or below the repo's tier ceiling, where the
  router has one. A row above the ceiling is held, and the opening round cannot lift it. So is a
  load-bearing row whose Deep review the ceiling forbids.
- It is not Deep, or the person lifted it in the opening round. Only the person lifts a Deep row.
- Its owner questions are answered.

When the caps allow fewer launches than there are runnable rows, the lowest row number goes first.

## 3. The opening round

At most four questions in each `AskUserQuestion` call. The questions, their options and their
defaults are fixed below. The words are yours, inside the person's chat-style rule where they
chose one. Put the default first in each question and mark it recommended. Read the time from
`date` before each call and again when it returns. The person's answers to one call are one owner
message, and both times go with it under **Owner** (section 4).

**Audit call, before the first call, only where the lane file exists. Four questions.** The
defaults are `/audit`'s.

1. **Audit first?** Yes: run `/audit`'s lanes, then the board; or no, the board only.
2. **Lanes and order.** The lanes the lane file names, in its order; the person may drop lanes or
   type another order.
3. **Scope.** The full repo, or the changes since the last audit report's commit.
4. **Stop.** Stop launching at `/audit`'s default stop; or a later time the person types. This
   answer is the run's end time, whatever question 1 says. Write it as an absolute time with its
   zone, worked out from `date`.

**First call, always. Four questions.**

1. **Budget.** Where a usage tool exists: stop launching at the default end time or at the
   default share of the weekly window, whichever comes first, and freeze launches at the default
   share of the five-hour window; or a shorter run; or a number of rows the person types. Where no
   usage tool exists, say that the budget will not be measured, and require an end time or a
   number of rows. Where the audit call ran, its stop is the end time: offer no other end time
   here.{{SHARED_WINDOW}}
2. **Agents in flight.** The default; more; fewer; or one at a time. Before you ask, read the
   memory free now (on macOS, `memory_pressure` prints the free percentage and `sysctl -n
   hw.memsize` the total; on Linux, `MemAvailable` in `/proc/meminfo`), and show the agents and
   builders the default under more gives with it. Name the repo's heavy builds too: its gate
   commands that build the whole app or compile native code, as `pgrep` patterns, which go under
   **Caps** with the heavy-build cap. Where the person's words before the round ask for speed, or
   for the window spent before its reset, put more first and mark it recommended instead. Under
   every answer but one at a time, rows split before they launch (section 5), unless the person's
   answer says to run them whole.
3. **Unattended.** Say what the run needs: a permission mode that does not stop on a prompt, and
   the app or the terminal left open on a machine that stays awake. Where no timer exists, say that
   the run ends when nothing is in flight, and that it cannot wait out a usage freeze. Say that the
   run ends with `/clean-up`, which moves finished work to the archive without asking again.
   Options: ready, or stop here.
4. **Models.** Each tier's name and the family you will pass for it:

   {{TIER_TABLE}}

   Options: correct, or the person types the mapping. A tier that still maps to no family holds
   its rows.

**Second call, only when it has something to ask. Up to three questions.**

5. **Deep rows.** Which Deep rows to lift{{DEEP_ROWS_OPTIONS}}
6. **Load-bearing rows.** Which other runnable rows get a Deep review. None is the default.
7. **Rows to leave out** of this run. None is the default.
{{AUTONOMY_CALL}}

**Later calls.** Each candidate row's open "Ask before building" questions, as the row wrote them,
with the row's own options, four in each call, up to the default number of calls. A copy question
shows its variants, and the person picks. A row whose questions were not reached is held.

After the round, ask nothing more. Write the answers into the state file, dated, word for word.

## 4. The run folder and the state file

Make `docs/incomplete/autopilot-<YYYY-MM-DD>/`. Where a folder for that date exists, add `-2`, or
the next free number. `STATE.md` in it has these sections:

- **Run**: the start time, the folder, a sentinel phrase for `personal-config context`, and the
  timer and usage tool found.
- **Caps**: each cap, as answered.
- **Audit**: "not run", or the audit folder, and one line for each lane: the step, the agent ids,
  and whether the step is done or in progress.
- **Standing orders**: the lifted rows, the load-bearing rows, the rows left out, and the answers
  to the row questions.
- **Rows**: one line for each row: number, tier, status, agent ids, worktree path, branch, patch
  path, relay passes, review rounds, verdict.
{{STATE_EXTRAS}}
- **Queue**: the runnable rows not yet launched, in launch order.
- **Readings**: one line for each wake: the time, the usage reading or "not measured", and this
  session's context.
- **Owner**: one line for each message the owner types in this session, from the one that typed
  `/autopilot` to the end of the run, the opening round's answers among them: the absolute time
  read from `date` when it arrives, and what it asked, answered or ordered, in a few words. Where
  it answers a question this session posted, the line also holds the time the question was
  posted and the whole minutes between the two. Only what the owner types here counts: the
  `/loop` prompt, a wake from `ScheduleWakeup`, a hook's feedback, a background agent's report
  and a message from another session, even one that relays the owner's words, are not the
  owner's messages.
- **Reports**: for each row, one entry for each report, the builder's and every auditor's, headed
  with the row, the agent and the absolute time the report arrived. Each holds what the rundown needs:
  the gates seen and their result, any number claimed, the files changed and the untracked files
  added, the commit state, the close-out text where the item's file is untracked, questions and
  build-level calls, what was not verified, warnings, and the hand-back blocks. Write it when the report arrives: after a compaction the report is gone,
  and this section is all the rundown has.
- **Judgment calls**: each with its reversal.
- **Held**: each held row, and what it waits on.

Write every time as an absolute time with its zone, such as `2026-10-03 01:20 EDT`, read from
`date`. Never write a relative date word or an estimate, because `doctor` scans this folder.

## 5. Launch

Where the person chose audit first, launch no row yet: start `/audit`'s first lane (its section
4) instead. The rows launch only after `/audit` has written its rows (its section 5), from a fresh
read of the board.

Otherwise, split each runnable row as the next three paragraphs say, then claim each runnable row,
then run `/delegate`'s step 2 for each, up to the agents-in-flight cap, with the Agent calls in
one message.

**Split a row before it launches**, into the default split: sub-rows whose "Files it owns" cells
share no path, each built and tested on its own, and one integration sub-row that owns the shared
wiring, such as an entry point, a registry, an index or the README, and runs last. Together the
cells hold every path the row's cell held, and none twice. Plan it from the row's item file and
its cell, not from the source. The row runs whole when its files do not split that way (one file,
or files that each need the others to build), and also when it is Deep, when its prompt says to
build it whole, when it is a sub-row already, when its launch is a scoping run, a relay pass or a
fix round, or when the agents-in-flight answer was one at a time or said to run rows whole. A
Deep row runs whole because its failure is silent, and the seam between two builders is where it
would hide.

The integration sub-row is the row itself. It keeps its number, its lane, its tier and its item
file; its "Files it owns" narrows to the shared wiring, and its "Waits on" names each other
sub-row, so section 2 runs it last. Each other sub-row is a new row, written in the same edit as
its own item file, `{{ITEMS_DIR}}/<n>-<slug>.md`. Take its number from `personal-config passoff
next`, run again before each one. Give it the row's tier and "Waits on", and a lane no open row
uses, because a lane runs its rows in order. Its file opens with `# <n>. <Title>`, then a dated line
naming the row it splits, then a standalone prompt: the part of the row's prompt it builds, the
answers the row's questions got, and the names it exposes for the integration sub-row to wire.
The slug is the title in lower case, each run of other characters one hyphen, cut at a hyphen to
at most 48 characters. On a 1.x board, with no `{{ITEMS_DIR}}/` folder, read the next free number
from the board file, and the prompt is a `### <n>.` section below the table.

Add a dated note to the row's item file with its sub-rows, its cell before the split and the
commit the base was at, and write the split under **Judgment calls** with its reversal: restore
the cell from the note, and mark the sub-rows not yet launched `SUPERSEDED`. The row's line under
**Rows** names its sub-rows. Against a cap on rows, a row and its sub-rows count as one. Where the
integration sub-row is audited, its auditor reads the whole row, `git diff <that commit> <its tip>
-- <the paths of the row's cell before the split>`, against the row's prompt, and a load-bearing
row's Deep review is that audit.{{SPLIT_JOIN}}
{{SCOPE_RUN}}

Write `STATE.md`. Then start `/loop` with no interval and this prompt: "Read `<the run
folder>/STATE.md` first. If `/autopilot`, `/delegate` or, while the audit runs, `/audit` is no
longer in your context, load it again with the Skill tool. Then follow `/autopilot`'s wake
procedure."

## 6. The wake procedure

When the owner types a message in this session, during a wake or between two, read the time from
`date` at once, and write its line under **Owner** (section 4) before you act on it.

On every wake, and whenever a background agent returns:

1. **Read `STATE.md` first.** It is the record of the run, not your memory of it. After an
   automatic compaction, it is all you have.
2. **Record a reading**: the time from `date`, the usage figure or "not measured", and this session's context
   from `personal-config context --sentinel "<the sentinel>"`.
3. **Handle each returned row agent (a builder, a relayed pass or an auditor), one at a time, in
   this order.** First, read the time from `date`. Then bring its row's line under **Rows** up to date: the status, the worktree path, the
   branch, the patch path, the relay passes, the review rounds and the verdict, so no field still
   reads `pending` once the report answers it. Then write its **Reports** entry with that time,
   the hand-back blocks among it, not into the chat. Only then route it by `/delegate`'s steps: a
   builder's report to an auditor, a relay to a fresh builder, a verdict to sign-off, a fix round
   or a hold. Record each sign-off as `/delegate`'s step 4 says: the item's close-out, a log line
   and the board. Route each returned audit agent by `/audit`'s
   sections 4 to 6, and record its step under **Audit**; its next step launches in step 6, never
   here. When `/audit` has written its rows, read the board again before step 6.{{LAND_ROUTE}}
{{QUESTION_RULE}}
5. **Where the five-hour window has reached its default share**, freeze launches and hold on the
   holding wake. After its reset, resume the stopped agents with `SendMessage`.
6. **Launch.** Unless a cap is reached or launches are frozen, read the board fresh and launch the
   next runnable rows, each split as section 5 says, up to the agents-in-flight cap. Check the end
   time against `date` and the caps against this wake's reading here, before any launch: the last
   check may be a wake old.
   While the audit runs, launch its next step instead, and no row.
7. **Check the stop rules** (section 7). If the run ends, go to section 8.
8. **Schedule the next wake** with `ScheduleWakeup`: the wake while agents run, or the wake while
   holding.
9. **Write `STATE.md`** before the turn ends.

## 7. Stop rules

- Read the time from `date` for every check against the end time. Never estimate it.
- The first cap reached (usage where a usage tool exists, the end time, or the number of rows)
  stops new launches.
- After a cap, in-flight work finishes and its reviews run. A blocking verdict then holds the row:
  no new fix round starts. When nothing is in flight after a cap, the run ends, whatever rows are
  still runnable.
- When nothing is in flight after this wake's launches, the run ends: no row was runnable, or
  none could launch. The one exception is a hold with a timer: a freeze, or agents a limit
  stopped, which wait on the holding wake.
{{CROSS_BOARD_HOLD}}
- Where no usage tool exists and a limit stops the agents, hold on the holding wake, then resume
  them with `SendMessage`. Where no timer exists either, end the run there: nothing will wake this
  session. The stopped agents' rows go under **Held**. A stopped audit step is written in the
  report as not finished, and `/audit`'s section 5 runs before the run ends.
- **While the audit runs**, check the caps before each step of a lane starts, as `/audit`'s
  section 6 says. A cap reached there launches no row: the audit's started steps
  finish, `/audit` writes its report and its rows, and the run ends when nothing is in flight.
  The freeze, and the hold and resume above, apply to audit agents as they do to builders.
- **A run that crosses the weekly window's reset** counts its spend across it. A weekly reading
  lower than the one before marks the reset. The spend is then the last reading before the reset
  minus the start reading, plus the latest reading after the reset. Never count a drop as negative
  spend.
- **This session's own context never stops the run**, unless the person set a cap for it. Record
  it on every wake. The working standard's context ceilings were measured on sessions that read
  files: the Default ceiling is about 400k, measured 2026-08-16. On 2026-10-03 an orchestrator
  that read only short reports ran to 767,008 tokens on a 1M window with no automatic compaction.
  This skill follows that evidence, and the standard does not yet say so. Keep your own reads
  short: read reports and the state file, not source.

A held row's "Waits on" names the file its reason is written in: the run's `RUNDOWN.md`, or the
file that holds the row's open findings.

## 8. The end

1. End the timer: `ScheduleWakeup` with `stop: true`, or no new wake.
2. **Run `/clean-up`**, with the Skill tool, as the run's last step before the rundown. The
   person's "ready" in the opening round is the yes its previews wait for: post each preview in
   chat and go on. On a board with a `{{ITEMS_DIR}}/` folder, its fold moves each `COMMITTED`
   item's file and its row to the archive, and a closed row with no file gets an archive file that
   holds the row. On a 1.x board, with no `{{ITEMS_DIR}}/` folder, the fold moves `COMMITTED`
   prompts and old step bodies, and every row stays. Where no `.git` sits at or above the folder,
   `DONE` is final and folds too. A move its own rules hold, such as one that waits for a
   commit, is not run: it goes under **Decisions waiting for the owner**. What moved goes in the
   rundown's first paragraph, {{FOLD_COMMIT}}
3. Write `RUNDOWN.md` in the run folder from `STATE.md`, with these sections in this order. Each is present, and
   says "none" where it is empty.
   1. **In one paragraph**: what ran, what is done, what is held, and why the run ended.
   2. **Audit**: "not run", or the report's path, each lane's last step, the findings verified,
      the findings dropped as duplicates, the rows written, and the lanes not run.
   3. **Rows**: for each row, the model, the worktree path and branch, the gates seen, the review
      verdicts, the fix rounds and the status.
   4. **Defects found and not fixed.**
   5. **Collisions and merge order**, including any number two rows both claimed.
   6. **Judgment calls**, each with its reversal.
   7. {{DECISIONS_SECTION}}
   8. **Budget**: the usage readings or "not measured", agents by model, hours, this session's
      peak context, and the owner's attention from **Owner**: the messages counted, the questions
      answered with the minutes from each question to its answer and their sum, and the message
      count and the minutes' sum each divided by the rows this run marked `DONE` or `COMMITTED`, a row and its
      sub-rows counting as one, as against a cap on rows, or "no row done". Then this sentence,
      as written: "These figures count the messages the owner typed in this session and the
      whole minutes from each question to its answer, which include any time the owner was away;
      they do not capture reading time, such as reading this rundown, a report or a diff, the
      time spent writing a message no question asked for, a message another session relayed, or
      the work the run leaves for the owner, such as the decisions waiting and any commit
      blocks."
   9. **Not verified**: what no one saw running.
   10. **Warnings**, such as a tool that deletes uncommitted worktrees.
   11. {{COMMIT_BLOCKS}}
4. Add one line at the end of the log in `{{LEDGER_FILE}}` for the run:
   `- <date> · autopilot run · <the run folder>/RUNDOWN.md`. A run is not an item, so it gets no
   item file and no row. On a 1.x board, with no `{{ITEMS_DIR}}/` folder, write the run's own
   ledger step instead, at the next free number, read from the file now, pointing at the rundown.
{{END_COMMIT}}
5. Where a push notification tool exists, send one line that names the rundown's path.
6. Post the rundown's first paragraph and its path in chat.

## 9. Standing orders

These hold for this session, and each builder's brief carries them after `/delegate`'s rules,
because a builder never sees this skill.

- This session uses `git -C <path>` and absolute paths. Never `cd`: it moves this session's
  working directory. An agent in a worktree does the opposite: it runs git as plain commands from
  its own worktree's directory, and never `git -C` on another worktree, which isolation refuses.
- A builder that needs an ignored file it cannot copy, such as an env file, stops and reports.
  Never retry a call that was denied.
- Do not start, stop or restart services outside this repo.
- Builders take no ledger number and write no log line. Every other number a row claims, such as a migration, is
  reported, and two rows that claim one number go under Collisions in the rundown.
- A builder that must touch a file its row does not list in "Files it owns" stops and reports.
  Its own item file, where `/delegate` lets it write the close-out, is the one exception.
- Under more, an agent waits before a heavy build (a pattern under **Caps**) while the heavy-build
  cap is reached: `until [ "$(pgrep -f '<pattern>' | wc -l)" -lt <the cap> ]; do sleep 15; done`.
  Write the pattern with its first letter in brackets, such as `'[n]ext build'`: another agent's
  waiting loop holds the pattern in its own command line, and the brackets keep that loop from
  counting. BSD `pgrep` on macOS has no `-c`. Each auditor's brief carries this order too.
