# Whether this work lives in git

## What this is

Whether the work you are setting up is kept in git repositories, or in plain folders on disk.

It is its own question rather than something inferred from what kind of work this is, because
the two really are independent: plenty of non-code work lives in git, and plenty of a working
life — drafts, records, notes, a folder of spreadsheets — does not. Some people have both, which
is exactly why this is asked once about you rather than guessed per folder.

**Status, 2026-09-17.** Answering "No, just folders" stops one question being asked — whether
these files should be committed or kept private, which has no meaning where there is no
repository. The discovery step still only finds git repositories; teaching it to accept plain
folders is the next piece of work, not this one.

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

Today: nothing on its own. It is saved with your other answers, and it gates one question — the
committed-or-private question for each target, which is now asked only when the target is both
yours and in git.

## How to undo it

Run `personal-config setup` again and answer the other way. Answering "yes" on a later run
brings the committed-or-private question back; answering "no" only stops it being asked, and
leaves any files an earlier run already wrote exactly where they are. `personal-config undo`
restores anything an accepted run overwrote.
