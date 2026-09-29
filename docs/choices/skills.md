# The workflow skills

## What this is

Up to five skills under `~/.claude/skills/`, each a short document the agent loads when you type
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

How many you get depends on the setup. The lighter setup gets `/close-out` and `/handoff` only.
Non-code work on the full setup gets four: `/clean-up` drives commands that need an archive
home, and only the full code setup is asked for one.

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

## The strongest argument against it

Several more skills in a list you already scroll past, and their descriptions compete with
skills you actually use for the same trigger words. They also duplicate content that is already
in the standard, so when you edit the standard they silently go stale — nothing checks that they
agree.

`/clean-up` carries a sharper version of that risk: it runs commands that cut text out of
documents git may not be holding a copy of. The skill makes the agent preview first and wait for
a yes, but a skill is instructions, not a guard — an agent that skips the preview gets the cut
anyway, because without a terminal the commands do not stop to ask.

## What it writes and where

`~/.claude/skills/<name>/SKILL.md`, one directory each. Existing skills of other names are not
touched. If you already have a skill by one of these names, its file is backed up before it is
replaced.

## How to undo it

Delete the skill directories, or run `personal-config undo` to restore anything overwritten.
