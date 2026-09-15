# personal-config — staged onboarding

This repo is a staged, opt-in installer for a personal Claude Code working style. It does
nothing on its own — it only acts when the user says `start` (or `begin`, `setup`, or asks to
get started) in a session running inside this directory.

## Trigger

When the user says `start` (or an equivalent), run the flow below. Before Stage 1, silently
read `README.md` in this repo for the framing, then read the user's existing
`~/.claude/CLAUDE.md` if it exists, so any addition merges with what's already there instead of
conflicting with or duplicating it. Say in one line what you found (empty, or a summary).

Go through the six stages **one at a time, in order** — never batch them into one question.
For each stage:

1. Explain in 2-3 sentences what it does and why, using the stage's example below.
2. Ask via `AskUserQuestion` with options: **Adopt as-is** / **Adapt it** (then ask follow-up
   specifics before writing anything) / **Skip**.
3. Only after the answer, apply that stage (see "How to apply" per stage) before moving on.
   Don't get ahead of the user's answers.
4. If a stage depends on something skipped earlier, say so and offer a fallback or skip it too.

Stages 1–3 write to `~/.claude/CLAUDE.md` (global, applies to every project). Stages 4–6 write
to a target project directory, which is **not** this repo — ask once, before Stage 4, which
project directory these should apply to (current directory the session started in is the
default if it isn't this repo; otherwise ask for a path). Skip stages 4-6 entirely if the user
says they don't have a target project right now — tell them they can clone this repo again (or
just re-run `start` in a future session from inside this repo) whenever they do.

For any project-level file (stages 4–6), before writing: check that directory's `.gitignore`
and `.git/info/exclude` for an entry covering it, and add one if missing (e.g. `CLAUDE.local.md`,
`HANDOFF.md`, `PASSOFF.md`). These are personal process, never meant to be committed to the
target project's own repo.

For `~/.claude/CLAUDE.md` (stages 1–3): if the file already has a section covering the same
ground, ask whether to replace it or leave it — never silently duplicate or overwrite.

---

## Stage 1 — Commit discipline

What: never run `git commit` or `git push` directly. Instead, at the end of a task, print two
copy-pasteable bash blocks — a `git add` of only the files touched this session, then a
`git commit -m "..."` — and stop.

Example:
```bash
git add src/utils/foo.ts
```
```bash
git commit -m "fix: handle null timezone in slot calc"
```

Why: keeps the user as the actual author of history — useful when running multiple sessions in
one repo at once, since only they know which uncommitted files belong to which.

How to apply: append `templates/01-commit-discipline.md` to `~/.claude/CLAUDE.md` under a
`# Commits` heading. If the user adapts it (e.g. allow commit but not push, or allow
attribution), edit the template's wording to match before appending — don't append it verbatim
if it no longer reflects what they agreed to.

## Stage 2 — Model-routing awareness

What: if a task explicitly names a model (a board's Model column, a doc's `**Model: X**`
line), check the session's own model against it before starting. If they don't match, either
delegate to a subagent running that model, or stop and write a hand-off brief — never silently
do the work on the wrong model.

Example: a task board row says "Model: Opus" but the session is on a lighter model — spawn an
Opus subagent with the full prompt, or write a hand-off note and stop.

Why: treats model choice as a deliberate safety/quality decision, not a preference to override
because a task "looked simple."

How to apply: append `templates/02-model-routing.md` to `~/.claude/CLAUDE.md`. Skip by default
if the user doesn't use model-tagged tasks or boards — say so as part of asking.

## Stage 3 — Prefer live docs tools over memory for library APIs

What: for questions about a specific library/framework/SDK/API, prefer a connected docs-lookup
MCP tool over answering from training data, which can be stale.

Example: "how do I do optimistic updates in TanStack Query" → look it up via the docs tool
rather than recalling it from memory.

Only relevant if a docs MCP is connected. Ask the user which one (Context7 is common) — if
none is connected, ask whether to skip this stage or note it as a future addition once one is.

How to apply: fill `{{DOCS_MCP_NAME}}` in `templates/03-docs-lookup.md` with the tool's actual
name, then append the result to `~/.claude/CLAUDE.md`.

## Stage 4 — Untracked project router (CLAUDE.local.md)

What: a project-local, git-ignored file that sits *below* the target project's own tracked
rules in precedence — it adds personal process on top and never edits or overrides the
project's own `CONTRIBUTING.md`/`AGENTS.md`/lint configs. Most useful in a repo whose
conventions aren't the user's to set (a course fork, an OSS project, a client repo).

Why: stops an agent from "fixing" repo-owned conventions it disagrees with, while still
letting the user keep personal environment notes and working style.

How to apply: copy `templates/04-CLAUDE.local.md.template` to `<target project>/CLAUDE.local.md`,
filling in `{{PROJECT_NAME}}`. Leave the environment-quirks section as a stub — it fills in
over time, not now.

## Stage 5 — Personal ledger (HANDOFF.md)

What: an untracked, append-only "what is true" log — dated environment facts, settled
decisions, and a numbered step log where each session appends what it did and what's left,
instead of re-deriving things every session.

Example entry:
```markdown
**3. Recorded the real gate baselines.** Done 2026-09-14. `yarn test` exit 0, 407 files,
4119 tests. Left owed: `yarn build` has never been run here.
```

Why: a fresh session doesn't re-discover the same environment gotchas or re-ask settled
questions.

How to apply: copy `templates/05-HANDOFF.md.template` to `<target project>/HANDOFF.md`, filling
in `{{PROJECT_NAME}}` and `{{DATE}}` (today, absolute). If the user wants to adapt it (e.g. skip
the step log), trim the corresponding section before writing.

## Stage 6 — Personal task board (PASSOFF.md)

What: an untracked board of "what's next" — one row per task (status/model/dependencies), and
a standalone, self-contained prompt below the board per task, so a fresh session or a different
model can pick it up without replaying the whole conversation.

Example row:
```markdown
| # | Task | Status | Model | Waits on |
|---|------|--------|-------|----------|
| 3 | Fix flaky checkout test | OPEN | Default | — |
```

Why: makes handoff between sessions (or between models) cheap and explicit — most useful for
multi-day or multi-agent work; skip if the user only runs short single sessions.

How to apply: copy `templates/06-PASSOFF.md.template` to `<target project>/PASSOFF.md`, filling
in `{{PROJECT_NAME}}` and `{{DATE}}`.

---

## Wrap-up

After all six stages: list what was adopted vs. adapted vs. skipped; show the final file tree
of everything created or edited (global and, if applicable, the target project); and run
`git status --ignored` in the target project to confirm the new files are actually ignored, not
about to be swept into a commit.
