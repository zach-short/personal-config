# Changelog

The CLI. The working standard it installs is versioned separately — see
[`standard/CHANGELOG.md`](standard/CHANGELOG.md).

## 0.2.3 — 2026-09-16

### Changed

- **It runs on Node now, so `npx personal-config` works without Bun installed.** The bin was
  `src/cli.ts` behind a `#!/usr/bin/env bun` shebang, which made npm a working *installer* and
  Bun a hard *runtime* requirement: `npx personal-config@0.2.2 --version` printed the version on
  a machine that happened to have Bun on its `PATH`, and died with `env: bun: No such file or
  directory` on one that did not. The package now ships `dist/cli.js`, a `bun build
  --target=node` bundle with a `node` shebang, and `engines` asks for `node >= 20` instead of
  `bun >= 1.2.0`.

  Shipping the TypeScript and letting Node strip the types is not an option and never was: Node
  refuses to strip types under `node_modules` — `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` —
  which is exactly where an installed package lives. Pointing Node at a *checkout* does work,
  which is what makes it easy to conclude the opposite.

  Bun is still the dev runtime. `bun test`, `bun run typecheck`, `bun run lint` and
  `bun run build` are unchanged, and `bunx personal-config` still works.

- **All 48 `Bun.*` calls became `node:` builtins**, behind one new module, `src/lib/disk.ts`, for
  the file reads and writes. Two behaviours were preserved deliberately rather than inherited by
  accident: `exists()` reports a *regular file*, because `Bun.file().exists()` answered `false`
  for a directory and `discover.ts` and `isGitRepo` are both built on that; and `writeText()`
  creates parent directories, because `Bun.write` did.

- **`repoRoot()` walks up to the nearest `package.json`** instead of counting two `..` segments
  from its own location. The bundle sits at `dist/cli.js` and a checkout runs from `src/lib/`, so
  a fixed count is wrong in one of them — and wrong resolved into `node_modules/`, which would
  have surfaced as a missing profile or template long after startup rather than as a crash.

### Added

- **CI packs the tarball and runs it on Node 20, 22 and 24 with no Bun on `PATH`.** Every gate
  before this ran under Bun, so none of them could see the one thing a published package has to
  do. The job fails if `bun` is findable, because a pass under Bun would prove nothing.

## 0.2.2 — 2026-09-16

### Fixed

- **The stamp guard is real now.** The README has promised since 0.1.0 that "files without that
  stamp are not this tool's to overwrite", and nothing enforced it: `isOurs()` existed in
  `src/lib/stamp.ts` with no caller anywhere in `src/`, and `applyStrategy` returned the new
  contents unconditionally. A re-run of `setup` replaced `CLAUDE.md`, the ledger, the board and
  `docs/AGENT-PRACTICES.md` whether or not a person had rewritten them. `resolvePlan` now asks
  before every write: if something is already at the path, carries no stamp, and the file this
  run would put there does, nothing is written and the path is named in the report.

  It keys on whether *we* claim the file rather than on the write strategy, because the two
  differ. The merge into `settings.json`, the lines appended to an ignore file and the in-place
  edits behind `passoff claim` and `archive` all land in files a person owns, and all three read
  what is there and keep it — keying on the strategy would have refused every one of them.

- **A stamped file that you edited is still overwritten, and that is now written down.** Nothing
  in a stamp records the bytes that were written, so a hand edit to a generated file leaves no
  trace the tool can read. The overwrite is previewed, backed up and undone by
  `personal-config undo` — and deleting the one stamp line is the way to take a generated file
  back for good. Part 0's prompt gained a step 0.8 telling the adapting session to do exactly
  that to the documents it rewrites, which is the case this whole guarantee exists for.

- **A test that committed a rendered plan poisoned every later test file.** `renderAll` writes
  the saved answers into the one sandbox `$HOME` the suite shares, and `loadConfig` reads that
  file as a merge layer, so whether the profile-merge tests passed depended on the order Bun
  happened to run the files in. `clearSavedAnswers()` in `tests/helpers.ts` is now called by
  every test that commits one.

### Documentation

- **`doctor`'s silence on an unstamped file is a decision, not an accident.** `stampDrift` has
  always returned nothing without a stamp; it now says why, and a test pins it to the guard. The
  two have to agree, or stripping a stamp would buy a drift finding no re-run could ever clear.

## 0.2.1 — 2026-09-16

### Added

- **`doctor` checks R8: a settled decision is not quietly reversed.** Every other rule reads a
  file; this one reads `git diff HEAD`, because a quiet reversal is invisible in the file it
  lands in. A hunk that removes or rewrites a line under a `## Settled` heading is a finding
  unless the same file's diff states a supersession. Adding an entry under Settled is recording
  a decision, not reopening one, and is never flagged. It cannot see an untracked ledger, by
  construction — under the untracked work profile there is no diff of it to read, so R8 stays a
  reader's rule there.

### Fixed

- **Two README claims that 0.2.0 made false.** The control guarantee said the only network call
  in the program was `gh api user`; `setup --from <url|id>` fetches, so the guarantee now names
  both calls and says the fetch happens only when you pass the flag. And the merge chain under
  Profiles omitted `--from`, which sits above the saved config and the repo file rather than
  below them like `--profile`.

### Documentation

- **`catalog` and `setup --from` are in the README.** Both shipped in 0.2.0 and neither was
  documented, on a package that is public.

## 0.2.0 — 2026-09-16

### Added

- **`catalog` writes the questions out as data.** `catalog.json` carries every question — its
  text, options, examples and condition — and the 28 long forms keyed by `readMore`, stamped
  `<version>+<sha256 of the source>[:8]` so a consumer can tell which questions it was built
  from. A test fails when the questions change and the catalog was not regenerated, which is
  the only way a second copy of the questions stays honest.
- **`setup --from <src>` starts from a profile you already have.** A local path, an https URL,
  or the 8-character id a site hands back, which resolves against `package.json`'s `homepage`
  as `/p/<id>`. It sits above the saved config and the repo file and below the flags, so thirty
  answers given seconds ago cannot lose silently to a config saved long before; the cost,
  accepted, is that it re-renders an already-configured repo.
- **`passoff next` and `passoff claim <n>` read the board and take an item off it.** `next`
  prints the first `OPEN` row, its model and lane, and the standalone prompt written under it —
  and warns when something already `IN FLIGHT` owns one of the same files, which is the whole
  reason the "Files it owns" column exists. `claim` marks the row `IN FLIGHT` and dates the
  claim in the item's own section rather than in the status cell, because §2.3 allows six status
  words "and no others" and `doctor` enforces it. It previews both edits exactly — the generic
  diff would print the four hundred lines between them — and refuses if the board changed while
  it was reading it, which narrows a lost update to milliseconds and turns it into a refusal
  instead of a silent overwrite.
- **`handoff step` reports the next free ledger number by reading the ledger.** Which is the
  rule (§2.1) — the failure it prevents is trusting a number written somewhere else. It reports
  rather than reserves, and says so: reserving means writing, and the only thing there is to
  write at that moment is an empty step. It prints the ledger's modification time so a session
  that has been thinking can tell whether the answer went stale, flags a log that is already
  non-contiguous, and scaffolds what §2.1 says a step must name.
- **`archive <slug>` runs Part 7's archiving steps.** It greps every tracked file for referrers
  and splits them into paths read at runtime (which block the move) and prose citations (which
  will merely point at nothing); checks the folder is committed in its final state and prints
  the two commit blocks when it is not; prints the `git mv`, or performs it under `--move` and
  verifies every file arrived; then writes the archive index line and marks the doc's line in
  the docs index. The two index lines are written only once the folder is actually in the
  archive — §8.2 calls a line pointing at a folder that is not there worse than no line at all —
  so the shape is run it, move it, run it again, and `--move` collapses the two. It moves by
  default never, because Part 7 step 2 wants a commit this tool is forbidden to make. `<slug>`
  is a folder under `docs/incomplete/` or any path in the repo, so one command serves a
  project-folder repo and a ledger-and-board one alike.

- **`worktree <lane>` prints a lane's checkout plan with its fresh-checkout recipe.** The
  recipe is read out of the adapted standard `setup` wrote, at the path `.personal-config.json`
  records as `standardPath` — the first thing to read that key back rather than write it. It
  takes *every* fenced block under the recipe heading, not the first: a real adapted copy splits
  its recipe into install plus five gitignored files to copy in, and taking only the first drops
  the half that actually costs you a gate. It refuses, naming the fix, when the repo was never
  set up, when the recorded standard is not on disk, and when Part 0 left `{{WORKTREE_SETUP}}`
  unfilled. It prints rather than performs: `undo` cannot reach a worktree, and a checkout made
  without its recipe is the failure Part 6 opens by naming. `worktreePath` overrides the default
  `../<repo>-<lane>` for repos that keep worktrees elsewhere.
- **`context --sentinel <phrase>` reports the current session's context size.** Part 5's
  measurement, reimplemented in Bun so it needs no `python3` and no heredoc quoting around the
  sentinel. The sentinel is required, not optional: with several sessions in one repo, newest
  transcript by modification time is the wrong one often enough to have reported a neighbouring
  session's size as ours. No match lists the candidates rather than falling back to a guess.

- **`← back` on every choice question but a phase's first.** The wizard only ever moved
  forward: `askChoice`'s loop re-asked the *same* question and the phase runner was a plain
  `for`, so a wrong answer on question four could only be fixed by finishing the run and
  starting another. It now sits under `Read more…` and steps the runner back one *asked*
  question — not one index, so a question skipped by its condition is stepped over rather than
  shown to someone who never saw it. It agrees with the checkpoint: a corrected answer replaces
  the entry it corrects instead of appending beside it, and stepping back inside a resumed run
  stops the replay, which would otherwise hand back the very answer you went back to change.
  `text` and `confirm` questions carry no option list, so they do not offer it.
- **An interrupted `setup` can be picked up where it left off.** Every answer is written to
  `~/.config/personal-config/run.json` as it is given, and the next run offers to resume from
  it — so `Ctrl+C` on question twenty of thirty costs one answer instead of twenty. The file is
  transient, not the saved config: a run that reaches its end deletes it, declining the offer
  deletes it, and a checkpoint written by another version of the CLI is discarded rather than
  replayed into a question catalog that may have changed under it. A preview (`--dry-run`) and a
  declined write both keep it, because those are the answers a person would least like to type
  again. Replay stops at the first question that does not match, and at a repo set picked
  differently from the previous run, so it can never answer one repo's questions with another's.
  `--yes` neither reads nor writes it.
- **A cancelled prompt says what survived.** Every exit — a question, the repo picker, a declined
  preview — now prints the same line, and it names the checkpoint when there is one to name.

### Fixed

- **A freshly configured repo no longer reports drift on its first `doctor` run.** `setup`
  hashed the answers it had just collected, but nothing ever wrote them down, so `doctor` could
  only rebuild whichever profile it happened to be given — six `stamp-drift` findings telling
  the owner to re-run the setup they had just run. `<repo>/.personal-config.json` now carries
  the answers the hash covers, and one function owns that set so the two sides cannot fall out
  of step. Three inputs left the hash: the directory `setup` was pointed at, which shapes no
  rendered byte, and the three `models.*` answers, already hashed as the model tiers they
  derive. The stamp is also computed per repo rather than per run, because an archive home is
  resolved per repo and the resolved value is what gets saved. **Repos configured by an earlier
  version will report drift once, and re-running `setup` clears it.**
- **The Part 0 prompt no longer overstates what is filled.** It said "Appendix A is filled"; the
  fresh-checkout recipe and the build command are Part 0’s to produce. The prompt and the rendered
  standard’s header now say so, and the prompt names which inventory answers produce them.
- **The Part 0 prompt counts extra worktrees.** `git worktree list` includes the checkout itself,
  so "Worktrees listed by git: 1" meant none; it now reports the worktrees beyond the one being
  set up.
- **The Part 0 prompt’s cut hint says the cross-references are still to fix.** Cutting Part 12 in
  solo mode leaves references to it in place, which §0.4 makes the Part 0 session’s job; the hint
  had said only "already cut".
- **Model routing no longer sends a build to a Deep subagent.** The rule file, its long form and
  the question’s example all said a mismatched session spawns a subagent on the assigned model
  and hands it the whole prompt; Part 4 says a Deep subagent never builds. A review or a sweep is
  delegated; a build is handed off.
- **The agent-commits Part 11 paragraph carries the two rules its long form promised** —
  `git add -N` before committing a file git has never seen, and building HEAD in isolation after
  a split commit.
- **`relative-dates` follows R1’s widened test** (standard 1.0.2): `tomorrow`, `currently`,
  `last year`, `this year` and `N days/weeks/months ago` are flagged again.
- **An adopted ledger or board name is honoured end to end.** `ledgerFile()` returned
  `HANDOFF.md` on both branches of its own ternary, so §0.2’s "adopt those files as they are"
  was never implemented, and a ledger under another name was invisible to `doctor`. Discovery,
  the renderers and `doctor` now read both names from `<repo>/.personal-config.json` through one
  module, and the `DONE — HANDOFF <n>` check follows whichever name was adopted.
- **The archive slot no longer renders the word `none`.** An unanswered archive home filled
  `{{ARCHIVE_HOME}}` with `none`, so the adapted standard told its reader closed work moves to
  `none/<slug>/`. It falls back to `docs/archive`, and the question offers an in-tree path
  instead of the word.
- **The printed commit ritual names its files.** The commit-guard hook and the Part 11 paragraph
  both ended in a bare `git commit -m`, which commits the whole index — the failure the rule
  exists to prevent when several sessions share a checkout.
- **The rule file now prints the same ritual the hook does.** That fix reached the hook and the
  standard but not `~/.claude/rules/commits.md`, so the tool installed a hook demanding one form
  and a rule teaching another. Both bodies in `src/render/rules.ts` name the files and say why,
  and so do the wizard's own example for the option and `docs/choices/commit-policy.md`, which
  now states which form ships and what it costs.

### Changed

- **`Question.when` is data, not a closure.** A `{ never }` / `{ key, is }` / `{ key, isNot }`
  spec read by one module, so the catalog can carry a question's condition and the freshness
  test can see it drift. A predicate cannot be serialized, and a hand-copied one would have
  been a second source of truth.
- **The board and the step log now have one parser each, shared by the commands and by
  `doctor`.** `src/lib/board.ts` and `src/lib/ledger.ts`; the §2.3 and §2.1 rules read through
  them, and so do `passoff` and `handoff`. Two parsers of one file drift, and the drift is
  silent in the worst direction — a row `passoff` hands out as `OPEN` that the rule never saw,
  or a step number the command offers and the rule already counts as taken.
- **A cell reading `— (item 3 done, HANDOFF 6)` names nothing to wait on.** That is how a real
  board records *why* a row waits on nothing, and reading it as a live blocker made `passoff
  next` warn that an item was waiting on the note explaining that it was not.

- **The working standard** is at 1.0.3 — see [`standard/CHANGELOG.md`](standard/CHANGELOG.md).

## 0.1.0 — 2026-09-15

First slice: `setup`, `doctor` and `undo`.

### Added

- **`setup`** — a four-phase wizard (`you`, `discover`, `practices`, `render`) built on
  `@clack/prompts`. Every question carries a one-line practical example per option, a marked
  recommendation, and a `Read more…` option that prints the long form from `docs/choices/` and
  asks again.
- **Local, read-only discovery.** Scans a chosen directory one level deep for git repos and
  detects languages, package manager, CI, migrations, existing ledger/board/standard files,
  worktrees and the remote owner. An existing ledger or board means the profile is already
  chosen: it is adopted, never renamed.
- **The ownership guard.** A repo whose `origin` owner is not your GitHub login defaults to
  untracked mode and is never offered a tracked rule file.
- **Renderers** for the global rules (`~/.claude/rules/`, one file per rule — the user's own
  `CLAUDE.md` is never edited), four workflow skills, two optional hooks, the repo router, the
  ledger and board or a project-folder scaffold, the adapted standard, per-language conventions,
  an archive index seed, ignore entries, and `PART0-PROMPT.md`.
- **Control guarantees.** Full preview tree and per-file diff before any write; one confirm for
  the batch; `--dry-run`; a header stamp on every generated file naming version, date, config
  hash and standard version; backups to `~/.config/personal-config/backups/<timestamp>/` with a
  manifest; and `personal-config undo`.
- **Profiles**, merging `starter` → `--profile <name>` → `~/.config/personal-config/config.json`
  → `<repo>/.personal-config.json` → CLI flags.
- **`doctor`** — nine rules reported as `file:line`, exit 1 on any finding: relative dates (R1),
  leftover placeholders (§0.3), ledger step numbering (§2.1), board status obligations (§2.3),
  archive index in both directions (§8.2), in-tree citations of archived paths, stamp drift, and
  personal files git can still see.
- **The working standard** moved in at `standard/`, versioned at 1.0.0.
- **`examples/`** — a filled ledger, board, archive index and Part 0 prompt for a fictional repo.

### Notes

- Bun only for this release. Bun runs the TypeScript directly, so there is no build step.
- `settings.json` is merged, never overwritten, and only after an explicit confirm.
