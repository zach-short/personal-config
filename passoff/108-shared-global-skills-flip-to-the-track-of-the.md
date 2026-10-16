# 108. Shared global skills flip to the track of the last `setup` run

*Opened 2026-10-16*, split from item 101 at its GATE 1. Zach answered Q2 of
`~/Projects/archive/personal-config/setup-global-leftovers/DESIGN.md` (then `SCOPE.md` under
`docs/incomplete/`, archived 2026-10-16; the answer is its decision D2) the same day: finding G6 is not fixed inside item 101,
it gets its own item that scopes it, with options O4 and O5 as the candidates.

**Model: Opus 5.5. Lane J. Waits on nothing to scope. A build that edits `src/render/skills.ts` waits
on item 101, which is `IN FLIGHT` and owns that file.** Scope first. Which option wins is Zach's call;
do not pick one before GATE 1.

You are picking up personal-config, a Bun and TypeScript CLI that installs documents, hooks and skills
for other people. Read `CLAUDE.md`, `docs/conventions-ts.md`, and `standard/AGENT-PRACTICES.boilerplate.md`
Parts 1 and 2 in full. Then read `HANDOFF.md` (untracked, main checkout only) and
`~/Projects/archive/personal-config/setup-global-leftovers/DESIGN.md`: rows G6, G12 and G13 of its table, options O4 and O5
in section 3, and section 6 Q2 with its answer. Rules that hold for you: never run `git commit` or
`git push`; never write outside a temp directory in a test; every question needs a long form; nothing is
written without a preview and a stamp. End with the two copyable git blocks.

## Why this exists

`/close-out`, `/handoff`, `/scope` and `/passoff` are installed by both tracks into `~/.claude/skills/`,
one path each. `shapeOf` (`src/render/skills.ts:123-133`) renders their body from the track of the
current run. So the last `setup` run decides the text for every session on the machine. A person who sets
up one non-code folder gets the non-code `/close-out` in every code repo: "in the same commit as the
work", no "add any new file to the code map", and the proof line in place of the gates claim. `/handoff`
changed the same way, `[+45 -44]`. Item 101 removes leftover files, but a removal cannot fix this,
because the file is wanted by both tracks and only its body is wrong.

## What is fixed

- G6 holds as observed on 2026-10-16: `diff` of `close-out/SKILL.md` between a code run (G1) and a
  non-code run (G3) in a temp home.
- The global layer follows one track, set by the last run (G13). init-command D2 and D6 settled that.
  `init` never touches the global layer. Moving off it needs a dated supersession, or R8 flags it.
- `config.json` saves one track in `globalAnswers` since item 102 (G12). It saves `workKind`,
  `configWeight` and `usesGit` for the last run only.
- O4 (union of tracks): save every track a run used and render for all of them. Strongest argument
  against: one path has two bodies, so the body must branch at read time. That is the shape setup-tracks
  D3 rejected for the standard.
- O5 (track skills per target): install each target's skills under `<target>/.claude/skills/`. Strongest
  argument against: it reverses setup-tracks' layer split, writes into every repo, and whether Claude Code
  loads a project `.claude/rules/` folder was not verified.
- Item 101 builds O1 (planned removals) and is independent of this item.

## Do these, in order

1. Re-run G1 and G3 from the leftovers DESIGN.md at the current commit in a temp `$HOME`, and `diff` all four skills
   (`close-out`, `handoff`, `scope`, `passoff`), not only the two the table names. A skill that does
   not change is out of the problem.
2. Verify the one fact the leftovers DESIGN.md left open: whether Claude Code loads `<repo>/.claude/skills/` and
   `<repo>/.claude/rules/`, and which wins over `~/.claude` on a name clash. Cite the docs through
   Context7, or say it could not be checked. O5 depends on it.
3. Scope with `/scope` into `docs/incomplete/<slug>/SCOPE.md`. Carry O4 and O5, and add any option step 1
   or 2 turns up, for example one body that names the track in a line instead of branching. Give each its
   strongest argument against, what it writes, and how to undo it.
4. Name every file a build would touch, and list the ones item 101 owns. State which options need a
   supersession of init-command D2 or D6.
5. GATE 1: ask Zach in one batch, in chat, the same turn the scope is finished. Both the option and
   whether to build at all are his calls, and either answer may be no. Stop there.

## Ask before building

- Which option (O4, O5, or a new one), and whether a person with both kinds of work is common enough to
  justify it. The answer "leave G6 as it is and print a line" is legal.
- Whether a supersession of the one-track model (G13) is acceptable.

## Not in scope, whoever asks

- Removing leftover files (item 101).
- Hook scripts and `settings.json` entries (item 109).
- Any edit to `src/render/skills.ts` while item 101 is `IN FLIGHT`.
- A `setup` run against the real `~/.claude`. Use a temp home.

## Hand back

Gates: `bun run typecheck && bun run lint && bun test && bun run doctor . examples`, run in the main
checkout. A scope item changes no `src/`. Tell Zach the file path of the scope and the questions, then
print the two copyable blocks: `git add <exact files>` and `git commit <the same files> -m "<short,
lowercase>"`. Add no attribution trailer.
