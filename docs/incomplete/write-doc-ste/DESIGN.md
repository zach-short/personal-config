# Design: the writing skill and the plain-English chat rule

Offer `/write-doc` on the non-code track, and ask every person whether their agent should reply in
ASD-STE100 Simplified Technical English.

**Status.** `RATIFIED` 2026-10-01, Opus 5.5. Opened as `SCOPE.md` on 2026-10-01 (commit
`cd69fb5`), answered in full at GATE 1 the same day, and renamed to this file in the same session.
The questions as the gate saw them, and the answers word for word, are §8. From here the design is
frozen: it changes by a new dated `D<n>` or an `As built:` note, never by an edit to a decision in
place. `PLAN.md` beside it is Stage 4, approved at GATE 2 on 2026-10-01. GATE 2 also settled two
design questions the first gate left open; they are D9 and D10.

**Labels.** G1 to G20 in §1 are the ground truth the gate saw; `PLAN.md` §0 continues from G21.
A1, A2, Bundles 1 to 3, E1 to E3 and DIAL-1 to DIAL-9 are the scope's names, kept so §8 reads
against them. The scope also named two texts for the chat rule "D1" and "D2"; this file calls them
**rule option 1** and **rule option 2**, because D1 to D10 below are this file's decisions. A
decision from another design is written with its folder, as in "setup-tracks D14".

## 1. What exists, verified 2026-10-01

| # | Claim | Verified state | Citation |
|---|---|---|---|
| G1 | The engine carries none of the three items | `grep -rniE "write-doc\|writing-style\|language-style\|ste100\|simplified technical\|no-em-dash\|counsel" src templates profiles standard docs/choices catalog.json README.md examples tests` printed nothing | run 2026-10-01 |
| G2 | Zach's sources are hand-written and unstamped | `~/.claude/skills/write-doc/SKILL.md` (89 lines, 9,774 bytes), `~/.claude/rules/writing-style.md` (73 lines, 5,880 bytes), `~/.claude/rules/language-style.md` (13 lines, 730 bytes), `~/.claude/hooks/no-em-dash.sh` (123 lines). None has a `personal-config v` stamp; `~/.claude/rules/commits.md:1` and `~/.claude/skills/scope/SKILL.md` do | `head -3`, `wc` |
| G3 | The skill names Zach 18 times; the engine test forbids that | `grep -c "Zach"` on the skill returns 18. `tests/cli.test.ts:141-157` greps `zach` and `~/Projects` across `src/`, `templates/`, `standard/`, `examples/` | both files |
| G4 | The skill leans on four outside things | `writing-style.md` (step 1), `no-em-dash.sh` (step 9), "the docx skill" (step 8, a harness skill), and `language-style.md` (its header paragraph and step 10). Its Limits section reports one first-hand GPTZero result | `~/.claude/skills/write-doc/SKILL.md` |
| G5 | The hook checks the new text of every prose-file edit, anywhere | `post` mode reads `.tool_input.content // .tool_input.new_string` (`no-em-dash.sh:76`) for `.md .mdx .txt .rst .tex .adoc` (`:78-79`). The only path filter skips the banned-word check under `/.claude/` (`:42-43`). Wired globally at `~/.claude/settings.json:38` and `:48`. **Seen live 2026-10-01:** an Edit to this session's memory index was blocked for an em dash in an unchanged line that sat inside `new_string` | the script, the settings file |
| G6 | The hook fails open on three missing tools | No `jq`: `text` is empty and every check passes (`:76`). No `perl`: `strip_code` prints nothing, so the contraction and banned-word checks see no text (`:19`). No `textutil` (any OS but macOS): `bash` mode exits 0 (`:91`), and `check` on a Word file reads empty text and prints `PASS` (`:68`, `:111`) | the script |
| G7 | The shipped short-track documents fail the hook | Em dashes (U+2014), `grep -ro $'\xe2\x80\x94' <file> \| wc -l`: `standard/AGENT-PRACTICES.short.md` 43, `templates/HANDOFF.short.md` 7, `templates/skills/handoff.md` 6, `templates/skills/close-out.md` 5. `no-em-dash.sh check` fails on the short standard and on the short ledger template | run 2026-10-01 |
| G8 | Skills by track | Light gets `/close-out` and `/handoff`; non-code + full gets four, without `/clean-up` (`src/render/skills.ts:44-47`). The `skills` question has two values, `all` and `none`, and its label names the five (`src/questions/you.ts:356-375`) | the code |
| G9 | Rules by track | `commits.md` for code in git, `model-routing.md` for full weight, `docs-lookup.md` for code (`src/render/rules.ts:20-28`). A non-code person gets `model-routing.md` at most | the code |
| G10 | One merge owns `settings.json`, and its strings differ from Zach's | `renderHooks` merges hooks and the output style in one write (`src/render/hooks.ts:23-40`). `hooks: none` writes nothing there (`:88-90`). The merge de-duplicates by exact JSON (`:128-133`), and the engine writes absolute script paths (`:148-153`), where Zach's entry reads `~/.claude/hooks/no-em-dash.sh post` | the code |
| G11 | The stamp guard keeps Zach's files | A file on disk with no stamp is refused, not overwritten (`src/lib/write-plan.ts:72-108`). Rendered to Zach's paths, his four files stay as they are | the code |
| G12 | Terminal and site take defaults from different places | `defaultFor` uses `STORED_PROFILE_DEFAULTS` first for every run, interactive or `--yes` (`src/phases/run.ts:58-71`, `src/lib/stored-profile-defaults.ts:20-25`). The site's `defaultAnswer` reads `recommended` only (`~/Projects/portfolio/src/lib/catalog.ts:125-129`). They agree because each stored default equals its question's recommended option | both repos |
| G13 | Every question so far recommends the answer that changes nothing | DIAL-1/2/3 and DIAL-7 (`docs/incomplete/setup-tracks/DESIGN.md` section 5), D19, and the `output-style` comment (`src/questions/you.ts:327-333`). STE-on is the first recommended answer that adds a file to a stored profile's output | the docs, the code |
| G14 | `--yes` still previews and confirms | Only `--force` or a missing TTY skips the confirm (`src/commands/setup.ts:448-459`) | the code |
| G15 | Catalog and release state | 46 questions, `catalogVersion` `0.7.0+a96e489b`; split `you 16, discover 15, practices 15` (`tests/catalog.test.ts:57`). `0.7.0` is tagged and on npm (`npm view personal-config version`). The portfolio pins `0.6.1` (`~/Projects/portfolio/package.json:20`) | run 2026-10-01 |
| G16 | Long-form test | Each `readMore` id needs a `docs/choices/` file over 400 characters (`tests/cli.test.ts:86`) that the catalog carries (`tests/catalog.test.ts:67-74`) | the tests |
| G17 | What Claude Code does with rules, skill files and skill hooks | A user rule with no `paths` loads in every session. A skill folder can hold supporting files that load only when read. A skill's frontmatter can carry hooks, which register when the skill runs and stay for the rest of that session | Context7 `/websites/code_claude`, pages `memory`, `slash-commands`, `hooks`, queried 2026-10-01 |
| G18 | The skill fires on README requests | Its description lists "README" (`~/.claude/skills/write-doc/SKILL.md:3`) | the file |
| G19 | The chat rule says nothing about irony or litotes | `language-style.md` has neither word; `writing-style.md` bans both but scopes itself to documents (its lines 1-9) | both files |
| G20 | The ledger stops at step 89 | `grep -nE "^\*\*[0-9]+\. " HANDOFF.md \| tail -1` is step 89. Commits `c935160` (0.6.1) through `e8f70bb` have no step | run 2026-10-01 |

## 2. What this is, and what it is not

**What this is.** Three new questions and what they write.

- `chat-style` writes an ASD-STE100 chat-reply rule to `~/.claude/rules/language-style.md`, on
  every track and both weights (D2, D3, D4).
- `write-doc` installs an adapted `/write-doc` on the non-code track: the provenance check, the
  review against the marks of machine writing, the source check, and a check script (D5, D6).
- `write-doc-check` asks whether that script also runs as a hook on every document the agent
  saves (D7).

`chat-style` and `write-doc` each get a long form in `docs/choices/`. `write-doc-check` shares
`write-doc`'s, as `model-light-enabled` and `model-light` share `model-tiers`
(`src/questions/you.ts:205`, `:234`). Each question gets a catalog entry, a stated reading for a
profile saved before it existed, and tests. The scope promised "an answer in each shipped profile";
`PLAN.md` BD-1 narrows that, because all three shipped profiles are code-track.

**What this is not.** These stay out until a dated supersession says otherwise.

- **`/counsel`.** Left out 2026-10-01 at Zach's request (D1).
- **An edit to `standard/`.** Frozen by policy. The short standard keeps its 43 em dashes, which
  is why G7 shaped D7.
- **A change to Zach's own `~/.claude` files.** G11 keeps them; this work does not migrate them.
- **A change to the existing 46 questions**, including the two values of `skills`, the text of
  their options, and the three values of `hooks`.
- **Bundle 2**, a hook in the skill's frontmatter (D6).
- **A rule file for the document style** in `~/.claude/rules/`, on any answer (D6).
- **A hook for Word files.** The hook runs on `Write|Edit` only; a Word file is checked by the
  skill's own last step (D7).
- **A promise about AI detectors.** The skill's Limits section says its rules do not lower
  detector scores, and the shipped skill keeps that sentence.
- **A general style linter.** The script keeps its three checks: em dash, contraction, banned
  word or phrase.
- **Publishing, pushing, deploying, the version cut and the portfolio pin.** Zach's, as always.

## 3. Decisions

### D1. Three questions, and `/counsel` stays out

**Decision.** This effort adds `chat-style`, `write-doc` and `write-doc-check`, and nothing else
from Zach's own setup.

**Defense.** Zach asked on 2026-10-01 to scope the writing skill and the STE question, and to leave
`/counsel` out. The reasons given in chat stand as the record: it needs a renderer for
`~/.claude/agents/` that the engine lacks, it names `opus` and `fable` directly where the engine
maps tiers through `src/questions/model-ids.ts`, a repo whose tier ceiling removes Deep would
block its chairman, and a full run is eleven agent runs. The third question is the packaging
choice handed to the person at the gate (D7).

**Date.** 2026-10-01.

### D2. `chat-style` is asked of everyone and recommends STE

**Decision.** `chat-style` sits in the `you` phase with no `when`, so every track and both weights
see it. Its first answer, **Short and plain**, is recommended and writes the rule. **However it
likes** writes nothing.

**Defense.** The rule shapes every reply in every session, which makes it a fact about the person,
and the `you` phase is where those facts live (`src/questions/you.ts:3-5`). Zach's call, in chat on
2026-10-01: "recommend ste on".

**Against, and why it lost.** Everyone who takes the recommendation pays for the rule in every
session: Zach's copy is 730 bytes (G2), about 180 tokens at four bytes a token. The model also
approximates STE without the standard's dictionary of approved words (hazard 8). The owner made
the call with that cost in view, and the long form states both limits so a person can answer no
knowing them.

**Date.** 2026-10-01.

**As built: 2026-10-01, Phase 1 (HANDOFF 91).** The rendered rule is 894 bytes with its stamp,
about 220 tokens at four bytes a token, against the 730 bytes of the owner's copy that this
defense used. `docs/choices/chat-style.md` states the rendered figure.

### D3. The rule is the owner's, generalized, with one line added on irony and litotes

**Decision.** `language-style.md` carries the owner's rule (G2) in general form: the five STE lines
with DIAL-5's caps, scoped to chat replies, and code, commit messages and file contents keeping
their own project's rules. It adds one line: no irony, no sarcasm and no litotes in chat replies.
This is rule option 1.

**Defense.** G19: the behavior the owner finds helpful, replies with neither irony nor litotes,
rests on no written rule for chat.

**Against, and why it lost.** STE already bans unclear meaning, so the line restates it, at the
cost of one line in every session. The scope put this reading to the gate with an invitation to
object, and Zach did not object (§8.2).

**Rejected.** Rule option 2, the generalized rule with nothing added, lost on G19.

**Date.** 2026-10-01.

**As built: 2026-10-01, Phase 1 (HANDOFF 91).** The wording this decision left open, as
`src/render/rules.ts` renders it. The irony line is the sixth item of the list, after the five STE
lines: "Do not use irony, sarcasm or litotes. Say the direct thing", followed by the example of
"good" in place of "not bad". The scope sentence says "chat replies" where the owner's says
"replies". BD-3's sentence reads "Papers, documents and other written work are outside this
rule." The rule is in the first person, as `commits.md` is.

### D4. A profile saved before `chat-style` existed reads "on" (E1)

**Decision.** `chatStyle` gets no stored default. A profile with no answer reads the recommended
answer, **Short and plain**, wherever an answer is read: the wizard's default (`defaultFor`,
`src/phases/run.ts:58-71`) and the renderer's own fallback alike. A re-run of an old profile
therefore gains `language-style.md`, shown in the preview and confirmed like every other file.

**Defense.** It is the plain meaning of "recommend ste on". The terminal and the site start the
question on the same answer, because the site reads `recommended` and the terminal falls through
to it (G12). The person still sees the new file and confirms it, `--yes` included (G14).

**Against, and why it lost.** It is the first recommended answer that changes what a stored
profile renders (G13). A person who re-runs to change one answer and accepts the batch gets a rule
that changes every chat reply in every session. Taken knowingly at the gate (§8.1).

**Rejected.** E2, a stored default of "off": `defaultFor` applies a stored default to fresh runs
too, so a new terminal user would start on "off" under a Recommended chip while the site starts on
"on" (G12), and "recommended" would become a label with no effect. E3, a stored default only for
profiles older than the question: it changes the mechanism behind DIAL-7 that every earlier
question relies on, and the site's short-id store would need the same marker, which crosses the
npm pin under setup-tracks D14's lockstep.

**Supersedes.** No written decision. setup-tracks DIAL-7 names the track keys
(`docs/incomplete/setup-tracks/DESIGN.md:323`), setup-tracks D19 names `output-style` only, and
the promise in `src/lib/stored-profile-defaults.ts:6-7` is about the track keys. D4 departs from
the pattern G13 lists, which was never written as a rule. The build adds one sentence to that file's
header saying `chatStyle` is absent on purpose, so a later session does not add it as a fix.

**Date.** 2026-10-01.

### D5. `write-doc` is asked on the non-code track only, on both weights (A1)

**Decision.** `write-doc` is asked only where the work kind is non-code, on the full and the light
weight.

**Defense.** On that track the documents are the work, and this is the one skill aimed at the work
itself; G8 lists only workflow rituals. The code track keeps its question count. Widening later is
a one-line `when` change, the cheap direction setup-tracks D13 names.

**Against, and why it lost.** Zach runs the code track and uses this skill every week, so the tool
never installs it for its own author. The class this repo was built for writes papers, and most of
them will answer "Code". Zach chose A1 as recommended (§8.1).

**Rejected.** A2, every track: the provenance check is about authorship, which every track has, and
a student who writes code also writes papers. It lost because it adds a screen for every coder, and
G18 means a coder who asks for a README gets the provenance gate and the style review whether they
wanted them or not.

**Date.** 2026-10-01.

**Amended 2026-10-01 by D10.** The work kind and the weights stand; D10 adds a condition on
`skills`.

### D6. The style file and the check script live inside the skill (Bundle 1)

**Decision.** Every "yes" to `write-doc` writes one folder, `~/.claude/skills/write-doc/`, holding
`SKILL.md`, `style.md` (the generalized `writing-style.md`) and `check.sh`. The skill reads
`style.md` in its first step and runs `check.sh <file>` in its last. No answer writes a style rule
to `~/.claude/rules/`.

**Defense.** Sessions that never write a document pay no tokens for the style (G17). Nothing fires
on the short standard or the short ledger (G7). Removing it is one folder.

**Against.** A document written without the skill is never styled, and the check depends on the
agent reaching the skill's last step. Zach's own setup has a global hook for exactly that reason.
D7 answers this by making the hook a choice rather than dropping it.

**Rejected.** Bundle 3, a global rule and a global hook in Zach's shape: about 1,500 tokens in every
session in every project (5,880 bytes at four bytes a token), and a hook that blocks agent edits to
the short standard and the short ledger the same run writes (G7, seen live on 2026-10-01). Bundle
2, a hook in the skill's frontmatter: the hook stays registered for the rest of the session, so a
close-out in that session hits G7, and a hook installed under a `hooks: none` answer breaks what
that answer promised. Zach took Bundle 2 off the menu (§8.2).

**Date.** 2026-10-01.

### D7. Whether the check runs on every save is the person's choice (`write-doc-check`)

**Decision.** `write-doc` keeps two values. A follow-up question, `write-doc-check`, is asked only
when `{ all: [{ key: 'writeDoc', is: 'yes' }, { key: 'hooks', isNot: 'none' }] }`. Both forms exist
in `src/lib/when.ts`, so the site needs no code change. Its answers:

- **Only what /write-doc writes**, recommended: Bundle 1 alone, and no hook is installed.
- **Every document it saves**: Bundle 1 plus one `PostToolUse` entry on `Write|Edit` that runs
  `check.sh` in hook mode. The style file stays inside the skill, so no session pays for a global
  rule. A file that carries a `personal-config` stamp where a renderer puts one (`readStamp`,
  `src/lib/stamp.ts`) is skipped, because the generated ledger, router and short standard are all
  planned with a stamp (`planned()` in `src/render/context.ts`), and that is the answer to G7.

**Defense.** Zach asked at the gate that the packaging be the person's choice (§8.1). A single
option cannot carry its own condition, because `QuestionOption` (`src/lib/types.ts:12`) has no
`when` and only `Question` does (`:55`); and `hooks: none` promises that nothing reaches
`settings.json` (G10). A third option on `write-doc` would contradict a `hooks: none` answer with
no way to hide it. A follow-up gated on both answers keeps both promises.

**Against.** One more screen. A non-code person who says yes to the skill and allows hooks sees
three new screens; a coder sees one. The catalog goes from 46 to 49 questions.

**Date.** 2026-10-01.

**Amended 2026-10-01.** The `when` above gains two conditions, and its two stand: `workKind` is
`non-code` (`PLAN.md` BD-2) and `skills` is not `none` (D10).

### D8. The copy is the warm register, for all three questions

**Decision.** Settled under R7, 2026-10-01:

- `chat-style`: **How should your agent talk to you?** with **Short and plain** (ASD-STE100: short
  sentences, one word for one meaning, no irony) / **However it likes** (no rule is written).
- `write-doc`: **Do you want help writing documents you can stand behind?** with **Yes, install
  /write-doc** (it asks you for anything only you can say, then checks the draft) / **No** (nothing
  is written to `~/.claude/skills/write-doc/`).
- `write-doc-check`: **Should your agent check every document it saves, or only what /write-doc
  writes?** with **Only what /write-doc writes** (no hook is installed) / **Every document it
  saves** (a hook flags em dashes, contractions and stock AI phrases; files this setup generated
  are skipped).

**Defense.** The warm register was the recommendation for the first two and was taken as
recommended; Zach chose warm for the third (§8.1, §8.2). The plain and terse variants the gate saw
are in §8.

**Date.** 2026-10-01.

### D9. `write-doc` recommends "Yes", and an old profile reads it that way

**Decision.** **Yes, install /write-doc** is the first option and the recommended one. `writeDoc`
gets no stored default, so a profile saved on a non-code run before the question existed reads
"yes" and gains the skill folder on a re-run, shown in the preview and confirmed, as D4 does for
`chatStyle`.

**Defense.** D5's reason for asking on the non-code track is that the documents are the work
there, and a "no" recommendation on the only track that sees the question argues against asking it.
None of the three shipped profiles changes, because all three are code-track (`PLAN.md` G27).
Zach's answer at GATE 2, in chat, 2026-10-01.

**Against, and why it lost.** It is the second recommended answer, after D4, that adds files to
what a stored profile renders (G13). A non-code person who re-runs and accepts the batch gets a
skill whose description fires on README and report requests (G18). On this track that is the
point of the skill, and the preview shows the folder before anything is written (G14).

**Rejected.** "No" as the recommended answer: no saved profile changes, and the question keeps the
pattern G13 lists. It lost on D5's own defense.

**Date.** 2026-10-01.

### D10. `write-doc` is not asked when `skills` is `none`

**Decision.** `write-doc` is asked only when the work kind is non-code and `skills` is not `none`.
`write-doc-check`, and every renderer that reads `writeDoc`, carry the same `skills` condition.

**Defense.** The `none` option of `skills` says "Nothing is written to `~/.claude/skills/`"
(`PLAN.md` G25), and `/write-doc` writes there. This keeps that promise the way D7 keeps the
promise of `hooks: none`, and it changes no existing question (§2). Zach's answer at GATE 2, in
chat, 2026-10-01.

**Against, and why it lost.** A non-code person who wants help with documents and none of the
workflow skills cannot get the first without the second. The workflow skills on that track are
two or four files (G8), and the person can delete the ones they do not use; a promise that is
false after a yes is worse.

**Rejected.** Asking `write-doc` anyway with the `none` option reworded to "no workflow skills":
it reopens §2's line that the existing questions do not change. Asking it with no rewording: the
option's text becomes false for anyone who then says yes.

**Supersedes, in part.** D5's condition, which named the work kind only. The work kind and the
weights stand.

**Date.** 2026-10-01.

## 4. Dials

Recommended at the scope and not put to GATE 1 as questions. GATE 2 ratifies them with the plan;
`PLAN.md` §3 carries them and adds three the gate's answers opened.

| Dial | What it sets | Recommended value |
|---|---|---|
| DIAL-1 | Skill name | `write-doc`, the same as Zach's. G11 keeps his copy on his machine; a second name would load two skills with overlapping descriptions there |
| DIAL-2 | Chat rule path | `~/.claude/rules/language-style.md`, same reason |
| DIAL-3 | Config keys and values | `writeDoc: yes \| no`; `chatStyle: ste \| none`. Two values each, as setup-tracks D2 asks of track questions |
| DIAL-4 | Who the skill names | "the author" wherever Zach's copy says "Zach"; the label **Needs Zach** becomes **Needs the author** |
| DIAL-5 | STE sentence caps | 20 words for instructions, 25 for descriptions, as Zach's rule has them |
| DIAL-6 | The banned-word list | Zach's list as it stands, with its two sources named in the long form: the Wikipedia guide "Signs of AI writing" and Kobak and colleagues' excess-vocabulary study |
| DIAL-7 | The GPTZero result | Out of the skill, which keeps the general limit. The figure moves to `docs/choices/write-doc.md`, labelled as one person's worked example |
| DIAL-8 | Where the questions sit | `chat-style` after `output-style`, since both shape how the agent behaves in every session; `write-doc` after `skills` |
| DIAL-9 | The Word-file step | "If a skill for Word files is available, use it", in place of "the docx skill" |

DIAL-7 above is this effort's dial. setup-tracks DIAL-7, the reading of a stored profile, is a
different thing and is always written with its folder.

## 5. Rules that survive unchanged

- `standard/` is untouched, the short standard's 43 em dashes included.
- The 46 existing questions keep their ids, values, option text and `when`s.
- `hooks: none` still writes nothing to `settings.json`. `write-doc-check` is never asked under
  it, so the hook entry cannot reach `settings.json` that way.
- `settings.json` still goes through one merge in `src/render/hooks.ts`, de-duplicated by exact
  JSON, and every entry string earlier versions wrote stays byte for byte (`src/render/hooks.ts`,
  the `gateCommand` comment).
- `STORED_PROFILE_DEFAULTS` keeps its four keys, and the DIAL-7 mechanism is unchanged (E3 is
  rejected).
- `WhenSpec` gains no form, so the site needs only the pin bump.
- The five workflow skills, their track table (G8) and their trigger lines are unchanged.
- The stamp format and the positions a stamp may sit on (`stampIndex`, `src/lib/stamp.ts`) are
  unchanged; `check.sh` reads them and does not redefine them.
- The script keeps three checks, and the skill keeps its sentence that the rules do not lower
  detector scores.
- Zach's own `~/.claude` files are not migrated, edited or read at run time.

## 6. Hazards this work walks into

1. **G7 meets the hook.** Answered by D7's stamp skip. The skip lives in a bash script while
   `stampIndex` lives in TypeScript, so the two can drift; one fixture set tests both.
2. **G6, in every mode.** `check.sh` must fail loudly when it cannot read what it was given: no
   `perl`, no `textutil` for a Word file, no `jq` in hook mode. A check that prints `PASS` on text
   it never read is the silent failure this repo's tier table exists for. The fix is a build
   obligation, with a test for each missing tool.
3. **Bash 3.2.** macOS ships bash 3.2.57. The delete guard was tested under it (HANDOFF 70), and
   this script must be too.
4. **Answer-dependent prose belongs in code.** `/write-doc` reports to the author in STE only when
   `chatStyle` is `ste`, and says the check also runs on every save only when `writeDocCheck`
   says so. Those branches go in the renderer's variables, as `/close-out`'s do, never as two
   templates.
5. **Counts and tests turn red on purpose.** The catalog goes from 46 to 49 and `you` from 16 to
   19 (`tests/catalog.test.ts:57`). Under D4, every track's planned file list gains
   `language-style.md`, so `tests/golden/full-track.json` and `tests/tracks.test.ts` change.
6. **The pin.** A new question set is a minor version, setup-tracks D19's rule, so `0.8.0`. No new
   `WhenSpec` form is needed, so the site needs only the pin bump. It pins `0.6.1` (G15), two
   releases behind.
7. **STE has limits the long form must state.** The rule names the standard but ships without its
   dictionary of approved words, so the model approximates it. It is English only.
8. **Not in scope, flagged under R9.** G20: the ledger has no step for 0.6.1, 0.7.0 or the `pro`
   profile.

`PLAN.md` §5 adds the hazards found while planning, with their numbers.

## 7. What the gate settled, in one place

| Question | Answer | Decision |
|---|---|---|
| A: who is asked `write-doc` | A1, non-code only, both weights | D5 |
| B and C: where the style lives, how the check runs | Bundle 1, with the hook as the person's choice | D6, D7 |
| Rule text | Rule option 1, with the irony and litotes line | D3 |
| E: what "recommended: on" means for a stored profile | E1 | D4 |
| Copy | Warm, all three questions | D8 |
| GATE 2, question 1: which `write-doc` answer is recommended | Yes | D9 |
| GATE 2, question 2: what `skills: none` means for `write-doc` | Do not ask it | D10 |

## 8. Gate record

Kept as the scope put it and as the answers came back. The options' full defenses are in the
decisions above.

### 8.0 The questions, 2026-10-01

1. **A.** Who is asked the write-doc question: non-code only (recommended), or every track?
2. **B and C.** Which bundle: style file and check inside the skill (recommended), a hook in the
   skill's frontmatter, or Zach's global rule and global hook?
3. **E.** How "recommended: on" treats a stored profile: E1 (recommended), E2 or E3?
4. **Copy, under R7.** The ask lines and option labels, in three registers each:

   `chat-style`
   - *warm*: **How should your agent talk to you?** · **Short and plain** (ASD-STE100: short
     sentences, one word for one meaning, no irony) / **However it likes** (no rule is written)
   - *plain*: **Should your agent reply in Simplified Technical English?** · **Yes** (short
     sentences, active voice, one instruction per sentence) / **No** (no rule is written)
   - *terse*: **Plain-English replies?** · **Yes** / **No**

   `write-doc`
   - *warm*: **Do you want help writing documents you can stand behind?** · **Yes, install
     /write-doc** (it asks you for anything only you can say, then checks the draft) / **No**
     (nothing is written to `~/.claude/skills/write-doc/`)
   - *plain*: **Should the writing skill be installed?** · **Yes** (`/write-doc`: a claim check, a
     style review and a saved-file check) / **No**
   - *terse*: **Install /write-doc?** · **Yes** / **No**

The calls given before the gate, 2026-10-01: the scope is these two items and `/counsel` is out;
"recommend ste on"; and the reading that chat replies carry neither irony nor litotes, from Zach's
remark that their recent absence "is also helpful", put to the gate as a line for the shipped rule.

### 8.1 Answers, given by Zach in chat, 2026-10-01

- **A. A1, non-code only, both weights.** As recommended.
- **E. E1, an old profile reads "on".** As recommended. This is the first question whose
  recommended answer changes what a stored profile renders (G13), taken knowingly.
- **Copy. Warm, both questions.** As recommended.
- **B and C. Not chosen. Zach asked back: "Ask the user which one they want no?"** That is, the
  packaging becomes a choice for the person running setup. The follow-up proposal went out the
  same day, and its text is D7's.

### 8.2 Answers to the follow-up, given by Zach in chat, 2026-10-01

- **The follow-up question, as proposed.** `write-doc` keeps two values; `write-doc-check` is
  asked only under D7's `when`, with **Only what /write-doc writes** recommended. Bundle 2 is off
  the menu. B and C are closed by this answer.
- **Copy for the follow-up: warm.** As D8 gives it.
- **Rule option 1 stands.** The irony and litotes line was put to the gate with an invitation to
  object, and Zach did not object.
