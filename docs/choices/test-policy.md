# What a change owes in tests

## The options

**Pure logic is tested, in a new file named for the feature.** *Recommended.*

*The defense.* The "new file" half is the part that is not obvious: two sessions working in
parallel that both append to `tests/misc.test.ts` collide in one file, and that is a merge
conflict in the least interesting place possible. A file per feature also makes the test suite
a map of the features.

The other half matters more. **Write characterization tests *before* moving logic, not after.**
A test written after the move proves the new shape works; it says nothing about whether the
behaviour survived the move, which is the only thing you actually wanted to know.

*The strongest argument against it.* You get a lot of small files, and "named for the feature"
goes stale the moment the feature is renamed — so the map is only as good as the last rename.

**Colocated `foo.test.*` beside the source.**

*The defense.* You never wonder where a file's tests are, and deleting a module deletes its
tests with it.

*The strongest argument against it.* It nudges toward testing every file rather than the logic
that matters, and it puts the collision back.

## What it writes and where

Rule `X1` in each `docs/conventions-<lang>.md`, tagged *CI*.

## How to undo it

Delete the rule, or re-run `setup`.
