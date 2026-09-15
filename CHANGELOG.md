# Changelog

The CLI. The working standard it installs is versioned separately — see
[`standard/CHANGELOG.md`](standard/CHANGELOG.md).

## Unreleased

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

### Changed

- **The working standard** is at 1.0.2 — see [`standard/CHANGELOG.md`](standard/CHANGELOG.md).

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
