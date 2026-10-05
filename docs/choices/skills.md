# The workflow skills

## What this is

Up to seven skills under `~/.claude/skills/`, each a short document the agent loads when you type
its name or when the description matches what you asked for.

- **`/close-out`** — the end-of-work ritual: update the record, then post the three hand-back
  blocks (the next prompt, the runtime entries, the next model).
- **`/scope`** — open a piece of work properly: ground truth first, then a scope document whose
  job is to make your decisions cheap, then one batched question.
- **`/passoff`** — write the next session's first message so it stands alone.
- **`/handoff`** — read or append to the ledger, including the rules about step numbers.
- **`/clean-up`** — sweep finished work into the archive: decide what is actually finished, run
  `personal-config fold` and `personal-config archive` behind a preview, then repair every
  document that pointed at what moved.

- **`/delegate`**: build one item that has cleared its gate, a board row or a planned phase,
  with a builder subagent and a separate auditor subagent, each in its own git worktree on the
  model the item names, then record it and post the hand-back blocks. You stay in one session
  and paste nothing.
- **`/autopilot`**: run the whole board with nobody at the keyboard. One round of questions sets
  the budget, then every runnable row goes through `/delegate`, several at once, until the board
  is done or a cap is reached, and a rundown is written at the end. It runs only when you type it.

How many you get depends on the setup. The lighter setup gets `/close-out` and `/handoff` only.
Non-code work on the full setup gets four: `/clean-up` drives commands that need an archive
home, and only the full code setup is asked for one. `/delegate` is written only for code work on
the full setup in git, with a board or with project folders: each subagent needs a worktree of
its own, which needs git, and the auditor re-runs the gates the full standard names, which the
lighter setup and non-code work do not have. `/autopilot` is written beside it only where there
is a board, because it reads the board at every step, and project folders keep none.

## The defense

These are the parts of the working standard that are *rituals* rather than facts — the things
that only work if they happen every time. A rule buried on page 40 of a standard is read once;
a skill is invoked by name at the moment it applies. `/close-out` in particular is the one that
makes the rest hold: a repo that adopts the documents without the close-out has adopted nothing.

`/clean-up` is the one whose absence costs tokens rather than discipline. A ledger and a board
only ever grow, and both are read in full at the start of every session; the commands that trim
them already exist, but the judgment around them — is this row really finished, does that pointer
still resolve, which live document now cites a folder that has moved — is what the commands
cannot do and what gets skipped.

`/delegate` turns the hand-off between sessions into a step the session takes itself. A build
still runs on the model the item names, in a context that starts empty, and every build gets a
second agent that reproduces the change in its own worktree and re-runs the gates before the
work is recorded. It never builds a Deep item unless you typed `/delegate` on that item, and it
follows your commit policy: under "only me" its builder never commits.

`/autopilot` is for the hours you are away. The questions a row needs are asked before you leave,
and a row that would need you later is held with its reason on the board, so nothing is decided
for you overnight. Every row it builds is still built, audited and recorded by `/delegate`, and
the rundown says what ran, what was held, what the budget was and what nobody saw running. Its
skill file sets `disable-model-invocation: true`, so the agent cannot start it on its own; its
description is not even in the agent's context until you type it.

## The strongest argument against it

Several more skills in a list you already scroll past, and their descriptions compete with
skills you actually use for the same trigger words. They also duplicate content that is already
in the standard, so when you edit the standard they silently go stale — nothing checks that they
agree.

`/clean-up` carries a sharper version of that risk: it runs commands that cut text out of
documents git may not be holding a copy of. The skill makes the agent preview first and wait for
a yes, but a skill is instructions, not a guard — an agent that skips the preview gets the cut
anyway, because without a terminal the commands do not stop to ask.

`/delegate` carries the largest risk of the set, because it acts while you are not reading each
step. A builder and an auditor can agree on a wrong change, and a subagent's report is all the
session sees of its work, so a mistake neither one reports reaches your ledger as signed off.
It also adds an exception to the model-routing rule (see `model-routing.md`), and every item it
builds costs at least two agents where one session would have done.

`/autopilot` is that risk run all night. "All of them" now puts an overnight loop in the skills
list of a person who chose "all" for `/close-out`. The loop rests on the harness's `/loop` skill
and its timer, whose text this tool does not control, so a change there can break the loop with
no error: the run stops early, or never stops scheduling. The rundown's readings, one per wake,
are the only sign of a missed wake. And where your harness has no usage tool, the budget is an end
time or a row count, not a share of your plan.

## What it writes and where

`~/.claude/skills/<name>/SKILL.md`, one directory each. Existing skills of other names are not
touched. If you already have a skill by one of these names that this tool did not write, it is
left alone: the run's preview lists it as refused, because it carries no stamp, and nothing is
written over it. To take the shipped skill in its place, move your own folder out of
`~/.claude/skills/` and run `setup` again. A skill you keep in `~/.claude/skills/` wins over one
of the same name in a project's `.claude/skills/`, so a copy left in place there is the one that
runs.

Where `/delegate` is written, `~/.claude/rules/model-routing.md` gains one sentence, described in
that question's long form.

`/autopilot` writes nothing at setup beyond its skill file. When it runs, it makes
`docs/incomplete/autopilot-<date>/` in the repo, holding `STATE.md`, written on every wake, and
`RUNDOWN.md`, written at the end, and it writes one ledger step per row it signs off and one for
the run. The builders' work stays in their worktrees; landing it is yours.

## How to undo it

Delete the skill directories, or run `personal-config undo` to restore anything overwritten. A
run's folder under `docs/incomplete/` is an ordinary folder: archive it with `personal-config
archive` or delete it.
