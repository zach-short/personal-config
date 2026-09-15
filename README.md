# personal-config

A terminal wizard that sets up an agent-driven working style in your repos. It asks you a short
list of questions — how you commit, which model runs what, where work gets written down — and
writes a matching set of files: a working standard, a ledger and a board, per-language code
conventions, and the rules your coding agent reads before it touches anything. It scans each
repo first and shapes the output to what is actually there.

Nothing leaves your machine, nothing is written until you have seen the whole file tree and
confirmed it, and every run can be undone.

## Why

If you use a coding agent for anything longer than one session, you spend the first ten minutes
of every session re-explaining what you already decided. This is the set of documents that stops
that: a ledger of what is true, a board of what is next, and one standard describing how work
gets scoped, sized, handed off and closed out. The documents are the point; this tool just
writes the first draft of them, correctly, for your repo.

## Requirements

[Bun](https://bun.sh) 1.2 or newer. That is all — Bun runs the TypeScript directly, so there is
no build step.

```bash
git clone https://github.com/zach-short/personal-config
cd personal-config
bun install
bun run setup
```

Optionally `bun link` to get `personal-config` on your `PATH`.

## What it asks

Each question is one line with a practical example beside every option, the recommended one
first. The last option is always **`Read more…`**, which prints the long form — what the option
means, the honest argument *against* it, what it writes, and how to undo it — and then asks
again. Those long forms live in [`docs/choices/`](docs/choices) and are worth reading even if
you never run the tool.

In four phases:

| Phase | Asks about |
|---|---|
| **you** | Who runs `git commit`. Attribution trailers. Your three model tiers and what happens when a task names one you are not running. A docs-lookup tool. Hooks and skills. |
| **discover** | Where your repos are; then per repo: how work arrives, whether these files are committed or private, where closed work goes, and whether one person decides here. |
| **practices** | Fourteen areas — comments, function length, exports, file naming, imports, types, logic placement, the data layer, loading/error/empty states, design tokens, tests, user-facing copy, drive-by fixes, commits. |
| **render** | Nothing. It previews, you confirm, it writes. |

It only asks what a **human** knows. What the *repo* knows — the gate commands, the gates that
lie, the directory map, the hazards — it does not guess at. Instead it writes
`<repo>/PART0-PROMPT.md` and copies it to your clipboard, for you to paste into a fresh agent
session in that repo.

## What it writes

| File | Where | What it is |
|---|---|---|
| `commits.md`, `model-routing.md`, `docs-lookup.md` | `~/.claude/rules/` | One file per rule. Your own `~/.claude/CLAUDE.md` is **never** edited. |
| `SKILL.md` ×4 | `~/.claude/skills/` | `/close-out`, `/scope`, `/passoff`, `/handoff` |
| `commit-guard.sh`, `session-banner.sh` | `~/.claude/hooks/personal-config/` | Optional. Merged into `settings.json`, never overwritten. |
| `CLAUDE.md` *or* `CLAUDE.local.md` | repo root | The router every session reads |
| `HANDOFF.md`, `PASSOFF.md` | repo root | The ledger and the board |
| `docs/AGENT-PRACTICES.md` | repo | The working standard, placeholders filled |
| `docs/conventions-<lang>.md` | repo | One per language actually found |
| `INDEX.md` | your archive directory | Seed for closed work |
| `PART0-PROMPT.md` | repo root | The prompt that finishes the job |
| `.personal-config.json` | repo root | Your answers, so a re-run is deterministic |

See [`examples/`](examples) for a filled ledger, board, archive index and Part 0 prompt from a
fictional repo — that is what these look like after a few weeks of real use.

## The control guarantees

- **Preview.** Every run prints the full file tree and a per-file diff before writing anything.
- **One confirm** for the batch, with a per-file expansion if you want it.
- **`--dry-run`** writes nothing at all.
- **Backups.** Anything overwritten is copied to `~/.config/personal-config/backups/<timestamp>/`
  with a manifest, and `personal-config undo` restores the last run.
- **An interrupted run is picked up, not re-typed.** Each answer is written to
  `~/.config/personal-config/run.json` as you give it, so `Ctrl+C` on question twenty costs you
  that one question rather than the nineteen behind it. The next `setup` offers to resume, and
  says how many answers it found and when. Decline and the file is deleted; finish a run and it
  is deleted too. It is a scratch file, not your saved config — nothing in it becomes a default
  until a run completes.
- **Re-running replaces what the tool wrote and touches nothing else.** Every generated file
  carries a stamp naming the version, the date, a hash of your answers, and the standard
  version. Files without that stamp are not this tool's to overwrite.
- **Nothing leaves your machine.** The only network call in the whole program is `gh api user`,
  to find out your GitHub login, and only if `gh` is installed.

### The ownership guard

If a repo's `origin` remote is owned by somebody else, the tool **will not offer** to write a
tracked rule file into it. It switches to untracked mode and uses `.git/info/exclude` rather
than editing the repo's own `.gitignore`. A course fork or a client repo is not yours to
configure, and that should not depend on you remembering to decline.

## `doctor`

```bash
bun run doctor            # this directory
bun run doctor ~/code/app # or any path
```

Checks what the documents claim against what is there, reporting `file:line` and exiting 1 on
any finding: relative dates where an absolute one belongs; leftover `{{placeholders}}`;
duplicate or non-contiguous ledger step numbers; a board's `DONE` that does not point at a
ledger step, `HELD` with nothing to wait on, `SUPERSEDED` with no replacement; archive entries
whose folder is missing and folders missing from the index; in-tree citations of a path that has
moved to the archive; a generated file whose stamp no longer matches your answers; and personal
files that git can still see.

## Profiles

A profile is a JSON file of default answers. `--profile <name>` reads `profiles/<name>.json`.

```bash
bun run setup --profile starter --yes --dry-run
```

To write your own, copy [`profiles/starter.json`](profiles/starter.json) and change the answers.
They merge, lowest precedence first:

```
starter  →  --profile <name>  →  ~/.config/personal-config/config.json  →  <repo>/.personal-config.json  →  CLI flags
```

A profile is a *default provider*, which is why `--profile` sits below the files: an answer you
have already saved outranks the profile that suggested it.

## Uninstall

```bash
personal-config undo    # restore whatever the last run overwrote
```

Then delete what you no longer want: `~/.claude/rules/{commits,model-routing,docs-lookup}.md`,
the four directories under `~/.claude/skills/`, `~/.claude/hooks/personal-config/`, and the
generated files in each repo. Remove the `hooks` entries from `~/.claude/settings.json` if you
installed them. There is no daemon, no global state beyond `~/.config/personal-config/`
(your saved answers, the backups, and `run.json` if a run was interrupted), and nothing that
runs unless you run it.

## A note on agent memory

This tool does not generate memory files. Memory is per-person and per-harness — anything a
second person or a second tool would need is not memory, it belongs in the repo. The standard's
Part 10 describes how to keep one if your harness offers it.

## License

MIT — see [LICENSE](LICENSE).
