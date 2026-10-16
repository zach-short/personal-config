---
name: audit
description: Audit the repo in the lanes its lane file names, verify each finding, write a dated report and board rows. Use only when the person types /audit, or when /autopilot loads it after the person chose audit first.
---

# /audit

**Run only when the person typed `/audit` in this session, or when `/autopilot` loaded this skill
after the person typed `/autopilot`.** If you loaded this skill for any other reason, stop here and
say so. Under `/autopilot`, the lanes run only where the person chose "audit first".

Audits the repo one lane at a time, in the lanes the repo's lane file (`docs/audit-lanes.md`)
names. Each lane sweeps, triages, drops what an earlier audit already found, and verifies what is
left. The result is a dated report and board rows (`{{BOARD_FILE}}`) with a tier, "Files it
owns" and "Waits on". This skill builds nothing. Under `/autopilot`, the board loop builds the
rows it can, after the audit.

## The defaults

The questions offer these, each one first and marked recommended. They are written here once,
and the rest of this skill and `/autopilot` name them.

| Default | Value |
|---|---|
| Lanes | Every lane the lane file names, in its order |
| Scope | The full repo on the first audit; after that, the changes since the commit the last report names |
| Stop | The reset time the lane file names, as the next absolute time it falls on |
| Findings per lane before verify | No cap |
| Verify pass | On, for every lane |
| Audit agents in flight | 4 |

## The tiers

{{TIER_TABLE}}

Pass the Agent tool's `model` parameter the family each tier maps to. Under `/autopilot`, use the
mapping its opening round confirmed. A tier that maps to no family stops its lane, and the report
says so.

Each lane runs its steps on these tiers:

| Lane | Sweep | Triage and verify | Review of each verified finding |
|---|---|---|---|
| Parity | Mechanical | Default | none |
| Security | Mechanical | Default | Deep, one agent per finding |
| Dead code | Mechanical | Default | none |
| Tech debt | Mechanical | Mechanical | none |

A lane the lane file names and this table does not runs on the Default tier, with no review.

## 1. The lane file

`docs/audit-lanes.md`, in the repo. Where it does not exist, stop and say so: this skill names no
repo, so it has nothing to run. The lane file has:

- **One section for each lane**, in the order to run them: the commands to run, what to compare,
  and the known false positives.
- **Dedupe**: the files and folders that hold earlier findings. Every earlier
  `docs/incomplete/audit-*/REPORT.md` is a dedupe source too, whether the lane file names it or
  not.
- **Reset time**: the weekday and local time the usage window resets.

Read it in full before the first question.

## 2. The questions

Under `/autopilot`, its audit call asked them. Do not ask again.

Typed alone, ask in one `AskUserQuestion` call, with the default first and marked recommended:

1. **Lanes and order.** The person may drop lanes or type another order.
2. **Scope.** The full repo, or the changes since the last report's commit.
3. **Stop.** Stop launching at the default stop; or a later time the person types.

Write the stop as an absolute time with its zone, worked out from `date`. After the round, ask
nothing more.

## 3. The run folder

Make `docs/incomplete/audit-<YYYY-MM-DD>/`. Where a folder for that date exists, add `-2`, or the
next free number. Raw tool output goes in `raw/<lane>/`, the report in `REPORT.md`. Under
`/autopilot`, the **Audit** section of its `STATE.md` records the lane, the step, the agent ids,
and whether each step is done or in progress. Typed alone, keep the same lines in `STATE.md` in
the audit folder.

## 4. Each lane

The lanes run one at a time, in the order answered. Every agent gets `isolation: "worktree"` and
an explicit `model`, never this session's own. A subagent in a shared worktree edits source even
when it is told only to review. Each brief says: do not edit the board or the ledger, do not
commit, and never retry a call that was denied.

Check the stop rules (section 6) before each step of a lane starts: the sweep, the triage, the
verify pass and the review.

1. **Sweep.** One agent, on the lane's sweep tier, brings its worktree to the base branch with
   `git merge --ff-only <base>` and runs the lane file's commands there. Under "changes since",
   it limits each command to the files changed since that commit, where the command allows it. A
   tool the repo does not install runs in the worktree and is never added to a manifest. It
   copies the raw output into `raw/<lane>/` and reports any command that could not run, with the
   reason.
2. **Triage.** One agent, on the lane's triage tier, reads the raw output and the code it points
   at, and writes candidate findings. Each finding has `file:line` evidence, a severity and the
   files a fix would touch. It drops the lane file's known false positives, and says which.
3. **Dedupe.** The same agent drops each finding that a dedupe source already holds, and names
   the source and the entry it matched.
4. **Verify.** A second agent, on the lane's verify tier, tries to disprove each finding. A
   finding survives only with evidence the verifier opened itself. Up to the default number of
   audit agents may verify at once, each with a share of the findings.
5. **Review.** Where the lane has a review tier: one agent per verified finding, given the
   finding and its cited lines only. It confirms the finding, corrects it, or rejects it.

An agent that a usage limit stopped before it reported has not finished its step. Resume it with
`SendMessage`, or run the step again. Never count the step done from a partial report.

## 5. The report and the rows

When the last lane ends, or the stop rules end the audit:

1. **Write `REPORT.md`**: the commit audited, the scope, the stop time, and for each lane the step
   it reached, its verified findings with evidence, what it dropped as a duplicate or a known
   false positive, and what no agent could run or check. A finding that was not verified is
   listed as not verified, and gets no row.
2. **Write the rows yourself.** Only this session writes the board. Each row is a table line
   (`# | Task | Status | Model | Lane | Waits on | Files it owns`) and its own item file,
   `{{ITEMS_DIR}}/<n>-<slug>.md`, written in the same edit. The file opens with `# <n>. <Title>`,
   then the dated line saying why it exists, which cites the report, then a standalone prompt.
   Take each number from `personal-config passoff next` at the moment you write, never from
   memory, and run it again before the next row. It reads the table, the folder and the archive,
   so a number is never reused, even after its row has left the table. The slug is the title in
   lower case, each run of other characters one hyphen, cut at a hyphen to at most 48
   characters. On a 1.x board, with no `{{ITEMS_DIR}}/` folder beside it, read the next free row
   number from the board file at the moment you write, and the prompt is a `### <n>.` section
   below the table.
   - A security fix row is Deep. It is never built in this run: the Deep lift question came
     before the row existed.
   - A dead-code delete row is Default. It names each file to delete and the evidence that nothing
     imports it.
   - A finding that needs an owner decision is a `HELD` row, with the question written in it.
   - Any other row takes the tier of the lane's verify step, and is `OPEN`.
3. **Under `/autopilot`**, go back to its procedure: it reads the board again and launches. Typed
   alone, post the report's path and the rows written, and stop. Nothing is built.

## 6. Stop rules

- Read the time from `date` for every check. Never estimate it.
- Before each step of a lane starts (the sweep, the triage, the verify pass and the review),
  check the stop time. Under `/autopilot`, check all of its caps (its section 7) too.
- A cap reached starts no new step: no sweep, no triage, no verify pass and no review. Steps
  already started finish. Then section 5 runs on what was verified, and a step that did not start
  is written in the report as not run.
- Where a usage limit stops agents, `/autopilot`'s hold and resume rule applies to audit agents
  as it does to builders. Where no timer exists, the audit ends there: the stopped agents' steps
  are written in the report as not finished, and section 5 runs on what was verified.
