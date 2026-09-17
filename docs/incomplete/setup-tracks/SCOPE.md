# SCOPE — setup tracks: one wizard, several shapes of person

**Status:** `SCOPING`. Opened 2026-09-17. **GATE 1 partially given 2026-09-17** — eight
answers in §3, four questions still open in §7. Owner: Zach. Spans two repos —
`personal-config` (owns the questions and the renderers) and `portfolio`
(consumes `catalog.json` at `/setup`, pinned).

**Why this exists.** A non-technical friend wants the same working setup for non-code work —
accounting was the example — on a Claude **Pro** plan rather than Zach's. He will still use
Claude Code. Two things follow that the current wizard cannot express: the questions and the
generated documents assume a programmer with git repos, and the generated documents assume a
context budget that Pro does not have. Some of his material is in git; some is not.

This document proposes and decides nothing except where §3 records an answer already given.

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
| G12 | The site consumes a pinned, generated artifact | `portfolio/package.json` pins `personal-config` at an **exact registry version**, currently `0.2.3`. A question change reaches the browser only via publish → bump → deploy | `portfolio/package.json`; `portfolio/docs/incomplete/astro-rebuild/DESIGN.md` D6 |
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
  today must get byte-identical output to today.
- **Not a second CLI, a second package, or a fork.** One wizard, one catalog, one `catalog.json`.
- **Not accounting features.** No domain logic, no templates for ledgers-of-money, no
  spreadsheet anything. The output is still documents that shape how an agent works.
- **Not a plan-detection mechanism.** Nothing inspects the person's Claude subscription. If plan
  matters it is a question, answered by the person.
- **Not a change to the three rungs on `/setup`**, the short-id profile store, or `--from`.
- **Not publishing, pushing or deploying.** Those are Zach's, and `0.2.4`/`0.2.5` are already
  waiting (G13).

---

## 3. Decisions already given — 2026-09-17, in chat

Recorded the same turn they were given (R8: do not relitigate).

- **A1 — Two independent questions, not one combined setup name.** "What kind of work" and
  "how heavy a setup" are asked separately, so any combination is reachable — including the
  developer who wants the light config.
- **A2 — Exactly two values per track question.** Binary. This is what keeps `WhenSpec`
  untouched for the simple cases (G9) and keeps `catalog.json`'s shape stable across the pin.
- **A3 — The non-code track gets a short standard of its own**, not the 1,116-line one with
  parts cut. Written for non-code work and cheap to read every session.
- **A4 — Git is its own early question.** *"Will you use this config in git repos at all?"* —
  and if not, the git questions do not get asked. Driven by the friend's real situation: some of
  his material is in git and some is not.

**What A4 changes about A1.** There are now **three** binary axes, not two: work kind, config
weight, and git. Eight combinations exist; the question is which of them the renderers must
actually serve.

### Second batch — 2026-09-17, in chat

- **A5 — O2a. Discovery accepts plain directories, tagged.** `RepoScan` grows
  `kind: 'git' | 'folder'`; `scanProjectsDir` stops filtering on `isGitRepo` (G2). Renderers
  decide per target. Carries two obligations named in O2a's argument against: the confirm screen
  must stay readable when the scan is pointed somewhere broad, and `trackMode` needs a real
  answer for a folder target rather than a silent skip — there is no `.git/info/exclude` to
  write to.
- **A6 — O4a. Light cuts the machinery that assumes budget.** One model instead of three tiers;
  **no `model-routing.md`** — on Pro its advice to delegate to a subagent is actively expensive;
  no hooks; two skills instead of four; the short standard; a shorter router.
- **A7 — A proof line per target replaces "gates green" in the short standard.** The person
  writes what proves work is sound there — *"the reconciliation balances to the bank statement"*,
  *"someone who didn't write it read it"* — and it renders where gates go, cited by close-out.
  One more question, and DIAL-8 governs its wording.
- **A8 — This folder holds the design; the board holds the work.** `SCOPE.md` stays here and
  becomes `DESIGN.md` at full ratification; execution is rows in this repo's `PASSOFF.md` plus
  one in the portfolio's. The rows are written when the plan exists, not now.

**Two taken provisionally, 2026-09-17** — recommended in chat, not objected to, and reversible
until the plan is written: **O1a**, the three new questions go at the top of the existing `you`
phase rather than in a new phase (G16 makes a new phase id a runtime crash on the site); and
**O3a**, `WhenSpec` grows an `all:` form when the `track-mode` conjunction actually bites,
rather than before.

---

## 4. Options

### O1 — Where the three new questions sit in the flow

- **O1a — First three questions of the existing `you` phase.** **PROVISIONAL 2026-09-17.** No new `Phase`
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

- **O2a — Discovery returns plain directories too, tagged.** **CHOSEN 2026-09-17 (A5).** `RepoScan` grows a
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

- **O3a — Add `{ all: [WhenSpec, ...] }` to `WhenSpec`.** **PROVISIONAL 2026-09-17.** Roughly ten lines in
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

- **O4a — Light cuts the machinery that assumes a big budget.** **CHOSEN 2026-09-17 (A6).** One model
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

Every number and word this leaves open, each with a recommended default, destined for a config
key or a profile rather than a constant.

| Dial | What it sets | Recommended default |
|---|---|---|
| DIAL-1 | Default value of the work-kind question | `code` — today's behaviour is preserved for everyone who already ran the wizard |
| DIAL-2 | Default value of the weight question | `full` — same reason |
| DIAL-3 | Default value of the git question | `yes` — same reason |
| DIAL-4 | Model tiers in light mode | **1**, not 3. Two of the three questions disappear and `model-routing.md` is not written |
| DIAL-5 | Length ceiling for the short standard | **≤ 200 lines**, so a session pays roughly a tenth of G8's 40–80k |
| DIAL-6 | Skills installed in light mode | `/handoff` and `/close-out` only — the two that survive without gates or commits |
| DIAL-7 | How a stored profile missing the new keys is read | As today's behaviour: `code` / `full` / `yes`, explicitly, never by falling through to "first recommended option" |
| DIAL-8 | Wording of the three new questions and of `/setup`'s heading | **Unset.** R7 applies — 2–3 registers each, at the next gate, not picked here |

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
   `doctor`'s stamp-drift rule and `README` all currently assume is singular.
9. **This folder changes what the wizard thinks this repo is.** `FOLDER_MARKERS` is
   `['docs/incomplete']` (`src/lib/discover.ts:31`), so creating this directory makes
   `impliedProfile` return `'folders'` for `personal-config` itself. Harmless, but this repo
   dogfoods its own scanner.
10. **The `/setup` page turns a non-programmer away in its first four words.** *"Set up your
    repo"* is the title, the heading and the OG title (G18). No question ordering fixes a
    heading.

---

## 7. Open questions — still open after 2026-09-17

Four of the original six were answered; they are in §3. These remain, and the plan cannot be
written without 1 and 2.

1. **Does the light track still write a ledger and a board?** They are the heart of the method,
   and they are also two more files read every session on a plan with less room. A6 settled what
   light cuts from the *global* layer; it did not settle this.
2. **Does the short standard live in `standard/` with its own version**, or share
   `standard/VERSION` (hazard 8)? `standardVersion()` reads one file, and the stamp,
   `doctor`'s stamp-drift rule and `README` all assume it is singular.
3. **Does the friend arrive by the website or the terminal?** It decides whether the portfolio
   copy is the first phase of the build or the last — and hazard 10 says the page turns a
   non-programmer away in its first four words either way.
4. **Is accounting the only non-code case**, or should the questions and long forms be written
   generally — writing, research, teaching, ops — with accounting as the worked example? S1
   (hazard 7) means the friend's case can only ever appear in `docs/choices/*.md` as one
   person's worked example, so this decides the *wording* of three questions and three long
   forms, not just their scope.
