# DESIGN: setup leaves another track's global files behind

**Status:** `RATIFIED`. Opened 2026-10-16 by board item 101, on Opus 5.5. Owner: Zach. GATE 1
was answered 2026-10-16 (§6). This file was `SCOPE.md` until 2026-10-16, when the answers were
written in below as D1 to D4. From here it changes by amendment only: a new dated decision or an
`As built:` note, never an edit to a decision in place. `PLAN.md` beside it orders the build.

## Decisions

**D1. A `setup` run plans a removal for each global file this tool wrote that the run no longer
renders** (2026-10-16, GATE 1 Q1, option O1). The files it may remove are DIAL-1's list: each
skill's `SKILL.md`, the three `write-doc/` files, and the rules `commits.md`, `docs-lookup.md` and
`model-routing.md`. A file counts as this tool's when it carries a stamp not marked `adapted`
(DIAL-2). The preview names each removal, `commitPlan` backs it up, and `undo` restores it.

*Defense.* It is the one option that keeps the settled model (G13: one track for the global
layer, set by the last `setup`) and makes it true on disk. `rendersDelegate` then agrees with
the installed skills by construction, the stale stamps of G5 go, and `init`'s notice ("Run
`personal-config setup` to change them") describes what `setup` does. The removal machinery
exists and is tested for `fold` (G9, G10). O2 fixed one sentence and made render depend on the
machine; O3 left the contradiction in every session until a non-technical person deleted files
by hand; O4 and O5 reopen settled designs (setup-tracks, init-command D6).

*What it costs, accepted.* A person with both kinds of work loses the other track's skills and
rules on each run. That is O1's strongest argument against it (§3), and the owner took it.

**D2. G6 is not fixed here** (2026-10-16, GATE 1 Q2). The skills both tracks install keep
flipping to the last run's track. Board item 108 scopes it, with O4 and O5 as its candidates.

**D3. Hook scripts and `settings.json` entries are out of D1** (2026-10-16, GATE 1 Q3). A
removed script under a kept `settings.json` entry fails on every matching tool call, and
`merge-json` cannot remove an entry (G11). G7's delete-guard entry goes to board item 109.

**D4. `--yes` carries out a planned removal** (2026-10-16, GATE 1 Q4). The preview lists it and
`undo` restores it, which is the same footing as every overwrite `--yes` already makes.

*Supersessions.* None. D1 to D4 add behaviour to `setup`; no earlier decision said a run must
leave a global file in place.

## Rules that survive unchanged

- `renderAll` stays a function of the answers and touches no disk. `doctor`'s rerender reads it
  and must not see a removal (§5).
- `init` writes and removes nothing outside its folder (init-command D2, G14).
- Which skills and rules each track is offered (setup-tracks D3, D6, D9, DIAL-6;
  delegate-autopilot D1, D22).
- A file with no stamp, or a stamp marked `adapted`, is never replaced, and now never removed.
- `fold`'s removals keep their current behaviour, including that a removal leaves its folder.
- Hook scripts, `settings.json` and `config.json` are never removed (D3).

**Why this exists.** `docs/incomplete/init-command/PLAN.md` §0 row F1 (now in the archive at
`init-command/PLAN.md:36`) confirmed that a non-code `setup` run rewrites
`~/.claude/rules/model-routing.md` without the `/delegate` exception while `/delegate` and
`/autopilot` stay installed. The rule then says a Deep subagent never builds, and the two skills
tell the agent it may. The ground truth below finds the defect is wider than that one sentence:
the global layer is rendered for one track, a run renders only the files its own track wants,
and nothing removes the files another track's run left.

## 1. What exists, verified 2026-10-16

Every run below used a temp `$HOME` under the session scratchpad, at commit `8b5d973`, with
`bun src/cli.ts`. `code.json` and `nc.json` are `profiles/starter.json` with `workKind` set to
`code` or `non-code`, and `configWeight: full`, `usesGit: yes`, `skills: all`.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | A code run installs eight skills and a `model-routing.md` naming `/delegate` | Holds. Skills: `audit`, `autopilot`, `clean-up`, `close-out`, `delegate`, `handoff`, `passoff`, `scope`. `grep -c delegate model-routing.md` gave 1 | `setup --from code.json --projects-dir <p> --yes` |
| G2 | A non-code dry run against that home plans no removal | Holds. It planned 15 files, among them `model-routing.md [+26 −29]`, and no line for `audit`, `autopilot`, `clean-up`, `delegate` or `commits.md` | `setup --from nc.json --projects-dir <p2> --yes --dry-run` |
| G3 | Applied to a copy, the exception is gone and the code-only skills stay | Holds. `grep -c delegate model-routing.md` gave 0. `~/.claude/skills/` still held `audit`, `autopilot`, `clean-up` and `delegate`, beside the new `write-doc` | the same run without `--dry-run`, into a copy of the home |
| G4 | `commits.md` is left behind the same way (new, beyond F1) | Holds. After G3, `~/.claude/rules/` held `commits.md`, `language-style.md` and `model-routing.md`. `commits.md` renders only for code work in git, so the non-code run neither rewrote nor removed it | `src/render/rules.ts:26`; `ls` after G3 |
| G5 | The leftover skills carry an older config hash than the rest | Holds. `delegate/SKILL.md` carries `config b90e3eac`; `scope/SKILL.md` carries `config da1ae84c` | the stamp line, line 6 of each file after G3 |
| G6 | The skills both tracks install are rewritten for the last run's track (new, beyond F1) | Holds. `/close-out` after G3 reads "in the same commit as the work", drops "Add any new file to the code map", and swaps the gates claim for the proof line. A person who sets up one non-code folder gets the non-code `/close-out` in every code repo. `/handoff` changed the same way, `[+45 −44]` | `diff` of `close-out/SKILL.md` between G1 and G3; `shapeOf`, `src/render/skills.ts:123-133` |
| G7 | The reverse direction leaks too | Holds. A non-code run with `writeDoc: yes`, then a code dry run: no removal of `write-doc/` (three files) or `delete-guard.sh`, and `settings.json` `[unchanged]`, so the delete guard's `PreToolUse` entry stays active for code work | runs into a third temp home, 2026-10-16 |
| G8 | `rendersDelegate` and `rendersAutopilot` read the skills this run renders, not the disk | Holds | `src/render/skills.ts:61-68` |
| G9 | No renderer plans a removal | Holds. The one caller of `resolveRemoval` outside its own file is `fold` | `grep -rn resolveRemoval src` gives `src/commands/fold.ts:36,478` only |
| G10 | A planned removal is backed up and undone like a write | Holds. `commitPlan` refuses a removal that is not in the run's backup | `src/lib/write-plan.ts:45-61`, `:258` |
| G11 | `settings.json` is merged, never pruned | Holds. Its strategy is `merge-json`, and G7's code run reported it `[unchanged]` with the delete-guard entry still in it | `src/render/hooks.ts:253` |
| G12 | The last run's track is saved for the person | Holds since board item 102. `config.json` now holds `globalAnswers` with `workKind`, `configWeight` and `usesGit`. This supersedes init-command F2 and S12, which found no saved track | `src/render/user-config.ts:27,43`; `config.json` after G3 |
| G13 | The settled model is one track for the global layer, set by the last `setup` | Holds. init-command D2 keeps `init` away from global files, and D6's notice tells the person "your global rules and skills were set up for <track> ... Run `personal-config setup` to change them". G2 and G3 show `setup` changes them only in part | `src/commands/init.ts:134-140`; archived init-command `DESIGN.md` D2, D6 |
| G14 | `init` keeps only paths inside its folder | Holds. A removal under `~/.claude` planned by `planEverything` would be dropped by `insideOnly` before `init` previews it | `src/commands/init.ts:55` |
| G15 | Nothing in `doctor` compares the installed skills with the rules | Holds. The only rule that reads a global path is `always-on-weight`, which measures size | `grep -rln "claudeSkillsDir\|claudeRulesDir\|claudeDir" src` |
| G16 | Every global file whose text or presence depends on the track | `commits.md` (code and git), `docs-lookup.md` (code), `model-routing.md` (full weight, and its exception on `/delegate`), `language-style.md` (every track); skills by `offeredSkills`, and every skill body by `shapeOf`; `write-doc/` (non-code); `delete-guard.sh` (non-code) and `commit-guard.sh` (git) | `src/render/rules.ts:22-30`; `src/render/skills.ts:78-87,123-133`; `src/render/write-doc.ts:54`; `src/render/hooks.ts:93,97` |
| G17 | setup-tracks D25 reasons that a global file must be right for every session the person runs | Holds. "a non-coder who also keeps repos needs the delete guard in the folder and the commit guard in the repo, and both are theirs" | `docs/incomplete/setup-tracks/DESIGN.md:805-809` |

**What the table says.** The item asked about one sentence. The defect is that the global layer
holds one track's files, a run writes only its own track's files, and nothing removes the rest.
Three results follow. A file only the old track wanted stays (G3, G4, G7). A file both tracks
want is rewritten for the new track (G6). A file whose text names another file (G8) can then
disagree with what is installed. G6 is the one a removal cannot fix, because the file is still
wanted; it is wanted with different words.

## 2. What this is, and what it is not

This is: what `setup` does with a global file a previous run wrote and this run no longer
renders, and whether `model-routing.md` may name a skill that this run does not render.

This is not:

- The `init` command. D2 keeps it away from global files and this work does not change that (G14).
- The track questions, the short standard, or which skills each track is offered
  (setup-tracks D3, D6, D9, DIAL-6; delegate-autopilot D1, D22). Those are settled.
- Per-repo files. A target's own router, ledger and standard follow its own answers already.
- A fix for G6 inside this item, unless §6 Q2 asks for one. G6 is recorded so it is not lost.

## 3. Options

### O1. Plan a removal for each global file this tool wrote that the run no longer renders

For each path in a fixed list of global files this tool can write (§4 DIAL-1), where the run
renders nothing and the file on disk carries our stamp without `adapted`, plan a
`resolveRemoval`. The preview names it, `commitPlan` backs it up, `undo` restores it.

*Defense.* The global layer becomes exactly what the run renders, so `rendersDelegate` is true
by construction and G13's notice ("run setup to change them") becomes true. The machinery is
built and tested for `fold` (G9, G10). It uses the one model the tool already has: one track,
set by the last `setup`.

*Against.* It makes last-run-wins destructive for the person G17 describes, who keeps both kinds
of work. One non-code `setup` for a folder removes `/delegate`, `/autopilot`, `/audit`,
`/clean-up` and `commits.md` from every code session on the machine, under `--yes` with no
question. It also leaves G6 as it is, so that person still gets the non-code `/close-out` in
their code repos.

### O2. Render the rules from the skills on disk

`rendersDelegate` and `rendersAutopilot` check `~/.claude/skills/<name>/SKILL.md` for our stamp
instead of this run's list.

*Defense.* The smallest change: two functions. The sentence agrees with what is installed,
whatever order the runs came in, and nothing is deleted.

*Against.* It fixes one sentence of G16's list and keeps the contradiction's cause. `commits.md`
stays on a non-code machine (G4), the leftover skills keep a stale stamp (G5), and the kept
`/delegate` still talks about worktrees and gates to a person who has neither. It also makes a
renderer's output depend on the machine, not the answers: `doctor`'s rerender compares bytes
(`src/doctor/rerender.ts`), so two machines with the same answers would render different
`model-routing.md` files, and every test of the rule would need a seeded home.

### O3. Change nothing on disk; print a line that names the leftovers

After the preview, list each stamped global file this run does not render, and say how to
remove it, or that `undo` will not touch it.

*Defense.* Nothing is deleted and render stays a function of the answers. It matches init-command
D6, which also chose a printed line over an action.

*Against.* The contradiction stays in every session until the person acts, and the person this
track exists for is non-technical (setup-tracks "Why this exists") and would be told to delete
files under `~/.claude` by hand. Under `--yes` the line prints where nobody reads it.

### O4. The global layer serves every track the person has set up

Save each track a `setup` run used, not only the last (G12 saves one). Render code-only files
while any saved track is code, non-code-only files while any is non-code, and the
`model-routing.md` exception while `/delegate` renders.

*Defense.* It is G17's own reasoning applied to the whole layer: a global file must be right for
every session the person runs. Nothing is lost for a person with both kinds of work, and
nothing is deleted.

*Against.* G6 has no answer under it. `/close-out`, `/handoff`, `/scope` and `/passoff` each have
one path and two bodies, so a union needs one body that branches at read time ("in a repo do
this, in a folder do that"). That is the long-document-with-parts-cut shape setup-tracks D3
rejected for the standard. It also supersedes init-command D6's one-track model (R8 would need a
dated supersession), and a person who has left code work for good needs a new way to drop a
track.

### O5. Move track-specific files out of the global layer into each target

Install each target's skills under `<target>/.claude/skills/`, so each folder gets its own
track's bodies, and keep only track-neutral files in `~/.claude`.

*Defense.* The only option that fixes G6 at its cause: each folder reads skills written for it.

*Against.* The largest change by far. It reverses setup-tracks' layer split (G3 of that design),
writes into every repo (so the tracked-or-ignored question returns per file), and a person with
twenty repos keeps twenty copies current. Whether Claude Code loads a project `.claude/rules/`
folder was not verified in this session, so the rules half may not be possible at all.

## 4. Dials

These apply to O1. Each has a recommended default.

| Dial | What it sets | Recommended default |
|---|---|---|
| DIAL-1 | Which global files a run may remove | Skills (each `SKILL.md`, and all three `write-doc/` files) and the rules `commits.md`, `docs-lookup.md`, `model-routing.md`. Hook scripts stay out, because G11's `merge-json` cannot remove their `settings.json` entries and a removed script under a kept entry fails on every `Bash` call |
| DIAL-2 | Which files count as this tool's | Stamped and not `adapted`, the same test `stampGuard` uses for a write (`src/lib/write-plan.ts`) |
| DIAL-3 | What `--yes` does with a planned removal | Proceeds, because the preview lists it and `undo` restores it. The alternative is to skip removals under `--yes` and print O3's line |
| DIAL-4 | An emptied skill folder | Removed with its last file. Whether the harness lists an empty skill folder was not checked |

## 5. Hazards this work walks into

- **`init` must not remove anything global.** It filters to its folder (G14), so a removal
  planned in `planEverything` is dropped there. A test should hold that, because a later change
  to `insideOnly` would make `init` delete skills.
- **`dedupe` across targets.** `planEverything` renders one context per target and dedupes the
  result (`src/commands/setup.ts:267-268`). A removal planned in one context and a write of the
  same path in another must resolve to the write.
- **`doctor`'s rerender.** It rebuilds the plan for a configured repo; a removal entry must not
  read as drift.
- **Light weight has the same leak.** A full run then a light run leaves `model-routing.md`
  (light cuts it, `src/render/rules.ts:27`) with `/delegate` named and `/delegate` installed.
  O1 covers it; O2 and O3 do not.
- **The delete-guard entry in `settings.json` (G7)** stays under every option here, since DIAL-1
  leaves hooks out. It blocks `rm` in code sessions after one non-code run.
- **Board item 107 owns `src/render/skills.ts`** and is `IN FLIGHT` (`PASSOFF.md:110`).
  `personal-config passoff claim 101` refused on 2026-10-16 for that collision, and this scope
  did not pass `--force`. A build of O1 or O2 touches that file, so it waits on 107.
- **Tests write only to a temp directory** (X2). Every case above needs a seeded home, as the
  reproduction did.

## 6. Open questions (GATE 1)

- **Q1. Which option for the leftover files?** Recommended: **O1**, with §4's defaults. It is the
  one option consistent with the settled one-track model (G13), and it makes `init`'s notice true.
- **Q2. What to do about G6, the shared skills that flip with the last run?** Recommended:
  record it as its own board item to scope (O4 or O5 are its candidates), and keep this item to
  the leftovers. The alternative is to widen this item now.
- **Q3. DIAL-1: should hook scripts and their `settings.json` entries be in scope?** Recommended:
  no, for the reason in DIAL-1; a separate item if G7's delete guard matters.
- **Q4. DIAL-3: should `--yes` carry out a removal?** Recommended: yes, previewed and undoable.

### Answers, 2026-10-16

Zach answered all four in one batch, in chat, the same turn the scope was finished.

- **Q1: O1.** Plan a removal for each global file this tool wrote that the run no longer renders,
  with §4's defaults.
- **Q2: its own board item.** G6 is not fixed here. A new item scopes it, with O4 and O5 as its
  candidates. Not yet added to the board.
- **Q3: no.** Hook scripts and `settings.json` entries stay out of DIAL-1. G7's delete-guard entry
  goes to a separate item. Not yet added to the board.
- **Q4: yes.** `--yes` carries out a planned removal, because the preview lists it and `undo`
  restores it.
