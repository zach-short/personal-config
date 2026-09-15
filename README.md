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
first. Below the real options sits **`Read more…`**, which prints the long form — what the
option means, the honest argument *against* it, what it writes, and how to undo it — and then
asks again. Those long forms live in [`docs/choices/`](docs/choices) and are worth reading even
if you never run the tool.

Below that, on every question but the first of a phase, sits **`← back`**: it drops the answer
you are on and re-asks the one before it, as many times as you like. A question you return to
shows what you picked last time, so walking forward again is a row of Enters.

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
- **A wrong answer is fixable in place.** `← back` re-asks the previous question rather than
  making you finish the run and start another — and the correction *replaces* the answer it
  corrects, so an interrupted run picks up the answer you meant rather than the one you fixed.
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

## `passoff`, `handoff` and `archive`

Three commands for the rituals the standard asks for at the start and the end of a piece of
work — the parts people skip because they are fiddly, not because they are unimportant.

```bash
bun run src/cli.ts passoff next        # the next OPEN item, with its prompt
bun run src/cli.ts passoff claim 5     # take it: IN FLIGHT, dated
```

`next` prints the first `OPEN` row on the board, its model and lane, and the standalone prompt
written under it — and warns when an item already `IN FLIGHT` owns one of the same files, which
is the collision check the "Files it owns" column exists for. `claim` marks the row `IN FLIGHT`
and dates it in the item's own section, because the status cell may hold only the words the
standard allows. It shows both edits, backs the file up, and refuses if the board changed while
it was reading it — nothing locks that file, and every parallel session reads it.

```bash
bun run src/cli.ts handoff step
```

Reports the next free ledger step number **by reading the ledger**, which is the rule, plus the
file's modification time and a scaffold of what a step has to name. It reports rather than
reserves, and says so: reserving means writing, and the only thing there is to write at that
point is an empty step.

```bash
bun run src/cli.ts archive <slug>          # plan it
bun run src/cli.ts archive <slug> --move   # and perform the move
```

Part 7's archiving steps: it greps every tracked file for referrers and splits them into the
ones read at runtime (which block the move) and the ones that are prose citations (which will
just point at nothing); checks the folder is committed in its final state, printing the two
commit blocks when it is not; prints the `git mv`; verifies every file arrived; then writes the
archive index line and marks the doc's line in your docs index. The two index lines are written
only once the folder is actually in the archive — a line pointing at a folder that is not there
is worse than no line at all — so the shape is: run it, move it, run it again. `--move` does
both halves. `<slug>` is a folder under `docs/incomplete/` or any path in the repo, so it serves
a project-folder repo and a ledger-and-board one alike.

## `worktree` and `context`

Two commands for running several agent sessions against one repo at once, which is what the
standard's Part 6 is about.

```bash
bun run src/cli.ts worktree <lane>
```

Prints where that lane's worktree goes and the **fresh-checkout recipe** that has to run inside
it — the install, the gitignored files to copy in, whatever your repo needs — read out of the
adapted standard that `setup` wrote. A fresh checkout fails its gates for environmental reasons
before it fails a real one, and the `git worktree add` line is not the part anyone forgets. It
prints rather than performs: a half-made checkout is the state this is meant to prevent, and
`undo` cannot reach a worktree. Set `worktreePath` in `.personal-config.json` (`<repo>` and
`<lane>` are substituted) if your worktrees do not live beside the checkout; the default is
`../<repo>-<lane>`.

```bash
bun run src/cli.ts context --sentinel "a phrase from this conversation"
```

Prints the current session's context size, which the agent harness records and the agent itself
cannot see — the first signal of an overrun is auto-compaction, by which point it is working
from a summary of its own reasoning. `--sentinel` is required rather than convenient: when two
sessions share a repo, picking the newest transcript by modification time reports the other
session's size as yours. If nothing matches, it lists the candidates instead of guessing.

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
