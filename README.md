# personal-config

A staged, opt-in onboarding flow for a personal Claude Code working style — commit discipline,
model-routing awareness, a docs-lookup preference, and a personal untracked
ledger/board system for multi-session work.

Nothing here applies itself. Clone it, open Claude Code inside it, and say **`start`**. Claude
will walk you through six independent pieces one at a time, explain each with a small example,
and ask (via a multiple-choice prompt) whether to adopt it as-is, adapt it, or skip it. Nothing
is written to your machine until you say yes to that specific piece.

## Usage

```bash
git clone <this-repo-url> personal-config
cd personal-config
claude
```

Then type:

```
start
```

## What it can set up

| Stage | Where it lands | What it does |
|---|---|---|
| 1. Commit discipline | `~/.claude/CLAUDE.md` (global) | Claude never runs `git commit`/`git push`; prints copy-pasteable blocks instead |
| 2. Model-routing awareness | `~/.claude/CLAUDE.md` (global) | Checks a task's assigned model before starting; delegates or hands off if it doesn't match |
| 3. Docs-lookup preference | `~/.claude/CLAUDE.md` (global) | Prefers a connected docs MCP over training memory for library/API questions |
| 4. Untracked project router | `<project>/CLAUDE.local.md` | Personal process notes for a project whose conventions aren't yours to set |
| 5. Personal ledger | `<project>/HANDOFF.md` | Dated, append-only "what is true" log so sessions stop re-deriving the same facts |
| 6. Personal task board | `<project>/PASSOFF.md` | "What's next," with standalone prompts per task for clean handoff between sessions/models |

Stages 4–6 apply to whichever project you run `start` in next — they are not specific to this
repo. Run `start` again inside any other project to set those up there too.

Every project-level file this creates is untracked by design (checked against `.gitignore` /
`.git/info/exclude` before it's written) — it is personal process, not something to commit to
the project's own repo.

## Why this exists

Written up from a real personal setup that turned out to be useful beyond its original repo:
commit discipline for running several agent sessions in one repo at once, a rule about running
the model a task actually calls for, and a lightweight ledger/board pair for keeping multi-day
or multi-agent work coherent without re-explaining context every session.
