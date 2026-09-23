# Working standard — short form

**What this is.** How work here is done with an agent, so that any session can pick up where the
last one stopped and you can trust what it wrote down. It is the short form of the working
standard: one record of what is true, a way to hand work to the next session, a stated test of
what "done" means here, and the writing habits that keep the record honest. It is read at the
start of every session, so it is kept short on purpose — a longer document would cost more to
read than most of the work it governs.

**Standard version: 1.2.0**

**Pre-filled by `personal-config` on {{DATE}}.** Every name below is this project's own, and
nothing in this file is left for a later session to fill in. Read `{{ROUTER_FILE}}` first — the
harness loads it on its own — then this file, then `{{LEDGER_FILE}}`.

**Two words this file leans on.** The **ledger** is the file recording what is true of this work:
how things are here, what has been decided, and a numbered, append-only log of what was done. The
**owner** is the person who decides things here. They are interactive: when a decision is theirs,
ask, in chat, in the same turn, in one batch — a decision built on a guess is built twice.

## The rules that hold everywhere

Each rule ends with its **test** — what a reader of the ledger or the hand-back checks — so
whether a session kept it is never a matter of opinion.

**R1 — Absolute dates only.** `2026-09-14`, never `today`, `recently` or `last week`. The ledger
is read months later by a session with no idea when a line was written.
*Test:* a search of what you wrote for `today`, `yesterday`, `tomorrow`, `recently`, `currently`,
`last week`, `this month`, `days ago` and their siblings finds nothing.

**R2 — Every claim names its source.** The file and line, the page, the row, the message or the
statement it was read from. A claim with no source is a guess and is treated as one.
*Test:* every sentence stating what is true of the work says where that was seen.

**R3 — A claim in an existing document is a lead, not a fact.** Check it again before building on
it, and record your own check with its own date.
*Test:* a claim carried forward reads `checked <date>` with your source, not the original's.

**R4 — Look before recording an absence.** "There is no X" is the most expensive wrong claim,
because everything after it is built on it.
*Test:* every "there is no X" and "nothing does X" says how you looked.

**R5 — When you disprove something, record the disproof where the wrong claim lives.** Silent
deletion means the next session rediscovers it.
*Test:* the wrong claim is still findable, marked wrong, dated, with the disproof beside it.

**R6 — Ask the owner in one batch, in chat, before building.** Questions written into a document
for later do not get answered. Gather every open question into one message.
*Test:* the questions went out in one message before anything that depends on an answer was
written; the hand-back lists any still unanswered.

**R7 — Words someone else will read are never picked silently.** Where the wording matters and is
not already settled, offer two or three real variations and ask which.
*Test:* the ask shows the variants, or cites where the wording was settled.

**R8 — Never reopen a settled decision.** Check the ledger's Settled sections before treating
anything as open. New evidence produces a dated supersession naming what it replaces — never a
quiet reversal.
*Test:* nothing recorded as settled is reopened; any change to one names what it replaces.

**R9 — Dropping scope is the owner's call.** If something is explicitly parked, record it and stop
raising it. If nothing has been said, raise it rather than deciding.
*Test:* every finding not acted on appears in the hand-back as parked by the owner, dated, or as
open; none is dropped silently.

**R10 — Report faithfully.** "I checked it against the source" and "it looks right" are different
claims and are never merged. Say which one you have.
*Test:* the hand-back says which, per item.

**R11 — Read this file and the ledger in full before doing anything.** Not optional, not
conditional on the size of the task.
*Test:* the session's first reads include both, and the hand-back says so.

**R12 — Stop when something contradicts a settled decision.** Do not take the call and flag it
afterwards, and do not finish the piece first. If you are unsure whether it contradicts, that is
the signal to ask.
*Test:* the contradiction reaches the owner as a question before the next change lands.

## The ledger — `{{LEDGER_FILE}}`

The ledger is **what is true**. Read it first, every session, before anything else; where the work
is not in git, it is also the only history there is. Sections, in this order:

- **Orientation.** What this work is, who decides, what they know, and how to reach them.
- **How things are here.** The tools, where the files live, and **what an agent cannot check from
  here** — a bank statement, a person's approval, a printed copy — with what to do instead.
- **Settled.** One dated section per decided topic, each carrying **the argument that lost beside
  the one that won** — unrecorded, it returns in three weeks as a new objection. Nothing under it
  is re-asked (R8).
- **Known facts and quirks.** What was learned the hard way, with sources.
- **The step log.** Numbered and append-only: `**N. Title.** Done <date>.` then what changed, why,
  what is now settled, and how the proof line was applied. A step is addressable forever — "step
  24" is how everything else refers to that work. **Take the next free number by reading the
  file**, never from a number written elsewhere; **never edit a step you did not write** — append
  a correction as a new step.

Standing sections are edited in place when they go stale. The log is only ever added to — but
once it runs past twenty or so steps, the older ones **keep their number, title and date and
lose the rest** to a companion file beside the ledger. The ledger is read in full at the start
of every session, so its length is what every session pays. Two things make it safe: copy the
text out, check it arrived, and only then cut; and **never drop a number**. "Step 24" is how
everything refers to that work, and a number that stops resolving takes every reference with it.

## What is next — `{{BOARD_FILE}}`

The board is **what is next**: one row per item, and below the table one standalone prompt per
item, written as "Handing work to the next session" describes. Keep it apart from the ledger — a
fact written into the board rots the moment its item is done.

- Status words, and no others: `OPEN` · `IN FLIGHT` · `DONE — <ledger step>` · `HELD` ·
  `SETTLED AS NO` · `SUPERSEDED`. `DONE` points at the step that is the real record; `HELD` names
  what it waits on; `SETTLED AS NO` carries its reason, so it is not proposed again.
- An item exists before work on it starts: a row, plus a dated line saying why it exists.
- When an item closes, its row becomes `DONE — <step>`. **Never paste a prompt marked `DONE`** —
  a fresh session would do the work again.

## Handing work to the next session

Every session ends by writing the next one's first message. That session will not see this
conversation, so the prompt has to stand alone; one that assumes any of this context produces a
session that rediscovers what you already knew. Seven parts, in this order — say when one is
genuinely empty rather than skipping it:

1. **Title.** What changes, not the area.
2. **Why this exists**, in the owner's terms — what lets the next session make the hundred small
   calls the prompt does not cover.
3. **What is fixed.** The checked facts with their sources, the settled decisions, and the
   example to copy rather than reinvent. *Read these before changing anything; do not reopen.*
4. **Do these, in order.** Numbered, each with its reason.
5. **Ask before building.** The decisions that are the owner's, and what makes each a real one.
6. **Not in scope, whoever asks.** What stays out, named.
7. **Hand back.** How the proof line is to be applied, and what the owner should check and see.

## What "done" means here

Work here is done when this is true, and a session says so only after applying it and reporting
what it saw:

{{PROOF_BLOCK}}

"Looks done" is not a signal: without a check a session can run, it is the only signal it has,
and that is how work stops early. The line above is the check. Where it is empty, writing one is
the first session's job, with the owner. A good proof line is a test somebody else could run —
*the totals agree with the source table*, *someone who did not write it read it* — never a value
like *accurate*. One line, one test; two tests joined by "and" hide half a failure.

When a piece of work closes (below), this line is what the closing session checks against, and
the ledger step says how it was applied and what was seen.

## Sizing a session

The model for work here is `{{MODEL}}`; if an item names a different one, run it there. A
session's context is finite and no gauge reports it from inside: the first sign of running out is
the conversation being summarised behind you, after which the session works from a summary of its
own reasoning and re-reads what it already read.

So **land early**. When the conversation has grown long — many files read, a long back-and-forth
— stop taking on new work: finish the change in hand, apply the proof line to what exists, write
the ledger step, and hand off *the remainder*, not the next item. A session that ends cleanly at
60% of its scope is worth more than one that runs out at 100%.

Read what the work needs and no more. This file and the ledger are the fixed cost of every
session, which is why both are kept short. Anything the next session will need goes in the ledger
— not in the harness's own memory, which is personal, unreliable, and invisible to anyone else.

## Closing a piece of work

Every piece of work ends the same way, in this order, without being asked:

1. **Apply the proof line** to what was done, and write down what you saw — not that it passed.
2. **Append the ledger step** at the next free number, then fix any standing section that went
   stale.
3. **Write the next session's prompt** in full, in the chat, as one block the owner can copy.
4. **Say plainly what was and was not checked.** "Checked against the source" and "looks right"
   are different claims (R10).

## If this work is in git

{{COMMIT_POLICY}}

Two rules for whoever commits: name the exact files — never `git add -A` or `git add .`, which
sweep in whatever else has changed — and never `git checkout --` or `git stash` to undo an
experiment: copy the file aside and restore it with `cp`.

## Preferences

<!-- Written at render time from the answers given to personal-config. -->

## The first session

The first session here has one job, and does no other work: read this file and `{{ROUTER_FILE}}`,
look at what is actually in the folder, and fill the ledger's Orientation and "How things are
here" from what you find — checked, dated, with sources. If the proof line above is empty, write
one with the owner (R6). Then take one small piece of work end to end and close it out as
described above; the ritual is what makes the rest hold. When that is done, delete this section.
