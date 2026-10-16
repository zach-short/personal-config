# Plan: `/close-out` and `/handoff` move into each target

Design: `DESIGN.md`, `RATIFIED` 2026-10-16 (D1 to D6). This plan turns it into two phases.

**Status.** `PLANNED` 2026-10-16, Opus 5.5 (board item 108). Approved at GATE 2 the same day:
Zach chose every recommended answer, recorded in §7.

## 0. Facts verified 2026-10-16 (supersede the design where they differ)

A second pass, by reading the code at `05fb906` in the main checkout and by Context7. The runs of
`DESIGN.md` §1 stand without a rerun: `git diff --stat eb92e69 HEAD -- src templates` is empty,
so the code they ran is the code a build starts from.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| P1 | Every skill path is fixed to the global folder | Holds. `skillPath` joins `claudeSkillsDir()`, and `renderSkills` renders every wanted skill there | `src/render/skills.ts:47-49,60-62` |
| P2 | The global copies leave by item 101's removal once no context renders them | Holds. `skillFiles()` lists `close-out` and `handoff`; `leftovers` plans a removal for each candidate no planned file has | `src/render/skills.ts:42-45`; `src/commands/setup.ts:293-307` |
| P3 | A run with no target renders one context with no repo | Holds. `targets` is `[null]` when `repos` is empty, and `ctx.repo` is then `null` | `src/commands/setup.ts:287`, `contextFor` |
| P4 | F17 holds for untracked mode only | Holds as amended in `DESIGN.md` §1. Tracked: `.gitignore` gets `/.personal-config.json` and `/PART0-PROMPT.md`. Untracked: `.git/info/exclude` gets those and the ledger, board, items folder, `CLAUDE.local.md`, `AGENT-PRACTICES.local.md`. A folder or `usesGit: no`: no ignore file | `src/render/repo.ts:478-512` |
| P5 | `doctor` compares a per-target skill file | Holds by reading. The walk skips `.git`, `node_modules`, `worktrees` and four build folders but not `.claude` (`src/doctor/scan.ts:118-126`); depth 4 reaches `.claude/skills/<name>/SKILL.md`; the rerender compares every `.md` that `renderAll` returns (`src/doctor/rerender.ts:79-91`). So the new files are compared, and must reproduce from the target's stamp | the three citations |
| P6 | `init` keeps a per-target skill and drops the global removal | Holds by reading. `insideOnly` keeps changes under the folder, then throws only on a kept change under `~/.claude` | `src/commands/init.ts:173-184` |
| P7 | Project skills load from the start folder and each parent up to the repo root; a worktree reads up to its own root, and on v2.1.277 or later falls back to the main checkout's project skills when the worktree has no `.claude/skills` | Holds per the docs | Context7 `/websites/code_claude`, page `slash-commands`, "Load skills in monorepos and subdirectories" |
| P8 | A non-git folder loads its own `.claude/skills/` | Holds per the docs for the start folder: "the directory where you start it" carries no git condition. The parent walk "up to the repository root" is not defined without a repo. Not seen in a live session | the same page |
| P9 | A session in the projects folder itself, above every target, gets neither skill | Holds by P7: skills load from the start folder and its parents, never from a child at startup. Same footing as D4 | the same page |
| P10 | An `adapted` or unstamped global copy is never removed, and it would shadow the per-target copy | Holds. `resolveLeftover` returns `null` for both (leftovers BD-4); on a name clash the personal copy wins (`DESIGN.md` F14). See BD-3 | `src/lib/write-plan.ts` `resolveLeftover` |
| P11 | Tests that assert the global path of either skill | `tests/tracks.test.ts` and `tests/golden/full-track.json` name `close-out/SKILL.md` or `handoff/SKILL.md` | `grep -rln "close-out/SKILL\|handoff/SKILL" tests` |
| P12 | Item 109 and this item share lane J and no file | Holds. Item 109 owns `src/render/hooks.ts`, `src/render/ceiling.ts`, `src/lib/write-plan.ts` and their tests; this plan edits none of them. Lane J runs in order, so the two builds do not run at once | `PASSOFF.md:111-112` |
| P13 | The suite is green before the build | `bun test`: 1806 pass, 0 fail, 101 files | 2026-10-16, `81ce644` |

## 1. Decisions taken since ratification

- **BD-1. A second skill renderer, `renderTargetSkills(ctx)`, in `src/render/skills.ts`.** A
  new constant `TRACK_SKILLS = ['close-out', 'handoff']` (D2). `renderSkills` renders the wanted
  skills minus `TRACK_SKILLS` to `~/.claude/skills/`; `renderTargetSkills` renders the wanted
  skills that are in `TRACK_SKILLS` to `<ctx.repo.scan.path>/.claude/skills/<name>/SKILL.md`, and
  returns `[]` when `ctx.repo` is `null` (D4, P3). "Wanted" stays `offeredSkills` under the
  `skills` answer, so a light track still gets both, now per target. `renderAll` calls both.
  `skillFiles()` keeps listing both names at their global paths, which is what removes the old
  copies (P2). *Reversal:* drop `TRACK_SKILLS` and the second renderer.
- **BD-2. Which ignore file takes the two lines** (GATE 2 Q2). Recommended: add
  `/.claude/skills/close-out/` and `/.claude/skills/handoff/` to `renderIgnore`'s `personal`
  list, which every git target with `usesGit` gets: `.gitignore` in tracked mode,
  `.git/info/exclude` in untracked mode. A folder or `usesGit: no` gets none, as now (P4). This is
  D3 read literally. *Reversal:* move the two lines to the `untracked` list.
- **BD-3. A global copy that cannot be removed is named after the preview** (GATE 2 Q3).
  Recommended: where `~/.claude/skills/close-out/SKILL.md` or `handoff/SKILL.md` exists with no
  stamp or an `adapted` one, `setup` prints one line naming the path and saying it hides each
  folder's own copy (P10). It removes nothing. *Reversal:* delete the line.
- **BD-4. `dedupe`'s comment** (D6) becomes: "Global files are produced once per context and the
  first wins. A global body that reads a per-target answer takes the first target's
  (shared-skills-track F7); `/close-out` and `/handoff` are rendered per target for that reason."
- **BD-5. `doctor` and `init` get no code change.** P5 and P6 say both already handle a file
  inside the target. Each gets a test, not an edit.
- **BD-6. The tests go in a new `tests/shared-skills-track.test.ts`** (X1's rule on new files),
  and P11's two files are updated where they assert the old path.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Render the two skills per target | Opus 5.5 | none | comfortable | One renderer split, one ignore list, one comment, one printed line, one new suite. A wrong path is loud (a skill missing or doubled), so the Default tier |
| 2 | Long form and changelog | Sonnet 5.5 | none | comfortable | Doc reconciliation against a fixed Phase 1: mechanical, checkable by grep and `doctor` |

### Phase 1. Render the two skills per target

**Status.** `BUILT` 2026-10-16, Opus 5.5, gates green, not yet committed (the owner commits).
Board item 108.

*As built.* As scoped, with four deviations, each a consequence the plan did not see:

- **`src/lib/hidden-tracked.ts` changed.** `meantToBeTracked` compared ignore lines to paths
  exactly, so a folder line such as `/.claude/skills/close-out/` did not cover
  `.claude/skills/close-out/SKILL.md`, and a tracked repo's preview would have warned that the
  skill is hidden from git. A line ending in `/` now covers the folder, as git reads it
  (`keptOutBy`). A case in the new suite fails without it (checked by undoing the fix).
- **`finish` lost its warnings to `sayWarnings`.** The BD-3 line put `finish` at complexity 13,
  over Biome's 12. The warnings moved together, in the same order.
- **More test files changed than P11 named.** Five skill suites rendered only `renderSkills`
  and looked up `/close-out` by name, so `tests/helpers.ts` gained `everySkill(ctx)` (both
  renderers) and `tests/{skills,clean-up-skill,clean-up-last-step}.test.ts` use it.
  `tests/global-leftovers.test.ts` runs with no target, so its global skill list lost the two.
  `tests/tracks.test.ts`'s light `doctor` case now checks five files (P5 seen live), and a moved
  proof line drifts the three documents but not the two skills, whose text does not carry it.
- **The golden file changed two more hashes per variant than the plan said.** The two skill
  keys were renamed with their hashes kept (the proof the bodies did not move). The ignore file
  gained the two lines, and `PART0-PROMPT.md` lists every file the run writes in the repo, so it
  gained two rows and a wider column. 83 keys still.

The BD-3 line reads: "N skill file(s) in your home folder were kept because you changed them
or wrote them yourself. Each one hides the copy this run writes into every folder. Move it aside
to use the folder's own:" and then one path per line. The owner has not chosen this wording
(R7); the hand-back asks.

*Proof, 2026-10-16.* A temp home under the session scratchpad, with repos `a` (holding
`docs/incomplete/`, so `folders`) and `b` (holding `HANDOFF.md`, so `ledger`), and a stamped
`~/.claude/skills/close-out/SKILL.md` seeded as an older run would leave it. The code run
planned `/close-out (no longer installed)` and removed it; `~/.claude/skills/` then held
`audit autopilot clean-up delegate passoff scope`. `diff` of the two targets' `close-out` showed
"Every phase and every board item ends the same way" and the phase header in `a`, and the
`## Close-out, <date>` item-file body in `b`. A non-code run into a copy of that home planned
"5 to remove" (the code-only skills and `commits.md`, F2, D5), wrote no global `/close-out` or
`/handoff`, and both targets' `close-out` then read "in the same commit as the work". `doctor`
on `b` after the code run: "no findings". Gates: typecheck clean, lint clean with no warnings,
`bun test` 1820 pass in 102 files, `doctor . examples` 11 findings, the same 11 as at `81ce644`.

**Scope.**

1. `src/render/skills.ts`: `TRACK_SKILLS`, `renderTargetSkills`, a `targetSkillPath(ctx, name)`
   beside `skillPath`, and `renderSkills` filtered (BD-1). `variables`, `shapeOf` and `namesOf`
   are unchanged: they already read the context, and the context is now the target's.
2. `src/render/index.ts`: call `renderTargetSkills(ctx)` beside `renderSkills(ctx)`.
3. `src/render/repo.ts` `renderIgnore`: the two lines (BD-2, as GATE 2 answers).
4. `src/commands/setup.ts`: the `dedupe` comment (BD-4); the BD-3 line, if GATE 2 says yes,
   after the preview in `finish`.
5. `tests/shared-skills-track.test.ts`, every case in the preload's temp home:
   - two git targets in one run, one implying `folders` and one `ledger` (F7's seed): each
     target's `close-out/SKILL.md` has its own body, and neither is at the global path;
   - a code run, then a non-code run into a copy of that home: the global `close-out` and
     `handoff` are planned for removal, and the target's copies carry the non-code body;
   - a run with no target: both global copies are planned for removal and nothing is written
     for either skill (D4);
   - the ignore lines: present in `.gitignore` for a tracked target and in `.git/info/exclude`
     for an untracked one, absent for a folder and under `usesGit: no` (BD-2);
   - an `adapted` global `close-out` is not removed, and the BD-3 line names it;
   - `init` into a folder writes both skills inside it and plans nothing under `~/.claude` (P6);
   - `doctor`'s rerender reproduces a per-target skill from its stamp, so `doctor` on the target
     reports it current (P5);
   - D2's guard: every skill rendered on the code and the non-code track; any skill outside
     `TRACK_SKILLS` whose body differs, stamp removed, fails the test.
6. P11's two files: the global path becomes the per-target path. `tests/golden/full-track.json`
   has no update path; it holds one sha256 per `<variant> <path>` key, written by hand
   (`tests/tracks.test.ts:103-115,281-300`). Rename the two keys in each variant and keep their
   hashes. Each variant has one target, so the bodies must not change, and an unchanged hash is
   the proof. The key count (83, `tests/tracks.test.ts:286`) stays.

**Subagents.** None.

**Done when.**

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

`doctor` runs in the main checkout, and its findings match the 11 at `81ce644`, all in
`PASSOFF.md`. Read `bun run lint`'s output, not its exit code. Plus the proof a green gate cannot
give: in a temp `$HOME` at the build's commit, a code run over two repos (one `folders`, one
`ledger`) writes a different `close-out/SKILL.md` into each, `diff` shows F7's phase-based body
in one and the item-file body in the other, and `~/.claude/skills/close-out/` is gone after the
run. A non-code run into a copy of that home then changes only the targets' copies.

**Watch for.** A test that leaves `$HOME` unredirected deletes the developer's real
`/close-out`. `renderTargetSkills` must return `[]` for a `null` repo, or a no-target run writes
`.claude/skills/` into the working folder (`join('', ...)` is a relative path). The golden file
renames two keys per variant, and no hash in it may change.

### Phase 2. Long form and changelog

**Status.** `BUILT` 2026-10-16, a Sonnet 5.5 subagent in the main checkout, reviewed by the Opus
5.5 lead; not yet committed. Board item 108.

*As built.* `docs/choices/skills.md` names the per-folder paths, the ignore lines per mode, why
the global copies go, the BD-3 line, and an undo that says `undo` keeps a file the run created
(`src/commands/undo.ts`), so the per-folder copies are deleted by hand. `CHANGELOG.md` has two
entries under `Unreleased`. `DESIGN.md` has `As built` notes under D1 and D3. One file the plan
did not name: `catalog.json` embeds every long form, so `bun run catalog` rebuilt it; two keys
moved (`catalogVersion` and `choices[28].body`), checked by a key-by-key comparison with `HEAD`.
`grep -rn "claude/skills" docs/choices catalog.json` leaves only `/write-doc` lines.

*Check, 2026-10-16.* The suite also ran in a `git archive HEAD` copy holding only this item's
files, because another item's uncommitted edits shared the checkout. The first run there found
a real defect: a case that runs the real bin took 5.5 s under load, past Bun's 5 s default, and
the timeout's kill ended the next case's `git init` (exit 143). Those eight cases now take a
30 s timeout (`CLI_TIMEOUT`). Then: 1820 pass in 102 files in both the copy and the main
checkout, typecheck and lint clean, `doctor . examples` 11 findings, the same 11.

**Scope.**

1. `docs/choices/skills.md`: "what it writes" names the two per-target paths and the ignore
   lines; "how to undo it" names `personal-config undo` and the per-target folders; lines
   119-121 (a personal copy wins over a project copy) now explain why the global copies are
   removed.
2. `CHANGELOG.md` under `Unreleased`: one entry for the move, one for the BD-3 line if built.
3. `DESIGN.md`: an `As built:` note under each decision a build changed.
4. `grep -rn "claude/skills" docs/choices catalog.json` and fix any other line that says all
   skills sit in `~/.claude/skills/`.

**Subagents.** None.

**Done when.** The same gates, and the grep in step 4 returns no line that places `/close-out`
or `/handoff` in `~/.claude/skills/`.

**Watch for.** The long form's undo section must not promise that `undo` removes the
per-target copies unless Phase 1's test shows it does.

## 3. Dials

| Dial | Value | Where |
|---|---|---|
| DIAL-1 | `close-out`, `handoff` | `TRACK_SKILLS` in `src/render/skills.ts` |
| DIAL-2 | Kept out of git (BD-2 for which file) | `renderIgnore` |
| DIAL-3 | Nothing outside a target | `renderTargetSkills` returns `[]` |

## 4. Seams reserved, deliberately not built

- Removing a stale per-target copy from a repo later dropped from `--projects-dir`. No run sees
  that repo, so no run can plan it.
- Moving another skill per target. D2's guard test fails first, which is the signal to open an
  item.
- F2 and F6 (D5).

## 5. Repo hazards, with live numbers

- `bun test` 1806 pass at `81ce644` (P13). `doctor . examples` 11 findings in the main checkout,
  all `PASSOFF.md` row cells and one `unfolded`.
- A worktree's `doctor` sees fewer files (CLAUDE.md, "Gates that lie"). Run it in the main
  checkout.
- The item 109 session works in this checkout on its own folder (P12). Stage only this item's
  paths.

## 6. Session protocol

`docs/AGENT-PRACTICES.md` Parts 5 to 7. Never run `git commit` or `git push`; end with the two
blocks from `CLAUDE.md`.

## 7. GATE 2

- **Q1. Approve the two phases as written?** Recommended: yes.
- **Q2. BD-2: where the ignore lines go in tracked mode.** Recommended: `.gitignore`, beside
  `/.personal-config.json` (D3 literally). The alternative is to commit the two skills in a
  tracked repo, like its ledger, so a worktree and a cloud session get them on any version. The
  cost of the recommendation: a worktree reads the main checkout's copy only on Claude Code
  v2.1.277 or later (P7), and a cloud session gets neither.
- **Q3. BD-3: print a line for a global copy that cannot be removed?** Recommended: yes.

### Answers, 2026-10-16

Zach answered in chat: "all recs". Each question takes its recommendation.

- **Q1: approved.** Phase 1 on Opus 5.5, Phase 2 on Sonnet 5.5.
- **Q2: `.gitignore` in tracked mode.** The two lines join `renderIgnore`'s `personal` list.
- **Q3: yes.** `setup` prints the BD-3 line.
