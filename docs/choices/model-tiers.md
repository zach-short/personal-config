# The three model tiers

## What this is

Three names for models you already have access to, so that a task can say which one should run
it without naming a specific release that will be obsolete in six months.

- **Deep** — the strongest reasoning model you have.
- **Default** — your everyday model.
- **Mechanical** — your fastest, cheapest model.

## How to choose which work gets which

**The discriminator is: can the failure be silent?** Not how big or how scary the work feels.
Sizing by fear over-assigns the expensive tier and teaches you to ignore the label.

- **Deep** is for work where a mistake compiles, passes every gate, and is wrong in production:
  money paths, sync and merge rules, a notification that must never send. Prefer **one narrow
  Deep review of a short load-bearing path** over a whole Deep phase.
- **Default** is the right answer for most work — anything where failure is loud. A build
  break, a red gate, a wrong screen. The gates do that reasoning for you.
- **Mechanical** is for whole phases that are genuinely mechanical: close-out sweeps, a bounded
  rename, doc reconciliation. Escalate the moment a gate fails for a non-obvious reason.

## Why the tier also changes the size of the work

A Deep session has roughly half an ordinary session's usable context before it starts
compacting. So assigning Deep does not just change who does the work — it means the work has to
be cut smaller. That is another reason to prefer one narrow Deep review to a whole Deep phase.

## The argument against having tiers at all

If you only ever use one model, this is three questions and a table for nothing, and the rule
that checks a task's assigned model will never fire. Answer with the same model three times, or
skip the routing rule — both are reasonable.

## What it writes and where

**The Deep and Mechanical tiers are asked only if you take the whole method.** A lighter setup
writes one model rather than three and no `model-routing.md` at all, so those two answers would
have nowhere to go. The Default tier is asked on every setup, light and full alike, because the
shorter standard names one model and that is the one it names.

`~/.claude/rules/model-routing.md` carries the table. Generated boards and pass-off prompts use
the Default tier's name in their `**Model:**` headers.

## How to undo it

Delete `~/.claude/rules/model-routing.md`.
