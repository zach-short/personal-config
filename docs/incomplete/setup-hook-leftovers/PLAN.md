# Plan: setup removes the hook entries and scripts a run no longer wants

Design: `DESIGN.md`, `RATIFIED` 2026-10-16 (D1 to D4). This plan turns it into two phases.

**Status.** `PLANNED` 2026-10-16, Opus 5.5 (board item 109). Approved at GATE 2 the same day:
Zach chose every recommended answer, recorded in §7 with the questions as asked.

## 0. Facts verified 2026-10-16 (supersede the design where they differ)

A second pass in the main checkout at `9fdf169`, with `bun run src/cli.ts setup --from <profile>
--projects-dir <empty> --yes` and `HOME` pointed at a new temp directory under the session
scratchpad. `nc.json`, `code.json` and `none.json` are `profiles/starter.json` with `configWeight:
full`, `usesGit: yes`, `skills: all`, `writeDoc: yes`, `writeDocCheck: every`, and `workKind` and
`hooks` set to `non-code`/`both`, `code`/`both` and `code`/`none`.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| F1 | Nothing under `src/`, `templates/` or `tests/` changed since the scope's runs at `eb92e69` | Holds. The diff is empty | `git diff --stat eb92e69 HEAD -- src templates tests` |
| F2 | H1 and H2 still hold | Holds. After `nc` then `code`, `settings.json` has two `PreToolUse` entries and the `PostToolUse` entry, `delete-guard.sh` is in `hooks/personal-config/`, `write-doc/` holds `check.sh` alone, and the code run reported `settings.json` `[unchanged]` | run 1 again, 2026-10-16 |
| F3 | H4 still holds | Holds. After `code` then `none`, the second run planned no `settings.json`, and the four scripts, `commit-policy` and three event keys stay | run 4 again, 2026-10-16 |
| F4 | Every target's context renders the same `settings.json` | Holds. The only per-target answers are `proofLine` and `offLimits` (`targetAnswers`), and `wantedHooks` and `wantsWriteDocHook` read neither. So the multi-target union of §5 changes nothing at `9fdf169`; BD-1 keeps it true if a hook answer becomes per target | `src/render/context.ts:172-174`; `src/render/hooks.ts:88-102`; `src/render/write-doc.ts:90-94` |
| F5 | A fifth path leaks: `writeDocCheck: every`, then `skill`, on the same track | Holds by reading. `check.sh` is planned whenever `wantsWriteDoc` holds, under either answer, and the entry is merged add-only, so the entry stays and checks every save after the person turned it off. D1 covers it: the entry is pruned and the script, still rendered, stays. `docs/choices/write-doc.md`'s undo section says this answer "removes `SKILL.md` and `style.md`", which is wrong; Phase 2 corrects it | `src/render/write-doc.ts:15-41`; `docs/choices/write-doc.md` "How to undo it" |
| F6 | `doctor`'s rerender cannot see `settings.json` or a script | Holds. It compares only `.md` files other than `PART0-PROMPT.md` | `src/doctor/rerender.ts:89-91` |
| F7 | Two more long forms say hooks are never removed | Holds. `docs/choices/uses-git.md:95` says hook scripts with their entries "are not removed", and `config-weight.md:60` says light keeps only the completion gate, so a light run after a full one now removes the banner. Both join Phase 2 (BD-12) | as cited |
| F8 | `removeEmptySkillFolders` already covers `write-doc/` | Holds. It removes an emptied folder directly under `claudeSkillsDir()` | `src/commands/setup.ts` `removeEmptySkillFolders` |
| F9 | Board item 108 will edit two files this build edits | Holds. Its O5 (GATE 1 answer) names `src/commands/setup.ts`, `src/render/global-files.ts` and `CHANGELOG.md` | `docs/incomplete/shared-skills-track/SCOPE.md:179` |
| F10 | Board row 109 names a file this build does not touch | Holds. "Files it owns" names `src/render/ceiling.ts`, which H12 rules out, and leaves out `setup.ts`, `types.ts` and `write-doc.ts` | `PASSOFF.md:112` |
| F11 | The suite is green before the build | `bun test`: 1806 pass, 0 fail, 101 files, 97 seconds | 2026-10-16, `9fdf169` |

## 1. Decisions taken since ratification

- **BD-1. The prune is decided in `planEverything`, after render, never in `renderAll`.** It
  collects the `hooks` object of every context's planned `settings.json` before `dedupe`; their
  union is what the run wants. Each of the five entries not in that union is a candidate.
  `renderAll` stays pure and the rerender never sees a prune (F6). *Reversal:* decide inside
  `renderHooks`, which would need the disk there and would see one context only.
- **BD-2. One catalog of the five entries, in `src/render/hooks.ts`.** A new exported
  `hookEntries(): HookEntry[]` gives each entry's event, its JSON, the scripts it runs and a short
  name. `settingsMerge` builds its `hooks` object by filtering that catalog, so the string the
  merge writes and the string the prune matches are the same value. A test pins that every entry
  `settingsMerge` can emit, under every answer combination, is byte for byte what it emits at
  `9fdf169`. *Reversal:* keep two lists, which drift the first time an entry changes.
- **BD-3. The prune travels on the same `PlannedFile` as the merge.** `PlannedFile` gains an
  optional `prune?: { at: string[]; item: unknown }[]`, where `at` is the path to an array
  (`['hooks', 'PreToolUse']`). `applyStrategy`'s `merge-json` branch runs `mergeJson` unchanged,
  then removes each listed item. `contents` keeps holding additions only. Where no context
  rendered `settings.json` (under "No hooks" with no output style), `planEverything` adds one file
  for that path with contents `{}` and the prune list, so the plan still holds one file per path
  (H13). *Reversal:* a new strategy, which would need its own branch in every reader of
  `strategy`, `plannedHooks` included.
- **BD-4. Matching reads the disk at plan time, by canonical deep-equal** (D2). A new
  `hookLeftovers` reads `settings.json`, parses it, and returns the candidates found under their
  own event key, compared with object keys sorted and array order kept. A prune is attached only
  where at least one candidate is on disk, so a run with nothing to prune plans no extra file. A
  `settings.json` that does not parse gives no prune and no script removal, and the merge's
  existing parse error is unchanged. *Reversal:* `JSON.stringify` equality, as `mergeArrays` uses,
  which misses an identical entry whose keys a person or another tool reordered.
- **BD-5. A container the prune empties goes with it.** An event array this prune left empty is
  deleted, and so is `hooks` if this prune left it empty. An array that was empty before the run
  stays. *Reversal:* leave `"Stop": []` in place. Whether Claude Code accepts an empty event array
  was not checked.
- **BD-6. A script is removed only where no entry still runs it** (D1's pairing rule). Each
  script candidate (`commit-guard.sh`, `delete-guard.sh`, `session-banner.sh`,
  `completion-gate.sh`, `write-doc/check.sh`) is planned for removal when all three hold: no
  context rendered it; `resolveLeftover` finds it stamped and not `adapted`; and no `command` in
  the `settings.json` this run leaves (the resolved change's `after`, or the file on disk where the
  plan does not change it) contains its path. `commit-policy` is removed exactly when
  `commit-guard.sh` is. So an edited entry keeps its script, and so does a person's own entry that
  runs one of these scripts. One consequence goes past "with its entry": a `check.sh` whose entry
  never existed (non-code with `writeDocCheck: skill`, then code) is removed too, because nothing
  runs it. GATE 2 Q2. *Reversal:* remove a script only where this run pruned its entry, which
  leaves that `check.sh` alone in `write-doc/` for good.
- **BD-7. `check.sh` is a script candidate, not a `globalCandidates()` entry.** `write-doc.ts`
  exports its path for the script list, and `globalCandidates()` keeps its rule that no script is
  on it, since its files go by stamp alone. The emptied `write-doc/` folder goes through
  `removeEmptySkillFolders` (F8); a test pins it. *Reversal:* none needed; this supersedes item
  101 BD-3 as D1 says.
- **BD-8. An emptied `~/.claude/hooks/personal-config/` folder is removed after the batch**, the
  way BD-5 of item 101 removes an emptied skill folder. Only that folder, never
  `~/.claude/hooks/`. `undo` makes it again when it copies a script back. GATE 2 Q4.
  *Reversal:* leave the empty folder.
- **BD-9. The preview label of a pruning `settings.json` names the count** (DIAL-4). The copy is
  GATE 2 Q3 (R7).
- **BD-10. The summary counts the scripts as removals and `settings.json` as a write.** The file
  is rewritten, not deleted, so `N file(s) to write, M to remove` stays true as item 101 built it.
- **BD-11. A declined run prints the same help as at `9fdf169`.** It reads `contents`, which
  holds additions only (BD-3), so it never prints a removal as an entry to add, and
  `tests/decline-every-event.test.ts` stays green unchanged. A line that tells the person what
  the run would have removed is a seam (§4), not built.
- **BD-12. Phase 2 corrects five long forms, not three** (F7): `hooks.md`, `work-kind.md`,
  `write-doc.md`, `uses-git.md` and `config-weight.md`. *Reversal:* none; leaving two false is
  not an option the design allows.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Prune the entries and remove their scripts | Opus 5.5 | none | full | One engine change across six source files and one new suite. A wrong prune is loud (a guard that stops firing, a hook error on every call), so the Default tier |
| 2 | Long forms, catalog, changelog, board row | Sonnet 5.5 | none | comfortable | Doc reconciliation against a fixed Phase 1: mechanical, checkable by grep and `catalog.test.ts` |

### Phase 1. Prune the entries and remove their scripts

**Status.** `BUILT` 2026-10-16, Opus 5.5, uncommitted in the main checkout. `typecheck` and
`lint` are clean with no warnings. `bun test` gave 1838 pass and 3 fail; the 3 are
`tests/tracks.test.ts` §3.1 row 1, whose snapshot differs in `AGENT-PRACTICES`, `model-routing.md`,
`/audit` and `/passoff` only, all from another session's uncommitted standard v2.1.0 edits, and
not in `settings.json`. `doctor . examples` gave 13 findings, none in a file this phase touched.
The proof runs (§1 runs 1, 2 and 4, and F5's pair) were repeated with the real bin in temp homes
and matched the plan; after `undo`, `diff -rq` showed only the files the second run created new.
CI's Linux job was not run. Two things the build found: `exists` in `src/lib/disk.ts` answers
for files only, so the folder checks use `stat`; and `settingsRuns` also matches a command that
names a script by `~`, `$HOME` or `${HOME}`, so a person's own entry in any of those spellings
keeps its script.

**Scope.**

1. `src/lib/types.ts`: `PlannedFile.prune?: { at: string[]; item: unknown }[]`, with a comment
   that says why it is not a strategy (BD-3).
2. `src/lib/write-plan.ts`: in the `merge-json` branch of `applyStrategy`, after `mergeJson`, a
   `pruneJson` that removes each item by canonical deep-equal and deletes containers it emptied
   (BD-4, BD-5). `mergeJson`, `mergeValues` and `mergeArrays` do not change.
3. `src/render/hooks.ts`: `hookEntries()` (BD-2); `settingsMerge` builds from it;
   `hookScriptFiles(): GlobalFile[]` for the four scripts in the hooks folder, with their labels
   and `(no longer installed)` added by the caller as item 101 does. `declinedHookHelp` is not
   edited (BD-11).
4. `src/render/write-doc.ts`: export `check.sh` as a `GlobalFile` for the script list (BD-7), and
   correct the comment above `wantsWriteDoc` that says item 109 owns it.
5. `src/commands/setup.ts` `planEverything`: before `dedupe`, read every context's settings
   `hooks` (BD-1). After `dedupe`, `hookLeftovers` gives the prune list; attach it to the
   `settings.json` file or add one (BD-3), with BD-9's label. Resolve the plan, then plan each
   script removal under BD-6 from the resolved `settings.json`. `finish` removes an emptied
   `hooks/personal-config/` beside the skill folders (BD-8).
6. `src/render/global-files.ts`: its comment no longer says hook scripts are never removed.
7. New `tests/hook-leftovers.test.ts`, every case in the preload's temp home:
   - non-code then code (H1, H2): the delete-guard entry and the `PostToolUse` entry are gone,
     the commit-guard entry stays once, `delete-guard.sh` and `check.sh` are removed, and
     `write-doc/` is gone;
   - code then non-code with `usesGit: no` (H3): the commit-guard entry, `commit-guard.sh` and
     `commit-policy` are removed; with `usesGit: yes` nothing about the commit guard changes;
   - `hooks: both` then `none` (H4): `settings.json` is in the plan, all entries and the `hooks`
     key are gone, a key the person added stays, the four scripts and `commit-policy` are removed,
     and the folder is gone (if Q4 says yes);
   - `writeDocCheck: every` then `skill` (F5): the entry is pruned and `check.sh` stays;
   - an entry with one changed byte stays, and its script stays;
   - a person's own entry whose command runs `delete-guard.sh` keeps the script;
   - an identical entry with its keys in another order is pruned (D2);
   - a script with no stamp, or one marked `adapted`, stays while its entry is pruned;
   - the person's unrelated hooks under the same events are kept in their order;
   - two targets: the union decides, and a candidate any context renders is kept (BD-1);
   - a `settings.json` that does not parse plans no prune and no script removal (BD-4);
   - `--dry-run` lists every removal and changes nothing; a second run after the prune is
     already current;
   - `personal-config undo` after the prune restores `settings.json` and each script byte for
     byte;
   - `init` after a code run with `hooks: both` plans no prune (`insideOnly`);
   - a declined run's help is byte for byte the same with a prune in the plan (BD-11).
8. `tests/hooks.test.ts`: BD-2's pin that the rendered entries are unchanged.

**Subagents.** None.

**Done when.**

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

Plus the proof a green gate cannot give. At the build's commit, repeat §1's runs 1 to 4 and F5's
pair with the real bin in temp homes. After each second run, `jq '.hooks' settings.json` shows
only the entries the second run wants, and `ls` shows the scripts gone where their entries went
and kept where an entry stays. Then `personal-config undo` gives a tree that `diff -r` finds equal
to a copy taken after the first run, apart from the files the second run created new. The
ceiling's `settings.local.json` merge gives the same bytes as at `9fdf169` for one capped repo.
Read `bun run lint`'s output, not its exit code. CI's Linux job must pass, because BD-8 lists a
folder.

**Watch for.** A script removed under a kept entry fails every `Bash` call or every save in every
session on the machine, and nothing in `doctor` would see it (H15). Every script removal in the
code must read the resolved `settings.json`, never the plan's intent. A test that leaves `$HOME`
unredirected would edit the developer's real `settings.json`: every case asserts its paths are
under the preload's temp home.

### Phase 2. Long forms, catalog, changelog, board row

**Status.** `PLANNED` 2026-10-16.

**Scope.**

1. `docs/choices/hooks.md`: "No hooks" says a run with that answer removes the entries and scripts
   an earlier run added; "What it writes and where" says a later run removes an entry it no longer
   wants, with its script, when the entry matches this tool's exactly, and that an edited entry
   stays; "How to undo it" says `personal-config undo` restores `settings.json` and the scripts,
   and that an entry copied by hand from the recipe at its end is removed by a later run that does
   not want it (D2).
2. `docs/choices/work-kind.md`: the "A later run removes" paragraph and "How to undo it" name the
   delete guard and the write-doc check (to Code) and the commit guard (to Other work, with git
   off).
3. `docs/choices/write-doc.md`: replace "Running setup again never removes the hook entry or
   `check.sh`" and the wrong `SKILL.md` sentence (F5) with what a later run does now: **No** or a
   code run removes the entry, `check.sh` and the folder; **Only what /write-doc writes** removes
   the entry and keeps `check.sh`.
4. `docs/choices/uses-git.md:95` and `config-weight.md` (BD-12).
5. `bun run catalog`, which rebuilds `catalog.json`.
6. `CHANGELOG.md`: one entry under Unreleased.
7. Correct board row 109's "Files it owns" (F10). `PASSOFF.md` is untracked, so this edit is made
   in the main checkout and named in the hand-back.

**Subagents.** None.

**Done when.** The four gates, `catalog.test.ts` green on the rebuilt catalog, and
`grep -n "never removes\|are not removed" docs/choices/{hooks,work-kind,write-doc,uses-git,config-weight}.md`
returns no line about hooks.

**Watch for.** No personal string goes into a long form: `catalog.json` is built from them and
ships with the package. Use `<home>` for the home directory, as `write-doc.md` already does.

## 3. Dials

| Dial | Value | Where it lives |
|---|---|---|
| DIAL-1 | All five entries, with their scripts and `commit-policy` | `hookEntries()`, `hookScriptFiles()`, BD-6 |
| DIAL-2 | "No hooks" prunes | `planEverything`, BD-3 |
| DIAL-3 | Canonical deep-equal under the same event key | `pruneJson`, `hookLeftovers`, BD-4 |
| DIAL-4 | The label names the count | BD-9, wording from GATE 2 Q3 |

## 4. Seams reserved, deliberately not built

- A line in the declined-run help naming what the run would have removed (BD-11).
- A marker key in each entry (O2), if H17 is ever verified in its favour.
- A `doctor` rule that reads `settings.json` (H15), for example an entry whose script is missing.
- The output style key a later `check-first` run leaves (§2's non-scope).

## 5. Repo hazards, with live numbers

- Board item 108 is `OPEN`, with GATE 1 answered (O5), and its files include `setup.ts`,
  `global-files.ts` and `CHANGELOG.md` (F9). The two items must not build at the same time: one
  builder per repo, and whichever starts second waits for the other's Phase 1 to be committed.
- `bun test` is 1806 tests in 101 files and took 97 seconds on macOS on 2026-10-16. CI's Linux job
  is the proof for anything that lists a folder (CLAUDE.md, gates that lie); BD-8 lists one.
- `doctor .` must run in the main checkout, not a worktree (CLAUDE.md).
- No gate reads `settings.json` (H15), so a green run proves nothing about it beyond the tests.

## 6. Session protocol

`docs/AGENT-PRACTICES.md` Parts 5 and 7. One phase per session. Never run `git commit` or
`git push`; end each phase with the two copyable blocks.

## 7. GATE 2

Asked 2026-10-16 in chat, in one batch:

- **Q1.** Approve the two phases, their order and drivers (Opus 5.5, then Sonnet 5.5)?
  Recommended: yes.
- **Q2.** BD-6: may a script go wherever no entry runs it, which also removes a `check.sh` whose
  entry never existed? Recommended: yes. The alternative keeps it only where this run pruned its
  entry.
- **Q3.** BD-9: the `settings.json` label when a run prunes. Recommended: plain. Each variant is
  the text after the label's existing `settings.json` prefix and separator, which stay as
  `settingsLabel` writes them.
  - Plain: `hook entries merged in, 2 removed`
  - Explicit: `1 hook entry merged in, 2 hook entries removed`
  - Terse: `hooks: +1 -2`

  Under "No hooks" the plain form reads `2 hook entries removed`.
- **Q4.** BD-8: remove an emptied `~/.claude/hooks/personal-config/` folder? Recommended: yes.

### Answers, 2026-10-16

Zach answered all four in one batch, in chat, the same day the plan was finished.

- **Q1: approve.** Two phases, in this order: Phase 1 on Opus 5.5, Phase 2 on Sonnet 5.5.
- **Q2: yes.** BD-6 stands: a script goes wherever no entry in the `settings.json` the run leaves
  runs it, so an unused `check.sh` is removed with its empty folder.
- **Q3: plain.** BD-9's label is `hook entries merged in, <n> removed` after the existing prefix
  and separator, and `<n> hook entries removed` where nothing is merged.
- **Q4: delete it.** BD-8 stands: an emptied `~/.claude/hooks/personal-config/` is removed.

The plan now authorizes the whole run. The phases do not each need approval again.
