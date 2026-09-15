# What a session does when it is running the wrong model

## What this is

Tasks get assigned a model on purpose — a board's Model column, a pass-off prompt's
`**Model: X**` line, a doc that names one. This decides what happens when a session reads such
a task and is not running that model.

## The options

**Delegate to that model, or stop and hand off.** *Recommended.* The check happens first,
before reading the codebase and before planning. If the models match, the session says so in one
line and carries on. If not, it either spawns a subagent running the assigned model and hands it
the whole prompt, or it stops, writes a pass-off carrying everything it has already established,
and tells you to run it elsewhere.

*The defense.* The assignment is a safety choice, not a preference. The whole point of a Deep
tier is work whose failure is silent — so a lighter model doing that work produces something
that looks fine and is not, which is exactly the outcome the label exists to prevent. "It turned
out to be simple" is a judgement only the assigned model gets to make, because judging it
requires doing the work.

*The strongest argument against it.* Delegation costs a round trip and a subagent's context, and
the subagent boundary keeps only its final text — so handing a Deep model a *building* job
throws away the sustained reasoning you are paying for. It is the right call for a review and a
poor one for a build, which is why the rule offers "stop and hand off" as the equal option
rather than always delegating.

**Say so in one line, then carry on.** The mismatch is noted; the work proceeds.

*The defense.* You keep the information and lose none of the momentum. If you are in the room
watching, you can intervene.

*The strongest argument against it.* A line in a transcript you are not reading is not a
safeguard. This is very close to having no rule, with extra words.

**No rule.** Skip this if you do not tag tasks with models.

## What it writes and where

`~/.claude/rules/model-routing.md`, which also carries the tier table.

## How to undo it

Delete `~/.claude/rules/model-routing.md`.
