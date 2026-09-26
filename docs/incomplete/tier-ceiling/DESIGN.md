# Per-repo tier ceiling: design

Cap the most expensive model a repo may run, enforced by Claude Code's `availableModels` setting.

**Status.** Ratified 2026-09-25. Nine ground-truth facts below; three open questions answered in chat and captured as D1, D3, D4 (Zach's calls marked `*`). Ready to build.

---

## Ground truth

### F1: Enforcement is Claude Code's `availableModels`, not a prompt

Checked against current Claude Code docs (Context7, `/websites/code_claude`, pages `model-config` and `settings`) on 2026-09-24.

The setting is honored in project and local settings, not only managed settings. When set, it applies to `/model`, `--model`, the `model` setting, the Agent tool's `model` parameter, subagent frontmatter, and skill and command frontmatter.

A written rule cannot stop the person's own picker, and a hook is not clearly told the model.

**Before building:** re-check the docs in case this changed.

### F2: The lists add together across settings files

Per the same docs, `availableModels` from user, project and local settings are concatenated and deduplicated. So a global `~/.claude/settings.json` that lists the Deep model silently undoes every repo's cap.

**This is the one silent failure in this item.** Managed (org) settings replace the list outright, which is out of our control.

### F3: Entries match loosely

A family name like `opus` matches every Opus. A version prefix like `claude-fable-5` matches Fable 5 and 5.1. An entry naming a specific model in a family turns off that family's wildcard.

`availableModels: []` never enforces the Default picker option.

### F4: Write to `.claude/settings.local.json`, not the tracked `.claude/settings.json`

The cap is the person's budget, not a property of the repo, and a stranger cloning the repo should not inherit it. The tool writes the file, not Claude Code, so the renderer must make sure it is git-ignored.

`src/render/repo.ts` owns the ignore list.

### F5: The shape is a ceiling with three levels

Deep (no ceiling; the recommended default, exactly today's behavior), Default, Mechanical. No floor, because the allowlist can only forbid and nothing can make a model required.

### F6: Model-ID picker

*Recommended in chat, ratified 2026-09-25.*

Ask for model IDs only when a repo picks a ceiling below Deep. Ask once for each tier that stays allowed (for a Default ceiling: Default, Mechanical, and Light if enabled). Never ask for the Deep model's ID: it is blocked by being absent.

Each question is a `select` of popular choices, family names first (recommended: `opus`, `sonnet`, `haiku`, since they survive new releases), then exact versions (`claude-opus-5-5`, `claude-sonnet-5`, `claude-haiku-4-5`), then "Other — type it". "Other" opens a `text` question gated with `when`, exactly like `model-light` is gated at `src/questions/you.ts:236-245`.

No new `QuestionKind` is needed; `src/lib/types.ts:19` already has `select` and `text`. The popular list lives in one data file (`src/questions/model-ids.ts`) because it goes stale several times a year.

### F7: The IDs are per-person; the ceiling is per-repo

*Zach's call, 2026-09-24/25.*

The ceiling belongs in the `discover` phase (`src/questions/discover.ts`) and the repo's `.personal-config.json`. The IDs describe the person's models, so they are asked once and reused. That means adding them to `PERSONAL_ANSWERS` in `src/lib/config.ts`.

**Design decision D1 (see below) resolves the stamp-drift consequence.**

### F8: The routing rule must yield to the cap in writing

*Recommended in chat, ratified 2026-09-25.*

The rendered `model-routing.md` says "never quietly downgrade; delegate to the assigned model". On a capped repo, a `**Model: <Deep>**` pass-off would send the agent to delegate to a model the allowlist refuses.

The capped repo's rendered `CLAUDE.md` gets one clause (design decision D3 gates whether this is written at all). The passoff skill template must never assign a tier above the repo's cap.

### F9: House precedent to copy

Examples of prior art this repo has:
- `model-light` gate for conditional questions (`src/questions/you.ts:236-245`)
- `settingsMerge` in `src/render/hooks.ts` for merging JSON into a settings file the person already has (**merge, never overwrite**; `tests/hooks.test.ts` pins that re-merging adds nothing)
- `templates/hooks/session-banner.sh` for reading `.personal-config.json` with `sed`
- One file per rule under `src/doctor/rules/`, each with a failing and a passing fixture test
- `docs/incomplete/<name>/DESIGN.md` with numbered D-decisions (rows 68 and 69 ratified against)

---

## Decisions (D-items)

### D1: Model IDs live in `PERSONAL_ANSWERS`

*Zach's call, 2026-09-25.*

Asked once per person. Reused across all capped repos. Consequence: a repo configured with a ceiling for the first time will report `stamp-drift` (the new ID key is part of the hash). This is acceptable.

**Rationale:** simpler UX than asking per-repo, and the drift is a one-time event. Alternative rejected: per-repo (no drift, but re-ask in every capped repo) or out-of-hash (no drift, no tracking).

### D2: Ceiling filters per-repo documents only

*Zach's call, 2026-09-25.*

The ceiling's `CLAUDE.md` clause and the tier-table filter (if any) are per-repo. The global `model-routing.md` stays shared, because it is shared by every repo and a capped row there contradicts uncapped repos.

**Rationale:** per-repo only is the likely answer from the design itself — a capped repo's clause tells the cap, an uncapped repo sees the full table. Alternative rejected: also filter global (breaks uncapped repos).

### D3: The ceiling's CLAUDE.md clause is written only when `modelRouting` is `delegate-or-stop`

*Zach's call, 2026-09-25.*

With no routing rule, there is no deadlock to break, so the clause has no job. The clause is a mitigation; repos with no routing rule do not need it.

**Rationale:** simpler rendered output. Alternative rejected: always write it for consistency.

### D4: The ceiling question goes in the `discover` phase

And the ID questions go in `you` (the first phase), gated on a capped repo, so they are answered early and can be reused.

**Rationale:** discoveries belong in discover; personal answers belong in you (precedent: `model-routing`).

### D5: The passoff skill template never assigns a tier above the repo's cap

Checked at generation time. If a repo picks a ceiling of Default and the passoff template tries to assign a Deep model, the rendered `passoff.md` skill says so.

**Rationale:** silent failures are dangerous; this is an error, not a degradation.

---

## Steps (unchanged)

1. ✅ Write this file and ratify (**done**)
2. Questions: ceiling in discover, ID questions in you, long form for ceiling
3. Renderer: new ceiling.ts, merge availableModels, ignore locally, CLAUDE.md clause, passoff skill update
4. Check trap at setup time: if global settings override the cap, say so in preview
5. doctor rule: flag board Model/passoff headers above ceiling, flag global availableModels re-admitting capped tier
6. Banner: one line in session-banner.sh
7. Profile, README, CHANGELOG
8. (Separate) Set real caps on Zach's repos

---
