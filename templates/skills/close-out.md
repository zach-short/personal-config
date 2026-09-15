---
name: close-out
description: Run the end-of-work ritual — update the ledger or plan, then post the three hand-back blocks. Use when a board item or a phase is finished, when work is being landed early on budget, or when the user says "close this out", "wrap up", or "hand off".
---

# /close-out

Every phase and every board item ends the same way, in this order, without being asked. The
point is that the owner can close the session immediately after: set the stated model, paste
one block, go.

## 1 — Update the record, in the same commit as the code

- **Ledger profile:** one new step at the next free number — **read the file to find it**, do
  not trust a number written elsewhere. Name what changed, why, what is now fixed, and which
  questions it answered. Add any new file to the code map. **Do not edit a step you did not
  write**; append a correction as a new step.
- **Project-folder profile:** the phase header becomes `**BUILT <date>, commit <hash>**`, plus
  any deviation, discovery or re-ordering this phase forced on later phases. The design gets
  its `As built:` paragraphs. The runtime-pass file gets this phase's entries.
- **Landed early, or interrupted?** Same ritual, different header: leave the item unmarked, add
  a status note — what is done, what is left, what it changes about the plan — and write the
  handoff. The pass-off then targets *the remainder of this item*, not the next one.

## 2 — Post three blocks in the chat

Not only in the docs — the whole value is that they are copy-pasteable at the moment the
session ends.

- **Block A — the pass-off prompt**, in full, as a fenced block. It must stand alone: the next
  agent will not see this conversation.
- **Block B — the runtime entries this piece added.** Three lines each: the goal it checks in
  product terms, exactly where and how to reach it, and what the right answer is — including
  the query that finds the fixture, not an id that will rot.
- **Block C — the next session's model**, on its own line, last in the message, because it is
  the first thing the owner acts on.

## 3 — State plainly what was and was not verified

"Gates green, not seen running" and "walked the flow on the device" are different claims and
must never be merged. Say which one you have, per item.
