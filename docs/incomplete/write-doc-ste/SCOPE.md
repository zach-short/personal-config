# Scope: the writing skill and the plain-English chat rule

Offer `/write-doc` on the non-code track, and ask every person whether their agent should reply in
ASD-STE100 Simplified Technical English.

**Status.** SCOPING, opened 2026-10-01, Opus 5.5. Gate answered in full on 2026-10-01; the
answers are in section 7. Sections 1 to 6 are the scope as it went to the gate and are not edited
to match the answers.

**Calls already given, 2026-10-01.**

- **Scope is these two.** Zach asked to scope `write-doc` and the STE question. `/counsel` is
  out (section 2).
- **STE is the recommended answer.** "recommend ste on", in chat.
- **Chat replies carry no irony and no litotes.** Zach said the recent lack of both in chat
  replies "is also helpful". This scope reads that as a line for the shipped STE rule (option
  D1). If that reading is wrong, the gate is the place to say so.

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

**What this is.** Two new questions and what they write. The first installs an adapted
`/write-doc`: the provenance check, the review against the marks of machine writing, the source
check, and a check script. The second writes an ASD-STE100 chat-reply rule, on every track and
both weights. Each gets a long form in `docs/choices/`, a catalog entry, an explicit reading for
old profiles, an answer in each shipped profile, and tests.

**What this is not.** These stay out until a dated supersession says otherwise.

- **`/counsel`.** Left out 2026-10-01 at Zach's request. The reasons given in chat stand as the
  record: it needs a renderer for `~/.claude/agents/` that the engine lacks, it names `opus` and
  `fable` directly where the engine maps tiers through `src/questions/model-ids.ts`, a repo whose
  tier ceiling removes Deep would block its chairman, and a full run is eleven agent runs.
- **An edit to `standard/`.** Frozen by policy. The short standard keeps its 43 em dashes, which
  is why G7 shapes option C.
- **A change to Zach's own `~/.claude` files.** G11 keeps them; this work does not migrate them.
- **A change to the existing 46 questions**, including the two values of `skills`.
- **A promise about AI detectors.** The skill's own Limits section says its rules do not lower
  detector scores, and the shipped skill keeps that sentence.
- **A general style linter.** The script keeps its three checks: em dash, contraction, banned
  word or phrase.
- **Publishing, pushing, deploying and the portfolio pin.** Zach's, as always.

## 3. Options

Each option carries its defense and the strongest argument against it. The recommendation is
marked; section 6 asks.

### A. Who is asked the write-doc question

**A1. Non-code only, both weights.** *Recommended.*
Defense: on that track the documents are the work, and this is the one skill aimed at the work
itself (G8 lists only workflow rituals). The code track keeps its 33 screens. Widening later is a
one-line `when` change in the catalog, the cheap direction D13 names.
Against: Zach runs the code track and uses this skill every week, so the tool would never install
it for its own author. The class this repo was built for writes papers, and most of them will
answer "Code".

**A2. Every track.**
Defense: the provenance check is about authorship, which every track has. A student who writes
code also writes papers.
Against: one more screen for every coder, and G18 means a coder who asks for a README gets the
provenance gate and the style review whether or not they wanted either.

### B and C. Where the style rules live, and how the check runs

These two are asked together, as three bundles, because each storage choice pairs with one way of
running the check.

**Bundle 1. Style file inside the skill, check run by the skill.** *Recommended.*
`~/.claude/skills/write-doc/` holds `SKILL.md`, `style.md` (the generalized `writing-style.md`)
and `check.sh`. The skill reads `style.md` in its first step and runs `check.sh <file>` in its
last. No rule file, no hook entry, no change to `settings.json`.
Defense: zero tokens in sessions that never write a document (G17). No conflict with the short
standard or the short ledger (G7), because nothing fires on their edits. `hooks: none` keeps its
promise. Removing it is one folder.
Against: a document written without the skill is never checked and never styled, and the check
depends on the agent reaching the skill's last step. Zach's own setup has a global hook for
exactly that reason.

**Bundle 2. Style file inside the skill, check as a hook in the skill's frontmatter.**
Defense: the check runs on every save once the skill has run, with nothing added to
`settings.json` (G17).
Against: the hook stays registered for the rest of the session, so a close-out in that session
edits the ledger and hits G7's conflict. A hook installed under a `hooks: none` answer also breaks
what that answer promised.

**Bundle 3. Zach's shape: a global rule and a global hook.**
`writing-style.md` in `~/.claude/rules/`, `no-em-dash.sh` in `~/.claude/hooks/`, two
`PostToolUse` entries merged into `settings.json`, installed only when `hooks` is not `none`.
Defense: every document in every session is styled and checked, the strongest coverage of the
three.
Against: about 1,500 tokens in every session in every project (5,880 bytes at four bytes a token),
and a hook that fires on every markdown edit. The same run writes a short standard and a short
ledger that fail it (G7), so every agent edit near their em dashes is blocked. This was seen live
on 2026-10-01 in this session.

### D. What the shipped STE rule says

**D1. Zach's rule, generalized, plus one line: no irony, no sarcasm, no litotes in chat.**
*Recommended, and taken from Zach's message of 2026-10-01.*
Defense: G19 shows that the behavior Zach likes rests on no written rule for chat.
Against: STE already bans unclear meaning, which covers both, so the line restates. It costs one
line in every session.

**D2. Zach's rule, generalized, with nothing added.**
Defense: shortest. Against: G19.

### E. What "recommended: on" means for a stored profile

G12 and G13 make this a real fork. The STE question is the first whose recommended answer adds a
file to what an existing profile renders.

**E1. Recommended on, with no stored default.** *Recommended.*
A stored profile with no answer reads "on", so a re-run gains `language-style.md`. The terminal
and the site agree.
Defense: it is the plain meaning of Zach's call, and G14 means the person still sees the new file
in the preview and confirms it, `--yes` included.
Against: it breaks the pattern behind DIAL-7, that a stored profile keeps rendering what it
rendered. A person who re-runs to change one answer and accepts the batch gets a rule that
changes every chat reply in every session.

**E2. Recommended on, stored default "off".**
Defense: every old profile renders as before.
Against: `defaultFor` applies the stored default to fresh runs too, so a new terminal user starts
on "off" while "on" carries the Recommended chip, and the site starts on "on" (G12). Terminal and
site then disagree, and "recommended" becomes a label with no effect.

**E3. Recommended on, and the stored default applies only to a profile older than the question.**
Defense: both promises hold.
Against: it changes DIAL-7's mechanism, which every earlier question relies on. A profile needs a
marker of which questions it answered, and the short-id profile store on the site needs the same
marker, which crosses the npm pin under D14's lockstep.

## 4. Dials

| Dial | What it sets | Recommended value |
|---|---|---|
| DIAL-1 | Skill name | `write-doc`, the same as Zach's. G11 keeps his copy on his machine; a second name would load two skills with overlapping descriptions there |
| DIAL-2 | Chat rule path | `~/.claude/rules/language-style.md`, same reason |
| DIAL-3 | Config keys and values | `writeDoc: yes \| no`; `chatStyle: ste \| none`. Two values each, as D2 asks of track questions |
| DIAL-4 | Who the skill names | "the author" wherever Zach's copy says "Zach"; the label **Needs Zach** becomes **Needs the author** |
| DIAL-5 | STE sentence caps | 20 words for instructions, 25 for descriptions, as Zach's rule has them |
| DIAL-6 | The banned-word list | Zach's list as it stands, with its two sources named in the long form: the Wikipedia guide "Signs of AI writing" and Kobak and colleagues' excess-vocabulary study |
| DIAL-7 | The GPTZero result | Out of the skill, which keeps the general limit. The figure moves to `docs/choices/write-doc.md`, labelled as one person's worked example |
| DIAL-8 | Where the questions sit | `chat-style` after `output-style`, since both shape how the agent behaves in every session; `write-doc` after `skills` |
| DIAL-9 | The Word-file step | "If a skill for Word files is available, use it", in place of "the docx skill" |

## 5. Hazards this work walks into

1. **G7, if bundle 2 or 3 is taken.** The hook and the short track's own documents disagree, and
   `standard/` cannot change to fix it.
2. **G6, in every bundle.** `check.sh` must fail loudly when it cannot read a file: no `perl`, no
   `textutil` for a Word file. A check that prints `PASS` on text it never read is the silent
   failure this repo's tier table exists for. The fix is a build obligation, with a test for each
   missing tool.
3. **Bash 3.2.** macOS ships bash 3.2.57. The delete guard was tested under it (HANDOFF 70), and
   this script must be too.
4. **Answer-dependent prose belongs in code.** `write-doc` reports to the author in STE only when
   `chatStyle` is `ste`. That branch goes in `variables()` in `src/render/skills.ts`, as
   `/close-out`'s branches do, never as two templates.
5. **G12, if E2 is taken.** Terminal and site start the same question on different answers.
6. **Counts and tests turn red on purpose.** The catalog goes 46 to 48 and `you` goes 16 to 18
   (`tests/catalog.test.ts:57`). Under E1, every track's planned file list gains
   `language-style.md`, so `tests/golden/full-track.json` and `tests/tracks.test.ts` change.
7. **The pin.** A new question set is a minor version, D19's rule, so `0.8.0`. No new `WhenSpec`
   form is needed, so the site needs only the pin bump. It pins `0.6.1` (G15), two releases
   behind.
8. **STE has limits the long form must state.** The rule names the standard but ships without
   its dictionary of approved words, so the model approximates it. It is English only.
9. **Not in scope, flagged under R9.** G20: the ledger has no step for 0.6.1, 0.7.0 or the `pro`
   profile.

## 6. Open questions for the gate

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

Answers are recorded below, dated, the turn they are given.

## 7. Answers

Given by Zach in chat, 2026-10-01, at the gate.

- **A. A1, non-code only, both weights.** As recommended.
- **E. E1, an old profile reads "on".** As recommended. This is the first question whose
  recommended answer changes what a stored profile renders (G13), taken knowingly.
- **Copy. Warm, both questions.** As recommended. Settled copy from here (R7):
  `chat-style` asks **How should your agent talk to you?** with **Short and plain** /
  **However it likes**; `write-doc` asks **Do you want help writing documents you can stand
  behind?** with **Yes, install /write-doc** / **No**.
- **B and C. Not chosen. Zach asked back: "Ask the user which one they want no?"** That is, the
  packaging becomes a choice for the person running setup. Open until the follow-up in 7.1 is
  answered.

### 7.1 B and C as a choice in the wizard, proposed 2026-10-01

Two facts shape this. A single option cannot carry its own condition: `QuestionOption`
(`src/lib/types.ts:12`) has no `when`, and only `Question` does (`:55`). And `hooks: none`
promises that nothing reaches `settings.json` (G10). So a third option on the `write-doc`
question, "Yes, and check every document", would contradict a `hooks: none` answer with no way to
hide it.

**Proposal.** Keep `write-doc` at two values. Add a follow-up question, `write-doc-check`, asked
only when `{ all: [{ key: 'writeDoc', is: 'yes' }, { key: 'hooks', isNot: 'none' }] }`. Both forms
exist in `src/lib/when.ts`, so the site needs no code change. Its answer:

- **Only inside /write-doc.** Bundle 1. *Recommended.*
- **Every document I save.** Bundle 1 plus one `PostToolUse` entry on `Write|Edit` that runs
  `check.sh` in hook mode. The style file stays inside the skill, so no session pays for a global
  rule. G7 is answered by one rule in the script: **a file that carries a `personal-config`
  stamp where a renderer puts one (`readStamp`, `src/lib/stamp.ts`) is skipped**, because the generated ledger, router and short standard
  are all planned with a stamp (`planned()` in `src/render/context.ts`; `src/render/repo.ts`
  renders the ledger through it).

Bundle 2, the hook in the skill's frontmatter, leaves the menu: it carries G7's conflict and
breaks `hooks: none`, and the follow-up covers its one advantage.

Cost: the catalog goes 46 to 49 and `you` goes 16 to 19. A non-code person who says yes to the
skill and allows hooks sees three new screens; a coder sees one.

### 7.2 Answers to 7.1, given by Zach in chat, 2026-10-01

- **The follow-up question, as proposed.** `write-doc` keeps two values; `write-doc-check` is
  asked only under the `when` above, with **Only what /write-doc writes** recommended. Bundle 2
  is off the menu. B and C are closed by this answer.
- **Copy for the follow-up: warm.** Settled copy (R7): **Should your agent check every document
  it saves, or only what /write-doc writes?** with **Only what /write-doc writes** (no hook is
  installed) / **Every document it saves** (a hook flags em dashes, contractions and stock AI
  phrases; files this setup generated are skipped).
- **D1 stands.** The irony and litotes line was put to the gate with an invitation to object, and
  Zach did not object.

Every gate question is answered. The next stage renames this file to `DESIGN.md` and writes the
answers in as `D1` to `Dn`, each with its defense and its strongest argument against.
