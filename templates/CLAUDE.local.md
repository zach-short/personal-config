# {{PROJECT_NAME}} — personal router (not repo policy — untracked)

> **Before writing or editing any code, read this repo's own rules in full** — its
> `CONTRIBUTING.md`, `AGENTS.md`/`CLAUDE.md`, and any linter or style config. Not optional, not
> conditional on task size.

> **Before scoping, planning or building a feature, read `{{STANDARD_PATH}}`.** It is the
> process standard. Do not ask how the flow works; it is written down.

## Precedence

1. **The repo's own rules** — `CONTRIBUTING.md`, `AGENTS.md`/`CLAUDE.md`, linter configs, PR
   templates, any other tracked convention file.
2. **This file**, only where those are silent.
3. Nothing else.

Where 1 and 2 disagree, 1 wins and 2 is amended. **This repo's conventions are not mine to
set — never edit its own rule files to suit a personal preference.**

## Where my work is written down

- `{{LEDGER_FILE}}` — what is true here: environment, settled decisions, the step log.
- `{{BOARD_FILE}}` — what is next, one standalone prompt per item.

Both are untracked, because this repo is not mine.

## Stack

{{STACK_LINE}}

## Commands

<!-- The gates, as one-command blocks, each verified by running it — and the notes about gates
     that lie: what makes each one green when it should be red. Fill these from the Part 0
     inventory, not from memory. -->

## Environment quirks specific to my machine

<!-- Fill in as discovered: package manager and version pins, local database setup, gates that
     lie (cached commands, flaky tests), anything that cost real time to figure out. -->

## Never do this

- Commit a credential, token, or `.env` value.
- Loosen, disable, skip, or delete a check to make a gate green.
- Use an API, option, or config key not present in the installed version.
- Edit this repo's own tracked rule files.
{{COMMIT_LINE}}
