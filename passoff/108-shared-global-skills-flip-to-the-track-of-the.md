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

## Close-out, 2026-10-16

Closed 2026-10-16 on Opus 5.5, on `main`. Scope `5c03fd8`, GATE 1 answers `05fb906`, design
and plan `6826972`, build `228b1d3`. Record in `docs/incomplete/shared-skills-track/`
(`DESIGN.md` D1 to D6, `PLAN.md` §0 P1 to P13, BD-1 to BD-6, both phases `BUILT`).

**What changed.** `/close-out` and `/handoff` render into each target at
`<target>/.claude/skills/<name>/SKILL.md`, from that target's context, by a second renderer
`renderTargetSkills` in `src/render/skills.ts` (`TRACK_SKILLS`). The `~/.claude/skills/` copies
leave through item 101's `leftovers`, because `skillFiles()` still names them. A run with no
target writes neither skill (D4). Each git target with `usesGit` gets
`/.claude/skills/close-out/` and `/.claude/skills/handoff/` in `.gitignore` (tracked) or
`.git/info/exclude` (untracked). `init` writes both into its folder. A global copy with no stamp
or an `adapted` one is kept and named after the preview (BD-3). `dedupe`'s false comment is
corrected (D6). `src/lib/hidden-tracked.ts` reads an ignore line ending in `/` as covering the
folder. `docs/choices/skills.md`, `catalog.json` and `CHANGELOG.md` describe it.

**Why.** One global body carried the last run's track, or the first target's work record
(`DESIGN.md` F3, F4, F7), so a code repo could read the non-code `/close-out`.

**What is now fixed.** Each folder reads a body rendered from its own answers, in both
directions and inside one run. `tests/shared-skills-track.test.ts` (14 cases) holds it,
including D2's guard: a skill outside the two that starts to differ between tracks fails.

**Questions answered.** GATE 1, 2026-10-16, "all recs": build; O5 with DIAL-1 to DIAL-3 at
their defaults; the setup-tracks layer split superseded for these two skills; F2 and F6 left to
leftovers D1; F8's comment fixed with the build. GATE 2, 2026-10-16, "all recs": two phases;
`.gitignore` in tracked mode; print the BD-3 line. R7, 2026-10-16: Zach kept the plain wording of
the BD-3 line.

**Verified.** Gates green on `228b1d3`'s files: typecheck, lint with no warnings, `bun test`
1820 pass in 102 files, `doctor . examples` 11 findings (the same 11 as at `81ce644`, all in
`PASSOFF.md`), also in a `git archive HEAD` copy holding only this item's files. A temp-home
proof run (two repos, `folders` and `ledger`) showed a different `/close-out` in each and the
old global copy removed. The runtime pass inside Claude Code is Zach's: he reported it done on
2026-10-16 and gave no detail, so whether a worktree session was tried is not recorded.

**Left owed.**

- A repo later dropped from `--projects-dir` keeps a stale per-target copy that no run updates
  (`PLAN.md` §4).
- Whether a non-git folder loads its project skill was read from the docs, not seen (P8).
- F2 and F6 stay as leftovers D1 decided (D5).
- `docs/incomplete/shared-skills-track/` waits for `/clean-up` to archive it.
- Nothing is released: the change reaches npm only through a "Cut 0.x.y" item.

