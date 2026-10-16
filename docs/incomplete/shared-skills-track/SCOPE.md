# SCOPE: shared global skills flip to the track of the last `setup` run

**Status:** `SCOPED`. GATE 1 answered 2026-10-16 (§7); next is a design and plan for O5, then GATE 2. Opened 2026-10-16 by board item 108, on Opus 5.5. Owner:
Zach. Split from item 101 (the leftovers design D2, archived 2026-10-16 to
`~/Projects/archive/personal-config/setup-global-leftovers/DESIGN.md`). This document
proposes and decides nothing. §7 holds the questions, and the answers are written in below them.

## 1. What exists, verified 2026-10-16

Every run below used a temp `$HOME` under the session scratchpad, at commit `eb92e69`, with
`bun src/cli.ts setup --from <profile> --projects-dir <dir> --yes --force`. `code.json` and
`non-code.json` are `profiles/starter.json` with `workKind` set to `code` or `non-code`, and
`configWeight: full`, `usesGit: yes`, `skills: all`. Skill files were compared with the stamp line
removed.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| F1 | A code run installs eight skills | Holds. `audit`, `autopilot`, `clean-up`, `close-out`, `delegate`, `handoff`, `passoff`, `scope` | run 1 (code, one git repo) |
| F2 | A non-code run on a copy of that home rewrites the shared skills and removes the code-only ones | Holds. It planned "15 file(s) to write, 5 to remove": `commits.md`, `clean-up`, `delegate`, `autopilot`, `audit`. Item 101's D1 is now built, so this is new since the leftovers scope, where the code-only skills stayed | run 2 (non-code, no target, into a copy of run 1's home); commit `1a6bdd4` |
| F3 | `/close-out` changes body between the two runs | Holds, `[+5 −14]`. Heading "in the same commit as the code" becomes "as the work"; "what is now fixed, which questions it answered ... Add any new file to the code map" becomes "what is now settled, how the proof line was applied"; the gates claim becomes the proof line; step 5 "Run `/clean-up`, last" is dropped | `diff` of `close-out/SKILL.md`, run 1 against run 2 |
| F4 | `/handoff` changes body between the two runs | Holds, `[+8 −7]`, not the `[+45 −44]` the leftovers scope gave. "before any code" becomes "before any work"; the section list loses Environment, Code map, Invariants; the citation forms lose `file:line` and migration name; "Run every gate command once" becomes the proof-line paragraph | the same `diff` |
| F5 | `/scope` and `/passoff` do not change body | Holds. Both diffs are empty apart from the stamp line (`config da1ae84c` against `config 8e622cc9`). They are out of the problem, though each run still rewrites them for the new stamp | the same `diff` |
| F6 | The reverse direction removes `/write-doc` | Holds. A code dry run against run 2's home plans "2 to remove": `write-doc/SKILL.md` and `write-doc/style.md` | run 3 (code, `--dry-run`, copy of run 2's home) |
| F7 | Inside one run, the first target decides the shared skills' bodies | Holds, new. Two git repos `a` and `b`, one with `docs/incomplete/` (implies `folders`), one with `HANDOFF.md` (implies `ledger`). With `a` as the folders repo, `/close-out` is the phase-based body ("Every phase and every board item ends the same way"); with `a` as the ledger repo, it is the item-file body. Every other repo on the machine reads whichever came first | runs 4 and 5; `dedupe` keeps the first of each path, `src/commands/setup.ts:340-347` |
| F8 | `dedupe`'s comment claims the global files are identical across targets | Holds, and the claim is false under F7. "Global files are produced once per repo context; the first wins, the rest are identical" | `src/commands/setup.ts:339` |
| F9 | What a shared skill's body depends on | `shapeOf` reads `workKind`, `usesGit`, weight, `hasBoard` and `workRecordShape`; `namesOf` reads the target's adopted ledger, board and items-folder names. The first three are per run; the last two are per target (`workRecordShape` reads `ctx.repo.workProfile`, which `planRepo` sets from `scan.impliedProfile`) | `src/render/skills.ts:123-150`; `src/render/context.ts:111-123`; `src/commands/setup.ts:196-197` |
| F10 | The skill *set* inside one run is already a union | Holds. `leftovers` runs after `dedupe`, so "a path any target renders is kept: two targets on two tracks keep both tracks' files". Across runs it is not a union (F2, F6) | `src/commands/setup.ts:293-306` |
| F11 | One track is saved for the person | Holds. `config.json` `globalAnswers` holds the last run's `workKind`, `configWeight` and `usesGit` | `src/render/user-config.ts:27,43` |
| F12 | The settled model is one track for the global layer | Holds. init-command D2: "`init` never writes `~/.claude`"; D6: one printed line when the folder's track differs, and "`init` changes nothing because of it". D6's own defense names this defect: "a non-code folder gets a short router while the installed skills are the code set" | `~/Projects/archive/personal-config/init-command/DESIGN.md:102,153-160` |
| F13 | Claude Code loads project skills from `<repo>/.claude/skills/<name>/SKILL.md` | Holds per the docs: "Project ... Sessions in this repository" | Context7 `/websites/code_claude`, page `slash-commands`, "Choose where skills load" |
| F14 | On a name clash, the personal skill wins over the project skill | Holds per the docs: "Enterprise over personal, and personal over project. With `deploy` in both `~/.claude/skills/` and the project's `.claude/skills/`, `/deploy` runs the personal one" | Context7, page `slash-commands`, "Resolve skills that share a name" |
| F15 | Claude Code loads project rules from `<cwd>/.claude/rules/*.md` and every parent's | Holds per the docs. Levels are additive, with "no hard precedence rule between levels" | Context7, page `agent-sdk/claude-code-features`, "CLAUDE.md load locations" |
| F16 | Personal skills do not load in cloud sessions | Holds per the docs: "All your projects on this machine, but not Cowork or cloud sessions" | Context7, page `slash-commands` |
| F17 | Per-repo files this tool writes are kept out of git through `.git/info/exclude` | Holds. Run 1 added seven entries (`/CLAUDE.local.md`, `/HANDOFF.md`, `/PASSOFF.md`, `/passoff/` and three more) | run 1, `p/repo/.git/info/exclude` |
| F18 | Item 101 is built, committed and closed | Holds. Phase 1 `1a6bdd4`, Phase 2 `d1f90d7`; its row became `DONE - 2026-10-16` while this scope was written. Item 107, which the board row once named as this item's wait, is `DONE` too | `git log -- docs/incomplete/setup-global-leftovers`; `PASSOFF.md:107,110` |

Not verified: whether a project `.claude/skills/` loads in a session started in a non-git folder
(F13's docs say "repository"), and whether `doctor`'s rerender compares the global skill paths
(`src/doctor/rerender.ts:65-80` renders everything and keeps every `.md`; which paths it then
reads was not traced).

**What the table says.** The passoff framed this as two skills that flip with the last run. It is
wider in two ways. First, since item 101 shipped, a run for the other track also removes that
track's skills (F2, F6), so a person with both kinds of work now loses `/delegate`, `/autopilot`,
`/audit`, `/clean-up` and `/write-doc` by turns, on top of the flip. Second, the flip happens
inside one run as well: per-target answers reach a global body, and the first target alphabetically
wins (F7, F9). Only `/close-out` and `/handoff` change body across tracks (F5).

## 2. What this is, and what this is not

This is: where the bodies of `/close-out` and `/handoff` come from, so that a session reads the
text written for its own folder; and, where an option needs it, whether a run for one track may
remove the other track's skills.

This is not:

- Removing leftover files in general. Item 101 owns that and built it (F2).
- Hook scripts and `settings.json` entries. Item 109.
- `/scope` and `/passoff`, whose bodies do not change (F5), except their stamp-only rewrite if a
  chosen option touches it.
- The track questions, the short standard, or which skills each track is offered (setup-tracks
  D3, D6, D9; delegate-autopilot D1, D22).
- A `setup` run against the real `~/.claude`.

## 3. Options

### O4. The global layer serves every track the person has set up

Save each track a `setup` run used (F11 saves one). Render code-only files while any saved track
is code, non-code-only files while any is non-code, and one body of `/close-out` and `/handoff`
that branches at read time ("in a repo with gates, do this; in a folder with a proof line, do
that").

*Defense.* G17 of the leftovers scope, applied to the whole layer: a global file must be right for
every session the person runs. Nothing is removed for a person with both kinds of work, which
undoes F2 and F6 for that person.

*Against.* The body branches at read time, which is the long-document-with-parts-cut shape
setup-tracks D3 rejected for the standard. It does not fix F7 (per-target names and shapes), so a
branch is needed for those too, or F7 stays. It supersedes init-command D6 and leftovers D1 in
part, and a person who leaves code work for good needs a new way to drop a track: a new question,
so a new long form and catalog entry.

*Writes.* `config.json` gains a list of tracks. `~/.claude/skills/close-out` and `handoff` get the
branched bodies. *Undo.* `personal-config undo` restores the last run's files; dropping the
feature means removing the list and one branch per skill.

### O5. Install the track-dependent skills into each target

Write `/close-out` and `/handoff` to `<target>/.claude/skills/<name>/SKILL.md`, rendered from that
target's own context, add the path to `.git/info/exclude` as F17 does for the other per-repo
files, and plan a removal of the `~/.claude/skills/` copy, because the personal copy would win the
name clash (F14).

*Defense.* It fixes the defect at its cause, for both directions: each folder reads a body rendered
from its own answers, so F3, F4 and F7 go together, and F8's comment becomes true for what is left
in the global layer. It fits init-command D2, since `init` writes inside the folder, and it makes
D6's notice unnecessary for these two skills. The removal machinery from item 101 already exists.

*Against.* It reverses setup-tracks' layer split for two skills, writes into every target, and a
session started outside any target (a home folder, a repo set up by hand) gets no `/close-out` or
`/handoff` at all. Twenty repos means twenty copies to keep current, and a repo the person drops
from `--projects-dir` keeps a stale copy no run updates. Excluded files do not reach a cloud
session, which matches F16 for the personal copy on 2026-10-16. Whether a non-git folder loads a project
skill is not verified.

*Writes.* Two files per target, one `exclude` line per target, and two planned removals under
`~/.claude/skills/`. *Undo.* `personal-config undo` restores the global copies and removes the
per-target ones; reverting the feature is one more run after the code change.

### O6. A track-neutral global body that reads the track-specific lines from the folder

Keep one global `/close-out` and `/handoff`. Cut every line F3 and F4 show changing, and in their
place tell the skill to follow the folder's own router (`CLAUDE.local.md` or `CLAUDE.md`, which is
already rendered per target and per track) for the record's commit rule, the proof or gates claim,
the section names and the citation forms. The router gains those lines.

*Defense.* No file moves and nothing new is written per target beyond what the router already is.
It fixes F7 as well as F3 and F4, because the per-target names move into a per-target file. It
needs no supersession of init-command D2 or D6, and none of setup-tracks' layer split.

*Against.* The skill stops being self-contained: each fire reads one more file, and in a folder
with no router it has nothing to follow, which is the same gap as O5 with a worse failure (the
skill fires and is vague, where O5's is absent). The router has a size budget (the
`always-on-weight` rule) and the lines move there from a file that loads only on demand. The
standard cannot carry them, because it is byte-for-byte.

*Writes.* Shorter global skills; a few lines more in each router. *Undo.* `undo` restores both.

### O7. Leave the bodies as they are and print a line

After the preview, when the run's track differs from the saved one (F11), print that the shared
skills now follow this run's track, and name `/close-out` and `/handoff`. The passoff names this
as a legal answer.

*Defense.* The smallest change. It matches init-command D6, which chose a printed line over an
action for the same mismatch.

*Against.* The wrong text stays in every session, and under `--yes` the line prints where nobody
reads it. It does nothing for F7, which no run's track comparison can see.

### Not carried

Two global skills under different names, one per track, was considered and dropped: both would
trigger on "close this out", and the harness has no rule for which wins between two personal
skills with different names.

## 4. Dials

| Dial | What it sets | Recommended default |
|---|---|---|
| DIAL-1 | Which skills an option treats as track-dependent | `/close-out` and `/handoff` only, from F5. A test that renders all skills on both tracks and fails when a third one starts to differ keeps the list honest |
| DIAL-2 | (O5) Per-target skills tracked in git or excluded | Excluded, as F17 does for every other generated per-repo file |
| DIAL-3 | (O5) What a session outside any target gets | Nothing for these two skills. The alternative is to keep a track-neutral global copy, which F14 makes shadow every per-target one |
| DIAL-4 | (O4) How a person drops a track | A `setup` question shown only when more than one track is saved |
| DIAL-5 | (all) Whether F8's false comment is corrected regardless of the option | Yes; it is one comment, and it misleads the next reader of `dedupe` |

## 5. Hazards this work walks into

- **Item 101 built the files every option edits** (`src/render/skills.ts`, `src/commands/setup.ts`,
  `src/render/global-files.ts`) and closed on 2026-10-16 (F18), so no board item owns them now.
  O4 must change its `leftovers` behaviour, which is a supersession of leftovers D1, not an edit.
- **F14 turns O5 into a move.** Adding per-target copies without removing the global one changes
  nothing a session sees.
- **`init` filters to its folder** (`insideOnly`, `src/commands/init.ts:55`). Under O5 that is
  what lets `init` write a folder's skills; a test should hold that it still drops every global
  removal.
- **`doctor`'s rerender** renders skills too (`src/doctor/rerender.ts:65-80`). Under O5 the
  per-target skill files become compared files and gain stamps `doctor` must reproduce.
- **Two targets on two tracks inside one run** must each get their own body under O5 and O6; a
  regression test seeds F7's two repos.
- **Tests write only to a temp directory.** Every case needs a seeded home, as runs 1 to 5 did.

## 6. Files a build would touch

| Option | Files | Built by item 101 (now `DONE`) |
|---|---|---|
| O4 | `src/render/user-config.ts`, `src/render/context.ts`, `src/render/skills.ts`, `src/render/rules.ts`, `src/commands/setup.ts` (`leftovers` must keep a saved track's files), `src/commands/init.ts` (D6 compares against a set), `templates/skills/{close-out,handoff}.md`, `src/questions/` (DIAL-4), `docs/choices/` (new long form; `work-kind.md`, `skills.md`), `catalog.json`, `CHANGELOG.md`, tests | `skills.ts`, `rules.ts`, `setup.ts`, `docs/choices/` (Phase 2 edited eight long forms), `catalog.json`, `CHANGELOG.md` |
| O5 | `src/render/skills.ts` (per-target path), `src/lib/paths.ts`, the `exclude` renderer, `src/commands/setup.ts` (`globalCandidates` gains the two old paths), `src/render/global-files.ts`, `src/doctor/rerender.ts`, `docs/choices/skills.md`, `CHANGELOG.md`, tests | `skills.ts`, `setup.ts`, `global-files.ts`, `docs/choices/skills.md`, `CHANGELOG.md` |
| O6 | `templates/skills/{close-out,handoff}.md`, `src/render/skills.ts` (`shapeOf`, `namesOf` shrink), the router renderer and its template, `docs/choices/skills.md`, `CHANGELOG.md`, tests | `skills.ts`, `docs/choices/skills.md`, `CHANGELOG.md` |
| O7 | `src/commands/setup.ts` (one printed line), a test | `setup.ts` |

**Supersessions.** O4 supersedes init-command D6 (one saved track) and leftovers D1 in part (it
must not remove a saved track's files), and the one-track model G13 of that scope. O5 supersedes
setup-tracks' layer split for two skills and amends init-command D2's §2 file list; it does not
contradict D2's rule, since the files sit inside the folder. O6 and O7 supersede nothing. R8
(`src/doctor/rules/settled-supersession.ts`) flags any of these without a dated supersession line.

## 7. Open questions (GATE 1)

- **Q1. Build at all?** Recommended: **yes**. F2 and F7 make it wider than the passoff assumed:
  one non-code folder now removes five code skills as well as rewriting two, and a single code run
  over a mixed set of repos already gives some of them the wrong `/close-out`.
- **Q2. Which option?** Recommended: **O5**, with DIAL-1 to DIAL-3 at their defaults. It is the one
  option that fixes F7, follows init-command D2, and uses removal machinery that exists. O6 is the
  runner-up if writing into every target is not acceptable. O4 does not fix F7; O7 fixes nothing.
- **Q3. Is the supersession the chosen option needs acceptable?** For O5: setup-tracks' layer
  split, for `/close-out` and `/handoff` only, dated 2026-10-16.
- **Q4. F2 and F6 (removal by turns for a person with both kinds of work).** Recommended: leave
  them to leftovers D1 as decided, and record them here only. Only O4 changes them. The
  alternative is a separate item.
- **Q5. Correct `dedupe`'s false comment (F8) with this build, or alone now?** Recommended: with
  this build, so `setup.ts` changes once.

### Answers, 2026-10-16

Zach answered all five in one reply, in chat, the same day the scope was finished: "all recs".

- **Q1: yes.** Build a fix.
- **Q2: O5**, with DIAL-1 to DIAL-3 at their defaults. `/close-out` and `/handoff` are rendered
  into each target's `.claude/skills/`, excluded from git, and the `~/.claude/skills/` copies are
  removed. A session outside any target gets neither skill. DIAL-4 does not apply; DIAL-5 is yes.
- **Q3: yes.** setup-tracks' layer split is superseded for `/close-out` and `/handoff` only, dated
  2026-10-16. The design records the supersession line R8 asks for.
- **Q4: leave F2 and F6 to leftovers D1.** They are recorded here only.
- **Q5: with this build.** F8's comment is corrected in the same change to `setup.ts`.
