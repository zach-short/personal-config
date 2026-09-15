# Run the model the task asks for

**Before starting any task that names a model, check your own model against it.** Tasks are
sometimes assigned a model on purpose — a board's Model column, a pass-off prompt's
`**Model: X**` line, a skill or doc that names one. The assignment is a deliberate choice, not
a preference, so running the wrong model on it silently is the failure it exists to prevent.

Do this check **first** — before reading the codebase, before planning, before writing
anything. If they match, say so in one line and carry on. If they do not, pick one of these
two, never a third:

1. **Delegate it, in session.** Spawn a subagent with the model parameter set to the assigned
   model and hand it the whole prompt. This file is the authorization to do that without
   asking first. Relay what comes back. Where the harness can switch the session's own model
   instead, that is fine too when the whole session should change.
2. **Stop and hand it off.** Do not start the work. Write a pass-off prompt carrying everything
   this session has already established — what was read, what was decided, what was ruled out
   and why, and any files already touched — say plainly which model it is for and why, and
   tell the user to run it there.

Prefer 1 when the task is self-contained; prefer 2 when it needs the user's decisions along the
way, or when the context already built is worth more than the work. Never do the work yourself
on the wrong model, and never quietly downgrade an assignment because the task looks small from
here — "it turned out to be simple" is a judgement only the assigned model gets to make. If an
assignment looks wrong, say so and ask; do not overrule it.
