# What a code comment may say

## The options

**Why only — never what.** *Recommended.* A comment restating the line below it is banned;
rename or extract instead. A comment recording *why* is required where the reason is not
derivable from the code.

*The defense.* A "what" comment is a second copy of the code that nothing keeps in sync, so it
is wrong the first time the code changes and misleading forever after. A "why" comment holds the
one thing the code genuinely cannot: the constraint, the vendor bug, the decision that was made
and the one that was rejected.

*The strongest argument against it.* "Why, never what" is a judgement call at the margin, and a
rule that depends on judgement gets applied inconsistently — which can be worse than a blunt
rule, because now reviewers argue about it.

**Why, plus section headers in long files.** The same rule, but `// ---- validation ----`
banners are allowed.

*The defense.* In a 400-line file the banners genuinely help, and banning them pushes people
toward worse structure just to satisfy a comment rule.

*The strongest argument against it.* A file that needs banners usually needs splitting, and the
banners hide that.

## The part that matters more than the rule

**Never bulk-delete comments**, and never strip one in a protected category: product or design
rationale, a lint-suppression justification, an external-constraint workaround, or
documentation on a public export. A "clean up the comments" pass is one of the most destructive
things an agent can be asked to do, because the information exists nowhere else and the diff
looks tidy. This is written into the rule whichever option you pick.

## What it writes and where

Rule `C1` in `docs/conventions-<lang>.md` for each language found, tagged *review*.

## How to undo it

Delete the rule from the conventions file, or re-run `setup` and answer `No rule`.
