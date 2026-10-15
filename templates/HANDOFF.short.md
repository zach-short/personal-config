# HANDOFF: {{PROJECT_NAME}} (the ledger)

**What is true.** Read in full, every session. Standing sections are edited in place; the log is
one line per event and is folded after 90 days. Started {{DATE}}.

## Orientation

<!-- One paragraph: what this work is, who decides things, what they already know, and that they
     are interactive: ask when a decision is theirs. -->

Read in this order: this file, then `{{BOARD_FILE}}` (what is next), then your item's own file
in `{{ITEMS_DIR}}/`, then `{{STANDARD_PATH}}` (the working standard), then `{{ROUTER_FILE}}`.

## How things are here

<!-- Dated facts, checked rather than assumed: which tools are used, where the files live, what
     the agent cannot see or do from here and what it does instead. -->

| Fact | Value | Source (checked {{DATE}}) |
|---|---|---|
| What proves work here is sound | {{PROOF_LINE}} | the owner |{{OFF_LIMITS_ROW}}
| Where the files live | | |
| Tools in use | | |

**What an agent cannot check from here.** <!-- a bank statement, a person's approval, a printed
copy, and what the session does instead, usually: end by saying exactly what to check and what
should be true, then wait. -->

## Settled

<!-- One section per topic, dated, stating what was decided. Do not re-ask anything recorded
     here. A change to one of these is a dated supersession naming what it replaces, never a
     quiet reversal. -->

### {{DATE}}: <topic>

## Known facts and quirks

<!-- Things learned the hard way, with their source, including anything that disproves what a
     document claims. Name the file and line it corrects, and leave the wrong claim findable and
     marked wrong rather than deleting it. -->

## Log

One line per event, unnumbered, oldest first, each ending in a pointer. Closing an item writes
`- <date> · closed item <n>`, citing the item by its number only: its file is found by the
number, live or in the archive. Work that is not an item writes one line ending in a path. What
the work changed, and how the proof line was applied, goes in the item file's close-out, not
here. Lines older than 90 days are folded to the archive (`personal-config fold ledger`).
