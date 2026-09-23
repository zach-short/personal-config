<!-- personal-config v0.5.0 · 2026-09-23 · config 11fe5083 · standard v1.2.0 -->
# Adapt the working standard to leaflet

**Model: your default tier.** Run this once, in a fresh session, in `~/code/leaflet`. Do no
feature work in the same session: adaptation cost 40–80k of context in the two repos the standard
was written from (2026-09-14), and you want the whole budget for it.

> **This is an example** of what `personal-config setup` writes to `<repo>/PART0-PROMPT.md` and
> copies to your clipboard. `leaflet` is fictional. Yours will name your repo and your answers.

`personal-config` has already written the files listed at the bottom and filled every
placeholder a human could answer. **What is left is the half only this repo knows** — the
gates, the gates that lie, the directory map, the hazards. That is Part 0 of the standard, and
it is what this prompt is for.

Read `docs/AGENT-PRACTICES.md` in full first. Then do its Part 0, sections 0.1 and 0.4 through 0.7,
in order. **0.2 and 0.3 are already done** — the profile is `Profile L — ledger + board` and Appendix A
is filled except `{{WORKTREE_SETUP}}` and `{{BUILD_CMD}}`, which answers 3 and 1 below
produce; do not re-ask the rest.

## 0.1 — Inventory, read-only. Propose nothing yet.

```bash
ls -a; cat README* 2>/dev/null | head -60
cat package.json go.mod Cargo.toml pyproject.toml Makefile project.yml Package.swift 2>/dev/null | head -80
ls .github/workflows 2>/dev/null && cat .github/workflows/*.y*ml 2>/dev/null | head -120
ls docs design 2>/dev/null; ls .claude 2>/dev/null; cat CLAUDE.md AGENTS.md 2>/dev/null | head -40
git log --oneline -20; git worktree list; git status --ignored --short | grep '^!!'
```

Answer these, with citations:

1. **What are the gates?** The exact commands that prove a change is sound. **Run every one
   once before you write it down.** The build command among them becomes `{{BUILD_CMD}}`.
   Put the one command that proves the whole repo — what you would run before handing work
   back — into `.personal-config.json` as `gateCommand`. It is written empty because only this
   session knows it, and the completion-gate hook runs whatever is there and nothing when it is
   empty. One plain command, no quotes inside it: it is read with `sed`, not a JSON parser.
2. **Which gates can lie?** A checker that skips silently when an env var is missing; a lint
   run where everything is a warning; a suite that prints `ok` having run nothing.
3. **What does a fresh checkout not have?** Gitignored-but-required files. That block becomes
   `{{WORKTREE_SETUP}}`.
4. **Is there a numbered shared resource?** Migrations, ledger steps, fixture ids.
5. **How is it built and run, and what can an agent not verify here?**
6. **How does it ship?** Whether merge is the same as deploy. If nothing ships on its own, say
   so: merged is not shipped.

What discovery already found, to be verified rather than trusted:

- Languages detected from marker files: typescript, go.
- Package manager from the lockfile: bun.
- CI: `.github/workflows` exists — take the gates from it.
- Migrations: migrations.
- Existing docs: CLAUDE.md.
- Extra worktrees beyond this checkout: 0.

## Then

- **0.4 — Cut what does not apply.** Part 12 is already cut; its cross-references (`grep -n 'Part 12'`) are still yours to fix here. After cutting, grep for the words you cut and
  fix every survivor. **Never cut Part 1.**
- **0.5 — Fill `CLAUDE.md`.** Its scaffold is already written; put the gate commands you
  ran in 0.1 and the hazards you found into it.
- **0.6 — GATE 0.** Stop and ask the owner, in chat, in one batched question, in the same turn
  adaptation finishes. Everything `personal-config` could not settle goes in that one message.
- **0.7 — Stamp and delete Part 0.** Change the header to `**Adapted to this repo <date>,
  solo mode.**`, note what you cut and why, then delete the rest of Part 0. Run
  `grep -nE '\{\{' docs/AGENT-PRACTICES.md` and fix every hit outside Appendix A.
- **0.8 — Mark the adapted files as this repo's own.** Add one word to the generator's stamp —
  the `<!-- personal-config … -->` line at the top — in every file you rewrote here, at minimum
  `docs/AGENT-PRACTICES.md` and `CLAUDE.md`: append ` · adapted` after the standard version,
  inside the comment, so the line ends `standard v<x> · adapted -->`. That word withdraws the
  generator's permission to overwrite the file and keeps its provenance readable: a later
  `setup` leaves the file alone, and `doctor` can still say which standard it came from and
  tell you when that standard moves. Leaving the word off means a re-run overwrites this whole
  session's work — recoverably, via `personal-config undo`, but there is no reason to rely on
  that. Do the same to the ledger and the board once they hold real entries. Then run
  `grep -rn 'personal-config v' . | grep -v adapted` and confirm nothing you edited is listed.

## Already written, do not recreate

```
CLAUDE.md                      the router every session reads
HANDOFF.md                     the ledger — what is true
PASSOFF.md                     the board — what is next
docs/AGENT-PRACTICES.md        the standard, Appendix A filled, Part 0 still to run
docs/conventions-go.md         the Go code standard, seeded
docs/conventions-typescript.md the TypeScript code standard, seeded
.personal-config.json          per-repo config, git-ignored
```

**Session rules, inline:** absolute dates only, never "today" or "recently". Every claim carries
a `file:line` or the command that produced it. Grep before recording an absence. When you
disprove something, record the disproof where the wrong claim lives. Ask the owner in one batch,
in chat, in the same turn. Never run `git commit`, `git push`, `git add -A` or `git add .` — print the two blocks instead.
