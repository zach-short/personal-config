# DESIGN — `personal-config upgrade`: ship the delta, not the text

**Status:** `RATIFIED`. Opened 2026-09-23 as `SCOPE.md`; **GATE 1 completed 2026-09-23** and
renamed the same day. Owner: Zach. One repo — `personal-config`.

**Why this exists.** Item B of the upgrade audit of 2026-09-23. Item 68 makes an adapted file
visible again — it keeps its stamp, so its standard version is readable and `doctor` reports it
when it falls behind. This item is what a person does *next*: a command that says what changed
between the standard they adapted and the standard they have, in a form a fresh session can act
on. Without it, the answer to "your standard is two versions behind" is still "read
`standard/CHANGELOG.md` in a repo you may not have cloned, and work out what it means for a
document an agent rewrote".

**Hard dependency.** Item 68's D1. Until an adapted file carries a stamp, this command has
nothing to read (U7). It must not ship first.

**How to read this.** §1 is ground truth, dated and cited. §2 is the non-scope list. §3 is the
frozen decisions `D1…D4` — **from here this document changes by amendment only**: a new dated
`D<n>`, a dated supersession naming what it replaces, or an `As built:` note. Never by editing
a decision in place. §4 keeps the options as they were written *before* the decisions. §5 is
the dials, §6 the hazards, §7 the GATE 1 record.

---

## 1. What exists, verified 2026-09-23

| # | Claim | Verified state | Citation |
|---|---|---|---|
| U1 | The standard's changelog ships inside the package | `standard/CHANGELOG.md`, 8.5kB, in the tarball. So the delta is readable at runtime with no network call | `npm pack --dry-run`, 2026-09-23 |
| U2 | The CLI's own changelog does **not** ship | `package.json` `files` lists `dist`, `src`, `catalog.json`, `standard`, `templates`, `profiles`, `docs/choices`. The root `CHANGELOG.md` is absent from the tarball | same run; `package.json:27-35` |
| U3 | Only the **current** boilerplate ships | One `standard/AGENT-PRACTICES.boilerplate.md`, 66.7kB. No prior version is packaged anywhere | same run |
| U4 | Both changelogs use one heading shape | `## <version> — <date>`. The standard's holds six entries, 1.0.0 through 1.2.0 | `grep -n '^## ' standard/CHANGELOG.md` |
| U5 | The installed package directory is always reachable at runtime | `repoRoot()` walks up to the nearest `package.json`, which resolves correctly for a checkout and for the bundled `dist/cli.js` | `src/lib/paths.ts:77-86` |
| U6 | A configured repo records where its standard lives | `standardPath` in `.personal-config.json`, written by the renderers and read back by `readStandardPath` | `src/render/repo.ts:350`, `src/lib/repo-config.ts:33` |
| U7 | An adapted standard carries no version, until item 68 lands | §0.8 deletes the stamp and greps to prove none survive; D1 replaces that with a marker that keeps it | `templates/PART0-PROMPT.md:59-66`; `docs/incomplete/stamp-provenance/DESIGN.md` D1 |
| U8 | One version comparator exists in `src/`, and it is private | `isOlder`, inside the drift rule. Nothing else compares versions; `grep -rn "split('\.')" src/` matches only it | `src/doctor/rules/stamp-drift.ts:38-46` |
| U9 | `doctor [path…]` is the precedent for a path-taking command | `cli.paths.map(expandHome)`, falling back to `process.cwd()`, looping per root | `src/doctor/index.ts:104-116` |
| U10 | `passoff` is the precedent for reading and editing a target's board | Parse, preview, confirm, commit, undo — and it refuses outright when the file changed between its read and the plan's re-read | `src/commands/passoff.ts:170-176` |
| U11 | Nothing appends a **new** board item | `src/lib/board.ts` exports a parser, cell readers and `withStatus`; no row writer. `passoff claim` edits one status cell and inserts one blockquote | `grep -n '^export' src/lib/board.ts` |
| U12 | A prompt written as a file into the target is an established shape | `PART0-PROMPT.md` — rendered, stamped, previewed, and added to the ignore list in tracked mode | `src/render/repo.ts:391`, `templates/PART0-PROMPT.md` |
| U13 | The short standard has no Part 0 and is never adapted | "It has no Part 0 — nothing in it is left for a later session to fill". So it keeps its stamp, and a plain `setup` re-run already upgrades it | `src/render/short-standard.ts:27`, `src/render/repo.ts:414-418` |
| U14 | A `light` track writes no board at all | `hasBoard` is `weight === 'full'` | `src/render/context.ts:98-100` |
| U15 | The command set is an allowlist in two files | `COMMANDS` in `args.ts` and `DISPATCH` in `cli.ts`; an unknown command prints to stderr and exits 1 | `src/lib/args.ts:5-18`, `src/cli.ts:55-80` |
| U16 | "Nothing leaves your machine" is a documented promise with exactly two exceptions | `gh api user`, and the fetch behind `setup --from <url\|id>` | `README.md:120-123` |
| U17 | The standard's version and the CLI's move independently, deliberately | "They move independently, so they get one check each — a single check spanning both would assert a rule the repo rejects" | `tests/version-coupling.test.ts:8-11` |
| U18 | A changelog entry for the standard is already written as an instruction, not a summary | 1.2.0's entry names the section to add, where it goes beside, what leaves and what never does, and the two consequences in §2.1 | `standard/CHANGELOG.md:10-34` |
| U19 | Two adapted copies were hand-stamped by a person, not by the tool | Board rows 4 and 18: "stamp **v1.0.0**, not v1.0.2 — Zach's wording call" | `PASSOFF.md:14`, `PASSOFF.md:28` |

---

## 2. What this is / what this is not

**This is:**

1. A command that reads a target's adapted standard version, compares it to the installed one,
   and reports the difference as something a session can act on.
2. The shared version helper that comparison needs, which `doctor` also already wants (U8).
3. Its documentation, and its line in the two command allowlists (U15).

**This is not:**

- **Item 68.** This depends on it and must ship after it. Nothing here re-opens D1–D4.
- **Applying the delta.** The command writes the ask; a Part 0-style session does the work.
  Nothing here edits an adapted document.
- **A network call.** U16's promise holds. An option that needs one is refused on that ground
  alone, not weighed against it.
- **A three-way merge of prose**, for the reason the stamp-provenance design already gives: the
  adapted copy is a document an agent rewrote against one repo, and a textual merge of that is
  garbage.
- **The short track** (U13). A short-standard repo is never adapted, keeps its stamp, and is
  already upgraded by re-running `setup`. The command must say so rather than inventing work.
- **Upgrading the CLI itself.** That is `npm`'s job. The one thing owed here is the README's
  `npx personal-config setup`, which hands a repeat user whatever `npx` cached — a one-line doc
  fix that belongs to whichever item touches that section.
- **A new wizard question**, and so no `docs/choices/*.md`.

---

## 3. Decisions — ratified 2026-09-23

**D1 — The command prints to stdout by default and writes a file under `--write`.**
`personal-config upgrade [path…]` prints the version gap and the changelog entries between.
`--write` additionally produces `UPGRADE-PROMPT.md` at the target's root, through `planned()`
like every other generated file: stamped, previewed, confirmed, undoable, on the ignore list.
*Defense:* the default for a question is not a write, and this command's first use is "is there
anything to do in this repo?" — run across many repos, E-2 would leave a file in each. The
write exists because an upgrade prompt is the long kind and terminal scrollback is where long
prompts get half-copied. Both shapes have a precedent: `passoff next` prints, `PART0-PROMPT.md`
is written (U10, U12).
*Accepted cost:* two output paths to keep in step and to test, and `--write` will be the flag
nobody remembers.
*Rejected:* E-3, appending a board item — the board is unlocked, no allocator exists for item
numbers (H3, H4), and a `light` repo has no board at all (U14). Ratified 2026-09-23.

**D2 — The delta is the shipped changelog, sliced between the two versions.**
Read `standard/CHANGELOG.md` from `repoRoot()` (U5), take every entry above the stamped version
up to and including the installed one, newest first (DIAL-4).
*Defense:* it ships (U1), it parses on one heading shape (U4), and its entries are written as
adaptation instructions rather than as release summaries (U18). No network, so U16's promise is
untouched.
*Accepted cost:* the command's usefulness is the changelog's quality, and nothing tests that. A
release that forgets an entry produces a confident, empty prompt.
*Closed, not weighed:* S-2, a textual diff of the boilerplate. Only the current version ships
(U3), so it needs bundled history or a fetch, and the fetch is refused on U16 rather than
traded against. Ratified 2026-09-23.

**D3 — It reports on the adapted standard, and nothing else.**
Where a target has no adapted standard — never configured, or a short track — one clear line
and exit 0 (DIAL-5).
*Defense:* the standard is the only artifact with a per-file version, a changelog written for
it, and no other upgrade path. The other two categories already have answers: a stamped file is
re-rendered by `setup`, and item 68's D2 makes `doctor` say which. Two commands reporting the
same thing is worse than one reporting half.
*Accepted cost:* someone asking "what do I do to be current?" gets a partial answer and has to
know that `doctor` gives the rest. The command's own output should say so.
*Rejected:* P-2, because the CLI's changelog is developer-facing release prose and pasting it
into an adaptation prompt invites a session to "adapt" a document to an argument-parser fix;
and it would re-assert a coupling between the two version lines that U17 records as
deliberately rejected. Ratified 2026-09-23.

**D4 — The version comparator moves to `src/lib/semver.ts`, and the drift rule is rewired onto it.**
*Defense:* two callers is the point at which it stops being one rule's private business, and L2
puts pure logic in `src/lib`. The comparison this command needs — *which versions lie between
these two* — is the same ordering `isOlder` already implements, and "is 1.10.0 older than
1.9.0" is exactly the question that gets answered differently in two places.
*Accepted cost:* it touches `src/doctor/rules/stamp-drift.ts`, which item 68 also owns. The two
items are serialized on the board for that reason as well as for H1. Ratified 2026-09-23.

### Rules that survive unchanged

- **U16's promise.** Two network calls exist and this command adds none.
- **The two version lines stay independent** (U17). Nothing here couples the CLI's version to
  the standard's.
- **No adapted document is edited by this command** (DIAL-7). It writes an ask; the session that
  acts on it bumps the stamp.
- **`package.json`'s `files` is not changed.** That was P-2's requirement, and P-2 was rejected.
- **No new wizard question, and no `docs/choices/*.md`.**
- **Item 68's D1–D4 are not re-opened.** This item consumes them (R8).

---

## 4. Options, as written before the decisions

### Group E — what the command emits

**E-1 — stdout only.**
Print the version gap and the changelog entries between, the way `passoff next` prints an item
and its prompt.
*Defense:* read-only by construction, so it can be run anywhere, in a loop, over several repos,
with nothing to undo. Matches the one existing command that hands a person a prompt (U10).
*Strongest argument against:* an upgrade prompt is the long kind — five changelog entries plus
the framing that makes them actionable — and terminal scrollback is where long prompts get
truncated, half-copied and pasted with the first paragraph missing.

**E-2 — write `UPGRADE-PROMPT.md` into the target.**
The exact analogue of `PART0-PROMPT.md` (U12): rendered, stamped, previewed, confirmed,
undoable, added to the ignore list.
*Defense:* the shape already exists and is understood; a file survives the terminal, and the
next session opens it by name rather than by scrollback.
*Strongest argument against:* it makes "is there anything to do here?" a command that writes to
your repo. Run it across twelve repos to check, and you have twelve new files to clean up — and
the honest default for a question is not a write.

**E-3 — append a new item to the target's board.**
An `OPEN` row plus its prompt section, in the board the repo already keeps.
*Defense:* it lands in the file the repo's own process says work lives in, and it arrives
already carrying a lane, a model and a files-it-owns cell.
*Strongest argument against:* nothing writes a board row as of 2026-09-23 (U11), and the board is the one
file every parallel session reads with nothing locking it. Picking a free item number is a race
with no `nextFreeStep` equivalent to lose it safely (H5) — and a `light` repo has no board at
all (U14).

**E-4 — stdout by default, `--write` for the file.**
E-1 as the default, E-2 behind a flag.
*Defense:* the default stays a question, and the write is there for the case E-1 is bad at.
Both paths already have a precedent in this codebase.
*Strongest argument against:* two output paths is two things to keep in step and two things to
test, for a command whose whole job is small — and the flag will be the one nobody remembers,
so the truncated-scrollback failure happens anyway.

### Group S — where the delta comes from

**S-1 — the shipped changelog, sliced between the two versions.**
Read `standard/CHANGELOG.md` from `repoRoot()`, take the entries above the stamped version and
up to the installed one.
*Defense:* it ships (U1), it parses on one heading shape (U4), and its entries are already
written as adaptation instructions rather than as summaries (U18). No network, no history.
*Strongest argument against:* it is prose maintained by hand, so its quality is the thing the
command depends on and nothing tests. An entry written badly — or a release that forgets one —
produces a confident, empty prompt.

**S-2 — a textual diff of the boilerplate between the two versions.**
*Defense:* the diff cannot be out of date with the file the way a changelog entry can.
*Strongest argument against:* impossible as packaged. Only the current boilerplate ships (U3),
so this needs either every prior version bundled — 66.7kB each, six of them so far — or a fetch
from GitHub, which U16 rules out. It is listed to be closed, not weighed.

**S-3 — changelog prose, plus a re-render comparison of the files still stamped.**
S-1 for the adapted document, and item 68's D2 machinery for everything that was never adapted.
*Defense:* one command answers the whole question — what to re-adapt by hand, and what a
`setup` re-run would fix on its own.
*Strongest argument against:* it welds this command to 68's implementation rather than to its
output, so the two cannot be built or released independently — and `doctor` after 68 already
reports the second half. Two commands saying the same thing is worse than one saying half.

### Group P — how much it reports on

**P-1 — the adapted standard only.**
*Defense:* it is the only artifact with a per-file version, a changelog written for it, and no
other upgrade path. Everything else has an answer already: stamped files are re-rendered by
`setup`, and 68's D2 makes `doctor` say which.
*Strongest argument against:* a person who asks "what do I need to do to be current?" gets a
partial answer, and has to know to run two other commands to get the rest.

**P-2 — the standard, plus what changed in the CLI.**
Needs `CHANGELOG.md` added to `package.json` `files` (U2).
*Defense:* "upgrade gracefully" includes knowing what the tool itself started doing differently,
and the cost is one line and ~44kB.
*Strongest argument against:* the CLI changelog is developer-facing release prose, not
instructions for a repo — and pasting it into an adaptation prompt is how a session ends up
"adapting" a document to a bug fix in the argument parser.

**P-3 — the standard, plus every generated file that would now render differently.**
*Defense:* the complete answer to the question actually being asked.
*Strongest argument against:* it is S-3's coupling plus a second noise source, and it makes this
command the thing that must be kept in step with every renderer — for a report `doctor` already
produces.

---

## 5. Dials

| # | Dial | Recommended default | Why |
|---|---|---|---|
| DIAL-1 | Invocation | `personal-config upgrade [path…]`, mirroring `doctor` | U9 is the established shape for a command that inspects targets; cwd when no path is given |
| DIAL-2 | Stamped version **newer** than installed | Report it and stop, naming the package update | It means a cached `npx` copy; guessing a delta backwards would tell them to undo a change |
| DIAL-3 | Exit code when an upgrade is available | 0 | It is information, not a defect — the same reason 68's D4 exits 0 for the drift finding this command answers |
| DIAL-4 | How many entries when several versions behind | All of them, newest first | A skipped middle version is a skipped instruction; the standard has six entries total (U4) |
| DIAL-5 | A target with no adapted standard — never set up, or short track | One clear line, exit 0 | U13: a short-track repo has no adaptation and needs none |
| DIAL-6 | Where the file goes, if E-2 or E-4 wins | Repo root beside `PART0-PROMPT.md`, and on the ignore list | U12; the ignore list already names that file in tracked mode |
| DIAL-7 | Who bumps the stamp after the delta is applied | The session that applies it, not this command | This command writes an ask and touches no adapted document (§2) |
| DIAL-8 | Where the version comparator lives | **Decided 2026-09-23 (D4):** a new `src/lib/semver.ts`, with the drift rule moved onto it | U8: it is private in a doctor rule, and two callers is the point at which it stops being one rule's business |

---

## 6. Hazards this work walks into

- **H1 — Ordering.** Item 68's D1 is a hard dependency (U7). Shipping this first produces a
  command that reports "not adapted" for every repo that is adapted.
- **H2 — S-2 is not merely expensive, it is blocked** (U3, U16). Any design that reaches for an
  old boilerplate has to bundle history or break the network promise.
- **H3 — The board is unlocked** (U10, U11). E-3 inherits `passoff`'s whole problem and adds
  item-number selection on top.
- **H4 — Item numbers have no allocator.** `ledger.ts` has `nextFreeStep`; the board has no
  equivalent, and two sessions appending at once would both pick the same number.
- **H5 — The prompt this writes must itself pass `doctor` in the target.** R1 absolute dates, R2
  citations. A command that writes a file its own checker flags is a bad joke.
- **H6 — Hand-stamped copies exist** (U19). Two repos carry a standard version a person typed,
  chosen deliberately over the version the tool would have written. The command reads those the
  same as any other, which is correct, but it means a version in a stamp is not proof the tool
  put it there.
- **H7 — U17.** The two version lines are independently versioned on purpose. Any option in
  group P that reports both must keep them visibly separate, or it re-asserts the coupling the
  repo rejected.
- **H8 — X2 and S1.** Every test writes inside a temp directory with `$HOME` redirected; no
  personal strings in `src/` or `templates/`.

---

## 7. GATE 1 — asked and answered 2026-09-23

Four questions, one batch, in chat. Every answer took the marked recommendation.

| Asked | Answer | Recorded as |
|---|---|---|
| What does the command emit — E-1, E-2, E-3, E-4? | **E-4**, stdout with `--write` | D1 |
| Where does the delta come from — S-1 or S-3? | **S-1**, the shipped changelog | D2 |
| How much does it report on — P-1, P-2, P-3? | **P-1**, the adapted standard only | D3 |
| DIAL-8 — a shared comparator, or its own? | **`src/lib/semver.ts`**, drift rewired onto it | D4 |

**Still open, deliberately:** nothing. The item is ratified and waits only on item 68.
