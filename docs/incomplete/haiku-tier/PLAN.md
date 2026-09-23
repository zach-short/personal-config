# PLAN — a fourth model tier

Design: `DESIGN.md`, RATIFIED 2026-09-22 (D1–D3). This plan turns §6 of that file into phases.

## 0. Facts verified 2026-09-22 (same session as the design; no drift to supersede)

Confirmed again immediately before writing this plan: no other open effort in this repo touches
`ModelTiers`, `src/questions/you.ts`'s model-* questions, or `src/render/rules.ts`'s
`modelRoutingRule` (`git status --short` shows `src/questions/you.ts` and
`docs/choices/commit-policy.md` modified from unrelated work already in the tree; neither
overlaps this plan's files). `docs/incomplete/setup-tracks/DESIGN.md` is a separate, unrelated
open effort (track-axis design, not model tiers).

## 1. Decisions taken since ratification

None yet. `BD-1` onward, if any build-time call is needed, gets recorded here with a one-line
reversal.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Engine & copy | **Default** | none (see GATE 2 question) | comfortable | Naming, question wording and gating logic where a wrong call would be believed and no gate catches it — Part 4's own Default-subagent criterion |
| 2 | Config propagation | Mechanical | none | comfortable | Bounded, pattern-following: add one member to four already-enumerated sets/objects |
| 3 | Test migration | Mechanical | none | comfortable | Ratchet edit across 9 files following Phase 1's fixed shape; one new file for the new behavior, per the owner's saved `new-file-per-feature` convention |
| 4 | Fixtures & gates | Mechanical | none | comfortable | Regenerate, run gates, fix drift — whole verification is reading the output |

All four are `comfortable` against a Mechanical or Default driver's ceiling — nothing here is
`tight`; the total production-file count (10) and test-file count (10, incl. one new) is well
inside a single ordinary phase's budget for each stage.

### Phase 1 — Engine & copy

**Status: BUILT, 2026-09-22.** Run as an in-session Opus subagent, worktree-isolated (GATE 2
execution question), then merged into the main tree by hand once its worktree and the main repo
were confirmed to share the same HEAD.

**Scope**

1. `src/lib/types.ts` — add `light: string` to `ModelTiers` (types.ts:76-80).
2. `src/questions/you.ts` — two new questions, placed after `model-fast` (ending line 192 as
   of 2026-09-22):
   - `model-light-enabled` (`select`, `configKey: 'modelLightEnabled'`, `readMore: 'model-tiers'`,
     `when: { key: 'configWeight', is: 'full' }`): "Do you want a narrow tier below Mechanical,
     for work where you can tell immediately if it went wrong?" Options `yes` / `no`
     (`no` recommended, per D1's opt-in default).
   - `model-light` (`kind: 'text'`, `configKey: 'models.light'`, `readMore: 'model-tiers'`,
     `when: { all: [{ key: 'configWeight', is: 'full' }, { key: 'modelLightEnabled', is: 'yes' }] }`):
     "Which model is your Light tier — for work where you can tell immediately if it went wrong?"
3. `src/render/rules.ts` — `modelRoutingRule()`: the table gains a conditional fourth row (only
   when `answer(ctx, 'modelLightEnabled') === 'yes'`), and Mechanical's row description is
   trimmed to remove the now-Light-owned examples (bounded rename, doc reconciliation stay;
   read-only/reporting/format-conversion move to Light's row).
4. `docs/choices/model-tiers.md` — retitle for four tiers (conditional on opting in), add D3's
   worked example paragraph, trim Mechanical's section to match rules.ts's new copy, add a
   "how to undo" line for the new tier consistent with the existing one.
5. `README.md:65` — "Your three model tiers" → "Your model tiers" (or "up to four" — exact
   wording is this phase's call, not pre-decided).

**Subagents:** none planned inline; see GATE 2's open question on whether Phase 1 itself runs as
an in-session Default subagent, a full session model switch, or a handed-off pass-off.

**Done when**

- `bun run typecheck` and `bun run lint` are green on the five files above.
- A hand-read of the rendered `model-routing.md` output (via a `--dry-run` of `setup` against a
  profile with `modelLightEnabled: 'yes'` and one against `'no'`) shows exactly 4 rows in the
  first case and exactly 3 in the second — a green gate cannot see markdown table row counts.
- The `model-tiers.md` and `rules.ts` Mechanical descriptions no longer both claim the same
  worked example (grep for the phrase moved to Light; it must appear in exactly one place).

**Watch for:** wording that reads fine alone but makes Mechanical and Light sound like the same
tier again once both are in front of a reader — the exact failure mode D1 exists to prevent.

### Phase 2 — Config propagation

**Status: BUILT, 2026-09-22.** Key names matched the plan exactly. One addition beyond the
original scope: `src/phases/run.ts`'s `modelDefault()`, a site Phase 1 found and DESIGN.md §6a
records — not a new design decision, the same dispatch pattern as the other three tiers.

**Scope**

1. `src/lib/config.ts` — `emptyConfig` (line 41), `UNHASHED_ANSWERS` (88-93), `PERSONAL_ANSWERS`
   (127-138): add the `light` / `models.light` member to each, matching the existing three.
2. `src/commands/setup.ts` — `modelsFrom()` (276-282): add the `light` field, reading
   `answers['models.light']` with the same fallback pattern as the other three.
3. `profiles/zach.json` — add `"models.light": "Haiku 4.5"` is wrong shape; correct shape is
   `"models": {..., "light": "Haiku 4.5"}` plus `"answers": {..., "modelLightEnabled": "yes"}`.
4. `profiles/starter.json` — `"models": {..., "light": ""}`, no `modelLightEnabled` answer (falls
   through to the question's own recommended default of `no`).

**Done when:** `bun run typecheck` green; a `--dry-run --profile zach` shows the fourth row, a
`--dry-run --profile starter` does not.

**Watch for:** `UNHASHED_ANSWERS` and `PERSONAL_ANSWERS` are allowlists — missing the new key from
either silently produces the wrong behavior (an unhashed model name would double-hash, per
`config.ts`'s own comment; a non-personal model tier would be re-asked every repo instead of saved
once) rather than a visible error.

### Phase 3 — Test migration

**Status: BUILT, 2026-09-22.** The two literal-object compile errors (`helpers.ts`,
`config-hash.test.ts`) and the count/list drift in `catalog.test.ts` were mechanical, as planned.
Two files needed a real fix rather than a ratchet: `back.test.ts` and `resume.test.ts` both
asserted "every question in `you` gets answered" over the *static* catalog rather than over
questions whose `when` actually resolved true — a premise `model-light`'s opt-in breaks for the
first time, since every prior conditional in this phase depended only on the three track axes.
Fixed by filtering both assertions through `matchesWhen`, not by special-casing the one id.
`tests/model-tier-four.test.ts` added per the plan, covering the opt-in gate, the conditional
row, and the no-duplication property, each on and off.

**Scope**

1. Extend the 9 existing files' ~51 touch points (`tests/back.test.ts`, `catalog.test.ts`,
   `config-hash.test.ts`, `config.test.ts`, `gated-answers.test.ts`, `helpers.ts`, `narrow.test.ts`,
   `tracks.test.ts`, `user-config.test.ts`) to the four-key `models` shape and the two new answer
   keys, following each file's existing pattern for the other three keys.
2. New file, `tests/model-tier-four.test.ts` — per the owner's saved `new-file-per-feature`
   convention: the opt-in gate (asking `model-light` only when `modelLightEnabled: 'yes'`), the
   conditional fourth table row, and the trimmed Mechanical row, each with a fixture that
   exercises both the "on" and "off" case (mirrors `X1`'s violate/pass pairing, applied to a
   render function rather than a doctor rule).

**Done when:** `bun test` green, including the new file; `grep -rn "models\.\(deep\|fast\|default\)" tests/`
finds no remaining 3-tuple-only fixture that should have grown a fourth member.

**Watch for:** a fixture copy-pasted from the three-key pattern that quietly omits `light` instead
of setting it to `''` — passes at first, breaks the moment `emptyConfig`'s shape is checked
structurally rather than by individual key.

### Phase 4 — Fixtures & gates

**Status: BUILT, 2026-09-22.** `bun run catalog` regenerated `catalog.json` (39 questions).
`tests/golden/full-track.json` needed 9 hash updates, exactly the 3 files (`.personal-config.json`,
`~/.claude/rules/model-routing.md`, `~/.config/personal-config/config.json`) × 3 variants
(tracked/untracked/team) the design's own hazard list predicted — verified by a scratch script
that recomputed only those keys and confirmed no other file's hash moved, then documented as a
second deliberate divergence in `tracks.test.ts`'s docstring, beside the existing
`close-out/SKILL.md` one. All four gates green: `bun run typecheck`, `bun run lint`,
`bun test` (664 pass, 0 fail), `bun run doctor . examples` (0 findings in any file this effort
touched — the 7 remaining findings are pre-existing, in `HANDOFF.md`/`PASSOFF.md`, owned by
unrelated work in flight elsewhere in this repo).

**Scope**

1. `bun run fixtures` to regenerate `tests/fixtures/` and `tests/golden/full-track.json` against
   the new profile shape.
2. Run, in order: `bun run typecheck`, `bun run lint`, `bun test`, `bun run doctor . examples`.
3. Fix whatever each gate reports; no new design decisions expected at this stage — anything that
   looks like one gets kicked back to `DESIGN.md` as a new dated decision, not improvised here.

**Done when:** all four commands in step 2 exit 0, and a `git diff --stat tests/golden/` /
`--stat tests/fixtures/` is read by a person before it's accepted, not just trusted because the
gate passed — regenerated goldens are exactly the kind of file a green gate can rubber-stamp
without anyone having looked at what changed.

**Watch for:** the golden/fixture hazard from `DESIGN.md` §7 — a regenerated snapshot that "looks
different" because the new keys are present is expected; one that changes unrelated rendered
content is not, and is the actual thing this phase exists to catch.

## 3. Dials

Already resolved in `DESIGN.md` §4 (D1–D3); none newly opened by planning.

## 4. Seams reserved, deliberately not built

- **Promoting `light` into `standard/AGENT-PRACTICES.boilerplate.md`'s own driver/subagent/budget
  tables.** Explicitly out of scope per `DESIGN.md` §3; would need its own scope pass and a
  version bump of the boilerplate.
- **A fifth tier, or a fully open-ended tier list.** `ModelTiers` stays a fixed four-field type,
  not an index signature or array — nothing here builds toward "N tiers." If that's ever wanted,
  it's a different, larger design.
- **Any change to `docs/choices/model-routing.md`** (the mismatch-handling doc). It never
  enumerated the tier count and needs no edit; left alone deliberately rather than touched
  reflexively because a neighboring file changed.

## 5. Repo hazards, with live numbers

- 9 test files, ~51 existing touch points (counted 2026-09-22 via `grep -c`) — the single largest
  cost center in this plan, all mechanical.
- `tests/golden/full-track.json` and `tests/fixtures/` are git-ignored/generated — verified via
  `.gitignore` inspection 2026-09-22 — so Phase 4's regeneration is required, not optional, and
  cannot be skipped by "it wasn't in git status."
- No archive exists yet for this repo (`~/Projects/archive/personal-config/` absent, checked
  2026-09-22) — irrelevant to this plan directly, but means Stage 8 close-out for this effort
  will be creating that directory for the first time, not moving into an existing one.

## 6. Session protocol

This file. Phases run in the order listed — 2 and 3 both depend on Phase 1's exact key names, so
neither starts until Phase 1's `done when` is green. Phase 4 runs last, once 1–3 are all green.
GATE 2 (below) covers phase order, drivers and the one open execution question; once approved,
the plan authorizes the whole run and phases do not each need re-approval.
