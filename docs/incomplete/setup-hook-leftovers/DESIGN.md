# DESIGN: a `setup` run leaves hook entries and scripts the run no longer wants

**Status:** `RATIFIED`. Opened 2026-10-16 by board item 109, on Opus 5.5. Owner: Zach. GATE 1 was
answered 2026-10-16 (§6). This file was `SCOPE.md` until 2026-10-16, when the answers were written
in below as D1 to D4. From here it changes by amendment only: a new dated decision or an `As built:`
note, never an edit to a decision in place. `PLAN.md` beside it orders the build.

## Decisions

**D1. A `setup` run removes each hook entry this tool renders that no target in the run wants,
with its script in the same batch** (2026-10-16, GATE 1 Q1, option O1). The entry is removed from
`~/.claude/settings.json` in the same planned write that merges the entries the run does want, and
the script is planned for removal beside it. A script goes only where its entry goes: never while
an entry in the file the run leaves still runs it. An entry the person edited stays, and so does
its script. The preview names every removal, `commitPlan` backs it up, and `personal-config undo`
restores it. O4's long-form corrections come with it (H16).

*Defense.* It closes all four leaks of §1 (H1 to H4) with one rule, the rule item 101 already
applies to skills and rules: what this run does not render, and this tool wrote, goes. It uses the
one ownership signal an entry has, its exact JSON, which is frozen by design (H7). The removal
travels the same preview, backup and undo path as every write (H10). O2 needs an unverified claim
about Claude Code (H17) and still needs O1's exact match for every install made so far. O3 and O4
leave the defect in place and tell the person about it at a moment they are not reading.

*What it costs, accepted.* This is the first time a run deletes from a file the person owns
(O1's argument against it, §3).

**D2. An entry that is deep-equal JSON to the entry this version renders counts as this tool's**
(2026-10-16, GATE 1 Q2, DIAL-3). Deep-equal means the same event key and the same value, with the
order of an object's keys ignored and the order of an array kept. A prefix match on the folder path
(H8) does not count. An identical entry a person wrote by hand from `hooks.md`'s own recipe (H9) is
removed too, in the preview and undoable.

*Defense.* No entry carries a stamp (H6), so a rule that edits only stamped entries never prunes
anything. The command strings are fixed once a release carries them (H7), so an exact match is
this tool's text in every case but H9's, and H9's person sees the removal before it lands.

**D3. All five entries, and a "No hooks" run prunes** (2026-10-16, GATE 1 Q3, DIAL-1 and DIAL-2).
The five are the commit guard (with its `commit-policy` file), the delete guard, the session
banner, the completion gate and the write-doc check (`write-doc/check.sh`). "No hooks" means no
hooks from this tool: a run with that answer removes what an earlier run added.

*Defense.* H3 and H4 leak through the same gap as H1. Reading "No hooks" as "add nothing, keep
everything" leaves H4 open with no way out but a hand edit.

**D4. No printed notice stands in for the removal** (2026-10-16, GATE 1 Q4). O3's line does not
reach the person at the moment of harm, a blocked `rm` days later or a style finding on a
`README.md` save.

*Supersessions.*

- **Item 101 D3** ("Hook scripts and `settings.json` entries are out of D1",
  `docs/incomplete/setup-global-leftovers/DESIGN.md`, in the archive once item 101 folds) is
  superseded in full for the five entries and their scripts. Its reason (a removed script under a
  kept entry fails on every call) survives as D1's pairing rule.
- **Item 101 BD-3** (`write-doc/check.sh` stays out of the removal list) is superseded: `check.sh`
  goes under D1's pairing rule. Its own reversal line named this item.
- **Item 101's rule that "Hook scripts, `settings.json` and `config.json` are never removed"**
  loses its first two terms. `config.json` is still never removed.
- The comment at `src/render/hooks.ts:84-86` ("`hooks: none` is still none ... nothing is added to
  `settings.json`") stays true as written: "No hooks" still adds nothing. It gains a removal.

## How the design meets §5's hazards

Each hazard is answered by a build-level decision in `PLAN.md` §1 that implements D1 to D4 (R12).

| §5 hazard | Answer | Where |
|---|---|---|
| A script removed under a kept entry | A script is removed only where no command in the `settings.json` this run leaves names its path, and only where it is stamped and not `adapted`. An edited entry stays, names the script, and keeps it | BD-6 |
| One planned file per `settings.json` per plan (H13) | The prune rides the same `PlannedFile` as the merge, as a new optional `prune` list. No second file for that path is ever planned | BD-3 |
| `renderHooks` plans nothing under "No hooks" (H4) | The prune is decided in `planEverything`, after render, from the disk. Where no settings file was rendered and there is something to prune, it adds one `settings.json` file whose merge contents are `{}` | BD-1, BD-3 |
| The declined-run help reads the merge contents as additions (H14) | `contents` keeps holding additions only. The prune is a separate field the help never reads, so its bytes do not change | BD-3, BD-11 |
| `mergeJson` is shared with the ceiling's `settings.local.json` (H12) | `mergeJson` is not changed. The prune is a second step in the `merge-json` branch that runs only when `prune` is present, and `ceiling.ts` never sets it | BD-3 |
| Two targets on two tracks | The run wants the union of what every target's context rendered for `settings.json`, read before `dedupe`. At `9fdf169` every context renders the same hooks (PLAN F4); the union keeps that true if a hook answer ever becomes per target | BD-1 |
| The emptied `write-doc/` folder | With `check.sh` gone the folder is empty, and item 101's `removeEmptySkillFolders` removes it. A test pins it | BD-7 |
| No gate checks `settings.json` (H15) | Every case is a test in a temp home, and the proof run repeats §1's four runs with the real bin | PLAN Phase 1 |

## Rules that survive unchanged

- `mergeJson` adds and never removes. Every merge without a `prune` list, the ceiling's
  `settings.local.json` included, gives the same bytes it gives at `9fdf169`.
- The entry strings this tool renders do not change (H7). The prune matches against the same
  builders the merge uses, so the two cannot drift.
- `renderAll` stays a function of the answers and touches no disk. `doctor`'s rerender compares
  only `.md` files (`src/doctor/rerender.ts:89-91`) and never sees a prune.
- `init` writes and removes nothing under `~/.claude` (init-command D2, `insideOnly`).
- What each guard blocks, its block message, and which answers want which hook
  (`wantedHooks`, `wantsWriteDocHook`).
- A script with no stamp, or a stamp marked `adapted`, is never removed (item 101 BD-4).
- The output style key (§2's non-scope).
- Item 101's removals of skills and rules, and `fold`'s removals, keep their behaviour.

**Why this exists.** Board item 109, lane J, split from item 101 at its GATE 1 (Q3, answered
2026-10-16). Item 101 removed leftover skills and rules and left hook entries and scripts out,
because `merge-json` could not remove an entry. The ground truth below finds the leak on four paths,
not one.

## 1. What exists, verified 2026-10-16

Every run below used the real bin (`bun run src/cli.ts setup --from <profile> --projects-dir <empty>
--yes`) with `HOME` pointed at a new `mktemp -d` directory under `$TMPDIR`, at commit `eb92e69`. Each
profile was `profiles/starter.json` with `configWeight: full`, `usesGit: yes`, `skills: all`,
`hooks: both`, `writeDoc: yes`, `writeDocCheck: every`, then the overrides named in the row.

| ID | Claim | Verified state | Citation |
|---|---|---|---|
| H1 | G7 holds: a non-code run, then a code run, leaves the delete guard | Holds. After the code run, `hooks/personal-config/delete-guard.sh` is on disk and `settings.json` still has its `PreToolUse` entry. The code dry run reports `settings.json` `[unchanged]` | run 1, 2026-10-16 |
| H2 | The same run also leaves the write-doc check live | Holds, and this is new since item 101. The code run removes `write-doc/SKILL.md` and `style.md` (item 101 D1) but keeps `write-doc/check.sh` (item 101 BD-3) and its `PostToolUse` `Write\|Edit` entry. In a code session, every save of a `.md .mdx .txt .rst .tex .adoc` file runs the style check and returns its problems to the agent with exit 2 | run 1; `src/render/global-files.ts:9-10`; `templates/write-doc/check.sh:13-17` |
| H3 | The reverse leaks the commit guard | Holds only under `usesGit: no`. Code, then non-code with `usesGit: no`: `commit-guard.sh`, `commit-policy` and the commit guard's entry stay. Code, then non-code with `usesGit: yes`: the non-code run wants the commit guard (`hooks.ts:97`), so nothing leaks | runs 2 and 3, 2026-10-16 |
| H4 | A later `hooks: none` run leaves every hook | Holds. Code with `hooks: both`, then code with `hooks: none`: all four scripts and all three entries stay. `renderHooks` returns `[]` when nothing is wanted, so `settings.json` is not in the plan at all | run 4, 2026-10-16; `src/render/hooks.ts:30-31` |
| H5 | `settings.json` is merged and never pruned (G11) | Holds. Strategy `merge-json`, `stamp: false`. `mergeJson` adds array items whose exact JSON is not already present and removes nothing | `src/render/hooks.ts:247-256`; `src/lib/write-plan.ts:193-214` |
| H6 | A merged entry carries a stamp or a marker | Does not hold. No entry has a field that says this tool wrote it. The only identity an entry has is its exact JSON | `src/render/hooks.ts:188-241`; `src/lib/write-plan.ts:211-213` |
| H7 | This tool's entry strings are fixed across releases | Holds by design: each command string "is fixed once a release carries it", because a changed string would add a second entry beside the old one. `tests/hooks.test.ts` pins that a re-merge adds nothing | `src/render/hooks.ts:156-178`, `:195-202` |
| H8 | Every command this tool writes points into a folder it owns | Holds. Four scripts live in `~/.claude/hooks/personal-config/` (since commit `8947613`), and the fifth is `~/.claude/skills/write-doc/check.sh` | `src/lib/paths.ts:62-64`; `src/render/write-doc.ts:97-99` |
| H9 | A person can write an entry identical to this tool's by hand | Holds. `docs/choices/hooks.md:496-499` tells a person to copy a guard into `~/.claude/hooks/personal-config/` and add a `PreToolUse` entry for it. Followed exactly, that entry is byte-identical to this tool's | `docs/choices/hooks.md:494-500` |
| H10 | A planned removal is backed up and undone like a write (G10) | Holds. `commitPlan` refuses a removal that is not in the run's backup | `src/lib/write-plan.ts:228-277` |
| H11 | Only `fold` plans a removal (G9) | **No longer holds.** Item 101 Phase 1 (`1a6bdd4`) added `resolveLeftover`, and `setup`'s `leftovers()` plans a removal for each stamped global file no target renders | `src/lib/write-plan.ts:69-77`; `src/commands/setup.ts:299-307` |
| H12 | `src/render/ceiling.ts:61` is a second writer of the same file | **Does not hold.** It merges into the repo's `.claude/settings.local.json`, not `~/.claude/settings.json`. It shares the `mergeJson` function, not the file. `hooks.ts` is the one writer of `~/.claude/settings.json` | `src/render/ceiling.ts:57`; `grep -rn claudeSettingsFile src` gives `hooks.ts` only |
| H13 | One plan writes `settings.json` once | Holds by design: the hook entries and the output style go through one merge so nothing writes the file twice in one plan | `src/render/hooks.ts:15-18` |
| H14 | The declined-run help reads the planned merge's contents as the hooks to add | Holds. `plannedHooks` parses the merge's `contents` and prints its `hooks` object as what a run would add | `src/render/hooks.ts:283-307` |
| H15 | `doctor` checks `settings.json` | Does not hold. No file under `src/doctor/` names it. Only tests can catch a regression here | `grep -rln 'settings\.json\|claudeSettingsFile\|merge-json' src/doctor` gives nothing |
| H16 | The long forms describe the leftovers | Do not. `docs/choices/work-kind.md:76-77` says a switch to Code or Other work removes what only the other track installs, and names neither the delete guard nor `check.sh`. `docs/choices/hooks.md:49` says "No hooks" adds nothing, and says nothing of what a previous run added | as cited |
| H17 | Claude Code accepts an unknown key in a hook entry | Not verified. The settings docs say a user file that fails validation is rejected whole, and a single bad entry is skipped with a warning. They do not say whether an extra key in a hook entry is a bad entry | Context7 `/websites/code_claude`, "Fix a broken settings file", queried 2026-10-16 |
| H18 | Item 101's state | Closed. Both phases are committed (`1a6bdd4`, `d1f90d7`) and logged (HANDOFF lines 404-405), and its board row read `DONE - 2026-10-16` by the end of this scope (it read `IN FLIGHT` at the start). It no longer holds the files a build here touches | `PASSOFF.md:107` |

Three results follow. The leak is wider than G7: it is any hook a later run stops wanting, on four
paths (H1 to H4). The `write-doc/check.sh` entry is now the most visible case, because item 101
removed the skill around it and left the entry live (H2). And no entry records who wrote it (H6, from
a read of every entry `settingsMerge` builds), so the only test of "ours" is exact match against the strings this tool renders (H7, H8),
which a hand-written entry can also pass (H9).

## 2. What this is, and what it is not

**This is:** what a `setup` run does with a hook entry in `~/.claude/settings.json`, and the script
that entry runs, when this tool wrote them and the run no longer wants them. The five entries in
question are the commit guard, the delete guard, the session banner, the completion gate (each with
its script in `~/.claude/hooks/personal-config/`) and the write-doc check (`write-doc/check.sh`). The
commit guard's `commit-policy` file goes with its script. The long forms that describe this are in
scope too.

**This is not:**

- Removal of leftover skills and rules (item 101, built).
- The shared skills that flip with the last run (item 108).
- What any guard blocks, or the wording of its block message.
- The output style key in `settings.json`. It is a single value the merge replaces, so it does not leak
  the same way; a run that answers `check-first` after `proactive` leaves `"outputStyle": "Proactive"`,
  and that is a separate finding if Zach wants one.
- The repo's `.claude/settings.local.json` (H12). A change to the shared `mergeJson` must leave its
  behaviour as it is.
- Any `setup` run against the real `~/.claude`.

## 3. Options

### O1. Prune an entry that matches this tool's own string exactly, with its script, when no target wants it

For each of the five entries, where no target's context in this run wants it, and the entry on disk
is byte-identical (as JSON) to the one this tool renders, the run removes the entry from
`settings.json` and plans the removal of its script in the same batch. A script goes only where its
entry goes. An entry that does not match exactly (the person edited it) stays, and so does its
script. The preview shows `settings.json` with the lines removed and the script `(no longer
installed)`, as item 101 shows a skill.

*The defense.* It uses the one ownership signal that exists (H7): the strings are frozen by design,
so an exact match is this tool's own text. It closes all four paths (H1 to H4) with one rule, the
same rule item 101 applies to skills: what this run does not render, and this tool wrote, goes. The
removal is previewed, backed up and undone like any write (H10). It never removes a script whose
entry stays, which is item 101's DIAL-1 hazard.

*The strongest argument against it.* An exact match is not proof of authorship. A person who followed
`hooks.md`'s own recipe (H9) has an identical entry, and a later run removes it. The preview names it
and `undo` restores it, but the person asked for that guard on purpose and the tool takes it away.
It also touches a file the person owns, by deletion, which no run has done before.

*What it writes.* `settings.json` without the unwanted entries; the removal of their scripts. Nothing
new.

*How to undo it.* `personal-config undo` restores `settings.json` and every removed script. Or answer
the earlier questions so the run wants the hook again and re-run `setup`.

### O2. Add a marker key to each entry this tool writes, and prune only marked entries

Each entry gains a key such as `"personalConfig": "delete-guard"`. A prune removes only an entry that
carries the marker.

*The defense.* It is exact. A hand-written entry has no marker and is never touched, so H9 goes away.

*The strongest argument against it.* Two arguments, each enough alone. First, H17 is not verified: if
Claude Code treats an unknown key in a hook entry as a bad entry, it skips it, and the guard is
silently off on every install. Second, a marker changes the entry's JSON, so on every existing install
the merge adds the marked entry beside the unmarked one (H7, `hooks.ts:165-170`), and every guard runs
twice. Fixing that needs O1's exact-match prune for the old string anyway.

*What it writes.* One extra key in each of the five entries; the prune of O1, keyed on the marker.

*How to undo it.* `personal-config undo`. A marker key left behind by a later version is inert only if
H17 resolves in its favour.

### O3. Change nothing on disk; print a line that names each leftover entry and its script

A run that finds one of the five entries on disk, exactly matching, with no target wanting it, prints
after the preview: the entry, the script, and the two-line hand edit that removes both.

*The defense.* It touches nothing the person owns, so H9 cannot hurt anyone. It costs one function and
no change to `mergeJson`.

*The strongest argument against it.* The person who meets the problem is not reading that line when
it matters. G7's case is a developer whose `rm` is blocked in a code session days after a `setup` run,
and the block message does not name `setup`. For H2, the agent sees style findings on a `README.md`
save and has no way to connect them to a skill that is no longer installed. A notice at run time does
not reach the moment of harm. This track serves people who have never seen a ledger; a hand edit to
`settings.json` is the step they are least able to do.

*What it writes.* Nothing. One printed block.

*How to undo it.* Nothing to undo.

### O4. Change no behaviour; correct the long forms

`work-kind.md`, `hooks.md` and `write-doc.md` say plainly that a re-run on another track, or with
"No hooks", leaves earlier hooks in place, and give the hand edit.

*The defense.* The docs at present say the opposite by omission (H16). This is the least change that
makes them true.

*The strongest argument against it.* It documents the defect and keeps it. Everything said against O3
holds, with less reach: a long form is read before a choice, not after the harm.

*What it writes.* Three long forms, `catalog.json`.

*How to undo it.* Revert the text.

O3 and O4 are not exclusive of O1: O1 also needs H16's long-form corrections.

## 4. Dials

| ID | Dial | Recommended default |
|---|---|---|
| DIAL-1 | Which entries a run may prune | All five this tool renders (both guards, banner, gate, write-doc check). One rule for all of them, and H3 and H4 leak through the same gap as H1 |
| DIAL-2 | Whether a `hooks: none` run prunes | Yes. The answer means "no hooks from this tool", and its long form changes to say a previous run's hooks are removed. The other reading keeps H4 open |
| DIAL-3 | What counts as "this tool's entry" | Deep-equal JSON to the entry this version renders (H7). Not a prefix match on the folder path (H8), which would also take a person's own script placed in that folder |
| DIAL-4 | The preview label for a removed entry | The present label (`src/render/hooks.ts:262`) with `, <n> removed` added to its end, so a person who reads only labels sees the removal |

## 5. Hazards this work walks into

- **A script removed under a kept entry fails every `Bash` call** (item 101 DIAL-1). The script's
  removal must depend on its entry's removal in the same plan. Two cases break the pairing: the entry
  was edited (no exact match, so it stays, so the script stays), and the script lost its stamp or was
  marked `adapted` (`resolveLeftover` returns null, so the script stays, which is safe since the entry
  is gone).
- **One planned file per `settings.json` per plan** (H13). The prune must ride the same `PlannedFile`
  as the merge, not a second one, so a prune needs either a new strategy or a removal list on
  `PlannedFile` (`src/lib/types.ts:241`).
- **`renderHooks` plans nothing when nothing is wanted** (H4). Under DIAL-2's default it must still
  plan `settings.json` when there is a leftover to prune.
- **The declined-run help reads the merge's contents as additions** (H14). If removals travel in the
  same contents, the decline snippet must not print them as entries to add, and
  `tests/decline-every-event.test.ts` pins its bytes.
- **`mergeJson` is shared with the ceiling's `settings.local.json`** (H12). A change to it must not
  change what that merge does.
- **Two targets on two tracks** want both tracks' hooks. A prune decides on the union of every
  target's wants, the way item 101's `leftovers()` decides after `dedupe`.
- **The emptied `write-doc/` folder.** With `check.sh` gone, item 101's `removeEmptySkillFolders`
  (BD-5) removes the folder. That is the intent, and a test should pin it.
- **No gate checks `settings.json`** (H15). Only tests in a temp home can show a regression, and the
  "Gates that lie" note on Linux `readdir` order applies to any test that lists a folder.

### Files a build under O1 would touch

`src/render/hooks.ts`, `src/lib/write-plan.ts`, `src/lib/types.ts`, `src/render/global-files.ts` or
`src/commands/setup.ts` (the paired script removal), `src/render/write-doc.ts` (the `check.sh` path in
the candidate list), `tests/hooks.test.ts`, `tests/global-leftovers.test.ts`,
`tests/decline-every-event.test.ts`, `docs/choices/hooks.md`, `docs/choices/work-kind.md`,
`docs/choices/write-doc.md`, `catalog.json`, `CHANGELOG.md`. Not `src/render/ceiling.ts` (H12), which
the board row names.

## 6. Open questions (GATE 1)

- **Q1. Fix it at all, and how?** O1 (recommended), O3, O4, or no change. O1 also takes O4's
  long-form corrections.
- **Q2. Is exact match enough to call an entry this tool's?** The pass-off recommended that the tool
  edit no entry it did not stamp, but no entry carries a stamp (H6), so under that rule nothing is
  ever pruned. Recommended: yes, exact match counts (DIAL-3), knowing that an entry written by hand
  from `hooks.md`'s recipe is removed too, in the preview and undoable.
- **Q3. DIAL-1 and DIAL-2: all five entries, and prune under "No hooks"?** Recommended: yes to both.
- **Q4. Is the printed line (O3) enough for the person this track serves?** Recommended: no, for the
  reason in O3's argument against it.

### Answers, 2026-10-16

- **Q1: O1.** Prune an entry that matches this tool's own string exactly, with its script in the same
  batch, when no target wants it. The long-form corrections of O4 come with it.
- **Q2: yes.** An exact JSON match counts as this tool's entry (DIAL-3). An identical entry written by
  hand from `hooks.md`'s recipe is removed too, in the preview and undoable.
- **Q3: all five, and "No hooks" prunes.** DIAL-1 and DIAL-2 at their recommended defaults.
- **Q4: no.** A printed line is not enough for the person this track serves.
