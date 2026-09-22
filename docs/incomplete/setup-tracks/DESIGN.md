# DESIGN — setup tracks: one wizard, several shapes of person

**Status:** `RATIFIED`. Opened 2026-09-17 as `SCOPE.md`; **GATE 1 completed 2026-09-17** and
renamed the same day. Owner: Zach. Spans two repos — `personal-config` (owns the questions and
the renderers) and `portfolio` (consumes `catalog.json` at `/setup`, pinned).

**Why this exists.** A non-technical friend wants the same working setup for non-code work —
accounting was the example — on a Claude **Pro** plan rather than Zach's. He will still use
Claude Code. Two things follow that the current wizard cannot express: the questions and the
generated documents assume a programmer with git repos, and the generated documents assume a
context budget that Pro does not have. Some of his material is in git; some is not.

**How to read this.** §1 is ground truth, dated and cited. §2 is the non-scope list. §3 is the
frozen decisions `D1…D14` — **from here this document changes by amendment only**: a new dated
`D<n>`, a dated supersession naming what it replaces, or an `As built:` note. Never by editing
a decision in place. §4 keeps the options as they were written *before* the decisions, because
the argument against each one is what stops it returning in three weeks as a new objection. §9 holds
the amendments of 2026-09-17; §10 those of 2026-09-22, which await ratification.

---
## 1. What exists, verified 2026-09-17

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | The wizard asks a fixed set of questions | **30 questions**, phased `you` 10 / `discover` 6 / `practices` 14. One (`commit-policy-practice`) is `when: { never: true }` and is derived, never asked | `catalog.json`; `tests/catalog.test.ts:35` asserts both the count and the phase split |
| G2 | Discovery only ever finds git repos | True. A candidate directory is dropped unless `isGitRepo` says yes — a plain folder is invisible to `setup` | `src/lib/discover.ts:48` |
| G3 | With no repo selected, the run still produces something | It produces **only** the global layer: `~/.claude/rules/{commits,model-routing,docs-lookup}.md`, four skills, two hooks, `settings.json` merge. No standard, no ledger, no board, no router | `src/commands/setup.ts` (`repos.length === 0` → "global rules only"); `src/render/standard.ts:25` and `src/render/repo.ts:24` both return nothing without a repo |
| G4 | Two of the three global rules are code-specific | `commits.md` is entirely git; `docs-lookup.md` is entirely library APIs. Only `model-routing.md` is domain-neutral | `src/render/rules.ts` |
| G5 | All four installed skills assume gates and commits | `grep -rln "gate\|commit\|repo" templates/skills/` matches all four: `scope`, `close-out`, `passoff`, `handoff` | grep, 2026-09-17 |
| G6 | The standard already supports cutting a whole Part at render time | `solo` mode cuts Part 12 by string surgery between two headings. The same mechanism rewrites Part 11 from the policy answers | `src/render/standard.ts:86-87`, `replacePartEleven` |
| G7 | How much of the standard is actually code-specific | Read in full 2026-09-17. **Part 6** (parallel sessions, worktrees, the commit rules) and **§8.1** (the per-language code standard) are code-only. **Part 0** is code-shaped (gates, CI, migrations). Parts 1–5, 7, 8.2–8.4, 9, 10, 12 are domain-neutral as written; Part 11 is half and half | `standard/AGENT-PRACTICES.boilerplate.md`, 1,116 lines |
| G8 | What the standard costs to adopt | Its own Part 0 says adaptation costs **40–80k of context** and warns against doing feature work in the same session | `standard/AGENT-PRACTICES.boilerplate.md`, Part 0 preamble |
| G9 | A question's condition can express exactly one key/value equality | `WhenSpec` is `{ never: true } \| { key, is } \| { key, isNot }`. **There is no conjunction, disjunction or set-membership form.** It is data, not a closure, because `catalog.json` must carry it to a browser | `src/lib/types.ts:26`; `src/lib/when.ts` |
| G10 | A derived answer can already drive a `when` | `owned` is never asked. `planRepo` computes it from the git remote and injects it into the per-repo answers, and `track-mode`'s `when: { key: 'owned', isNot: false }` reads it | `src/commands/setup.ts:175`, `:185` |
| G11 | The browser runs the same condition rule | `matchesWhen` is ported line-for-line into the portfolio so the site cannot ask a question the terminal would skip. The browser has no repos, so `owned` is `undefined` there and `isNot` passes | `portfolio/src/lib/catalog.ts` |
| G12 | The site consumes a pinned, generated artifact | `portfolio/package.json` pins `personal-config` at an **exact registry version**, `0.2.3` as of 2026-09-17. A question change reaches the browser only via publish → bump → deploy | `portfolio/package.json`; `portfolio/docs/incomplete/astro-rebuild/DESIGN.md` D6 |
| G13 | The pin is behind, and the gap is unpublished | `npm view personal-config versions` → `["0.2.0","0.2.1","0.2.2","0.2.3"]`, `latest` `0.2.3`. `package.json` here says **`0.2.5`**. `0.2.4` and `0.2.5` are committed but never pushed or published | npm, 2026-09-17; `HANDOFF.md` steps 41, 42, 43 |
| G14 | A version bump is already an open board item | Row 36, `Cut 0.2.6`, `OPEN`, owns `package.json`, `CHANGELOG.md`, `catalog.json`, `README.md` | `PASSOFF.md:46` |
| G15 | Two open board rows own the file this work must change | Rows 35 and 37 both own `src/commands/setup.ts` — the phase ordering and the confirm gate | `PASSOFF.md:45`, `:47` |
| G16 | The site's phase copy is keyed by phase id, unchecked | `PHASE_COPY[question.phase]` then `phase.eyebrow`. `catalog.json` is cast, not validated, so **a new phase id is a runtime `undefined` read, not a type error** | `portfolio/src/components/survey/question-card.tsx:22,27` |
| G17 | The phase labels hardcode "of 3" | `PART 1 OF 3` / `PART 2 OF 3` / `PART 3 OF 3`. The per-question counter is derived from `askedQuestions()` and adapts; the phase labels do not | `portfolio/src/lib/setup-copy.ts` `PHASE_COPY` |
| G18 | The page's own copy assumes a repo and a count | Title *"Set up your repo"*, heading *"Let's set up your repo"*, and **"Thirty"/"thirty" in three visitor-facing strings** | `portfolio/src/lib/setup-copy.ts:26,32,36` |
| G19 | Every question owes a long form, tested | `docs/choices/<readMore>.md` must exist, exceed 400 characters, and contain the word `undo`. A question with 3+ options must carry `recommended` **first** | `tests/cli.test.ts:83,91,98` |
| G20 | The catalog has a freshness ratchet | The committed `catalog.json` must be byte-identical to a fresh build, and the version stamp moves when any question does | `tests/catalog.test.ts:12-27` |
| G21 | Nothing in either repo has considered a non-programmer before | `grep -rniE "non-programm\|non-coder\|not a programmer\|persona\|non-technical"` over `*.md`, `*.ts`, `*.json` in `personal-config` (excluding `node_modules`, `.git`, `dist`) returns **no relevant hit** — only the substring `personal` in `personal-config` itself. There is no settled decision to supersede | grep, 2026-09-17 (R4) |
| G22 | The boilerplate is frozen by policy, not by a test | `CLAUDE.md` forbids editing its content; the portfolio's non-scope list forbids it too. `grep -rn "byte-for-byte\|boilerplate" tests/` returns **only** an unrelated doctor fixture — **no test enforces it** | grep, 2026-09-17; `CLAUDE.md` "Never do this"; `portfolio/docs/incomplete/astro-rebuild/DESIGN.md` §2 |

---

## 2. What this is, and what it is not

**What this is.** Making the wizard able to produce more than one shape of setup: a lighter one,
and a non-code one, chosen by the person answering rather than by editing the output afterwards.
It touches the question catalog, the renderers, the discovery step, and the `/setup` page's copy.

**What it is not** — these stay out until a dated supersession says otherwise:

- **Not an edit to `standard/AGENT-PRACTICES.boilerplate.md`.** It is frozen by policy in both
  repos (G22). Anything the non-code track needs is a *new* document, or a render-time cut of
  the existing one — never a change to its text.
- **Not a rewrite of the existing 30 questions.** A person who answers the way everyone answers
  as everyone answers it at `0.2.5` must get byte-identical output.
- **Not a second CLI, a second package, or a fork.** One wizard, one catalog, one `catalog.json`.
- **Not accounting features.** No domain logic, no templates for ledgers-of-money, no
  spreadsheet anything. The output is still documents that shape how an agent works.
- **Not a plan-detection mechanism.** Nothing inspects the person's Claude subscription. If plan
  matters it is a question, answered by the person.
- **Not a change to the three rungs on `/setup`**, the short-id profile store, or `--from`.
- **Not publishing, pushing or deploying.** Those are Zach's, and `0.2.4`/`0.2.5` are already
  waiting (G13).

---

## 3. Decisions — frozen

Each carries the decision stated flatly, **the defense** (why this and not the alternative,
which is what makes it survivable when the next agent finds it inconvenient), and its date.
`D1`–`D8` were given in chat on 2026-09-17 and recorded the same turn; `D9`–`D12` closed the
four questions §7 left open; `D13`–`D14` confirm the two that were carried provisionally.

**D1 — Two independent questions, not one combined setup name.** 2026-09-17.
"What kind of work" and "how heavy a setup" are asked separately, so any combination is
reachable — including the developer who wants the light config. *Defense:* a single
`setup-shape` enum would have to enumerate the product of the axes, and every new axis doubles
it; worse, it would make "developer, light" unreachable without inventing a name for it.

**D2 — Exactly two values per track question.** 2026-09-17. Binary, all three.
*Defense:* it is what keeps `WhenSpec` untouched for the simple cases (G9) and keeps
`catalog.json`'s shape stable across the npm pin (G12). A third value on any axis is a
supersession, not a tweak, because the browser evaluates the same spec.

**D3 — The non-code track gets a short standard of its own**, not the 1,116-line one with
parts cut. 2026-09-17. Written for non-code work and cheap to read every session.
*Defense:* G7 found Part 6 and §8.1 code-only and Part 0 code-shaped, but the remainder is
domain-neutral *as written for a programmer* — cutting to it leaves prose that still talks
about gates and diffs. A cut document reads like a document with holes; a short one reads like
a document. **Against, recorded:** two documents drift, and only one of them is battle-tested.

**D4 — Git is its own early question.** 2026-09-17. *"Will you use this config in git repos at
all?"* — and if not, the git questions are not asked. *Defense:* driven by the friend's real
situation: some of his material is in git and some is not, so work-kind cannot stand in for it.
*Consequence:* three binary axes, not two — work kind, config weight, git — and therefore eight
combinations, of which §3.1 below records which the renderers actually serve.

**D5 — O2a. Discovery accepts plain directories, tagged.** 2026-09-17. `RepoScan` grows
`kind: 'git' | 'folder'`; `scanProjectsDir` stops filtering on `isGitRepo` (G2). Renderers
decide per target. *Defense:* the only option that serves "some is on git, some isn't" as
stated (D4). **Carries two obligations named in O2a's argument against**, and neither is
optional: the confirm screen must stay readable when the scan is pointed somewhere broad, and
`trackMode` needs a real answer for a folder target rather than a silent skip — there is no
`.git/info/exclude` to write to.

**D6 — O4a. Light cuts the machinery that assumes budget.** 2026-09-17. One model instead of
three tiers; **no `model-routing.md`** — on Pro its advice to delegate to a subagent is actively
expensive; no hooks; two skills instead of four (DIAL-6); the short standard; a shorter router.
*Defense:* O4b's "same questions, shorter output" misreads where the burden is — thirty screens
about exports, imports and design tokens is the friction for a non-technical person, not the
file sizes. **Against, recorded:** this is the most conditionals of any option, and every one is
a branch that can drift from what its long form promises.

**D7 — A proof line per target replaces "gates green" in the short standard.** 2026-09-17. The
person writes what proves work is sound there — *"the reconciliation balances to the bank
statement"*, *"someone who didn't write it read it"* — and it renders where gates go, cited by
close-out. One more question; DIAL-8 governs its wording. *Defense:* the standard's own rule is
that a done-when which is only "gates pass" has no done-when; a track with no gates at all needs
the proof obligation stated explicitly or close-out has nothing to check against.

**D8 — This folder holds the design; the board holds the work.** 2026-09-17. `SCOPE.md` became
this file at ratification; execution is rows in this repo's `PASSOFF.md` plus one in the
portfolio's. *Defense:* Profile L is what this repo actually runs, and a `PLAN.md` here would be
a second, parallel record of the same work. **Consequence:** this design deliberately produces no `PLAN.md` and no GATE 2
plan document — the board rows *are* the plan, and §8 below is the phase order they encode.

**D9 — Light writes a ledger and no board.** 2026-09-17, closing §7 Q1. `HANDOFF.md` is
written for a light target; `PASSOFF.md` is not. *Defense:* D6/DIAL-6 already installs
`/handoff` and `/close-out` and cuts `/passoff`. `templates/skills/handoff.md` is a ledger
skill (7 ledger references); `templates/skills/passoff.md` is the board skill (5). A board with
no skill that knows how to work it, or a `/handoff` with no ledger to append to, are each
incoherent. `templates/skills/close-out.md` already branches on "Ledger profile" vs
"Project-folder profile", so it survives the cut untouched. **Against, recorded:** the board is
where parallel work is serialized, so a light user who later runs two sessions at once has no
collision rule; the answer is that they have moved off light, not that light should carry it.

**D10 — The short standard shares `standard/VERSION`.** 2026-09-17, closing §7 Q2 and
hazard 8. One standard, two renderings, one number. *Defense:* the stamp line has exactly one
`standard v…` slot (`src/lib/stamp.ts:26`), `src/commands/setup.ts:242` fills it once for every
file in a run, and `doctor` derives a single expectation for a whole scan
(`src/doctor/index.ts:94`). A second number has nowhere to live: nothing in a stamp records
*which* document a file was rendered against, so `stampDrift` could not tell a light file from
a full one and would report every light run as drifted. **Against, recorded:** a typo fix in the
1,116-line document bumps the short one's claimed version too. Accepted: `standard/CHANGELOG.md`
already versions "the standard" as a whole, and an entry there says which document moved.

**D11 — The friend arrives by the website.** 2026-09-17, closing §7 Q3. He opens `/setup`
himself and carries a short id to the terminal. **Consequences, both load-bearing:** the
portfolio copy (hazard 10, G18) is **phase one, not cleanup** — "Set up your repo" in the title,
heading and OG title turns him away in four words. And the publish chain (hazard 1) is on the
critical path: publish → bump → deploy must complete before the link is worth sending, on top of
`0.2.4`/`0.2.5` already waiting unpublished (G13).

**D12 — The questions and long forms are written generally; accounting is one worked
example.** 2026-09-17, closing §7 Q4. The question text says non-code work; the long forms name
writing, research, teaching, ops and accounting as cases. *Defense:* S1 (hazard 7) already
confines the friend's situation to `docs/choices/*.md` as a labelled worked example, so
generality costs nothing in the question text — and the class runs this same catalog, where
bookkeeping vocabulary would read as wrong to everyone who is not him.

**D13 — O1a confirmed: the three new questions are the first three of the existing `you`
phase.** 2026-09-17, confirming the provisional taken the same day. No new `Phase` value, no
change to `questionsFor`, and the site picks the order up from `catalog.json` for free.
*Defense, and it is stronger than the provisional recorded:* O1a's stated cost was that `you`
stops meaning "what is true of you across every repo" — but **work kind and git use are exactly
that**, facts about the person that hold across every target, and config weight is that person's
standing preference. The muddle is smaller than the scope credited it. Against that, O1b's new
phase id is a runtime `undefined` read on the site (G16) and breaks `PART n OF 3` (G17) — real
crashes, in the other repo, behind a pin. **Note:** D11 puts the portfolio in the build anyway,
which weakens O1b's objection but does not reverse this; a question that moves phase later is a
one-line catalog change, a phase id that ships is forever.

**D14 — O3a confirmed: `WhenSpec` grows an `all:` form.** 2026-09-17, confirming the
provisional. Roughly ten lines in `src/lib/when.ts` and ten in the portfolio's port.
*Defense:* the conjunction bites immediately rather than eventually — `track-mode` needs
`owned && usesGit` (G10, D4), and every code-specific practice question needs
`track === 'code'` alongside whatever it already asks. O3b's derived key cannot be computed in
the browser, which downgrades "terminal and browser ask the same set" from guaranteed to
guaranteed-except-these-keys — the exact invariant `matchesWhen` exists to hold (G11).
**Against, recorded and binding on the phase order:** it is a lockstep change across an npm pin.
The site must never evaluate a spec form it does not understand, so the order is **portfolio
learns `all:` → publish → bump → deploy**, and §8 encodes it.

### 3.1 Which of the eight combinations are served

D4 produced three binary axes. All eight combinations are *reachable* — D1 is the whole reason —
but they collapse to four shapes of output:

| Work kind | Weight | Git | What it renders |
|---|---|---|---|
| code | full | yes | **The output at `0.2.5`, byte-identical.** §2's first non-scope item. |
| code | full | no | The output at `0.2.5` minus the commit rules, `.git/info/exclude` and `trackMode`. |
| code | light | either | D6's cut: one model, no `model-routing.md`, no hooks, two skills, short standard, short router, ledger only (D9). |
| non-code | either | either | D3's short standard, D7's proof line, D6's cut whenever weight is light. A non-code target never gets `commits.md` or `docs-lookup.md` (G4). |

**Non-code + full** is not a fifth shape: it is the short standard with the ledger *and* the
board, which is the non-code row with D9's cut lifted. It is served, it is just not distinct
enough to plan separately.

### 3.2 Rules that survive unchanged

Listing what is *not* changing is how a build phase is stopped from helpfully rewriting it.

- **`standard/AGENT-PRACTICES.boilerplate.md` is not edited.** Frozen by policy in both repos
  (G22), and D3 makes a *new* document rather than cutting this one. Its version header line is
  the only thing in scope, and only when `standard/VERSION` moves.
- **The existing 30 questions keep their ids, their order relative to one another, their
  options and their wording.** Three are added ahead of them (D13); none is reworded.
- **`planned()` → `resolvePlan()` → `commitPlan()` stays the only write path.** A new renderer
  for the short standard returns `PlannedFile[]` like every other one and touches no disk.
- **`matchesWhen` stays a pure function over data.** D14 adds a form to the spec; it does not
  make the spec a closure, because `catalog.json` must still cross into a browser.
- **One CLI, one package, one `catalog.json`.** D1's axes are questions, not builds.
- **The three rungs on `/setup`, the short-id profile store and `--from` are untouched.**
- **Zero personal strings in `src/`, `templates/` or `standard/`.** The friend, accounting and
  Pro appear only in `docs/choices/*.md`, labelled (S1, hazard 7, D12).

---

## 4. Options, as written before the decisions

**This section is a record, not a menu.** It is kept verbatim from `SCOPE.md` because each
option's *argument against itself* is what stops that argument returning in three weeks as a
new objection. Where an option was taken, the label points at its decision in §3; the rest were
not taken and are not open.

### O1 — Where the three new questions sit in the flow

- **O1a — First three questions of the existing `you` phase.** **TAKEN — D13.** No new `Phase`
  value, no change to `questionsFor`, and the site picks up the order from `catalog.json` for
  free. **Against: `you` stops being "what is true of you across every repo"** and becomes "the
  shape of this run plus what is true of you" — a real conceptual muddle in a file whose whole
  virtue is that phases mean something.
- **O1b — A new `setup` phase before `you`.** Semantically honest. **Against: a new phase id is
  a runtime crash on the site, not a type error** (G16) — `PHASE_COPY[question.phase].eyebrow`
  reads through `undefined`. It also breaks the `PART n OF 3` labels (G17). Both are fixable,
  but they are fixable *in the other repo, behind the pin*, which means a publish sits between
  the fix and the bug.

### O2 — What discovery does when the work is not a git repo

- **O2a — Discovery returns plain directories too, tagged.** **TAKEN — D5.** `RepoScan` grows a
  `kind: 'git' | 'folder'`; `scanProjectsDir` stops filtering on `isGitRepo` (G2) and instead
  records which each one is. The renderers then decide per target — git targets get the commit
  rules and `.git/info/exclude`, folder targets do not. This is the only option that serves
  "some is on git, some isn't" as stated (A4). **Against: it widens the blast radius of the
  scan** — `~/Documents` under this becomes "every folder is a candidate", and the confirm
  screen has to stay readable with fifty of them. `trackMode` also loses its meaning for a
  folder target (there is no `.git/info/exclude` to write to), so that question needs an answer
  for the non-git case rather than a silent skip.
- **O2b — Keep discovery git-only; the light track writes only the global layer.** Nothing in
  `discover.ts` changes. The non-code person gets `~/.claude/rules/` plus a short standard at a
  global path, and points Claude Code at it per session. **Against: it does not actually solve
  the friend's problem** — his accounting folder gets no router, no ledger, no board, which is
  most of the value. It is a genuine first slice, not a finished answer.
- **O2c — Ask for one explicit path instead of scanning.** *"Which folder?"* No scan at all when
  the track is non-code. Simplest to build and easiest to explain to a non-technical person.
  **Against: it is a different flow for the two tracks**, so the wizard now has two shapes of
  `discover` phase to keep true, and the site — which has no filesystem — has to render a text
  question where the terminal renders a multiselect.

### O3 — How the conjunction gets expressed

`track-mode` must be skipped when the repo is not owned **or** git is not in play. That is one
question needing two conditions, and `WhenSpec` has room for one (G9).

- **O3a — Add `{ all: [WhenSpec, ...] }` to `WhenSpec`.** **TAKEN — D14.** Roughly ten lines in
  `src/lib/when.ts`, ten in the portfolio's port, and a shape change to `catalog.json`.
  **Against: it is a lockstep change across an npm pin** — the site must never evaluate a spec
  form it does not understand, so the order is publish → bump → deploy, and a mistake means the
  browser asks a question the terminal would skip, which is the exact invariant `matchesWhen`
  exists to hold.
- **O3b — Derive a composite answer key in the runner**, the way `owned` already is (G10). Zero
  new machinery in the catalog. **Against: the browser cannot derive it** — it has no repos and
  no filesystem — so the site would over-ask, and the "browser and terminal ask the same set"
  property degrades from *guaranteed* to *guaranteed except for these keys*.
- **O3c — Move the guard out of `when` and into the renderer.** Always ask; ignore the answer
  where it cannot apply. **Against: asking a question whose answer is discarded** is the precise
  thing the comment at `src/commands/setup.ts:170-174` says the ownership guard exists to avoid.

### O4 — What "light" actually removes

This is the "how bloated" question, and it is the one with the least prior art in the repo.

- **O4a — Light cuts the machinery that assumes a big budget.** **TAKEN — D6.** One model
  instead of three tiers; **no `model-routing.md`**, because on Pro its advice — delegate to a
  subagent — is actively expensive; no hooks; two skills instead of four; the short standard;
  a shorter router. **Against: it is the most conditionals**, and every one is a branch that can
  drift from what the long form promises.
- **O4b — Light changes only the documents, not the question set.** Same 30-ish questions, shorter
  output. Much less code. **Against: the questions are most of the burden** for a non-technical
  person on Pro — thirty screens about exports, imports and design tokens before anything is
  written is the friction, not the file sizes.
- **O4c — Light is a profile, not a branch.** Ship `profiles/light.json` pre-answering the
  existing questions. **Against: a profile can only choose among answers that already exist** —
  it cannot remove a question, cannot suppress a renderer, and cannot produce a document that
  has no question behind it. It answers "multiple options" without answering either half of
  what was asked.

---

## 5. Dials

Every number and word the design leaves open, destined for a config key or a profile rather
than a constant hardcoded twice. DIAL-8 was unset at scope and is now settled in §7.1;
DIAL-9 through DIAL-11 are new, and each discharges an obligation a decision in §3 carries.

| Dial | What it sets | Value |
|---|---|---|
| DIAL-1 | Default value of the work-kind question | `code` — the behaviour at `0.2.5` is preserved for everyone who already ran the wizard |
| DIAL-2 | Default value of the weight question | `full` — same reason |
| DIAL-3 | Default value of the git question | `yes` — same reason |
| DIAL-4 | Model tiers in light mode | **1**, not 3. Two of the three questions disappear and `model-routing.md` is not written (D6) |
| DIAL-5 | Length ceiling for the short standard | **≤ 200 lines**, so a session pays roughly a tenth of G8's 40–80k |
| DIAL-6 | Skills installed in light mode | `/handoff` and `/close-out` only — the two that survive without gates or commits (D9 cites the evidence) |
| DIAL-7 | How a stored profile missing the new keys is read | As the behaviour at `0.2.5`: `code` / `full` / `yes`, explicitly, never by falling through to "first recommended option" |
| DIAL-8 | Wording of the four new questions and of `/setup`'s heading | **Set 2026-09-17 at the copy gate** — see §7.1 |
| DIAL-9 | Where the short standard lives | `standard/AGENT-PRACTICES.short.md`, sharing `standard/VERSION` (D10) |
| DIAL-10 | How many plain directories the confirm screen lists before it summarises | **12**, then `… and N more` — D5's first obligation, so a scan pointed at `~/Documents` stays readable |
| DIAL-11 | What `trackMode` answers for a `kind: 'folder'` target | **Not asked, and recorded as `n/a`** rather than skipped silently — D5's second obligation. There is no `.git/info/exclude`, so the question has no referent, and `n/a` is what the renderer reads |

---
## 6. Hazards this work walks into

1. **The publish chain is already three commits deep and unpublished.** `0.2.4` and `0.2.5` exist
   only locally (G13) and row 36 `Cut 0.2.6` is open (G14). A new question cannot reach the
   browser until a publish happens, and this work would be riding on top of a backlog rather
   than on top of `latest`.
2. **Board collisions.** Rows 35 and 37 own `src/commands/setup.ts` (G15); row 36 owns
   `catalog.json`, `package.json`, `README.md`, `CHANGELOG.md`. This work needs all of them.
   Per the board's own rule, two items naming the same file do not run at the same time.
3. **A new phase id crashes the site at runtime** (G16). Only relevant under O1b.
4. **Three hardcoded counts go red or go stale.** `tests/catalog.test.ts:35` asserts `30` and
   `{ you: 10, discover: 6, practices: 14 }` — it *should* go red, that is its job. The three
   visitor-facing "Thirty"/"thirty" strings (G18) will not go red; they will just be wrong.
5. **Old stored profiles.** Profiles already in Cloudflare KV carry no `track`, `weight` or
   `usesGit`. Without DIAL-7 they inherit whatever option is marked `recommended`, silently.
6. **Each new question owes a long form** over 400 characters containing the word `undo`, and
   `recommended` first if it has 3+ options (G19). Three questions, three new
   `docs/choices/*.md`, each needing the honest strongest-argument-against.
7. **S1 — no personal strings.** The friend, accounting, and Pro are a worked example. They
   belong in `docs/choices/*.md` labelled as one person's case, never in `src/` or `templates/`.
   A test greps for it.
8. **Two standards, one `VERSION`.** `standardVersion()` reads `standard/VERSION`
   (`src/render/standard.ts:9-12`). A second document under `standard/` either shares that
   version — so a change to one bumps the other's claim — or needs its own, which the stamp,
   `doctor`'s stamp-drift rule and `README` all assume, as of 2026-09-17, is singular.
9. **This folder changes what the wizard thinks this repo is.** `FOLDER_MARKERS` is
   `['docs/incomplete']` (`src/lib/discover.ts:31`), so creating this directory makes
   `impliedProfile` return `'folders'` for `personal-config` itself. Harmless, but this repo
   dogfoods its own scanner.
10. **The `/setup` page turns a non-programmer away in its first four words.** *"Set up your
    repo"* is the title, the heading and the OG title (G18). No question ordering fixes a
    heading.

---

## 7. Questions closed at GATE 1 — 2026-09-17

All four of §7's originals were answered in chat on 2026-09-17 and are recorded above as
decisions. Nothing in this section is open.

| Was | Answer | Recorded as |
|---|---|---|
| Does the light track still write a ledger and a board? | Ledger yes, board no | **D9** |
| Own version, or share `standard/VERSION`? | Share | **D10** |
| Website or terminal? | Website first | **D11** |
| Accounting-only, or general? | General, accounting as a worked example | **D12** |

### 7.1 DIAL-8 — the copy, settled at the same gate

R7 governs: the variants went out with their registers named, and the chosen wording is below.
**This is settled copy.** Re-opening it needs a dated supersession, not a better idea.

**The three `you` questions — warm register.** Chosen over plain (functional but no help to
someone who does not already know why the question is being asked) and terse (fastest, but the
first three screens are where a non-programmer decides whether this tool is for them).

| id | Line | Options, with their `hint` |
|---|---|---|
| `work-kind` | *Is this for code, or for other kinds of work?* | **Code** — repos, builds, pull requests · **Other work** — writing, research, teaching, accounting, ops |
| `config-weight` | *Do you want the whole method, or a lighter setup?* | **The whole method** — every document, every skill · **Lighter** — fewer files, less to read at the start of each session |
| `uses-git` | *Do you keep this work in git?* | **Yes, in git repos** — commits, branches, history · **No, just folders** — the files live on disk and that's it |

Ids are the wording's own, not the axis names this document uses; `configKey`s follow the
existing convention. DIAL-1/2/3 say the recommended option is the **first** of each pair, which
is also how the wizard behaves at `0.2.5`.

**The proof-line question (D7), asked once per target.**

> *What proves work here is sound?*
> → e.g. *"the reconciliation balances to the bank statement"*
> → e.g. *"someone who didn't write it read it"*

Chosen because it matches the standard's own vocabulary — Part 2.2 already says a done-when that
is only "gates pass" is not a done-when — over the two longer phrasings, which read warmer but
ask two tests in one sentence.

**`/setup`'s page copy (hazard 10, G18).** *"how you work"*, because it names what the tool
configures rather than where it writes, and is true of a repo and a folder without hedging.

| Slot | Was | Is |
|---|---|---|
| Title | Set up your repo | **Set up how you work** |
| Heading | Let's set up your repo | **Let's set up how you work** |
| OG title | Set up your repo | **Set up how you work — personal-config** |
| The three counts | "Thirty" / "thirty", hardcoded | **Derived** from `askedQuestions()`, so they can never go stale again — this is why the copy fix also closes hazard 4's second half |

---
## 8. Phase order — the board rows this design authorises

D8 puts execution on the board rather than in a `PLAN.md`. This section is the order those rows
encode and **why that order and no other**; the rows themselves carry the prompts.

**Two constraints fix almost all of it.** D14's lockstep: the site must never meet a `WhenSpec`
form it cannot evaluate, so the portfolio learns `all:` *before* a catalog carrying one reaches
it. And the board's own collision rule: rows 35 and 37 own `src/commands/setup.ts`, row 36 owns
`catalog.json`, `package.json`, `README.md` and `CHANGELOG.md` — every file this work needs
(hazard 2).

| # | Phase | Repo | Driver | Why that shape |
|---|---|---|---|---|
| P0 | Clear rows 35 and 37 | personal-config | Opus 5 | Not this work, but in front of it. Both own `src/commands/setup.ts`; row 37's own prompt already says to do 35 first so it does not build on code about to change. Landing a track restructure on top of two open bugs in the same file would strand both prompts, which cite live line numbers. |
| P1 | Cut `0.2.6` (row 36) | personal-config | Opus 5 | Already waits on 35 and 37. Taking it here rather than later clears the whole unpublished backlog — `0.2.4`, `0.2.5`, `0.2.6` (G13) — in one publish, so this work rides on `latest` instead of on three unreleased commits. |
| P2 | Portfolio: `all:` in the port, and the page copy | portfolio | Opus 5 | **Must precede any catalog change** (D14). Deployed, it understands a form nothing sends yet — inert and safe. Carries D11's copy fix (§7.1) and the derived counts in the same pass, because both touch `setup-copy.ts` and D11 puts the copy on the critical path. |
| P3 | `WhenSpec` grows `all:`; the four questions; the long forms | personal-config | Opus 5 | The catalog change proper. `src/lib/when.ts`, `src/questions/`, four new `docs/choices/*.md` (hazard 6), and the three hardcoded counts in `tests/catalog.test.ts:35` move to their new numbers — that red is the test doing its job (hazard 4). |
| P4 | Discovery accepts plain directories, tagged | personal-config | Opus 5 | D5. `src/lib/discover.ts`, `RepoScan.kind`, DIAL-10's confirm-screen ceiling and DIAL-11's `n/a` for `trackMode` — both obligations D5 carries, built here rather than deferred. |
| P5 | The short standard, and what light renders | personal-config | **Fable 5.1** | D3, D6, D9, D10. **Deep tier, and this is the one phase that earns it:** every branch here is a document that renders, passes every gate, and is quietly wrong for its reader — a light run that still writes `model-routing.md`, a non-code standard that still says "diff". That is exactly "a mistake compiles, passes every gate, and is wrong in production". |
| P6 | Cut `0.3.0` | personal-config | Opus 5 | Minor, not patch: new questions change `catalog.json`'s shape. Then **Zach publishes** — as with every release so far. |
| P7 | Portfolio: bump the pin, deploy | portfolio | Sonnet 5 | Mechanical by then — a version bump against a published package and a deploy. It cannot run until P6 is on npm, which is the one step this work cannot do for itself. |

**What is deliberately not a phase.** Rows 38, 39 and 40 are open and untouched by this: 38 owns
`src/lib/profile-source.ts` (no overlap), 39 and 40 are read-only reviews that own no files. They
can run beside any of this; they are simply not part of it.

**The seam reserved, deliberately not built.** `WhenSpec` gets `all:` and nothing else. `any:`
and `not:` are the obvious next two and neither has a caller — D14's lockstep cost is paid per
form that crosses the pin, so a form with no question behind it is a publish spent on nothing.

---

## 9. Amendments — 2026-09-17

The design froze at `D14`. These are added by amendment, which is the only way it changes.
**D16 partially supersedes D6** and says so explicitly; nothing else here reverses anything.

**D15 — What is actually documented about a model that will not do the work.** 2026-09-17.
Recorded as evidence, not as a decision, because two decisions below rest on it and a later
session will otherwise re-derive it.

The owner reported the complaint that opened this: on a Pro plan, the model *"is being lazy and
simply not doing the work"* — replying with a plan instead of doing it, writing placeholder code,
stopping partway to ask whether to continue, summarising a file instead of editing it. What the
documentation supports, separated from what it does not:

| Claim | Status | Source |
|---|---|---|
| "Laziness" is a named issue with a named setting | **No such name, and no such setting.** | — |
| A bloated `CLAUDE.md` dilutes its own instructions | **Documented.** *"Longer files consume more context and reduce adherence"*; target **under 200 lines** | `docs/en/memory.md`, `docs/en/best-practices.md` |
| "Stops when the work looks done" is a known failure | **Documented**, with the mechanism named: *"Without a check it can run, 'looks done' is the only signal available."* | `docs/en/best-practices.md` |
| Replying with a plan instead of acting | **Documented as a permission-mode artifact**, not a defect — `plan` mode blocks edits until approved | `docs/en/permission-modes.md` |
| A `Stop` hook can refuse to let a turn end | **Documented**, `type: command` / `prompt` / `agent`. **Hard cap: Claude Code overrides it after 8 consecutive blocks**; `stop_hook_active` avoids self-looping | `docs/en/hooks.md`, `docs/en/hooks-guide.md` |
| `outputStyle: "Proactive"` targets plan-instead-of-action | **Documented**, and works regardless of permission mode | `docs/en/output-styles.md` |
| A Pro usage limit causes quietly degraded output | **Not documented.** A usage limit is a **loud stop**, not a silent quality drop; the docs say a context/auto-compact warning *"is not a usage limit"* | `docs/en/costs.md`, `docs/en/errors.md` |
| Context filling degrades instruction-following | **Documented, and plan-independent** — tied to context size, not tier | `docs/en/best-practices.md` |
| `effortLevel: max` fixes incomplete work | **Not supported** — documented as a spend/capability tradeoff, *"prone to overthinking"* | `docs/en/model-config.md` |

**The gap this found is wider than the light track.** Verified 2026-09-17 by grep:
`src/render/hooks.ts` registers exactly two events — `PreToolUse` (the commit guard, `:47`) and
`SessionStart` (the banner, `:55`). `grep -rn "Stop" src/render/hooks.ts` returns nothing, and
neither does `grep -rn "outputStyle" src templates docs` — **no `Stop` hook and no output style
is written by any code path.** Both of the two best-documented levers against the reported
complaint are absent from everything this tool installs, on **every** track — not only the one
this design adds.

**D16 — Every track gets a completion gate, as a `command` Stop hook. This partially supersedes
D6.** 2026-09-17.

*What is superseded, precisely:* D6 said light writes **no hooks**. That half is replaced by:
light writes **no commit-guard hook** — it is git-specific and D4 already made git a question —
but light **does** write the completion gate. D6's remaining cuts (one model tier, no
`model-routing.md`, two skills, the short standard, the shorter router) are untouched and still
stand. The reason the cut is split rather than lifted: D6's cut was justified by *context
budget*, and a `command` hook is a shell script that spends **zero tokens** — so the argument
that carried D6 does not reach this hook.

*Why `command` and not `agent` or `prompt`:* both existing hooks are `type: "command"` shell
scripts under `templates/hooks/`, so this is the house pattern rather than a new mechanism. The
`agent` type is the strongest of the three and is Anthropic's own worked example, but it spends
tokens **on every stop** — which is precisely the budget the person this design exists for does
not have. **Against, recorded:** a grep-and-run-the-gates script cannot judge intent, only run
checks; it will not catch work that is shallow rather than visibly unfinished.

*Where it is built:* **board row 47**, not inside this design's rows — the gap it closes is not
specific to tracks, and folding it into row 44 would make a light-track item silently change what
a full-track run writes. Row 44 is told to expect it.

**D17 — Output style is a question, not a default.** 2026-09-17. A new question in the `you`
phase writes `outputStyle` into the generated `settings.json`.

*Defense:* this repo's settled shape is that the owner's defaults are **questions, not
constants** — and an output style changes how someone's agent behaves across every session, which
is exactly the class of thing this repo requires to carry a long form with an argument against
it. Writing it as a silent default would change behaviour for everyone who re-runs the wizard
with no question behind it and no `docs/choices/` entry, which the repo's own tests treat as a
smell. **Against, recorded:** it is a fifth new question on a flow this design is otherwise trying
to make shorter, and the honest mitigation is that it is in `you`, asked once, not per target.

*Consequence for the counts:* the catalog goes **30 → 35** — four new `you` questions (work kind,
config weight, git, output style) and one per-target question (the proof line, D7).
`tests/catalog.test.ts:35`'s phase split becomes `{ you: 14, discover: 7, practices: 14 }`;
**verify that arithmetic against the code rather than trusting this line**, since the proof
line's phase is item 42's call.

**D18 — D14's lockstep binds item 46, not item 42.** 2026-09-17. A clarification of scope, not a
reversal: the invariant D14 states is unchanged, and nothing about what the browser may evaluate
is loosened.

D14's ordering was written as *portfolio learns `all:` → publish → bump → deploy*, and the board
read that as "item 42 cannot start until the portfolio is deployed". That is stricter than the
invariant requires, and the extra strictness would park the whole build on a deploy that is the
owner's to run.

*The reasoning, stated so it can be checked rather than trusted:* the site reads its questions
from `catalog.json` inside an **exact** npm pin (G12) — `portfolio/package.json` names one
version, not a range — `grep -n '"personal-config"' portfolio/package.json` returns
`"personal-config": "0.2.3"`, verified 2026-09-17. A catalog containing an `all:` spec therefore
reaches the browser **only** through a deliberate pin bump, which is **item 46 and only item 46**. Item 46 already
carries a hard stop — *"if `matchesWhen` there still has no `all` branch, stop"*. Item 42
publishing an `all:` to npm therefore changes nothing the browser evaluates.

*What this changes:* item 42 waits on item 41's **code landing in the portfolio's working tree**,
which happened 2026-09-17, rather than on its deploy. **What it does not change:** item 46 still
may not run until the portfolio is deployed with `all:` support, and still must verify that for
itself rather than trusting this note.

**D19 — Two settled calls, 2026-09-17, recorded where §7.1 would have carried them.**

*The output-style ask line.* D17 arrived by amendment **after** the copy gate closed, so its
question text was never settled and item 42's builder wrote one in register and flagged it. R7
applies to it like any other visitor-facing copy, so it went back out with three registers.
Settled: **"How should your agent handle unclear decisions?"** — plainer and more neutral than the
builder's draft, describing the situation and letting the two options carry the contrast. The
options are unchanged: *Act — makes reasonable calls and keeps going* / *Check first — pauses on
anything unclear*, with **Check first** recommended, because it is what the wizard does at
`0.2.6` and because every other default here is tuned around an agent that asks.

*The release.* Item 36 cut `0.2.6`; item 42 then took the catalog to 35 questions, which a patch
version cannot claim. Settled: **fold `0.2.6` into `0.3.0`.** Item 36 is `SUPERSEDED` on the
board — the work stands, only its version number dies — and item 45 rewrites the heading rather
than opening a second section. Nothing named `0.2.6` is committed or published.

---
## 10. Amendments — 2026-09-22

**Status: proposed 2026-09-22 by board row 58; ratification pending.** Written by an unattended
session, so each decision below is complete — stated flatly, defended, with the argument against
it recorded — and carries a *Ratified:* line that is empty until Zach answers. His answers land
on those lines, dated, the same turn they are given; a "no" stays on that line as the board's
`SETTLED AS NO` does, so it is not proposed again. **Nothing here is built until it is
ratified**: the rows in §10.4 are `HELD` on this section. The precedent is step 60's strike-list
— asked in the hand-back with the document already written — and R6: one batch, one message.

Two of the audit's findings could not be built without amending a frozen decision first, and
this section is the amendment. It touches exactly two frozen things and says so where it does:
D2's "exactly two values" is **upheld** (D20), and §3.2's wording freeze is **partially
superseded** for four strings (D21). D25 partially supersedes D16. Everything else adds.

### 10.1 What was verified 2026-09-22

Read at `f2b04e0` plus items 54 and 55's uncommitted trees (`src/render/target-git.ts` new;
`src/render/hooks.ts` re-gating the guard); line numbers are that tree's. Continues §1's numbering.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G23 | Item 56's measure: the short track asks six questions it discards | **Reproduced before item 56 began, and it is eight.** Evaluating `matchesWhen` over `ALL_QUESTIONS` for the shapes of §3.1: code+full+git **33**, code+full+no-git **32**, code+light+git **33**, non-code+full+git **22**, non-code+light+no-git **21**. Beyond item 56's six, two more are asked on every short-track shape and rendered into no document there: `archive-home` and `mode` (G24). Item 56's build, in flight and uncommitted at 13:44, gates seven — its six plus `model-routing`, on weight alone — and neither of these two | a script over `src/lib/when.ts` and `src/questions/index.ts`, 2026-09-22, run twice |
| G24 | Where `archive-home` and `mode` render | `archiveHome` is read at `src/render/repo.ts:189` (`workRecordLines`, the `folders` branch), `:270` and `:284` (`renderFolders`, `renderArchiveIndex`), `:316` (saved into `.personal-config.json`) and `src/render/standard.ts:54` (the long standard). `workRecordShape` returns `ledger` on every short track (`src/render/context.ts:112`) and the short track never renders the long standard, so there the answer is **saved and rendered into no document**. `mode` is read at `src/render/repo.ts:401` and `:451` — both inside the Part 0 prompt, which `:385` returns `null` for on the short track — and `src/render/standard.ts:34`; `grep -n "mode" src/render/short-standard.ts` matches one comment, about Part 12. `tracker` is asked only when `mode` is `team` (`src/questions/discover.ts:128`) and read only at `standard.ts:55`, so it follows `mode` | `grep -rn "archiveHome" src/render/`; `grep -rn "'mode'" src/render/`, 2026-09-22 |
| G25 | What `PART 3 OF 3 · House rules` asks a non-coder | Two questions, `copy-registers` and `drive-by-fixes`; the test asserts exactly that pair | `tests/catalog.test.ts:114` |
| G26 | Every reader of `usesGit` — what a third value would have to survive | Eight sites, five of them reads in renderers. Two read the *person's* answer for the global layer and must keep doing so: `src/render/rules.ts:24` (`commits.md`) and `src/render/skills.ts:89`. One reads it per target through the target's kind: `src/render/target-git.ts:32`, item 54's helper, imported by `repo.ts`, `standard.ts` and `short-standard.ts`. One is the ignore file, `src/render/repo.ts:353`, and one is `trackOf` itself, `src/render/context.ts:81`, reading `!== 'no'`. The other three: the question, `src/questions/you.ts:69`; the stored-profile default, `src/lib/stored-profile-defaults.ts:23`; a `when` spec, `src/questions/discover.ts:68` | `grep -rn "usesGit" src/`, 2026-09-22 |
| G27 | How `yes` is read after item 54 | As **"git is in play somewhere; the target's kind decides where"** — `targetUsesGit` is `kind === 'git' && usesGit` — and `no` is honoured over the disk for a repo the person owns. `docs/choices/uses-git.md:40-70` says so as of item 54, with the earlier claim kept and marked wrong (R5) | `src/render/target-git.ts:13-16`, `:31-33`; `HANDOFF.md` step 64 |
| G28 | The one spec that tests `is: 'yes'` rather than `isNot: 'no'` | `track-mode`'s, `src/questions/discover.ts:68` — pinned verbatim by `tests/catalog.test.ts:76` and used as a fixture four times in `tests/when-all.test.ts`. Item 56's prompt already writes every *new* git condition as `isNot: 'no'` against the possibility of a third value, and items 54 and 55 read the answer the same way | `grep -rn "is: 'yes'" src/ tests/`, 2026-09-22 |
| G29 | The strings a non-coder reads that assume a repo or git | Four, all in questions the short track asks: `src/questions/discover.ts:12` *"the repos you want to set up"*; `discover.ts:21` *"in this repo"*; the two `uses-git` option labels, `you.ts:74` and `:80` — *"Yes, in git repos"* / *"No, just folders"* — which a person with both cannot answer truthfully; and the `hooks` first option, `you.ts:211` — *"Yes — block `git commit`, `git push` and `git add -A`"*, the recommended answer, shown to someone who has just said they keep no work in git (item 55's second question). `mode`'s second option, *"Several people merge code here"* (`discover.ts:114`), is a fifth, mooted if D26 stops asking it where a non-coder would see it | read 2026-09-22 |
| G30 | Where "projects" was settled as the word for a repo-or-folder | The portfolio, 2026-09-17, items 41 and 48: *"'your projects' replaces 'your repo(s)' everywhere a visitor reads it … true of a git repo and of a plain folder, needing no hedging or slash"*, with *"where your work lives"* and *"repos and folders"* considered and rejected. R7 says cite a settlement rather than re-ask | `~/Projects/portfolio/src/lib/setup-copy.ts`, header comment |
| G31 | What candidate 3 (what the agent shows when it states a number) would add | It is R2 of the short standard already — *"Every claim names its source. The file and line, the page, the row…"* — with its test. And the rule `copy-registers` renders as a paragraph is R7 in the short standard **and** R7 in the long one, so that duplication belongs to both tracks and is not this section's | `standard/AGENT-PRACTICES.short.md:31-33`, `:52-54`; `standard/AGENT-PRACTICES.boilerplate.md:176`, `:205` |
| G32 | Where a per-target line and a per-target fact land on the short track | `templates/CLAUDE.short.md:26` has a `## Never do this` section filled by `{{COMMIT_LINE}}` alone as of 2026-09-22; `templates/HANDOFF.short.md`'s "How things are here" table has the proof line as its first row and two empty rows the first session fills. The proof line is the precedent for a per-target answer: asked in `discover` into the per-target map, carried on `RepoPlan` (`src/lib/types.ts:130`), laid over the shared answers by `targetAnswers` (`src/render/context.ts:163`) so it is saved and hashed | read 2026-09-22 |
| G33 | What the harness itself guards | Claude Code's `Write` tool refuses to overwrite a file the session has not read, and `Edit` requires the same — stated in the tools' own descriptions as read in this session, 2026-09-22. **A lead, not a fact (R3):** row 59 verifies it against the harness before relying on it, because it is what makes a Bash-only delete guard sufficient rather than partial | the harness's tool descriptions |
| G34 | The commit guard's parser is the shape a delete guard copies | `templates/hooks/commit-guard.sh` parses the command out of the JSON with `jq`, walks its words, sees through wrappers (`env`, `sudo`, `sh -c`), git's own options (`-C`, `-c`) and chained commands, and fails *closed* without `jq`. `docs/choices/hooks.md` records what it catches and what it does not | `templates/hooks/commit-guard.sh:1-40`; `docs/choices/hooks.md`, "What the guard catches" |
| G35 | What light installs, and what item 55 changed | The completion gate only on light: `wantedHooks` returns `{ guard: false, banner: false, gate: true }` for `configWeight: 'light'` (`src/render/hooks.ts:67-68`), per D16, whose reason for leaving the commit guard out of light is that it is git-specific. Item 55's uncommitted change conditions the full-track guard on `trackOf(ctx).usesGit` (`:70`) and its comment says in terms that a no-git run's own guard is *"left open for row 58"* (`:55-58`) | `src/render/hooks.ts:35-74`, read 2026-09-22 |
| G36 | The portfolio needs no code change for anything in this section | The pin is `0.3.0` and exact; the port of `matchesWhen` has `all:` (item 41); the site branches on `phase` (three, unchanged) and on `kind` (`select` and `text`, both used here). A new question, option label or `when` of the existing forms reaches the browser through the pin alone (D18) | `~/Projects/portfolio/package.json:20`; `~/Projects/portfolio/src/lib/catalog.ts`, `matchesWhen` and `Question.kind` |
| G37 | Whether anything asks what an agent must not read | `grep -rn "read or copy\|off.limits\|must not read" src/ templates/` returns nothing | grep, 2026-09-22 (R4) |

### 10.2 Decisions

**D20 — D2 stands. `uses-git` keeps two values; a person with both answers "yes", and the labels
say so.** 2026-09-22. *Ratified:* —

The audit recommended a third value meaning "some of it". Item 54 removed the reason for it:
after `targetUsesGit` (G27), `yes` already means *git is in play somewhere and the target's kind
decides where*, and `no` means *nowhere, whatever the disk says*. A third value would therefore
behave identically to `yes` at every one of G26's eight sites — the two global-layer reads must
treat "some" as yes (the person has repos, so `commits.md` and the commit guard are theirs); the
per-target read already ignores the person's answer beyond `!== 'no'`; and every `when` that
gates a git question must admit "some", because the person has repos and needs them. A value
with no behaviour of its own is a label wearing a value's clothes.

*Defense.* D2's original argument was a publish per value that crosses the pin. That argument is
weaker than it was, because this section costs a publish regardless (§10.3) and a third value
would ride on it. The argument that does hold is the one item 56's prompt already names: with
three values, every `when` author must choose between `is: 'yes'` and `isNot: 'no'`, and the
wrong choice **silently stops asking the git questions of the people who most need them** — a
failure that compiles, passes every gate and is wrong in production. Two values have a clean
negation; three do not. The one existing `is: 'yes'` (G28) would have to change, with its pinned
test and four fixtures, on the day the third value shipped, and nothing would go red if one were
missed.

*What changes instead.* The two option labels and their hints, under R7 (§10.5): the "yes" label
says *some or all of it*, the "no" label says *none of it*, so a person with a repo and a loose
folder sees their answer. `docs/choices/uses-git.md`'s options section says the same in a
sentence; item 54 already corrected its "What it writes" section.

*Against, recorded.* A label that says "some or all" asks the person to apply a rule — *answer
yes if any of it is* — where a third value would let them describe themselves and leave the
reasoning to the tool. That is a real cost on the first three screens, which §7.1 says are where
a non-programmer decides whether the tool is for them. The answer is that after item 54 the tool
*does* reason, per target, from the disk; the label's job is only to point the person at "yes",
and a hint of one line does that. If a later reader finds people with both answering "no"
anyway, the third value is the fix, and this decision says what it costs: G28's spec, item 56's
`isNot: 'no'` discipline held to everywhere, and `trackOf`'s boolean either kept (making "some" a
synonym for yes) or made three-valued at G26's five render sites.

*Interaction with item 54's step 4.* Zach's call there — `no` honours the answer over a git repo
on disk — is what makes this decision's second sentence true, and D20 is compatible with either
call: had `no` deferred to the disk, "some" and "no" would have converged instead of "some" and
"yes", and the conclusion would be the same.

**D21 — §3.2's wording freeze is partially superseded: four strings change, for D11's reason.**
2026-09-22. *Ratified:* —

*What is superseded, precisely:* §3.2's second bullet, *"the existing 30 questions keep … their
wording"*, for four strings and no others — `projects-dir`'s ask, `work-profile`'s ask,
`uses-git`'s two option labels with their hints (D20), and the `hooks` first option's label with
its hint (D25). Ids, order, option *values* and every other string stay frozen; a stored profile
reads exactly as it did.

*Defense.* D11's reasoning for the page title applies unchanged: *"Set up your repo"* turned the
reader away in four words before a question, and *"the repos you want to set up"* is the first
question the terminal asks. The portfolio fixed its own copies of the same words on 2026-09-17
(G30) while `discover.ts:12` and `:21` kept theirs because §3.2 froze them. The freeze was doing
its job against a build phase; it is lifted here, by the amendment the freeze asks for, for the
strings a non-coder reads.

*The words.* "projects" for `projects-dir` and "this project" for `work-profile`, citing G30's
settlement rather than re-asking; the four `uses-git` and `hooks` strings go out with registers
under R7 (§10.5). `mode`'s *"merge code here"* (G29) is not reworded: D26 stops asking it where a
non-coder would see it.

*Against, recorded.* Every reworded string is a catalog change and so crosses the pin; and "this
project" is a hedge where "this repo" was precise for the code+full person who still answers
`work-profile` after item 56. Accepted: item 56 confines `work-profile` to code+full, whose
targets may still be a mix — item 54's whole case — so "project" is the honest word for them too.

**D22 — A non-coder is asked who makes changes to a document: the analogue of `commit-policy`,
as a policy area.** 2026-09-22. *Ratified:* —

The audit's first candidate, taken. `commit-policy` decides who takes the irreversible step in a
repo; item 56 confines it to code+git, correctly, and that leaves the non-coder with **no rule
about the irreversible step at all** — and for a document not in git, an edit in place is that
step (`docs/choices/uses-git.md:36`: *"A folder is one deletion from gone"*).

*Shape.* A `PracticeArea` with `target: 'policy'` in `src/questions/practices-policy.ts`, beside
`copy-registers` and `drive-by-fixes`: phase `practices`, id `edit-policy`,
`configKey: practices.edit-policy`, `when: { key: 'workKind', is: 'non-code' }`, three options
with the recommended one first (G19). It renders where the other two policy areas render — the
short standard's `## Preferences`, through `policyParagraphs` (`src/render/standard.ts:91`),
which picks up a new area with no renderer change — and nowhere on a code track, where the
area's answer is absent and `policyAnswer` reads `none`.

*The three answers, and what each paragraph says.* **(1) The agent edits, and names every
change** — *recommended*: the agent changes the file; the hand-back names every file changed
and, for each, the section and what it said before; the agent never deletes a document and never
overwrites one it has not read in this session — it moves the old one aside and says where.
**(2) Show me first — I make the change**: changes to a document are written in chat, not made;
the owner applies them; this holds whether or not the target is in git, because the owner asked
for it. **(3) No rule**: nothing is written. The ask line and the option labels are
visitor-facing copy and go out under R7 (§10.5); the paragraphs themselves are the builder's to
write in the register of the two beside them, flagged in the hand-back as D19 did for
`output-style`.

*Why (1) is recommended and not (2).* Every other recommendation here puts the irreversible step
with the owner — `commit-policy`, `output-style`, `drive-by-fixes` — and consistency argued for
(2). Two things outweigh it. D15's evidence: the complaint this design exists for is an agent
that *"replies with a plan instead of doing the work"*, and (2) makes that the rule. And the
harness already supplies the veto (2) would add: in the default permission mode `Write` and
`Edit` prompt before touching a file, and they refuse to overwrite one the session has not read
(G33), so the "show me first" step exists before any rule is written. What no harness setting
supplies is the *ritual around* an edit — name it, never delete, move aside — and that is what
(1) writes. (2) stays for the person whose documents are records an agent must not touch, which
is a real case with its own defense.

*Against, recorded.* It is a third `practices` question on a phase this design cut to two for
the non-coder, and the recommended answer is the one place this tool recommends the agent take
an irreversible step. The mitigation is D25, which enforces the "never delete" clause where hooks
are on, in the relationship `commit-policy` has to the commit guard. And the condition leaves the
code+no-git person without it: a repo without version control is a situation this tool declines
to design for, and says so rather than serving it badly.

**D23 — A non-coder is asked, once per target, what the agent must not read or copy.**
2026-09-22. *Ratified:* —

The audit's fourth candidate, taken — the only one of the seven about harm to someone other than
the owner. A folder of non-code work is far likelier than a repo to hold other people's records,
and as of 2026-09-22 the wizard does not ask (G37).

*Shape.* A `text` question in `discover`, id `off-limits`, `configKey: offLimits`,
`when: { key: 'workKind', is: 'non-code' }`, asked per target exactly as the proof line is
(G32): into the per-target map, carried on `RepoPlan` as `offLimits`, laid over by
`targetAnswers` so it is saved to `.personal-config.json` and hashed into the stamp. Empty is a
complete answer and renders nothing — unlike the proof line, whose empty renders *"not yet
written"* because writing one is a first-session job; nothing being off limits is not a job.

*What it renders.* One line in the short router's `## Never do this` — *Never read, copy or
quote from `<answer>`* — beside the commit line, and one row in the short ledger's "How things
are here" table — *Not to be read or copied | `<answer>` | the owner* — under the proof-line
row. Both templates have the slot (G32). Nothing on a code track: the full router's `## Never do
this` is Part 0's to fill, and a code repo's off-limits material has conventions (`.gitignore`,
`.env`) this question would only restate.

*Against, recorded.* A rule is not a guard, and this is the boundary where that matters most: a
`grep -r` over the folder reads the material before the rule is consulted, and one path named at
setup time leaves the next sensitive file unnamed. A blank text question is also the screen most
people skip. The answer is that the router is read before the folder is touched, that one named
path is more than the zero named without the question, and that the harness has an enforcement
mechanism this can grow into — `permissions.deny` on a `Read` pattern in the project's own
settings — which §10.6 reserves rather than builds, because it is a second write target and the
question has to exist before it is worth wiring.

**D24 — Five candidates declined, each with its reason, so they are not proposed again.**
2026-09-22. *Ratified:* —

The discriminator, applied to all seven: **a preference only the person holds is a question; a
fact the first session can read off the folder is the first session's job**, which the short
standard's last section already assigns (`standard/AGENT-PRACTICES.short.md:184-190`: *"look at
what is actually in the folder, and fill the ledger's Orientation and 'How things are here' from
what you find"*). A question that fills a slot the first session would fill better, with the
folder in view, is a screen spent to get a worse answer.

- **(3) What the agent must show when it states a number.** Declined: it is R2 of the short
  standard already (G31), with a test, and a second rule about numbers would restate it or
  contradict it. If R2's *Test:* line turns out not to reach a computed figure, that is a
  one-line change to the short standard's R2 — its own row, since editing that file is outside
  this one — and not a question.
- **(5) How new documents are named and where they go.** Declined: the analogue in code,
  `file-naming`, has options because ecosystems have conventions to pick from; non-code work has
  none, so this is free text rendered as a rule the agent must interpret — and the folder's own
  contents show the convention better than a wizard can elicit it. The short ledger's *Where the
  files live* row is the slot. **Against, recorded:** a person with no convention yet gets none;
  the answer is that the first session writes one with the owner, which is R6/R7 work and better
  done with the folder open.
- **(6) What format the work is in.** Declined: `ls` answers it, and the only thing the answer
  could change — which tools the agent needs for a spreadsheet — is not this tool's to write (§2:
  the output is documents that shape how an agent works). **Against, recorded, and it is the
  strongest of the five:** it is the one question whose answer might mean *this tool cannot help
  you* — work that lives in a web app or a database has no folder for a router to sit in — and a
  wizard that asked it first could say so before twenty questions rather than after. The honest
  reply is that this design cannot serve a non-disk answer (§2: one wizard, documents on disk),
  so the question would be a door with nothing behind it; §10.6 reserves it for a design that
  can.
- **(7) House vocabulary.** Declined as a question: it is a template slot at most — a `## Words
  used here` in the short ledger — and even that waits on evidence that a first session fails to
  write the folder's vocabulary into Orientation unprompted. This session has no such ledger to
  read, so the slot is not opened on a guess.
- **(2) The delete guard** is not declined; it is D25, as a hook and not a question.

**D25 — The `hooks` guard option installs a delete guard for non-code work: the analogue of the
commit guard. Partially supersedes D16.** 2026-09-22. *Ratified:* —

Item 55 conditions the commit guard on git and asks, for the person who keeps none, *"does a
no-git run get a guard of its own?"*, deferring the answer here (G35). It does — keyed on **work
kind**, not on git, because `settings.json` is global (`src/render/hooks.ts:11`) and the guard has
to be right for every session the person runs: a non-coder who also keeps repos needs the delete
guard in the folder and the commit guard in the repo, and both are theirs.

*Shape.* `templates/hooks/delete-guard.sh`, a `PreToolUse` hook on `Bash` with the commit
guard's parser (G34 — copied, not reinvented: wrappers, chained commands and the `jq` fail-closed
path are already solved there), refusing `rm`, `rmdir` and `unlink` with exit 2 and a message
that names the alternative: move the file aside — into the Trash, or beside itself with the date
in its name — and say where it went. Installed when `hooks` is `commit-guard` or `both` and
`workKind` is `non-code`, on **both weights**. That last clause is the partial supersession of
D16, which said light writes the completion gate and no guard: D16's reason for leaving the
commit guard out of light — *it is git-specific* — does not reach a guard that is not, and
D16's own argument for the gate — *a command hook spends zero tokens, so the budget argument that
carried D6 does not apply* — carries this one identically. D16's commit-guard half is untouched:
light still writes no commit guard, item 55 is unchanged, and `hooks: none` is still none on
every track.

*No new question.* The `hooks` question's first option covers both guards; its label and hint
are reworded (D21, R7 variants in §10.5) so it no longer names three git commands to a person
who has none. The value `commit-guard` is kept — values are ids a stored profile carries, and
renaming one is DIAL-7's problem twice over.

*What it catches and what it does not, to be recorded in `docs/choices/hooks.md` as the commit
guard's are.* Caught: `rm`, `rmdir` and `unlink` in every form the commit guard's parser sees
`git commit` in. Not caught: `find -delete`, `git clean`, a redirect that truncates a file, `mv`
over an existing path, and any script the agent runs — it is a guard against a session reaching
for a delete, not against a determined one. The overwrite half is the harness's (G33), which is
what makes a Bash-only guard sufficient; row 59 verifies G33 before relying on it.

*Against, recorded.* `rm` is one of several ways to lose a file from a shell, so the guard covers
a fraction and the feeling of coverage is whole — the objection the hooks long form records
against the completion gate, answered the same way: a guard that catches the common case and
says what it does not catch is worth more than none. It is a fourth script under
`templates/hooks/` to keep working on bash 3.2. And it makes light asymmetric — a light
non-coder gets a guard where a light coder gets none — which is D16's asymmetry, not this
decision's, and D16 is not reopened here.

**D26 — The short track asks nothing it discards: `archive-home` and `mode` join item 56's
six.** 2026-09-22. *Ratified:* —

G23 and G24: both are asked on every short-track shape, saved, and rendered into no document
there. They take the spec item 56 writes for `work-profile` —
`{ all: [{ key: 'workKind', is: 'code' }, { key: 'configWeight', is: 'full' }] }`, the negation
of `isShortTrack` (`src/questions/discover.ts:43-48` in item 56's tree; its tier questions took
the weight alone, because `model-routing.md` prints them on non-code + full) — and `tracker`
follows `mode` for free, since an unasked `mode` is not `team`.
A `mode` that is not asked reads as `solo` (`src/commands/setup.ts`, `pickShared`), which is what
the short standard already says of its reader: *"The owner is the person who decides things
here"* (`standard/AGENT-PRACTICES.short.md:18`).

*Defense.* Item 56's own: an answer nothing reads is a screen spent for nothing, and the person
this design is for pays for every screen. The two long forms' "What it writes" sections say when
the question is asked at all.

*Against, recorded.* A non-code team — a small firm, several people deciding — is a real reader,
and this makes the short track solo-only in its questions as it already is in its documents. The
answer is that the long track serves that reader no better as of 2026-09-22 (a non-code team
would get a code standard with a Part 12), that no such reader appears in §1 or in the audit,
and that a team branch of the short standard is a row of its own once one does — §10.6 reserves
it. And `archive-home` on the short track has one reader, the record in `.personal-config.json`;
not asking it leaves that key empty, which `renderArchiveIndex` already treats as "no archive"
(`src/render/repo.ts:287`).

### 10.3 What it costs

Every accepted question owes a long form (G19 — over 400 characters, the word *undo*, the
defense, the strongest argument against, what it writes, how to undo; `recommended` first where
there are three options), and every string, `when` or question is a catalog change. All of them
ride **one publish**, and the lockstep D14 names holds: personal-config publishes → the portfolio
bumps its exact pin (the successor to item 46) → deploy. **No portfolio code changes** (G36): no
new `WhenSpec` form, no new phase, no new question kind. Item 57's counter fix is in the same
portfolio pass.

| Decision | Long forms | Catalog | Renderers and templates | Crosses the pin |
|---|---|---|---|---|
| D20 | `uses-git.md`, options section | two option labels + hints | none | yes |
| D21 | `projects-dir.md`, `work-profile.md` where they quote the ask | two asks | none | yes |
| D22 | `edit-policy.md` (new) | +1 question, `practices` | `practices-policy.ts` area; `short-standard.ts` picks it up unchanged | yes |
| D23 | `off-limits.md` (new) | +1 question, `discover` | `discover.ts`; `types.ts` (`RepoPlan.offLimits`); `setup.ts` (`planRepo`); `context.ts` (`targetAnswers`, a reader); `repo.ts` (short router, short ledger); `CLAUDE.short.md`; `HANDOFF.short.md` | yes |
| D25 | `hooks.md` | one option label + hint | `templates/hooks/delete-guard.sh` (new); `hooks.ts` (`wantedHooks`, the merge, `declinedHookHelp` and `hookSnippet`, which enumerate scripts by name) | the label does; the script alone would not |
| D26 | `archive-home.md`, `mode.md` | two `when`s | none | yes |

*The counts.* `catalog.json` goes **35 → 37**; `tests/catalog.test.ts:35`'s split becomes
`{ you: 14, discover: 8, practices: 15 }` and its conditions table gains four entries — that red
is the test doing its job (hazard 4). What each shape is asked: measured before item 56 began
(G23) and again on item 56's uncommitted tree at 13:44 on 2026-09-22, then computed for this
section's two changes — the last two columns are arithmetic, not a run (R10), and rows 60 and 61
verify them by running:

| Shape | Before item 56 | Item 56's tree, 13:44 | After D26 | After D22 + D23 |
|---|---|---|---|---|
| code + full + git | 33 | 33 | 33 | **33** — §2's first non-scope item, in questions as in bytes |
| code + full + no git | 32 | 30 | 30 | **30** |
| code + light + git | 33 | 29 | 27 | **27** |
| non-code + full + git | 22 | 18 | 16 | **18** |
| non-code + light + no git | 21 | 14 | 12 | **14** |

`PART 3 OF 3 · House rules` for a non-coder: two questions → three. Item 56's own ask — whether
`model-routing` joins — is answered in its tree: gated on weight, so a non-code + full person is
still asked the three tier questions, because their `model-routing.md` prints the table
(`src/render/rules.ts:25`).

*The version.* A minor, not a patch: the question set changes shape, which is D19's rule for
`0.3.0`. Whether it is the cut that carries items 54–56 or the one after is Zach's; nothing here
publishes.

### 10.4 The build rows this section opens

Three rows, all `HELD` on this section's ratification, serial in lane A because they share
`catalog.json`, `src/questions/` and `tests/catalog.test.ts` with item 56 and with each other.
The rows carry the prompts; this is the order and why.

| # | Row | Decides | Driver | Waits on | Why that shape |
|---|---|---|---|---|---|
| 59 | The delete guard | D25 — the script, the hook entry, the long form; not the label | Opus 5 | item 55, ratification | Item 55 owns `hooks.ts`, `hooks.md` and `tests/hooks.test.ts` and is re-gating the commit guard in the same function; this lands on top of it rather than beside it. No catalog change, so it can land before the publish-bearing rows, and the label in row 60 then describes something that exists. |
| 60 | The short track's question set, second pass | D20's labels, D21, D25's label, D26 | Opus 5 | items 56 and 59, ratification | Catalog-only: four strings, two `when`s, six long forms, the counts. Item 56 owns every file it touches and writes the `when` precedent it copies. Opus 5 to match item 56, because a wrong `when` is a silent skip. |
| 61 | The two non-code questions | D22, D23 | Opus 5 | row 60, ratification | The only row with renderer work — the proof line's path for D23, a policy area for D22 — and two new long forms. Last because it moves the counts row 60 just moved. |

Not a row: item 57 (the portfolio counter) is unchanged by this. Item 56 is not amended: its
prompt already writes git conditions as `isNot: 'no'`, which D20 makes a hedge with nothing
behind it, and harmless either way.

### 10.5 Copy going out under R7

Settled by citation, no variants: **projects** and **this project** (G30). Unsettled, three
registers each, the recommendation first. All four questions are on the non-coder's first
screens, where §7.1 chose warm.

`uses-git`, the two options (D20):
- *warm* — **Yes, some or all of it** · commits and history, in at least one place /
  **No, none of it** · the files live on disk and that's it
- *plain* — **Yes — at least some of it is in git** / **No — none of it is**
- *terse* — **Some or all of it** / **None of it**

`hooks`, the first option (D25):
- *plain* — **Yes — block the commands that can't be undone** · `git commit` and `git push` in a
  repo, `rm` for other work; the hook refuses and says what to do instead
- *warm* — **Yes — guard the things you can't take back** · commits and pushes in a repo,
  deleting a file elsewhere; which one you get follows your answers above
- *terse* — **Yes — guard commits and deletes** · the hook refuses them and prints the alternative

`edit-policy`, the ask and three options (D22):
- ask, *warm* — **When your agent changes a document, should it make the change, or show it to
  you first?** · *plain* — Who makes changes to your documents — the agent, or you? · *terse* —
  May the agent edit your documents directly?
- options — **The agent edits, and names every change** · it changes the file, says which part
  and what it said before, and never deletes one / **Show me first — I make the change** · it
  writes the new wording in chat; you put it in / **No rule** · nothing is written; the agent
  does what it would do by default

`off-limits`, the ask and placeholder (D23):
- ask, *warm* — **Is there anything here the agent must not read or copy?** · *plain* — What
  must the agent never read or copy here? · *terse* — Anything off limits to the agent?
- placeholder — *e.g. a folder of other people's records — or leave this empty*

### 10.6 Seams reserved, deliberately not built

- **`permissions.deny` for D23.** The harness can refuse a `Read` by pattern in the project's own
  settings; D23's answer is the input it would need. Not built: a second write target
  (`<project>/.claude/settings.json`) with its own merge, preview and undo, before the question
  has shown it gets answered.
- **A team branch of the short standard** (D26's argument against). Waits on a reader.
- **"Where does the work live?"** (D24, candidate 6). Waits on a design that can serve an answer
  other than a folder on disk.
- **A vocabulary slot in the short ledger** (D24, candidate 7). Waits on a first session's ledger
  showing it missing.
- **D22 and D23 on the code track.** The full router's `## Never do this` is Part 0's; a
  code+no-git person's edit policy is a case this tool declines to serve.
- **`any:` and `not:`** — still no caller; §8's seam stands. Nothing in this section needed
  either, which is evidence the `all:`-only call was right.
- **`trash`, `find -delete` and `git clean` in the delete guard.** Recorded as not caught; a guard
  that grows by objection becomes the parallel exclusion list D5 refused.
