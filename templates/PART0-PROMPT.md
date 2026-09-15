# Adapt the working standard to {{PROJECT_NAME}}

**Model: {{MODEL_DEFAULT}}.** Run this once, in a fresh session, in `{{REPO_PATH}}`. Do no
feature work in the same session: adaptation costs 40–80k of context and you want the whole
budget for it.

`personal-config` has already written the files listed at the bottom and filled every
placeholder a human could answer. **What is left is the half only this repo knows** — the
gates, the gates that lie, the directory map, the hazards. That is Part 0 of the standard, and
it is what this prompt is for.

Read `{{STANDARD_PATH}}` in full first. Then do its Part 0, sections 0.1 and 0.4 through 0.7,
in order. **0.2 and 0.3 are already done** — the profile is `{{WORK_PROFILE}}` and Appendix A
is filled; do not re-ask them.

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
   once before you write it down.**
2. **Which gates can lie?** A checker that skips silently when an env var is missing; a lint
   run where everything is a warning; a suite that prints `ok` having run nothing.
3. **What does a fresh checkout not have?** Gitignored-but-required files. That block becomes
   `{{WORKTREE_SETUP_TOKEN}}`.
4. **Is there a numbered shared resource?** Migrations, ledger steps, fixture ids.
5. **How is it built and run, and what can an agent not verify here?**
6. **How does it ship?** Whether merge is the same as deploy. If nothing ships on its own, say
   so: merged is not shipped.

What discovery already found, to be verified rather than trusted:

{{DISCOVERY_SUMMARY}}

## Then

- **0.4 — Cut what does not apply.** {{CUT_HINTS}} After cutting, grep for the words you cut and
  fix every survivor. **Never cut Part 1.**
- **0.5 — Fill `{{ROUTER_FILE}}`.** Its scaffold is already written; put the gate commands you
  ran in 0.1 and the hazards you found into it.
- **0.6 — GATE 0.** Stop and ask the owner, in chat, in one batched question, in the same turn
  adaptation finishes. Everything `personal-config` could not settle goes in that one message.
- **0.7 — Stamp and delete Part 0.** Change the header to `**Adapted to this repo <date>,
  {{MODE}} mode.**`, note what you cut and why, then delete the rest of Part 0. Run
  `grep -nE '\{\{' {{STANDARD_PATH}}` and fix every hit outside Appendix A.

## Already written, do not recreate

{{WRITTEN_FILES}}

**Session rules, inline:** absolute dates only, never "today" or "recently". Every claim carries
a `file:line` or the command that produced it. Grep before recording an absence. When you
disprove something, record the disproof where the wrong claim lives. Ask the owner in one batch,
in chat, in the same turn. {{COMMIT_RULE}}
