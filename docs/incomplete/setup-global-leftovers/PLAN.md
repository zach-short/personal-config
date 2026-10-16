# Plan: setup removes the global files a run no longer renders

Design: `DESIGN.md`, `RATIFIED` 2026-10-16 (D1 to D4). This plan turns it into two phases.

**Status.** `PLANNED` 2026-10-16, Opus 5.5 (board item 101). Approved at GATE 2 the same day:
Zach chose every recommended answer, recorded in §7 with the questions as asked.

## 0. Facts verified 2026-10-16 (supersede the design where they differ)

A second pass, run on `13b88b9` in the main checkout with `bun src/cli.ts` and a temp `$HOME`
under the session scratchpad. `code.json` and `nc.json` are `profiles/starter.json` with
`workKind` set, and `configWeight: full`, `usesGit: yes`, `skills: all`, `hooks: both`,
`writeDoc: yes`, `writeDocCheck: every`.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| F1 | G1 to G3 still hold after item 107 changed `src/render/skills.ts` | Holds. The code run installed the same eight skills and `grep -c delegate model-routing.md` gave 1. The non-code run into a copy gave 0, and `audit`, `autopilot`, `clean-up`, `delegate` and `commits.md` stayed | the three runs of the pass-off, 2026-10-16 |
| F2 | Item 107 no longer blocks this build | Holds. Item 107 is `DONE - 2026-10-16`, merged at `13b88b9`. `DESIGN.md` §5's last hazard is cleared | `git log --oneline -3`; `PASSOFF.md` row 107 |
| F3 | `write-doc/check.sh` is a hook script as well as a skill file | Holds. Under `writeDocCheck: every`, `settings.json` names `<home>/.claude/skills/write-doc/check.sh hook` as a command, and a later code run keeps that entry. DIAL-1 lists `check.sh` for removal; D3's own reason (a removed script under a kept entry fails on every call) applies to it. See BD-3 | `src/render/hooks.ts:196-206`; `settings.json` line 29 after a non-code then a code run |
| F4 | Every leftover file carries a readable, unadapted stamp | Holds for `delegate/SKILL.md` (stamp after the frontmatter), `write-doc/style.md`, `write-doc/check.sh` and `rules/commits.md` | `readStamp` on each file after F1 |
| F5 | `renderAll` has two callers that must not see a removal | `planEverything` (`src/commands/setup.ts:267`) and `doctor`'s rerender (`src/doctor/rerender.ts:78`). `upgrade` does not call it | `grep -rn renderAll src` |
| F6 | A removal leaves its folder behind | Holds. `removeBackedUp` calls `rm` on the file only | `src/lib/write-plan.ts:255-261` |
| F7 | `undo` puts a removed file back with its folder | Holds. `restore` calls `copyTo`, which makes the parent folder first | `src/lib/backup.ts:155-164`; `src/lib/disk.ts:65-68` |
| F8 | `init` drops a path outside its folder before its global check | Holds. `insideOnly` filters to the target, then throws only on a kept path under `~/.claude` | `src/commands/init.ts:173-183` |
| F9 | `setup`'s summary counts a removal as a write | Holds. It prints `${real.length} file(s) to write`, and `real` is `willWrite`, which is true for a removal | `src/commands/setup.ts` `finish`; `src/lib/write-plan.ts:103-105` |
| F10 | `dedupe` keeps the first context's file per path | Holds. With two targets on two tracks, a path one context renders and another does not is still rendered | `src/commands/setup.ts:302-309` |
| F11 | The suite is green before the build | `bun test`: 1793 pass, 0 fail, 98 files | 2026-10-16, `13b88b9` |

## 1. Decisions taken since ratification

- **BD-1. Removals are planned in `planEverything`, after `dedupe`.** The candidate paths that
  no context rendered are the leftovers, so a path any target renders is never removed (F10).
  `renderAll` stays pure, and `doctor`'s rerender never sees a removal (F5). *Reversal:* move
  the step into `renderAll`, which would make the rerender report every removal as drift.
- **BD-2. One list of candidate paths, in a new `src/render/global-files.ts`.** It builds the
  list from names the renderers export: every skill template name from `skills.ts`, the two
  `write-doc/` files from `write-doc.ts`, and the three rule names from `rules.ts`. A new skill
  or rule then joins the list where it is defined. *Reversal:* a literal list, which goes stale
  the first time a skill is added.
- **BD-3. `write-doc/check.sh` stays out of the list** (F3). This narrows DIAL-1 by one file.
  Board item 109 already owns hook scripts and their `settings.json` entries; its pass-off gets
  a line naming `check.sh`. *Reversal:* add the path once item 109 can remove the entry with it.
- **BD-4. A candidate with no stamp, or an `adapted` stamp, is not planned at all.** It is not
  listed as "left alone" either: a file the person made at that path is theirs, and naming it in
  every preview is noise. The test is DIAL-2's (`readStamp`, `adapted`). A new
  `resolveLeftover(path, label)` in `src/lib/write-plan.ts` reads the file and returns
  `resolveRemoval`'s change or `null`. *Reversal:* plan it with `guard: 'no-stamp'`.
- **BD-5. An emptied skill folder is removed after the batch, by `setup`, not by `commitPlan`**
  (DIAL-4). `fold`'s removals keep their folders (a rule that survives unchanged). Only a folder
  under `~/.claude/skills/` that is empty after the writes is removed. `undo` makes it again
  (F7). *Reversal:* leave empty folders; whether the harness lists one is still unchecked.
- **BD-6. The summary line counts removals apart** (F9): `N file(s) to write, M to remove, K
  already current.` *Reversal:* one count, as at `13b88b9`.
- **BD-7. `language-style.md` stays out of the list**, as DIAL-1's default had it. Every track
  renders it, and only `chatStyle` other than `ste` cuts it. §4 records the seam.
- **BD-8. A removal follows every answer that stops a file, not only the track** (GATE 2 Q2,
  2026-10-16). D1 says "no longer renders" and gives no reason, so `skills: none` removes all
  installed skills, `commitPolicy: no-rule` removes `commits.md`, a docs tool of `none` removes
  `docs-lookup.md`, and `modelRouting: skip` or a light weight removes `model-routing.md`. Each
  long form's "what it writes" and "how to undo it" changes in Phase 2. *Reversal:* key the
  removal on the track change alone, which needs the last track saved per file.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Plan and carry out the removals | Opus 5.5 | none | comfortable | One engine change across five source files and one new suite. A wrong removal is loud (a missing skill), so the Default tier |
| 2 | Long forms, catalog and changelog | Sonnet 5.5 | none | comfortable | Doc reconciliation against a fixed Phase 1: mechanical, checkable by grep and `doctor` |

### Phase 1. Plan and carry out the removals

**Status.** `BUILT` 2026-10-16, Opus 5.5, on `0fe4c26` with the changes uncommitted. Board item
101.

*As built.* Each renderer names its own files: `skillFiles()` in `skills.ts`, `writeDocFiles()`
in `write-doc.ts` and `trackRuleFiles()` in `rules.ts`, each a `GlobalFile` (`src/lib/types.ts`)
with the label its write uses. `globalCandidates()` joins them. `planEverything` appends
`leftovers(files)` after `dedupe`, `finish` prints `N file(s) to write, M to remove, K already
current.` on every run (with `0 to remove` where there is none), and `Wrote N file(s).` no longer
counts the removals. The empty folder check is `removeIfEmpty` in `src/lib/disk.ts`. The two-target
case of step 6 is in-process: tracks are the person's answers, so two targets differ by
`workProfile` (`folders` renders no `/autopilot` or `/audit`, `ledger` does).

*Proof, 2026-10-16.* The pass-off's runs in a temp home under the session scratchpad
(`code.json` and `nc.json` as in §0): after the non-code run `audit`, `autopilot`, `clean-up`,
`delegate` and `commits.md` were gone and the summary read `16 file(s) to write, 5 to remove`.
After `personal-config undo`, `diff -r` against the copy taken after the code run reported only
three paths, each one the non-code run created new: `skills/write-doc/`,
`hooks/personal-config/delete-guard.sh` and `.config/personal-config/backups/`. `undo` keeps a
file it did not overwrite, by design (`src/commands/undo.ts`). With those three excluded,
`diff -r` exited 0, so every file of the code run came back byte for byte. The proof's "equal
tree" holds only in that form. Gates: typecheck clean, lint clean with no warnings, `bun test`
1802 pass in 99 files, `doctor . examples` 17 findings, the same 17 as at `13b88b9`.

**Scope.**

1. Export the names: `skills.ts` exports every skill template name (the union of `SKILLS`,
   `LIGHT_SKILLS`, `delegate` and `AUTOPILOT_SKILLS`); `write-doc.ts` exports the paths of
   `SKILL.md` and `style.md`; `rules.ts` exports `commits`, `docs-lookup` and `model-routing`.
2. New `src/render/global-files.ts`: `globalCandidates(): { path: string; label: string }[]`,
   from those exports (BD-2), without `check.sh` (BD-3) or `language-style.md` (BD-7).
3. `src/lib/write-plan.ts`: `resolveLeftover(path, label)` (BD-4).
4. `src/commands/setup.ts` `planEverything`: after `dedupe`, resolve each candidate whose path
   no planned file has, and append the non-null results (BD-1). Each label is the one its
   renderer gives the file (`skills.ts`, `rules.ts`, `write-doc.ts`) with `(no longer
   installed)` added at the end.
5. `finish`: the BD-6 summary line, and after `commitPlan`, remove each empty parent folder of a
   removed path under `claudeSkillsDir()` (BD-5). Print `Removed M file(s) this run no longer
   installs.` before the backup line.
6. New `tests/global-leftovers.test.ts`, every case in a temp home:
   - code then non-code: the four code-only skills and `commits.md` are removed, their folders
     are gone, and `model-routing.md` has no `/delegate`;
   - `undo` after that restores each file byte for byte;
   - non-code then code with `writeDocCheck: every`: `write-doc/SKILL.md` and `style.md` are
     removed, `check.sh` stays;
   - a candidate with no stamp, and one marked `adapted`, is not planned;
   - two targets, one code and one non-code: nothing either renders is removed (F10);
   - `init` after a code run plans no removal (`DESIGN.md` §5, F8);
   - `--dry-run` lists the removals and removes nothing;
   - `skills: none` after `skills: all` removes every stamped skill (BD-8, if Q2 says yes).

**Subagents.** None.

**Done when.**

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

Plus the proof a green gate cannot give: the pass-off's three runs, repeated at the build's
commit in a temp home, show `audit`, `autopilot`, `clean-up`, `delegate` and `commits.md` gone
after the non-code run, and `personal-config undo` then gives a tree that `diff -r` finds equal
to the copy taken after the code run. Read `bun run lint`'s output, not its exit code.

**Watch for.** `insideOnly` in `init` must keep dropping the removals (F8); a change that
moves the step into `renderAll` breaks both `init` and the rerender. A test that leaves
`$HOME` unredirected would delete the developer's real skills: every case uses the preload's
temp home and asserts the paths are under it.

### Phase 2. Long forms, catalog and changelog

**Status.** `PLANNED`. Starts after Phase 1 is committed.

**Scope.**

1. Add the removal to "what it writes" and "how to undo it" in `docs/choices/` for `skills`,
   `work-kind`, `config-weight`, `uses-git`, `commit-policy`, `docs-lookup`, `model-routing` and
   `write-doc`. Each says which files a later run removes and that `undo` restores them.
2. `bun run catalog`, which rebuilds `catalog.json` (the long forms are embedded in it).
3. `CHANGELOG.md`: one entry under the unreleased heading.
4. Add a line to `passoff/109-...md` naming `write-doc/check.sh` (BD-3), and change items 108
   and 109's "waits on" from item 107 to this item where they touch `skills.ts` or
   `write-plan.ts`.

**Subagents.** None.

**Done when.** The four gates, plus `grep -ln "no longer installs\|removes" docs/choices/{skills,
work-kind,config-weight,uses-git,commit-policy,docs-lookup,model-routing,write-doc}.md` lists all
eight, and `catalog.test.ts` passes on the rebuilt catalog.

**Watch for.** No personal string goes into a long form. The `bun test` grep covers `src/`,
`templates/` and `standard/`, not `docs/choices/`, but `catalog.json` is built from the long
forms and ships with the package.

## 3. Dials

| Dial | Value | Where it lives |
|---|---|---|
| DIAL-1 | Skills' `SKILL.md`, `write-doc/SKILL.md` and `style.md`, rules `commits`, `docs-lookup`, `model-routing` | `src/render/global-files.ts` |
| DIAL-2 | Stamped and not `adapted` | `resolveLeftover` |
| DIAL-3 | `--yes` removes | no flag; D4 |
| DIAL-4 | An emptied skill folder is removed | `finish`, BD-5 |

## 4. Seams reserved, deliberately not built

- `write-doc/check.sh`, `delete-guard.sh`, `commit-guard.sh` and their `settings.json` entries:
  board item 109.
- `language-style.md` under a `chatStyle` other than `ste` (BD-7).
- G6, the shared skills that flip with the last track: board item 108.
- A `doctor` rule that compares installed skills with `model-routing.md` (G15). D1 makes the
  disagreement impossible through `setup`; a hand-copied skill can still cause it.

## 5. Repo hazards, with live numbers

- Items 108 and 109 are `OPEN` and both name files this build touches (`skills.ts`;
  `write-plan.ts`). Neither may build until Phase 1 is committed.
- `bun test` is 1793 tests in 98 files and takes about 31 seconds on macOS. CI's Linux job is
  the proof for anything that lists a folder (CLAUDE.md, gates that lie); BD-5 lists one.
- `doctor .` must run in the main checkout, not a worktree (CLAUDE.md).

## 6. Session protocol

`docs/AGENT-PRACTICES.md` Parts 5 and 7. One phase per session. Never run `git commit` or
`git push`; end each phase with the two copyable blocks.

## 7. GATE 2

Asked 2026-10-16 in chat, in one batch:

- **Q1.** Approve the two phases, their order and drivers (Opus 5.5, then Sonnet 5.5)?
  Recommended: yes.
- **Q2.** BD-8: should a removal follow every answer that stops a file (`skills: none`,
  `no-rule`, a light weight), not only a track change? Recommended: yes.
- **Q3.** BD-3: keep `write-doc/check.sh` out and give it to item 109? Recommended: yes.
- **Q4.** BD-5: remove an emptied skill folder? Recommended: yes.

### Answers, 2026-10-16

Zach answered all four in one batch, in chat, the same turn the plan was finished.

- **Q1: approve.** Two phases, in this order: Phase 1 on Opus 5.5, Phase 2 on Sonnet 5.5.
- **Q2: every answer.** BD-8 stands: a removal follows any answer that stops a file.
- **Q3: keep `check.sh` out.** BD-3 stands; item 109 gets the line in Phase 2 step 4.
- **Q4: remove the empty folder.** BD-5 stands.

The plan now authorizes the whole run. The phases do not each need approval again.
