# HANDOFF — {{PROJECT_NAME}} (the ledger)

**What is true.** Read first, every session. Append-only in the step log; standing sections are
edited in place when they go stale. Started {{DATE}}.

## Orientation

<!-- One paragraph: what this project is, who decides things, what they know, and that they are
     interactive — ask when a decision is theirs. Then the read-first list, in order. -->

Read in this order: this file → `{{BOARD_FILE}}` (what is next) → `{{STANDARD_PATH}}` (the
working standard) → `{{ROUTER_FILE}}`.

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

**What an agent cannot verify here.** <!-- a device, an external service, a paid API — and
what the session does instead, which is usually: end with exactly what to tap and what should
appear, then wait. -->

## Settled

<!-- One section per topic, dated, stating what the product IS. Do not re-ask anything
     recorded here. A change to one of these is a dated supersession naming what it replaces,
     never a quiet reversal. -->

### {{DATE}} — <topic>

## Code map

<!-- Where things live, one line each. The session that adds a file adds its line. -->

## Invariants

<!-- "How X works — do not break these." The rules that compile fine when broken. -->

## Known facts and quirks

<!-- Platform behaviour learned the hard way, with citations — including anything that
     disproves what a doc or rule file claims. Cite the file and line it corrects, and leave
     the wrong claim findable and marked wrong rather than deleting it. -->

## Step log

Numbered, append-only. **Take the next free number by reading this file**, not from a number
written anywhere else — another session may have taken it. **Do not edit a step you did not
write**; append a correction as a new step.

Old steps are folded out to the archive and keep their number, title and date as one line
(`personal-config fold ledger`). A step is addressable forever — "step 24" is how everything
refers to that work — so the line stays even when the body goes. Standing sections
above are never folded; they are edited in place.

**1. <!-- Title. -->** Done {{DATE}}, on branch `<branch>`. <!-- What changed, why, what is now
fixed, which questions it answered. --> **Left owed:** <!-- what the next session inherits. -->

## Style rules

The code standard for this repo is {{CONVENTIONS_NOTE}}. Where a formatter or linter settles
something, the config is the rule and this section says nothing.
