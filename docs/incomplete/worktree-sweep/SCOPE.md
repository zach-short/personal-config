# SCOPE: sweep the worktrees a committed item left behind

**Status:** `RATIFIED` 2026-10-15: the question in section 6 was answered the same day, every recommendation taken (section 7). Opened 2026-10-15 as `SCOPING`. Owner: Zach. One repo, `personal-config`, at `d281489`
(`delegate and close-out remove the merged, clean worktrees they made`). Nothing is built until
`0ac7cf1` lands on `main`. Nothing in this task removed a worktree.

**Why this exists.** On 2026-10-15 subagent worktrees filled the disk: 36 worktrees under one
projects folder, about 55 GB, with free space near 3 GB. Commit `d281489` gave `/delegate` and
`/close-out` a last step that removes the worktrees the run made, but only when the branch is an
ancestor of the base and `git status --porcelain` prints nothing. Under the print-blocks commit
policy that step almost never fires, because the builder never commits and the auditor reproduces
the change by copying files. Both worktrees are dirty when the run ends, so the step keeps them,
and no later step comes back for them. This document lays out how a later sweep could remove
them safely. It decides nothing.

## 1. What exists, verified 2026-10-15

| Claim | Verified state | Citation |
|---|---|---|
| The end-of-run step removes only merged and clean worktrees, without `--force` or `-D` | Holds | `src/render/skills.ts:688-731` (`worktreeStep`, `worktreeCommands`, `worktreeLimits`) |
| Under print-blocks the builder does not commit and the owner commits in the builder's worktree | Holds. The builder is told "Do not commit"; the hand-back blocks are `git -C <worktree> add` and `git -C <worktree> commit` | `src/render/skills.ts:198`, `:258-261` |
| The auditor takes the builder's diff and untracked files into its own worktree | Holds | `src/render/skills.ts:199-204`; `templates/skills/delegate.md:80-92` |
| The harness refuses `git -C` on another agent's worktree, so auditors reproduce with `cp` | Seen in the 2026-10-15 run | `docs/incomplete/autopilot-2026-10-15/RUNDOWN.md:65` |
| A `COMMITTED, <date>, <short hash>` board status exists | Only on an unmerged commit. `0ac7cf1` (`add the committed board status and standard 2.1.0`) is not an ancestor of `main`; it sits in the detached worktree `committed-status-f2d341`. On `main` the vocabulary ends at `DONE` | `git merge-base --is-ancestor 0ac7cf1 main` exits 1; `templates/PASSOFF.md:8` |
| An item's close-out section names the branch, not the worktree path | Holds on `main` ("on which branch, at which commit"); `0ac7cf1` drops "at which commit" | `templates/item.md` close-out comment; `git show 0ac7cf1 -- templates/item.md` |
| The personal `land-worktrees` skill sorts dirty files as `base`, `gone`, `past` or `new` and removes a worktree only when none is `new` | Holds, but it is not shipped, so a template cannot name it | `~/.claude/skills/land-worktrees/SKILL.md`, "Survey" |

### Row 89, the live case

Row 89 (per-item-board Phase 3) ran through `/delegate` with one builder and two auditors. The
owner committed in the builder's worktree as `eb7b2cf`, and `main` now holds it. The three
worktrees are 95 MB each.

| Worktree | Dirty files | Against `main` | Against `eb7b2cf` (the item's commit) |
|---|---|---|---|
| builder `agent-a1628b2a6851169da` | 0 | clean | clean; the existing step removes it |
| auditor 2 `agent-ab30a2be78f717c89` | 10 | 7 equal, 3 differ | 9 equal; `PLAN.md` differs only by the `BUILT` status line the lead wrote into the builder's copy |
| auditor 1 `agent-a52fa03b95f9734ef` | 10 | 5 equal, 5 differ | 7 equal; 3 hold the version before the fix round, which exists nowhere else |

Three facts follow, and each shapes an option below. "Equal to what the base now holds" frees
neither auditor: later commits on `main` changed three of the files. "Equal to the item's commit"
still keeps auditor 2 over one status line. And auditor 1 holds content that no commit has, the
draft the blocking audit rejected, which a content check correctly calls new work although nobody
wants it. A pure content rule keeps both auditor worktrees forever.

A patch of auditor 2's whole change (`git -C <wt> diff --binary HEAD`, untracked files added with
`-N` first) is 51 KB, against 95 MB for the worktree. In larger repos a worktree is 0.4 to 4.8 GB
(the ezhomesteading survey in the shared side-session notes, 2026-10-15).

## 2. Which worktrees the sweep may consider

Every option below starts from the same scope, so it is stated once:

- The board item is `COMMITTED`, and its short hash is an ancestor of the base. `DONE` is not
  enough, because the code is not in a commit yet.
- The worktree's branch is named in that item's close-out section. Its path is read from
  `git worktree list --porcelain` by branch, never from the text, because a written path goes
  stale and a wrong one points at someone else's tree.
- The branch is an ancestor of the base (`git merge-base --is-ancestor`). Under print-blocks the
  auditors' branches never moved, so they qualify; a branch with its own commits does not.
- It is never the worktree the session runs in, and never a detached HEAD (no branch ties it to
  an item; `committed-status-f2d341` and `sad-curie-308775` are both detached today).
- No process stands in it. The skill text can check `lsof -t +d <wt>` (one level, cheap) and the
  newest file time; neither is exact, and a peer is cheaper to ask than to detect.

## 3. The options

### A. Content rule, strict: every dirty file equals the base tip

For each path in `git -C <wt> status --porcelain=v1 -z --untracked-files=all --no-renames`:
`git -C <wt> hash-object -- <path>` equals `git rev-parse <base>:<path>`, or the file is deleted
and `<base>:<path>` does not exist. This is what the task brief described.

- For: no content is lost, by construction. Each check is one git command, so skill text can
  carry it.
- Against: it frees nothing in row 89, and little in general, because the base moves after the
  item's commit. The longer the sweep waits, the less it frees.
- Writes: a sweep step in a skill (see section 4).

### B. Content rule, loose: equal to the base tip, the item's commit, or any version in the base's history

The `land-worktrees` sort, with the item's commit named as one accepted source.

- For: frees every file that any commit holds, so a file that later commits changed still counts.
  Content in the base's history is recoverable with `git show`.
- Against: still keeps auditor 2 (one status line) and auditor 1 (a rejected draft). History
  search costs one `git log` per file. A file equal to an old version can be a deliberate revert in
  progress; the item scope in section 2 makes that unlikely, but not impossible.

### C. Role rule: an auditor's worktree goes once its item is committed, whatever it holds

An auditor's worktree is a copy by definition: the auditor reproduces the builder's change and
does not author code. Once the item is `COMMITTED` and the hash is in the base, the copy has done
its job. The builder's worktree is never removed by this rule, only by the existing merged-and-clean
step.

- For: frees every auditor worktree, which is two of every three a `/delegate` run leaves, and the
  only ones the owner never commits in.
- Against: it trusts the role, not the content. An auditor that wrote something unique (a scratch
  test, a note) loses it. The close-out must record which worktree had which role, which it does
  not do today.

### D. Archive, then remove: keep a patch of every dirty worktree before it goes

Any of A, B or C, but before the removal the sweep writes the worktree's whole change to a patch
outside the repo: `git -C <wt> add -N <untracked>` then `git -C <wt> diff --binary HEAD` into
`<archive home>/worktree-sweep/<date>-<branch>.patch`, with the base hash in the file name or a
header line. `git apply` restores it on any checkout at that base.

- For: makes C safe, and lets A or B relax, because nothing is lost: a 51 KB patch stands in for a
  95 MB tree. It also covers auditor 1's rejected draft, if anyone ever wants it.
- Against: patches pile up and need their own fold (or a date cutoff). Ignored files are not in the
  patch (see section 5). It adds a write outside the repo, which `planned()` and `commitPlan()` do
  not cover, so a skill does it, not the CLI renderer.

## 4. Where the sweep lives

- **`/clean-up` (recommended).** It is already the "finished work leaves the live documents"
  sweep, it runs after several items close, and it runs after the commits exist. `/close-out`
  runs before its own item's commit, so it could only ever sweep earlier items.
- **`/close-out`, as a second pass in step 4.** Fires more often, but each run must read every
  `COMMITTED` item, not only its own, which widens a step that is today scoped to "this session
  made it".
- **A CLI subcommand, `personal-config worktrees` (dry run by default).** The checks become code
  with violating and passing fixture tests, which skill text never gets. It is the largest build:
  a new command, a new `docs/choices/` long form, and fixtures that create git worktrees in a temp
  directory. A skill could then call it in one line.
- **A `doctor` rule that only reports.** Cheapest, and it never removes anything; the disk still
  fills unless someone acts on the finding.

## 5. Risks every option shares

- **Removal needs `--force`.** Git refuses to remove a dirty worktree, and the existing step uses
  that refusal as its check. Every option here removes a dirty worktree, so the check moves into
  the sweep: it records each file's hash in the survey and re-hashes immediately before
  `git worktree remove --force`, and skips the worktree on any change. `git branch -d` (never `-D`)
  still guards the branch.
- **Ignored files go with the worktree.** `.env` and local config are not in `git status` and not
  in a patch. A copied `.env` is usually a duplicate of the primary checkout's; one with a unique
  secret is lost. A sweep can list `git status --ignored --porcelain` outside known dependency
  folders and keep the worktree when anything else shows.
- **`COMMITTED` is not on `main`.** Every option waits on `0ac7cf1` landing. Until then the
  rendered board has no status that means "the code is committed".
- **The board is the key.** A wrong `COMMITTED` row or a wrong branch name in a close-out removes
  the wrong worktree. Option D limits the damage; the others do not.
- **Project-folder repos have no board.** Their record is the phase header in `PLAN.md`, with no
  `COMMITTED` state. This scope covers the board shape only; the folder shape would need its own
  marker.
- **Who removes.** Auto mode has refused worktree removal before, and the `land-worktrees` skill
  hands the removal to the owner as a script for that reason. The sweep can remove itself after a
  `yes` in chat, or print one removal block per worktree for the owner, as print-blocks already
  does for commits.

## 6. The question

One batched question, asked in chat on 2026-10-15. The recommended answer is first in each part.

1. **Rule:** D with C (archive a patch, then remove each auditor worktree of a committed item),
   or B (loose content rule), or A (strict content rule, as briefed).
2. **Home:** `/clean-up`, or `/close-out`, or a `personal-config worktrees` command.
3. **Who removes:** the agent, after the owner's `yes` to a dry-run list in chat, or the owner,
   from printed blocks.
4. **Order:** build after `0ac7cf1` lands on `main`, or design now against `DONE` plus a commit
   lookup.

## 7. Answers

Answered by the owner in chat on 2026-10-15. Every part took the recommendation.

1. **Rule:** option D with C. Before removal, the sweep writes a patch of the worktree's whole
   change outside the repo; then it removes each auditor worktree of a `COMMITTED` item whose hash
   the base holds, whatever the worktree contains. The builder's worktree goes only by the existing
   merged-and-clean step. The close-out must start recording each worktree's role.
2. **Home:** `/clean-up`.
3. **Who removes:** the agent, after it posts a dry-run list and the owner says yes in chat. It
   re-hashes each file immediately before `git worktree remove --force` and skips on any change.
4. **Order:** the build waits until `0ac7cf1` (the `COMMITTED` status) lands on `main`.

Still open for the design step: where the patch archive lives and when old patches fold, and
whether ignored files outside dependency folders keep a worktree (section 5).
