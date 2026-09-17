# Whether your agent acts, or checks first

## What this is

What an agent should do when it reaches something the task did not settle. Two shapes of the
same session: one makes a reasonable call and keeps going, telling you afterwards what it
decided; the other stops and asks before doing anything it is not sure about.

The answer becomes an output style in the generated `~/.claude/settings.json`. It is a question
rather than a default because it changes how your agent behaves in every session you ever run —
which is exactly the class of thing that should carry an argument against it rather than being
chosen for you silently.

**Status, 2026-09-17.** Both halves are in place: the question is asked, and the answer is
written. "Check first" still produces the file it always did — it writes no output style at all,
because an absent one is the harness's own default and there is no documented style name that
means "ask first" to write instead. So the recommended answer is still exactly what this tool
did before the question existed.

## The options

**Check first.** *Recommended, because it is what your agent already does with no key set.*

*The defense.* An agent that asks is an agent whose mistakes are cheap. You see the fork before
it is taken rather than reading about it in a summary afterwards, and on work where a wrong turn
is expensive to unwind — anything touching money, published output, or other people's files —
that is worth several interruptions. It is also the behaviour every other default here is tuned
around: the confirm before writing, the preview of every file, the commit ritual that prints
commands rather than running them.

*The strongest argument against it.* It is the documented cause of the complaint people
actually have, which is an agent that replies with a plan instead of doing the work, or stops
half way to ask whether to continue. If you have to answer four questions to get one file
edited, the tool is spending your attention to avoid spending its own judgement.

**Act.** *Makes reasonable calls and keeps going.*

*The defense.* Most forks in a well-scoped task have an obvious answer, and a session that takes
it and reports what it took is strictly faster than one that asks. Where the work is reversible
and previewed — which is nearly all of it here — the cost of a wrong call is one correction,
against a cost of one interruption per question for the whole session.

*The strongest argument against it.* "Reasonable" is the agent's judgement, not yours, and you
find out what it thought was reasonable after the fact. On anything where the failure is quiet
rather than loud, that is the wrong trade: the call that compiles, passes every check and is
wrong is exactly the one you wanted to be asked about.

## What it writes and where

**Act** writes one key into `~/.claude/settings.json`:

```json
"outputStyle": "Proactive"
```

**Check first** writes nothing at all — no key, no second style name. That is deliberate rather
than unfinished: an absent `outputStyle` *is* the default behaviour, so writing a value for the
recommended answer would change how every session behaves for everyone who re-runs the wizard
and answers the way they always had. It would also mean inventing a style name the
documentation does not have.

The key goes in by the same **merge** every hook entry uses — never an overwrite — so an
`outputStyle` you set yourself is replaced only when you answer this question, and everything
else in the file is preserved. The merge is shown as a diff, confirmed on its own, and the
previous file is backed up.

It applies to every session on your machine, not to one repo: `~/.claude/settings.json` is the
user-level file. And it is independent of permission mode — an agent in `plan` mode still plans,
whichever answer you give here, because that is a different setting doing a different job.

## How to undo it

`personal-config undo` restores the previous `settings.json` after an accepted run. Or run
`personal-config setup` again and answer the other way, or open `~/.claude/settings.json` and
delete the `"outputStyle"` line by hand — it is one key, and removing it returns your agent to
its default behaviour.
