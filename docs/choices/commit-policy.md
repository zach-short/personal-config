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

**The agent may commit and push.** The rule file holds one line: the agent may run any git
command, including `git add`, `git commit`, `git merge` and `git push`. No commit guard is
installed, whatever you answer to `hooks`.

*The defense.* Some people work in one session per checkout, review on the remote, and want the
agent to finish the job. Under the other answers that person removes the guard by hand and
rewrites the rule, and the next `setup` run writes both back. This answer is the way to say it
once and have it stay said.

*The strongest argument against it.* Nothing is enforced. The guard also blocks `git stash`,
`git checkout --`, `git restore`, `git reset --hard` and `git switch --discard-changes` under
every other answer, because those throw away uncommitted work that a parallel session may own.
Under this answer those pass too. A push is also the one step that leaves your machine, so a
mistake it carries is on the remote before you see it. If you ever run two sessions in one
checkout, the collision problem under **The agent may commit** applies here as well, and nothing
catches it.

The recommendation when this answer was added (2026-10-16) was to keep the guard for the five
discard commands alone. The owner of this tool chose no guard at all, because that is what they
had set up by hand. If you want the discard commands blocked, answer **The agent may commit,
never push** instead.

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

**You are asked this whenever the target is kept in git — code or not.** Code work in git also
gets the standalone `~/.claude/rules/commits.md` below; non-code work in git carries the same
answer inside its own router and short standard instead, worded for that work rather than for a
programmer. Work kept out of git has no commit to have a policy about, and there the question is
skipped rather than asked and thrown away.

`~/.claude/rules/commits.md` — a new file. Your own `~/.claude/CLAUDE.md` is never edited. If
it already has a section covering commits, the wizard says so and leaves it alone; delete it
yourself if you want only one.

Choosing a hook as well (see `hooks`) adds `~/.claude/hooks/personal-config/commit-guard.sh`
and an entry in `~/.claude/settings.json`, so the rule is enforced rather than merely written.
Beside the guard it writes `commit-policy`, one word holding this answer, so the guard enforces
the rule you chose. Under **Only me** it blocks every commit. Under **No rule** it also blocks
every commit: you asked for no written rule, but the guard you took keeps its own, that commits
are yours. Under **The agent may commit** it lets through one plain command,
`git commit <files> -m "<message>"`, with the files named and nothing else in the command, and
still blocks a push, staging everything, and every other commit. `hooks.md` has the detail.

Under **The agent may commit and push** the guard is not installed and no `commit-policy` file
is written, even if you chose the hook. If an earlier run installed them, this run removes
`commit-guard.sh`, `commit-policy` and the guard's `PreToolUse` entry in `settings.json`, and
lists each removal in the preview. Other hooks you chose (the banner, the completion gate, the
delete guard for non-code work) are written as before. In each repo's router and standard the
commit line says the agent may run any git command, including `git add`, `git commit`,
`git merge` and `git push`.

Under this answer the two skills that run a board also land what they build. After the audit,
`/delegate` has the builder commit the sign-off lines where the item file is tracked, and its
worktree step fast-forwards your checkout to the branch and pushes. A fast-forward that git refuses
leaves the branch where it is, with git's output in the report. A profile that
sets `"landStep": "prose"` (a profile key, not a question) gives `/delegate` a land step in its place: the builder
merges the base into its branch from its own worktree, resolves a conflict only in a file its item
lists, runs the gates again on the tree that lands, and the session fast-forwards your checkout and
pushes. Under the land step a row is `DONE` only once its commits are on the base. `/autopilot`
decides the questions a builder raises, by how loud a wrong answer would be, and logs each with its
reversal; a question the item file marks as the owner's still holds the row. At the end of a run it
commits its own folder and what the fold moved, naming the files, and pushes. Under the other three
answers both skills leave every branch in its worktree and every commit to you.

A profile that sets `"landStep": "wk"` hands the landing to wk, a separate command-line tool whose
queue gates each change and moves the base branch. It applies to a board in a repository with git;
project folders keep the landing above. `/delegate` makes the builder's workspace with `wk new <n>`
and spawns the builder in it without worktree isolation, because isolation would make a worktree
of the session's own repository instead. It makes the auditor's worktree itself with
`git worktree add`. After the sign-off it runs `wk submit` in the builder's workspace and reads
`wk status` until the change is `landed`, `failed` or `refused`. wk's worker gates the tree that
lands, fast-forwards your checkout and pushes, so no skill tells the session to merge or push by
hand. The row becomes `COMMITTED` with wk's landing commit once the base holds it, and
`/delegate`, `/close-out` and `/clean-up` leave every workspace to `wk gc --apply`, which never
forces. The key needs a wk config for the repository at `~/.wk/<repo>.toml` with
`[landing] enabled = true` and a `[[gates.run]]` list: with landing off `wk submit` refuses, and
with no gates wk lands onto its own ref and never moves the base. Setup does not check for that
file. Under the other three answers the key changes nothing.

**A later run removes the rule.** Answering "no rule" on a later run plans the removal of
`~/.claude/rules/commits.md`. A removal only touches a file this tool stamped and you have not marked `adapted`; a file with no stamp, or an adapted one, is left alone and not listed. The hook script and its `settings.json` entry stay, because
this removal does not edit `settings.json`.

## How to undo it

Delete `~/.claude/rules/commits.md` by hand, or run setup again and answer "no rule", which removes it. After a removal, `personal-config undo` restores the file. If the hook was installed, run `personal-config undo` to
restore the previous `settings.json`, or remove the `PreToolUse` entry by hand.

To undo **The agent may commit and push**, run setup again in each project and give another
answer. With the hook chosen, that run installs the guard again. Do not edit `commitPolicy` in a
project's `.personal-config.json` by hand: the answers are hashed, so `doctor` reports the edit
as drift, and nothing is rewritten until setup runs. `personal-config undo` right after the run
also restores the removed guard, its policy file and the `settings.json` entry.

To undo `"landStep": "wk"`, remove the key from the profile, or set it to `"prose"`, and run
setup again in each repository that uses the profile. Without the key `/delegate` returns to the
session's own fast-forward and push; with `"prose"` it gets the land step. wk's config and its
workspaces are wk's, so this changes neither.

A project's router takes the new commit line only while it is still what this tool wrote. A
router that you or a Part 0 session edited is left alone and named in the preview, so change its
commit line by hand. The same holds for Part 11 of an adapted standard. After a hand edit to
`commitPolicy` in `.personal-config.json`, the router no longer matches what its saved answers
render, so a re-run leaves it alone too.
