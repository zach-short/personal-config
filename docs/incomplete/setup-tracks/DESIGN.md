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
the argument against each one is what stops it returning in three weeks as a new objection.

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
