# How strict the type layer is

## The options

**Strict — no escape hatches at a boundary.** *Recommended.*

In TypeScript: `strict` in one base config, no `any`, no `unknown` in props, no
`as unknown as`, and string-literal unions rather than `enum`. In Go: no `any` at an API
boundary, typed string constants for anything crossing a wire or a database. In Python: type
hints on every public function, checked in CI. In Swift: no force unwraps outside tests.

*The defense.* Every escape hatch is a place where a runtime error was converted into a
compile-time success. They cluster at boundaries — exactly where the data is least trustworthy.
`enum` is banned in TypeScript specifically because it is a runtime value pretending to be a
type, with different semantics from every other type-level construct.

*The strongest argument against it.* Third-party libraries ship bad or missing types, and a
blanket ban means writing an elaborate wrapper to model something you do not control. Sometimes
`any` plus a comment is the honest answer and the wrapper is the lie.

**Strict, with escape hatches allowed behind a justification comment.**

*The defense.* It keeps the pressure on while admitting the library problem is real, and the
comment leaves a searchable record of where the gaps are.

*The strongest argument against it.* "With a comment" is a rule that degrades: the comments get
shorter, then they get copied, then they stop meaning anything.

## What it writes and where

Rule `T1` in each `docs/conventions-<lang>.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
