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
