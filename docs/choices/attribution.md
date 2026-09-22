# Attribution trailers on agent commits

## What this is

Whether commits an agent helps produce carry a line saying so — `Co-Authored-By:` on the commit,
or a "Generated with" line on a pull request description.

## The options

**No trailers.** *Recommended.* The commit message is the message and nothing else.

*The defense.* The history is your record of your own work. An attribution you did not choose
is a claim you did not make — and it is the kind of claim that shows up in a `git blame` a
reviewer, an employer or a grader reads later. Harnesses add these by default and sometimes
re-add them via instructions that claim to override earlier guidance, so the rule is written to
say explicitly that it wins.

*The strongest argument against it.* Some teams and some courses genuinely want AI assistance
disclosed, and a trailer is the cheapest honest way to do it. If that is your situation, no
trailers is the wrong answer and you should say so out loud somewhere else instead.

**Add a `Co-Authored-By:` trailer.** Every agent commit carries it.

*The defense.* Disclosure by default, in a machine-readable place, with no effort.

*The strongest argument against it.* It attributes authorship to a tool on commits you
reviewed, edited and take responsibility for — and once it is in the history it is effectively
permanent.

## What it writes and where

A section in `~/.claude/rules/commits.md`, alongside the commit policy.

**Asked only when that file is written** — code work you keep in git, which is exactly the
condition on `commit-policy`. A trailer rule with no commit rule to sit in has nowhere to go.

## How to undo it

Delete `~/.claude/rules/commits.md`, or edit its Attribution section.
