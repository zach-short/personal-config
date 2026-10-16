# DESIGN: configure one folder from a global install

**Status:** `RATIFIED` 2026-10-05: GATE 1 answered the same day, every recommendation taken (§9).
Opened 2026-10-05 as `SCOPE.md` (`SCOPING`), committed at `c334832`, and renamed to `DESIGN.md` on
2026-10-16 by board item 86, which wrote the answers in as `D1` to `D9` and the GATE 2 amendments `D10` and `D11` (§3). Owner: Zach. One
repo, `personal-config`. The scope was written at `8bdf8bb` (`cut 0.8.0`); the plan re-verifies it
at `0214402` (`PLAN.md` §0).

**Why this exists.** Zach asked on 2026-10-05 whether `personal-config` should be installed once,
globally, and then run inside a single new project to set that project up. At `8bdf8bb` the install half
works and the per-project half does not: `setup` always scans a projects directory and always
rewrites the global files in `~/.claude`. This document lays out what exists, records what Zach
decided, and lists what the build must leave alone.

**How to read this.** §1 is ground truth as of 2026-10-05; where `PLAN.md` §0 differs, the plan
wins. §2 is the non-scope list. §3 holds the frozen decisions `D1` to `D11`, and §4 the rules that
survive unchanged. **From here this document changes by amendment only**: a new dated `D<n>`, a
dated supersession naming what it replaces, or an `As built:` note. Never by editing a decision in
place. §5 to §9 are the scope as GATE 1 saw it, kept so the strongest argument against each
choice stays findable.

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

*Confirmed 2026-10-16 (R5), `PLAN.md` §0 row F1:* at `0214402` a non-code `setup` run into a temp
`$HOME` that a code run had set up first rewrites `model-routing.md` with no `/delegate` line, and
`/delegate`, `/autopilot`, `/audit` and `/clean-up` stay installed. The inference holds. It is a
`setup` defect, outside this build, and is board item 101.

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

## 3. Decisions, ratified 2026-10-05

Zach answered GATE 1 in one batch on 2026-10-05 and took every recommendation (§9). Each decision
below cites the option it came from, in §5, where its strongest counter-argument is kept.

**D1. A new command, `personal-config init [path]`.** It configures exactly one folder. With no
path it configures the current directory; with one path it configures that one. `setup` keeps its
meaning: scan a projects directory, write the global files.

*Defense.* The two jobs differ in what they write, so they get two names. `git init`, `npm init`
and `bun init` have already taught that word to mean "set up this directory", and the help line
for each command states its behaviour without a condition. A path on `setup` (§5 Q1 B) makes one
command mean two things and changes what `setup .` does inside a projects directory. A flag
(Q1 C) makes the unsafe behaviour the default. The cost is a second entry point to one engine;
D8 and the parity test in `PLAN.md` hold the two together. *Source:* Q1 A, DIAL-1.
*Supersedes:* nothing. *Date:* 2026-10-05.

**D2. `init` never writes `~/.claude`.** It writes the folder's own files, the list in §2, and
nothing in the global rules, skills, hooks or settings.

*Defense.* One rule with no exceptions is a rule a person can trust without reading the preview
twice. The global files follow the track of the run that wrote them last (§1, confirmed by
`PLAN.md` §0 row F1), so an `init` that wrote them would quietly re-shape every other project on
the machine to fit this one. *Source:* Q2 A, §2. *Supersedes:* nothing. *Date:* 2026-10-05.

**D3. Without `~/.config/personal-config/config.json`, `init` stops before it asks anything.** It
prints the copy settled at GATE 1 (Q5, plain register):

> No saved answers found. Run `personal-config setup` once to set up your machine, then run
> `personal-config init` in each project.

*Defense.* Without the saved config `init` holds no record of which skills, hooks and rules are
installed, and a router that names `/close-out` on a machine without it renders cleanly and is
wrong for its reader (§5 Q2 B). One refusal on a first run costs less than a folder of documents
that point at nothing. *Source:* Q2 A, Q5. *Supersedes:* nothing. *Date:* 2026-10-05.

**D4. `init` asks the three track questions, the `discover` phase and the `practices` phase.**
The track questions are `work-kind`, `config-weight` and `uses-git`. The person's answers (models,
hooks, commit policy, skills and the rest) come from the saved config and are not asked.

*Defense.* The track belongs to the folder: one project is code in git, the next is a set of
documents. Everything else was answered once in `setup`. Asking every question again (Q3 B) is
about thirty questions to add one project, and a person answer changed here would do nothing,
because D2 keeps `init` away from the files those answers render. A question whose answer does
nothing is a trap. *Source:* Q3 A. *Supersedes:* nothing. *Date:* 2026-10-05.

**D5. `init` reads the folder's own `.personal-config.json` as a layer.** In a folder that was
set up before, that file's answers are the defaults, so running `init` again is how a person
changes one answer.

*Defense.* A re-run should start from what the folder already has. Ignoring the file (Q4 B) makes
the person re-answer every per-folder question to change one, and an answer they forget to repeat
reverts without a word. `doctor` and `upgrade` already load this layer. The gap with `setup`,
which does not, is recorded in §2 and stays out of scope. *Source:* Q4 A. *Supersedes:* nothing.
*Date:* 2026-10-05.

**D6. One printed line when the folder's track differs from the saved one.** It compares
`workKind`, `configWeight` and `usesGit`. It is printed, never asked, and `init` changes nothing
because of it.

*Defense.* This is the mitigation for the strongest argument against D4: a non-code folder gets a
short router while the installed skills are the code set, and the person may not see it. D2 keeps
`init` from fixing that silently, so the least it can do is say so. *Source:* Q3 A, DIAL-4.
*Supersedes:* nothing. *Date:* 2026-10-05.

**D7. The dials stand at their recommended defaults (§6).** DIAL-1: the current directory, or one
path. DIAL-2: refuse a target that holds two or more git repos one level down, and name `setup`.
DIAL-3: always refuse the home directory. DIAL-4: as D6. DIAL-5: `--yes` accepts every default
for this one folder and still previews. DIAL-6: the Part 0 prompt is copied to the clipboard, as
`setup` does.

*Defense.* DIAL-2 and DIAL-3 catch the two places a person types `init` one level too high:
where they meant `setup`, and their home directory, where a ledger is never what was meant.
DIAL-5 and DIAL-6 keep the contract `setup` already documents. *Source:* §6, §9.
*Supersedes:* nothing. *Date:* 2026-10-05.

**D8. `init` writes through the same path as `setup`.** Every file goes through `planned()`,
`resolvePlan()`, the preview, the confirm and `commitPlan()`, so the backup and `undo` work
unchanged. It plans its one target with the same `planRepo` and renders with the same
`renderAll`.

*Defense.* The repo's first rule is that nothing is written without a stamp and a preview
(`CLAUDE.md`). A second write path would be a second set of bugs in the one place a person trusts
the tool not to lose a file. Sharing `planRepo` and `renderAll` is also what lets a test pin that a
folder set up by `init` and one set up by `setup` are the same bytes. *Source:* §2, Q1 A's
mitigation. *Supersedes:* nothing. *Date:* 2026-10-05.

**D9. The build ships its own documentation.** README text for the global install (the
`npm install -g` command the README never shows, §1) and for `init`, a `--help` line, and a
`CHANGELOG.md` entry.

*Defense.* The question that opened this work was how to install once and set up each project. A
command the README does not mention answers it for nobody. *Source:* §2. *Supersedes:* nothing.
*Date:* 2026-10-05.

### Amendments, GATE 2, 2026-10-16

**D10. `setup` records the `you` answers it rendered the global files from.** They go under one
new key in `~/.config/personal-config/config.json`, outside `answers`, so `loadConfig`'s merge and
`configHash` never read it. `init` compares the folder's track against it (D6) and takes
`outputStyle`, `chatStyle`, `writeDoc` and `writeDocCheck` from it (D4). A `config.json` written
before the key existed has none, and `init` then prints no notice.

*Defense.* `PLAN.md` §0 found that D6 has nothing to compare against (F2) and that D4 cannot take
four of the person's answers from the saved config, because it holds none of them (F3). Reading
the installed skills instead (GATE 2 Q1 B) is silent when `skills` is `none`, and it lets a new
folder's `.personal-config.json` record profile values the person never chose. Zach chose A on
2026-10-16. *Supersedes, in part:* §4's first rule. `setup`'s questions, defaults, targets and
global files stay the same; its `config.json` gains the one key, and the `config.json` entries in
`tests/golden/full-track.json` move with it. The rest of that rule stands. *Date:* 2026-10-16.

**D11. The three new messages are in the plain register, to match D3.** Zach chose plain on
2026-10-16 (GATE 2 Q2). The text is:

> This folder is set up as {folder}; your global rules and skills were set up for {saved}. `init`
> leaves them as they are. Run `personal-config setup` to change them.

> {path} holds {n} git repos. `init` sets up one project. To set up all of them, run
> `personal-config setup --projects-dir {path}`.

> `init` does not set up your home directory. Run it inside a project folder.

*Defense.* R7: the owner picks user-facing copy, and the warm and terse variants are in
`PLAN.md` §7. *Supersedes:* nothing. *Date:* 2026-10-16.

## 4. Rules that survive unchanged

The build changes none of these. A phase that finds it must change one stops and asks (R12).

- **`setup`'s behaviour.** It scans a projects directory one level down, asks every question,
  configures every picked target, writes the global files, and loads no repo's
  `.personal-config.json` (`src/commands/setup.ts:41`). Its output for the same inputs stays byte
  for byte the same, which `tests/golden/full-track.json` pins. *Amended 2026-10-16 by D10:*
  `config.json` gains one key; every other file stays byte for byte the same.
- **The catalog and the long forms.** No question is added, removed or reworded, so `catalog.json`
  and `docs/choices/*.md` do not change (§2).
- **`standard/`.** No word of the standard, the short standard, their version lines or their
  changelog.
- **The global renderers.** `renderGlobalRules`, `renderSkills`, `renderWriteDoc`, `renderHooks`
  and `renderUserConfig` are not edited. `init` leaves their output out of its plan; it does not
  change what they produce. *Amended 2026-10-16 by D10:* `renderUserConfig` writes the one new
  key; the other four are not edited.
- **The repo renderers.** `renderRepoFiles`, `renderStandard`, `renderShortStandard`,
  `renderConventions`, `renderCeiling` and `renderPart0` produce the same bytes for the same
  context, whichever command called them.
- **The stamp and the hash.** `configHash`, `hashedAnswers`, `UNHASHED_ANSWERS` and
  `PERSONAL_ANSWERS` keep their members (`src/lib/config.ts:93`, `:106`, `:133`).
- **The merge order of `loadConfig`** for every command that already calls it.
- **`doctor`, `upgrade` and `undo`.** They work on a folder `init` set up exactly as on one
  `setup` set up, with no change to their code.
- **The two network calls** listed at `README.md:112`, and no third.

## 5. Options

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

## 6. Dials

| Dial | Recommended default | Why |
|---|---|---|
| DIAL-1 Default target | The current directory; one optional path | Matches `doctor` and `upgrade` (`README.md:30`) |
| DIAL-2 Refuse a folder that looks like a projects directory | Refuse when the target holds two or more git repos one level down, and name `setup` | Catches `init` run one level too high, where the person meant `setup` |
| DIAL-3 Refuse the home directory | Yes, always | A standard and a ledger written into `~` are never what was meant |
| DIAL-4 Track mismatch notice | One line when this folder's `workKind`, `configWeight` or `usesGit` differs from the last saved run | Q3's mitigation; printed, never asked |
| DIAL-5 `--yes` | Accepts every default for this one folder, still previews | Same contract as `setup` (`--help` text) |
| DIAL-6 The Part 0 prompt | Copied to the clipboard, as `setup` does | `copyPart0`, `src/commands/setup.ts:464` |

## 7. Hazards this work walks into

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

## 8. Open questions for GATE 1

1. Q1: the shape. Recommended A, `personal-config init [path]`.
2. Q2: the global files. Recommended A, never write them and refuse without a saved config.
3. Q3 and Q4: what is asked, and whether a configured folder's answers are the defaults.
   Recommended Q3 A and Q4 A.
4. Q5: the refusal copy, plain, warm or terse. Recommended plain.

The dials in §6 take their recommended defaults unless the answer changes one.

## 9. GATE 1 answers, 2026-10-05

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

The §6 dials stand at their recommended defaults. Next: Stage 3, this file renamed to `DESIGN.md`
with the answers written in as `D1` to `Dn`, then the plan and GATE 2.
