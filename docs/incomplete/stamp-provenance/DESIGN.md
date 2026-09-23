# DESIGN — the stamp's two jobs, and a hash that moves on its own

**Status:** `RATIFIED`. Opened 2026-09-23 as `SCOPE.md`; **GATE 1 completed 2026-09-23** and
renamed the same day. Owner: Zach. One repo — `personal-config`.

**Why this exists.** Asked in chat 2026-09-23: how does someone upgrade or modify their setup
gracefully as new versions come out. The audit behind that question found two things that make
a graceful upgrade impossible rather than merely unbuilt, and they are the two scoped here.
They are one item because they share a surface — the stamp line and the hash inside it — and
splitting them would mean two releases each moving that line.

**What was left out.** The `personal-config upgrade` command, which ships the standard's
changelog delta as a pass-off prompt, is the feature these two unblock. It is deliberately a
separate item: it is worth nothing until an adapted file is visible again (§2), and it can be
built without touching anything this one touches.

**How to read this.** §1 is ground truth, dated and cited. §2 is the non-scope list. §3 is the
frozen decisions `D1…D4` — **from here this document changes by amendment only**: a new dated
`D<n>`, a dated supersession naming what it replaces, or an `As built:` note. Never by editing a
decision in place. §4 keeps the options as they were written *before* the decisions, because the
argument against each one is what stops it returning in three weeks as a new objection. §5 is
the dials, §6 the hazards, §7 the GATE 1 record.

---

## 1. What exists, verified 2026-09-23

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | One stamp line carries two unrelated claims | True — "this tool may overwrite this file" and "this file came from version X, answers Y". One regex yields one `StampParts`, and two callers key different decisions off it | `src/lib/stamp.ts:52`, `src/lib/write-plan.ts:92`, `src/doctor/rules/stamp-drift.ts:18` |
| G2 | Exactly two decision points read a stamp | `stampGuard` (may we write?) and `stampDrift` (is it stale?). Nothing else calls `readStamp` or `isOurs` | `grep -rn 'readStamp\|isOurs(' src/`, 2026-09-23 |
| G3 | Part 0 instructs the adapting agent to delete the stamp | §0.8, "at minimum `{{STANDARD_PATH}}` and `{{ROUTER_FILE}}`", then `grep -rn 'personal-config v' .` to confirm none survive | `templates/PART0-PROMPT.md:59-66` |
| G4 | Part 0 already names the consequence | "without it a later `setup` leaves the file alone **and its drift check goes quiet**" | `templates/PART0-PROMPT.md:62` |
| G5 | An unstamped file is invisible to both readers | `stampGuard` returns `no-stamp` and nothing is written; `stampDrift` returns `[]` before reading anything | `src/lib/write-plan.ts:90-94`, `src/doctor/rules/stamp-drift.ts:19` |
| G6 | The standard's changelog claims the opposite | "an adapted copy in another repo carries the version it was adapted from; `personal-config doctor` reports a copy whose stamp is older than `standard/VERSION`" — false for any copy that followed §0.8, per G5 | `standard/CHANGELOG.md:7` |
| G7 | Re-adaptation has twice been a hand-run board item | Row 4 "Stamp the two adapted copies with the standard's version"; row 18 "Re-adapt both copies to standard 1.0.2" | `PASSOFF.md:14`, `PASSOFF.md:28` |
| G8 | The stamp regex rejects any added field | Appending ` · adapted` makes `readStamp` return `null`, in both the `<!-- -->` and `#` spellings. `\S+?` cannot cross a space, so no backtracking saves it | measured 2026-09-23 against `src/lib/stamp.ts:52` |
| G9 | Six files per repo carry a stamp, plus the global layer | `CLAUDE.local.md`, the ledger, the board, the adapted standard, `PART0-PROMPT.md`, `docs/conventions-<lang>.md`; globally the three rule files and each installed skill (stamped below its frontmatter). `.personal-config.json`, the ignore files and the hook scripts are `stamp: false` | dry run 2026-09-23; `src/render/skills.ts:48`, `src/render/repo.ts:369,411`, `src/render/user-config.ts:27`, `src/render/hooks.ts:196` |
| G10 | `configHash` hashes `models` wholesale and every hashed answer | `JSON.stringify({ models, answers: hashedAnswers(answers), archiveHome })`, sha256, first 8 hex | `src/lib/config.ts:173-181` |
| G11 | `profiles/starter.json` is the bottom merge layer | Merge order starter → `--profile` → saved user config → repo `.personal-config.json` → `--from` → flags. Starter supplies 23 answers and 4 model slots | `src/lib/config.ts:25-33`, `profiles/starter.json` |
| G12 | A package-supplied default the repo's file lacks moves that repo's hash | Measured: same answers, `d4027a70` → `1da833e4` when `models.light` is added; → `6e40f9c0` when one answer key is added | scratch probe against `configHash`, 2026-09-23 |
| G13 | That has already shipped once | `0c737ac`, 2026-09-22, added `"light": ""` to `profiles/starter.json`. Every repo configured before it carries a three-slot `models` in its own file and merges a four-slot one as of 2026-09-23 | `git show 0c737ac -- profiles/starter.json` |
| G14 | The code already knew about this class of bug | "a key *no* repo has ever saved is a new input to the hash, and every configured repo reports drift the moment it appears. Verified both ways 2026-09-15: … one invented key produced six `stamp-drift` findings" | `src/lib/config.ts:120-124` |
| G15 | A repo's `.personal-config.json` records the full merged answer set | `answers: hashedAnswers(ctx.config.answers)` and `models: ctx.config.models`, written at setup time | `src/render/repo.ts:357-358` |
| G16 | Dropping `answers` from the hash was considered and rejected, dated | 2026-09-15: "the `practices.*` answers are the main thing that changes rendered content, and a drift rule that cannot see a practice change is not worth the run" | `src/lib/config.ts:160-170` |
| G17 | Not every package-supplied default is inert | `modelLightEnabled` "shapes a real rendered byte on its own — flipping it changes the tier table from three rows to four even if `models.light` never changes" | `src/lib/config.ts:86-90` |
| G18 | Rendering is already pure and returns a plan | `renderAll()` returns `PlannedFile[]` and writes nothing; `resolvePlan` compares against disk and `sameButForStampDate` forgives a date-only difference | `src/render/index.ts`, `src/lib/write-plan.ts:23-35`, `src/lib/stamp.ts:118` |
| G19 | `doctor` builds no render context as of 2026-09-23 | It loads config, reads `standard/VERSION`, and scans documents. It never constructs a `RenderContext`, which needs the target's scan, track mode and per-repo answers | `src/doctor/index.ts:35-80` |
| G20 | `doctor` gates drift on the repo being configured | No `.personal-config.json` ⇒ no drift findings at all | `src/doctor/index.ts:60-63` |
| G21 | Eight test files touch the stamp | `board`, `doctor`, `hook-mode`, `render`, `rerun-noop`, `stamp-guard`, `tracks`, `version-coupling` | `grep -rln` over `tests/`, 2026-09-23 |
| G22 | Four tracked documents carry a literal stamp in their text | `examples/HANDOFF.md`, `examples/PASSOFF.md`, `examples/PART0-PROMPT.md`, `examples/archive/INDEX.md` | `git grep -ln 'personal-config v'`, 2026-09-23 |
| G23 | `README.md` documents the stamp contract in prose | Lines 116-118 and the whole "The stamp guard" section, including "**Deleting the stamp line is how you take a generated file back.**" | `README.md:116-149` |
| G24 | `catalog.json` carries a different hash, for a different purpose | `catalogVersion: "0.5.0+e2b55565"` — the package version plus a hash of the questions, consumed by the pinned `/setup` page on the portfolio site. Not the config hash | `catalog.json:2`, `README.md:335` |

---

## 2. What this is / what this is not

**This is:**

1. A third state for a generated file — *adapted* — that the write guard refuses and the drift
   rule still reports, so Part 0 can protect a file without making it invisible.
2. A rule for what may move the config hash, so that upgrading the package cannot by itself
   make every configured repo report drift.
3. The migration for repos already adapted under §0.8, whose stamps are gone.
4. The documentation those two change: `README.md`'s stamp-guard section, `PART0-PROMPT.md`
   §0.8, and `standard/CHANGELOG.md:7`, which is false as of 2026-09-23 (G6).

**This is not:**

- **`personal-config upgrade`.** The command that reads the standard's changelog between two
  versions and writes a pass-off prompt to re-adapt. Separate item, built after this one.
- **A three-way merge of prose.** Nothing here attempts to merge an upgraded template into a
  file a Part 0 session rewrote. The adapted state exists precisely so that a human or an agent
  does that, knowingly.
- **A per-region "keep this bit" marker** inside a generated file. Whole-file ownership is what
  Part 0 needs; sub-file ownership is a different feature with a different failure mode.
- **Reopening the 2026-09-15 rejection of dropping `answers` from the hash** (G16). Any option
  here that touches it must be a dated supersession naming that decision (R8), not a quiet
  reversal.
- **A new wizard question.** Nothing here is asked of the user, so no `docs/choices/*.md` is
  owed. If an option is chosen that needs one, that is a signal the option is the wrong shape.
- **Touching `catalog.json`'s `catalogVersion`** (G24). Different hash, different consumer,
  pinned by another repo.
- **Regenerating `examples/`.** Board row 67 already owns those files.

---

## 3. Decisions — ratified 2026-09-23

**D1 — A file says "adapted" with a trailing marker on its own stamp line.**
`<!-- personal-config v0.5.0 · 2026-09-23 · config a1b2c3d4 · standard v1.2.0 · adapted -->`.
`StampParts` gains `adapted: boolean`. `stampGuard` refuses to write a file whose on-disk copy
is marked adapted; `stampDrift` keeps reporting it, with a message that points at the upgrade
rather than at `setup`. Part 0 §0.8 changes from *delete the stamp and grep to prove none
survive* to *add one word to it*.
*Defense:* the two readers are the whole surface (G2) and each changes by one condition. The
deciding fact is the failure direction under an old CLI: the regex rejects an added field
outright (G8), so a cached older `npx` copy sees **no stamp** and leaves an adapted file alone.
Option A-3 keeps that CLI parsing — and therefore keeps it overwriting the one file it must not
touch. A-2 was rejected because `.personal-config.json` is gitignored in tracked mode
(`src/render/repo.ts:392`), so its record of what is yours does not survive the fresh clone that
is the usual occasion for a re-run.
*Accepted cost:* an old CLI also stops reporting drift on adapted files, silently (H1). Quiet
and safe was preferred to loud and destructive.
*Supersedes:* `templates/PART0-PROMPT.md:59-66` §0.8, and the README's "Deleting the stamp line
is how you take a generated file back" (G23) — which survives as the third state, no longer as
the only one. Ratified 2026-09-23.

**D2 — Drift is decided by re-rendering, not by comparing a hash.**
`doctor` builds a render context, renders, and compares against what is on disk with the
existing `sameButForStampDate` — the same comparison `resolvePlan` already makes (G18).
*Defense:* it answers the literal question the rule exists to ask — *would re-running change
this file?* — per file, exactly, and so removes the false positives (G12, G13) and the false
negatives (G17) in one move rather than trading one for the other. The behaviour its counter
named as a cost — a CLI upgrade reporting files that would now render differently — is the
upgrade signal this whole effort is for, and is kept deliberately.
*Accepted cost:* `doctor` gains a dependency on the renderers, so a renderer bug can become a
doctor finding, and it needs a context it does not build as of 2026-09-23 (G19).
*Not superseded:* the 2026-09-15 decision to keep `answers` in the hash (G16) stands untouched
— this changes what the drift rule *compares*, not what the stamp *records*. The stamp keeps
its config hash, which stays the provenance record it has always been. Ratified 2026-09-23.

**D3 — Already-adapted repos are migrated by a `doctor` rule with a `--fix`.**
The rule spots a file carrying §0.7's `**Adapted to this repo <date>**` header and no stamp,
reports it, and under `--fix` writes an adapted stamp at the standard version the header names
— `unknown` plus a report where the header names none (DIAL-6).
*Defense:* §0.8 told those repos to delete the stamp and grep to prove it (G3), so the header
prose is the only surviving evidence (H2); `--fix` already exists and is already opt-in, so the
write stays a thing the owner asks for. Ratified 2026-09-23.

**D4 — A standard-version lag in an adapted file reports, and exits 0.**
Every other `doctor` finding keeps its non-zero exit; this one does not.
*Defense:* a stale standard is work to schedule, not a defect in the repo, and it is the
finding most likely to sit unresolved for weeks. A `doctor` that is permanently red for an
upgrade you have not done yet is a `doctor` people stop running — and anyone with it in CI
would go red once per standard release for something they did not cause. Ratified 2026-09-23.

### Rules that survive unchanged

- **The stamp still records provenance, and still carries the config hash.** D2 changes what
  drift compares, not what a stamp says. G16 is untouched.
- **A file with no stamp is still left alone and reported.** Deleting the stamp remains a valid
  way to take a file back for good; it is no longer the only one.
- **The three writes deliberately outside the guard stay outside it** — the `settings.json`
  merge, the appended ignore lines, and `passoff claim`'s in-place edits. None claims
  authorship, so none gains an adapted state.
- **`sameButForStampDate` still forgives the date and nothing else.** Version, config hash and
  standard version remain provenance claims that a difference in must be reported (H4).
- **No new wizard question, and so no new `docs/choices/*.md`.**
- **`catalog.json`'s `catalogVersion` is not touched** (G24).

---

## 4. Options, as written before the decisions

### Part A — how a file says "adapted"

**A-1 — A trailing marker on the stamp line.**
`<!-- personal-config v0.5.0 · 2026-09-23 · config a1b2c3d4 · standard v1.2.0 · adapted -->`.
`StampParts` gains `adapted: boolean`; `stampGuard` refuses an adapted file; `stampDrift` keeps
reporting it with a different message. §0.8 changes from *delete the line* to *add one word to
it*.
*Defense:* one line, one regex, one new field; the two readers already exist and each changes by
one condition. Part 0's instruction gets shorter and less destructive — adding a word is a much
safer thing to ask an agent to do than deleting a line and grepping to prove it.
*Strongest argument against:* the stamp becomes a mutable file, not just a provenance record. A
human editing that word by hand changes whether their file is overwritten, with no confirmation
step — the same class of foot-gun as deleting the line, but easier to do by accident, and now
the *absence* of a word is what gets you overwritten.

**A-2 — A list of adapted paths in `.personal-config.json`.**
Part 0 writes `"adapted": ["docs/AGENT-PRACTICES.md", "CLAUDE.md"]`; the guard and the drift rule
consult it.
*Defense:* the stamp stays exactly as it is — no format change, no forward-compatibility
question, no touching eight test files. One place to look to see what a repo owns, which is also
what an `upgrade` command would want to read.
*Strongest argument against:* the fact and the file part company. A file moved, renamed or copied
into another repo loses its adaptation silently and gets overwritten on the next run, and
`.personal-config.json` is itself untracked in tracked mode (`src/render/repo.ts:392`) — so the
record of what is yours does not survive a fresh clone, which is exactly when a re-run happens.

**A-3 — A second line below the stamp.**
`<!-- personal-config: adapted 2026-09-23 -->` on its own line.
*Defense:* the stamp's existing regex is untouched (G8 becomes moot), old CLIs keep parsing the
provenance they understand, and the adapted marker can carry its own date — which is the one
fact §0.7 already writes into the header prose and nothing machine-reads.
*Strongest argument against:* the compatibility it buys points the wrong way. An older CLI reads
the untouched stamp, concludes the file is its to replace, and **overwrites an adapted document**
— where under A-1 the same CLI sees no stamp and leaves it alone (H1). Keeping the old readers
working is only a virtue where what they do is right. Two lines of tool metadata at the top of
every adapted document is the lesser objection, and two independent markers can disagree — a
file with an adapted line and no stamp, or the reverse, has no defined meaning.

**A-4 — Leave the stamp alone; Part 0 stops deleting it.**
Keep the stamp, and rely on the preview-and-backup path: a re-run shows the diff, the owner
declines the files they have adapted.
*Defense:* zero code. The machinery to survive an unwanted overwrite already exists and is
documented (`README.md:139-144`).
*Strongest argument against:* it makes every re-run a manual review of six files per repo,
forever, and `setup` has no per-file decline — the confirm is a batch (`src/commands/setup.ts:58`).
So in practice the answer is "no" to the whole run, which means no upgrades at all, which is
the state we are in.

### Part B — what may move the config hash

**C-1 — Hash only what the person set.**
Track which merge layer supplied each key; exclude keys whose only source is a package-shipped
profile. A new `starter.json` key then cannot move an existing repo's hash.
*Defense:* targets the cause exactly (G12, G13) and leaves G16's decision intact — every
`practices.*` answer a person gave is still hashed.
*Strongest argument against:* G17. A package default is not always inert — `modelLightEnabled`
changes rendered bytes on its own. So this trades a class of false positives for a class of
false *negatives*: a release that changes a default's value would render different files and
report nothing, which is the failure the drift rule exists to prevent.

**C-2 — Compare recorded against recorded.**
`doctor` hashes the repo's own `.personal-config.json` as written (G15), not the live merge.
*Defense:* trivially stable — the file changes only when `setup` rewrites it — and it is already
the complete answer set, so nothing is lost from the hash's coverage.
*Strongest argument against:* it stops being a check. The hash then compares a file against a
file that was written in the same instant by the same run, so it can only ever differ if
somebody hand-edited `.personal-config.json` — and it goes blind to the saved user layer
changing, which is a real input a person really does change.

**C-3 — Keep the hash; change what drift reports.**
Hash per key. `doctor` reports *which answers* moved, not which files are stale: "`models.light`
appeared in this version's defaults — 0 rendered files change."
*Defense:* one finding instead of nineteen, and the finding names the cause rather than the
symptom. Cheap: the data is already in `.personal-config.json` and the merged config.
*Strongest argument against:* it does not answer the question the rule asks. "Which of my files
are stale" is still unanswered, and a user who upgrades still cannot tell whether to re-run. It
makes the noise legible rather than making it go away.

**C-4 — Drift by re-render.**
`doctor` builds a render context, renders, and compares against disk with the existing
`sameButForStampDate` — the same comparison `resolvePlan` already makes (G18).
*Defense:* exact and per-file. It answers the literal question ("would re-running change this
file?"), kills both the false-positive and the false-negative class at once, and reuses code
that is already pure and already tested.
*Strongest argument against:* cost and coupling. `doctor` as of 2026-09-23 needs a path and a config (G19);
this needs the target's scan, track mode and per-repo answers, which is most of `setup`'s front
half. It also makes every renderer change a doctor finding — upgrading the CLI would report
drift on files whose *answers* never moved, which is truthful but is a second noise class with
the same shape as the one being removed. And a renderer bug becomes a doctor bug.

**C-5 — Do nothing; document it.**
Treat post-upgrade drift as correct: your inputs did change.
*Defense:* it is not strictly false, it is free, and G14 shows the behaviour was understood and
accepted once already.
*Strongest argument against:* a check that fires on every repo after every upgrade for reasons
the user did not cause is a check users learn to ignore, and `doctor` exits non-zero on any
finding (`README.md:163`) — so it breaks anyone who put `doctor` in CI, once per release, for
nothing.

---

## 5. Dials

| # | Dial | Recommended default | Why |
|---|---|---|---|
| DIAL-1 | The marker word | `adapted` | Part 0 §0.7-0.8 already calls it adaptation; a new word would need a glossary entry |
| DIAL-2 | Does `doctor` exit non-zero on a standard-version lag in an *adapted* file? | **Decided 2026-09-23 (D4):** no — report, exit 0 | A stale standard is a thing to do, not a defect in the repo; and this is the finding most likely to sit unresolved for weeks |
| DIAL-3 | Lag threshold before reporting | None — any lag reports | A threshold is a number nobody can defend, and the changelog is per-version anyway |
| DIAL-4 | Does `setup` refresh an adapted file's stamp date to record that it looked? | No | An adapted file is not written at all; writing one field to it would be the write the guard exists to refuse |
| DIAL-5 | Migration for already-adapted repos | **Decided 2026-09-23 (D3):** a `doctor` rule that spots a Part-0 header with no stamp and offers a fix under `--fix` | `--fix` already exists and is already opt-in (`src/doctor/index.ts`); the header `**Adapted to this repo <date>**` is written by §0.7 and is the only surviving evidence |
| DIAL-6 | What version the migration stamps | The standard version named in the file's own header, else `unknown` and a report | Guessing `standard/VERSION` would claim the file is current when it is the one thing we know it is not |
| DIAL-7 | Release shape | One minor, both halves together | They share the stamp line; two releases move it twice |

---

## 6. Hazards this work walks into

- **H1 — An old CLI cannot read a new stamp** (G8). It sees no stamp, so it neither overwrites
  nor reports. That is the safe direction, but a machine with a cached `npx` copy silently loses
  drift reporting and never says why. Affects A-1; A-2 and A-3 avoid it.
- **H2 — The repos that most need the migration have no stamp to migrate.** §0.8 told them to
  delete it and grep to prove it (G3). So the migration cannot key on the stamp; the only
  surviving marker is §0.7's header prose, which is written by an agent and therefore variable.
- **H3 — Fixing the hash moves the hash.** Any change to what `configHash` covers changes the
  value for every configured repo, producing exactly one release's worth of the noise this
  exists to remove. It needs a stated transition, not a silent one.
- **H4 — `sameButForStampDate` blanks the date by pattern** (`src/lib/stamp.ts:118`). A new
  field in the line must keep that regex in step, or every re-run rewrites every file again —
  the bug that function was written to fix.
- **H5 — R8 applies to C-2 and to any option that narrows `answers`** (G16). It is a dated,
  defended decision; changing it is a supersession that names it.
- **H6 — `examples/` is owned by open board row 67.** Four of its files carry literal stamps
  (G22). Two items writing those files is the collision check failing.
- **H7 — The stamp format is a published compatibility surface.** `personal-config` is on npm
  at `0.5.0`; people have files on disk carrying the current format.
- **H8 — S1.** No personal strings in `src/`, `templates/` or `standard/`; a test greps.
- **H9 — X2.** Every test here writes stamps and reads them back; all of it stays inside a temp
  directory with `$HOME` redirected.

---

## 7. GATE 1 — asked and answered 2026-09-23

Four questions, one batch, in chat. Every answer took the marked recommendation.

| Asked | Answer | Recorded as |
|---|---|---|
| Which shape for the adapted state — A-1, A-2, A-3, A-4? | **A-1**, trailing marker | D1 |
| Which fix for the hash — C-1, C-2, C-3, C-4, C-5? | **C-4**, drift by re-render | D2 |
| Migration for already-adapted repos (H2) | **`doctor` rule with a `--fix`** | D3 |
| Does a standard-version lag exit non-zero (DIAL-2)? | **No — report, exit 0** | D4 |

**Still open, deliberately:** nothing. The item is ratified and ready for a plan or a
pass-off prompt.
