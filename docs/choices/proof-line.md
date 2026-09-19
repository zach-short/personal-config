# What proves work here is sound

## What this is

One line, in your own words, naming the thing that has to be true before work here counts as
finished. It is asked once for each repo or folder you set up, because the answer is a property
of the work, not of you.

Examples of the shape:

- *the reconciliation balances to the bank statement*
- *someone who didn't write it read it*
- *the test suite and the type check are green, and the new behaviour has a test*
- *the figures in the summary match the figures in the source table*

## Why it is asked at all

The method's own rule is that a done-when which is only "the gates pass" is not a done-when.
For a repo with a test suite that rule is a warning; for work with no gates at all it is the
whole problem. Without this line, a session finishing non-code work has nothing to check itself
against, and "looks done" becomes the only signal available — which is a documented way for an
agent to stop early on work that is not actually finished.

It is asked on every track, not only the ones without gates, for the same reason: a repo with
CI still owes an answer to "and what makes it *right*", and CI does not answer that.

## What makes a good one

It is a **test somebody could run**, not a value. "Accurate" is not a proof line; "the totals
agree with the source of truth" is. Prefer something that fails visibly when it is false, and
that a person other than you could apply without asking what you meant.

One line, one test. Two obligations joined by "and" read fine in a document and are useless in a
check, because half of it passing looks the same as all of it passing.

## The argument against it

It is one more question, on a flow that is otherwise trying to get shorter, and a bad answer is
worse than none: a proof line that is vague ("it works") or unfalsifiable ("it is correct") gets
cited by the end-of-work ritual as though it meant something, and lends the appearance of a
check to work nothing checked. Leaving it empty is a legitimate answer, and an honest one, if
you do not have a real test to name yet.

## What it writes and where

The line is rendered where the gate commands go in a code setup, so the end-of-work ritual has
something to check against: in the short standard's section on what "done" means here, in the
router under *What proves work here is sound*, and as the first row of the ledger's facts table.
On the whole-method code track it is added to the Part 0 prompt, for the adaptation session to
put beside the gates it finds.

It is saved with that target's other answers in `.personal-config.json` and hashed into the stamp
on every generated file there, so changing it and re-running `setup` re-renders them. Left empty,
the documents say it is not yet written and make writing it the first session's job — with you.

## How to undo it

Run `personal-config setup` again in that repo or folder and give a different line, or an empty
one to remove it. Nothing else depends on the wording, so there is no other file to clean up;
`personal-config undo` restores anything an accepted run overwrote.
