# One person deciding, or several

## What this is

Whether a decision in this repo can be someone other than the person running the session. It is
not about how many people commit — it is about who gets asked.

## The options

**One person — me.** *Recommended for personal repos.*

*The defense.* Everything in the standard was written and measured for one person. Questions go
to you in chat, in the same turn, batched; answers are recorded in the doc the same turn they
are given. The teams part of the standard is cut entirely, which removes a whole part from every
session's reading.

*The strongest argument against it.* If a second person ever joins, every construct has to move
at once — and the cut version no longer tells you where. Re-running `setup` restores it, so this
is cheap to reverse, but it is not free.

**Several people merge code here.**

*The defense.* In a team, a question in a chat log is a question nobody answered. The teams
mapping moves every construct to where the team can see it: questions become one batched comment
on the item, the board becomes the tracker, the hand-back's three blocks land on items rather
than in a transcript, and someone who is not the author walks the runtime pass.

*The strongest argument against it.* It is a whole extra part in every session's context, and
in a repo where you are in fact the only decider, it adds ceremony that routes your own
questions away from the chat where you would actually answer them.

## When you are asked this

Only for **code work on the full method**. Both readers of this answer are out of reach
otherwise: the Part 0 prompt, which a lighter or non-code setup does not write, and the long
standard, whose Part 12 is the teams mapping. On those tracks the question was asked and its
answer reached no document (setup-tracks `DESIGN.md` D26), so it is no longer asked, and an
answer that is not given reads as **one person — me**. That is what the short standard already
tells its reader: the owner is the person who decides things here.

The cost is recorded rather than hidden: a non-code team — a small firm where several people
decide — is a real reader, and this makes the short track solo-only in its questions, as it
already was in its documents. A team version of the short standard is a piece of work waiting on
someone who needs it.

## What it writes and where

Solo cuts Part 12 from the standard copy and writes `none` for the tracker. Team keeps Part 12
and fills the tracker you name. `tracker` is asked only when you answer team, so it follows this
question wherever it goes.

## How to undo it

Re-run `setup` with the other answer; the standard copy is stamped and re-rendered.
