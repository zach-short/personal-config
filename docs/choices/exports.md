# How a module's public surface is declared

## What this is

A rule in `docs/conventions-<lang>.md` — the per-language code standard an agent reads in full
before writing any code, and the file a reviewer checks a diff against — saying how a module
declares what other files may import from it. It shapes every `import` line in the repo.

## The options

**Named exports; declarations, not `const` arrows.** *Recommended.* Default exports only where
a framework requires them.

*The defense.* A named export has one spelling, so it is greppable and renameable; a default
export has as many names as it has importers. A `function` declaration hoists, names itself in a
stack trace, and reads as a definition rather than an assignment.

*The strongest argument against it.* Some frameworks want defaults for route files and page
components, so the rule immediately needs an exception — and a rule with an exception at its
centre is one people apply from memory of the exception.

**Default exports allowed anywhere.**

*The defense.* Less ceremony, and it matches what most tutorials and generators produce.

*The strongest argument against it.* Two files importing the same module under two names is a
real source of confusion, and no tool will tell you it happened.

## In Go this rule is different

Go has no export keyword — capitalization *is* the mechanism. So the rule becomes "minimize the
exported surface", plus the no-stutter convention: `helpcontent.Load`, not
`helpcontent.LoadHelpContent`. That is why the generated Go file says something different from
the TypeScript one, and why the file extension decides which applies.

## What it writes and where

Rule `E1` in `docs/conventions-typescript.md`, `-go.md` and `-swift.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
