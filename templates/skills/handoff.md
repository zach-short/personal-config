---
name: handoff
description: Read or append to the project ledger — the append-only record of what is true. Use at the start of a session to orient, or when the user says "what's the state", "read the handoff", "record this", or "add a step".
---

# /handoff

{{LEDGER_AND_BOARD}}

## Reading it

Read it first, every session, {{READ_BEFORE}}. Its Settled sections are
closed — **do not re-ask anything recorded there.** Its claims are leads, not facts: re-verify
before building on one, and record your verification with its own date and citation rather than
the original's.

## Appending a step

**Take the next free number by reading the file.** Another session may have taken the one a doc
predicted. **Do not edit a step you did not write** — append a correction as a new step, so the
wrong claim stays findable, marked wrong, with the disproof beside it.

{{STEP_NAMES}}

`personal-config handoff step` does that read for you: it reports the next free number, the
ledger's modification time, and what a step has to name. It cannot *reserve* the number — only
writing would — so re-read the file immediately before you append.

## Editing a standing section

{{STANDING_SECTIONS}} are edited in place when they go stale,
never appended to. Two rules hold everywhere in this file:

- **Absolute dates only.** `2026-09-15`, never "today" or "recently". This is read months later
  by an agent with no idea when it was written.
- **Every claim carries a citation** — {{CITATION_FORMS}}. A claim with no citation is a guess and will be treated as one.

{{PROOF_OR_GATES}}
