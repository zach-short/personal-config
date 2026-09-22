# Who runs `git commit`

## What this is

A rule in `~/.claude/rules/commits.md` telling every agent session what it may do with git.

## The options

**Only me — the agent prints the commands.** *Recommended.* The session ends by running
`git status --short` and printing two copyable blocks: a `git add` naming the exact files it
touched, then a `git commit <the same files> -m "..."`. You paste them.

*The defense.* If you ever run two agent sessions in one checkout, only you know which
uncommitted file belongs to which. An agent that commits will sweep up work it cannot see — and
the commit still typechecks, because the files are on disk, so nothing catches it. It also keeps
the history yours: every commit is one you chose to make.

*The strongest argument against it.* It is friction on every single task, and most of the time
there is only one session running and nothing to collide with. If you work alone in one window,
you will paste two blocks a hundred times for a collision that never happens.

**The agent may commit, never push.** The agent commits each green slice; you review the log
and push.

*The defense.* Small, frequent commits are genuinely better than one big one at the end, and an
agent is more disciplined about making them than a person is. Nothing leaves your machine
without you, so the blast radius is one `git reset`.

*The strongest argument against it.* The collision problem is unchanged — `git add` naming the
wrong file is just as destructive whether an agent or a person runs it. And a rewritten history
is a worse recovery than a missing commit.

**No rule.** Nothing is written.

*The defense.* Fewer rules in context, and the agent behaves reasonably by default.

*The strongest argument against it.* "Reasonably by default" includes `git add -A`.

## Which commit form this ships, and why

**Both printed blocks name the files.** Not `git add <files>` then a bare `git commit -m "..."`,
which is what this shipped before 2026-09-15.

Passing paths to `git commit` implies `--only`: the commit takes exactly those paths and ignores
the rest of the index. A bare `git commit` takes the whole index — so if a parallel session
staged something between your `git add` and your paste, the bare form commits their work under
your message, and it still typechecks, because the files are on disk. That is the same collision
this whole question exists to prevent, surviving one step further down the ritual. Naming the
paths twice looks redundant and is not: the first names what to stage, the second names what to
take.

One consequence comes with it. `--only` silently drops paths git has never seen, so a brand-new
file needs `git add -N <path>` first or it is quietly left out of the commit.

The tradeoff is real but small — a longer line to paste, and a second place to get the file list
right. The alternative was to keep the short form for a solo checkout and accept that the tool's
own hook would print a ritual the rule file it writes contradicts. One tool cannot ship two
answers to the same question.

## What it writes and where

**You are asked this only for code work you keep in git.** Non-code work takes its commit
wording from the short standard instead, where it is written for that work rather than for a
programmer; work kept out of git has no commit to have a policy about. On either of those the
question is skipped rather than asked and thrown away. One consequence worth knowing: a
non-code repo that *is* in git still gets the "never run `git commit`" line in its router,
because that is what this question's recommended answer produces — edit the line if you want
the agent committing there.

`~/.claude/rules/commits.md` — a new file. Your own `~/.claude/CLAUDE.md` is never edited. If
it already has a section covering commits, the wizard says so and leaves it alone; delete it
yourself if you want only one.

Choosing a hook as well (see `hooks`) adds `~/.claude/hooks/personal-config/commit-guard.sh`
and an entry in `~/.claude/settings.json`, so the rule is enforced rather than merely written.

## How to undo it

Delete `~/.claude/rules/commits.md`. If the hook was installed, run `personal-config undo` to
restore the previous `settings.json`, or remove the `PreToolUse` entry by hand.
