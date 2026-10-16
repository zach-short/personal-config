# 109. A code `setup` run leaves the delete-guard hook and its `settings.json` entry

*Opened 2026-10-16*, split from item 101 at its GATE 1. Zach answered Q3 of
`docs/incomplete/setup-global-leftovers/SCOPE.md` the same day: hook scripts and `settings.json` entries
stay out of item 101, and finding G7 goes to its own item.

**Model: Opus 5.5. Lane J. Waits on nothing.** Scope first. The fix is Zach's call at GATE 1; do not pick
one before it.

You are picking up personal-config, a Bun and TypeScript CLI that installs documents, hooks and skills
for other people. Read `CLAUDE.md`, `docs/conventions-ts.md`, and `standard/AGENT-PRACTICES.boilerplate.md`
Parts 1 and 2 in full. Then read `HANDOFF.md` (untracked, main checkout only) and
`docs/incomplete/setup-global-leftovers/SCOPE.md`: rows G7, G9, G10 and G11 of its table, DIAL-1 in
section 4, and section 6 Q3 with its answer. Rules that hold for you: never run `git commit` or
`git push`; never write outside a temp directory in a test; nothing is written without a preview and a
stamp. End with the two copyable git blocks.

## Why this exists

A non-code `setup` run with `writeDoc: yes` installs `delete-guard.sh` and a `PreToolUse` entry in
`~/.claude/settings.json` that blocks `rm`, `rmdir` and `unlink`. A later code run does not remove
either (G7). The settings file has strategy `merge-json` (`src/render/hooks.ts:253`), which adds
entries and never prunes them. The run also leaves `write-doc/` (three files). So a developer who tried
the non-code track once has `rm` blocked in every code session, with no message that points back at
`setup`. The reverse direction has the same shape for `commit-guard.sh`.

## What is fixed

- G7 and G11 hold as observed on 2026-10-16 in a temp home: the code dry run reported `settings.json`
  as `[unchanged]` with the delete-guard entry in it.
- DIAL-1 of item 101 keeps hook scripts out of its removals, for this reason: a removed script under a
  kept `settings.json` entry fails on every `Bash` call. Any fix here must remove the entry and the
  script together, or neither.
- A planned removal exists since item 89 (`src/lib/write-plan.ts`), is backed up, and is undone like a
  write (G10). `commitPlan` refuses a removal that is not in the run's backup. Only `fold` calls
  `resolveRemoval` as of 2026-10-16 (G9). Item 101 may add the first renderer caller; check its state before you
  design on it.
- `src/render/ceiling.ts:61` is a second `merge-json` writer of the same file. A fix that prunes one
  entry must not drop the other writer's entries or any entry the person added by hand.

## Do these, in order

1. Re-run G7 at the current commit in a temp `$HOME`: non-code run with `writeDoc: yes`, then a code run.
   Also run the reverse (code, then non-code) and read which hooks and entries each leaves.
2. Read how `merge-json` is applied and what the stamp or marker on a merged entry is. A prune needs a
   way to tell this tool's entry from one the person wrote. State what that way is, or that none exists.
3. Scope with `/scope` into `docs/incomplete/<slug>/SCOPE.md`. Options include: prune this tool's entries
   when a run no longer wants them; own a marker key per entry so a prune is exact; leave it and print a
   line naming the entry. Each with its strongest argument against, what it writes, and how to undo it.
4. Name every file a build would touch. Check item 101's state first: it owns `src/lib/write-plan.ts`,
   `src/render/rules.ts` and `src/render/skills.ts`.
   Item 101 (commit 1a6bdd4) leaves `write-doc/check.sh` out of the files it removes on purpose (BD-3):
   under `writeDocCheck: every`, `settings.json` names it as a hook command, and removing the script
   while the entry stays would fail every Write and Edit. This item owns the script and its entry.
5. GATE 1: ask Zach in one batch, in chat, the same turn the scope is finished. Whether to fix it at all
   is his call, and the answer may be no. Stop there.

## Ask before building

- Whether this tool may edit `settings.json` entries it did not stamp. Recommended no.
- Whether the printed-line option is enough for the person this track serves.

## Not in scope, whoever asks

- Removal of leftover skills and rules (item 101).
- The shared skills that flip with the last run (item 108).
- A `setup` run against the real `~/.claude`. Use a temp home.
- Any change to what the guards block.

## Hand back

Gates: `bun run typecheck && bun run lint && bun test && bun run doctor . examples`, run in the main
checkout. A scope item changes no `src/`. Tell Zach the file path of the scope and the questions, then
print the two copyable blocks: `git add <exact files>` and `git commit <the same files> -m "<short,
lowercase>"`. Add no attribution trailer.

## Close-out, 2026-10-16

Closed 2026-10-16 on Opus 5.5, on `main`. Scope `9fdf169`, GATE 1 answers with design and plan
`3dde96a`, GATE 2 answers `7facda4`, Phase 1 `6ad97ef`, Phase 2 `b1d4ef7`. The Phase 2 commit was
made as `d188795` and then amended into `b1d4ef7`, which kept its eight files and replaced its
message with "item 112: tier ladder in passoff, shape-based tiers in audit". Read `b1d4ef7` as item
109 Phase 2. Record in `docs/incomplete/setup-hook-leftovers/` (`DESIGN.md` D1 to D4, `PLAN.md` §0
F1 to F11, BD-1 to BD-12, both phases `BUILT`).

**What changed.** `planEverything` in `src/commands/setup.ts` collects the `hooks` object of every
context's planned `settings.json` before `dedupe`, and their union is what the run wants (BD-1). Each
of the five entries in the new `hookEntries()` catalog in `src/render/hooks.ts` that is on disk and
not in that union is pruned, on the same `PlannedFile` as the merge, through the new
`PlannedFile.prune` field (`src/lib/types.ts`) and a `pruneJson` step in `applyStrategy`'s
`merge-json` branch (`src/lib/write-plan.ts`). Matching is canonical deep-equal under the same event
key, and a container the prune empties goes with it (BD-4, BD-5). Under "No hooks" the run adds a
`settings.json` file with contents `{}` and the prune list. A script (`commit-guard.sh` with
`commit-policy`, `delete-guard.sh`, `session-banner.sh`, `completion-gate.sh`, `write-doc/check.sh`)
is removed only where no context rendered it, it is stamped and not `adapted`, and no command in
the resolved `settings.json` runs it (BD-6). An emptied `~/.claude/hooks/personal-config/` folder
is removed after the batch (BD-8). The preview label reads `hook entries merged in, <n> removed`
(BD-9). `src/render/write-doc.ts` exports `check.sh` for the script list, and
`src/render/global-files.ts` no longer says hook scripts are never removed. Phase 2 corrected
`docs/choices/{hooks,work-kind,write-doc,uses-git,config-weight}.md`, rebuilt `catalog.json`, and
added a `CHANGELOG.md` entry under Unreleased.

**Why.** `merge-json` added entries and never removed one, so a developer who tried the non-code
track once kept `rm` blocked in every code session, with nothing that pointed back at `setup` (G7).
The reverse held for the commit guard, and "No hooks" left every entry (H4).

**What is now fixed.** A later run removes each entry this tool wrote and no longer wants, with its
script, in the preview and undoable. An entry the person edited stays, and so does any script an
entry still runs, so no removed script sits under a kept entry. F5 holds too: `writeDocCheck: every`
then `skill` prunes the entry and keeps `check.sh`.

**Questions answered.** GATE 1, 2026-10-16: Q1 O1, with O4's long-form corrections; Q2 yes, an
exact JSON match counts as this tool's entry; Q3 all five entries, and "No hooks" prunes; Q4 no, a
printed line is not enough. GATE 2, 2026-10-16: Q1 two phases, Opus 5.5 then Sonnet 5.5; Q2 yes, a
script goes wherever no entry runs it; Q3 the plain label; Q4 delete the emptied hooks folder.

**Code map.**

- `src/render/hooks.ts`: `hookEntries()`, `hookScriptFiles()`; `settingsMerge` builds from the
  catalog.
- `src/lib/types.ts`: `PlannedFile.prune`.
- `src/lib/write-plan.ts`: `pruneJson`, called from `applyStrategy`'s `merge-json` branch.
- `src/commands/setup.ts`: the union, `hookLeftovers`, the script removals and the folder removal.
- `src/render/write-doc.ts`, `src/render/global-files.ts`: the `check.sh` export and a corrected
  comment.
- `tests/hook-leftovers.test.ts` (new, 18 cases), `tests/hooks.test.ts` (BD-2's pin),
  `tests/global-leftovers.test.ts`.

**Verified.** By running, on `b1d4ef7` in the main checkout on 2026-10-16: typecheck clean; lint
clean, "Checked 199 files", no warnings in the output; `bun test` 1841 pass, 0 fail, 103 files;
`tests/hook-leftovers.test.ts` alone 18 pass. `doctor . examples` gave 13 findings, 7 advisory,
by its own count, none in a file this item touched. The lines are `stamp-drift` from the standard
2.1.0 cut, `row-cell-ceiling` on older `PASSOFF.md` rows, and `unfolded` for items 94, 101 and 105
to 109. One
proof run with the real bin in a temp home: a non-code run (`hooks: both`, `writeDoc: yes`,
`writeDocCheck: every`), then a code run. The code run's preview showed `settings.json` "hook
entries merged in, 2 removed" and `delete-guard.sh`, `SKILL.md`, `style.md` and `check.sh` removed;
after it, `settings.json` held only the commit guard, the banner and the completion gate,
`delete-guard.sh` was gone and `write-doc/` was gone. `personal-config undo` then gave back both
entries and all four files. Only read, not run here: the reverse path, "No hooks", F5's pair, and the
ceiling's `settings.local.json` bytes, which Phase 1's builder reports it ran before the commit.
Not seen: a Claude Code session after the prune, and CI's Linux job, which needs a push (BD-8 lists
a folder).

**Left owed:**

- CI's Linux job on these commits. Nothing is pushed: `origin/main` is at `52a3838`.
- `b1d4ef7`'s message names item 112, which is not on the board. Rewording it is Zach's call.
- The seams in `PLAN.md` §4: a declined-run line naming what would be removed, a marker key per
  entry, a `doctor` rule that reads `settings.json`, and the output-style key a `check-first` run
  leaves.
- `docs/incomplete/setup-hook-leftovers/` waits for `/clean-up` to archive it.
- Nothing is released: the change reaches npm only through a "Cut 0.x.y" item.
