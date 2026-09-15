# Commit policy, as this repo's Part 11 states it

## Why this is not a question

You already answered it once, in the `you` phase (see `commit-policy`). Asking again per repo
is how two answers end up disagreeing, and a rule that disagrees with itself is worse than no
rule — the agent gets both and you cannot tell which it followed.

So this area is never asked. It renders the answer you already gave into **Part 11** of each
repo's standard copy, which is where the standard itself says owner policy belongs.

## What gets written

If you chose *only me — the agent prints the commands*, Part 11 gets the full ritual: never
`git commit` or `git push`; run `git status --short`; print two blocks; never `-A`, never `.`.

If you chose *the agent may commit, never push*, Part 11 gets the small-slices rule instead —
commit after each leg lands rather than holding a multi-file change across a long gate run,
still never `-A` or `.`, still never push. Plus the two that hold whoever commits: `git add -N`
first for a file git has never seen, because `--only` silently drops untracked paths and the
commit still typechecks; and build HEAD in isolation before pushing, because gates run against
the working tree and a partial commit can leave the branch unbuildable while your tree is green.

If you chose *no rule*, Part 11 says nothing about commits.

## How to undo or change it

Re-run `setup` and answer `commit-policy` differently, or edit Part 11 directly — it is marked
editable for exactly this reason.
