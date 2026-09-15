# What happens to the `~/.claude` config you already have

## What this is

Most people running this already have something in `~/.claude` — rules, hooks, skills, a
`CLAUDE.md`. This decides how the wizard treats it.

## The invariant, whichever you choose

**Your own `~/.claude/CLAUDE.md` is never edited.** Everything this tool writes goes into
`~/.claude/rules/<topic>.md`, one file per rule. Claude Code loads `rules/*.md` alongside
`CLAUDE.md`, so nothing is lost by keeping them apart — and it means a re-run is an overwrite of
a file this tool owns, rather than surgery on a file it does not.

## The options

**Keep every one, untouched.** *Recommended.* New rules land beside what you have.

*The defense.* Your hooks and rules are yours, they probably encode something machine-specific,
and a tool that a stranger runs should not be in the business of deciding which of them to
remove.

*The strongest argument against it.* You can end up with two rules about commits — one in your
`CLAUDE.md` and one in `rules/` — and if they ever disagree, the agent gets both and you will
not know which it followed.

**Keep them, and list any that cover the same ground.** The wizard reports overlaps so you can
delete them yourself.

*The defense.* It solves the duplicate problem without the tool taking the decision.

*The strongest argument against it.* It is a report you have to act on, and reports you have to
act on tend not to get acted on.

## What it writes and where

Nothing extra either way. The second option only adds lines to the summary at the end of the run.

## How to undo it

Nothing to undo — no existing file is modified by this answer.
