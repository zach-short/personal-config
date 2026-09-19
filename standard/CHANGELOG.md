# Standard changelog

The version of the working standard — `AGENT-PRACTICES.boilerplate.md`, and from 1.1.0 its short
form `AGENT-PRACTICES.short.md` beside it. One number covers both: a stamp records the standard's
version and not which document a file was rendered from, so the two cannot be versioned apart.
The CLI that renders them is versioned separately (see the root `CHANGELOG.md`). An adapted copy
in another repo carries the version it was adapted from; `personal-config doctor` reports a copy
whose stamp is older than `standard/VERSION`.

## 1.1.0 — 2026-09-19

One document added. Nothing in the long one changed but its version line.

- **`AGENT-PRACTICES.short.md`, the short form**, for work that is not code and for anyone who
  chose the lighter setup. Written for its reader rather than cut from the long one: the twelve
  rules of Part 1 kept under their own numbers, translated where they spoke of diffs and greps;
  the ledger, the pass-off prompt, the close-out ritual and the context budget in a paragraph
  each; **a proof line in place of the gates** — the owner's own test of what makes work here
  sound, which is what "done" means on a track that has no test suite; and a preferences section
  written from the same answers Part 11 is. It has no Part 0: every slot is filled at render time,
  and its first-session instructions are a section of the document itself, deleted once run. Two
  sections are conditional — the board, present only with the whole method, and the git rules,
  present only where the work is kept in git. Under 200 lines by design, so a session pays a
  tenth of what adopting the long one costs.
- **Which document a setup gets** is decided by two answers and never by a name: *other work*
  or *lighter* gets the short form; *code* with *the whole method* gets the long one, unchanged.

## 1.0.3 — 2026-09-16

One correction. No rule changed.

- **Part 5's fixed-overhead figure.** 1.0.2 dated "60–80k (repo A, 2026-08-16)" from the
  archived document the number came from — and repo A had already disproved it on 2026-09-14:
  its adapted copy records 60–80k as the files' byte counts presented as token counts, and
  measures the documents at ~30–35k. The bullet now states the measured figure and keeps
  60–80k findable, marked wrong, with the disproof beside it (R5).

## 1.0.2 — 2026-09-15

Corrections from the 2026-09-15 standards review (sixteen findings). One test line widened;
nothing else a rule requires changed.

- **R1’s *Test:* grep** now also matches `tomorrow`, `currently`, `last year`, `this year` and
  `(days|weeks|months) ago`. The rule’s first sentence already forbade every one of them; only
  the test was narrower than the rule, and `doctor` had been narrowed to the stated test to match
  it (board item 6, 2026-09-15). The `relative-dates` rule widens with it.
- **A glossary** after "What this is" defines ledger, board, profile, mode and tier before the
  Map uses them. They were first defined in Parts 2, 4 and 12, hundreds of lines in.
- **"How to use it"** says that a copy placed by an installer comes with a prompt naming which
  Part 0 steps are done, so a rendered copy no longer gives two instructions in its first twenty
  lines.
- **Part 9** no longer says Profile L’s Commands section points at the ledger instead of listing
  the gates. §0.5 and the template both say the gates go in as fenced blocks; the sentence was
  the odd one out.
- **Part 6’s split of the shared-index rules** names the two that exist because of a shared
  checkout — never `-A`, never `checkout --` or `stash` — instead of "the first four", which
  miscounted: `git add -N` and small slices hold for anyone committing by path.
- **The HEAD-isolation check** uses `mktemp -d` instead of a fixed `/tmp/headcheck`, which two
  parallel sessions collide on and which `tar -x` over a stale extraction makes lie.
- **Part 5’s measurement script** says it needs `python3`, prints a line instead of a traceback
  when no transcript or no usage record exists, and reads the usage keys with `.get(key, 0)`.
- **Part 10** describes Claude Code’s memory shape as Claude Code’s, not as what memory "holds".
- **Provenance on five numbers** that carried none: 40–80k (repos A and B, 2026-09-14); 30–50k
  and 2k (repo A, an observation as of 2026-09-14); 60–80k and 15–20 files (repo A, 2026-08-16);
  ~25 files (repo A, 2026-08-17). Dated from the archived predecessor document the numbers came
  from and the source repo’s history, not from memory.
- **Worked-example labelling.** The Stage 4 done-when blockquote is split into the rule and a
  labelled repo A example; the provenance paragraph admits inline "repo A" mentions where a
  sentence is enough; the 2026-09-14 sentinel verification names repo A.

Left as it was, on purpose: R3’s worked example names a file path in repo A
(`backend/helpers/listingHelpers.go:326`). Whether a path in a private repo counts as a private
string is the owner’s call and was raised, not taken.

## 1.0.1 — 2026-09-15

Corrections. No rule was added, removed, or changed in substance — four places where the file
contradicted itself or its own enforcement.

- **Profile P’s Stage 2 heading** is now "What exists, verified `<date>`". The old wording
  carried the word R1’s own test greps for, so every adapted copy reported an R1 finding against
  the line that prescribes the heading.
- **The step-log shape** in Profile L is now `**N. Title.** Done <date>`, matching every ledger
  the templates and examples write, and the `step-numbers` rule that reads them. A log written to
  the old spelling was invisible to `doctor`.
- **Part 11’s commit ritual** names the files in its second block, so it no longer contradicts
  Part 6, which requires `--only` for anyone committing under a shared index.
- **Appendix A’s `{{ARCHIVE_HOME}}`** admits an in-tree folder such as `docs/archive/`, and says
  the slot is always a path — the word `none` rendered as `none/<slug>/` in Parts 2 and 7.

## 1.0.0 — 2026-09-15

- Imported unchanged from ezhomesteading's 2026-09-14 revision.
