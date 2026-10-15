# HANDOFF: {{PROJECT_NAME}} (the ledger)

**What is true.** Read in full, every session. Standing sections are edited in place; the log is
one line per event and is folded after 90 days. Started {{DATE}}.

## Orientation

<!-- One paragraph: what this project is, who decides things, what they know, and that they are
     interactive: ask when a decision is theirs. Then the read-first list, in order. -->

Read in this order: this file, then `{{BOARD_FILE}}` (what is next), then your item's own file
in `{{ITEMS_DIR}}/`, then `{{STANDARD_PATH}}` (the working standard) by heading, then
`{{ROUTER_FILE}}`.

## Environment

<!-- Dated facts, verified not assumed. Every command here was run before it was written down:
     a gate command in a doc that has never been run in this repo is a trap for every session
     after you. State plainly what an agent cannot verify here, and what to do instead. -->

| Fact | Value | Source (verified {{DATE}}) |
|---|---|---|
| Build | | |
| Test | | |
| Lint | | |
| Typecheck | | |

**What an agent cannot verify here.** <!-- a device, an external service, a paid API, and
what the session does instead, which is usually: end with exactly what to tap and what should
appear, then wait. -->

## Settled

<!-- One section per topic, dated, stating what the product IS. Do not re-ask anything
     recorded here. A change to one of these is a dated supersession naming what it replaces,
     never a quiet reversal. -->

### {{DATE}}: <topic>

## Code map

<!-- Where things live, one line each. The session that adds a file adds its line. -->

## Invariants

<!-- "How X works: do not break these." The rules that compile fine when broken. -->

## Known facts and quirks

<!-- Platform behaviour learned the hard way, with citations, including anything that
     disproves what a doc or rule file claims. Cite the file and line it corrects, and leave
     the wrong claim findable and marked wrong rather than deleting it. -->

## Log

One line per event, unnumbered, oldest first, each ending in a pointer. Closing an item writes
`- <date> · closed item <n>`, citing the item by its number only: its file is found by the
number, live or in the archive. Work that is not an item (a scope session that built nothing, a
fix the owner asked for in chat) writes one line ending in a path. What the work changed goes in
the item file's close-out, not here. Lines older than 90 days are folded to the archive
(`personal-config fold ledger`).

## Style rules

The code standard for this repo is {{CONVENTIONS_NOTE}}. Where a formatter or linter settles
something, the config is the rule and this section says nothing.
