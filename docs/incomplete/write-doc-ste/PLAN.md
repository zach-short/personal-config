# Plan: the writing skill and the plain-English chat rule

Design: `DESIGN.md`, `RATIFIED` 2026-10-01 (D1 to D10). This plan turns it into three phases.

**Status.** `PLANNED` 2026-10-01, Opus 5.5. Approved at GATE 2 the same day; the questions and
answers are §7. The plan authorizes the whole run, and the phases do not each need approval again.
Board rows 73, 74 and 75 carry the three phases. All three were `BUILT` on 2026-10-01 (HANDOFF 91,
92 and 93).

## 0. Facts verified 2026-10-01 (supersede the design where they differ)

A second pass, run in the same session as the design and immediately before this plan. Nothing in
the design's G1 to G20 was found wrong. The rows below are new, numbered on from the design's.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G21 | The gates are green on `cd69fb5` | `bun run typecheck` clean; `bun run lint` clean, 151 files; `bun test` 789 pass, 0 fail, 66 files; `bun run doctor . examples` no findings over 79 and 7 markdown files | run 2026-10-01 |
| G22 | A saved answer stays live on a later run under another track | `setup` seeds the run's answers from the saved config (`src/commands/setup.ts:41`), and `matchesWhen` reads that map (`src/lib/when.ts:8-16`). So a `writeDoc: yes` saved on a non-code run is in the map on a later code run, where `write-doc` is never asked | the code |
| G23 | `doctor` renders from saved answers without the wizard | `renderAt` builds its context from `targetAnswers(config.answers, repo)` and calls `renderAll` (`src/doctor/rerender.ts:65-80`). Where an answer is absent, the renderer's fallback is what it reads | the code |
| G24 | The `settings.json` merge only adds | `mergeValues` keeps every existing key, and `mergeArrays` keeps every existing item and appends new ones (`src/lib/write-plan.ts:149-164`). A later run cannot remove an entry an earlier run added | the code |
| G25 | `skills: none` promises an empty skills folder | Its option reads "Nothing is written to `~/.claude/skills/`" (`src/questions/you.ts:372`), and `/write-doc` writes there | the code |
| G26 | `hooks` is answered before the new questions, and an absent answer reads `none` | `hooks` has no `when` and sits at `src/questions/you.ts:294`, ahead of `output-style` (`:334`) and `skills` (`:356`). `wantedHooks` reads `answer(ctx, 'hooks', 'none')` (`src/render/hooks.ts:83`) | the code |
| G27 | All three shipped profiles are code-track | `profiles/pro.json` has `workKind: "code"`; `starter.json` and `zach.json` have no `workKind`, which reads `code` (`src/lib/stored-profile-defaults.ts:20-25`) | the files |
| G28 | The hook scripts read their payload with `jq` and say so when it is missing | `templates/hooks/delete-guard.sh:21-27`, `templates/hooks/commit-guard.sh:18-24` | the files |
| G29 | The skills renderer reads a fixed list from `templates/skills/` | `SKILLS` (`src/render/skills.ts:17`), read at `:57`. Its frontmatter stamp helper, `stampAfterFrontmatter`, is private to that module (`:66-72`) | the code |
| G30 | A planned `.sh` is written executable | `planned()` derives the mode from the extension (`src/render/context.ts:20-34`), and a re-run repairs the bit (`pendingMode`, `src/lib/write-plan.ts:59`) | the code |
| G31 | The golden is tracked and counts its keys | `git ls-files tests/golden` lists `full-track.json`; `tests/tracks.test.ts:187` expects 65 keys over three code-track variants, and the docstring at `:102-156` records each deliberate change | the files |
| G32 | The owner's global hook blocks a prose write that lists the banned words | `no-em-dash.sh post` runs on every `Write` and `Edit` of a prose file and skips the banned-word check only under `/.claude/` (G5). A template at `templates/write-doc/style.md` is outside `/.claude/` and lists the words by design | the script |
| G33 | The board ends at row 72; the ledger at step 89 | `PASSOFF.md:82`; G20 | the files |

## 1. Decisions taken since ratification

Build-level calls that implement the design. Each carries its reversal.

- **BD-1. Every shipped profile gets `chatStyle: "ste"`; none gets `writeDoc` or
  `writeDocCheck`.** All three are code-track (G27), where D5 never asks `write-doc`, and an answer
  the wizard never asks is a dead key that misleads the next reader. This narrows the scope's
  "an answer in each shipped profile". *Reversal:* add the two keys to each profile.
- **BD-2. `write-doc-check`'s `when` also requires `workKind: non-code`, and every renderer that
  reads `writeDoc` checks the work kind through `trackOf`.** G22: without it, a `writeDoc: yes`
  saved on a non-code run would ask the follow-up on a later code run, and would render the skill
  there against D5. D7's two conditions stay as ratified; this adds a third. *Reversal:* drop the
  clause.
- **BD-3. The chat rule names no style file.** It says that papers, documents and other written
  work are outside it, and stops there. A pointer to `/write-doc`'s `style.md` would name a file
  that a `write-doc: no` run never writes, and a branch on `writeDoc` buys nothing the sentence
  does not already say. *Reversal:* render the pointer when `writeDoc` is `yes`.
- **BD-4. The skill's three templates live in `templates/write-doc/`, rendered by a new
  `src/render/write-doc.ts`.** `templates/skills/` and `renderSkills` stay the five workflow skills
  (G29), so the `skills` answer and the `write-doc` answer each own their own files.
  `stampAfterFrontmatter` moves out of `src/render/skills.ts` into a module both renderers import,
  rather than being copied. *Reversal:* move the folder under `templates/skills/` and render it
  from `renderSkills`.
- **BD-5. A file that must list the banned words is written through Bash, and the ledger step
  names it.** G32: the owner's global hook blocks `templates/write-doc/style.md` through `Write` or
  `Edit`, and the file's job is to carry the list. Zach's own script skips the same check under
  `/.claude/` for the same reason. Every other file in this plan goes through `Write` and `Edit`
  and passes the hook. *Reversal:* Zach turns the hook off for the build session.
- **BD-6. The hook entry's command is the absolute path of `check.sh` followed by `hook`, the form
  the guards use (`src/render/hooks.ts:151-156`).** Once a release carries it, the string is fixed
  for good: the merge de-duplicates by exact JSON, so a changed string is a second entry beside
  the first (the `gateCommand` comment, `src/render/hooks.ts:120-141`). *Reversal:* free until the
  first release that carries it; after that, none.
- **BD-7. `check.sh` skips banned words only in a rule or skill file, not under any `/.claude/`
  path.** Taken 2026-10-01 in Phase 2, on the Deep review's first finding. Phase 2 item 2 said
  to keep the owner's skip, which matches `*/.claude/*`. Claude Code puts an agent worktree at
  `<repo>/.claude/worktrees/<name>/`, so that pattern skipped the banned-word check on every
  document written in one, and the PASS line made the skip look intended. The skip exists for
  files that list the words on purpose, so it now matches `*/.claude/rules/*`, `*/.claude/skills/*`
  and anything under `$HOME/.claude/`, never `*/.claude/worktrees/*`, and reads a relative path
  as absolute so `.claude/x.md` and `./.claude/x.md` agree. *Reversal:* restore the one pattern
  `*/.claude/*` in `skips_banned`.
- **BD-8. In hook mode, a missing `jq` exits 2 and names `jq` on stderr.** Taken 2026-10-01 in
  Phase 3, before any hook code, from Claude Code's hooks reference (Context7
  `/websites/code_claude`, pages `hooks` and `hooks-guide`, queried 2026-10-01). Phase 3 item 2
  and board row 75 asked for this as BD-7, but Phase 2 had already spent that number. A
  `PostToolUse` hook cannot block, because the tool already ran. Exit 2 shows stderr to Claude.
  Any other non-zero exit is a non-blocking error: the person's transcript shows a notice with the
  first line of stderr, and Claude does not see it. Exit 0 sends stderr to the debug log only. So
  exit 2 is the one code that tells the agent its save was not checked, and the agent can act on
  it at once, because `check.sh check FILE` needs no `jq`. The cost: with no `jq` the script
  cannot read which file was saved, so the message follows every `Write` and `Edit`, of any file
  type, until `jq` is installed or the entry is removed. Every other way hook mode can fail to
  check a prose file exits 2 for the same reason, and so does a file with problems, so in hook
  mode exit 2 means "the agent must read this" and exit 0 means nothing to report. Neither prints
  `PASS`. *Reversal:* exit 1 from `fail` in hook mode, so the notice reaches the person's
  transcript and not the agent.

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | `chat-style`: the question, the rule, the long form | Default | none | comfortable | The smallest piece that stands alone, and the one that changes every track's output (D4), so its golden diff is read before anything else moves it |
| 2 | `write-doc`: the question, the skill, `style.md`, `check.sh` in check mode | Default | one Deep review of `check.sh` | full | The skill and its script are one unit: the skill's last step runs the script. The script's open failure is silent (hazard 2), so it gets the one narrow Deep review |
| 3 | `write-doc-check`: the question, hook mode, the `settings.json` entry | Default | none | comfortable | The settings merge is a second subsystem with its own hazards (G24, BD-6), and the stamp port is a hazard of its own (design hazard 1) |

All three run in lane A, in this order. Each one moves the catalog count, `src/questions/you.ts`,
`catalog.json`, `README.md` and `CHANGELOG.md`, so no two run at once. Board rows 73, 74 and 75
are written after GATE 2, one per phase.

### Phase 1. `chat-style`

**Status.** `BUILT` 2026-10-01, Opus 5.5, on `main` at `58eaf93`, not yet committed (Zach commits).
HANDOFF 91, board row 73. The `As built:` notes follow "Watch for".

**Scope.**

1. `src/questions/you.ts`: add `chat-style` directly after `output-style` (DIAL-8). `kind:
   'select'`, `configKey: 'chatStyle'`, `readMore: 'chat-style'`, no `when`. Options: `ste`,
   **Short and plain**, example "ASD-STE100: short sentences, one word for one meaning, no irony",
   recommended; `none`, **However it likes**, example "no rule is written" (D8). The comment above
   it cites D4: this recommended answer adds a file to an old profile's output, on purpose.
2. `src/render/rules.ts`: a `languageRule(ctx)` rendered on every track and both weights when
   `answer(ctx, 'chatStyle', 'ste') === 'ste'`. The fallback is `'ste'` because `doctor` renders
   from saved answers without the wizard (G23), and D4 says an absent answer reads "on" wherever
   it is read. The body is D3 with DIAL-5's caps, in the first person as `commits.md` is, with
   BD-3's sentence about documents. The module comment's list of rules by track gains the line.
3. `src/lib/stored-profile-defaults.ts`: no new key. One sentence in the header comment saying
   `chatStyle` is absent on purpose, citing this folder's D4.
4. `docs/choices/chat-style.md`, new: each option's defense, the strongest argument against it,
   what it writes and how to undo it (delete the file or `personal-config undo`; a re-run that
   answers **However it likes** plans nothing, and does not delete a file an earlier run wrote).
   The two limits of STE (design hazard 7). D4's reading of an old profile, stated as the cost
   it is.
5. `profiles/zach.json`, `profiles/starter.json`, `profiles/pro.json`: `"chatStyle": "ste"`
   (BD-1).
6. `README.md`: a `language-style.md` row in the files table (`:69-72`), and the rule in the list
   at `:334`. `CHANGELOG.md`: an `Unreleased` section above `## 0.7.0` (`:6`), with the entry.
7. `bun run catalog`.
8. Tests. A new `tests/chat-style.test.ts`, a file of its own (X1): asked on all four
   combinations of work kind and weight; `ste` renders `language-style.md` on each, `none`
   renders nothing; an absent answer renders the file through `renderAll` and defaults to `ste`
   through `defaultFor`; `defaultFor` returns the option marked `recommended`, so the terminal and
   the site agree (G12); the text carries the irony and litotes line and names no style file.
   Then the counts: `tests/catalog.test.ts:52-57` to 47 questions and `you: 17`. The golden gains
   one key per variant, 65 to 68 (G31): update only the keys that move, with a scratch script, and
   add a paragraph to the docstring at `tests/tracks.test.ts:102-156` naming them, as the
   `haiku-tier` change did. `grep -rln "model-routing.md" tests` finds the other suites that pin a
   rule list.

**Done when.** `bun run typecheck`, `bun run lint`, `bun test` and `bun run doctor . examples`
exit 0. Then the proof a gate cannot give: `bun run setup --profile starter --yes --dry-run
--projects-dir tests/fixtures` lists `~/.claude/rules/language-style.md`. On Zach's machine the
stamp guard shows it as refused, because his own copy carries no stamp (G11), and that refusal is
itself the second half of the proof. A person reads the rendered rule against D3: the five STE
lines, the caps, the irony and litotes line, the sentence about documents, and no personal name.

**Watch for.** The golden diff. The expected moves are the new rule per variant and the files
that carry the config hash. Any other file that moves is a real change, and the phase stops on it.
The rule body is prose inside a `.ts` file, where Zach's hook does not look, so read it by eye
against the writing rules.

**As built: 2026-10-01.** Scope items 1 to 8 were built as written, with these departures and
findings.

- **Item 4, the undo.** The plan gave "delete the file or `personal-config undo`" as two equal
  ways out. They are not equal: `undo` restores files a run replaced and leaves files it created
  in place (`src/commands/undo.ts:6`). So the long form gives deleting the file as the undo, and
  says what `undo` does and does not do.
- **Item 6, the README.** Three more claims became false when the question was added, and were
  corrected beside the two rows the plan named: the `you` row of the phases table; the per-track
  question counts, 35, 16 and 14 to 36, 17 and 15 (a scratch script that walks `ALL_QUESTIONS`
  through `askable` and `defaultFor` reproduced the old three before it gave the new three); and
  the catalog paragraph, now `0.7.0+b8cca551`, 47 questions, 38 long forms, 34 with a condition.
- **Item 8, the tests.** `grep -rln "model-routing.md" tests` found four suites, and all four
  test a rule list with `toContain`, so none moved. The test run found the pins that did move: the
  five per-shape counts in `tests/catalog.test.ts`, one more each, and the exact file list of the
  smallest setup in `tests/tracks.test.ts`. Each change carries a dated comment.
  `tests/chat-style.test.ts` holds 18 tests.
- **The golden.** 65 keys to 68: one new key per variant, `~/.claude/rules/language-style.md`,
  the same hash in all three. No other key moved, the config-hash files included, because
  `testContext` fixes the stamp's hash and `DEFAULT_ANSWERS` carries no `chatStyle`. The diff was
  read key by key before it was accepted, and the hash was computed again by a separate script.
- **Order.** `languageRule` is the last entry in `renderGlobalRules`, so the preview lists the
  rule after `docs-lookup.md`.
- **Gates, 2026-10-01.** `bun run typecheck` clean; `bun run lint` clean, 152 files; `bun test`
  807 pass, 0 fail, 67 files; `bun run doctor . examples` no findings. §5's baseline was 789
  tests, 66 files and 151 linted files.
- **The proof.** The dry run in "Done when", on Zach's machine, lists `language-style.md` under
  `~/.claude/rules` with the stamp guard's tag (no stamp, left alone), and names it among the two
  files left alone. His own copy is unchanged: 730 bytes, last modified 2026-09-30. The same dry
  run with `HOME` in a new temporary directory tags it as new and writes nothing. The rendered
  rule was read against D3: the five STE lines, the 20 and 25 word caps, the irony and litotes
  line, the sentence about documents, and no personal name.

### Phase 2. `write-doc` and the check script

**Status.** `BUILT` 2026-10-01, Opus 5.5, in a worktree on `611f766`, not yet committed (Zach
commits). Board row 74. The `As built:` notes follow "Watch for".

**Scope.**

1. `src/questions/you.ts`: add `write-doc` directly after `skills` (DIAL-8). `configKey:
   'writeDoc'`, `readMore: 'write-doc'`, options `yes` and `no` with D8's copy, `yes` recommended
   (D9). `when`: `{ all: [{ key: 'workKind', is: 'non-code' }, { key: 'skills', isNot: 'none' }] }`
   (D5, D10). The comment above it cites D9: like `chat-style`, this recommended answer adds files
   to an old profile's output, on purpose.
2. `templates/write-doc/` (BD-4), three files.
   - `SKILL.md`: Zach's skill (G2, G4) in general form. "The author" for "Zach", and **Needs the
     author** for **Needs Zach** (DIAL-4). Step 1 reads the `style.md` beside it. Step 8 per
     DIAL-9. Step 9 runs the installed `check.sh check <file>` by absolute path. Step 10 reports in
     STE only when `chatStyle` is `ste`. The Limits section keeps the detector sentence and drops
     the GPTZero figure (DIAL-7). The description keeps its trigger list, README included (G18).
   - `style.md`: `writing-style.md` in general form. The paragraph about chat replies becomes one
     sentence saying chat replies are outside this file; "the hook" becomes "the check script";
     the sources line stays (DIAL-6). Written through Bash (BD-5).
   - `check.sh`: the `check FILE` mode here, `hook` in Phase 3. The three checks and the
     banned-word pattern as Zach's script has them (DIAL-6), code spans stripped, and the
     banned-word skip under `/.claude/` kept. It fails loudly (design hazard 2): a missing `perl`
     exits non-zero and names `perl` before any check runs; a Word file with no `textutil` exits
     non-zero and names it; a missing or unreadable file exits non-zero. It prints `PASS` only
     after all three checks ran on text it read. Bash 3.2 (design hazard 3): no associative arrays,
     no `${x^^}`, no `mapfile`.
3. `src/render/write-doc.ts`, new: plans the three files under `~/.claude/skills/write-doc/` when
   the work kind is non-code through `trackOf` (BD-2), `writeDoc` is `yes`, and `skills` is not
   `none` (D10). The renderer's fallback for an absent `writeDoc` is `yes` (D9), for the reason
   Phase 1 gives `chatStyle` a fallback of `ste` (G23). `SKILL.md` is stamped after its frontmatter through the
   moved helper (BD-4). `check.sh` is planned with `extension: 'sh'`, so it is written executable
   (G30). The answer-dependent passages are variables (design hazard 4). Registered in
   `src/render/index.ts`.
4. `docs/choices/write-doc.md`, new: the long form for `write-doc`, with the GPTZero figure as one
   person's worked example (DIAL-7) and the two sources of the word list (DIAL-6). Phase 3 adds the
   follow-up's half.
5. `README.md` (the files table, the skills line at `:72`, the list at `:335`), `CHANGELOG.md`,
   `bun run catalog`.
6. Tests. A new `tests/write-doc.test.ts`: asked on non-code at both weights and never on code;
   not asked when `skills` is `none` (D10); an absent `writeDoc` on a non-code run renders the
   folder and defaults to `yes` (D9); the three files with their modes and
   stamps; nothing rendered on a code run that carries a saved `writeDoc: yes`; the rendered
   skill and style carry no personal name and no `~/Projects`; the STE passage present only under
   `chatStyle: ste`. A new `tests/check-script.test.ts`: each check fires and names itself; a clean
   file prints `PASS` and exits 0; with `perl` off `PATH`, a non-zero exit and no `PASS`; a `.docx`
   with `textutil` off `PATH`, the same; a missing file exits non-zero. The script runs under
   `/bin/bash`, so a run on a Mac exercises 3.2. Counts: 48 questions, `you: 18`. Under D9, a
   suite that pins a non-code run's planned files gains the folder where its answers carry
   `skills: all`; `grep -rln "close-out/SKILL.md" tests` finds them. The code-track golden does
   not move.

**Subagents.** One Deep review (Fable 5.1) of `templates/write-doc/check.sh` and nothing else,
after its tests pass, in a worktree of its own, read-only, with `model` passed explicitly. Its
whole output is a verdict on two questions: does any path exit 0 or print `PASS` on text the
script did not read, and does any construct need bash 4. Check its diffstat when it returns. Each
finding is fixed in this phase or parked by Zach (R9).

**Done when.** The four gates exit 0, and the Deep verdict is recorded with each finding fixed or
parked. Then the proof: render a non-code profile into a temporary home (`HOME=$(mktemp -d)`, the
profile passed with `--from` from a file in the scratchpad); `ls -l` shows `check.sh` executable;
the installed script, run by hand, prints `PASS` on a clean draft, names the em dash in a draft
that has one and exits 1, and on a `.docx` with `textutil` off `PATH` fails loudly and prints no
`PASS`.

**Watch for.** Zach's global hook on every `.md` write in this phase (BD-5). The moved
`stampAfterFrontmatter` must not change a byte of the five existing skills; the golden catches it.
The skill's description is what makes it fire, so a reworded description changes when it fires:
keep the trigger list.

**As built: 2026-10-01.** Scope items 1 to 6 were built as written, with these departures and
findings.

- **Item 2, `style.md`.** Written through Bash (BD-5). The register section's "STE sentence
  limits do not apply here" became "Sentence limits for chat replies do not apply here", because
  under `chatStyle: none` no STE rule exists for the sentence to refer to.
- **Item 2, `check.sh`.** It reads only the ten file types the skill names and exits 2 on any
  other, where the owner's script read any file with `cat`. It looks for every tool it pipes
  through (`perl`, `grep`, `tr`, `sort`, `head`, `paste`, `cat`) before reading any text, since a
  missing one empties a pipe and an empty pipe reads as a clean text, and it treats a `grep`
  status above 1 as a failure, not as "no match". Three more ways to pass on text it did not read
  were found and closed. First, `textutil` reads a file it cannot parse as plain text and exits
  0, so a misnamed `.docx` was checked as raw bytes and passed; the script now checks each Word
  type's signature first (found by `tests/check-script.test.ts`). Second and third, from the
  Deep review below: binary data under a text extension, and a NUL byte, which bash drops from a
  command substitution without a warning.
- **Item 2, the `/.claude/` skip.** Narrowed, BD-7.
- **Item 3.** `wantsWriteDoc` reads `skills` with the fallback `renderSkills` uses, so the two
  renderers agree on what "skills are installed" means. `src/lib/stored-profile-defaults.ts`
  gained one sentence saying `writeDoc` is absent on purpose, as Phase 1 did for `chatStyle`.
- **Item 3, the move.** `stampAfterFrontmatter` moved to `src/lib/stamp.ts`, beside `stampIndex`,
  the reader that must find what it writes. The golden did not move.
- **Item 6, the tests.** `tests/write-doc.test.ts` holds 28 tests, `tests/check-script.test.ts`
  35. The plan's grep for `close-out/SKILL.md` found `tests/tracks.test.ts`, whose two non-code
  cases moved. The run found the rest: the count pins in `tests/catalog.test.ts` (48 questions,
  `you: 18`, the non-code shapes 22, 18 and 16, the `when` map) and the list of questions a
  programmer is never asked, which gains `write-doc` as its third. Each carries a dated comment.
- **The README** also had per-track counts that moved: other work on the lighter setup is asked
  eighteen questions, or sixteen without git.
- **The Deep review**, Fable 5.1, in its own worktree, which the harness removed unchanged. On
  bash 4: none. On a pass for text not read or not checked, six findings, reproduced by running
  the script under `/bin/bash` 3.2.57 unless marked. 1, the `/.claude/` skip matched every agent
  worktree: fixed, BD-7. 2, binary data under a text extension passed: fixed, a NUL byte in a
  text-type file exits 2. 3, three backticks in a sentence paired with a later fence and hid the
  prose between them: fixed, a fence counts only at the start of a line, and a fence that never
  closes is checked. 4, a NUL byte glued two words into one no pattern matched: fixed by 2. 5, a
  phrase split across two lines was missed, because `grep` reads one line at a time: fixed, the
  banned-word check reads the text with its line breaks turned to spaces. 6, `textutil` may parse
  a damaged Word file in part and exit 0 (reasoning only): open, stated in the script's header,
  for Zach to park. Each fix has a test.
- **Gates, 2026-10-01.** `bun run typecheck` clean; `bun run lint` clean, 155 files; `bun test`
  870 pass, 0 fail, 69 files; `bun run doctor . examples` no findings.
- **The proof.** The installed script, run by hand under `/bin/bash`, printed `PASS: clean.md`
  and exit 0 on a clean draft, named the em dash and exited 1 on a draft with one, printed
  `PASS: report.docx` on a `.docx` made by `textutil`, and with `textutil` off `PATH` printed
  "textutil was not found on PATH, so report.docx was not checked" and exited 2 with no `PASS`.
  It ran from `templates/write-doc/check.sh`, which `tests/write-doc.test.ts` shows is the
  rendered file byte for byte apart from the stamp on line 2. **Not seen:** the render into a
  temporary home and `ls -l` on the written `check.sh`. The builder's harness refused every
  command that sets `HOME`, so that half is runtime entry 2.

### Phase 3. `write-doc-check` and the hook

**Status.** `BUILT` 2026-10-01, Opus 5.5, on `main` at `6e30450`, not yet committed (Zach
commits). HANDOFF 93, board row 75. The `As built:` notes follow "Watch for".

**Scope.**

1. `src/questions/you.ts`: add `write-doc-check` directly after `write-doc` (DIAL-12). `configKey:
   'writeDocCheck'`, values `skill` and `every` (DIAL-10), `readMore: 'write-doc'` (DIAL-11), D8's
   copy, `skill` recommended. `when`: D7's two conditions, BD-2's `workKind: non-code`, and
   D10's `skills` not `none`.
2. `check.sh`, the `hook` mode. It reads the payload with `jq`, as the guards do (G28). With no
   `jq` it prints a line naming `jq` to stderr and exits non-zero, and never claims a pass; whether
   that exit blocks is chosen from Claude Code's `PostToolUse` exit codes, looked up through
   Context7 `/websites/code_claude` before writing, and recorded as BD-7. It checks only `.md`,
   `.mdx`, `.txt`, `.rst`, `.tex` and `.adoc`. It reads the stamp from the file on disk, because
   an `Edit`'s `new_string` does not carry it, and skips the file when a stamp sits on the anchored
   line: line 1; line 2 under a `#!`; the first non-blank line after a closed frontmatter block;
   never in a file whose frontmatter does not close (`stampIndex`, `src/lib/stamp.ts:108-116`). It
   checks `content // new_string`, as G5 describes, and blocks with exit 2 and the problems on
   stderr.
3. `src/render/hooks.ts`: one `PostToolUse` entry, matcher `Write|Edit`, command per BD-6, when
   the work kind is non-code, `writeDoc` is `yes`, `answer(ctx, 'hooks', 'none')` is not `none`
   (G26), `writeDocCheck` is `every`, and `skills` is not `none` (D10). The early
   return in `renderHooks` (`:26-27`) lets it through.
4. `templates/write-doc/SKILL.md`: the sentence that the same check runs on every save, rendered
   only under `every`.
5. `docs/choices/write-doc.md`: the follow-up's two options, with defense, argument against, what
   each writes, and the undo: `personal-config undo`, or remove the entry from `settings.json` by
   hand. A later run that answers **Only what /write-doc writes** does not remove an entry an
   earlier run added (G24), and a deleted skill folder with the entry left in place fails the hook
   on every save, so the undo removes both. `docs/choices/hooks.md`: one line saying another entry
   can come from `write-doc-check`, and where to read about it.
6. `README.md`, `CHANGELOG.md`, `bun run catalog`. Counts: 49 questions, `you: 19`.
7. Tests. A new `tests/write-doc-check.test.ts`: the question's `when` on each condition; the
   entry present only under `every`; under `hooks: none`, no entry and no question; a second merge
   adds nothing; hook mode blocks an unstamped draft with an em dash and names it; a stamped file
   in each of the three anchor shapes is skipped; a stamp quoted in prose away from the anchor is
   checked, not skipped; no `jq` on `PATH` gives a non-zero exit and no pass; a `.ts` path is
   ignored. One fixture set runs through both `readStamp` and the bash port, and the test asserts
   the same verdict for each fixture (design hazard 1).

**Done when.** The four gates exit 0. Then the proof: render into a temporary home with
`writeDocCheck: every`; read `settings.json` and find exactly one `PostToolUse` entry for the
script; pipe two hand-made payloads into the installed script, an unstamped draft with an em dash
(exit 2, the message names it) and the rendered short ledger (exit 0, skipped); merge a second time
and find the entry count unchanged. R10: this is a piped payload, not a live session, and the hand
back says so. The live check is a runtime entry for Zach.

**Watch for.** The bash port of `stampIndex` against the TypeScript: the shared fixtures are the
only thing that keeps them in step. BD-6: the command string cannot change after release.

**As built: 2026-10-01.** Scope items 1 to 7 were built as written, with these departures and
findings.

- **Item 2, the exit code.** BD-8, decided from the hooks reference before any hook code was
  written. Every outcome the agent must see exits 2: problems in the new text, a missing tool
  (`jq` included), an empty payload or one `jq` cannot parse, a payload with no file or no new
  text, new text that is not a string or holds a NUL byte, and a saved file that is not on disk.
  Exit 0 prints nothing at all. Hook mode never prints `PASS`.
- **Item 2, the stamp port.** `stamped` in `check.sh` ports `stampIndex` and `STAMP_PATTERN` to
  Perl, on bytes, with a lookahead in place of JavaScript's multiline `$`, which also ends a line
  at a carriage return. Perl, because the script already requires it and bash 3.2's own regex has
  no lookahead and no lazy match. The shared fixtures pinned one shape the plan did not list: the
  pattern is not anchored at the start of its line, so a line 1 that reads "Quoted: " and then a
  stamp counts as stamped, in `readStamp` and in the port alike. The fixture holds both to it;
  whether it is right is a question about `readStamp`, outside this phase.
- **Item 2, the order and the extension.** The script looks for its seven tools first, in both
  modes, and for `jq` next, so a missing `perl` or `jq` reports after every save of any file, not
  only a prose file. The extension is read without regard to case, as `check` mode reads it; the
  owner's hook matches lowercase only.
- **Item 3.** `renderHooks` reads `wantsWriteDocHook` from `src/render/write-doc.ts`, which the
  skill's sentence reads too, so the entry and the sentence cannot disagree. It requires
  `wantsWriteDoc`, so the entry is never planned without the script it runs. The early return
  names the entry beside the four scripts, although, as the plan says, the completion gate keeps
  it open whenever hooks are on. The entry has no timeout, as the guards have none.
- **Item 4.** The last item of the skill's Limits section became `{{SAVE_CHECK}}`. Under `skill`
  it renders the sentence it had before.
- **Item 5.** The long form's paragraph that said no hook is added to `settings.json` was
  corrected. Its undo now removes the entry before the folder, and says why: a deleted folder with
  the entry left in place fails the hook after every save. It also says when `personal-config
  undo` removes the entry and when it does not.
- **Item 6.** `README.md`: the `you` row, the `/write-doc` row, a bullet for the hook, the
  uninstall line, and the per-track counts. Other work on the lighter setup is asked nineteen
  questions, or seventeen without git, measured by a scratch script that first reproduced the old
  36, 18 and 16. Catalog `0.7.0+6bd9a9f2`: 49 questions, 39 long forms.
- **Item 7, the tests.** `tests/write-doc-check.test.ts` holds 51 tests. Four mutations of the
  port and one of the entry were each caught, one only after a fixture was rewritten: the fixture
  for a frontmatter block that never closes had a plain line where a broken reader would look, so
  the stamp now sits there. `tests/check-script.test.ts`, which this row did not list, lost `hook`
  from its list of unknown modes, because it is a mode now; its failures are in the new suite.
  `tests/catalog.test.ts`: 49 questions, `you: 19`, and the `when` map. The golden did not move.
- **Found while building, open.** A declined run prints the entries it would have merged
  (`declinedHookHelp`, `src/render/hooks.ts`), and builds them from the plan's paths. The new
  entry's script is planned under either answer, so the paths cannot show it, and under `every`
  the printed snippet leaves the `PostToolUse` entry out. The fix passes the planned merge to that
  function, a change to `src/commands/setup.ts:390`, outside this row's files. Put to Zach.
- **Gates, 2026-10-01.** `bun run typecheck` clean; `bun run lint` clean, 156 files; `bun test`
  921 pass, 0 fail, 70 files; `bun run doctor . examples` no findings.
- **The proof**, in a temporary home under the scratchpad, with a profile answering `every` for
  other work on the lighter setup and one folder to configure. `settings.json` held one
  `PostToolUse` entry, matcher `Write|Edit`, command the installed `check.sh` and `hook`. The
  script was `-rwxr-xr-x`, shebang on line 1, stamp on line 2. Through `/bin/sh -c` and that
  command: a hand-made Write payload for an unstamped draft with an em dash exited 2 and named the
  em dash; a Write payload carrying the rendered short ledger (its stamp on line 1, eight em
  dashes) exited 0; an Edit payload adding an em dash to that ledger exited 0. A second run wrote
  nothing, and the entry count stayed at one. The real `~/.claude/settings.json` kept its
  modification time and size. **R10:** the payloads were piped by hand, not sent by a live
  session; the live check is runtime entry 3.

## 3. Dials

DIAL-1 to DIAL-9 are the design's (§4), at their recommended values. Three more come from the
gate's answers.

| Dial | What it sets | Recommended value |
|---|---|---|
| DIAL-10 | `write-doc-check`'s config key and values | `writeDocCheck: skill \| every`. Two values, as setup-tracks D2 asks of track questions |
| DIAL-11 | `write-doc-check`'s long form | `write-doc`, shared, as `model-light-enabled` shares `model-tiers` |
| DIAL-12 | Where `write-doc-check` sits | Directly after `write-doc`, so the follow-up comes before anything else |

## 4. Seams reserved, deliberately not built

- **A hook for Word files.** Zach's `bash` mode exists; D7 named `Write|Edit` only.
- **Removing a stale entry on a re-run.** The merge only adds (G24). A remove strategy in
  `src/lib/write-plan.ts` would serve every hook, and is its own item.
- **`write-doc` on every track.** A one-line `when` change if it is ever wanted (D5).
- **A marker of which questions a profile answered.** E3's mechanism, rejected in D4.
- **`/counsel`** (D1).
- **The `0.8.0` cut and the portfolio pin bump.** Board items of their own after Phase 3, and
  Zach's to run (design hazard 6).

## 5. Repo hazards, with live numbers

- **G21's numbers are the baseline**: 789 tests, 66 files, 151 linted files, no doctor findings.
  A phase that ends below them has lost something.
- **The golden moves on purpose in Phase 1 only.** 65 keys to 68. Phases 2 and 3 change nothing
  on the code track, so a golden change there is a defect.
- **A person with a hand-written `~/.claude/skills/write-doc/SKILL.md`.** The stamp guard refuses
  their `SKILL.md` (G11), but `style.md` and `check.sh` are new paths and are written beside it.
  The preview shows the refusal and the two new files, and the confirm covers the whole batch.
  Accepted, and stated in the long form.
- **One builder per repo.** `HANDOFF.md` is a shared append target that no collision check sees,
  so the three phases run one at a time in one checkout, and no other build runs in this repo
  alongside them.
- **A worktree's gates can lie here.** `HANDOFF.md` and `PASSOFF.md` are untracked, so `doctor`
  in a worktree never sees them, and a worktree starts from whatever base it was cut from. Build
  on `main`, or bring the worktree up to `main` before the first gate.
- **Zach's global hook (G32, BD-5)** blocks a prose write with an em dash, a contraction or a
  banned word anywhere outside `/.claude/`, this repo's own docs included.

## 6. Session protocol

Each phase is one session. Read `CLAUDE.md`, `docs/conventions-ts.md` and
`docs/AGENT-PRACTICES.md` in full, then `HANDOFF.md`, then this folder. Check the session's model
against the board row before anything else. Re-run §0's checks that the phase depends on and
record any that moved. Close each phase with the ritual in `docs/AGENT-PRACTICES.md` Part 7: the
phase header here becomes `BUILT <date>, commit <hash>`, `DESIGN.md` gets an `As built:` note
under any decision the build departed from, `RUNTIME-PASS.md` gets the phase's entries, `HANDOFF.md`
gets one step at the next free number, and the board row points at it. Never commit: print the two
blocks, `git add` with the exact files and `git commit` with the same files.

## 7. GATE 2

**Answers, given by Zach in chat, 2026-10-01.** Question 1: **Yes**, as recommended; recorded as
D9. Question 2: **do not ask `write-doc` when `skills` is `none`**, as recommended; recorded as
D10. Question 3: **approved as written.** The phases above were brought in line with D9 and D10 the
same turn. The questions follow as they were asked.

1. **Which `write-doc` answer is recommended?** The gate settled who is asked, and left this open.
   - *Yes, recommended.* A profile saved on a non-code run before the question existed gains the
     skill on a re-run, read the way D4 reads `chatStyle`. No shipped profile is non-code (G27),
     so none of them changes. **Recommended**, because D5's own defense is that on this track the
     documents are the work, and recommending "no" there argues against asking at all.
   - *No, recommended.* Nothing changes for any saved profile, and the question keeps the pattern
     G13 describes.
2. **What does `skills: none` mean for `write-doc`?** That option says nothing is written to
   `~/.claude/skills/` (G25), and `/write-doc` writes there.
   - *Do not ask `write-doc` when `skills` is `none`.* **Recommended.** It keeps that promise the
     way D7 keeps `hooks: none`'s, and changes no existing question.
   - *Ask it anyway, and reword the `none` option to say no workflow skills are written.* This
     reopens design §2's line that the existing questions do not change, and needs a dated
     supersession.
   - *Ask it anyway, unchanged.* The option's text becomes false for anyone who then says yes.
3. **Approve the plan as written?** Three phases, serial, lane A, Default driver for each; one Deep
   review of `check.sh` in Phase 2; BD-1 to BD-6; DIAL-1 to DIAL-12 at their recommended values.
   BD-5 touches your own setup: the builder writes the style template through Bash, because your
   global hook blocks a file that lists the banned words.
