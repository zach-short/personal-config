# personal-config

A terminal wizard that sets up an agent-driven working style in your repos. It asks you a short
list of questions — how you commit, which model runs what, where work gets written down — and
writes a matching set of files: a working standard, a ledger and a board, per-language code
conventions, and the rules your coding agent reads before it touches anything. It scans each
repo first and shapes the output to what is actually there.

Nothing leaves your machine, nothing is written until you have seen the whole file tree and
confirmed it, and anything a run overwrites is backed up first — `personal-config undo` puts the
last run's files back, once.

## Why

If you use a coding agent for anything longer than one session, you spend the first ten minutes
of every session re-explaining what you already decided. This is the set of documents that stops
that: a ledger of what is true, a board of what is next, and one standard describing how work
gets scoped, sized, handed off and closed out. The documents are the point; this tool just
writes the first draft of them, correctly, for your repo.

## Requirements

[Node](https://nodejs.org) 20 or newer. Nothing else — the published package is a bundle, so
npm, pnpm and yarn all work and Bun is not needed to run it.

**Platforms.** CI runs the gates on Linux and macOS; both are supported. The optional hooks
(`commit-guard.sh`, `completion-gate.sh`, `session-banner.sh`) are bash scripts, so on Windows
you need a POSIX shell to run them — WSL or Git Bash. Everything else the wizard writes is plain
text and works anywhere Node does.

```bash
npx personal-config setup
```

`bunx personal-config setup` works the same way if you prefer Bun. Or from a clone, which is
also how you run this repo's own tests and doctor:

```bash
git clone https://github.com/zach-short/personal-config
cd personal-config
bun install
bun run setup
```

The clone is the one place Bun is required: it is the dev runtime, and `bun test`,
`bun run typecheck` and `bun run build` all go through it. Optionally `bun link` to get
`personal-config` on your `PATH`.

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
| `SKILL.md` ×4 | `~/.claude/skills/` | `/close-out`, `/scope`, `/passoff`, `/handoff` — the lighter setup installs the first and last only |
| `commit-guard.sh`, `session-banner.sh`, `completion-gate.sh` | `~/.claude/hooks/personal-config/` | Optional. Merged into `settings.json`, never overwritten. The lighter setup installs the gate alone. |
| `CLAUDE.md` *or* `CLAUDE.local.md` | repo root | The router every session reads |
| `HANDOFF.md`, `PASSOFF.md` | repo root | The ledger and the board — no board on the lighter setup |
| `docs/AGENT-PRACTICES.md` | repo | The working standard, placeholders filled — the long form for code with the whole method, the short form (under 200 lines, no Part 0) for other work or the lighter setup |
| `docs/conventions-<lang>.md` | repo | One per language actually found, for code work only |
| `INDEX.md` | your archive directory | Seed for closed work |
| `PART0-PROMPT.md` | repo root | The prompt that finishes the job — the long standard only; the short form has nothing left to fill |
| `.personal-config.json` | repo root | Your answers, so a re-run is deterministic |

See [`examples/`](examples) for a filled ledger, board, archive index and Part 0 prompt from a
fictional repo — that is what these look like after a few weeks of real use.

## The control guarantees

- **Preview.** Every run prints the full file tree and a per-file diff before writing anything.
- **One confirm** for the batch, with a per-file expansion if you want it.
- **`--dry-run`** writes nothing at all.
- **Backups.** Anything overwritten is copied to
  `~/.config/personal-config/backups/<timestamp>-<n>/` with a manifest, and `personal-config undo`
  restores the last run. The counter is there because two runs can start inside one second, and
  each needs a directory of its own.
- **`undo` is one-shot and one-way**, and says so before it acts. It lists the files it would put
  back and asks first; it restores a given backup once and refuses it after that, rather than
  applying the same files a second time over whatever you have changed since. What it does not do
  is back itself up: an edit made *after* a run is overwritten by the `undo` of that run and is
  gone. It also never deletes a file the run created new — it says which, and leaves them to you.
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
  version. A file already sitting at one of those paths without that stamp is left alone and
  named in the run's report — see below.
- **Nothing leaves your machine.** The program makes two network calls and no others:
  `gh api user`, to find out your GitHub login, and only if `gh` is installed; and the fetch
  behind `setup --from <url|id>`, which happens only when you pass that flag and sends nothing
  but the request. Your answers are never uploaded by this tool.

### The ownership guard

If a repo's `origin` remote is owned by somebody else, the tool **will not offer** to write a
tracked rule file into it. It switches to untracked mode and uses `.git/info/exclude` rather
than editing the repo's own `.gitignore`. A course fork or a client repo is not yours to
configure, and that should not depend on you remembering to decline.

### The stamp guard

A stamp is the only record that this tool wrote a file. So on a re-run, a file that is already
there and carries **no** stamp is left alone and reported — your own `CLAUDE.md`, a
`docs/conventions-ts.md` you wrote by hand, a `HANDOFF.md` that predates this tool. Nothing is
backed up, because nothing is written. Delete the file if you want it generated fresh.

A file that **does** carry the stamp is overwritten even where you have edited it. Nothing in
the stamp records the bytes that were written, so an edit to a generated file leaves no trace
the tool can read, and guessing would mean either refusing every re-run or losing your edits
silently. It does neither: the overwrite is previewed, backed up, and `personal-config undo`
puts it back.

**Deleting the stamp line is how you take a generated file back.** One line, off the top of the
file, and no re-run touches it again — and `doctor` stops asking you to re-render it, because a
file the tool will not overwrite is not one it has standing to report drift on. That is the last
step of Part 0: adaptation turns these documents into the repo's own, and a document that is the
repo's own does not keep somebody else's stamp on it.

Three writes are deliberately outside the guard, because none of them claims authorship: the
JSON merge into `settings.json`, the lines appended to an ignore file, and the in-place edits
`passoff claim` and `archive` make. All three read what is there and keep it.

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

One check reads git rather than the files: a line under a `## Settled` heading that your
uncommitted work *removes or rewrites*, with no supersession stated anywhere in that file's
diff. Adding an entry is recording a decision and is never flagged; only undoing one is. It is
silent where it cannot see — a clean tree, a directory that is not a repository, and a ledger
kept untracked all produce nothing.

```bash
bun run doctor . --fix    # apply the mechanical fixes
```

`--fix` applies only what a rule marks mechanical, which today is one thing: a personal file git
can still see gets an anchored line in your ignore file — `.gitignore` where you track this
repo's documents and `.git/info/exclude` where you do not, the same choice `setup` made, read
back rather than guessed. Everything else is reported and left alone, because a relative date, a
missing archive folder and a board row pointing at no ledger step are decisions rather than
edits. The write goes the same way every other one does: backed up before it is touched, and
`personal-config undo` puts it back. `--dry-run` says what it would append and writes nothing.
The exit code answers for what is left, so a run that fixed everything exits 0.

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
starter  →  --profile <name>  →  ~/.config/personal-config/config.json  →  <repo>/.personal-config.json  →  --from <src>  →  CLI flags
```

A profile is a *default provider*, which is why `--profile` sits below the files: an answer you
have already saved outranks the profile that suggested it.

### Starting from answers you already have

```bash
bun run setup --from ./answers.json                   # a file
bun run setup --from https://example.com/p/k3f9d2ab   # a URL
bun run setup --from k3f9d2ab                         # or just the id a site handed you
```

Three forms, told apart by shape: eight characters of `[a-z0-9]` with no `/` and no `.` is an
id, anything with a scheme is a URL, everything else is a path. An id resolves against the
`homepage` field in `package.json` as `/p/<id>` — so a fork pointed at its own site hands out
its own ids. A URL is fetched over https and nothing else, the one exception being a loopback
address — `localhost`, `127.0.0.1` or `[::1]` — for developing the site that hands out the ids.

`--from` sits *above* the saved config and the repo file, unlike `--profile`, which sits below
them. It carries answers given seconds ago, and the failure worth preventing is those losing
silently to a config saved months earlier and forgotten. The accepted cost: running it inside an
already-configured repo re-renders that repo to the new answers.

## `catalog`

```bash
bun run catalog
```

Writes `catalog.json` in the repo root: every question the wizard asks — its text, its options
with their examples, and the condition deciding whether it is asked at all — plus the long forms
from [`docs/choices/`](docs/choices), keyed by the id each question cites. Thirty-five questions
and thirty-three long forms as of `0.3.0+f322e312` — and nobody is asked all thirty-five, because
twenty-one of them carry a condition: a code setup with the whole method in git is asked
thirty-three, and someone doing other work on the lighter setup is asked fourteen.

It exists so another surface can ask the same questions without importing the wizard, which is
not browser-safe. The stamp is the package version plus a hash of the questions it was built
from, so a consumer can tell which ones it pinned, and `bun test` fails when the questions
change and the catalog was not rebuilt — a second copy of the questions is only honest if
something checks it.

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
