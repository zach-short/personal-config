# Where your repos live

## What this is

One directory the wizard scans, one level deep, for git repositories. Nothing outside it is
read, and nothing is read that is not a git repo.

## What the scan actually does

It is entirely local and entirely read-only. For each repo it looks at marker files to work out
what it is: `package.json` plus a lockfile for the package manager, `go.mod`, `project.yml` or
`Package.swift`, `pyproject.toml`, `Cargo.toml`; `.github/workflows` for CI; `migrations/`,
`supabase/migrations` or `db/migrate` for migrations; existing `HANDOFF.md`, `PASSOFF.md`,
`docs/incomplete/`, `AGENT-PRACTICES.md`, `CLAUDE.md` or `AGENTS.md`; `git worktree list`; and
the origin remote's owner. It shows you a table and you pick which repos to set up.

**Nothing leaves your machine.** No file contents are uploaded, nothing is sent anywhere, and
no network call is made except the `gh api user` that establishes your GitHub login — and only
if `gh` is installed.

## Why an existing ledger changes the outcome

If a repo already has a ledger, a board, or project folders under *any* name, the work profile
is already chosen and the wizard adopts what is there rather than renaming it. That is the
standard's own rule, and it exists because a rename breaks every reference in every other doc.

## The argument against scanning at all

You may only want one repo set up, and a scan of thirty is noise. Pass `--projects-dir` pointing
at a directory containing just that repo, or re-run and pick one.

## What it writes and where

Nothing. This answer only decides what the wizard looks at.

## How to undo it

Nothing to undo.
