# What happens to an unrelated problem found mid-task

## The options

**Note it and raise it — never fold it in.** *Recommended.*

*The defense.* An unrelated change hides in the diff, and it hides in the review of that diff.
When the task's own change turns out to be wrong, you cannot revert it without also reverting
the drive-by. And when the drive-by is the thing that broke, you will look for the cause in the
task's change, because that is what the commit says it was.

*The strongest argument against it.* You are staring at a typo you could fix in four seconds,
and a rule that makes you write it down instead is a rule that produces a list nobody reads.
Small rot compounds, and the moment you noticed it was the cheapest moment to fix it.

**Trivial fixes may ride along if named in the hand-back.**

*The defense.* It keeps the cost of a genuine one-liner near zero while preserving the audit
trail, and it is honest about what people do anyway.

*The strongest argument against it.* "Trivial" is self-assessed by the party who wants to do it,
and it expands. A typo becomes a rename becomes a small refactor.

## The other half of the rule

**Descoping is your call.** If you park something, it gets recorded and stops being raised. If
nothing has been said, a finding still blocks by default — the agent surfaces the judgement
call rather than making it, and every finding not fixed appears in the hand-back as either
`parked by owner <date>` or `open`. None is dropped silently.

## What it writes and where

A paragraph in Part 11 of the standard copy.

## How to undo it

Edit Part 11, or re-run `setup`.
