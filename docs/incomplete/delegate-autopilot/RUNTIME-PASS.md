# Runtime pass: `/delegate` and `/autopilot`

Each phase adds its own entries as it is built (`docs/AGENT-PRACTICES.md` Part 7). Zach walks
them; a walked entry gets the date and what was seen. The pass does not block the work. It
blocks the claim that something was seen working when it was not.

## Phase 1. `/delegate` (HANDOFF 103, board row 83)

Seen by the agent on 2026-10-04, without a live session: entry 1, from the dry-run output. Not
seen: the skill running in a session (entry 2).

1. **A hand-written `/delegate` is left alone.**
   - *Where.* This repo: `bun run setup --profile zach --yes --dry-run --projects-dir
     tests/fixtures`.
   - *Right answer.* Under `~/.claude/skills/delegate`, the line for `SKILL.md` carries the stamp
     guard's tag (no stamp, left alone), and the closing list of files left alone names
     `~/.claude/skills/delegate/SKILL.md`. Your own copy keeps its 87 lines. **Seen by the agent
     2026-10-04.**

2. **The shipped skill runs one ordinary row end to end.**
   - *Where.* A session in a repo set up with `personal-config setup` for code work on the full
     setup in git, with `skills: all` and a board, after your own `~/.claude/skills/delegate/` has
     been moved out of `~/.claude/skills/` (a personal skill wins over the shipped one of the same
     name, `PLAN.md` G44). Pick an `OPEN` row with a Default or Mechanical model, a written prompt,
     every "Waits on" item `DONE` and no owner question, and type `/delegate <row>`.
   - *Right answer.* The row reads `IN FLIGHT` before any agent starts. One builder runs in its own
     worktree with `model` set to the family of the row's tier, and brings that worktree to the
     base branch with `git merge --ff-only` before its first gate. It does not commit under
     `print-blocks` and does not touch `HANDOFF.md` or `PASSOFF.md`. A second agent, the auditor,
     runs in a second worktree, reproduces the diff there, re-runs the gates and returns a verdict
     with citations. On a clean or non-blocking verdict the session writes one ledger step at the
     next free number, naming both models, the worktree, the branch, "not yet committed" and the
     relay passes, marks the row `DONE` against it, and posts the hand-back blocks in chat. The
     main checkout's `git status --short` shows only the ledger and board changes.

## Phase 2. `/autopilot` (HANDOFF 104, board row 84)

Seen by the agent on 2026-10-05, without a live session: nothing beyond the rendered text and the
gates. Entry 3 is board row 85's to walk, with Zach present.

1. **Only a person can start it.**
   - *Where.* A session in a repo set up for code work on the full setup in git, with `skills: all`
     and a board. Ask the agent, without typing the command, to run the board unattended.
   - *Right answer.* The agent does not load `/autopilot`: its description is not in the agent's
     context, and a call to it is blocked. Typing `/autopilot` loads it, and its first line is the
     check that the person typed it.

2. **Project folders get `/delegate` alone.**
   - *Where.* This repo: render code, full, git with `workProfile: folders`, or run `setup` on a
     scratch repo that answers project folders.
   - *Right answer.* `~/.claude/skills/delegate/SKILL.md` is written and `autopilot/SKILL.md` is
     not. Neither `delegate/SKILL.md` nor `model-routing.md` names `/autopilot`. Seen by the tests
     (`tests/autopilot-skill.test.ts`, `tests/delegate-skill.test.ts`), not on disk.

3. **The supervised 30-minute run** (board row 85, `PLAN.md` Phase 3).
   - *Where.* Phases 1 and 2 committed and installed by `personal-config setup` in your real home,
     with your own `~/.claude/skills/delegate/` moved out of `~/.claude/skills/` first and moved
     back after. A new git repository outside this one, set up for code work on the full setup in
     git with `skills: all`, its first commit yours, and a board of two rows in two lanes with no
     shared files: one Mechanical (add a file and a test for it), one Default (a small change with
     a gate), each with a full prompt, a "Files it owns" cell and no owner question. Open a session
     there on the Default tier, type `/autopilot`, answer the opening round with an end time 30
     minutes away, and watch.
   - *Right answer.* The first `AskUserQuestion` call holds at most four questions, and none comes
     after the opening round. `STATE.md` appears under `docs/incomplete/autopilot-<date>/` before
     any builder starts, with every time absolute and zoned. Each row reads `IN FLIGHT` before its
     builder launches. Each builder runs in its own worktree on its row's family, and each row gets
     an auditor in a second worktree that reports its gates with their output. No agent edits the
     board or the ledger but the session, and no agent commits under `print-blocks`. Each signed-off
     row gets a ledger step naming its worktree and "not yet committed", and reads `DONE` against
     it. `STATE.md` gains one reading per wake and a **Reports** entry per row. Launches stop by the
     30-minute mark, and the run ends once nothing is in flight. `RUNDOWN.md` holds D13's ten
     sections in order, written from `STATE.md`, and the run's ledger step points at it. The main
     checkout's `git status --short` shows only the ledger, the board and the run folder.

   **Walked by Zach 2026-10-15, 08:15 to 08:20 EDT (board row 85, HANDOFF 111).** Seen running in a
   live session. The scratch repository was `~/Scratch/autopilot-pass/ap-scratch`, first commit
   `554533f` by Zach. Setup ran with a throwaway `HOME`, so Zach's own `~/.claude` was not
   rewritten; the shipped `/delegate` and `/autopilot` were already installed there (stamp line
   only differed) and his hand-written `/delegate` was already out of `~/.claude/skills/`. The
   checks below were read from the scratch repo and from the run's transcript
   (`~/.claude/projects/-Users-zachshort-Scratch-autopilot-pass-ap-scratch/0c0562d6-*.jsonl` and its
   four subagent files).

   - *First call holds at most four questions, none after.* **Seen.** One `AskUserQuestion` with
     four questions (stop limit, agents at once, unattended readiness, model mapping). Zach typed
     "30 minutes" and "light is haiku 5.5". No later question.
   - *`STATE.md` before any builder, every time absolute and zoned.* **Seen.** Written at 08:17:15,
     builders launched at 08:17:22 and 08:17:27. Times read `2026-10-15 08:17 EDT`. Two reports
     read `~08:2x EDT`, which is not absolute.
   - *Each row `IN FLIGHT` before its builder.* **Seen.** Both board edits at 08:17:09 to 08:17:10.
     The claim was a hand edit: `personal-config passoff claim` resolved to the dev wrapper
     `scripts/personal-config`, which does not forward `passoff` (row 97).
   - *Each builder in its own worktree on its row's family.* **Seen.** Row 1 `model: sonnet`, row 2
     `model: opus`, both `isolation: worktree`.
   - *Each row gets an auditor in a second worktree that reports gates with output.* **Seen, with a
     gap.** Two Opus auditors in their own worktrees, `bun test` 4 pass each. Neither could run
     `git -C <builder worktree>`: the harness's worktree isolation refuses it. They reproduced the
     change with `diff`, `cmp`, `cp` and `git apply` instead (row 95).
   - *No agent edits the board or the ledger but the session.* **Seen.** No subagent `Edit` or
     `Write` outside its own worktree and the session scratchpad. The row 2 builder read the main
     checkout's `HANDOFF.md` with `cat`.
   - *No agent commits under `print-blocks`.* **Seen.** All four worktree branches sit at `554533f`.
     The commit guard also blocked two `git -C $W merge --ff-only main` preflights, where `$W` was a
     shell variable; the literal-path form passed with "Already up to date" (row 95).
   - *Each signed-off row gets a ledger step naming its worktree and "not yet committed", and reads
     `DONE` against it.* **Seen.** Steps 1 and 2; rows 1 and 2 `DONE — HANDOFF 1` and `2`.
   - *`STATE.md` gains one reading per wake and a Reports entry per row.* **Partly.** No wake
     fired: the 600 s wake was stopped at 08:20:16 once both rows were signed off, so one reading
     is right. Reports has the two builders and the row 1 auditor; the row 2 auditor's report is
     missing, and both Rows lines still read `worktree: pending report` (row 95).
   - *Launches stop by the 30-minute mark; the run ends once nothing is in flight.* **Seen.** Both
     rows launched at 08:17. The run ended at 08:20, five minutes in, because the board was done.
     That is the skill's stop rule, not a short run.
   - *`RUNDOWN.md` holds D13's ten sections in order, from `STATE.md`; the run's step points at it.*
     **Seen.** Ten sections in D13's order; ledger step 3 names the file.
   - *The main checkout's `git status --short` shows only the ledger, the board and the run folder.*
     **Seen.** `?? docs/incomplete/` only; the ledger and board are ignored by Zach's global git
     ignore, and `.claude/worktrees/` is ignored too.

   Not checked: the run under a 30-minute budget that actually binds (two rows finish in five
   minutes), a wake firing, a fix round, a held row, a compaction.

   Also found: builders in a worktree have no `HANDOFF.md`, `PASSOFF.md` or
   `docs/AGENT-PRACTICES.md`, because Zach's global git ignore keeps all three out of git and a new
   worktree holds only tracked files (rows 95 and 98). A clean-`HOME` render of the `zach` profile
   writes `Light | <unset>` though the profile names Haiku 4.5 (row 96).
