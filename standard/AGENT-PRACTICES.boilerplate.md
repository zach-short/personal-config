# Agent working standard — portable boilerplate

**What this is.** A complete working standard for agent-driven development: how work is
scoped and decided, how it is sized to a model's context, which model runs what, how several
sessions run against one repo without eating each other's work, what a session hands the next
one, and how the documentation is written so the next session can trust it.

**Five words this file leans on.** A **ledger** is the file recording what is true of a repo —
its environment, its settled decisions, and a numbered, append-only log of the work done. A
**board** is the file listing what is next, one standalone prompt per item. A **profile** is the
shape a repo keeps its work in: a ledger and a board, or one folder per effort (Part 2 defines
both). **Mode** is whether one person decides here or several (Part 12, which a one-person repo
cuts). A **tier** is one of three named slots — Deep, Default, Mechanical — that a task's model
is picked from (Part 4).

**How to use it.** Copy this file into a repo — `docs/AGENT-PRACTICES.md` is the usual home —
and say: *"Adapt these rules to this codebase."* Part 0 is the protocol for that; it is
written at the agent, not at you. Among what it asks is whether one person or a team works
here, and the adapted copy is built on the answer. If an installer put this file here, it also
left a prompt saying which of Part 0's steps are already done; follow that prompt rather than
this paragraph.

**Standard version: 1.2.0**

**Adapted: not yet — run Part 0.**

**Placeholders.** Anything written in double curly braces is wrong for your repo by
construction; Appendix A lists every one and how to derive it. Adapted means
`grep -nE '\{\{' docs/AGENT-PRACTICES.md` returns hits only inside Appendix A's table. Until
then this file is a template and must not be cited as authority. Slots written `<like this>`
inside fenced blocks are part of a template you copy — they are not adapt-time values and stay
as they are.

**Provenance.** Distilled from two working repos, each rule written after the failure that
made it necessary:

- **Repo A — a TypeScript/Go monorepo** (Bun workspace, Next.js web + Expo native + Go API +
  Postgres, ~15 CI jobs, ratcheted lint). Large, heavily gated, many sessions a day.
- **Repo B — a Swift app** (iOS + macOS + widgets + extensions, XcodeGen, no CI). Small,
  gates are two `xcodebuild` commands, work arrives as a stream of independent items.

Their failures are preserved as `> **Worked example**` blocks — or, where a sentence is enough,
named inline as repo A's or repo B's. Either way they describe *those* repos: evidence for a
rule, never facts about yours.

**Map.** Part 0 adapts this file and is deleted once it has. Part 1 is the twelve rules that
hold everywhere. Part 2 is where work gets written down, in one of two profiles. Part 3 is the
pass-off prompt. Part 4 picks the model. Part 5 sizes work to a model's context. Part 6 is
parallel sessions and git. Part 7 closes a piece of work. Part 8 is how the docs are written.
Part 9 is the file the harness auto-loads. Part 10 is agent memory. Part 11 is owner policy,
editable. Part 12 is team mode, cut in a one-person repo. Appendix A lists the placeholders;
Appendix B lists what adaptation produces.

---

# Part 0 — Adapt protocol

Run once, on first read, before any feature work. Do not do feature work in the same session:
adaptation costs 40–80k of context — repos A and B, 2026-09-14 — and you want the whole budget
for the build.

### 0.1 Inventory, read-only

Propose nothing yet. Find out what is actually true:

```bash
ls -a; cat README* 2>/dev/null | head -60
cat package.json go.mod Cargo.toml pyproject.toml Makefile project.yml Package.swift 2>/dev/null | head -80
ls .github/workflows 2>/dev/null && cat .github/workflows/*.y*ml 2>/dev/null | head -120
ls docs design 2>/dev/null; ls .claude 2>/dev/null; cat CLAUDE.md AGENTS.md 2>/dev/null | head -40
git log --oneline -20; git worktree list; git status --ignored --short | grep '^!!'
```

You are answering, with citations:

1. **What are the gates?** The exact commands that prove a change is sound — typecheck, lint,
   build, tests, and any repo-specific checker. Take them from CI where there is CI, else from
   the repo's own ledger or README, else from the toolchain's own command.
2. **Which gates can lie?** A checker that skips silently when an env var is missing, a lint
   run where the rules are `warn` and nothing fails, a test suite that prints `ok` having run
   nothing, a build check that greps a log and prints nothing when the build never started.
   Find them now; they are the expensive kind.
3. **What does a fresh checkout not have?** Gitignored-but-required files — `.env`, generated
   projects and type declarations, local config. The `!!` lines above and the `.gitignore` are
   the sources. These fail gates for reasons that are not yours.
4. **Where does work get written down?** An existing `docs/`, a handoff file, an ADR
   folder, a tracker, or nothing. If a ledger and board, or project folders, already exist
   under any names, the profile (0.2) is already chosen and the names stay.
5. **Is there a numbered shared resource?** Migrations, ledger steps, fixture ids — anything
   where two sessions can claim the same number.
6. **How is the repo built and run?** And what can an agent *not* verify here — a physical
   device, an external service, a paid API.
7. **How does it ship?** The path from a merged commit to a running system, and whether merge
   is the same as deploy. If nothing ships on its own, write that down: merged is not shipped,
   and a runtime pass needs a deployed build.
8. **What shape is the work, and who decides?** A stream of independent items, or a few
   efforts that each span sessions — that picks the profile (0.2). One person deciding
   everything, or several — that picks the mode (Part 12).

**Run every gate command once before you write it down.** A command in a standards file that
has never been run in this repo is a trap for every session after you.

### 0.2 Choose the profile

Part 2 defines two. Pick by the shape of the work, not the size of the repo:

- **Profile L — ledger + board.** One append-only `HANDOFF.md` (environment, settled
  decisions, code map, invariants, numbered step log) plus one `PASSOFF.md` board of numbered
  standalone prompts. Right when work arrives as a stream of mostly independent items, when
  there is one maintainer, and when a feature is usually one or two sessions.
- **Profile P — project folders.** `{{DOCS_HOME}}/incomplete/<slug>/` holding
  `SCOPE.md` → `DESIGN.md` → `PLAN.md` → `RUNTIME-PASS.md`, archived on close. Right when a
  single effort spans many sessions, touches several platforms or subsystems, and needs
  decisions ratified before code.

They are not exclusive. A repo on Profile L opens a project folder for the one effort that
needs it. A repo on Profile P keeps a board when it has a backlog of independent items.
Everything in Parts 3–7 applies to both. A repo that already keeps a ledger and board, or
project folders, under other names has already chosen: adopt those files as they are and do
not rename them to this file's names.

### 0.3 Fill every placeholder

Appendix A lists them all with how to derive each. Write `none` where the repo genuinely has
no such thing — an empty slot is information, a token left in place is a bug.

### 0.4 Cut what does not apply

Delete, do not keep as aspiration: no second platform ⇒ cut parity rules; no migrations ⇒ cut
the migration-number rule (keep the general numbered-resource rule if any number is shared);
no ratcheted lint ⇒ cut the ratchet rules; no CI ⇒ cut the CI enforcement tag and every
"what CI runs"; one person ⇒ cut Part 12. After cutting, grep for the words you cut
(`migration`, `parity`, `ratchet`, `CI`, `tracker`, `Part 12`) and fix every survivor — a rule
that points at a deleted one is worse than either. **Never cut Part 1.**

### 0.5 Write `CLAUDE.md`

From the template in Part 9, with the gate commands you ran in 0.1 and the hazards you found.
`CLAUDE.md` is the file every session gets whether it wants it or not, so it carries only what
is needed *before* reading anything else: the pointer to this standard, the stack, the
directory map, the gates, and the short list of rules that actually get broken here.

### 0.6 GATE 0 — one batched question

Stop and ask the owner, in chat, in one batched question, in the same turn adaptation
finishes. What goes in it: the mode — one person or a team (Part 12) — and what it changes;
the profile choice (0.2) with your recommendation; the Part 11 owner-policy defaults you
propose to keep or change; the model mapping for Part 4; and anything the inventory could not
settle. Do not ask one at a time, and do not leave questions inside this file expecting them
to be read.

### 0.7 Stamp it, then delete Part 0

Change the line near the top to `**Adapted to this repo {{DATE}}, {{MODE}} mode.**` and under
it note what you cut and why, whether Part 11 was kept as shipped or rewritten, and where the
original boilerplate came from. Run the adapted test from the Placeholders paragraph and fix
every hit. Then delete the rest of Part 0: it has done its job, it is paid for on every read,
and the original is where the protocol lives if the repo is ever re-adapted. Stop, and let the
owner start the first real session fresh.

---

# Part 1 — The rules that hold everywhere

These survive every adaptation. They are the ones that, when broken, cost a whole session or
silently corrupt a later one. Each ends with its **test** — what a reader of the doc, the diff
or the hand-back checks — so whether a session complied is never a matter of opinion.
**"The owner"** throughout this file is whoever decides the matter in hand: in a one-person
repo, that person; in a team, the named decider for the area (Part 12).

**R1 — Absolute dates only.** `2026-09-14`, never "today", "recently", "last week". Docs are
read months later by an agent with no idea when they were written.
*Test:* `grep -niE 'today|yesterday|tomorrow|recently|currently|last (week|month|year)|this (week|month|year)|(days|weeks|months) ago'`
over what you wrote returns nothing.

**R2 — Every claim carries a citation.** `file:line`, a filename, a commit hash, a migration
name, the query that produced it. A claim with no citation is a guess and will be treated as
one.
*Test:* every sentence stating what the code, the data or the tooling does names its source;
one that cannot is deleted before hand-off.

**R3 — A claim in an existing doc is a lead, not a fact.** Re-verify before building on it.
*Test:* a claim carried forward appears with `verified <date>` and the citation from your own
check, not the original's.

> **Worked example — repo A.** A handoff recorded "there is no vision anywhere in the repo".
> Vision was live the whole time at `backend/helpers/listingHelpers.go:326`. On that same
> track, handoff "missing feature" claims were three for three wrong.

**R4 — Grep before recording an absence.** "Nothing does X" is the most expensive kind of
wrong claim, because everything downstream is built on it.
*Test:* every "nothing does X" and "there is no X" carries the grep or query that produced it.

**R5 — When you disprove something, record the disproof where the wrong claim lives.** With
the reason it was wrong. Silent deletion means the next session rediscovers it.
*Test:* the wrong claim is still findable, marked wrong, dated, with the disproof beside it.

**R6 — Ask the owner where they will see it, before building, in one batch.** In an
interactive session that is the chat, in the same turn; a team routes it as Part 12 says.
Questions written into a doc for async review do not get answered. Put every open question
into one prompt rather than trickling them.
*Test:* the questions went out in one message before any code that depends on an answer was
written; the hand-back lists any still unanswered.

**R7 — For user-facing copy, never pick silently.** Where a decision has not already fixed the
words, write 2–3 real variations in different registers (plain, warm, terse) and ask which.
Check first whether it is already settled; re-opening decided copy wastes the owner's time.
*Test:* the ask shows the variants with their registers named, or cites where the copy was
settled.

**R8 — Never re-litigate a settled decision.** Check for the settled/ratified marker before
treating anything as open. Genuinely new evidence produces a *supersession* — stated
explicitly, dated, naming what it replaces — not a quiet reversal.
*Test:* nothing carrying a settled marker is reopened in a doc or an ask; any change to one is
a dated supersession that names what it replaces.

**R9 — Descoping is the owner's call.** If something is explicitly parked, record it and stop
raising it. If nothing has been said, a finding still blocks by default: surface the judgment
call rather than making it.
*Test:* every finding not fixed appears in the hand-back as `parked by owner <date>` or
`open`; none is dropped silently.

**R10 — Report faithfully.** "Gates green, not seen running" and "walked the flow on the
device" are different claims and must never be merged. Say which one you have.
*Test:* the hand-back says which of the two it claims, per item.

**R11 — Read the matching standard in full before writing code.** Not optional, not
conditional on task size. If you have not read it this session, read it now.
*Test:* the session's first reads include the standard, and the hand-back names it.

**R12 — Stop mid-file when something contradicts a settled decision.** Do not take the call
and flag it afterwards, do not finish the phase first. The test is whether the decision would
have come out differently; if you are unsure, that is itself the signal to ask. A build-level
call that merely *implements* a settled decision is yours to take — record it, as a `BD-n` in
the plan (2.2, Stage 4) or a line in the ledger step (2.1), with one line on how to reverse it.
*Test:* the contradiction reaches the owner as a question before the next edit to that file
lands.

---

# Part 2 — Where work gets written down

## 2.1 Profile L — ledger + board

Two files at the repo root, by these names unless the repo already has them under others.

### `HANDOFF.md` — what is true

Read first by every session. Append-only in its log; its standing sections are edited in place
when they go stale. Sections, in this order:

- **Orientation.** One paragraph: what this project is, who the owner is, what they know, and
  that they are interactive — ask when a decision is theirs. Then the read-first list.
- **Environment.** The verified build command, the verified test command, versions, device
  ids, signing, where logs land. Each one run before it was written. **State plainly what an
  agent cannot do here** — and what to do instead.

  > **Worked example — repo B.** "Nothing can screenshot the phone; the owner sends
  > screenshots." So every session ends with *exactly what to tap and what should appear*, and
  > waits. Naming the limit converts it from a silent gap into a handoff step.

- **Settled: `<topic>`** — one section per area, stating what the product *is*. Marked
  settled, with dates. **Do not re-ask anything under Settled** (R8).
- **Code map.** Where things live, one line each, updated by the session that adds a file.
- **Invariants.** "How X works — do not break these." The rules that compile fine when broken.
- **Known API facts and quirks.** Platform behaviour learned the hard way, with citations.
- **The step log.** Numbered, append-only: `**N. Title.** Done <date>. <what changed, why,
  what is now fixed, which decisions it answered>`. Steps are addressable forever — "HANDOFF
  24" is how everything else refers to work. Two rules: **take the next free number by reading
  the file, not by trusting one written elsewhere** (another session may have taken it), and
  **do not edit a step you did not write** — append a correction as a new step. Old steps lose
  their bodies to the archive and keep their number, title and date as one line (Part 7);
  because a step is addressable forever, that line is what keeps the citation resolving.
- **Style rules.** Short; the language-level conventions live wherever Part 8.1 puts them.

### `PASSOFF.md` — what is next

A board plus one standalone prompt per item (Part 3). The board is the parallelism model:

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|

- **Lanes run in parallel; items inside a lane run in order.** Each open lane is its own
  worktree. Items in one lane are serial because each changes the shape the next builds on.
- **"Files it owns"** is the collision check. Two items that name the same file do not run at
  the same time, whatever their lanes say. Check it against every open item before starting one.
- **Status** uses the board words in 2.3, and `DONE` points at the ledger step that is the
  real record: `DONE — HANDOFF 24`. **Do not paste a prompt marked DONE** — a fresh session
  would build it again.
- **A prompt rots the moment it is executed.** The ledger step is the truth; the prompt is the
  ask. Where a DONE prompt turns out to describe the work wrongly, say so on the board rather
  than editing the prompt into a lie.
- **A `DONE` item's prompt leaves the board; its row never does.** The row is the permanent
  part — the collision check, the pointer at the ledger step, and the item number, which
  nothing may ever reuse. The prompt under it is the part that grows without bound, and it is
  dead by the rule directly above. Fold it out at close-out (Part 7). **`SUPERSEDED` and
  `SETTLED AS NO` keep their sections**: the first names what replaced the item, the second
  carries the reason it is not to be re-proposed, and neither fact is written anywhere else.
- **An item exists before work on it starts:** a row, plus a dated paragraph under the board
  saying why it exists and what it came out of. An item settled as *no* stays on the board with
  its reason, so it is not re-proposed.

## 2.2 Profile P — project folders

One folder per effort at `{{DOCS_HOME}}/incomplete/<slug>/`, from the first keystroke, moved
to `{{ARCHIVE_HOME}}/<slug>/` when it closes.

| Stage | Artifact | Who decides | Exit condition |
|---|---|---|---|
| 0 · Intake | — | — | You know what tree and what data to read |
| 1 · Ground truth | (feeds 2) | — | Every claim carries a citation, dated |
| 2 · Scope | `SCOPE.md` | agent proposes | Options with defenses; nothing decided |
| **GATE 1** | — | **owner** | Decisions ratified |
| 3 · Design | `DESIGN.md` | owner decides, agent records | `D1…Dn` frozen, with supersessions |
| 4 · Plan | `PLAN.md` | agent proposes | Phases, lanes, done-when, dials |
| **GATE 2** | — | **owner** | Plan approved |
| 5 · Build | `PLAN.md` per phase | agent | Gates green; header says BUILT + hash |
| 6 · As-built | `DESIGN.md` amended | agent | Every deviation recorded under its decision |
| 7 · Runtime pass | `RUNTIME-PASS.md` | owner walks it | Findings folded back |
| 8 · Close-out | archive + index + memory | agent | Folder out of the repo, referrers checked |

**Stage 0 — Intake.** When the owner says "let's build X": say nothing back until Stage 1 is
done. No clarifying questions first — the audit answers most of them, and the rest are asked
at GATE 1 in one batch. Read first: the code standard in full, `CLAUDE.md`, and any existing
doc that overlaps, including the archive index. That last one is what stops a project
re-deciding something already settled.

**Stage 1 — Ground truth.** Read the tree and the live data before proposing anything. R2–R5
apply hardest here. Output is a table — claim, verified state, citation — dated absolutely. It
becomes `DESIGN.md` §1. This stage routinely finds that the project is not the shape the
request assumed.

> **Worked example — repo A.** A project opened by discovering the link it was asked to build
> already existed in the schema and ran backwards, destructively, deleting the user's
> addresses on every slider tick. That reordered the entire project.

**Stage 2 — `SCOPE.md`.** Its job is to make the owner's decisions cheap. It proposes and
decides nothing. Sections: **1. What exists, verified `<date>`** — the Stage 1 table,
first, because every option is only meaningful against it. **2. What this is / what this is
not** — the non-scope list is as load-bearing as the scope list and gets skipped constantly;
without it every parked item is relitigated mid-build. **3. Options** — each with a real
defense *including the strongest argument against it*, which is what stops that argument
coming back in three weeks as a new objection. **4. Dials** — every number the design leaves
open, each with a recommended default, destined for config rather than a constant hardcoded
twice. **5. Hazards this work walks into.** **6. Open questions** — the GATE 1 batch.

**GATE 1 — Ratification.** Stop. Ask in one batched question in the same turn the scope doc is
finished (R6). Every option carries a marked recommendation — never present a survey with no
opinion. R7 governs copy. Record every answer with its date, in the doc, the same turn it is
given.

**Stage 3 — `DESIGN.md`.** `SCOPE.md` is renamed (git records the transition) and the answers
are written in as `D1…Dn`, each carrying: the decision stated flatly; **the defense** — why
this and not the alternative, which is what makes it survivable when the next agent finds it
inconvenient; **supersession pointers**, specific, saying which half dies when a supersession
is partial; and the date. Also required: **"Rules that survive unchanged"** — listing what is
*not* changing is how you stop a build phase from helpfully rewriting it. **From here the
design is frozen**: it changes by amendment — a new dated `D<n>` or an `As built:` note —
never by editing a decision in place.

**Stage 4 — `PLAN.md`.** The design is *what and why*; the plan is *in what order, by whom,
done when*. Sections: **0. Facts verified `<date>` (supersede the design where they differ)** —
a second verification pass at build time, in the same table shape, because days have passed
and another effort may have taken your number; the plan's table wins, and says so in its own
heading. **1. Decisions taken since ratification** — build-level calls, numbered `BD-1…BD-n`
so a later deviation can cite them, each with a one-line reversal. **2. Phases** — the table
(`# | Phase | Driver | Subagents | Est. context | Why that shape`), where `Est. context` is a
band against that phase's driver ceiling (Part 5): `comfortable`, `full` or `tight`; a `tight`
phase names what it will delegate if it runs long, and nothing is planned above `tight` — that
is a phase that needs splitting. Then one section per phase with exactly five parts: status
header, scope (numbered, executable without re-reading the design), subagents (model and job,
or `none`, decided here not improvised), **done when** (the literal gate commands *plus* a
proof obligation a green gate cannot supply), and **watch for** (the hazard specific to this
phase). **3. Dials.** **4. Seams reserved, deliberately not built** — so the next effort need
not guess whether an omission was considered. **5. Repo hazards, with live numbers.**
**6. Session protocol** — a link to this file, plus anything specific to this project.

A phase whose done-when is only "gates pass" has no done-when. Gates cannot see a screen, so a
real done-when names the proof a green gate cannot supply.

> **Worked example — repo A.** Its gates could not see repository SQL at all. The done-whens
> that worked: *"a hand-run query proves the aggregate matches a manual average for one seeded
> user"*; *"an integration test proves creating a review enqueues an in-app row and **zero**
> push sends."*

**GATE 2 — Plan approval.** Phases, order, lanes and dials go to the owner before any code.
Once approved, the plan authorizes the whole run; phases do not each need re-approval.

**Stages 5–8** are Parts 5–7 of this file: build one phase per session, close it out, record
what actually shipped, walk the runtime pass, archive.

## 2.3 Status vocabulary

Use these words and no others, so a board or a folder can be scanned:

- **Board items (Profile L):** `OPEN` · `IN FLIGHT` · `DONE — <ledger step>` · `HELD` ·
  `SETTLED AS NO` · `SUPERSEDED`.
- **Project folders and phases (Profile P):** `SCOPING` · `RATIFIED` · `PLANNED` · `IN FLIGHT`
  · `BUILT` · `MERGED` · `HELD` · `SUPERSEDED` · `CLOSED`.

`BUILT` means gates green and any migration applied. `DONE` always points at the record.
`HELD` always names what it waits on. `SUPERSEDED` always names what replaced it. `SETTLED AS
NO` always carries the reason, because its whole job is to not be re-proposed.

## 2.4 Entering in the middle

Not every effort starts at the beginning.

- **A defect list from a real session** (a device pass, an owner walkthrough) starts at Stage 4
  — the findings *are* the scope. It gets the same phase / done-when / watch-for shape.
- **An audit** produces its findings as Stage 1 output and then enters at Stage 2.
- **A resumed effort** re-runs Stage 4 §0 before executing a single phase: days-old plans have
  stale numbers, closed findings, and phases another effort superseded.

---

# Part 3 — The pass-off prompt

**The single highest-leverage artifact in this standard.** Every session ends by writing the
next one's first message. It must stand alone: the next agent will not see this conversation,
this reasoning, or this context. A prompt that assumes any of it produces a session that
rediscovers what you already knew.

Nine parts, in this order. Skip a part only when it is genuinely empty, and say so.

**1 — Title.** Imperative, naming the change, not the area. *"Drag the week grid: windows
edited where they are drawn, on both apps"*, not *"week grid work"*.

**2 — The header line.** `**Model: <tier>. Lane <X>. Waits on <what>.**` Plus the worktree
instruction when the item needs its own (Part 6).

**3 — Orientation.** Who you are picking up, what to read first and in what order, and the
session rules restated *inline* — not by reference. Two or three sentences. Repeating them in
every prompt is deliberate: a prompt is pasted alone, and a rule one file away is a rule that
does not arrive.

**4 — Why this exists.** The product reason, in product terms. This is what lets the next
agent make a hundred small judgment calls the prompt does not cover.

**5 — What is fixed.** *"Read these before changing anything; do not relitigate them."* The
verified facts with citations: which files hold what, the sizes, the invariants, the house
precedent to copy rather than reinventing, the constraint that makes this smaller than it
looks. This section is where a session's Stage-1 reading is *banked* instead of re-paid.

**6 — Do these, in order.** Numbered steps, each carrying its reason and its constraint. A
step that says only what to do gets done differently than intended.

**7 — Ask before building.** The named decisions that are the owner's, each with what makes it
a real question and what the answer might be. Explicitly: *both are their calls, and the
answer to either may be no.*

**8 — Not in scope, whoever asks.** The negative list, named. It survives a persuasive
mid-session argument in a way that an unstated boundary does not.

**9 — Hand back.** Exactly what must be green (the literal commands), what the owner should
do and see (Part 7's runtime entries), and the commit or pull-request step Part 11 specifies.

### Template

```
## <N>. <Imperative title>

**Model: <tier>. Lane <X>. Waits on <nothing | item N | an external approval>.**
<Worktree instruction if this item needs one.>

You are picking up <project>. Read <ledger/plan> first — the build and test commands, the
invariants and the code map are there; do not re-derive them — then <next doc>.
Session rules: <the 2–3 that matter, inline>.

**Why this exists.** <product reason>

**What is fixed.** Read these before changing anything; do not relitigate them.
- <verified fact with file:line>
- <invariant, and what breaks if it is broken>
- <the house precedent to follow rather than invent>

Do these, in order:
1. **<step>.** <why, and the constraint it must respect>
2. …
<N>. **Record it.** <the ledger step / doc update this session owes, and what goes in it>

Ask before building: <the owner's calls>.
Not in scope, whoever asks: <the negative list>.

Hand back: <the exact gates, green>; <what the owner should do and see>; <the commit or
pull-request step Part 11 specifies>.
```

---

# Part 4 — Model selection

## The driver — the model the session runs on

**The discriminator is: can the failure be silent?** Not how big or how scary the work feels.
Sizing by fear over-assigns the expensive tier.

| Driver | Use for |
|---|---|
| **Deep** (`{{MODEL_DEEP}}`) | Only where a mistake compiles, passes every gate, and is wrong in production: money paths, cross-cutting dispatch rewrites, sync and merge rules, a notification that must never send. Prefer **one narrow Deep review of a short load-bearing path** over a whole Deep phase — and that review can be a subagent (below). |
| **Default** (`{{MODEL_DEFAULT}}`) | The default and the right answer for most work. Anything where failure is loud — a build break, a red gate, a wrong screen — because the gates do that reasoning for you. Also fully-specified migrations: high stakes, low reasoning. |
| **Mechanical** (`{{MODEL_FAST}}`) | Whole phases only when genuinely mechanical: close-out sweeps, ratchet edits, doc reconciliation, a bounded rename. Escalate to Default the moment a gate fails for a non-obvious reason. |

Every phase or board item states its driver, and the close-out repeats it (Part 7, Block C) so
the owner can set the model before opening the next session.

## Subagents

**A context-budget instrument first, a parallelism one second.** An inventory sweep run inline
costs the lead 30–50k in file reads; the same sweep in a subagent costs it a 2k summary (repo A,
an observation as of 2026-09-14, not a measurement). If a phase is oversized only because of
what it has to *read*, it is not oversized — it is under-delegated.

| Subagent | Use for |
|---|---|
| **Mechanical** | Inventory and mapping sweeps, grep-and-report, call-site enumeration, golden/fixture regeneration, lint cleanup, doc-referrer greps — anything whose whole verification is reading the output. |
| **Default** | Design judgment, tricky debugging, review of ordinary code — anything where a wrong answer would be believed and the gates would not catch it. |
| **Deep** | One job only: a narrow adversarial review of a single short load-bearing artifact — a money path, a merge or sync rule, a standards document — where the whole output is the verdict and nothing else is asked of it. Never for sweeps, never for building. |

**Why the Deep row is that narrow.** A subagent boundary keeps only the final text, so a Deep
subagent asked to *do* work throws away exactly what the tier is for — sustained reasoning
inside one context. A review is the one job whose entire value *is* the final text, so it
survives the boundary. The driver table is not the subagent table: Deep drives a phase when
the reasoning has to persist across edits, and reviews as a subagent when a verdict is all
that is wanted. The same discriminator applies as above — a Deep subagent is warranted only
where its subject's failure would be silent.

Two rules from getting this wrong:

- **A subagent spawned into the shared worktree will edit source even when asked only to
  review.** Give anything analytical its own worktree, and check the diffstat when it returns.
- **Never let a subagent inherit the session's tier for read-and-report work.** Pass the model
  explicitly, every time.

---

# Part 5 — Context budget

## Ceilings

A phase is sized to its driver's ceiling. **This is the primary division criterion, ahead of
conceptual tidiness** — the same work is a different number of phases depending on who runs it.

| Driver | Ceiling | Start landing at |
|---|---|---|
| **Mechanical** | ~500k | ~400k |
| **Default** | ~400k | ~300k |
| **Deep** | ~250k | ~150k |

*A ceiling is the context size at which a tier's sessions were observed to start compacting.
These were measured 2026-08-16 in repo A on the Claude models of that date — Sonnet as
Mechanical, Opus as Default, Fable as Deep. They are targets, not hard stops. They are a
property of the model and the harness, not of the repo, so an adopter inherits them as they
stand and re-measures only when a tier's model changes: watch where sessions compact, then
update the figure and the date. Measured: `{{DATE_MEASURED}}`.* The consequence worth
planning around: **assigning the Deep tier also shrinks the phase.** It gets roughly half an
ordinary phase's room and must be cut accordingly — another reason to prefer one narrow Deep
review over a whole Deep phase.

## The rule

**Within ~100k of the ceiling, stop expanding scope, find a stopping point, and write the next
agent's prompt.** Landing means: finish or cleanly abandon the edit in hand, run the gates on
what exists, commit it, write down exactly how far you got, and hand off *the remainder* —
not the next phase.

**A phase that ends cleanly at 60% of its scope, committed and documented, is worth more than
one that compacts at 100%.** After a compaction the agent is working from a summary of its own
reasoning and will re-read files it already read.

## Measuring it

**An agent has no automatic awareness of its own context size.** Nothing in context reports it,
and the first signal of overrun is auto-compaction firing — which is already the expensive
outcome. **In the Claude Code harness** it is measurable on demand: the harness writes
per-message usage into the session transcript, and the newest assistant message's
`input + cache_creation + cache_read` is the current size. The script needs `python3` on the
path — macOS and most Linux distributions ship it — and prints one plain line, rather than a
traceback, when no transcript or no usage record exists yet.

```bash
python3 - <<'PY'
import json, glob, os, re
SENTINEL = ""   # a distinctive phrase from THIS session; see the note below
proj = re.sub(r'[^A-Za-z0-9]', '-', os.getcwd())
files = sorted(glob.glob(os.path.expanduser(f'~/.claude/projects/{proj}/*.jsonl')),
               key=os.path.getmtime, reverse=True)
if not files:
    raise SystemExit(f"no transcript found under ~/.claude/projects/{proj}/")
f = next((p for p in files if SENTINEL and SENTINEL in open(p, errors='ignore').read()), files[0])
last = None
for line in open(f, errors='ignore'):
    try: u = (json.loads(line).get('message') or {}).get('usage')
    except Exception: continue
    if u: last = u
if not last:
    raise SystemExit(f"{os.path.basename(f)}: no usage records yet")
KEYS = ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens')
print(os.path.basename(f), f"context: {sum(last.get(k, 0) for k in KEYS):,} tokens")
PY
```

**With parallel sessions in one repo, newest-mtime picks the wrong transcript** — verified
2026-09-14 in repo A: the bare version reported another session's 394k as ours. Set `SENTINEL` to a
phrase unique to this conversation (a few words from the task prompt) and it selects correctly.

**On any other harness**, find its equivalent or treat the size as unmeasurable. Unmeasurable
means the split signals below and the countable proxies in the relay contract — files read,
items done — are the only budget instrument, and a phase lands on those.

Run it after the mandatory reading, and again whenever you are about to open a new front — a
second subsystem, the second platform, a long debugging loop.

## Budget arithmetic, at planning time

- **Fixed overhead, before any work.** The standards you must read, plus the plan and
  `CLAUDE.md`. Measure it rather than guessing: `wc -c <files> | awk '{print $1/4}'` is a
  usable token estimate. In repo A the documents measured ~30–35k (2026-09-14). The 60–80k
  this file carried for repo A (2026-08-16) was wrong — byte counts presented as token
  counts — and repo A's adapted copy of this file recorded the disproof on 2026-09-14.
- **Gate output is not free.** A failing build or a race-detector run can dump thousands of
  tokens per attempt, and the debugging loop is where budgets actually die. Leave headroom for
  three or four red runs.

## Signals a phase is too big — split it

- It spans **two platforms, or two subsystems that ship separately**. Each is its own phase;
  the second mirrors the first and inherits its decisions, which is also why it goes second.
- It contains **both a broad audit and an implementation**. Make the audit its own phase, or
  push it into subagents.
- It touches more than roughly **15–20 files**, or more than two or three subsystems — a rule
  of thumb from repo A (2026-08-16), not a measurement.
- **It needs to read a large area to decide where to work.** That reading is a subagent's job.

The seams that keep coming out right, in order: **data layer + reads → writes → shared
contract → first platform's surfaces → second platform + parity → close-out.**

## The relay — subagent budgets

The same stop-and-hand-off rule applies to subagents, but **a subagent cannot measure its own
context**: its transcript is plain streamed text with no token accounting. So its budget is
enforced two other ways.

**By construction — the lead's job.** Give every subagent a bounded, countable work-list:
*these 14 call sites*, *these 6 files*, *this one question*. An open-ended brief ("audit the
market feature") is an unbounded one. Splitting one broad brief into three narrow subagents is
nearly free, and each returns a smaller summary.

**By contract — put this in the subagent's prompt:**

```
Your work-list is <N> items, listed above. Work them in order.

If you reach roughly 2/3 of your budget signals — you have read more than ~25 files, or you
are past item <2N/3> with substantial work left — STOP. Do not start another item.

Instead, make your final output a pass-off prompt for a fresh agent: which items are done and
what you concluded for each, which item you stopped on and how far into it you got, the file
paths that mattered, and the exact remaining list. Write it to stand alone — the next agent
will not see this conversation.
```

The `~25 files` and `2/3` figures are rules of thumb from repo A (2026-08-17), not measurements;
set them to what your subagents are observed to manage.

**Then the lead relays.** A subagent's final text *is* its return value, so a returned pass-off
prompt is a normal result, not an error: spawn a fresh subagent of the same model with that
prompt as its brief, and repeat until the work-list is exhausted — paying only the returned
summary each time. Log each relay in the notes, so the record says the sweep took three passes.

---

# Part 6 — Parallel sessions

The assumption throughout: **several sessions run against this repo at once, and the owner is
the only one who knows which uncommitted file belongs to whom.** With one session per clone
the shared-index rules below fall away; everything else stands.

## Lanes

Lanes and the "Files it owns" collision check are defined with the board in 2.1: lanes run in
parallel, each in its own worktree; items inside a lane run in order; two items naming the same
file never run at once.

## The fresh-checkout recipe — worktree, clone or CI

A fresh checkout fails gates for purely environmental reasons before it fails a real one. Do
all of this on entry, **before believing any gate**:

```bash
{{WORKTREE_SETUP}}
```

Derive that block in Part 0 from what `.gitignore` hides and what the toolchain generates. The
three classes that bite:

- **Gitignored-but-required files** — env files, generated projects and type declarations,
  local config. `git worktree add` does not carry them and the installer does not create them.
  Without them, gates fail naming code you never touched.
- **Dependencies not installed in the checkout** — until they are, an intra-repo package may
  resolve to the *primary* checkout, so a green typecheck proves nothing about your edits and
  a red one may be reporting another session's uncommitted work.
- **Caches shared across checkouts** — a build or lint cache keyed outside the checkout serves
  results analyzed elsewhere.

  > **Worked example — repo A.** A red lint gate reporting 20 forbidden-call findings came back
  > *clean, all at ratchet* when re-run with an isolated cache — the findings belonged to a
  > sibling worktree. Re-run with a fresh cache before believing a red.

**Always go through the repo's own scripts, or the ledger's verified commands.** A bare
invocation of the underlying tool may select a different bundler, runner or configuration than
the script does, and fail in ways that have nothing to do with your change.

## Committing under a shared index

These bind whoever commits — the agent where Part 11 allows it, otherwise the person running
the blocks the agent prints. Two of them — never `-A`, and never `checkout --` or `stash` — exist
because of a shared checkout; the rest hold regardless.

```bash
git add -N <new-path> && git commit -o <path> <path> -m "..."
```

- **`git add -N` first for any file git has never seen.** `--only` silently drops untracked
  paths, and the commit still typechecks, because the files are on disk.
- **Never `git add -A`, never `git add .`**, not even scoped to a directory. It sweeps up
  another session's in-flight work.
- **Commit early, in small slices** — after each leg lands, not once at the end. Do not hold a
  multi-file change across a long gate run.

  > **Worked example — repo A.** A whole feature build was swept into a parallel session's
  > commit while its author was still running gates.

- **Never `git checkout --` or `git stash` to undo an experiment.** Both reach files that are
  not yours. Copy the file aside and restore it with `cp`.
- **After a split commit, build HEAD in isolation before pushing.** Gates run against the
  working tree, not HEAD, so a partial commit can leave the branch unbuildable while your tree
  is green. The archive has none of what the fresh-checkout recipe adds, so that recipe runs
  inside it first (joined with `&&` here). A fresh `mktemp -d` every time: a fixed path collides
  with a parallel session, and `tar -x` over a stale extraction keeps files deleted since, so
  HEAD can look buildable when it is not.

```bash
d=$(mktemp -d) && git archive HEAD | tar -x -C "$d" && cd "$d" && {{WORKTREE_SETUP}} && {{BUILD_CMD}}
```

- **Shell working directory resets between calls in some harnesses.** A relative-path check can
  silently verify the primary checkout instead of your worktree. Use absolute paths for
  anything whose answer depends on which checkout you are in.

## Numbered shared resources

Migrations, ledger steps, fixture ids — anything where two sessions can claim the same number.

**Derive the next number by reading the resource immediately before you use it, never from a
number written in any doc** — including this one. And **read names, not counts**.

> **Worked example — repo A.** `0074` exists twice on disk, so the file count is not the
> highest number; and `0101` was claimed by another project mid-build, after the plan that
> reserved it was written.

## Other shared state

- **A dev server already listening on the port** will be reused by the test runner, which then
  silently tests the previous build. Kill any hand-started one first.
- **A test database pointed at the wrong target** can skip every test and still print `ok`.
  Grep the output for skips rather than trusting the exit code.
- **A warm client reading cache** can make a data fix look unfixed. If the server log shows no
  request, you are reading cache, not the system.

---

# Part 7 — Closing a piece of work

**Every phase and every board item ends the same way, in this order, without being asked.**
The point is that the owner can close the session immediately after: set the stated model,
paste one block, go.

### 1 — Update the record, in the same commit as the code

- **Profile L:** one new ledger step at the next free number (read it, do not trust one written
  elsewhere), naming what changed, why, what is now fixed, and which questions it answered.
  Add new files to the code map. Do not edit a step you did not write.
- **Profile P:** the phase header becomes `**BUILT <date>, commit <hash>**`, plus any deviation,
  discovery or re-ordering this phase forced on later phases; the design gets its `As built:`
  paragraphs; the runtime-pass file gets this phase's entries.
- **Landed early on budget, or interrupted?** Same ritual, different header: leave the item
  unmarked, add a status note — what is done, what is left, what it changes about the plan —
  and write the handoff. The pass-off then targets *the remainder of this item*, not the next
  one. Also write a handoff when work crosses a model boundary. If the owner says stop, stop;
  mid-item is fine.

### 2 — Post three blocks in the hand-back

In the chat — or wherever Part 12 routes the hand-back — not only in the docs: the whole value
is that they are copy-pasteable at the moment the session ends.

- **Block A — the pass-off prompt.** Part 3, in full, as a fenced block. It must stand alone.
- **Block B — the runtime entries this piece added.** The same lines written to the record,
  pasted here so the owner can walk them while the work is fresh rather than finding them in a
  file weeks later.
- **Block C — the next session's model, on its own line.** `Next session: <tier>` — plus one
  clause on why, if it differs from the last. Last in the message, because it is the first
  thing the owner acts on.

### 3 — State plainly what was and was not verified

R10. "Gates green, not seen running" and "walked the flow on the device" are different claims.

## Recording what actually shipped

**Every deviation from the design is written back under the decision it deviates from** — not
as a changelog at the bottom, not in a commit message, but inline where someone reading that
decision will hit it. This is the anti-drift mechanism, and it is the single habit that
separates documentation you can trust from documentation you cannot.

Record equally: when the design left a choice open and the build picked one; when the build
found the design's premise wrong; and when a scope item was dropped. Also refresh the live
numbers — the next free number, the headroom consumed, any dial that got a real value.

## The runtime pass

**Each piece of work writes its own runtime entries as it goes**, and pastes them into the
hand-back at close (Block B). Not reconstructed later — reconstructed checklists are written
weeks after the work, from open ledgers, and one of repo A's had to hand-write queries to find
its own fixtures because no phase had pinned one.

An entry is three lines:

- **Goal it is checking** — what behaviour should now be true, in product terms.
- **Where** — the exact screen, on every platform, and how to reach it.
- **What the right answer is** — including the fixture. If the check needs specific data, give
  the query that finds it, not an id that will rot.

The owner walks the pass. **It does not block the work or the close-out.** What it blocks is
*claiming* something was seen working when it was not.

Findings from a pass fold back as a new item, not as ad-hoc fixes.

## Archiving (Profile P)

When every phase is checked off:

1. **Grep for referrers first** — `git ls-files | xargs grep -l <filename>`. Split them into
   paths *read at runtime* (CI commands, scripts, lint globs) and *bare citations in prose*.
   Only the first kind blocks the move.
2. Commit the folder in its final state, so the repo records how it ended.
3. Move it to `{{ARCHIVE_HOME}}/<slug>/`. **Verify each file actually arrived before trusting
   the deletion** — one commit in repo A deleted five docs and archived three, while the index
   went on citing all five as live.
4. Add the one-line archive index entry: topic, what it was, last commit, date verified.
5. Update the docs index — out of `incomplete/`, into the archive list.
6. **Anything the doc leaves behind that still governs the code** moves to "Standing rules that
   outlived their doc" (8.3). A rule nobody can find is a rule nobody follows.
7. Update the memory entry (Part 10) with the final state and what was left owed.

## Folding (Profile L)

A ledger and a board only ever grow, and the ledger is read in full at the start of every
session. That makes their size a Part 5 problem rather than a tidiness one: left alone for a
few months they become the largest thing a session reads, ahead of any code.

Two things in them are already dead by this standard's own rules, and folding means moving
those two to `{{ARCHIVE_HOME}}` and nothing else.

1. **A `DONE` item's prompt.** §2.1 already says it rots the moment it is executed and that
   the ledger step is the record. The row stays, with its pointer; so do the sections under
   `SUPERSEDED` and `SETTLED AS NO`.
2. **A ledger step's body**, for every step but the most recent twenty or so. **The number,
   the title and the date stay, as one line.** That is not politeness. Steps are addressable
   forever, so a fold that dropped the number would break every `DONE — <step>` on the board
   and every citation in every other document, and would hand the next session a number the
   log had already spent.

Standing sections — Environment, Settled, the code map, the invariants — are never folded.
They are edited in place when they go stale, which is what makes them the part that carries
truth forward while the log carries history.

**The order is the whole of the safety argument, and it is step 3 above applied to text:
append to the archive, read it back, and only then cut.** A ledger and a board are routinely
untracked — they are personal process rather than part of the repo — so git is holding no copy
of what is about to be deleted.

What says it is time is not a feeling but arithmetic: what a fold would remove, measured
against the ceiling of whatever tier reads these files (Part 5).

> **Worked example — the repo this standard ships from.** Its board carried 62 rows in 65
> lines and 3,794 lines of prompts beneath them, every row already closed; its ledger carried
> 77 steps in 5,168 lines. The two were ~168k tokens together — more than half a Default
> session's runway before a line of code was read, and past the Deep tier's landing threshold
> outright. Folding both took them to ~49k and changed no row and no step number
> (measured 2026-09-23).

**This standard applies forward from the date it is adopted.** Work archived before then is a
historical record, not a conversion target: reshaping it to match a standard written after it
neither makes it truer nor easier to trust. What an archive owes a reader is **accurate
pointers, not a uniform shape** — an index entry that exists, a path that resolves, a status
sentence that was honest when written. Do not retrofit.

---

# Part 8 — Doc craft

## 8.1 The code standard

One file per language or platform, and **the file extension decides which applies**. Each is
**self-contained** — applyable without reading anything else — and says so in its first lines.

- **Every rule gets an ID and is written so a reader can look at a file and say definitively
  whether it complies.** `A1`, `R3`, `F8`. IDs are how other docs, commit messages and lint
  justifications cite rules; **never renumber them**.
- **Every rule carries an enforcement tag.** *lint* (a linter catches it) · *gate* (a repo
  checker catches it) · *CI* (a job catches it) · *review* (nothing catches it — it rots
  without discipline). The tag tells a reader whether a clean run means anything.
- **One correct/incorrect pair per rule**, as real code from this repo, not invented.
- **Provenance labels where a rule is a choice:** *[STANDARD]* canonical for the ecosystem,
  source cited · *[COMMON]* widespread, alternatives named · *[OURS]* our preference, justified
  on its own terms. This is what stops a later agent "correcting" a deliberate house call.
- **Where a formatter or linter settles something, the config is the rule and prose says
  nothing.** A short standard for a language with strong tooling is not missing rules; it is
  correctly scoped. Say that explicitly, or someone will pad it.
- **A sanctioned divergence registry**, where two platforms or two subsystems mirror each
  other. List every sanctioned difference in a table and state that **anything not on the list
  is drift and must be fixed**. Additions need a recorded reason.
- **Where two standards contradict each other on purpose, say so, in both**, and name the rule.

## 8.2 The docs index

One index file, organized **by status first** (is there open work?) then by topic. Every doc in
the tree has a line in it: what it is, whether it is current, and the date last verified. A doc
with no index line is invisible; an index line pointing at a moved file is worse than none.

Mark explicitly which docs are *not* kept current between passes — a stale roadmap that says it
is stale is usable; one that does not is a trap.

## 8.3 Standing rules that outlived their doc

A section in the index for rules that are still true of the code after their project closed.
They live here rather than in the archive, because **a rule nobody can find is a rule nobody
follows**. Each is one paragraph: the rule, why it exists, and the archived doc it came from.

## 8.4 Prose rules for all of it

- R1, R2 and R5 apply to every sentence in every doc: absolute dates, citations, disproofs
  recorded in place. Docs are append-and-amend, not rewrite.
- State what is true, flatly. Reserve "should" for things that are not yet true.
- Write the counter-argument down next to the decision it lost to. Unrecorded, it returns in
  three weeks as a new objection.

---

# Part 9 — `CLAUDE.md`

The file every session receives whether it asks or not — `CLAUDE.md` in Claude Code,
`AGENTS.md` or the equivalent elsewhere; the shape is the same. It is a **router and a hazard
list**, not a second copy of the standard. Keep it short enough that its cost is worth paying
on every single session.

```markdown
# <repo>

> **Before writing or editing any code, read the matching standard in full —
> `<path>` for <lang>, `<path>` for <lang>. Not optional, not conditional on task size.
> If you have not read it this session, read it now.**

> **Before scoping, planning or building a feature, read `<path to this standard>`.**
> It is the process standard. Do not ask how the flow works; it is written down.

## The rules that get broken

<The 5–10 rules that are actually violated here, restated in full and binding on their own.
Each says what to do instead. This list is not the standard — it is the subset that has been
broken enough times to earn a place in every session's context.>

## Stack

<Runtimes, frameworks, data layer, auth, payments — one line each, versions where they matter.>

## Architecture

<The 3–6 structural facts a session must not violate: what talks to what, where the entry
point is, what does not exist and must not be created.>

## Directory map

| Path | Belongs here | Does not |
|---|---|---|

## Commands

<Package manager. Dev servers. Then the gates, as fenced one-command blocks, each verified by
running it. Then the notes about gates that lie — what makes each one green when it should be
red, and what proves which tool actually ran.>

## Never do this

<The specific, expensive, repo-local traps. Each one a single line starting with a verb, each
earned by a real incident.>
```

**Two layers.** A user-level `CLAUDE.md` carries what is true of *you* across every repo — the
owner policy in Part 11, plus personal tooling. The repo's `CLAUDE.md` carries what is true of
*this codebase*. Do not duplicate one into the other; when they conflict, say in the repo file
which wins.

---

# Part 10 — Agent memory

Where the harness offers persistent memory, keep it to **one fact per file**, indexed by a single
file whose lines are hooks, not content. In Claude Code that is a directory of markdown files in
the shape below, indexed by `MEMORY.md`; another harness has its own shape, and the rules under
the template apply to it as they stand.

```markdown
---
name: <short-kebab-case-slug>
description: <one line, used to decide relevance during recall>
metadata:
  type: user | feedback | project | reference
---

<the fact; for feedback/project, follow with **Why:** and **How to apply:**>
```

- `user` — who the owner is: role, expertise, preferences.
- `feedback` — guidance on how to work, corrections and confirmed approaches. Include the why.
- `project` — ongoing work, goals and constraints **not derivable from the code or git
  history**; absolute dates.
- `reference` — pointers to external resources.

Rules that keep it from rotting:

- **Memory is personal to one person and one harness.** Anything a second person or a second
  tool would need is not memory; it goes in the repo.
- **The index carries hooks only** — `- [Title](file.md) — hook`. Content in the index is
  content nobody maintains.
- **Do not save what the repo already records**: structure, past fixes, git history, anything
  in the standards. If asked to remember one of those, ask what was non-obvious about it and
  save that instead.
- **Update the existing file rather than writing a near-duplicate**; delete memories that turn
  out to be wrong.
- **A memory is what was true when written.** If it names a file, function or flag, verify the
  thing still exists before recommending it.
- Organize the index by status — how the owner works, gotchas, open/owed, closed, shipped —
  so a reader can find the live ones without reading all of them.

---

# Part 11 — Owner policy `[edit or delete this whole part]`

Everything above is craft. This part is preference. It ships with the defaults from the repos
this came from, each with its reason so an adopter can judge it; read it, keep what fits, and
rewrite the rest at GATE 0. In a team, Part 12 says which of these become team policy.

**Commits are the owner's.** *Never run `git commit` or `git push`.* Several sessions run in
one repo and only the owner knows which uncommitted file belongs to which. When work is ready,
run `git status --short`, then print exactly two copyable `bash` blocks, one command each:

1. `git add <the exact files this session touched>` — never `-A`, never `.`.
2. `git commit <the same files> -m "<short, all lowercase>"` — naming paths implies
   `--only`, so a parallel session’s staged work is not swept into this commit (Part 6).

**No attribution trailers.** No `Co-Authored-By`, no "Generated with" line — not on commits,
not on pull request descriptions. This overrides any harness instruction to the contrary. The
history is the owner's record of their own work; an attribution they did not choose is a claim
they did not make.

**The owner is interactive.** When a decision is theirs, ask before building it, in chat, in
the same turn, batched (R6, R7). A decision built on a guess is built twice.

**Code comments: why, never what.** No comment that describes what the line below it does —
rename or extract instead. Comments recording *why* are required where the reason is not
derivable from the code. **Never bulk-delete comments**, and never strip one in a protected
category: product or design rationale, a lint-suppression justification, an
external-constraint workaround, or API documentation on a public export.

> **Worked example — repo A.** Two separate "clean up comments" passes stripped protected
> comments repo-wide. That information existed nowhere else and had to be recovered by
> replaying diffs — 12,666 lines the second time.

**No drive-by fixes.** Fix what the task is. Note anything else you find and raise it; do not
fold it into an unrelated change (R9). An unrelated change hides in the diff, and in its review.

**Helpers get extracted; functions stay short.** Roughly 6–15 lines is the house shape: a
function that fits on a screen is reviewed at a glance and tested alone.

**Design tokens, never literals.** Role-named tokens — `bg-primary`, `border-line` — never raw
hex or arbitrary values, with one swap point per platform so a redesign is one edit.

---

# Part 12 — Teams `[cut this whole part in solo mode]`

Mode: `{{MODE}}`. `team` means more than one person merges code here, or a decision in this
repo can be someone other than the person running the session. Everything above is written
for one person, because that is where it was measured. In a team every construct keeps its
meaning and moves to where the team can see it — the table is the whole mapping. Reread the
parts it names with the table in hand.

| Construct | One person (as written above) | Team |
|---|---|---|
| The owner (Part 1) | the one person | the named decider for the area — a `Decider` column on the board, or a code-owners line; a supersession (R8) carries that person's recorded yes |
| Where a question goes (R6, GATE 1, GATE 2) | the chat, same turn | the chat if the decider is in the session; otherwise one batched comment on the item in `{{TRACKER}}`, and the work stops there until it is answered — never a doc, never a direct message |
| Where an answer is recorded | the doc, same turn | the same doc, plus a link from the item; the doc is still the truth |
| The board (2.1, or the plan's phases) | a file | `{{TRACKER}}`: one item per task carrying prompt parts 1, 4, 5 and 8; lane is a label or a project field; "Files it owns", "Waits on" and "Decider" are fields on the item |
| The ledger (2.1) | `HANDOFF.md` | unchanged — a file in the repo; a pull request links to its step and never replaces it |
| BUILT → MERGED (2.3) | the owner commits | a branch and a pull request; its description is prompt parts 4, 5 and 9 plus R10's exact claim; "gates green" means the pull request's checks, and a skipped job is not green |
| Review (Part 4) | the gates, the runtime pass, and a Deep review where Part 4 calls for one | a person reads every path the standard tags *review* and every Deep-tier path before merge; agent-written code gets no exemption |
| The hand-back (Part 7 §2) | three blocks in the chat | Block A into the next item, Block B onto this item, Block C in the next item's header |
| The runtime pass (Part 7) | the owner walks it | someone who is not the author walks it; the entries live on the item |
| An out-of-scope finding (R9, Part 11) | noted in the hand-back | a new item with the citation, linked from the hand-back |
| Numbered shared resources (Part 6) | read before write | read before write, and rebase onto the default branch before the pull request opens |
| The fresh-checkout recipe (Part 6) | worktree setup | doubles as onboarding; secrets are per person and never in a doc an agent commits |
| Memory (Part 10) | personal | personal only — anything a teammate would need lives in the repo, or it does not exist |
| Part 11 | the owner's policy | the team's: who may commit, who merges, whether agent commits carry a trailer — decided at GATE 0 and written into Part 11 |

Three things that exist only in a team:

- **The decider is written down per area before the first item runs.** An item with no
  decider is not ready.
- **The item is the unit of visibility.** Nothing — a question, a finding, a hand-back — lives
  only in a session's chat. *Test:* every question and every hand-back is on an item.
- **A pull request states what was verified, in R10's words**, and a review that finds the
  claim overstated blocks the merge.

---

# Appendix A — Placeholders

| Token | Meaning | How to derive it |
|---|---|---|
| `{{DATE}}` | Adaptation date | `date +%F` |
| `{{MODE}}` | `solo` or `team` (Part 12) | Ask at GATE 0 |
| `{{DOCS_HOME}}` | Where project folders go (Profile P paths only) | The directory that already holds design docs; `docs/` only if there is none |
| `{{ARCHIVE_HOME}}` | Where closed work goes | A sibling directory or repo outside this one, or an in-tree folder such as `docs/archive/`. Always a path — it is interpolated into one |
| `{{TRACKER}}` | Where items and decisions are visible to the team | Cut with Part 12 in solo; else the tracker and board, named |
| `{{MODEL_DEEP}}` | The deep-reasoning tier | Ask at GATE 0; it changes with releases |
| `{{MODEL_DEFAULT}}` | The default tier | Ask at GATE 0 |
| `{{MODEL_FAST}}` | The mechanical tier | Ask at GATE 0 |
| `{{DATE_MEASURED}}` | The date of the measurement Part 5's table carries | `2026-08-16` if you inherit it; the date you re-measured if a tier's model changed |
| `{{WORKTREE_SETUP}}` | Fresh-checkout recipe | `.gitignore` + what the toolchain generates + install |
| `{{BUILD_CMD}}` | Build, for the HEAD-isolation check | From the gates you verified in 0.1 |

Gate commands, hazards and the directory map are not placeholders — they are discovered in 0.1
and written straight into `CLAUDE.md`.

# Appendix B — What adaptation produces

```
CLAUDE.md                     router + hazards, every session reads it
docs/AGENT-PRACTICES.md       this file, adapted, placeholders filled, Part 0 deleted
docs/conventions-<lang>.md    per-language standard (8.1) — may already exist
HANDOFF.md  PASSOFF.md        Profile L
docs/incomplete/<slug>/       Profile P: SCOPE → DESIGN → PLAN → RUNTIME-PASS
docs/README.md                the index (8.2) once there is more than one doc
```

**First real session after adopting this:** read `CLAUDE.md` and this file, take one small item
end to end, and run Part 7's close-out on it. The ritual is what makes the rest hold; a repo
that adopts the documents without the close-out has adopted nothing.
