# Changelog

The CLI. The working standard it installs is versioned separately — see
[`standard/CHANGELOG.md`](standard/CHANGELOG.md).

## Unreleased

### Fixed

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

- **The working standard** is at 1.0.1 — see [`standard/CHANGELOG.md`](standard/CHANGELOG.md).

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
