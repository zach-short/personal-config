# DESIGN — a per-repo tier ceiling

**Status:** `SCOPING`. Written 2026-09-25 by board item 72, step 1. **Nothing here is ratified
except D6**, and no code has been written. Build starts after GATE 1 (§6).

**What this is.** A way for a person to say, per repo, "the most expensive model tier allowed
here is X", and have Claude Code refuse anything above it. It is not a request to the agent. The
motivating case was one toy repo that must never run Deep and one serious repo that must keep
it. The feature is for everyone who runs repos of very different worth.

## 1. What exists, verified 2026-09-25

Facts 1–9 of board item 72 were re-checked, not carried forward (R3). Three changed or grew;
they are marked **∆**.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| F1 | `availableModels` is the enforcement point, and it is honored outside managed settings | Honored in user, project and local settings. When set, it applies to `/model`, `--model`, `ANTHROPIC_MODEL`, the `model` setting, the Agent tool's `model` parameter, subagent frontmatter, `CLAUDE_CODE_SUBAGENT_MODEL`, skill and command frontmatter, the advisor model and the background-agent picker | Context7 `/websites/code_claude`, `model-config` › "Restrict model selection", queried 2026-09-25 |
| F1a **∆** | **By itself, it does not cover the picker's Default option or session startup** | "On its own, `availableModels` leaves the Default option on the system's runtime default for the account until you also set `enforceAvailableModels`." That key remaps Default, startup and the fallback to the first allowed entry. **Every mention of it in the docs is in managed settings.** Whether project or local settings honor it is not stated | same page, › "Default model behavior", › "Enforce the allowlist for the Default model"; `settings-example` shows it only in `managed-settings.json`. Queried 2026-09-25 |
| F1b **∆** | The live probe that would settle F1 and F1a has not run | `claude -p … --model sonnet` in a scratch repo whose `.claude/settings.local.json` allows only `haiku` returned `Failed to authenticate: OAuth session expired` for all three calls. Claude Code `2.1.281` | run 2026-09-25 in this session's scratchpad (`cap-probe/`) |
| F2 | The lists add together across non-managed files | "lists from user, project, and local settings are concatenated and deduplicated like other array settings." A managed list replaces them outright. So a global `~/.claude/settings.json` that lists the Deep model re-admits it in every capped repo. **This is the silent failure** | `model-config` › "Merge behavior"; `settings` › "Lists merge instead of overriding". Queried 2026-09-25 |
| F3 | Entries match loosely | A family name (`sonnet`) matches every version. A version prefix (`claude-fable-5`) matches 5 and 5.1. An entry that names a specific model in a family turns off that family's wildcard: `["sonnet", "claude-sonnet-4-5"]` allows only 4.5. `availableModels: []` never engages Default enforcement | `model-config` › "Restrict model selection", › "Merge behavior". Queried 2026-09-25 |
| F4 | `CLAUDE.local.md` and `.claude/settings.local.json` are loaded as the "local" source | Both load under `settingSources: "local"`. Claude Code does not git-ignore them for us, because our tool writes them, not Claude Code | `agent-sdk/claude-code-features` › "CLAUDE.md load locations", queried 2026-09-25 |
| F5 | Our ignore list is owned by one function | `renderIgnore()` writes `/.personal-config.json` (and `PART0-PROMPT.md`) to `.gitignore` in tracked mode. In untracked mode it adds the ledger, the board, `CLAUDE.local.md` and `AGENT-PRACTICES.local.md` to `.git/info/exclude` | [src/render/repo.ts:384-416](../../../src/render/repo.ts) |
| F6 | `.personal-config.json` is private in every git mode | It is in `personal` for both modes. A ceiling saved there is not published | [src/render/repo.ts:391](../../../src/render/repo.ts) |
| F7 **∆** | **A tracked repo's `CLAUDE.md` is committed**, so a clause written there publishes the cap | `renderRouter` picks `CLAUDE.md` unless `trackMode === 'untracked'`. `CLAUDE.md` is never in the ignore list | [src/render/repo.ts:52-64](../../../src/render/repo.ts), [:391-398](../../../src/render/repo.ts) |
| F8 **∆** | **The passoff skill is global**, one copy for every repo | Rendered to `claudeSkillsDir()/passoff/SKILL.md` from `templates/skills/passoff.md` | [src/render/skills.ts:47-50](../../../src/render/skills.ts) |
| F9 | The conditional-question precedent | `model-light-enabled` (a `select`) gates `model-light` (a `text`) with `when: { all: [...] }` | [src/questions/you.ts:200-245](../../../src/questions/you.ts). Item 72 cited `:236-245`, which is only the second half |
| F10 | No new `QuestionKind` is needed | `'select' \| 'multiselect' \| 'text' \| 'confirm'` | [src/lib/types.ts:19](../../../src/lib/types.ts) |
| F11 | Per-repo questions have a home and a precedent | `discover` asks `proof-line` and `off-limits` per target; `targetAnswers` lays them back over the shared answers | [src/questions/discover.ts:99](../../../src/questions/discover.ts), [:123](../../../src/questions/discover.ts); [src/doctor/rerender.ts:114-115](../../../src/doctor/rerender.ts) |
| F12 **∆** | **Item 72's fact 7 is superseded.** A new saved key no longer produces `stamp-drift` findings | Stamp-provenance D2 (built `01e05d7`, 2026-09-23) replaced hash comparison with a re-render at the file's own stamp. **Probe:** a real `setup --profile starter` into a scratch `HOME`, then two invented personal keys (`modelIds.default`, `modelIds.fast`) in the saved config and one per-repo key (`tierCeiling`) in `.personal-config.json`. `doctor` reported **no findings** each time. The hash did move: a fresh dry run then planned **12 of 14 files to write**, where the baseline had 0 | [src/doctor/rerender.ts:14-47](../../../src/doctor/rerender.ts); [docs/incomplete/stamp-provenance/DESIGN.md](../stamp-provenance/DESIGN.md) G12, D2. Probe run 2026-09-25 in the scratchpad (`probe/`) |
| F13 | Drift compares only `.md` files | `isCompared` keeps paths ending `.md`, minus `PART0-PROMPT.md`. A `settings.local.json` can never report drift | [src/doctor/rerender.ts:89-91](../../../src/doctor/rerender.ts) |
| F14 | Model *names* are not hashed as answers | `models.*` are in `UNHASHED_ANSWERS`, because they hash as `config.models` | [src/lib/config.ts:93-99](../../../src/lib/config.ts) |
| F15 | The settings-merge precedent | `settingsMerge()` merges into `~/.claude/settings.json`, never overwrites | [src/render/hooks.ts:158](../../../src/render/hooks.ts) |
| F16 | The banner reads `.personal-config.json` with `sed` | one `sed -n 's/.*"key"…/\1/p'` per field | [templates/hooks/session-banner.sh:9-11](../../../templates/hooks/session-banner.sh) |
| F17 | The routing rule forbids downgrades | "never quietly downgrade an assignment" | [src/render/rules.ts:140](../../../src/render/rules.ts) |
| F18 | Nothing like this exists yet | No hit for `ceiling`, `availableModels` or `tierCeiling` in `src/`, `templates/` or `docs/choices/` that concerns models. The only `ceiling` hits are function length and the stop-hook cap | `grep -rni 'ceiling\|availableModels\|tierCeiling' src templates docs/choices`, 2026-09-25 |

## 2. What this is not

Carried from item 72's negative list, unchanged.

- **No floor** ("never below X"). An allowlist can only forbid; nothing can make a model required.
- **No edit to the person's global `~/.claude/settings.json`.** We warn only (D9).
- **No managed or org settings.** A managed list replaces ours outright (F2) and is out of reach.
- **No hook that inspects the running model.**
- **No guessing an ID from a display name** ("Opus 5.5" → `opus`). A wrong guess quietly blocks
  the wrong model on someone else's setup.
- **No caps set on the owner's real repos in this item.** That is a separate `setup` run, which
  the owner runs or explicitly asks for.
- **No version cut.** That gets its own board row.
- **No change to `standard/AGENT-PRACTICES.boilerplate.md`.** Its Part 4 tables are the shipped
  standard, and this is a per-person, per-repo rendering choice.

## 3. Decisions

Each decision is marked with its standing. *Zach's call* means Zach chose it. *Recommended, not
ratified* means Zach raised no objection in chat on 2026-09-24/25, which is not the same as
choosing it.

### D1 — Enforce with `availableModels`, not a prompt or a hook

*Recommended in chat, not yet ratified.*

**Decision.** The ceiling is enforced by writing `availableModels` into a settings file Claude
Code reads (F1). The written rule (D7) is guidance on top, not the enforcement.

**Defense.** A rule in `CLAUDE.md` cannot stop the person's own `/model` picker. A hook is not
clearly told which model is running. The allowlist covers every entry point that matters here,
including the subagent path the routing rule itself uses (F1).

**Strongest argument against.** It is not airtight. The picker's Default option and session
startup stay on the account default unless `enforceAvailableModels` is also set, and the docs
describe that key only for managed settings (F1a). It re-opens silently when a global list
names the capped model (F2). **"Enforced" overstates it until Q1 is answered.**

### D2 — The ceiling has three levels, and Deep is the default

*Recommended in chat, not yet ratified.*

**Decision.** The answer is one of `deep` (no ceiling), `default` or `mechanical`. `deep` is
recommended and is the behavior as of 2026-09-25, exactly. It writes nothing (D5).

**Defense.** A tier is the unit every board row and pass-off header already speaks in, so a
ceiling in tiers can be checked against those headers (D10). Light is never a ceiling: nobody
has asked to cap a repo at the narrowest tier, and a repo capped there could not run the
Mechanical work every close-out does.

**Strongest argument against.** A tier is a name the person gave a model, and one model can
fill two tiers. Then the ceiling and the allowlist can disagree (H2).

### D3 — Write the allowlist to `.claude/settings.local.json`, and git-ignore it

*Recommended in chat, not yet ratified.*

**Decision.** `availableModels` is merged into the repo's `.claude/settings.local.json`, never
the tracked `.claude/settings.json`. `renderIgnore()` adds `/.claude/settings.local.json` to the
ignore list in **both** git modes, whenever this run plans that file.

**Defense.** The cap is the person's budget, not a property of the code. A stranger who clones
the repo should not inherit it. `renderIgnore()` is already the one place that decides what is
private (F5), and the precedent there is to list only files this run plans.

**Strongest argument against.** In a tracked repo, this adds a line to a `.gitignore` the person
commits. That is a small, visible edit made for a private reason. The alternative,
`.git/info/exclude`, is what untracked mode already uses and would leave no trace. Q6 asks.

### D4 — Merge, never overwrite

*House precedent (F15); not in dispute.*

**Decision.** The renderer reads any existing `settings.local.json` and sets only
`availableModels` (plus `enforceAvailableModels` if Q1 says so). Every other key is kept.
Re-running it adds nothing, and a test pins that, the way `tests/hooks.test.ts` pins
`settingsMerge`.

### D5 — A Deep ceiling writes nothing

*Recommended in chat, not yet ratified.*

**Decision.** With `deep`, the renderer returns no file and no ignore line. The starter
profile's dry run must show no `settings.local.json`. That is item 72's own hand-back check.

**Open edge, for the build to settle as a BD-item:** a repo lowered to a cap and then raised
back to Deep keeps a stale `availableModels` in `settings.local.json`. The recommendation is to
remove only our key on that run and leave the file otherwise alone. That is a planned edit, so
it goes through `planned()` and shows in the preview.

### D6 — Model IDs come from a picker, asked only below Deep

***Zach's call, 2026-09-24/25.***

**Decision.** IDs are asked only when a repo picks a ceiling below Deep. One is asked for each
tier that stays allowed: for `default`, that is Default, Mechanical and Light if enabled. For
`mechanical`, it is Mechanical and Light if enabled. The Deep model's ID is never asked, because
leaving it out of the list is what blocks it.

Each question is a `select`, in this order:

1. Family names first, recommended, because they survive new releases: `opus`, `sonnet`,
   `haiku`.
2. Exact versions next: `claude-opus-5-5`, `claude-sonnet-5`, `claude-haiku-4-5`.
3. "Other — type it" last.

"Other" opens a `text` question gated with `when`, exactly like `model-light` (F9). No new
`QuestionKind` is needed (F10). The popular list lives in one data file,
`src/questions/model-ids.ts`, because it goes stale several times a year.

**Hazard this walks into:** H1. Q5 asks whether it changes anything.

### D7 — The cap outranks a task's assignment, in writing

*Recommended in chat, not yet ratified. Where it is written is Q3; whether it is always written
is Q4.*

**Decision.** A capped repo's instructions get one clause:

> This repo is capped at the **<tier>** tier. The owner's cap outranks a task's assignment: a
> task assigned above the cap runs at the cap, and says so in one line.

**Defense.** Without it, the routing rule's "delegate to the assigned model" (F17) sends the
agent to a model the allowlist refuses. The two rules deadlock, and a session loops on a refused
Agent call.

**Strongest argument against.** It licenses exactly the downgrade the routing rule exists to
prevent. On a capped repo, a silent-failure task gets the cheaper model. The rule accepts that
because the owner set the cap knowingly. It must say so plainly: `docs/choices/tier-ceiling.md`
will.

### D8 — The ceiling is per-repo; the IDs are per-person

*Recommended in chat, not yet ratified. The IDs' hashing is Q2.*

**Decision.**

- `tierCeiling` is a `discover` question, beside `proof-line` (F11). It is saved in the repo's
  `.personal-config.json`, which is already private (F6). It is hashed, because it moves bytes
  in the repo's instructions (D7). That is the G17 class in stamp-provenance, and it is correct
  there.
- The IDs (`modelIds.default`, `modelIds.fast`, `modelIds.light`) join `PERSONAL_ANSWERS`, so
  they are asked once and reused.

**Defense.** A model's ID is a fact about the person's account, not the repo, and asking it
again in every capped repo is friction with no information in it. **The reason item 72 gave for
doubting this is gone** (F12): a new personal key does not produce drift findings after
stamp-provenance D2.

**Strongest argument against.** A personal ID that goes stale, for example a family retired
from the account, breaks every capped repo at once, silently: a refused model looks like an
auth or availability error.

### D9 — The global-list trap is warned at setup, never fixed

*Recommended in chat, not yet ratified.*

**Decision.** When the person's `~/.claude/settings.json` carries an `availableModels` entry that
matches a model above this repo's cap, the preview says so, names the entry, and says the cap
does nothing while it is there (F2). The global file is not edited.

**Limit, stated plainly:** "matches a model above the cap" is judged only against the IDs we
know, which are the ones below the cap (D6). An unknown entry, one that matches none of the
allowed IDs, is reported as "may re-admit a capped tier". It is not called a proven breach, and
no Deep ID is guessed (§2).

### D10 — `doctor` rule `tier-ceiling`

*Recommended in chat, not yet ratified.*

**Decision.** One rule, in its own file, with a failing fixture and a passing one per half (X1):

- **(a)** A board `Model` cell, or a pass-off `**Model: X**` header, above the repo's ceiling.
- **(b)** A global `availableModels` that may re-admit a capped tier (D9's check, rerun).

**Scope note.** (b) reads the real `~/.claude/settings.json` through `src/lib/paths.ts`. Its
tests redirect `$HOME` (X2).

### D11 — Banner line

*Recommended in chat, not yet ratified.*

**Decision.** `session-banner.sh` prints `Tier ceiling: <tier>` when `.personal-config.json`
carries a ceiling below Deep. It uses the same `sed` form as its other fields (F16).

## 4. Rules that survive unchanged

- The global `~/.claude/rules/model-routing.md` tier table is not filtered by any repo's
  ceiling. That is the recommendation in Q7; if the answer is otherwise, this line is amended.
- `standard/AGENT-PRACTICES.boilerplate.md`: untouched.
- Every write still goes through `planned()` → `resolvePlan()` → `commitPlan()`.
- The model *names* (`models.*`) stay exactly as they were asked and hashed on 2026-09-25 (F14).
- An uncapped repo, and every repo configured before this ships, renders byte-identical output.

## 5. Hazards this walks into

- **H1 — a recommended family name can re-admit Deep.** D6 recommends `opus` for a Default
  tier. If the person's Deep model is also an Opus, that entry admits it, and nothing we write
  can tell: the Deep ID is never asked (D6), and guessing is out of scope (§2). A picked exact
  version turns the family wildcard off (F3), but only if the person picks one. This fails
  silently, and **it is the second silent failure in the item**, beside F2. Q5.
- **H2 — one model in two tiers.** If Deep and Default name the same model, a Default ceiling
  blocks nothing. The ceiling question should say so when `models.deep === models.default`.
  That is a string comparison of names already asked, not a guess.
- **H3 — the Default option (F1a).** Until Q1 is settled by a live probe, a cap is a cap on
  *named* selections only.
- **H4 — a stale ID looks like an outage.** A retired family refuses every model, and the
  message will not mention our file. The long form's undo section must name the file first.
- **H5 — the clipboard.** `setup` copies `PART0-PROMPT.md` to the clipboard, including from a
  test probe with a redirected `HOME`. It did this during F12's probe on 2026-09-25. It is not
  this item's bug, but any manual dry run in the hand-back should expect it.

## 6. GATE 1 — questions for Zach, in one batch

Each has a recommendation. Any answer may be "no", including to the whole feature.

1. **What does "enforced" have to mean? (F1a, H3)** Before building, run the probe from F1b by
   hand in a logged-in shell, plus one with `"enforceAvailableModels": true` in the same local
   file and the picker's Default selected. *Recommended:* build only after that probe. If local
   settings honor `enforceAvailableModels`, write it beside `availableModels`. If they do not,
   ship it anyway, say "named selections only" in the long form, and have the banner say it.
2. **Where do the IDs live? (item 72's Ask 1, reframed by F12.)** The six drift findings no
   longer happen. What a new personal key costs now is that the next `setup` rewrites every
   stamped file once, with only its hash changed (12 of 14 in the probe). *Recommended:*
   personal answers (D8), **and** listed in `UNHASHED_ANSWERS`. They change no stamped byte, the
   one file they shape carries no stamp (F13), and hashing them buys only that rewrite.
   *Against:* a hash that does not cover an input breaks "save what is hashed" in reverse; it
   is the same trade F14 already makes for model names.
3. **Where does D7's clause go? (new, F7.)** In a tracked repo, `CLAUDE.md` is committed, so
   the clause would publish the cap that D3 keeps private. It would also tell a stranger's
   session to obey a cap that their allowlist does not enforce. *Recommended:*
   `CLAUDE.local.md` in every git mode, git-ignored the same way as D3. Claude Code loads it
   (F4).
4. **Write the clause when routing is not `delegate-or-stop`? (item 72's Ask 3.)**
   *Recommended: yes, always when capped.* The allowlist refuses an over-cap Agent call whatever
   the routing rule says, and the clause tells the agent why before it hits the refusal. The
   case against: with no routing rule, nothing deadlocks, and the clause is a line of context
   paid on every session for a rare event.
5. **H1: does the family-first order stand? (touches D6, which is yours.)** This is not
   reopening D6. It is new evidence against one part of it. Options:
   - **(a)** Keep the order, and add a hint on each `opus` / `sonnet` option: "matches every
     version, including your Deep model if it is in this family". *Recommended.*
   - **(b)** Keep the order, but ask once "Is your Deep model in the same family as this
     tier?" and recommend the exact version on yes.
   - **(c)** Leave it as is.
6. **Tracked repos: `.gitignore` or `.git/info/exclude` for the two local files? (D3.)**
   *Recommended: `.git/info/exclude`.* The files are personal in every mode, which is exactly
   what untracked mode already uses exclude for (F5). A committed ignore line would be a public
   trace of a private choice. The case against: it splits a tracked repo's ignores across two
   places, and `.personal-config.json` already sits in `.gitignore`.
7. **Filter the global tier table by the ceiling? (item 72's Ask 2.)** *Recommended: no.*
   `model-routing.md` is shared by every repo, so a capped row there is wrong for the uncapped
   ones.
8. **The passoff skill is global (F8).** "Never assign above the cap" cannot be rendered per
   repo. *Recommended:* one generic sentence in `templates/skills/passoff.md`: "If this repo's
   instructions name a tier ceiling, no item is assigned above it". D10(a) catches violations
   after the fact.
9. **Gate the ceiling question to the full setup? (new.)** A light setup asks only the Default
   model's name (`docs/choices/model-tiers.md`, "What it writes"), so a cap has no tier table
   to refer to. *Recommended: yes, gate on `configWeight === 'full'`,* the same gate as
   `model-deep`.

## 7. After ratification

Item 72's steps 2–8 stand as the build order, amended by the answers above. Record each answer
here with its date, the same turn it is given. Then this file is frozen and changes only by a
dated amendment.
