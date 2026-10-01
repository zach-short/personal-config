# Runtime pass: the writing skill and the plain-English chat rule

Each phase adds its own entries as it is built (`docs/AGENT-PRACTICES.md` Part 7). Zach walks
them; a walked entry gets the date and what was seen. The pass does not block the work. It
blocks the claim that something was seen working when it was not.

## Phase 1. `chat-style` (HANDOFF 91, board row 73)

Seen by the agent on 2026-10-01, without a terminal: entry 2, from the dry-run output. Not seen:
the question in a terminal (entry 1) and a session that loads the rule (entry 3).

1. **The question is asked, with the recommended answer first.**
   - *Where.* A real terminal in this repo: `bun run setup --dry-run`. Walk the `you` phase to the
     question after "How should your agent handle unclear decisions?".
   - *Right answer.* "How should your agent talk to you?", with **Short and plain** (ASD-STE100:
     short sentences, one word for one meaning, no irony) first and selected, and **However it
     likes** (no rule is written) second. `← back` is offered. Your saved config has no
     `chatStyle` (`grep -c chatStyle ~/.config/personal-config/config.json` printed 0 on
     2026-10-01; the file was saved 2026-09-29), so the selection
     is also D4 seen in a terminal: an old profile starts on **Short and plain**. A dry run keeps
     the resume checkpoint (`retiresCheckpoint`, `src/lib/resume.ts:82-84`), so the next `setup`
     offers to resume it.

2. **A hand-written rule at the same path is left alone.**
   - *Where.* This repo: `bun run setup --profile starter --yes --dry-run --projects-dir
     tests/fixtures`.
   - *Right answer.* Under `~/.claude/rules`, the line for `language-style.md` carries the stamp
     guard's tag (no stamp, left alone), and the closing list of files left alone names
     `~/.claude/rules/language-style.md`. Your own copy keeps its 730 bytes. **Seen by the agent
     2026-10-01.**

3. **A session that loads the rule replies in plain English, with no irony.**
   - *Where.* A machine or account with no `~/.claude/rules/language-style.md` (a classmate's, or
     a fresh account): run `bun run setup` from this checkout and accept the batch. Then open a
     new Claude Code session and ask a question that invites a long answer.
   - *Right answer.* `~/.claude/rules/language-style.md` exists, with a `personal-config` stamp
     on line 1. The replies use short sentences, one instruction in each sentence, and the active
     voice, with no irony, sarcasm or litotes. Code, commit messages and files the agent writes
     keep their own project's style.

## Phase 2. `write-doc` and the check script (board row 74)

Seen by the agent on 2026-10-01: the check script run by hand on a clean draft, a draft with an
em dash, a `.docx`, and the same `.docx` with `textutil` off `PATH` (`PLAN.md`, Phase 2's
`As built:` note). Not seen: entries 1 to 3. Entry 2 is the half of the plan's proof that the
builder's harness refused to run.

1. **The question is asked of other work only, after the skills question.**
   - *Where.* A real terminal in this repo: `bun run setup --dry-run`. In the `you` phase, answer
     that the work is something other than code, then **All of them** to the skills question.
   - *Right answer.* The next screen is "Do you want help writing documents you can stand
     behind?", with **Yes, install /write-doc** first and selected, and **No** second. Walk
     `← back` to the skills question, answer **None**, and go forward: the question is not asked.
     Start again and answer that the work is code: it is never asked.

2. **The skill folder is written, and the script is executable.**
   - *Where.* Any shell, in this checkout: `export HOME="$(mktemp -d)"`, write a profile file with
     `"workKind": "non-code"`, `"configWeight": "light"`, `"usesGit": "no"`, `"skills": "all"`
     and no `writeDoc`, then `bun run setup --from <that file> --yes --force --projects-dir
     "$HOME"`. Then `ls -l "$HOME/.claude/skills/write-doc/"`.
   - *Right answer.* `SKILL.md`, `style.md` and `check.sh`, with `check.sh` as `-rwxr-xr-x`.
     `head -2 check.sh` shows `#!/usr/bin/env bash` and then the `personal-config` stamp.
     `"$HOME/.claude/skills/write-doc/check.sh" check <a clean .md>` prints `PASS` and exits 0.
     The real `~/.claude` is not touched.

3. **The skill asks before it writes a first-hand claim, and runs the check.**
   - *Where.* After entry 2, or on an account set up for other work: open a Claude Code session
     with that home and ask it to write a one-page reflection on a talk you attended, giving it
     only the talk's title.
   - *Right answer.* `/write-doc` fires. Before it drafts, it asks you in one message for what you
     saw and what you think, and it does not invent either. After it saves the file it runs
     `check.sh check <file>` by absolute path and reports the result, with a report in
     ASD-STE100 when the chat rule was written.

## Phase 3. `write-doc-check` and the hook (HANDOFF 93, board row 75)

Seen by the agent on 2026-10-01, in a temporary home: entry 2, and the piped payloads in entry
3's first half (`PLAN.md`, Phase 3's `As built:` note). The payloads were piped by hand, not sent
by a live session. Entry 4, added with board row 76 (HANDOFF 94), was seen the same day with its
answers read from a profile file. Not seen: entry 1, entry 3 in a live session, and entry 4's
questions answered by hand.

1. **The follow-up is asked after a yes to the skill, and only when hooks are on.**
   - *Where.* A real terminal in this repo: `bun run setup --dry-run`. Answer that the work is
     something other than code, any hooks answer but **No hooks**, **All of them** to the skills
     question, and **Yes, install /write-doc**.
   - *Right answer.* The next screen is "Should your agent check every document it saves, or
     only what /write-doc writes?", with **Only what /write-doc writes** (no hook is installed)
     first and selected, and **Every document it saves** second. Walk `← back` to the hooks
     question, answer **No hooks**, and go forward: the follow-up is not asked. Answer **No** to
     the skill instead: it is not asked either.

2. **One entry is merged, it runs the installed script, and a second run adds nothing.**
   - *Where.* Any shell, in this checkout. `export T="$(mktemp -d)"`, then `mkdir -p
     "$T/work/essays"`. Write a profile file with `"projectsDir"` set to `"$T/work"` and these
     answers: `"workKind": "non-code"`, `"configWeight": "light"`, `"usesGit": "no"`, `"hooks":
     "commit-guard"`, `"skills": "all"`, `"writeDoc": "yes"`, `"writeDocCheck": "every"`. Run
     `HOME="$T" bun run setup --from <that file> --yes --force --projects-dir "$T/work"` twice.
   - *Right answer.* `jq '.hooks.PostToolUse' "$T/.claude/settings.json"` shows one entry,
     matcher `Write|Edit`, command `$T/.claude/skills/write-doc/check.sh hook`, after each run.
     The second run prints "Everything is already current." Your own `~/.claude` is not touched.
     **Seen by the agent 2026-10-01.**

3. **A live session is told about an em dash right after it saves one, and the generated ledger
   is left alone.** The live check, for you to run.
   - *Where.* After entry 2, in a terminal: `cd "$T/work/essays"`, then start a session with
     the entry loaded for that session only: `claude --settings '{"hooks":{"PostToolUse":[{"matcher":"Write|Edit","hooks":[{"type":"command","command":"'"$T"'/.claude/skills/write-doc/check.sh hook"}]}]}}'`.
     Ask it to write `draft.md` with one sentence that joins two clauses with an em dash. Then
     ask it to append one line with an em dash to `HANDOFF.md`.
   - *Right answer.* After the first save the agent is shown a message that starts "check.sh
     found problems in the text just saved to" and names the em dash, and it edits `draft.md` to
     remove it. After the second save no message from `check.sh` appears, because `HANDOFF.md`
     carries a stamp on line 1. Your own em-dash hook may also run on both saves; its message
     starts "In" and the file path, and it is not this entry's. Seen by the agent with piped
     payloads only: exit 2 naming the em dash for the draft, exit 0 for the ledger.

4. **A declined run hands over the write-doc check entry with the others.** Board row 76.
   - *Where.* A real terminal in this repo: `bun run setup`. Answer that the work is something
     other than code, any hooks answer but **No hooks**, **All of them** to the skills question,
     **Yes, install /write-doc**, and **Every document it saves**. Answer **No** at "Write these N
     file(s)?". A declined run keeps the resume checkpoint (`retiresCheckpoint`,
     `src/lib/resume.ts`), so the next `setup` offers to resume it.
   - *Right answer.* "Nothing was written.", then the snippet. It holds `"PostToolUse"` with
     matcher `Write|Edit` and command `<home>/.claude/skills/write-doc/check.sh hook`, beside the
     other entries the plan holds. The last line names `~/.claude/hooks/personal-config and
     ~/.claude/skills/write-doc`. **Seen by the agent 2026-10-01**, at `5f4d17a`, in a
     pseudo-terminal driven by `expect`, with a temporary home and the answers of entry 2 read by
     `--from <that file> --yes`. Both confirms were real prompts, answered **No**. The snippet held
     `PreToolUse`, `PostToolUse` and `Stop`, in that order, and the last line read as above.
     Nothing was written to the temporary home, and your own `~/.claude/settings.json` kept its
     modification time and size. The questions were not answered by hand.
