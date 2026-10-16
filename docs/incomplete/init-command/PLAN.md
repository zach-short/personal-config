# PLAN: `personal-config init`

**Status:** `BUILT` 2026-10-16: all three phases, by board items 102, 103 and 104. Phase 3's CI
step is written, not seen running (R10). `PLANNED` 2026-10-16, GATE 2 answered the same day,
every recommendation taken (§7).
Written by board item 86 at `0214402`. Design: `DESIGN.md`, `RATIFIED` 2026-10-05 (`D1` to `D9`),
amended at GATE 2 (`D10`, `D11`). This plan authorizes the three phases below without a further
approval each. They are board items 102, 103 and 104.

## 0. Facts verified 2026-10-16 (supersede the design where they differ)

Every row of `DESIGN.md` §1 was re-checked at `0214402`, 20 commits after the scope's `8bdf8bb`.
Eight of those commits touch a file the table cites (`git log --oneline 8bdf8bb..HEAD --` over
the cited files), so line numbers moved; no claim changed. Rows S1 to S17 are the scope's rows in
order. Rows F1 to F10 are new, and F2, F3, F4 and F10 change how the build is done.

| # | Claim | Verified state, 2026-10-16 | Citation |
|---|---|---|---|
| S1 | The package installs globally with a `personal-config` binary | Holds. `0.8.0` is still `latest` | `package.json:26-28`; `npm view personal-config dist-tags` → `{ latest: '0.8.0' }` |
| S2 | A global install is tested | Holds for the job; its last run is old. The `node-install` job installs the tarball and runs `--version`, `help`, `doctor .` and `setup --dry-run`. The last CI run is `37268107367` on `c334832` (2026-10-05, `success`); `origin/main` is `c334832`, so the 19 commits after it have no CI run | `.github/workflows/ci.yml:69-84`; `gh run list --workflow ci.yml --limit 3`; `git log --oneline origin/main..HEAD \| wc -l` → 19 |
| S3 | The README describes a global install in one sentence and never shows the command | Holds | `README.md:30`; `grep -n 'install -g' README.md` returns nothing |
| S4 | `setup` reads no path argument | Holds | `src/lib/args.ts:52-67` (`paths: rest`); `grep -n 'cli.paths' src/commands/setup.ts` returns nothing |
| S5 | `setup` finds targets one level under a projects directory only | Holds | `src/lib/discover.ts:81-95`; `src/commands/setup.ts:108` |
| S6 | Under `--yes`, `setup` configures every target it found | Holds | `src/lib/ask.ts:60-62`; `src/commands/setup.ts:121` |
| S7 | One folder can be scanned on its own | Holds | `src/lib/discover.ts:113` (`scanRepo(path, kind)`) |
| S8 | `planRepo` plans one target from one scan | Holds, still exported as a seam | `src/commands/setup.ts:168-219` |
| S9 | Every `setup` run renders the global files | Holds | `src/render/index.ts:17-40`; `src/commands/setup.ts:261` (`[null]`) |
| S10 | The global files depend on the track | Holds | `src/render/skills.ts:52-54` (`wantedSkills`), `:61-63` (`rendersDelegate`); `src/render/rules.ts:138` |
| S11 | The track answers are the first three `you` questions | Holds | `catalog.json` (`work-kind`, `config-weight`, `uses-git`); `src/commands/setup.ts:48` |
| S12 | The track answers are not saved as the person's | Holds | `src/lib/config.ts:133-149` |
| S13 | A repo's own answers are saved in it | Holds | `src/render/repo.ts:458` |
| S14 | `setup` does not read a repo's `.personal-config.json`; `doctor` and `upgrade` do | Holds | `src/commands/setup.ts:41`; `src/doctor/index.ts:182`; `src/commands/upgrade.ts:171` |
| S15 | The stamp hash covers every hashed answer | Holds | `src/lib/config.ts:106-113` |
| S16 | The website tells visitors to run `npx personal-config setup` | Holds, three places | portfolio `src/lib/rungs.ts:36`, `src/lib/setup-copy.ts:105`, `:203` |
| S17 | Nothing settled covers a per-folder command | Holds | `grep -n -i 'projects-dir\|one level\|\binit\b\|per-folder' HANDOFF.md` matches only `:240`, a note on `git init` for fixtures; the same grep over `~/Projects/archive/personal-config/INDEX.md` returns nothing |
| F1 | A non-code `setup` run rewrites `model-routing.md` without the `/delegate` sentence while `/delegate` stays installed | **Confirmed.** A code run (`skills: all`) into a temp `$HOME` installed eight skills and a `model-routing.md` naming `/delegate`. A non-code `--dry-run` against that home planned `model-routing.md [+26 −29]` and no removal. Applied to a copy of the home, `grep -c delegate model-routing.md` → 0, and `audit`, `autopilot`, `clean-up` and `delegate` were still in `~/.claude/skills/`. Board item 101 | scratch run at `0214402`: `setup --from code.json --projects-dir <p> --yes`, then `setup --from nc.json --projects-dir <p2> --yes --dry-run` and the same without `--dry-run` into a copy |
| F2 | The "saved" track that DIAL-4 compares against does not exist | No file outside a repo holds `workKind`, `configWeight` or `usesGit`. `renderUserConfig` writes only `personalAnswers()`, and S12 shows the three are not in that set. The scope's §1 recorded this (S12), but D6 assumes a saved value. GATE 2 Q1 | `src/render/user-config.ts:22-28`; `src/lib/config.ts:133-149` |
| F3 | Four `you` answers are hashed but never saved for the person | `outputStyle`, `chatStyle`, `writeDoc` and `writeDocCheck` are outside `PERSONAL_ANSWERS` and inside the hash. They render only global files, so they change a repo's stamp hash and none of its bytes. `init` cannot take them "from the saved config" (D4), because it holds none of them. GATE 2 Q1 | `grep -rln` for each key over `src/render`: `hooks.ts`, `rules.ts`, `write-doc.ts` only; `src/lib/config.ts:93-99`, `:133-149` |
| F4 | A repo's `.personal-config.json` outranks the saved config in the merge | The repo layer sits above `config.json`, and it holds every hashed answer, the person's included. Under D5 as written, an old folder's copy of `commitPolicy` would beat the person's current saved one. BD-3 | `src/lib/config.ts:24-33`; `hashedAnswers` at `:106` |
| F5 | The Part 0 prompt already lists only the target's own files | `writtenFiles` drops every path outside the repo root, so dropping the global files from the plan leaves the prompt's bytes unchanged. BD-1 | `src/render/repo.ts:564-575` |
| F6 | Flags are global; no command refuses a flag it ignores | One `OPTIONS` table serves every command, and `setup` would accept `init`'s flags and the reverse. BD-6 | `src/lib/args.ts:28-43` |
| F7 | `renderUserConfig` writes `~/.config/personal-config/config.json` on every run | It is in `renderAll`'s output, so a plan filtered to `~/.claude` alone would still overwrite the saved config | `src/render/index.ts:34`; `src/render/user-config.ts:22-28` |
| F8 | No command is named `init` | Holds | `src/lib/args.ts:6-20` |
| F9 | The tier ceiling is a file inside the target | `renderCeiling` writes `<repo>/.claude/settings.local.json`, so the path filter in BD-1 keeps it | `src/render/ceiling.ts:57` |
| F10 | `setup`'s `finish` deletes the resume checkpoint | `finish` ends through `endRun`, which calls `clearCheckpoint()` for `written`, `dry-run` and `already-current`. An `init` that reused `finish` as it stands would discard an unfinished `setup` run. BD-4. *Corrected 2026-10-16 by board item 102 (R5):* `dry-run` does not retire it; only `written` and `already-current` do (`retiresCheckpoint`, `src/lib/resume.ts:82-84`). The finding stands for those two | `src/commands/setup.ts:358-418` |

## 1. Decisions taken since ratification

Build-level calls that implement a ratified decision (R12). Each names its reversal.

- **BD-1. `init` keeps only the planned files inside its target.** It calls `renderAll` unchanged,
  then drops every planned file whose resolved path is not under the target folder, and refuses
  with an internal error if any remains outside after the filter. This removes the global rules,
  skills, `/write-doc`, hooks, `~/.claude/settings.json` and `config.json` (F7) in one rule, and
  the Part 0 prompt is the same bytes (F5). It implements D2 and keeps §4's "the global renderers
  are not edited". *Reverse:* add a `scope` option to `renderAll` that skips the global groups.
- **BD-2. Every refusal runs before the first question, cheapest first.** The order is: an
  ignored flag (BD-6), more than one path, a path that is not a directory, the home directory
  (DIAL-3), a projects directory (DIAL-2), and no saved config (D3). *Reverse:* reorder the
  checks; none depends on another.
- **BD-3. In `init`, the saved config's person answers outrank the folder's copy of them.** The
  merge for `init` is `loadConfig(cli, target)` with `personalAnswers(saved)` laid over the
  result. The folder's file still supplies the per-folder defaults (D5), and the person's answers
  come from the saved config (D4), which is what both decisions say together. Without it, F4
  makes a re-run in an old folder render the person's old commit policy. `loadConfig` itself
  does not change (§4). *Reverse:* use `loadConfig(cli, target)` alone.
- **BD-4. `init` keeps no checkpoint and never touches `setup`'s.** It asks at most about twenty
  questions for one folder, so a resume is not worth a second checkpoint key. `finish` gains a
  way for its caller to own the ending: `setup` keeps calling `endRun`, and `init` does not. Its
  behaviour for `setup` is unchanged, which the golden file and `tests/resume.test.ts` pin.
  *Reverse:* wrap `init`'s prompter in `checkpointing()` keyed by the target path.
- **BD-5. The GitHub login is looked up only for a git target.** A plain folder is owned by
  definition (`src/commands/setup.ts:176`), so it needs no login and makes no network call. A git
  target uses the profile's login, else `gh api user`, as `setup` does. `README.md:112` gains
  `init` in its sentence and still names two calls. *Reverse:* call `githubLogin()` for every
  target.
- **BD-6. `init` refuses `--from` and `--projects-dir` by name.** Both would be accepted and
  ignored (F6). `--from` sits above the saved config and would replace the person's answers with
  a site profile's, which D4 rules out. *Reverse:* delete the check.
- **BD-7. The target's kind is git when `isGitRepo(path)`, else a folder.** It is scanned with
  `scanRepo(path, kind)`. `admitsFolder`, the rule that keeps a projects scan from admitting every
  directory, is not applied: the person named this folder. *Reverse:* run `admitsFolder` and
  refuse a folder it would skip.
- **BD-8. `init` reuses `setup`'s exported seams and adds no shared module.** It imports
  `planRepo`, `finish` and a newly exported `planEverything` from `src/commands/setup.ts`, the way
  `tests/folder-targets.test.ts` already imports `planRepo`. *Reverse:* move the three into a
  shared module under `src/commands/`.
- **BD-10. The D10 key is `globalAnswers`, and it holds every `you` answer present.** Written by
  `renderUserConfig` beside `models` and `answers`: each key that is a `you` question's
  `configKey` (`YOU_QUESTIONS`), sorted. The person's answers are in it as well as the track and
  the four F3 answers, so the record reads whole on its own. `asConfigLayer` narrows it like
  `answers` and `ConfigLayer` carries it; `mergeLayer` builds `Config` field by field and never
  reads it, so it is outside the merge and `configHash`. Phase 2 reads it through
  `savedUserConfig()`. *Reverse:* record only the seven keys `init` reads.
- **BD-9. The `--help` line follows the shape of the lines around it.**
  `personal-config init [path]                 set up one project with your saved answers`. The
  copy is settled by the existing help block (`src/cli.ts:19`), lowercase with no full stop.
  *Reverse:* edit the one line.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Seams in `setup`, behaviour unchanged | Default (Opus 5.5) | none | comfortable | Small edits to the one file every run goes through; the proof is that nothing moved |
| 2 | The `init` command and its tests | Default (Opus 5.5) | none | full | The parity and no-write tests are the design's whole promise and are built with the code they test |
| 3 | Documentation, the global-install proof, CI | Default (Opus 5.5) | none | comfortable | README copy for strangers, and a proof only a packed install can give |

All three run in order in lane D, one at a time: phase 2 imports what phase 1 exports, and phase 3
documents what phase 2 ships. Phase 2 is `full` because it writes one command module and two test
files against a 500-line `setup.ts`; if it runs long, its refusal tests move to a Mechanical
(Sonnet 5) subagent in its own worktree, with the parity test kept in the session.

### Phase 1. Seams in `setup`, behaviour unchanged

**Status:** `BUILT` 2026-10-16 by board item 102, on `d4c6702`; Zach commits, so the hash is the
commit that takes `tests/setup-seams.test.ts`. Gates: `typecheck` and `lint` exit 0. `bun test`
ran 1738 tests, 1728 pass; the 10 failures are 5-second timeouts in `tests/commit-policy.test.ts`
and `tests/upgrade.test.ts` under a load average of 421, and the same two files at `d4c6702` in a
scratch worktree failed 13. `doctor . examples` exits 1 on 20 findings, none in a file this phase
touched (`PASSOFF.md`, `passoff/105-…`, `docs/incomplete/worktree-sweep/SCOPE.md`, and the
standard's v1.2.0 stamps that item 94 owns). In `git diff tests/golden/` only the three
`config.json` entries moved, to one hash; the rendered file was read by hand, and with
`globalAnswers` removed it hashes to the old entry.

*As built:* `finish` returns its `RunOutcome` and `runSetup` passes it to `endRun`. The decline
tests now assert the outcome, which is stronger than the `0` they read before.
`tests/setup-tracks.test.ts`'s no-change test now expects `config.json` to differ, in
`globalAnswers` only, because four of the five answers it adds are `you` answers.

**Scope**

1. `src/commands/setup.ts`: let `finish`'s caller own the ending (BD-4). `runSetup` keeps calling
   `endRun` with the outcome, so its checkpoint handling is unchanged.
2. `src/commands/setup.ts`: export `planEverything` (BD-8), with a comment naming `init` as its
   second caller.
3. `setup` records (D10, GATE 2 Q1 A) the `you` answers the global files were rendered from
   under one new key in `config.json`, outside `answers`, so no merge or hash reads it.
   `src/render/user-config.ts` writes it, `src/lib/config-layer.ts` accepts it, and `mergeLayer`
   ignores it. The key's name is this phase's call, recorded as a `BD-n`. One test pins that the
   key is written, and one that a saved file without it still loads.

**Subagents:** none.

**Done when**

- `bun run typecheck && bun run lint && bun test && bun run doctor . examples` exit 0.
- In `git diff tests/golden/`, the only entries that move are the `config.json` hashes (D10),
  and each is read by hand before it is accepted: a green suite will pass a regenerated golden
  file whatever it holds.
- A test leaves a checkpoint on disk, runs `finish` the way `init` will, and finds the checkpoint
  still there. The code at `0214402` fails it (F10).

**Watch for:** `finish` is also the confirm gate (`tests/decline-seam.test.ts`). Moving the ending
must not move the confirm out of the unconditional path that test pins.

### Phase 2. The `init` command and its tests

**Status:** `BUILT` 2026-10-16 by board item 103, on `b797eae`; Zach commits, so the hash is the
commit that takes `src/commands/init.ts`. Gates: `typecheck` and `lint` exit 0; `bun test` ran
1772 tests across 96 files, 1772 pass, exit 0. `doctor . examples` exits 1 on the same 20
findings item 102 recorded, none in a file this phase touched. The parity test passes for a git
repo and a plain folder; the hand check in the done-when passes and is quoted in item 103's
close-out.

*As built:* BD-1's check after the filter is D2's, not the filter restated: a kept file under
`~/.claude` or `~/.config/personal-config` throws, which only a target inside one of them can
cause (`insideOnly`, `src/commands/init.ts`). BD-9's line has one more space than written here, so
its description starts in the same column as `setup`'s and `doctor`'s. BD-2's first three
refusals had no settled copy; they follow `checkUsage`'s `personal-config: <problem>` shape
(`src/lib/args.ts`) and are listed in item 103's close-out for Zach to keep or reword (R7). The
parity test seeds `config.json` with three answers that are not the profile's defaults before
`setup` runs, because with the defaults both commands agree whether or not `init` reads the
record; with the seed, dropping the D10 overlay fails it for both targets. It does not catch a
dropped BD-3 overlay, which only differs in a folder holding older answers;
`tests/init.test.ts` does, and fails without it.

**Scope**

1. `src/lib/args.ts`: add `init` to `COMMANDS`. `src/cli.ts`: dispatch it and add the help line
   (BD-9).
2. New `src/commands/init.ts`, `runInit(cli)`:
   1. Resolve the target: `cli.paths[0]` through `expandHome`, else `process.cwd()`.
   2. The refusals in BD-2's order, each printing one line and returning 1. The copy is
      `DESIGN.md` D3 and D11, word for word.
   3. Merge the config as BD-3 says.
   4. Ask `you` with `only: ['work-kind', 'config-weight', 'uses-git']` (`src/phases/run.ts:11`).
   5. Print the track notice (D6, D11) when the folder's track differs from the record D10
      adds; print nothing when `config.json` has no record.
   6. Scan the target (BD-7), look up the login (BD-5), and plan it with `planRepo`, which asks
      `discover` for this folder.
   7. Ask `practices`, then `planEverything` with the one plan.
   8. Filter the plan to the target and check it (BD-1), run `hiddenByIgnore`, and `finish`
      without retiring a checkpoint (BD-4).
3. New `tests/init.test.ts`: every refusal, with the target and `$HOME` in temp directories
   (`tests/preload.ts`); a re-run reading the folder's answers (D5); the saved person answer
   winning over the folder's old one (BD-3); the notice printed on a mismatch and not on a match.
4. New `tests/init-parity.test.ts`: one fixture git repo and one plain folder. For each, `setup
   --yes` with a projects directory holding only that target, then `init --yes` on a fresh copy
   of the target against the `config.json` that `setup` wrote. Every file under the target,
   `.personal-config.json` and every stamp included, is byte for byte the same. The same test
   lists the redirected `~/.claude` and `config.json` before and after the `init` run and finds
   them unchanged.

**Subagents:** none planned; see §2 for the one fallback.

**Done when**

- The four gates exit 0.
- `tests/init-parity.test.ts` passes for both kinds of target. This is the stamp-drift hazard of
  `DESIGN.md` §7 tested on real bytes; the plan's filter alone cannot show that `init` saves the
  answer set `setup` would.
- By hand, in a scratch `$HOME` that `setup --profile starter --yes` set up first:
  `bun src/cli.ts init <scratch> --yes --dry-run` prints a preview with no path under `~`, then
  the same run without `--dry-run`, then `bun run doctor <scratch>` reports no `stamp-drift`.
  The hand-back quotes the three outputs.

**Watch for:** the test's `setup` and `init` share one process, and `os.homedir()` is snapshotted
by Bun at start (HANDOFF, Known facts). Every path in both tests goes through `src/lib/paths.ts`,
or the no-write check passes while the real `~/.claude` is the one written.

### Phase 3. Documentation, the global-install proof, CI

**Status:** `BUILT` 2026-10-16 by board item 104, on `4581e81`; Zach commits, so the hash is the
commit that takes this phase's `README.md`, `CHANGELOG.md` and `.github/workflows/ci.yml`. Gates,
load average 3.39: `typecheck` exit 0; `lint` 191 files, exit 0; `bun test` 1772 pass, 0 fail, 96
files, exit 0. `doctor . examples` exits 1 on the same 20 findings items 102 and 103 recorded, none
in a file this phase touched. The hand-run proof in scope item 4 passes, and item 104's close-out
quotes it. CI step written, not seen running (R10): Zach pushes.

*As built:* the proof's `PATH` is `<temp>/prefix/bin:<temp>/nodebin:/usr/bin:/bin`, where
`<temp>/nodebin` holds one symlink to `node`. On this machine `node` and `bun` are both in
`/opt/homebrew/bin` (`which -a node bun`), so the `PATH` scope item 4 names finds no `node`, and
adding that directory would put `bun` back. Each command ran under `env -i`, so `PATH` and `HOME`
were the only variables set; `src/lib/paths.ts:11` reads `HOME` and no other. The CI step does
more than scope item 3 names: it takes a checksum of every file under `~/.claude` and of
`config.json` before and after `init` and fails on any difference, and it checks that five of the
files `init` writes exist, because the job's own comment asks for assertions on what ran and not
on the exit code alone. It passes `--projects-dir probe/empty-projects`, the folder an earlier step
of the job creates. Run locally as written (`env -i`, a fresh home, macOS bash 3.2, Node 26.12.0)
it exits 0, and with a `touch` under `~/.claude` planted after `init` it exits 1. The README's
`init` section has five paragraphs where scope item 1 asks for one, because the folder layer, the
track notice and the refusals each change what a person sees. The CHANGELOG entry also records
D10's `globalAnswers` key, which item 102 shipped with no entry.

**Scope**

1. `README.md`: show `npm install -g personal-config` beside the `npx` line at `:18`; add `init`
   to the commands, with one paragraph on when to run `setup` and when `init`; add `init` to the
   network sentence at `:112` (BD-5).
2. `CHANGELOG.md`: an entry for `init` under the next version.
3. `.github/workflows/ci.yml`, `node-install` job: after the existing steps, run `setup --profile
   starter --yes --projects-dir empty-projects` for real in the job's `$HOME`, then `mkdir scratch
   && cd scratch && personal-config init --yes` and `personal-config doctor .`.
4. The global-install proof, by hand: `npm pack`; `npm install -g --prefix <temp>/prefix
   ./personal-config-*.tgz`; then, with `PATH=<temp>/prefix/bin:/usr/bin:/bin` and `HOME=<temp>/home`
   so no Bun is on the path, `personal-config setup --profile starter --yes --projects-dir
   <temp>/empty`, `mkdir <temp>/scratch`, `cd <temp>/scratch`, `personal-config init --yes`,
   `personal-config doctor .`.

**Subagents:** none.

**Done when**

- The four gates exit 0.
- The hand-run proof in scope item 4 writes the folder's files, writes nothing new under
  `<temp>/home/.claude`, and `doctor .` exits 0. The hand-back quotes the commands and their exit
  codes. A green `bun test` cannot show this: it runs the TypeScript under Bun, not the bundle
  under Node.
- The new CI step is green on a pushed run. Zach pushes; until he does, the hand-back says
  "CI step written, not seen running" (R10).

**Watch for:** the `node-install` job runs with no Bun on `PATH` on purpose. A step that reaches
for `bun` passes on a developer machine and fails only in CI.

## 3. Dials

The six dials of `DESIGN.md` §6 stand at their defaults (D7). The plan opens none. The copy for the
DIAL-2 and DIAL-3 refusals and the DIAL-4 notice is `DESIGN.md` D11.

## 4. Seams reserved, deliberately not built

- **Making `setup` read each repo's `.personal-config.json`.** Out of scope (`DESIGN.md` §2). BD-3
  and D5 make the gap between the two commands visible; closing it is a separate item.
- **A fix for F1.** Board item 101. `init` cannot cause it (D2), and `setup` is unchanged here.
- **A second website rung for "add a project".** A portfolio item, if wanted (`DESIGN.md` §2).
- **A checkpoint for `init`.** BD-4 records the reversal.
- **Removing files from a folder, or an uninstall for one project.** Not built (`DESIGN.md` §2).

## 5. Repo hazards, with live numbers

- **CI has not run since 2026-10-05.** `origin/main` is `c334832`, 19 commits behind `HEAD`
  (S2). Phase 3's CI proof waits on a push of everything before it.
  *Found 2026-10-16 by board item 104:* the pushed run's `gates` job will fail on both runners
  whatever this effort does. `docs/incomplete/worktree-sweep/SCOPE.md`, tracked since `f378ab4`,
  holds three `relative-dates` findings (`:62`, `:101`, `:122`), and a copy of `git ls-files` with
  this phase's three files laid over it reports exactly those three from `doctor . examples`. The
  `node-install` job needs only `pack`, so it still runs and can pass. No board item owns that
  file. `origin/main` is 25 commits behind `HEAD` at `4581e81`.
- **The golden file pins `setup`'s output.** `tests/golden/full-track.json` changes only for
  `config.json` (D10); any other moved entry is a defect.
- **`finish` is shared** and is the confirm gate pinned by `tests/decline-seam.test.ts` (F10).
- **Item 94 owns this repo's rendered files** and runs `setup` here. It does not touch `src/`, so it
  does not collide, but its run will rewrite `.personal-config.json` in this checkout; phase 2's
  tests must not read this repo's own copy.

## 6. Session protocol

Read `standard/AGENT-PRACTICES.boilerplate.md` Parts 1 and 2 and `docs/conventions-ts.md` before
any `.ts` edit. One phase per session, in order. Each phase closes with `/close-out`, updates its
status header here to `BUILT` with the commit, and records any deviation as an `As built:` note
under the decision in `DESIGN.md`. Never `git commit` or `git push`; end with the two copyable
blocks.

## 7. GATE 2, asked and answered 2026-10-16

Zach answered the three questions in one batch on 2026-10-16 and took every recommendation:
Q1 A (`DESIGN.md` D10), Q2 plain (D11), Q3 approved as written. The questions as asked:

1. **Q1. Where the track notice and the four unsaved answers come from (F2, F3).**
   - **A. `setup` records them.** *Recommended.* `setup` writes the `you` answers it rendered the
     global files from under one new key in `config.json`, outside `answers`, so the merge and the
     hash never read it. `init` compares the track against it and takes the four answers from it,
     so its `.personal-config.json` matches what `setup` would write. Cost: this amends
     `DESIGN.md` §4's first rule for one file, `config.json`, and its golden entries move. A
     `config.json` from an older version has no key: `init` then prints no notice.
   - **B. No change to `setup`.** `init` compares the skill set installed in `~/.claude/skills/`
     with the set this folder's track would install, and takes the four answers from the folder's
     file, else the profile. Cost: the notice is silent when `skills` is `none`, and a new
     folder's `.personal-config.json` records profile values for `chatStyle` and the others that
     the person may have answered differently. Its stamp hash then differs from `setup`'s for the
     same folder, though every byte matches.
   - **C. Drop the notice.** A dated supersession of D6.
2. **Q2. The register for three new messages.** Q5 settled the D3 copy as plain.
   - **Plain.** *Recommended*, to match D3.
     Notice: "This folder is set up as {folder}; your global rules and skills were set up for {saved}. `init` leaves them as they are. Run `personal-config setup` to change them."
     DIAL-2: "{path} holds {n} git repos. `init` sets up one project. To set up all of them, run `personal-config setup --projects-dir {path}`."
     DIAL-3: "`init` does not set up your home directory. Run it inside a project folder."
   - **Warm.**
     Notice: "Note: this folder is {folder} work, and your global rules and skills were set up for {saved} work. They still apply here, but some may not fit. `personal-config setup` can change them."
     DIAL-2: "This looks like a folder of projects ({n} git repos inside). `init` works on one project at a time: run it inside the one you want, or run `personal-config setup --projects-dir {path}` for all of them."
     DIAL-3: "That is your home directory. A ledger and a standard there would apply to everything under it, so run `init` inside one project folder."
   - **Terse.**
     Notice: "Track {folder} differs from global {saved}. `personal-config setup` changes the global files."
     DIAL-2: "{n} repos under {path}. Use `personal-config setup`."
     DIAL-3: "Not in your home directory. Run `init` in a project."
3. **Q3. The phases, their order and their drivers.** Three phases in lane D, serial, each driven by
   Opus 5.5, with the CI step in phase 3. *Recommended:* approve as written.
