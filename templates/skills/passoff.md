---
name: passoff
description: Write the next session's first message as a standalone pass-off prompt. Use when handing work to a fresh session or a different model, when adding an item to the board, or when the user says "write the handoff", "pass this off", or "next session".
---

# /passoff

**The single highest-leverage artifact there is.** The next agent will not see this
conversation, this reasoning, or this context. A prompt that assumes any of it produces a
session that rediscovers what you already knew.

Nine parts, in this order. Skip one only when it is genuinely empty, and say so.

1. **Title.** Imperative, naming the change, not the area. *"Drag the week grid: windows edited
   where they are drawn"*, not *"week grid work"*.
2. **The header line.** `**Model: <tier>. Lane <X>. Waits on <what>.**` Plus the worktree
   instruction when the item needs its own.
3. **Orientation.** Who they are picking up, what to read first and in what order, and the
   session rules restated **inline** — not by reference. A prompt is pasted alone, and a rule
   one file away is a rule that does not arrive.
4. **Why this exists**, in product terms. This is what lets the next agent make a hundred small
   judgment calls the prompt does not cover.
5. **What is fixed.** *"Read these before changing anything; do not relitigate them."* The
   verified facts with citations, the invariants, the house precedent to copy rather than
   reinvent, the constraint that makes this smaller than it looks. This section is where this
   session's reading is **banked** instead of re-paid.
6. **Do these, in order.** Numbered, each carrying its reason and its constraint. A step that
   says only what to do gets done differently than intended.
7. **Ask before building.** The named decisions that are the owner's, each with what makes it a
   real question. Say explicitly that both are their calls, and that either answer may be no.
8. **Not in scope, whoever asks.** The negative list, named. It survives a persuasive
   mid-session argument in a way that an unstated boundary does not.
9. **Hand back.** The literal gate commands that must be green, what the owner should do and
   see, and the commit step.

**A prompt rots the moment it is executed.** The ledger step is the truth; the prompt is the
ask. Never paste a prompt marked done — a fresh session would build it again.
