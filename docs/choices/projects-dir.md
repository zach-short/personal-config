# Where your projects live

## What this is

One directory the wizard scans, one level deep, for the projects you want set up. Nothing
outside it is read.

The question says **projects**, not repos, and it means it: a git repo qualifies because `.git`
is there, and a plain directory qualifies unless a tool made it or it is empty of anything a
person would see (setup-tracks `DESIGN.md` D5). Each one is tagged with which it is, and that
tag — not your answer about git — is what decides whether a given target gets commit rules.
The word was settled on the portfolio in 2026-09-17 and is reused rather than re-picked here
(D21): it is true of a repo and of a folder, and needs no slash.

## What the scan actually does

It is entirely local and entirely read-only. For each project it looks at marker files to work
out what it is: `package.json` plus a lockfile for the package manager, `go.mod`, `project.yml` or
`Package.swift`, `pyproject.toml`, `Cargo.toml`; `.github/workflows` for CI; `migrations/`,
`supabase/migrations` or `db/migrate` for migrations; existing `HANDOFF.md`, `PASSOFF.md`,
`docs/incomplete/`, `AGENT-PRACTICES.md`, `CLAUDE.md` or `AGENTS.md`; `git worktree list`; and
the origin remote's owner — the last two asked of git targets only, because every git command
resolves the *enclosing* repository and a folder inside a checkout would otherwise report an
owner it does not have. It shows you a table and you pick which projects to set up.

**Nothing leaves your machine.** No file contents are uploaded, nothing is sent anywhere, and
no network call is made except the `gh api user` that establishes your GitHub login — and only
if `gh` is installed.

## Why an existing ledger changes the outcome

If a project already has a ledger, a board, or project folders under *any* name, the work
profile is already chosen and the wizard adopts what is there rather than renaming it. That is the
standard's own rule, and it exists because a rename breaks every reference in every other doc.

## The argument against scanning at all

You may only want one project set up, and a scan of thirty is noise. Pass `--projects-dir`
pointing at a directory containing just that one, or re-run and pick it from the table.

## What it writes and where

Nothing. This answer only decides what the wizard looks at.

## How to undo it

Nothing to undo.
