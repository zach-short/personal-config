# Scope: setup and init stop replacing a person's records

Opened 2026-10-16 from the agent-pushes rollout. `personal-config init <dir> --yes` across 27
folders replaced stamped ledgers, boards and routers that held real content with fresh 2.x
templates. Every overwritten file is backed up; restoring them is a separate decision.

## 1. What exists, verified 2026-10-16

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | The write decision is one function | `resolveOne` reads the file, asks `stampGuard`, then `applyStrategy`. A stamped file not marked `adapted` gets `guard: 'none'` and is replaced whole under `overwrite` | `src/lib/write-plan.ts:89`, `:144` |
| G2 | The guard treats an edited stamped file as the tool's own, on purpose | "A *stamped* file is written even where a person has edited it. Nothing in the stamp records the bytes we wrote" | `src/lib/write-plan.ts:129` |
| G3 | Ledger, board and router are all plain `overwrite` | `planned()` defaults `strategy` to `overwrite`; none of the three passes another | `src/render/context.ts:27`; `src/render/repo.ts:69`, `:102`, `:316`, `:326`, `:378` |
| G4 | A ledger and a board keep their first stamp for life | `handoff`, `passoff claim` and `fold` edit in place through `edit()`, which adds no stamp and keeps the file's own line 1 | `src/render/context.ts:52`; `src/commands/passoff.ts:199` |
| G5 | The 2.x shape change for ledgers and boards already has its own path | `fold migrate` converts a 1.x ledger and board in place | `src/commands/fold.ts:135` |
| G6 | The router carries lines a later run must change | The commit line comes from `commitRuleLine`; the agent-pushes rollout needed it rewritten | `src/render/context.ts:174`; `src/render/repo.ts:62` |
| G7 | `doctor` advises a re-run for a grown ledger | `stamp-drift` compares every stamped `.md` except `PART0-PROMPT.md` against a re-render and says "re-run it" | `src/doctor/rerender.ts:89`; `src/doctor/rules/stamp-drift.ts:56` |
| G8 | The preview names only `no-stamp` refusals | `markOf` and `leftAlone` know `no-stamp`; `adapted` has no text of its own | `src/lib/ui.ts:141`; `src/commands/setup.ts:551`, `:635` |
| G9 | The damage is wider than five repos | 57 backup folders dated 2026-10-16T2x. Records with real content replaced: portfolio (HANDOFF 2598 lines, PASSOFF 272, CLAUDE.md 227), emoney (532, 462), tv (243, 142), wm-courses (175, 197), fantomworks (152, 149). Ten more repos had 71/39-line ledgers and boards, which are 0.6.0 templates nobody wrote in | `~/.config/personal-config/backups/2026-10-16T2*/manifest.json`, line counts of each stored file |
| G10 | Adapted standards and conventions were replaced too | portfolio `docs/AGENT-PRACTICES.md` (988 lines, no `{{` tokens, so Part 0 ran) and `docs/conventions-typescript.md` (166 lines). Neither carried ` · adapted`. Every other repo's standard still held its Part 0 tokens, so Part 0 never ran there | same backups, `grep -c '{{'` |
| G11 | 28 folders hold a `PART0-PROMPT.md` now | `ls ~/Projects/*/PART0-PROMPT.md` | 2026-10-16 |
| G12 | An existing test reads the ledger's guard on a re-run | "stripping the stamp survives a re-run" asserts the ledger's guard is `none` on a second run. As built it still passes: an untouched seed reads as current | `tests/stamp-guard.test.ts:230` |

## 2. What this is, and what this is not

This is: the write plan stops replacing a ledger, a board or a router whose content a person or a
session wrote, the preview says so by name, `doctor` stops advising a re-run that would do
nothing, and the tests, long forms and CHANGELOG follow.

This is not: restoring the 15 repos from backup (the owner's call, one `undo` or copy per file);
running Part 0 anywhere; changing the stamp format; a line-level patch that rewrites only the
commit line of an edited router; the global layer under `~/.claude`.

## 3. Options

**A. Ledger, board and first item file become `create-if-missing`.** A new strategy: written when
the path is empty or absent, left alone otherwise. Defense: after the first write these files are
records, and G5 means no shape change needs `setup` to rewrite them. Against: it does nothing for
the router (G6) or the standard (G10), and a ledger nobody touched never picks up a newer seed.

**B. Refuse to replace a stamped file that differs from what this tool would render at its own
stamp.** The guard gains a third refusal, `edited`. "What it would render" is the re-render
`doctor` already builds (G7), rendered at the file's own stamp date and inputs. Defense: one rule
covers every stamped file, including the router and the adapted standard, and it closes the gap
G2 records instead of documenting it. Against: the current CLI's templates stand in for the ones
that wrote the file, so an untouched file from an older version reads as edited and is refused.
That failure is visible in the preview and safe, but a router written by 0.6.0 and never edited
would no longer pick up a new commit line until its owner deletes it or edits it.

**C. Warn only.** A separate preview section, "replaces a record with N lines", and a second
confirm that `--yes` does not answer. Against: the 2026-10-16 dry runs showed the diff sizes and
the run went ahead; a warning is the mechanism that already failed.

**Recommended: A for the ledger, board and first item, plus B for the router.** A is exact for
files that are records by nature. B is the honest test for the one file that must still take a
rule change, and a refusal there names the line to change by hand.

## 4. Dials

| Dial | Recommended default | Where |
|---|---|---|
| D1. Which files get B | The router only | One list in `src/render/repo.ts` |
| D2. How B compares | Exact equality after blanking the stamp date (`sameButForStampDate`) | `write-plan.ts` |
| D3. Does `doctor` stop comparing ledger and board | Yes, so it never advises a re-run the guard refuses | `src/doctor/rerender.ts` `isCompared` |

## 5. Hazards

- H1. `tests/stamp-guard.test.ts:230` reads the ledger's guard on a re-run; any test that pins the old behaviour must change with intent.
- H2. `doctor` and the guard must agree (the comment at `stamp-drift.ts:40`). A ledger left alone
  but still compared reports drift no run can clear.
- H3. The first-run seed must still land: an empty or absent ledger is written as it was before this work.
- H4. `init` and `setup` share `finish`; a fix in `resolvePlan` covers both, and a fix in `setup`
  alone would not.
- H5. Gates: `doctor .` must run in the main checkout (CLAUDE.md, "Gates that lie").

## 6. Open questions (the gate)

Q1. Which option? Q2. Should B also cover the adapted standard and the conventions docs (G10)?
Q3. Should `doctor` stop comparing the ledger and board (D3)?

## 7. Answers

Asked and answered 2026-10-16, in chat with the owner.

- Q1: A + B. The ledger, the board and the first item file are written only where nothing is
  there. The router is replaced only where it matches what this tool renders at its own stamp.
- Q2: yes. The same refusal covers the standard and the conventions docs. A standard that still
  holds Part 0's `{{WORKTREE_SETUP}}` token is unadapted and still takes the new version.
- Q3: yes. `doctor` stops comparing the ledger and the board against a re-render.

Build-level calls taken with those answers, 2026-10-16:

- The archive index seed (`INDEX.md` in the archive home) gets the same `create-if-missing`
  rule as the ledger. `archive` appends a line to it per closed effort through `edit()`, so a
  stamped seed grows into a record the same way a ledger does (G4).
- "What this tool renders at its own stamp" is the re-render `doctor` already builds
  (`src/doctor/rerender.ts`), with the answers the repo's `.personal-config.json` held before
  this run. So `doctor`'s drift finding and the guard agree: a drifted router, standard or
  conventions doc is one a re-run leaves alone, and the finding says so instead of "re-run it".
- The first item file needs no rule of its own. `startsBoard` plans it only where neither a
  board nor an items folder exists (`src/render/repo.ts:290`), so a re-run never plans it.
- The standard's unadapted mark is matched as a whole line. Its Appendix A names
  `{{WORKTREE_SETUP}}` inline and keeps it after Part 0 (the standard's "Placeholders"
  paragraph), so a substring test would read every adapted copy as unadapted and replace it.
  The test "a router Part 0 filled in is left alone" builds that exact shape.

## 8. As built, 2026-10-16

`PlannedFile.replace` (`never` or `if-unedited`) and `PlannedFile.unadaptedMark`, read by
`recordGuard` in `src/lib/write-plan.ts` after the stamp guard. Two new `guard` values, `kept`
and `edited`, shown in the preview and counted apart from "already current". `priorRender` in
`src/doctor/rerender.ts` builds the comparison for `setup` and `init` through
`planEverything`'s new `prior` parameter. Tests: `tests/record-overwrite.test.ts`; three
existing tests changed with intent (`rerender`, `tracks`, `conventions-adopted`).
