# The workflow skills

## What this is

Up to eight skills, each a short document the agent loads when you type its name or when the
description matches what you asked for. `/close-out` and `/handoff` are written into each folder
`setup` configures, at `<folder>/.claude/skills/`, because their text depends on that folder's
track, ledger and board names. The other six are written to `~/.claude/skills/`.

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
  and paste nothing. Its last step removes each worktree the run made whose branch the base
  already holds and whose tree is clean; `/close-out` does the same for the worktrees its
  session made.
- **`/autopilot`**: run the whole board with nobody at the keyboard. One round of questions sets
  the budget, then every runnable row goes through `/delegate`, several at once, until the board
  is done or a cap is reached, and a rundown is written at the end. It runs only when you type it.
- **`/audit`**: audit the repo in the lanes a file in the repo names (`docs/audit-lanes.md`),
  verify each finding with a second agent, drop what an earlier audit already found, and write a
  dated report and board rows. It builds nothing. `/autopilot` offers it as "audit first" in its
  opening round, so one command audits and then builds; you can also type `/audit` alone.

How many you get depends on the setup. The lighter setup gets `/close-out` and `/handoff` only,
so it writes nothing to `~/.claude/skills/`.
Non-code work on the full setup gets four: `/clean-up` drives commands that need an archive
home, and only the full code setup is asked for one. `/delegate` is written only for code work on
the full setup in git, with a board or with project folders: each subagent needs a worktree of
its own, which needs git, and the auditor re-runs the gates the full standard names, which the
lighter setup and non-code work do not have. `/autopilot` is written beside it only where there
is a board, because it reads the board at every step, and project folders keep none. `/audit`
is written exactly where `/autopilot` is, because `/autopilot` loads it and it writes board rows.

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

`/audit` is for the spare budget before a usage window resets. One opening round covers the
audit and the build, and the run stops at the reset time your lane file names, or at a later time
you give, read from the clock and never estimated. Every finding is checked by a second agent
that tries to disprove it, and a finding an earlier audit already holds is dropped and named, so
the board does not gain a second row for a finding it already has. A security fix row is written
as Deep, so the run never builds it: you lift it yourself. The skill names no repo and no tool.
Each repo writes its own commands, paths, dedupe sources and reset time in `docs/audit-lanes.md`,
and a repo without that file is never offered the audit.

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
builds costs at least two agents where one session would have done. Its worktree step removes
worktrees with git's own checks, never forced, so a dirty tree or an unmerged branch stays. What
a removal does take is the ignored files in that worktree, such as `node_modules` and `.env`,
because git never held them. A builder's change that waits for your commit keeps its worktree,
so the step frees disk only once that work is committed and merged.

`/autopilot` is that risk run all night. "All of them" now puts an overnight loop in the skills
list of a person who chose "all" for `/close-out`. The loop rests on the harness's `/loop` skill
and its timer, whose text this tool does not control, so a change there can break the loop with
no error: the run stops early, or never stops scheduling. The rundown's readings, one per wake,
are the only sign of a missed wake. And where your harness has no usage tool, the budget is an end
time or a row count, not a share of your plan.

`/audit` cannot carry the guard `/autopilot` has. The harness blocks a model's Skill call to a
skill that sets `disable-model-invocation: true`, and `/autopilot` loads `/audit` that way. So its
description is in the agent's context, and only its first line, which refuses a run nobody typed,
stops the agent from starting an audit on its own. An audit started by mistake spends budget on
agents and writes rows, though it builds nothing. Its lanes are also only as good as the lane
file: a dead-code tool that cannot see route files reports them unused, and the verify step is
the only thing between that report and a delete row.

## What it writes and where

Six skills (`/scope`, `/passoff`, `/clean-up`, `/delegate`, `/autopilot`, `/audit`) go to
`~/.claude/skills/<name>/SKILL.md`, one directory each. `/write-doc` is the seventh shared skill
and has its own question. Existing skills of other names are not touched. If you already have a
skill by one of these names that this tool did not write, it is left alone: the run's preview
lists it as refused, because it carries no stamp, and nothing is written over it. To take the
shipped skill in its place, move your own folder out of `~/.claude/skills/` and run `setup` again.

`/close-out` and `/handoff` are written per folder, to `<folder>/.claude/skills/close-out/SKILL.md`
and `<folder>/.claude/skills/handoff/SKILL.md`, from that folder's own answers (`TRACK_SKILLS` and
`renderTargetSkills` in `src/render/skills.ts`). `personal-config init <folder>` writes the same two
files in that folder. A `setup` run with no folder to configure writes neither skill anywhere.

Each folder that uses git also gets two ignore lines, `/.claude/skills/close-out/` and
`/.claude/skills/handoff/`, because the files come from your answers and are not meant to be
committed. A tracked repo takes them in `.gitignore`, an untracked one in `.git/info/exclude`
(`renderIgnore` in `src/render/repo.ts`). A plain folder, or an answer that you do not use git,
gets no ignore file. The lines name the two folders and not `.claude/skills/` as a whole, so a
skill your repo ships of its own stays tracked.

**Why the global copies of those two are removed.** A skill you keep in `~/.claude/skills/` wins
over one of the same name in a project's `.claude/skills/`. A global `/close-out` left in place
would therefore hide every folder's own, and the folder would run text written for a different
track. So the next `setup` run removes `~/.claude/skills/close-out/SKILL.md` and
`~/.claude/skills/handoff/SKILL.md` through the removal step described below; the preview lists
them as "(no longer installed)". A copy with no stamp, or one marked `adapted`, is never removed.
For that case `setup` prints a line after the preview: how many skill files in your home folder
were kept because you changed them or wrote them yourself, that each one hides the copy the run
writes into every folder, and the path of each. To use the folder's own copy, move yours aside
(`src/commands/setup.ts`, the message beginning "skill file(s) in your home folder were kept").

Where `/delegate` is written, `~/.claude/rules/model-routing.md` gains one sentence, described in
that question's long form.

`/autopilot` writes nothing at setup beyond its skill file. When it runs, it makes
`docs/incomplete/autopilot-<date>/` in the repo, holding `STATE.md`, written on every wake, and
`RUNDOWN.md`, written at the end, and it writes one ledger step per row it signs off and one for
the run. The builders' work stays in their worktrees; landing it is yours.

`/audit` also writes nothing at setup beyond its skill file. When it runs, it makes
`docs/incomplete/audit-<date>/`, holding the raw tool output under `raw/<lane>/` and a
`REPORT.md`, and it adds rows to the board at the next free numbers. It reads
`docs/audit-lanes.md`, which you write; this tool never writes it.

**A later run removes what it no longer installs.** When a setup run no longer renders a skill,
it plans the removal of that skill's `SKILL.md` in the same preview, after the writes. This
happens when you switch to a track that has fewer skills (a non-code run drops `/autopilot`,
`/audit`, `/clean-up` and `/delegate`), when you move to the lighter setup, and when you answer
**None** to this question. A removal only touches a file this tool stamped and you have not marked `adapted`; a file with no stamp, or an adapted one, is left alone and not listed. A skill folder this empties is removed too. This is also how the old global `/close-out` and `/handoff` leave. The
`/write-doc` folder is the one exception on the shared skills: see `write-doc.md`. The summary
line counts removals apart: `N file(s) to write, M to remove, K already current.`

## How to undo it

Delete the skill directories by hand, including `.claude/skills/close-out/` and
`.claude/skills/handoff/` in each folder, and the two ignore lines if you want them gone. Or run `personal-config undo` to restore anything a run overwrote or removed, including a global `/close-out` or `/handoff` a run removed. The run before it is the one `undo` reverses.
`undo` keeps a file the run created and did not overwrite (`src/commands/undo.ts`), so the per-folder
skill files that run wrote stay until you delete them by hand. Restoring a global copy brings back
the shadowing described above: after an `undo`, delete either the global copies or each folder's
copies. A
run's folder under `docs/incomplete/` is an ordinary folder: archive it with `personal-config
archive` or delete it. An audit's rows are ordinary board rows: mark one `SETTLED AS NO` to drop
it. To stop being offered the audit in one repo, delete or rename its `docs/audit-lanes.md`.
