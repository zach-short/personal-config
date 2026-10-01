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
