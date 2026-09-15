# Enforcing a rule with a hook

## What this is

A rule is text in the agent's context; a hook is a script the harness runs whether the agent
agrees or not. This decides whether the commit policy gets teeth, and whether every session
opens with a short reminder of where work is written down.

## The options

**Block `git commit`, `git push` and `git add -A`.** *Recommended.* A `PreToolUse` hook
inspects the command, and refuses those, printing the two-block ritual to the agent instead.

*The defense.* This is the one rule whose violation is hard to undo. A rule in prose is a rule a
session can reason its way past — under time pressure, or because the task "obviously" wants a
commit, or because a later instruction claimed to supersede it. The hook does not reason. It is
also the difference between a setup that works for you and one that works for someone who has
never read the rule they are relying on.

*The strongest argument against it.* It edits `~/.claude/settings.json`, a file you own and
probably already have hooks in, and a bad merge there breaks every session until you fix it.
That is why the merge is previewed, confirmed, and backed up, and why declining prints the
snippet instead. It also blocks you when *you* asked for a commit, which is annoying the first
time and then permanently.

**That, plus a session-start banner.** A `SessionStart` hook reads the repo's
`.personal-config.json` and prints your ledger, your standard and the top `OPEN` board row.

*The defense.* The files only help if sessions read them, and a session that does not know they
exist will not. Three lines at startup is the cheapest way to make the habit automatic.

*The strongest argument against it.* It is three lines of noise at the top of every session,
including the ones where you just want to ask a question. And a banner people learn to skip is
worse than no banner, because it looks like the problem is solved.

**No hooks.** Nothing is added to `settings.json`.

## What it writes and where

`~/.claude/hooks/personal-config/commit-guard.sh` and `session-banner.sh`, plus a **merge** into
`~/.claude/settings.json` — never an overwrite. Existing hooks are preserved; duplicate entries
are not added. The merge is shown as a diff, confirmed on its own, and the previous file is
backed up.

## How to undo it

`personal-config undo` restores the previous `settings.json`. Or remove the `PreToolUse` /
`SessionStart` entries by hand and delete the scripts.
