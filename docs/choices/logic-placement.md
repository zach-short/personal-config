# Where logic lives once a view or handler grows

## What this is

A rule in `docs/conventions-<lang>.md` — the per-language code standard an agent reads in full
before writing any code, and the file a reviewer checks a diff against — saying where logic
goes once a screen or a request handler grows past the trivial. It decides what can be tested
without a network or a browser.

## The options

**Extracted into a named unit, one per file.** *Recommended.* In a React or React Native app:
extract to a hook when a component has more than two `useState`, any `useEffect` doing real
work, or logic another component would want. In Go: SQL lives only in the repository layer, and
errors become HTTP status codes in the handler and nowhere else. In Swift: pure logic lives in
a shared core module, away from views. In Python: I/O at the edges, pure functions in the middle.

*The defense.* All four are the same rule in different clothes — **the part you want to test
should not be the part that talks to the outside world.** A function that both fetches and
computes cannot be tested without a network, so it does not get tested, so it is where the bugs
live.

*The strongest argument against it.* Extracted too early it is pure overhead: a hook used once,
in a file you now have to open to read the component. The threshold is a guess, and a wrong
guess in this direction produces an architecture of one-caller abstractions.

**Colocated until it is reused.**

*The defense.* You extract when you have evidence, not when a rule fires. The second caller is
the evidence.

*The strongest argument against it.* "Reused" never arrives for logic that is hard to reuse
*because* it is entangled — so the rule quietly protects exactly the code that most needs
splitting.

## The qualifier

Extract for a **concept**, not to relocate lines. `useMarketCamera` is a concept;
`useListingScreenLogic` is a paragraph with a name.

## What it writes and where

Rule `L2` in each `docs/conventions-<lang>.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
