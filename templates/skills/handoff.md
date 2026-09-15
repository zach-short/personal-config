---
name: handoff
description: Read or append to the project ledger — the append-only record of what is true. Use at the start of a session to orient, or when the user says "what's the state", "read the handoff", "record this", or "add a step".
---

# /handoff

The ledger is **what is true**. The board is what is next. Keep them apart: a fact in the board
rots the moment its item is done.

## Reading it

Read it first, every session, before the board and before any code. Its Settled sections are
closed — **do not re-ask anything recorded there.** Its claims are leads, not facts: re-verify
before building on one, and record your verification with its own date and citation rather than
the original's.

## Appending a step

**Take the next free number by reading the file.** Another session may have taken the one a doc
predicted. **Do not edit a step you did not write** — append a correction as a new step, so the
wrong claim stays findable, marked wrong, with the disproof beside it.

A step names: what changed, why, what is now fixed, which questions it answered, and what is
left owed. It is addressable forever — "HANDOFF 24" is how everything else refers to that work.

`personal-config handoff step` does that read for you: it reports the next free number, the
ledger's modification time, and what a step has to name. It cannot *reserve* the number — only
writing would — so re-read the file immediately before you append.

## Editing a standing section

Environment, Settled, Code map, Invariants, Known facts are edited in place when they go stale,
never appended to. Two rules hold everywhere in this file:

- **Absolute dates only.** `2026-09-15`, never "today" or "recently". This is read months later
  by an agent with no idea when it was written.
- **Every claim carries a citation** — `file:line`, a commit, a migration name, or the command
  that produced it. A claim with no citation is a guess and will be treated as one.

**Run every gate command once before writing it into Environment.** A command in a doc that has
never been run in this repo is a trap for every session after you.
