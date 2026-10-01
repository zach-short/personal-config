# personal-config

A terminal wizard that sets up an agent-driven working style in your repos. It asks a short list of questions (who runs `git commit`, which model runs which work, where work is written down) and writes a matching set of files: a working standard, a ledger and a board, per-language code conventions, and the rules your coding agent reads before it touches anything. It scans each repo first and shapes the output to what it finds there.

Nothing is written until you have seen the whole file tree and confirmed it, and anything a run overwrites is backed up first. `personal-config undo` puts the last run's files back, once. Your answers stay on your machine. The two network calls the tool can make are listed under the control guarantees below.

## Why

If you use a coding agent for more than one session, you spend the start of every session re-explaining what you already decided. This tool writes the documents that stop that: a ledger of what is true, a board of what is next, and one standard that describes how work is scoped, sized, handed off and closed out. The documents are the point. The tool writes a first draft of them for your repo.

## Requirements

[Node](https://nodejs.org) 20 or newer. The published package is one bundled file (`dist/cli.js`) plus one runtime dependency, `@clack/prompts`, so Bun is not needed to run it. CI installs the packed tarball with npm on Node 20, 22 and 24, on a machine with no Bun, and runs typecheck, lint, tests and `doctor` on Linux and macOS.

The hook scripts are bash, so on Windows they need WSL or Git Bash. The two guards (`commit-guard.sh` and `delete-guard.sh`) read the command with `jq` when it is installed. Without `jq` they fall back to a stricter match that can refuse more than they should. Everything else the wizard writes is plain text and works anywhere Node does.

```bash
npx personal-config setup
```

`bunx personal-config setup` works the same way. To run from a clone, which is also how you run this repo's own tests, install [Bun](https://bun.sh) 1.2.9 or newer:

```bash
git clone https://github.com/zach-short/personal-config
cd personal-config
bun install
bun run setup
```

The rest of this file writes commands as `personal-config <command>`. Without a global install, put `npx` in front, or from a clone run `bun run src/cli.ts <command>`. The commands that act on one repo read the current directory. `doctor` and `upgrade` also accept paths. `personal-config --help` lists every command and flag, and `personal-config --version` prints the installed version.

| Command | What it does |
|---|---|
| `setup` | Asks, previews, then writes |
| `doctor` | Checks what the documents claim against what is there |
| `upgrade` | Lists what changed in the standard since a repo adapted its copy |
| `undo` | Restores the files the last run overwrote |
| `passoff next`, `passoff claim <n>` | Reads the board: the next open item, and taking it |
| `handoff step` | Reports the next free ledger step number |
| `archive <slug>` | Plans the archiving steps for closed work |
| `fold` | Moves closed prompts and old step bodies to the archive |
| `worktree <lane>` | Plans a lane's worktree with its checkout recipe |
| `context --sentinel <phrase>` | Prints this session's context size |
| `catalog` | Regenerates `catalog.json`, the questions as data |

## What it asks

Each question is one line with a practical example beside every option, and the recommended option is marked. Below the options sits `Read more…`, which prints the long form and then asks again. A long form says what the option means, gives the strongest argument against it, says what it writes, and says how to undo it. The long forms live in [`docs/choices/`](docs/choices) and are worth reading even if you never run the tool.

Below that, on every choice question after the first of a phase, sits `← back`. It re-asks the previous question, and the new answer replaces the old one. A question you return to shows what you picked last time, so walking forward again is a row of Enters. Free-text questions do not offer `← back`, but you can still reach one by stepping back from the choice question after it.

The wizard runs in four phases.

| Phase | Asks about |
|---|---|
| you | Whether the work is code or something else, whether you want the whole method or a lighter setup, and whether you keep the work in git. Who runs `git commit`, and whether agent commits carry an attribution trailer. Your model tiers (three, or four if you want a narrow one below Mechanical) and what a session does when a task names a model it is not running. A docs-lookup tool. Hooks, output style and skills. What to do with rules you already have in `~/.claude`. |
| discover | Which directory holds your projects. The tool lists the git repos and plain folders one level below it, and you pick which to set up. Then, for each one: how work arrives, whether the files are committed or private, what proves work is sound, what the agent must not read (other work only), where closed work goes, whether one person decides, and the most expensive model tier the repo may run. |
| practices | Code work is asked eleven conventions: comments, function length, exports, file naming, imports, types, logic placement, the data layer, loading, error and empty states, design tokens, and tests. All work is asked who picks the words a user reads and what happens to an unrelated problem found mid-task. Other work is also asked whether the agent edits a document or shows the change first. |
| render | Nothing new. The tool previews, you confirm, it writes. |

Not every question is asked. A code setup with the whole method, kept in git, is asked thirty-five questions, and more if you cap a repo's model tier. Someone doing other work on the lighter setup is asked sixteen, or fourteen if they keep none of it in git.

The wizard asks only what a person knows. It does not guess what the repo knows: the gate commands, the gates that lie, the directory map, the hazards. For code work with the whole method it writes `<repo>/PART0-PROMPT.md` instead, and where `pbcopy` exists (macOS) it copies the prompt to your clipboard. You paste it into a fresh agent session in that repo, and that session does Part 0 of the standard, the step that adapts it to the repo.

## What it writes

| File | Where | What it is |
|---|---|---|
| `commits.md` | `~/.claude/rules/` | Commit policy and attribution. Code work kept in git only, and not written if you choose no rule. |
| `model-routing.md` | `~/.claude/rules/` | The model tier table and what a session does when a task names another model. Whole method only, and not written if you choose no rule. |
| `docs-lookup.md` | `~/.claude/rules/` | Prefer your docs tool over memory for library APIs. Code work only, and not written if you answer "none". |
| `<name>/SKILL.md` | `~/.claude/skills/` | The skills `/close-out`, `/scope`, `/passoff`, `/handoff` and `/clean-up`. The lighter setup installs `/close-out` and `/handoff`. `/clean-up` is written for code work with the whole method only. |
| `commit-guard.sh`, `delete-guard.sh`, `session-banner.sh`, `completion-gate.sh` | `~/.claude/hooks/personal-config/` | Optional hooks, merged into `~/.claude/settings.json`. See below. |
| `config.json` | `~/.config/personal-config/` | Your saved answers for all repos, so the next run opens with them. |
| `CLAUDE.md` or `CLAUDE.local.md` | repo root | The router every session reads. The `.local` name is used when the files are private. |
| `HANDOFF.md`, `PASSOFF.md` | repo root | The ledger and the board. The lighter setup writes the ledger only. An existing ledger or board is adopted under its own name. |
| `docs/incomplete/README.md` | repo | The scaffold for one folder per effort, in place of the ledger and board, when you answer that work arrives as a few large efforts. |
| `docs/AGENT-PRACTICES.md` or `AGENT-PRACTICES.local.md` | repo | The working standard. Code work with the whole method gets the long form. Other work and the lighter setup get the short form (under 200 lines, no Part 0). |
| `docs/conventions-<language>.md` | repo | One per language found (TypeScript, Go, Swift, Python or Rust), for code work only. An existing conventions file is adopted under its own name. |
| `INDEX.md` | your archive directory | The seed for closed work. Written when you name an archive directory, which only code work with the whole method is asked for. |
| `PART0-PROMPT.md` | repo root | The prompt that finishes the job. The long standard only, because the short form has nothing left to fill. |
| `.personal-config.json` | repo root | Your answers for this repo and where its files live, so a re-run is deterministic and the hooks and `doctor` can read it. |
| `.claude/settings.local.json` | repo | Written only when you cap the repo's model tier. See the tier ceiling below. |
| ignore lines | `.gitignore` or `.git/info/exclude` | Lines that keep the personal files out of git. |

Your own `~/.claude/CLAUDE.md` is never edited. Each rule is its own file in `~/.claude/rules/`.

Which hooks you get depends on the hooks answer and on your track. Answering "no hooks" writes none. Otherwise:

- The completion gate is a `Stop` hook. It refuses to end a turn while a changed source file still holds a placeholder such as "rest of the file", and then runs the gate command recorded as `gateCommand` in the repo's `.personal-config.json`. That command is empty until Part 0 or you fill it, and an empty command is skipped. It is written on every track.
- The commit guard blocks `git commit`, `git push`, `git add -A` and `git add .`. It is written for work kept in git, on the whole-method setup.
- The delete guard blocks `rm`, `rmdir` and `unlink` and asks for the file to be moved aside. It is written for work that is not code.
- The session banner prints where the ledger and standard are and the top open board row. It is written on the whole-method setup when you take the option that includes it.

The same merge into `~/.claude/settings.json` adds `outputStyle` when you answer "Act" to the output style question.

See [`examples/`](examples) for a filled ledger, board, archive index and Part 0 prompt from a fictional repo. That is what these files look like after a few weeks of real use.

## The control guarantees

- Every run prints the full file tree and offers a per-file diff before it writes anything.
- There is one confirm for the whole batch. `--yes` accepts every default and still previews and confirms. `--force` skips the confirm, which means you have read the preview.
- `--dry-run` writes nothing at all.
- Anything a run overwrites is copied to `~/.config/personal-config/backups/<timestamp>-<n>/` with a manifest. The counter exists because two runs can start inside one second, and each needs a directory of its own.
- `undo` is one-shot and one-way, and it says so before it acts. It lists the files it would put back and asks first. It restores a given backup once and refuses it afterwards, because applying the same files again would overwrite whatever you changed since. It does not back itself up, so an edit you made after a run is lost when you undo that run. It never deletes a file the run created new. It says so, and those files are yours to remove.
- A wrong answer is fixable in place. `← back` re-asks the previous question instead of making you finish the run and start another, and the correction replaces the answer it corrects, so an interrupted run resumes with the answer you meant.
- An interrupted run is picked up, not retyped. Each answer is written to `~/.config/personal-config/run.json` as you give it, so `Ctrl+C` on question twenty costs that one question. The next `setup` offers to resume and says how many answers it found and when. Decline and the file is deleted. A run that writes files, or finds nothing to write, deletes it too. A dry run or a declined preview keeps it, so a second run does not make you retype. A checkpoint from a different version is discarded. It is a scratch file and not your saved config, and nothing in it becomes a default until a run completes.
- Re-running replaces what the tool wrote and touches nothing else. Every generated file carries a stamp that names the version, the date, a hash of your answers and the standard version. A file at one of those paths without that stamp, or with one marked `adapted`, is left alone and named in the run's report.
- The program makes two network calls and no others. The first is `gh api user`, to find your GitHub login. It runs only while `setup` is choosing projects, only if `gh` is installed, and not at all when the profile already names a login. The second is the fetch behind `setup --from <url|id>`, which happens only when you pass that flag and sends nothing but the request. Your answers are never uploaded by this tool.

A stamp looks like this:

```
<!-- personal-config v0.7.0 · 2026-09-29 · config 9acfdf35 · standard v1.2.0 -->
```

### The ownership guard

The tool treats a repo as yours only when it can prove it. The owner of the `origin` remote has to match your GitHub login, which comes from `gh api user` or the `github.user` git setting. If the owner is somebody else, or if the tool cannot tell, it will not offer to write a tracked rule file into the repo. It switches to untracked mode and adds lines to `.git/info/exclude` instead of editing the repo's own `.gitignore`. A course fork or a client repo is not yours to configure, and that should not depend on you remembering to decline. A plain folder with no remote counts as yours.

### The stamp guard

A stamp is the only record that this tool wrote a file. On a re-run, a file that is already there and carries no stamp is left alone and reported: your own `CLAUDE.md`, a `docs/conventions-ts.md` you wrote by hand, a `HANDOFF.md` that predates this tool. Nothing is backed up because nothing is written. Delete the file if you want it generated fresh.

A file that does carry the stamp is overwritten even where you have edited it. The stamp does not record the bytes that were written, so an edit to a generated file leaves no trace the tool can read. Guessing would mean refusing every re-run or losing your edits without a word, and the tool does neither. The overwrite is previewed and backed up, and `personal-config undo` puts it back.

To take a generated file back, add one word to the stamp line: append ` · adapted` after the standard version, as in `standard v1.2.0 · adapted -->`. No re-run touches the file again, and `doctor` can still read where it came from. When the standard moves on, `doctor` reports that the adapted copy was made from an older one. That finding is advisory. It is printed and counted but does not change the exit code, because a standard you have not upgraded to yet is work to schedule and not a defect in the repo. Adapting is the last step of Part 0. It turns these documents into the repo's own, and a document that is the repo's own keeps its provenance and withdraws the permission.

Deleting the stamp line also works, and it is the third state. One line off the top of the file, and no re-run touches it again. `doctor` never sees the file again either, because a file the tool will not overwrite and cannot place is not one it has standing to report on. Every adaptation made before the marker existed was told to do exactly this. `doctor` finds those files by Part 0's `**Adapted to this repo <date>**` header. Under `--fix` it writes the adapted stamp back at the standard version the file's own preamble names, so `upgrade` can reach them.

Drift is decided by re-rendering, not by comparing the hash. `doctor` rebuilds what `setup` would write into the repo now, from the shape recorded in `.personal-config.json`, a fresh scan of the directory and your merged answers. It renders each file at the date its own stamp names and compares bytes. A default this package added after you ran `setup` moves the hash in every stamp and changes no byte you have, so it reports nothing. An answer that changes a rendered byte reports on exactly the files that byte is in.

Three writes are deliberately outside the guard, because none of them claims authorship: the JSON merge into `settings.json`, the lines appended to an ignore file, and the in-place edits that `passoff claim`, `fold` and `archive` make. All three read what is there and keep it.

### Per-repo tier ceiling

A repo can cap the most expensive model tier it may run, so work above the cap is delegated to a subagent. Use it on production repositories where reasoning work should be constrained, or on large projects where you want to control cost per repository.

The `tier-ceiling` question is asked in the discover phase, for code work. The options are Deep (no ceiling, the default), Default and Mechanical. When you pick Default or Mechanical, the tool:

1. Asks which model IDs stand for the tiers that stay allowed. The IDs are asked once and reused across every capped repo.
2. Writes `.claude/settings.local.json` in the repo with an `availableModels` list that caps the repo to those tiers. The file is merged into any settings already there.
3. Adds a `## Tier ceiling` clause to the repo's `CLAUDE.md`, on the whole-method setup with the `delegate-or-stop` routing answer. The clause states the cap and where to change it.
4. Makes the session-start banner print the ceiling, if the banner hook is installed.

The cap is your personal budget choice and not part of the repo's tracked policy, so a stranger who clones the repo does not inherit it. In untracked mode the tool also adds `.claude/settings.local.json` to `.git/info/exclude`.

Known limitation: Claude Code concatenates and deduplicates `availableModels` across settings files. If your global `~/.claude/settings.json` lists a Deep model, it silently undoes the repo's cap. `setup` prints a warning when it plans a ceiling and your saved answers name a Deep model. If it applies to you, remove the Deep model from your global settings.

Known bug in 0.7.0: a ceiling chosen at the prompt is recorded on the repo's plan but is not passed to the renderers, so steps 2 to 4 above do not happen. The ceiling is applied when `tierCeiling` is already an answer in a profile or a `--from` file. With `{ "answers": { "tierCeiling": "default" } }` in that file, `setup --yes --dry-run` lists `settings.local.json` in its preview.

See [`docs/choices/tier-ceiling.md`](docs/choices/tier-ceiling.md) for the full options and their trade-offs.

## `doctor`

```bash
personal-config doctor            # this directory
personal-config doctor ~/code/app # or any paths
```

`doctor` checks what the documents claim against what is there. It reports `file:line` for each finding and exits 1 on any finding, except for one advisory kind, described under the stamp guard above, which is printed and counted but does not fail the run. It checks for:

- relative dates where an absolute date belongs
- leftover `{{placeholders}}`
- a claim that something does not exist ("there is no", "nothing does") with no search command beside it
- duplicate or non-contiguous ledger step numbers
- board rows that break their status rule: `DONE` that does not point at a ledger step, `HELD` with nothing to wait on, `SUPERSEDED` with no replacement, `SETTLED AS NO` with no reason
- archive entries whose folder is missing, and folders missing from the index
- in-tree citations of a path that has moved to the archive
- a generated file that `setup` would now write differently, or whose stamp names a standard version behind the installed one (advisory where the file is adapted)
- a file Part 0 adapted that carries no stamp at all
- personal files that git can still see
- a board or ledger with more than 400 lines that `fold` could move

One more check reads git and not the files. It flags a line under a `## Settled` heading that your uncommitted work removes or rewrites, with no supersession stated anywhere in that file's diff. Adding an entry records a decision and is never flagged. Only undoing one is. The check is silent where it cannot see: a clean tree, a directory that is not a repository, and a ledger kept untracked all produce nothing.

```bash
personal-config doctor . --fix    # apply the mechanical fixes
```

`--fix` applies only what a rule marks mechanical, which is two things. A personal file that git can still see gets an anchored line in your ignore file: `.gitignore` where you track this repo's documents and `.git/info/exclude` where you do not, the same choice `setup` made, read back and not guessed. And a file with Part 0's `**Adapted to this repo <date>**` header and no stamp gets an adapted stamp at the standard version its own preamble names, or `unknown` where it names none, with every other byte kept. Everything else is reported and left alone, because a relative date, a missing archive folder and a board row that points at no ledger step are decisions and not edits. Each write is backed up first, and `personal-config undo` puts it back. `--dry-run` says what it would write and writes nothing. The exit code answers for what is left, so a run that fixed everything exits 0.

## `upgrade`

```bash
personal-config upgrade              # this directory
personal-config upgrade ~/code/app   # or any paths
personal-config upgrade . --write    # and save it as UPGRADE-PROMPT.md
```

`upgrade` is where `doctor`'s advisory finding leads. A standard that Part 0 adapted to your repo is a document an agent rewrote, so `setup` never replaces it, and a newer standard cannot be copied over it. `upgrade` reads the version from the adapted file's stamp, compares it with the standard this package installs, and prints every entry in the standard's changelog between the two, newest first. Those entries are written as instructions for a session to apply, not as release notes.

It reads nothing from the network, because the changelog ships inside the package, and it edits no adapted document. `--write` saves the same entries, with the steps for applying them, as `UPGRADE-PROMPT.md` at the repo root, for a fresh session to act on. The file is stamped, previewed, backed up and undoable like every other write, and its line is added to your ignore file. The session that applies it updates the version in the stamp, and that edit clears `doctor`'s finding.

It answers for the adapted standard only. A standard that `setup` wrote and nobody adapted is brought up to date by re-running `setup`, and `doctor` reports every generated file a re-run would change. Where there is no adapted standard, `upgrade` prints one line saying why and exits 0. That covers a setup that uses the short standard (other work, or the lighter setup), a repo never set up, and a copy adapted before the marker existed, which `doctor --fix` stamps first. Being behind also exits 0, because it is work to schedule. A stamp newer than the installed standard exits 1. It means this copy of the tool is out of date, and reading the changelog backwards would tell you to undo a change.

Upgrading the CLI itself is npm's job, but `npx personal-config` can run a copy it already cached instead of the one just published. If a stamp reports newer than installed when it should not, rule out that stale cache first by running `npx personal-config@latest upgrade` (or `@latest setup`) to force the current release.

## `passoff`, `handoff`, `archive` and `fold`

These four commands cover the rituals the standard asks for at the start and the end of a piece of work. Those rituals are fiddly, and the commands take on the fiddly parts.

```bash
personal-config passoff next        # the next OPEN item, with its prompt
personal-config passoff claim 5     # take it: IN FLIGHT, dated
```

`next` prints the first `OPEN` row on the board, its model and lane, and the standalone prompt written under it. It warns when an item already `IN FLIGHT` owns one of the same files, which is the collision check the "Files it owns" column exists for. `claim` marks the row `IN FLIGHT` and dates it in the item's own section, because the status cell may hold only the words the standard allows. It shows both edits, backs the file up, and refuses if the board changed while it was reading it, since nothing locks that file and every parallel session reads it.

```bash
personal-config handoff step
```

This reports the next free ledger step number by reading the ledger, which is the rule. It also prints the file's modification time and a scaffold of what a step has to name. It reports and does not reserve, and it says so. Reserving means writing, and the only thing there is to write at that point is an empty step.

```bash
personal-config archive <slug>          # plan it
personal-config archive <slug> --move   # and perform the move
```

This runs Part 7's archiving steps. It greps every tracked file for referrers and splits them into the ones read at runtime, which block the move, and the prose citations, which will point at nothing afterwards. It checks that the folder is committed in its final state and prints the two commit blocks when it is not. It prints the `git mv`, verifies that every file arrived, and then writes the archive index line and marks the doc's line in your docs index. The two index lines are written only once the folder is in the archive, because a line pointing at a folder that is not there is worse than no line. So the shape is: run it, move it, run it again. `--move` does both halves. `<slug>` is a folder under `docs/incomplete/` or any path in the repo, so it serves a project-folder repo and a ledger-and-board one alike.

```bash
personal-config fold                 # both halves, preview first
personal-config fold board           # just the closed prompts
personal-config fold ledger --keep 30
```

This is Part 7's other half, for a ledger and a board. Both files only grow, and the ledger is read in full at the start of every session, so their size is a context-budget problem.

`fold` moves the two things the standard already calls dead. A `DONE` item's prompt goes to `PASSOFF-closed.md` in your archive directory. Its row stays, with its pointer at the ledger step, and so does every `SUPERSEDED` and `SETTLED AS NO` section, because the replacement and the reason are written nowhere else. Ledger step bodies older than the newest `--keep` (20 by default) go to `HANDOFF-log.md`, and each step keeps its number, title and date as one line. A step is cited forever, so dropping the number would break every `DONE` row on the board that cites it and hand the next session a number the log had already spent. Standing sections are never touched. The two archive files are named after your board and ledger files.

It appends to the archive, reads it back to check that every block arrived, and only then cuts. That order matters because a ledger and a board are usually untracked, so git holds no copy of what is about to go. Both writes are backed up, `personal-config undo` restores the live documents, and folding again appends nothing the archive already holds.

## `worktree` and `context`

These two commands support running several agent sessions against one repo at once, which is what Part 6 of the standard covers.

```bash
personal-config worktree <lane>
```

It prints where that lane's worktree goes and the fresh-checkout recipe that has to run inside it: the install, the gitignored files to copy in, and whatever else your repo needs. The recipe is read from the adapted standard that `setup` wrote. A fresh checkout fails its gates for environmental reasons before it fails a real one, and the `git worktree add` line is not the part anyone forgets. The command prints and does not perform, because a half-made checkout is the state it is meant to prevent, and `undo` cannot reach a worktree. Set `worktreePath` in `.personal-config.json` (`<repo>` and `<lane>` are substituted) if your worktrees do not live beside the checkout. The default is `../<repo>-<lane>`.

```bash
personal-config context --sentinel "a phrase from this conversation"
```

It prints the current session's context size, read from the session transcript under `~/.claude/projects/`. The program that runs the agent records that size, and the agent itself cannot see it. The first signal of an overrun is auto-compaction, and by then the agent is working from a summary of its own reasoning. `--sentinel` is required because two sessions can share a repo, and picking the newest transcript by modification time would report the other session's size as yours. If nothing matches, the command lists the candidates and does not guess.

## Profiles

A profile is a JSON file of default answers. `--profile <name>` reads `profiles/<name>.json`.

```bash
personal-config setup --profile starter --yes --dry-run --projects-dir ~/code
```

`--yes` configures every project it finds under the projects directory, so point `--projects-dir` at a directory you mean to set up. Three profiles ship in `profiles/`:

- `starter` is the default. It is the whole method for code work in git, with the recommended answers except that it installs no workflow skills and names no docs tool.
- `pro` is for someone new to coding on a small usage budget: the lighter setup on a single model, no Deep tier, no skills, no docs tool, and no code-standard rules beyond comments and drive-by fixes. The 0.7.0 changelog measures about 18 KB of session-start documents on the Go test fixture against 73 KB for `starter`. Raise any of those answers when you want the rule back.
- `zach` is the maintainer's own profile, with his model names, GitHub login, docs tool and archive path.

```bash
personal-config setup --profile pro
```

To write your own, copy [`profiles/starter.json`](profiles/starter.json) and change the answers. The layers merge in this order, lowest precedence first:

```
starter  →  --profile <name>  →  ~/.config/personal-config/config.json  →  <repo>/.personal-config.json  →  --from <src>  →  CLI flags
```

A profile is a default provider, which is why `--profile` sits below the files: an answer you have already saved outranks the profile that suggested it.

### Starting from answers you already have

```bash
personal-config setup --from ./answers.json                   # a file
personal-config setup --from https://example.com/p/k3f9d2ab   # a URL
personal-config setup --from k3f9d2ab                         # or just the id a site handed you
```

The three forms are told apart by shape. Eight characters of `[a-z0-9]` with no `/` and no `.` is an id, anything with a scheme is a URL, and everything else is a path. An id resolves against the `homepage` field in `package.json` as `/p/<id>`, so a fork pointed at its own site hands out its own ids. A URL is fetched over https only, with one exception: a loopback address (`localhost`, `127.0.0.1` or `[::1]`), for developing the site that hands out the ids. Redirects are followed by hand and each hop is checked against the same rule.

`--from` sits above the saved config and the repo file, unlike `--profile`, which sits below them. It carries answers given seconds ago, and the failure worth preventing is those answers losing silently to a config saved months earlier and forgotten. The accepted cost is that running it inside an already-configured repo re-renders that repo to the new answers.

## `catalog`

```bash
bun run catalog
```

This writes `catalog.json` in the repo root. It holds every question the wizard asks: its text, its options with their examples, and the condition that decides whether it is asked at all. It also holds the long forms from [`docs/choices/`](docs/choices), keyed by the id each question cites. As of `0.7.0+a96e489b` that is forty-six questions and thirty-seven long forms. Thirty-four of the questions carry a condition, so nobody is asked all forty-six.

It exists so another surface can ask the same questions without importing the wizard, which is not browser-safe. The catalog version is the package version plus a hash of the questions it was built from, so a consumer can tell which questions it pinned. `bun test` fails when the questions change and the catalog was not rebuilt, because a second copy of the questions is only accurate if something checks it.

## Development

Four gates have to pass before a change is done. CI runs the same four on Linux and macOS.

```bash
bun run typecheck
bun run lint
bun test
bun run doctor . examples
```

`bun test` rebuilds `tests/fixtures/` itself and runs against a throwaway `$HOME`, so a test never reaches your real `~/.claude`. `bun run lint` fails on formatting as well as lint findings, and `bunx biome check --write` fixes almost all of them. `bun run build` bundles `src/cli.ts` into `dist/cli.js`, which `npm pack` does for you through `prepack`.

| Path | What is there |
|---|---|
| `src/` | The CLI: `commands/` (one module per subcommand), `questions/`, `phases/`, `render/` (one module per output family), `doctor/` (one rule per file) and `lib/` |
| `templates/` | Document scaffolds with `{{TOKENS}}`, the hook scripts and the skills |
| `standard/` | The versioned working standard in long and short form, with its `VERSION` and `CHANGELOG.md` |
| `docs/choices/` | One long form per question |
| `profiles/` | Default answers |
| `examples/` | A filled ledger, board, Part 0 prompt and archive index for a fictional repo |
| `tests/` | The `bun test` suite |
| `tools/` | Workflow scripts for this repo's own board. See [`tools/README.md`](tools/README.md). |
| `scripts/personal-config` | A bash dispatcher for the dev tasks (`build`, `setup`, `catalog`, `doctor`, `undo`, `test`, `typecheck`, `lint`, `format`). Run it with `help`. |

A change to either form of the standard has to bump `standard/VERSION` and add an entry to `standard/CHANGELOG.md`, and CI fails without both. The CLI has its own [`CHANGELOG.md`](CHANGELOG.md). Read [`CONTRIBUTING.md`](CONTRIBUTING.md), [`CLAUDE.md`](CLAUDE.md) and [`docs/conventions-ts.md`](docs/conventions-ts.md) before you send a change.

## Uninstall

```bash
personal-config undo    # restore whatever the last run overwrote
```

Then delete what you no longer want:

- `~/.claude/rules/commits.md`, `model-routing.md` and `docs-lookup.md`
- the skill directories under `~/.claude/skills/` (`close-out`, `scope`, `passoff`, `handoff` and `clean-up`)
- `~/.claude/hooks/personal-config/`, and the `hooks` entries and `outputStyle` it added to `~/.claude/settings.json`
- the generated files in each repo, and the `availableModels` list in any repo's `.claude/settings.local.json`

There is no daemon. The only global state is `~/.config/personal-config/`, which holds your saved answers, the backups, and `run.json` if a run was interrupted. Nothing runs unless you run it.

## A note on agent memory

This tool does not generate memory files. Memory is per person and per agent tool, and anything a second person or a second tool would need is not memory and belongs in the repo. Part 10 of the standard describes how to keep memory if your agent tool offers it.

## License

MIT. See [LICENSE](LICENSE).
