# The model tiers — three, and an optional fourth

## What this is

Names for models you already have access to, so that a task can say which one should run it
without naming a specific release that will be obsolete in six months.

- **Deep** — the strongest reasoning model you have.
- **Default** — your everyday model.
- **Mechanical** — your fastest, cheapest model.
- **Light** — narrower still, for work you can check the moment it lands. **Optional:** you are
  asked whether you want this tier at all, and the answer defaults to no.

## How to choose which work gets which

**The discriminator is: can the failure be silent?** Not how big or how scary the work feels.
Sizing by fear over-assigns the expensive tier and teaches you to ignore the label.

- **Deep** is for work where a mistake compiles, passes every gate, and is wrong in production:
  money paths, sync and merge rules, a notification that must never send. Prefer **one narrow
  Deep review of a short load-bearing path** over a whole Deep phase.
- **Default** is the right answer for most work — anything where failure is loud. A build
  break, a red gate, a wrong screen. The gates do that reasoning for you.
- **Mechanical** is for whole phases that are genuinely mechanical: close-out sweeps, ratchet
  edits, doc reconciliation. Escalate the moment a gate fails for a non-obvious reason.
- **Light**, if you take it, is for one narrow step whose result you can check immediately: a
  read-only report, a single bounded transform you verify afterwards, a format conversion.

### A worked example — where one person draws the Mechanical/Light line

One reader of this file runs Light for work on configuration files, on a single test: *can I tell
immediately, without running the system, that it went wrong?* Validating config syntax, grepping
for a pattern across files, generating a state report, linting against a schema, diffing two
versions, a single bounded rename verified by a follow-up grep, normalizing format and
indentation, syncing files that are meant to stay identical, converting between formats with
validation on the far side — each of those either reads, or produces something whose correctness
is visible on the face of the output.

Explicitly **not** Light, for the same person: modifying configuration that is actually in use
without a verification step, a multi-step migration where the intermediate state matters, deciding
which of two values is the correct one, and refactoring logic that depends on intent. Those are
Mechanical or above — not because they are large, but because a wrong answer sits there looking
right. This is one person's worked example, not a rule the tool enforces; the tiers themselves
have no opinion about configuration files.

## Why the tier also changes the size of the work

A Deep session has roughly half an ordinary session's usable context before it starts
compacting. So assigning Deep does not just change who does the work — it means the work has to
be cut smaller. That is another reason to prefer one narrow Deep review to a whole Deep phase.

## The argument against having tiers at all

If you only ever use one model, this is a handful of questions and a table for nothing, and the
rule that checks a task's assigned model will never fire. Answer with the same model every time,
or skip the routing rule — both are reasonable.

**And the argument against the fourth tier in particular:** Mechanical is already defined as your
fastest, cheapest model, so Light is a second cheap model separated from it only by a judgement
call — "could I tell immediately?" — that you have to keep making correctly for the split to pay.
Get it wrong and you have moved work that needed a gate onto the model least likely to notice it,
which is strictly worse than leaving that work in Mechanical. That is why the answer defaults to
no: three tiers is the honest default, and a fourth earns its keep only if you can already name
the work that belongs in it.

## What it writes and where

**The Deep and Mechanical tiers are asked only if you take the whole method**, and **Light is
asked only if you say yes to it, on that same whole method.** A lighter setup writes one model
rather than several and no `model-routing.md` at all, so those answers would have nowhere to go.
The Default tier is asked on every setup, light and full alike, because the shorter standard
names one model and that is the one it names.

`~/.claude/rules/model-routing.md` carries the table — three rows, or four where you opted into
Light. Generated boards and pass-off prompts use the Default tier's name in their `**Model:**`
headers.

## How to undo it

Delete `~/.claude/rules/model-routing.md`.

To drop Light alone and keep the other three, answer no the next time you are asked whether you
want it: the table goes back to three rows, and the model name you gave Light is simply not
rendered. Nothing else in the file changes.
