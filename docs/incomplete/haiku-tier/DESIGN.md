# DESIGN — a fourth model tier

Status: RATIFIED, 2026-09-22. Was `SCOPE.md` before GATE 1; see git history for the transition.

## 1. What exists, verified 2026-09-22

| Claim | Verified state | Citation |
|---|---|---|
| The engine hard-codes exactly three tiers, not an open list | `ModelTiers = { deep: string; default: string; fast: string }`, no index signature | [src/lib/types.ts:76-80](../../../src/lib/types.ts) |
| Three sites enumerate the same three keys by name | `emptyConfig`, `UNHASHED_ANSWERS`, `PERSONAL_ANSWERS` each list `deep`/`default`/`fast` literally | [src/lib/config.ts:41](../../../src/lib/config.ts), [:88-93](../../../src/lib/config.ts), [:127-138](../../../src/lib/config.ts) |
| A fourth site turns answers into the tiers | `modelsFrom()` reads `answers['models.deep']` etc. by literal key | [src/commands/setup.ts:276-282](../../../src/commands/setup.ts) |
| The rendered rule is a hand-built 3-row table, not a loop over `config.models` | `modelRoutingRule()` interpolates `tiers.deep`/`tiers.default`/`tiers.fast` into a literal markdown table | [src/render/rules.ts:90-94](../../../src/render/rules.ts) |
| Two questions ask for the two tiers not asked on every track | `model-deep`, `model-fast` — both `kind: 'text'`, both gated `configWeight === 'full'` | [src/questions/you.ts:156-192](../../../src/questions/you.ts) |
| The long-form doc calls it "the three model tiers" by title and states there are three | Title is literally `# The three model tiers`; body never treats the count as open | [docs/choices/model-tiers.md:1](../../../docs/choices/model-tiers.md) |
| README states the count in prose | "Your **three** model tiers and what happens when a task names one you are not running." | [README.md:65](../../../README.md) |
| Both shipped profiles carry exactly the three keys | `profiles/zach.json` and `profiles/starter.json` both have `"models": {"deep", "default", "fast"}` | [profiles/zach.json:8-12](../../../profiles/zach.json), [profiles/starter.json:5-9](../../../profiles/starter.json) |
| 9 test files assert this shape, ~51 touch points total | grep count per file: back 6, catalog 12, config-hash 6, config 5, gated-answers 7, helpers 1, narrow 3, tracks 6, user-config 5 | `grep -c` run 2026-09-22 against `tests/*.test.ts` + `tests/helpers.ts` |
| The same three-tier concept also lives in a second, separate document this repo is forbidden to edit | `standard/AGENT-PRACTICES.boilerplate.md` names Deep/Default/Mechanical in a driver table, a subagent table, a budget table and a GATE-0 placeholder table (lines 13, 492-550, 1064, 1093-1095) — the **shipped standard**, rendered into *other* repos via `{{MODEL_DEEP}}`/`{{MODEL_DEFAULT}}`/`{{MODEL_FAST}}` in `src/render/standard.ts:56-58` | [standard/AGENT-PRACTICES.boilerplate.md](../../../standard/AGENT-PRACTICES.boilerplate.md), [src/render/standard.ts:56-58](../../../src/render/standard.ts) |
| That boilerplate's content is off-limits outside its own version line | "Edit `standard/AGENT-PRACTICES.boilerplate.md`'s content. Only its version header line is in scope" | [CLAUDE.md](../../../CLAUDE.md), "Never do this" |
| The *existing* Mechanical tier is already defined as "fastest, cheapest," and its worked examples already overlap the job list this request supplies | "Mechanical — your fastest, cheapest model," used for "close-out sweeps, a bounded rename, doc reconciliation" | [docs/choices/model-tiers.md:10](../../../docs/choices/model-tiers.md), [:22-23](../../../docs/choices/model-tiers.md) |
| Nothing about a fourth tier was already decided or rejected here | No hits for "haiku", "4th tier", "4-tier", "fourth tier" in HANDOFF.md, PASSOFF.md, CHANGELOG.md, or `docs/choices/*.md` | `grep -in` run 2026-09-22 |
| No archive exists yet for this repo | `~/Projects/archive/personal-config/` does not exist | `ls` run 2026-09-22, per `archiveHome` in [profiles/zach.json:2](../../../profiles/zach.json) |
| Part 4 of the shipped standard already requires every phase/board item to state its own driver model | "Every phase or board item states its driver, and the close-out repeats it" | [standard/AGENT-PRACTICES.boilerplate.md:496-497](../../../standard/AGENT-PRACTICES.boilerplate.md) |

## 2. What this is

Extending the **global** tier mechanism — the one that produces `~/.claude/rules/model-routing.md`
via `src/questions/you.ts` → `src/render/rules.ts` → `docs/choices/model-tiers.md` /
`model-routing.md` — from three named slots to four. That mechanism is domain-neutral engine code
plus a per-person profile answer; nothing in it is specific to config files.

The job-classification rubric supplied in the request (validate syntax, grep patterns, lint,
diff / rename-with-verification, format-normalize, template-copy / test-suite pass-fail,
boilerplate-generate, format-convert) is the *owner's own reasoning for why the new tier earns
its keep*, in the same register as the existing "money paths, sync and merge rules" reasoning
for Deep. It lives in the long-form doc as a worked example, not as literal engine text — the
same way "config files" never appears in the current Deep/Default/Mechanical descriptions.

## 3. What this is not

- **Not a change to `standard/AGENT-PRACTICES.boilerplate.md`.** That document's Deep/Default/
  Mechanical tables are the shipped, versioned standard other repos receive, and its content is
  off-limits outside a version bump — which nobody asked for and which is a separate, much
  larger effort. If a fourth *global* tier turns out well, promoting it into the shipped standard
  is a future item, not this one.
- **Not a rewrite of what "Mechanical" means, beyond removing the now-duplicated examples.** D1
  keeps Mechanical as a real tier; this only trims what it claims once Light exists.
- **Not scoped to config-file work specifically.** The engine has no domain-specific tiers as of
  2026-09-22;
  a tier literally scoped to "config work" would be the first domain-specific concept in a
  person-level rule and is inconsistent with everything else in `you.ts`.
- **Not a one-off hand-edit of `~/.claude/rules/model-routing.md`.** That file is generated and
  stamp-hashed; a hand-edit is either silently overwritten by the next `setup` run or flagged as
  drift by `doctor`, per the stamp mechanism in [src/lib/config.ts:154-173](../../../src/lib/config.ts).

## 4. Decisions

### D1 — Add a fourth tier, opt-in, not unconditional

**Decision.** Add a fourth `ModelTiers` slot. It is not asked unconditionally alongside
Deep/Mechanical the way those two are as of 2026-09-22. A new gated `select` question is asked first
("Do you want a narrow tier below Mechanical, for work where you can tell immediately if it
went wrong?"); only a yes unlocks the text question for the tier's model name and the fourth
table row. Mechanical's own description is tightened at the same time so the two bands stay
distinct rather than overlapping (D2).

**Defense.** This is Option C from `SCOPE.md`. It gives "can the failure be silent" a genuine
fourth answer — Mechanical, as of 2026-09-22, spans "a bounded rename" (instantly verifiable) and "doc
reconciliation across a whole phase" (more room for a subtle miss) under one model; splitting
the narrowest, most-instantly-verifiable slice off is a real second discriminator, not just a
cheaper model for the same job. Opt-in preserves `model-tiers.md`'s own stated argument against
tiers at all for everyone who is happy with three: the full-weight track does not grow by two
more mandatory questions for people who don't want a fourth model.

**Rejected alternative — Option B (tighten Mechanical, no new tier).** Zero new engine surface,
but loses the ability to run two different models for two different risk bands within what is,
as of 2026-09-22, one tier, which is what the owner's own three-way job split (read-only / bounded-
transform / mechanical-with-gates) argues for. Superseded by this decision in full.

**Rejected alternative — unconditional fourth question (Option A).** Simpler gating, but grows
the full-weight track's question count for everyone, including people who never wanted a fourth
model. Superseded by the opt-in gate in this decision.

Date: 2026-09-22.

**As built:** `docs/choices/model-tiers.md` also gained a dedicated "argument against the fourth
tier in particular" passage, beyond what this decision specified — the same steelman register the
file already uses for tiers generally, applied to Light. Not a deviation; folded in without a
separate decision.

### D2 — Tier name: `light` / **Light**

**Decision.** The engine-level key is `light`; the rendered table's row label is **Light**.

**Defense.** `deep` / `default` / `fast` are vendor-neutral role names, not model names — the
whole point, per `model-tiers.md`, is naming a role "without naming a specific release that will
be obsolete in six months." "Haiku" is Anthropic's product name; a starter-profile user pointing
this tier at a different vendor's cheap model would have a tier literally called "Haiku" holding,
say, Gemini Flash. `light` matches the register of the other three and says only what the role is.

**Rejected alternative — `haiku`.** Names the tier after the model the owner actually runs there
as of 2026-09-22. Rejected because it ties the engine's vocabulary to one vendor, unlike every other tier
name in this file.

Date: 2026-09-22.

### D3 — The job-classification rubric lives in the long-form doc only

**Decision.** The owner's read-only/reporting vs. bounded-transform vs. mechanical-with-gates
job list is written into `docs/choices/model-tiers.md` as a worked example, in the same register
as the existing "money paths, sync and merge rules" example for Deep. It is not written into
`profiles/zach.json`, the question `ask` copy, or the rendered rule's table row — all three of
those stay domain-neutral, matching how Deep/Default/Mechanical read as of 2026-09-22.

**Defense.** `profiles/*.json` has no precedent for prose — it holds answers, not reasoning — and
the question/table copy is read by every person who takes the full method, not just one whose
work is config files. A worked example in the long-form doc is exactly the pattern the doc
already uses (Deep's "money paths" list) and costs nothing to a reader who never opens it.

Date: 2026-09-22.

## 5. Rules that survive unchanged

- `standard/AGENT-PRACTICES.boilerplate.md` is not touched, anywhere, including its Deep/Default/
  Mechanical tables — see §3.
- Deep and Default's existing definitions, copy, and gating (`when: { key: 'configWeight', is:
  'full' }`) are untouched.
- The rendered rule's overall shape — one file at `~/.claude/rules/model-routing.md`, a markdown
  table, the `delegate-or-stop` / `warn-only` / `skip` action modes — is untouched; this only adds
  a row and a conditional gate in front of it.
- `docs/choices/model-routing.md` (the mismatch-handling doc) is untouched; it never enumerated
  the tier count.
- The merge/hash machinery's *shape* (`UNHASHED_ANSWERS`, `PERSONAL_ANSWERS` as allowlists,
  `configHash` hashing `config.models` as a whole object) is untouched — `light` is added as a
  fourth member of each existing set, not a new mechanism.

## 6. What changes as a result (production sites)

Recorded here so Stage 4 (`PLAN.md`) can cite it without re-deriving it:

1. `src/lib/types.ts` — `ModelTiers` gains `light: string`.
2. `src/questions/you.ts` — new `select` question (id `model-light-enabled` or similar, gated
   `configWeight === 'full'`), new `text` question `model-light` (gated on the select's answer).
3. `src/render/rules.ts` — `modelRoutingRule()` grows a conditional fourth row; Mechanical's
   rendered description is trimmed per D1.
4. `src/lib/config.ts` — `emptyConfig`, `UNHASHED_ANSWERS`, `PERSONAL_ANSWERS` each gain the
   `light` / `models.light` member.
5. `src/commands/setup.ts` — `modelsFrom()` gains the `light` field.
6. `docs/choices/model-tiers.md` — title and body updated for four tiers; D3's worked example
   added; Mechanical's section trimmed per D1.
7. `README.md:65` — "three model tiers" → "four."
8. `profiles/zach.json` — `models.light: "Haiku 4.5"`, plus the new opt-in answer set to yes.
9. `profiles/starter.json` — `models.light: ""`, opt-in answer left at its recommended default (no).
10. 9 existing test files (~51 touch points) — mechanical extension to the new shape.
11. `tests/golden/full-track.json` — regenerated, not hand-edited (hazard, see below).

## 6a. Addendum — a site missed by §6, found during Phase 1 build (2026-09-22)

`src/phases/run.ts`'s `modelDefault()` (lines 73-78) enumerates `models.deep`/`models.default`/
`models.fast` by literal `configKey` string, exactly parallel to `modelsFrom()` in
`src/commands/setup.ts` — but was not caught by the §1 ground-truth pass because it is reached
only through `defaultFor()`'s fallback chain, not through a `models`-shaped grep. Without a
`models.light` branch, `model-light`'s answer falls through to `''` under any path that relies on
`defaultFor` (notably `--yes`), so a profile's `models.light` value is never read as a default —
Light silently renders `<unset>` even when `profiles/zach.json` names a model. Folded into Phase 2
below as an twelfth site; not a new design decision, since the fix is the same pattern already
governing the other three tiers.

## 7. Hazards this work walks into

- **Silent test drift.** `tests/golden/full-track.json` is a generated snapshot (`bun run
  fixtures` / `tests/make-fixtures.ts`) — adding a key to `profiles/zach.json` or `starter.json`
  changes what a full-track run renders, and the golden fixture has to be regenerated, not
  hand-edited, or a real rendering bug will look like a passing snapshot.
- **Stamp/hash drift for real repos.** `configHash()` hashes `config.models` as a whole object
  ([src/lib/config.ts:165-172](../../../src/lib/config.ts)). Any repo already configured under
  the current three-key shape reports drift the next time `doctor` runs after this ships, even
  with no answer changed, because the shape of the hashed object changed. Expected and matches
  how every other catalog addition behaves, but worth saying plainly.
- **Two systems, same names, easy to conflate.** `standard/AGENT-PRACTICES.boilerplate.md` and
  `~/.claude/rules/model-routing.md` both talk about "Deep / Default / Mechanical" but are
  produced by different code paths and governed by different edit rules. A change that "fixes"
  the tier table in one and not the other silently reintroduces the split this design exists to
  keep visible.
