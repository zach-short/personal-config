# Preferring live docs over training memory

## What this is

A rule telling the agent to look a library's API up in a connected documentation tool rather
than recalling it, whenever the question is about a specific library, framework, SDK, CLI or
cloud service.

## Why it exists

A model's knowledge of a library is frozen at its training cutoff, and it does not feel frozen
from the inside — the wrong answer arrives with the same confidence as the right one. The
failure mode is specific and expensive: an option that was renamed, a method that moved, a
config key that now lives somewhere else. You lose the time twice, once writing it and once
debugging it.

## The options

**Name a connected docs tool.** *Recommended if you have one.* The rule then names that tool and
tells the agent to reach for it first, one concept per query, using your full question rather
than keywords.

*The strongest argument against it.* A lookup costs a round trip and some context on every
library question, including the ones the model would have got right. And if the tool is not
actually connected in a given session, a rule that assumes it is can send the agent hunting for
something that is not there — which is why the generated rule says explicitly what to do when
the tool is absent: say so, and fall back to the installed package's own README under
`node_modules/` or its equivalent. Never answer silently from memory.

**`none`.** No rule is written. Choose this if you have no docs MCP connected; you can re-run
`setup` later when you do.

## What it writes and where

`~/.claude/rules/docs-lookup.md`, naming the tool you gave.

**Asked for code work only.** The rule is entirely about library and framework APIs, so a
non-code setup is not asked it at all. Weight makes no difference: a lighter code setup still
gets the rule, because looking a version up costs nothing to follow.

## How to undo it

Delete `~/.claude/rules/docs-lookup.md`.
