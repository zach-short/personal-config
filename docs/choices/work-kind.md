# Code, or other kinds of work

## What this is

Whether the documents this tool writes are about writing software — repos, builds, pull
requests — or about some other kind of work that an agent helps with: writing, research,
teaching, operations, bookkeeping.

It is asked first because it decides which of the later questions are worth your time. The
eleven questions about exports, imports, type strictness, data layers, loading states and design
tokens are all rules about source code, and a person doing non-code work is not asked any of
them.

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

**Code** writes the documents exactly as this tool wrote them before the question existed.

**Other work** writes the short form of the standard in place of the long one — written for work
that is not code, with the owner's proof line where a code setup has gate commands — a router
with no stack, architecture or command sections, and a ledger whose facts table asks what proves
work here is sound rather than for build, test, lint and typecheck commands. It never writes a
per-language code standard, `commits.md` or `docs-lookup.md`: those are about source code and
library APIs. If the work is kept in git, the commit policy you chose renders inside the short
standard instead of as a global rule.

The answer is saved with the rest of that target's answers into `.personal-config.json`, and it
decides which questions the rest of the run asks — answering "Other work" skips the eleven
code-conventions questions in the practices phase.

## How to undo it

Run `personal-config setup` again and answer the other way; the run previews every file before it
writes anything, and `personal-config undo` restores whatever an accepted run overwrote. Switching
to "Code" replaces the short standard, router and ledger with the long forms and adds the code
standard and the two code-specific rules; switching to "Other work" replaces them the other way and
leaves the code standard and the two rules on disk for you to delete.
