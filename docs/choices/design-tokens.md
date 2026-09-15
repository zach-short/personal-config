# How colours, spacing and radii are written

## The options

**Role-named tokens only; literals banned.** *Recommended.* `bg-primary`, `border-line`,
`Theme.cardRadius` — never a raw hex or an arbitrary value in view code.

*The defense.* The name is the point, not the indirection. `bg-surface` says what the colour is
*for*, so the same token works in light and dark mode and a redesign is one edit at one swap
point per platform. A hex literal says what the colour *is*, which is the one fact that is
guaranteed to change.

*The strongest argument against it.* Not everything has a role. A one-off illustration, a
brand gradient, a chart series — forcing those into the token vocabulary produces names like
`accent-7` that carry no meaning and pollute the palette for everything else.

**Tokens, with a documented escape hatch.** A raw value is allowed with a comment naming why no
token fits.

*The defense.* It admits the one-off case without opening the door, and the comments tell you
where the palette is actually missing something.

*The strongest argument against it.* The escape hatch is the easy path under deadline, and a
rule whose violation is legal-with-a-comment is a rule that erodes.

## The part that is not optional either way

Every platform in the repo defaults to the OS colour scheme, and **a colour that cannot
resolve per scheme is not a token**. A palette that only works in light mode is a light-mode palette with extra
steps.

## What it writes and where

Rule `S1` in `docs/conventions-typescript.md` and `-swift.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
