# Committed to the repo, or private to you

## What this is

Whether the ledger, board, standard and router are files the repo contains, or files only you
see.

## The guard you cannot turn off

If the origin remote's owner is not your GitHub login, this question is **not asked** and
untracked mode is used. Writing rule files into somebody else's repo is not a thing you should
have to remember to decline. Your login comes from `gh api user`, else `git config github.user`,
else it asks once and saves the answer.

## The options

**Committed — it is my repo.** *Recommended when you own it.*

*The defense.* These documents are most valuable to the next person to open the repo, and that
includes you in four months. A ledger nobody else can see cannot answer "why is it like this",
which is the question it exists to answer. Tracked is also what makes a pull request able to
cite a ledger step.

*The strongest argument against it.* It puts your working process in a public diff, where it
will be read by people it was not written for, and it makes every session's scratch notes part
of the project's permanent record. Some of what belongs in a ledger — what you found confusing,
what you got wrong — is easier to write honestly when it is private.

**Private — git-ignored.**

*The defense.* Right for a course fork, an OSS project, a client repo, or anywhere the
conventions are not yours to set. You get the whole system with no footprint on someone else's
project.

*The strongest argument against it.* It is invisible to every other clone, including your own
on another machine, and it is one `rm -rf` from gone with no backup.

## What it writes and where

Tracked: `CLAUDE.md`, `HANDOFF.md`, `PASSOFF.md`, `docs/AGENT-PRACTICES.md`, and
`.personal-config.json` added to `.gitignore`. Untracked: `CLAUDE.local.md`,
`AGENT-PRACTICES.local.md`, the same ledger and board, and every one of them added to
`.git/info/exclude` — **not** `.gitignore`, because that file belongs to the repo.

## How to undo it

Delete the files and remove the lines from `.gitignore` or `.git/info/exclude`.
