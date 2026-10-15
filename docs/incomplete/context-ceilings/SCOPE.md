# Part 5's context ceilings, re-measured: scope

Board item 82. Opened 2026-10-15 by a Fable 5.1 session. Status: answered 2026-10-15 (section 6); the standard edit is carried by item 93 (section 7).

Part 5 of the standard sizes every phase by a per-tier ceiling: Mechanical ~500k, Default ~400k, Deep ~250k. The note under the table defines a ceiling as "the context size at which a tier's sessions were observed to start compacting", dated 2026-08-16, and tells an adopter to re-measure when a tier's model changes by watching where sessions compact (`standard/AGENT-PRACTICES.boilerplate.md:546-555`). Nobody has re-measured since. This document holds what this machine's own transcripts say and the choices that follow from it.

## 1. What was swept

Two passes over `~/.claude/projects/`, run 2026-10-15 by a Sonnet 5.5 subagent (main-line transcripts) and repeated for subagent transcripts. The script is reproducible: it streams every `.jsonl`, de-duplicates assistant records by `message.id`, takes context size at a turn as `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, and reports every record with `subtype: compact_boundary`.

| Pass | Glob | Files | Assistant records after de-dup | Compactions found |
|---|---|---|---|---|
| Main-line | `projects/*/*.jsonl` | 1447 | 100,404 | 5, all `manual` |
| Subagents | `projects/*/*/subagents/*.jsonl` | 1398 | 64,431 | 0 |

The records run from 2026-08-08 to 2026-10-15 and cover Sonnet 5, Sonnet 5.5, Opus 5, Opus 5.5, Fable 5, Fable 5.1, Haiku 4.5 and Haiku 5.5. No `autoCompact` key is set in `~/.claude/settings.json` or `settings.local.json`, so the harness default applies.

## 2. The tables

### 2.1 Every compaction on the machine

| EDT | Project | Session | Trigger | Tokens before | Model before it |
|---|---|---|---|---|---|
| 2026-08-11 17:22 | scholarship | 9b00ecdf | manual | 173,974 | Opus 5 |
| 2026-09-30 23:40 | csci-420 | 4c6ab49a | manual | 394,999 | Fable 5.1 |
| 2026-10-03 07:46 | ezhomesteading | f65b3c49 | manual | 776,070 | Opus 5.5 |
| 2026-10-03 09:54 | ezhomesteading | f65b3c49 | manual | 504,727 | Opus 5.5 |
| 2026-10-04 16:41 | csci-420 | cdc1488b | manual | 485,351 | Opus 5.5 |

No record anywhere has `trigger: auto`.

### 2.2 Peak context per model, main-line sessions

A session that switched models is counted once under each model it ran, so the session counts overlap.

| Model | Tier on 2026-10-15 | Peak context | Peak session, date | Sessions | >150k | >250k | >300k | >400k | >500k | >700k |
|---|---|---|---|---|---|---|---|---|---|---|
| Sonnet 5.5 | Mechanical | 803,301 | a9eb8b08, 2026-09-29 | 151 | 77 | 23 | 17 | 7 | 3 | 1 |
| Opus 5.5 | Default | 775,983 | f65b3c49, 2026-10-03 | 214 | 170 | 112 | 85 | 40 | 10 | 2 |
| Sonnet 5 | | 764,745 | 09086250, 2026-08-08 | 307 | 202 | 83 | 38 | 9 | 3 | 1 |
| Fable 5.1 | Deep | 643,629 | 66d64b92, 2026-09-09 | 90 | 78 | 54 | 47 | 25 | 6 | 0 |
| Opus 5 | | 627,751 | 8b0f4815, 2026-09-09 | 565 | 442 | 235 | 141 | 39 | 10 | 0 |
| Fable 5 | | 521,505 | 46360072, 2026-08-13 | 63 | 42 | 27 | 15 | 7 | 3 | 0 |
| Haiku 5.5 | | 267,715 | cae7b0b6, 2026-10-15 | 24 | 11 | 2 | 0 | 0 | 0 | 0 |
| Haiku 4.5 | | 154,928 | cbd54930, 2026-09-26 | 27 | 1 | 0 | 0 | 0 | 0 | 0 |

### 2.3 Peak context per model, subagent transcripts

| Model | Peak context | Peak session, date | Subagent runs |
|---|---|---|---|
| Sonnet 5 | 651,994 | 3ac9595b, 2026-08-15 | 101 |
| Opus 5.5 | 582,522 | 41755dcb, 2026-10-05 | 68 |
| Fable 5.1 | 566,627 | f65b3c49, 2026-10-03 | 41 |
| Sonnet 5.5 | 557,216 | 6e097539, 2026-10-01 | 54 |
| Opus 5 | 348,932 | cdf1be6a, 2026-08-16 | 56 |
| Fable 5 | 280,406 | f8a462ff, 2026-08-20 | 5 |
| Haiku 5.5 | 204,268 | cae7b0b6, 2026-10-15 | 2 |
| Haiku 4.5 | 177,547 | cbd54930, 2026-09-25 | 7 |

## 3. What the tables can support

Four readings hold, and one does not.

1. Part 5's definition of a ceiling is not observable on this machine. The note says a ceiling is where a tier's sessions start compacting on their own. Across 2845 transcripts and 165,000 assistant turns over nine weeks, no session has compacted on its own. The five compactions were all typed by hand.

2. Every tier runs far past its figure without the harness intervening. The Deep ceiling is ~250k; 54 of 90 Fable 5.1 main-line sessions passed it, 25 passed 400k and the peak was 643k. The Default ceiling is ~400k; 40 Opus 5.5 sessions passed it and two passed 700k. Subagents behave the same way: a Fable 5.1 subagent reached 566k inside the 2026-10-03 session.

3. The 2026-08-16 measurement is not reproducible from these records. A Sonnet 5 session reached 764k on 2026-08-08, before the measurement date, with no compaction; Opus 5 reached 627k. If the figures were observed as compaction points, it was on a different window or a different harness than the one these transcripts show, and the note's "repo A" does not say which.

4. The figures still describe a real difference between models, but a different one. Table 2.2's distribution is ordered as the standard expects: Haiku stays under 270k, Sonnet 5.5 rarely passes 300k, Opus 5.5 and Fable 5.1 routinely do. Whatever the ceilings measure, they are not where sessions stop; they are closer to where sessions of each tier tend to be run.

What the tables cannot support: any new number for "where compaction starts". `grep -l '"trigger":"auto"' ~/.claude/projects/*/*.jsonl ~/.claude/projects/*/*/subagents/*.jsonl` matches no file, so no observed auto-compaction point exists to raise a figure to, and the 1M window means one would need a session near 1M to find it.

The design folder for item 81 adds the one qualitative data point: the 2026-10-03 orchestrator ran to 767k and its launches would have stopped at 01:15 under Part 5's figure, before any fix round (`docs/incomplete/delegate-autopilot/DESIGN.md`, G26 and G27). It does not say whether the session's output degraded after 400k, so it is not evidence for a quality ceiling either way.

## 4. Options

Each is Zach's call. The answer to any may be no.

### A. Keep the figures and the definition

Change nothing in Part 5. Record this sweep in the ledger as the re-measurement the note asks for, with its result: no automatic compaction observed.

Strongest argument against: the note claims an empirical basis that the harness's own records contradict. It tells an adopter to "watch where sessions compact", and on a 1M window there is nothing to watch. A rule whose stated check cannot fire is a rule nobody re-measures, which is how this item came to exist.

### B. Keep the definition, change the figures

Raise the figures toward what the window permits, for example by taking each tier's observed peak or a round number under it.

Strongest argument against: the same grep finds no observed ceiling to raise them to, so the new numbers would be as unmeasured as the old ones while carrying the same "measured" label. It also sizes phases by what the harness allows rather than by where the work degrades, and the item 81 evidence says nothing about degradation. A bigger Deep phase is exactly what Part 5 warns against.

### C. Change what a ceiling means

Redefine a ceiling as a budget the standard sets per tier, chosen for cost and for how much a phase can be reviewed, with the observed peaks recorded as what the harness permits. Drop "observed to start compacting" and the re-measure instruction, keep the figures (or set new ones under option B's logic), and keep the date as the date the budget was set.

Strongest argument against: the standard loses its one sentence that pointed at something measurable, and an adopter can no longer verify the figures against their own transcripts. A budget is a preference, and preferences drift without a check. It also touches the `{{DATE_MEASURED}}` token's meaning at `:1141` and every adopter's filled copy of it.

### Where the edit lands

Item 93 cuts standard 2.0.0 and edits the same file. Any change from this item either goes into that cut or follows it as 2.0.x. A separate 1.2.x patch before 93 would turn every configured repo's generated files into `stamp-drift` findings twice in a row (`HANDOFF.md`, Known facts, 2026-09-16 entry).

## 5. Questions for Zach

1. Which option: A, B or C? If B or C, which figures?
2. Where does the edit land: inside item 93's 2.0.0 cut, or a 2.0.x after it?
3. Does the short standard's "Sizing a session" section (`standard/AGENT-PRACTICES.short.md:150`) need a line as well?

## 6. Answers

Zach answered in chat on 2026-10-15.

1. Option C. A ceiling becomes a per-tier budget. The figures stay: Mechanical ~500k, Default ~400k, Deep ~250k. Zach named no new numbers.
2. The edit lands inside item 93's 2.0.0 cut, not as a 2.0.x after it.
3. Yes, the short standard's "Sizing a session" section gets one line.

## 7. The text item 93 carries

Item 93 edits `standard/AGENT-PRACTICES.boilerplate.md` for 2.0.0. These are the three edits this item hands it, so that 2.0.0 carries them and no separate patch is cut. Item 93 may reword to fit its own changes to Part 5; the facts and the definition stay.

### 7.1 Part 5, the note under the ceilings table (`:551-555` at 1.2.0)

Replace the note that begins "A ceiling is the context size at which a tier's sessions were observed to start compacting" and ends at "Measured: `{{DATE_MEASURED}}`." with:

> *A ceiling is the budget the standard sets for one phase on a tier: how much context a session should spend before it lands, chosen for cost and for how much of the phase a review can still cover. It is not the point where the harness compacts. On 2026-10-15 a sweep of 2845 transcripts on 1M-window models found no automatic compaction at any size, with sessions on every tier running past 500k, so that point is not a limit a phase can plan around. The figures date from 2026-08-16. They are targets, not hard stops. They are a property of the model and the harness, not of the repo, so an adopter inherits them and revises them only when a tier's model changes or when phases sized to the figure stop being reviewable. Set: `{{DATE_MEASURED}}`.*

The sentence that follows ("The consequence worth planning around: assigning the Deep tier also shrinks the phase...") stays as it is.

### 7.2 Appendix B, the `{{DATE_MEASURED}}` row (`:1141` at 1.2.0)

Change the description from "The date of the measurement Part 5's table carries" to "The date Part 5's budgets were set" and the default from "`2026-08-16` if you inherit it; the date you re-measured if a tier's model changed" to "`2026-08-16` if you inherit them; the date you revised them if a tier's model changed".

### 7.3 Short standard, "Sizing a session" (`standard/AGENT-PRACTICES.short.md:150`)

After the first paragraph's last sentence ("...re-reads what it already read."), add one sentence:

> On a 1M window the harness may never summarise at all, so do not wait for that sign: Part 5's ceilings are a budget to land by, not a limit the harness enforces.

### 7.4 Changelog

Under 2.0.0 in `standard/CHANGELOG.md`, one line: "Part 5: a ceiling is now a per-tier budget, not an observed compaction point; figures unchanged. Measured 2026-10-15 from this machine's transcripts (board item 82, `docs/incomplete/context-ceilings/SCOPE.md`)."
