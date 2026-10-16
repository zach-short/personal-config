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
