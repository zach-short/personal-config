# The whole method, or a lighter setup

## What this is

How much of the method you want installed. The full setup is every document and every skill —
a standard of about 1,100 lines, a ledger, a board, a router, four workflow skills, a set of
global rules and a model-routing rule with three tiers in it. The lighter setup is the same
method with the machinery that assumes a large context budget taken out.

It is a separate question from what kind of work this is, deliberately, so that any combination
stays reachable — including the programmer who wants the light config, which a single combined
"setup type" could not express without inventing a name for it.

**Status, 2026-09-17.** The question is in place and is recorded with your other answers. What a
light run actually writes differently is the next piece of work. Answering "Lighter" today
changes nothing about the files you get.

## The options

**The whole method.** *Recommended, and it is what this tool did before the question existed.*

*The defense.* The parts fit together. The router points at the standard, the standard's Part 0
tells a session how to adapt itself, the skills know how to work the ledger and the board, and
the model-routing rule is what stops a mechanical sweep running on the expensive tier. Take
pieces out and the remaining pieces cite documents that are not there.

*The strongest argument against it.* The standard's own Part 0 says adapting it costs roughly
40,000 to 80,000 tokens of context and warns against doing feature work in the same session.
That is a real bill, and it is charged at the start of every session that reads it. If your
budget is small, the method's advice to delegate work to a second agent is not merely unhelpful
— it is the most expensive thing on the page.

**Lighter.** *Fewer files, less to read at the start of each session.*

*The defense.* Most of the value is in three habits: write down what is true, write down what is
next, and say what "done" means before starting. Those survive at a tenth of the size. The cut
is aimed at exactly the parts that assume budget — one model instead of three tiers, no
model-routing rule, a short standard, a shorter router, a ledger and no board, and the two
workflow skills that work without gates and commits rather than all four.

*The strongest argument against it.* This is the option with the most conditionals behind it,
and every conditional is a branch that can drift from what this page promises. A light run that
still writes the model-routing rule, or a short standard that still talks about diffs, is a
document that renders cleanly, passes every check, and is quietly wrong for its reader.

There is a second cost worth naming: the board is where work running in parallel gets
serialized, so a light setup has no rule for two sessions colliding. The answer to that is that
you have moved off "lighter" by then, not that "lighter" should carry a board.

## What it writes and where

Today: nothing on its own. It is saved with your other answers into `.personal-config.json` and
into your user config, so a second run does not re-ask it.

## How to undo it

Run `personal-config setup` again and answer the other way. Every run previews the full list of
files before writing, and `personal-config undo` restores anything an accepted run overwrote.
Going from lighter to the whole method adds files; going the other way leaves the extra files on
disk, so delete the ones you no longer want.
