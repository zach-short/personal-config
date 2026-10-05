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
(`{{LEDGER_FILE}}`).

## The defaults

The opening round offers these, each one first and marked recommended. They are written here once,
and the rest of this skill names them.

| Default | Value |
|---|---|
| Weekly usage, where a usage tool exists | Spend at most 25 points of the weekly window |
| Five-hour window, where a usage tool exists | Freeze launches at 75% of it, and resume after its reset |
| Agents in flight | 6, of which at most 4 are builders |
| End time | 8 hours after the start |
| Rows | No cap |
| Fix rounds per row | 2, then the row is held |
| Wake while holding | 3600 seconds |
| Wake while agents run | 1800 seconds |
| This session's context | No cap, recorded on every wake |
| Calls of row questions in the opening round | 3, so at most 12 row questions |

## 1. Before anything

1. **Run in the primary checkout.** If `git rev-parse --show-toplevel` is not the first path `git
   worktree list` prints, stop and say so: the board and the ledger are written there.
2. **Note which tools this session has**: a timer (`ScheduleWakeup`) and a usage tool (in the
   desktop app, `get_usage`). Both answers go into the state file, and both change the opening
   round.
3. **Load `/delegate` once, with the Skill tool.** Its steps run every row. Do not load it again
   for each row; load it again only when a compaction has taken it out of your context.

## 2. Which rows can run

A row is runnable when all of these hold:

- It is `OPEN`, and every row before it in its lane is finished (`DONE`, `SUPERSEDED` or
  `SETTLED AS NO`), because the items in a lane run in order. A `HELD` or `IN FLIGHT` row ahead of
  it holds it back.
- Every item its "Waits on" names is `DONE`.
{{AFTER_UNCOMMITTED}}
- Its prompt does not say to scope first.
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
chose one. Put the default first in each question and mark it recommended.

**First call, always. Four questions.**

1. **Budget.** Where a usage tool exists: stop launching at the default end time or at the
   default share of the weekly window, whichever comes first, and freeze launches at the default
   share of the five-hour window; or a shorter run; or a number of rows the person types. Where no
   usage tool exists, say that the budget will not be measured, and require an end time or a
   number of rows.
2. **Agents in flight.** The default; fewer; or one at a time.
3. **Unattended.** Say what the run needs: a permission mode that does not stop on a prompt, and
   the app or the terminal left open on a machine that stays awake. Where no timer exists, say that
   the run ends when nothing is in flight, and that it cannot wait out a usage freeze. Options:
   ready, or stop here.
4. **Models.** Each tier's name and the family you will pass for it:

   {{TIER_TABLE}}

   Options: correct, or the person types the mapping. A tier that still maps to no family holds
   its rows.

**Second call, only when it has something to ask. Up to three questions.**

5. **Deep rows.** Which Deep rows to lift. Several may be chosen; none is the default.
6. **Load-bearing rows.** Which other runnable rows get a Deep review. None is the default.
7. **Rows to leave out** of this run. None is the default.

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
- **Standing orders**: the lifted rows, the load-bearing rows, the rows left out, and the answers
  to the row questions.
- **Rows**: one line for each row: number, tier, status, agent ids, worktree path, branch, relay
  passes, review rounds, verdict.
- **Queue**: the runnable rows not yet launched, in launch order.
- **Readings**: one line for each wake: the time, the usage reading or "not measured", and this
  session's context.
- **Reports**: for each row, what its builder and its auditor reported that the rundown needs:
  the gates seen and their result, any number claimed, the files changed and the untracked files
  added, the commit state, questions and build-level calls, what was not verified, warnings, and
  the hand-back blocks. Write it when the report arrives: after a compaction the report is gone,
  and this section is all the rundown has.
- **Judgment calls**: each with its reversal.
- **Held**: each held row, and what it waits on.

Write every time as an absolute time with its zone, such as `2026-10-03 01:20 EDT`, and never a
relative date word, because `doctor` scans this folder.

## 5. Launch

Claim each runnable row, then run `/delegate`'s step 2 for each, up to the agents-in-flight cap,
with the Agent calls in one message. Write `STATE.md`. Then start `/loop` with no interval and
this prompt: "Read `<the run folder>/STATE.md` first. If `/autopilot` or `/delegate` is no
longer in your context, load it again with the Skill tool. Then follow `/autopilot`'s wake
procedure."

## 6. The wake procedure

On every wake, and whenever a background agent returns:

1. **Read `STATE.md` first.** It is the record of the run, not your memory of it. After an
   automatic compaction, it is all you have.
2. **Record a reading**: the time, the usage figure or "not measured", and this session's context
   from `personal-config context --sentinel "<the sentinel>"`.
3. **Route each returned agent by `/delegate`'s steps**: a builder's report to an auditor, a relay
   to a fresh builder, a verdict to sign-off, a fix round or a hold. Record each sign-off on the
   board and in the ledger. Write what the rundown needs into **Reports** in `STATE.md`, the
   hand-back blocks among it, not into the chat.
4. **A question a builder reports for the owner** is answered here, never by asking. Where it only
   implements a decision the row or the design already made, take it, and log it under
   **Judgment calls** with a one-line reversal. Anything else holds the row, with the question
   under **Held**, even when the builder finished.
5. **Where the five-hour window has reached its default share**, freeze launches and hold on the
   holding wake. After its reset, resume the stopped agents with `SendMessage`.
6. **Launch.** Unless a cap is reached or launches are frozen, read the board fresh and launch the
   next runnable rows, up to the agents-in-flight cap.
7. **Check the stop rules** (section 7). If the run ends, go to section 8.
8. **Schedule the next wake** with `ScheduleWakeup`: the wake while agents run, or the wake while
   holding.
9. **Write `STATE.md`** before the turn ends.

## 7. Stop rules

- The first cap reached (usage where a usage tool exists, the end time, or the number of rows)
  stops new launches.
- After a cap, in-flight work finishes and its reviews run. A blocking verdict then holds the row:
  no new fix round starts. When nothing is in flight after a cap, the run ends, whatever rows are
  still runnable.
- When nothing is in flight after this wake's launches, the run ends: no row was runnable, or
  none could launch. The one exception is a hold with a timer: a freeze, or agents a limit
  stopped, which wait on the holding wake.
- Where no usage tool exists and a limit stops the agents, hold on the holding wake, then resume
  them with `SendMessage`. Where no timer exists either, end the run there: nothing will wake this
  session. The stopped agents' rows go under **Held**.
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
2. Write `RUNDOWN.md` in the run folder from `STATE.md`, with these sections in this order. Each is present, and
   says "none" where it is empty.
   1. **In one paragraph**: what ran, what is done, what is held, and why the run ended.
   2. **Rows**: for each row, the model, the worktree path and branch, the gates seen, the review
      verdicts, the fix rounds and the status.
   3. **Defects found and not fixed.**
   4. **Collisions and merge order**, including any number two rows both claimed.
   5. **Judgment calls**, each with its reversal.
   6. **Decisions waiting for the owner**, copy variants among them.
   7. **Budget**: the usage readings or "not measured", agents by model, hours, and this session's
      peak context.
   8. **Not verified**: what no one saw running.
   9. **Warnings**, such as a tool that deletes uncommitted worktrees.
   10. **Commit blocks**: {{COMMIT_BLOCKS}}
3. Write the run's own ledger step at the next free number, read from the file now. It points at
   the rundown.
4. Where a push notification tool exists, send one line that names the rundown's path.
5. Post the rundown's first paragraph and its path in chat.

## 9. Standing orders

These hold for this session, and each builder's brief carries them after `/delegate`'s rules,
because a builder never sees this skill.

- Use `git -C <path>` and absolute paths. Never `cd`: it moves this session's working directory.
- A builder that needs an ignored file it cannot copy, such as an env file, stops and reports.
  Never retry a call that was denied.
- Do not start, stop or restart services outside this repo.
- Builders take no ledger number. Every other number a row claims, such as a migration, is
  reported, and two rows that claim one number go under Collisions in the rundown.
- A builder that must touch a file its row does not list in "Files it owns" stops and reports.
