<!-- personal-config v0.1.0 · 2026-09-15 · config e3a91f04 · standard v1.0.0 -->
# Adapt the working standard to leaflet

**Model: Default.** Run this once, in a fresh session, in `~/Projects/leaflet`. Do no feature
work in the same session: adaptation costs 40–80k of context and you want the whole budget for
it.

> **This is an example** of what `personal-config setup` writes to `<repo>/PART0-PROMPT.md` and
> copies to your clipboard. `leaflet` is fictional. Yours will name your repo and your answers.

`personal-config` has already written the files listed at the bottom and filled every
placeholder a human could answer. **What is left is the half only this repo knows** — the gates,
the gates that lie, the directory map, the hazards. That is Part 0 of the standard, and it is
what this prompt is for.

Read `docs/AGENT-PRACTICES.md` in full first. Then do its Part 0, sections 0.1 and 0.4 through
0.7, in order. **0.2 and 0.3 are already done** — the profile is Profile L (ledger + board) and
Appendix A is filled; do not re-ask them.

## 0.1 — Inventory, read-only. Propose nothing yet.

```bash
ls -a; cat README* 2>/dev/null | head -60
cat package.json go.mod Cargo.toml pyproject.toml Makefile project.yml Package.swift 2>/dev/null | head -80
ls .github/workflows 2>/dev/null && cat .github/workflows/*.y*ml 2>/dev/null | head -120
ls docs design 2>/dev/null; ls .claude 2>/dev/null; cat CLAUDE.md AGENTS.md 2>/dev/null | head -40
git log --oneline -20; git worktree list; git status --ignored --short | grep '^!!'
```

Answer these, with citations:

1. **What are the gates?** The exact commands that prove a change is sound. **Run every one once
   before you write it down.** A command in a standards file that has never been run in this
   repo is a trap for every session after you.
2. **Which gates can lie?** A checker that skips silently when an env var is missing; a lint run
   where everything is a warning; a suite that prints `ok` having run nothing.
3. **What does a fresh checkout not have?** Gitignored-but-required files. That block becomes
   `{{WORKTREE_SETUP}}`.
4. **Is there a numbered shared resource?** Migrations, ledger steps, fixture ids.
5. **How is it built and run, and what can an agent not verify here?**
6. **How does it ship?** Whether merge is the same as deploy. If nothing ships on its own, say
   so: merged is not shipped.

What discovery already found, to be verified rather than trusted:

- Languages detected from marker files: go, typescript.
- Package manager from the lockfile: bun.
- CI: `.github/workflows` exists — take the gates from it.
- Migrations: `migrations` — it is a numbered shared resource; read names, not counts.
- Existing docs: CLAUDE.md.
- Worktrees listed by git: 1.

## Then

- **0.4 — Cut what does not apply.** Part 12 is already cut. Verify each remaining candidate
  before cutting. After cutting, grep for the words you cut and fix every survivor — a rule that
  points at a deleted one is worse than either. **Never cut Part 1.**
- **0.5 — Fill `CLAUDE.md`.** Its scaffold is already written; put the gate commands you ran in
  0.1 and the hazards you found into it.
- **0.6 — GATE 0.** Stop and ask the owner, in chat, in one batched question, in the same turn
  adaptation finishes. Everything `personal-config` could not settle goes in that one message.
- **0.7 — Stamp and delete Part 0.** Change the header to `**Adapted to this repo <date>, solo
  mode.**`, note what you cut and why, then delete the rest of Part 0. Run
  `grep -nE '\{\{' docs/AGENT-PRACTICES.md` and fix every hit outside Appendix A.

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
in chat, in the same turn. Never run `git commit`, `git push`, `git add -A` or `git add .` —
print the two blocks instead.
