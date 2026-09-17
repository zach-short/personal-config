# Code, or other kinds of work

## What this is

Whether the documents this tool writes are about writing software — repos, builds, pull
requests — or about some other kind of work that an agent helps with: writing, research,
teaching, operations, bookkeeping.

It is asked first because it decides which of the later questions are worth your time. The
eleven questions about exports, imports, type strictness, data layers, loading states and design
tokens are all rules about source code, and a person doing non-code work is not asked any of
them.

**Status, 2026-09-17.** This answer is recorded and it already decides which questions you are
asked. The documents it selects — a standard written for non-code work rather than the long one
written for programmers — are the next piece of work, not this one. Answering "Other work"
today gets you the shorter interview; it does not yet get you a different standard.

## The options

**Code.** *Recommended, and it is what this tool did before the question existed.*

*The defense.* Everything here was built for software first and is battle-tested there. The
conventions file, the commit ritual, the gates-green done-when, the router that names which
document answers which question — all of it was written against real repos and has been run
against them for months. Choosing this gets the version that has been wrong and been fixed.

*The strongest argument against it.* It is the only shape that existed, which is not the same as
being the right shape. If most of your work is not code, answering "Code" hands you a thirty-
screen interview about type strictness and design tokens to reach four documents whose examples
are all diffs, and then a 1,100-line standard whose Part 6 is about git worktrees.

**Other work.** *Writing, research, teaching, accounting, ops.*

*The defense.* The method is not really about code. A ledger of what is true, a board of what is
next, a standard that says what "done" means, and a proof line that says what makes work sound —
none of those are properties of a programming language. Stripping the code-specific parts leaves
something that still works, and that a person who has never opened a terminal can answer.

*The strongest argument against it.* Two documents drift, and only one of them is battle-tested.
The short standard written for non-code work starts life with none of the corrections the long
one has accumulated, and every branch that produces it is a place where what you are told you
will get can quietly stop matching what you get.

## A worked example

*One person's case, recorded here rather than in the question text, because the question is
general and this is not.* Somebody keeping a small set of books wanted the same working setup:
a record of what was decided and why, a list of what is next, and a rule an agent follows for
what counts as finished. None of the code questions applied — there are no exports, no imports,
no design tokens — and the one thing that mattered most had no equivalent in the code track at
all: what proves a month's figures are right. That is the question this answer unlocks, and it
is why "Other work" is not just "Code with parts deleted".

## What it writes and where

Today: nothing on its own. It is saved with your other answers into the repo's or folder's
`.personal-config.json`, and it decides which questions the rest of the run asks — answering
"Other work" skips the eleven code-conventions questions in the practices phase.

## How to undo it

Run `personal-config setup` again and answer the other way; the run previews every file before
it writes anything, and `personal-config undo` restores whatever an accepted run overwrote.
Since this answer currently writes no file of its own, changing it changes only which questions
you are asked next time.
