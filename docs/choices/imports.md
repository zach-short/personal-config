# How imports are written and ordered

## The options

**No `../`; grouped, blank line between groups.** *Recommended.* `./sibling` is fine; anything
containing `../` is not — use a path alias.

*The defense.* A `../` chain encodes the importing file's position in the tree. Move the file
and an import breaks that had nothing to do with the move — and the deeper the chain, the less
any human can tell at a glance what it points at. An alias points at a thing rather than a
route to it.

*The strongest argument against it.* Aliases need configuration in the bundler, the typechecker,
the test runner and the editor, and when one of those disagrees you get an error that names none
of them. In a small repo `../lib/x` is honest and works everywhere.

**Grouped and sorted, relative paths allowed.**

*The defense.* You get the readable ordering without the alias configuration.

*The strongest argument against it.* Nothing stops the four-level chains.

## What the formatter probably already does

Import *ordering* is settled by most formatters and by ruff, gofmt and Biome. Where the config
settles it, the generated rule says so and the prose stays out of it — a short conventions file
for a language with strong tooling is correctly scoped, not missing rules.

## What it writes and where

Rule `I1` in `docs/conventions-typescript.md`, `-python.md` and `-swift.md`, tagged *review*.

## How to undo it

Delete the rule, or re-run `setup`.
