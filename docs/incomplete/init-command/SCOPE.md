# SCOPE: configure one folder from a global install

**Status:** `RATIFIED` 2026-10-05: GATE 1 answered the same day, every recommendation taken (§7). Opened 2026-10-05 as `SCOPING`. Owner: Zach. One repo, `personal-config`, at `8bdf8bb`
(`cut 0.8.0`).

**Why this exists.** Zach asked on 2026-10-05 whether `personal-config` should be installed once,
globally, and then run inside a single new project to set that project up. At `8bdf8bb` the install half
works and the per-project half does not: `setup` always scans a projects directory and always
rewrites the global files in `~/.claude`. This document lays out what exists and the choices that
decide how a per-folder command behaves. It decides nothing.

## 1. What exists, verified 2026-10-05

| Claim | Verified state | Citation |
|---|---|---|
| The package installs globally with a `personal-config` binary | Holds. `bin` maps `personal-config` to `dist/cli.js`; `0.8.0` is `latest` on npm | `package.json:26-28`; `npm view personal-config dist-tags` |
| A global install is tested | Holds. CI runs `npm install -g ./personal-config-*.tgz` on Node 20, 22 and 24 with no Bun on `PATH`, then `personal-config --version`, `help`, `doctor .` | `.github/workflows` `node-install` job; run `37265814945`, all jobs `success` |
| The README already describes a global install as an option | Holds, in one sentence: "Without a global install, put `npx` in front". It never shows the install command | `README.md:30`; `grep -n 'install -g' README.md` returns nothing |
| `setup` reads no path argument | Holds. `parseCli` puts every positional after the command in `paths`, and `runSetup` never reads `cli.paths` | `src/lib/args.ts:50-64`; `grep -n 'cli.paths' src/commands/setup.ts` returns nothing |
| `setup` finds targets one level under a projects directory only | Holds. `scanProjectsDir` lists the entries of `dir` and scans each subdirectory; pointed at a repo, it scans that repo's subfolders | `src/lib/discover.ts:80-104`; `src/commands/setup.ts:104-106` |
| Under `--yes`, `setup` configures every target it found | Holds. `defaultsPrompter().pick` returns every scan | `src/lib/ask.ts:60-62`; `src/commands/setup.ts:119` |
| One folder can already be scanned on its own | Holds. `scanRepo(path, kind)` is exported and is what `scanProjectsDir` calls per entry | `src/lib/discover.ts:112` |
| `planRepo` already plans one target from one scan | Holds, exported as a test seam | `src/commands/setup.ts:166-217` |
| Every `setup` run renders the global files, with or without a repo | Holds. `renderAll` always includes `renderGlobalRules`, `renderSkills`, `renderWriteDoc`, `renderHooks`; with no repo the target list is `[null]` | `src/render/index.ts:23-32`; `src/commands/setup.ts:259` |
| The global files depend on the track answers of the run | Holds. `wantedSkills` reads `trackOf(ctx)` (code or non-code, full or light, git or not); `model-routing.md` adds the `/delegate` sentence only where `rendersDelegate(ctx)` | `src/render/skills.ts:37-75`; `src/render/rules.ts:138-139` |
| The track answers are asked in the `you` phase, once per run | Holds. `work-kind`, `config-weight`, `uses-git` are the first three `you` questions | `catalog.json` (`phase: "you"`); `src/commands/setup.ts:47` |
| The track answers are not saved as the person's | Holds. `PERSONAL_ANSWERS` lists models, hooks, skills, commit policy and others, but not `workKind`, `configWeight` or `usesGit` | `src/lib/config.ts:133-149` |
| A repo's own answers are saved in it | Holds. `setup` writes `.personal-config.json` in each target | `src/render/repo.ts:391` |
| `setup` does not read a repo's `.personal-config.json` back | Holds. `runSetup` calls `loadConfig(cli, null)`; `doctor` and `upgrade` pass the repo root | `src/commands/setup.ts:40`; `src/doctor/index.ts:155`; `src/commands/upgrade.ts:171` |
| The stamp hash covers every hashed answer, the person's included | Holds. `hashedAnswers` filters only `UNHASHED_ANSWERS` | `src/lib/config.ts:106-113` |
| The website tells visitors to run `npx personal-config setup` | Holds, three places | portfolio `src/lib/rungs.ts:36`, `src/lib/setup-copy.ts:105`, `:203` |
| Nothing settled covers a per-folder command | Holds. No match for "projects-dir", "one level", "init" or "per-folder" in the Settled section or the archive index | `grep -n -i` over `HANDOFF.md:60-95` and `~/Projects/archive/personal-config/INDEX.md` |

**What the table says, in short.** The engine already has every part a per-folder command needs:
scan one path, plan one target, render, preview, write. What is missing is an entry point that
uses them for the current folder and skips the global renderers. Two facts make "skip the global
files" more than a convenience. First, the global files follow the track of whichever run wrote
them last, so setting up one non-code folder with the `setup` of `8bdf8bb` rewrites `model-routing.md`
without the `/delegate` sentence while `/delegate` stays installed (inferred from the two rows
above; to be confirmed with a dry run in the plan's §0). Second, a re-run in a configured repo
does not read that repo's saved answers.

## 2. What this is, and what it is not

**This is:**

- A command that configures exactly one folder, by default the current directory.
- It writes only that folder's files: the standard or the short standard, the router, the ledger
  and the board or the project folders, the conventions documents, the tier ceiling,
  `.personal-config.json`, the git exclusions, and the Part 0 prompt.
- It asks the per-folder questions, and takes the person's answers from the saved config.
- It goes through the same `planned()`, `resolvePlan()`, preview, confirm and `commitPlan()` path
  as `setup`, so the backup and `undo` work unchanged.
- README and `--help` text for the global install and the new command, and a `CHANGELOG.md` entry.

**This is not:**

- A change to what `setup` does. It keeps scanning a projects directory and writing the global
  files.
- A global-only command. `setup` with no targets already does that (HANDOFF 105 ran it that way).
- A change to the website survey or its copy. The site produces a profile for a first run; a
  second rung for "add a project" is a portfolio item, if wanted.
- Making `setup` read each repo's `.personal-config.json`. That is the second finding in §1 and
  it applies to the new command only if Q4 says so.
- Removing files from a folder, or an uninstall for one project.
- New questions. The catalog does not change, so `catalog.json` and the long forms do not either.

## 3. Options

### Q1. The shape of the command

**A. A new command, `personal-config init [path]`.** *Recommended.*

*The defense.* It names a different job from `setup`: one folder, no global files. `git init`,
`npm init` and `bun init` have taught that word to mean "set up this directory". Its help line
and its behaviour can be stated without conditions, and `setup` stays exactly as documented.

*The strongest argument against it.* It is a second entry point to the same engine, so two
commands must agree on how a target is planned. If they drift, a folder set up by `init` and one
set up by `setup` differ for no reason the person can see. The mitigation is that both call
`planRepo` and `renderAll`, and the only difference is a filter on the global renderers; a test
can pin that the repo files are byte for byte the same.

**B. A path on `setup`: `personal-config setup .`**

*The defense.* No new command to learn, and `doctor` and `upgrade` already take paths this way.

*The strongest argument against it.* The same command then means two things: with no path it
scans a directory and rewrites `~/.claude`, and with a path it does neither. A person who types
`setup .` in a projects directory gets the folder itself configured as one project, which is the
opposite of what `setup` does there at `8bdf8bb`. The help text has to explain both.

**C. A flag: `setup --here`, or `setup --no-global`.**

*The defense.* Smallest change to the argument parser.

*The strongest argument against it.* Flags compose. `--here` without `--no-global` still rewrites
the global files, so the person has to know two flags to get the safe behaviour, and the unsafe
one is the default.

**D. No code: document `--projects-dir` and the picker.**

*The defense.* Nothing to build or test.

*The strongest argument against it.* It does not do what was asked. The picker lists every
sibling of the new folder, `--yes` configures all of them, and the global files are still
rewritten from this run's track.

### Q2. What the command does with the global files

**A. Never writes them; refuses without a saved config.** *Recommended.* If
`~/.config/personal-config/config.json` does not exist, it stops before asking anything and tells
the person to run `setup` once.

*The defense.* One rule with no exceptions: `init` never touches `~/.claude`. The person answers
the questions about themselves once, in `setup`, and every later folder reuses them.

*The strongest argument against it.* A new user's first command may well be `init`, and a refusal
is a second step before anything works.

**B. Never writes them; proceeds without a saved config.** It falls back to the profile's
defaults for the person's answers and prints one line saying the global files were not written.

*The defense.* No refusal; the folder is set up either way.

*The strongest argument against it.* The repo files cite skills, hooks and rules that are not
installed. A router that says "run `/close-out`" on a machine with no `/close-out` is the kind of
document that renders cleanly and is wrong for its reader.

**C. Writes them only when none exist.** If no stamped global file is found, it runs the global
renderers as `setup` would.

*The defense.* The first command works in one step.

*The strongest argument against it.* `init` then has two behaviours depending on hidden state,
and it has to ask the person questions about themselves, so it becomes `setup` for one folder,
with every conditional that brings.

### Q3. Which questions `init` asks

**A. The three track questions, the `discover` phase, and the `practices` phase.** *Recommended.*
The person's answers (models, hooks, commit policy, skills, chat style) come from the saved config
and are not asked.

*The defense.* The track belongs to the folder: one project is code in git, the next is a set of
documents. Everything else is already answered.

*The strongest argument against it.* The global files were rendered for the track of the last
`setup` run. A non-code folder gets a short router while the installed skills are the code set,
and the person may not see the mismatch. The scope's answer is to print one line when this
folder's track differs from the saved one; Q2 keeps `init` from fixing it silently.

**B. Every question, with the saved answers as defaults.**

*The defense.* Nothing is hidden; the person sees each answer before it is used.

*The strongest argument against it.* About thirty questions to add one project, most of them
answered already, and changing a person answer here has no effect because `init` does not write
the global files. A question whose answer does nothing is a trap.

### Q4. A folder that was set up before

**A. Read its `.personal-config.json` as a layer, so its answers are the defaults.**
*Recommended.*

*The defense.* Running `init` again in a configured project is how a person changes one answer,
and it should start from what that project already has. `doctor` and `upgrade` already load this
layer (`loadConfig(cli, root)`).

*The strongest argument against it.* `setup` does not do this (`setup.ts:40`), so the two commands
disagree on the defaults for the same folder. That gap exists at `8bdf8bb`, and this would make it
visible; fixing `setup` is out of scope (§2).

**B. Ignore it, as `setup` does.**

*The defense.* Both commands behave the same.

*The strongest argument against it.* The person re-answers every per-folder question to change
one, and an answer they forget to repeat silently reverts.

### Q5. The message for a machine with no saved config yet (only under Q2 A)

R7 applies: this is copy a person reads. Three registers:

- **Plain.** "No saved answers found. Run `personal-config setup` once to set up your machine, then
  run `personal-config init` in each project."
- **Warm.** "This looks like your first run on this machine. `personal-config setup` asks about how
  you work and installs the global rules once; after that, `personal-config init` sets up any
  project in a few questions."
- **Terse.** "Run `personal-config setup` first. `init` reuses its answers."

## 4. Dials

| Dial | Recommended default | Why |
|---|---|---|
| DIAL-1 Default target | The current directory; one optional path | Matches `doctor` and `upgrade` (`README.md:30`) |
| DIAL-2 Refuse a folder that looks like a projects directory | Refuse when the target holds two or more git repos one level down, and name `setup` | Catches `init` run one level too high, where the person meant `setup` |
| DIAL-3 Refuse the home directory | Yes, always | A standard and a ledger written into `~` are never what was meant |
| DIAL-4 Track mismatch notice | One line when this folder's `workKind`, `configWeight` or `usesGit` differs from the last saved run | Q3's mitigation; printed, never asked |
| DIAL-5 `--yes` | Accepts every default for this one folder, still previews | Same contract as `setup` (`--help` text) |
| DIAL-6 The Part 0 prompt | Copied to the clipboard, as `setup` does | `copyPart0`, `src/commands/setup.ts:464` |

## 5. Hazards this work walks into

- **Stamp drift.** The stamp hash covers the person's answers too (`config.ts:106`). If `init`
  saves a different answer set from the one `setup` would save for the same folder, `doctor`
  reports `stamp-drift` on every file it wrote. The plan needs a test that `init` and `setup`
  produce the same `.personal-config.json` and the same stamps for one fixture.
- **The track drives the global files.** §1's inference about `model-routing.md` is unconfirmed.
  If it holds, it is a separate defect in `setup` and belongs on the board, not in this build.
- **Checkpoint and resume.** `setup` marks the picked repo set (`setup.ts:123`) so a resumed run
  stops replaying for a different set. `init` must either key its own checkpoint by path or not
  checkpoint at all.
- **No test may write outside a temp directory.** The command reads the current directory, so
  every test must pass a temp path and run with the redirected `$HOME` (`tests/preload.ts`).
- **The ownership guard.** `planRepo` needs the GitHub login; `setup` gets it from the profile or
  `gh api user` (`setup.ts:124`). `init` makes the same network call unless the profile names one,
  and the README's privacy line (`README.md:112`) must stay true.
- **Gates that lie.** `bun test` passing does not show the command works from a global install. The
  done-when needs the packed tarball installed with `npm install -g` and `init` run in a scratch
  folder, as the CI `node-install` job does for `doctor`.

## 6. Open questions for GATE 1

1. Q1: the shape. Recommended A, `personal-config init [path]`.
2. Q2: the global files. Recommended A, never write them and refuse without a saved config.
3. Q3 and Q4: what is asked, and whether a configured folder's answers are the defaults.
   Recommended Q3 A and Q4 A.
4. Q5: the refusal copy, plain, warm or terse. Recommended plain.

The dials in §4 take their recommended defaults unless the answer changes one.

## 7. GATE 1 answers, 2026-10-05

Zach answered the four questions in one batch on 2026-10-05 and took every recommendation.

1. **Q1: A.** A new command, `personal-config init [path]`, defaulting to the current directory.
   `setup` is unchanged.
2. **Q2: A.** `init` never writes `~/.claude`. Without `~/.config/personal-config/config.json` it
   stops before asking anything.
3. **Q3: A, and Q4: A.** It asks the three track questions and the `discover` and `practices`
   phases, takes the person's answers from the saved config, reads the folder's own
   `.personal-config.json` as a layer, and prints one line when the folder's track differs from
   the saved one (DIAL-4).
4. **Q5: plain.** "No saved answers found. Run `personal-config setup` once to set up your machine,
   then run `personal-config init` in each project."

The §4 dials stand at their recommended defaults. Next: Stage 3, this file renamed to `DESIGN.md`
with the answers written in as `D1` to `Dn`, then the plan and GATE 2.
