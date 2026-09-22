# Whether this work lives in git

## What this is

Whether the work you are setting up is kept in git repositories, or in plain folders on disk.

It is its own question rather than something inferred from what kind of work this is, because
the two really are independent: plenty of non-code work lives in git, and plenty of a working
life — drafts, records, notes, a folder of spreadsheets — does not. Some people have both, which
is exactly why this is asked once about you rather than guessed per folder.

## The options

**Yes, in git repos.** *Recommended, and it is what this tool assumed before the question
existed.*

*The defense.* Git is what makes most of this checkable. Whether a file is committed or ignored
is a real distinction, `git status` is how the commit ritual knows which files a session
touched, and a ledger in a tracked file can be cited from a pull request. The ownership guard —
which refuses to write rule files into somebody else's repository — reads the origin remote, so
it only exists at all when there is one.

*The strongest argument against it.* It is an assumption, and until this question existed it was
an unstated one: work not in a repository was simply invisible to the setup run. Answering "yes"
when half your work is loose folders gets you a configuration for the half git can see.

**No, just folders.** *The files live on disk and that's it.*

*The defense.* It is the honest answer for a great deal of real work, and it removes a question
that cannot be answered sensibly without a repository: there is no `.git/info/exclude` to write
to, so "committed or private" has no referent. Saying so up front is better than being asked and
having the answer quietly discarded.

*The strongest argument against it.* You lose the things git was carrying. Nothing records when
a document changed or why, nothing stops an agent overwriting a day's work, and the backup this
tool keeps is the only way back from an accepted run. A folder is one deletion from gone.

## What it writes and where

**Yes** writes the git rules where they apply — and *where they apply* is decided for each target
separately, not once for you. A target that discovery found as a git repository gets them; a
plain folder gets none of them, however you answered, because a folder has no `.git` to honour
them. That per-target split is what lets somebody with a repo and a loose folder answer this once
and have both come out right.

So, for a git target: the commit line in the router, the commit policy paragraph in the standard's
owner-policy part — or inside the git section of the short standard, on the short track — and the
ignore entries that keep the personal files out of the repository. The global `commits.md` for
code work is written from your answer alone, because `~/.claude/` belongs to no target and your
answer is the only input it could have.

> **Wrong until 2026-09-22, kept here rather than deleted (R5).** This section used to stop at
> "where they apply" and describe every one of those files as following from the answer. Three of
> the four per-target places did not read the target at all: a plain folder belonging to somebody
> who answered "yes" was handed a router rule against `git commit`, a commit paragraph in its
> standard, and a git section in its short standard — and its Part 0 prompt was never told Part 6
> could go. Only the ignore entries were ever decided per target. Corrected in the code and here
> on 2026-09-22 (board item 54); `tests/mixed-targets.test.ts` pins all four.

**No** writes none of those — no `commits.md`, no ignore entries anywhere, no git section in the
short standard — and on the code track the long standard's owner-policy part carries no commit
paragraph while the Part 0 prompt names Part 6 (parallel sessions, worktrees, the commit rules) as
a candidate to cut whole. That holds even for a target that really is a git repository: the answer
you gave is not overruled by what the scan found on disk, because this is the one place you can
say "not here either".

It also gates one question, the committed-or-private question for each target, which is asked
only when the target is both yours and in git. Discovery finds plain folders as well as
repositories, so a folder of files is a target whichever way this is answered — and it is
rendered as a folder either way.

## How to undo it

Run `personal-config setup` again and answer the other way. Answering "yes" on a later run
brings the committed-or-private question back; answering "no" only stops it being asked, and
leaves any files an earlier run already wrote exactly where they are. `personal-config undo`
restores anything an accepted run overwrote.
