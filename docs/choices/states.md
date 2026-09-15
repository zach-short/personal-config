# What a screen that loads data must render

## What this is

A rule in `docs/conventions-<lang>.md` — the per-language code standard an agent reads in full
before writing any code, and the file a reviewer checks a diff against — saying what a screen that
loads data must be able to show. It applies to every screen an agent builds, and a reviewer
checks it by asking three questions of each.

## The options

**Loading, error and empty — all three, mandatory, through one component.** *Recommended.*

*The defense.* The empty state is the one that gets skipped, and it is the one a new user sees
first — the whole app, on day one, is its empty states. Routing all three through one component
means a screen physically cannot ship with two of them, and it makes "what does a failure look
like here" a question with one answer rather than one per screen.

*The strongest argument against it.* A shared component ends up with a prop for every variation
any screen ever needed, and screens that do not fit fight it — so you get the component *plus*
bespoke handling, which is worse than either alone.

**Required, but each screen writes its own.**

*The defense.* Each screen gets the empty state it actually deserves, which is usually specific
and often the best copy in the app.

*The strongest argument against it.* Nothing enforces it, so it decays screen by screen, and it
decays fastest under deadline — which is when the error states matter most.

## What it writes and where

Rule `D2` in `docs/conventions-typescript.md` and `-swift.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
