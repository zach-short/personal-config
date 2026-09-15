# The four workflow skills

## What this is

Four skills under `~/.claude/skills/`, each a short document the agent loads when you type its
name or when the description matches what you asked for.

- **`/close-out`** — the end-of-work ritual: update the record, then post the three hand-back
  blocks (the next prompt, the runtime entries, the next model).
- **`/scope`** — open a piece of work properly: ground truth first, then a scope document whose
  job is to make your decisions cheap, then one batched question.
- **`/passoff`** — write the next session's first message so it stands alone.
- **`/handoff`** — read or append to the ledger, including the rules about step numbers.

## The defense

These are the parts of the working standard that are *rituals* rather than facts — the things
that only work if they happen every time. A rule buried on page 40 of a standard is read once;
a skill is invoked by name at the moment it applies. `/close-out` in particular is the one that
makes the rest hold: a repo that adopts the documents without the close-out has adopted nothing.

## The strongest argument against it

Four more skills in a list you already scroll past, and their descriptions compete with skills
you actually use for the same trigger words. They also duplicate content that is already in the
standard, so when you edit the standard they silently go stale — nothing checks that they agree.

## What it writes and where

`~/.claude/skills/<name>/SKILL.md`, one directory each. Existing skills of other names are not
touched. If you already have a skill by one of these names, its file is backed up before it is
replaced.

## How to undo it

Delete the four directories, or run `personal-config undo` to restore anything overwritten.
