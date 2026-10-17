# 132. Render a wk land step for profiles that set `landStep: "wk"`

> **Claimed `IN FLIGHT` 2026-10-17.**

*Opened 2026-10-17, for the rollout of wk (the owner's Go CLI for parallel agent workspaces, with a landing queue that gates and lands each change and moves `main`) to the owner's repositories. Every one of the 27 repositories under the owner's projects folder with a `.personal-config.json` renders `landStep: "prose"` on that day, so `/delegate` lands by hand: the builder merges the base, and the lead fast-forwards and pushes. Owner decision 13 (2026-10-16) says that prose step is deleted from a repository once wk moves `main` there. This row adds the step that replaces it. Sources: row 125's item file (`passoff/125-render-the-prose-land-step-only-for-profiles-that-set-it.md`, in the archive), the wk integration plan's phase D, and wk row 16's run on 2026-10-17, which found that the Agent tool's worktree isolation makes a worktree of the session's own repository, not of the repository the item is in.*

**Model: Opus 5.5. Lane U. Waits on nothing. Work in your own worktree. Files it owns: `src/render/skills.ts`, `templates/skills/delegate.md`, `templates/skills/close-out.md`, `templates/skills/clean-up.md`, `tests/land-step-key.test.ts`, `tests/wk-land-step.test.ts` (new), `tests/helpers.ts`, `docs/choices/commit-policy.md`, `CHANGELOG.md`.**

## Orientation

You pick up personal-config, a Bun and TypeScript CLI that asks a person how they work and writes the matching documents (skills among them) into their repos. Other people clone and run it. You add a third way for `/delegate` to land a signed-off item: through wk's queue, for a profile that sets `landStep: "wk"`.

Read, in this order: `CLAUDE.md` (the rules that get broken); `docs/conventions-ts.md`; `src/render/skills.ts` at `Landing` and `landingOf` (about lines 322 to 343), `delegateVars` (about line 350), `builderRule` (about line 405), `landStep` (about line 467), and every other `landing ===` branch (`grep -n "landing ===" src/render/skills.ts`); `templates/skills/delegate.md` in full; `tests/land-step-key.test.ts`; `docs/choices/commit-policy.md` from line 105. For wk's side, read wk's README sections "Land work through the queue" and "Gate each batch before it lands" in `/Users/zachshort/Projects/wk/README.md` (read it there and never write there).

Session rules, restated here because this prompt is read alone:

- Work in your own worktree branch, made from `main` at its tip. Commit on that branch only; the lead lands it. Claude may run `git add`, `git commit` and `git push`. Add no `Co-Authored-By:` trailer and no "Generated with" line.
- Zero personal strings in `src/`, `templates/` or `standard/`: no name, no projects path, no machine-specific path. `bun test` greps for it; do not defeat it by paraphrasing. `wk` and its commands are a tool's name and are allowed; `~/.wk` is wk's documented default and is allowed.
- Never write outside a temp directory in a test. Never edit `standard/`'s content.
- Run git as `git -C <path>` and use absolute paths. Do not `cd` at the top level of a shell call.
- Written text (docs, comments, the close-out) follows the repo's writing rules: no contractions, no em dashes.

## Why this exists

On 2026-10-17 the lead of a `/delegate` run does by hand what wk now does by machine: merge the base into the builder's branch, gate again, fast-forward, push, and remove worktrees. Each step is a place a run went wrong on 2026-10-17 (a worktree made in the wrong repository; a fast-forward refused because another session had an uncommitted edit in the main checkout). With wk, the builder works in a wk workspace, the item lands by `wk submit`, and wk's worker gates the exact tree that lands, blames or bisects a red one, moves `main` and pushes. The skill text must say that, and only that, for a profile that opted in, while every other profile renders byte for byte as `main` does at d453fe8.

## What is fixed

Read these before changing anything; do not relitigate them.

- `Landing` is `'none' | 'step' | 'direct'` (`skills.ts` line 329). `landingOf` returns `'none'` unless `agentPushes(ctx)`, then `'step'` for a board with `landStep: "prose"`, else `'direct'`. `landStep` is a profile key, not a question (decision 13), so it needs no `docs/choices/` long form of its own; `commit-policy.md` documents it.
- `tests/land-step-key.test.ts` pins the two existing shapes, and `PROSE_LAND_STEP` in `tests/helpers.ts` (line 187) is the answers object a test of the prose step sets.
- wk's commands, as its usage text gives them on 2026-10-17: `wk new <row>` makes a workspace from the base on branch `wk/<row>` and prints only its absolute path on stdout; `wk submit -m <message> [--row <n>]`, run in a workspace with `landing.enabled = true`, writes the working tree as a changeset, appends it to the queue, prints its id as the only stdout line, and starts the landing worker; the worker gates each batch in a trial worktree, lands green changesets onto the landing ref, fast-forwards `main` when `landing.ff_main` is true and pushes when `landing.push` is true; `wk status` lists every changeset with its state (`submitted`, `landed`, `failed`) and the reason of a failed one; a gate that cannot start stops the worker with an error and blames nobody, and the changesets stay `submitted`; the worker's log is `~/.wk/<repo>/landing.log`; `wk gc` judges and `wk gc --apply` removes finished workspaces, never forcing.
- A fast-forward of `main` is refused while the main checkout has uncommitted edits in the files it would change (wk's `internal/landing/ff.go`, `Blockers`); the queue then waits.

## Do these, in order

1. **A fourth landing kind.** Add `'wk'` to `Landing`: `landingOf` returns it for a board (not project folders) under `agent-pushes` whose profile sets `landStep: "wk"`. Any other value of `landStep` keeps the result `main` gives at d453fe8. Reason: wk moves and pushes `main`, which only `agent-pushes` allows.
2. **`/delegate` under `'wk'`.** Render, in place of the prose and direct text:
   - Step 2: the lead makes the builder's workspace with `wk new <n>` in the primary checkout and passes its printed path in the brief; the Agent is spawned without `isolation`, and the brief tells the builder to work only in that path with `git -C` and subshells. Say why in one sentence (worktree isolation makes a worktree of the session's own repository).
   - The builder rule: commit on the workspace branch; never merge, never push, never run `wk submit`.
   - Step 3: the auditor's own worktree comes from `git worktree add` of the builder's branch, made by the lead, as the audit source text on `main` at d453fe8 allows; keep the reproduction rules.
   - Step 6 (the land): the lead runs `wk submit -m "<message>" --row <n>` in the builder's workspace, keeps the id, and reads `wk status` until that changeset is `landed` or `failed`, without a sleep loop that outlives the session's tools (say: re-check on each turn, or run one background wait that exits when the state changes). `landed`: record the row `DONE` with the landing commit. `failed`: the reason goes back to the builder as a blocking finding, through step 4's fix round, and the fixed workspace is submitted again. A stop with a start error: the lead reads `landing.log`, fixes the cause (an environment fact, never the tree), and starts the worker again with `wk land --loop`. A fast-forward refused for a dirty main checkout: name the files and their owner, and wait; never stash or reset.
   - Step 7: the workspaces leave by `wk gc --apply`, which keeps any with work not on the base; no `git worktree remove` by hand.
3. **The other skills.** Give every other `landing ===` branch in `skills.ts` its `'wk'` text, so `/close-out`'s record and `/clean-up`'s removal say the same thing: the record names the landing commit from `wk status`, and finished workspaces are wk's to remove.
4. **`commit-policy.md`.** Add a paragraph on `"landStep": "wk"`: what it renders, that it needs `~/.wk/<repo>.toml` with `[landing] enabled = true` and a gate list, and how to undo it (remove the key, or set it to `"prose"`, and re-run setup).
5. **Tests.** In a new `tests/wk-land-step.test.ts`, with a `WK_LAND_STEP` answers object in `helpers.ts`: `/delegate` under `'wk'` contains `wk new`, `wk submit` and `wk gc --apply`, and contains no `git merge`, no `git push` and no `isolation: "worktree"`; `/close-out` and `/clean-up` under `'wk'` name `wk status` and `wk gc`; a profile under `agent-commits` with `landStep: "wk"` renders as it does without the key. In `tests/land-step-key.test.ts`, add one case: the prose and direct renders are byte-identical to `main`'s (compare against a render made with the key absent and with `"prose"`). Each new test fails with its fix turned off; say how in the close-out.
6. Run the gate below. Write a `## Close-out, <date>` section at the end of this file: what changed by step, each test with its fix-off result, the gate output.
7. Review: one Opus 5.5 subagent in its own worktree with your branch checked out, told to edit nothing, reads the rendered `/delegate`, `/close-out` and `/clean-up` for a `landStep: "wk"` profile (render them with `bun run src/cli.ts setup --profile <a test profile> --dry-run` or the test helpers into a temp directory) and reports any sentence that tells the lead to merge, push or remove by hand, or that a person who has never seen wk could not follow. Record each finding's outcome in the close-out.

## Ask before building

Nothing is the owner's call. Where a fact you find contradicts a step, take the step's reason as the rule, do what it implies, and say so in the close-out.

## Not in scope, whoever asks

- Setting `landStep: "wk"` in any profile or any repository's `.personal-config.json`, and re-running setup anywhere. The rollout does that per repository, after each has a wk config with landing on.
- `/autopilot`'s own landing text beyond what `delegate.md` gives it, and `/land-worktrees` (the owner's scripts).
- A `doctor` rule that checks a `landStep: "wk"` repository has a wk config with landing on. Name it in the close-out as a follow-up.
- Any change to wk.
- `standard/`'s content.

## Hand back

Gate, run in your worktree:

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

`bun run lint` exits 0 on warnings; read its output. `doctor .` in a worktree sees fewer files than in the main checkout, so the lead runs `bun run doctor .` again in the main checkout after landing.

Done when the step 5 tests pass, each fails with its fix off, every existing test passes unchanged, and the gate exits 0 in your worktree. Hand back the gate output, the diffstat, the review's findings and their outcomes, and the close-out. Commit on your worktree branch only, with no `Co-Authored-By:` trailer and no "Generated with" line.

## Close-out, 2026-10-17

Built on Opus 5.5 in the worktree `dl/row-132-build`, from `main` at d453fe8.

**What changed, by step.**

1. `Landing` in `src/render/skills.ts` is now `'none' | 'step' | 'direct' | 'wk'`. `landingOf` returns `'wk'` for a board with git under `agent-pushes` whose profile sets `landStep: "wk"`. Project folders, a target without git, and any other key value keep the result `main` gives. The git condition is a fact found during the build: without it, `/close-out` for a no-git board rendered a wk commit step about a commit that cannot exist.
2. `/delegate` under `'wk'`. Five passages of `templates/skills/delegate.md` moved into tokens (`BUILD_SPAWN`, `BRIEF_NAMES`, `BASE_RULE`, `AUDIT_SPAWN`, `AUDIT_REPRO`), and `AUDIT_SOURCE` became the helper `auditSource()` inside `AUDIT_REPRO`, so `'wk'` can replace them while every other landing renders the old text. Step 2: the lead runs `wk new <n>` in the primary checkout, passes the printed path, and spawns with no `isolation`, with the one-sentence reason. The builder works only in `<workspace>` with `git -C` and subshells. The builder rule: commit on `wk/<n>`; never merge, never push, never `wk submit`. Step 3: the lead makes the auditor's worktree with `git worktree add --detach <path> <the builder's branch>`. Step 4: the builder commits the sign-off lines in the workspace, and the log line, the row and the blocks wait for the base to hold the landing commit. Step 6, "Submit it to wk's queue": `wk submit -m "<message>" --row <n>` in a subshell in the workspace, the id kept, `wk status` read on each turn or by one background wait, then each outcome (`landed`, with a fast-forward a dirty main checkout refuses; `failed`; `refused`; and, after review finding 4a, a worker that stopped with the changeset still `submitted`). Step 7, "Let wk remove the workspaces this run made": `wk gc`, then `wk gc --apply`, with no `git worktree remove` by hand. The claim commit in step 1 has its own wk sentence.
3. `/close-out` under `'wk'` gets a record step that names the landing commit from `wk status`, and its worktree step is the same `wk gc` step (section 4). `/clean-up`'s fold step says the base must hold each close-out, that `wk status` prints each landed commit, and that finished workspaces are wk's to remove.
4. `docs/choices/commit-policy.md` has a paragraph on `"landStep": "wk"` (what it renders, the `~/.wk/<repo>.toml` it needs with `[landing] enabled = true` and a gate list) and a paragraph on undoing it. `CHANGELOG.md` has the entry under Unreleased.
5. Tests: `tests/wk-land-step.test.ts` (new, nine tests), `WK_LAND_STEP` in `tests/helpers.ts`, and two cases in `tests/land-step-key.test.ts`.

**Build-level calls, each with its reversal.**

- The auditor's worktree is made at the builder's branch, as step 2 of this item says, and the reproduction needs no `git merge`. The item also says to keep the reproduction rules and that `/delegate` under `'wk'` contains no `git merge`; the two meet only this way. The auditor's diffstat is `git diff --stat <base>...HEAD`, or `git diff --stat HEAD` after the patch where a hook blocked the commit. Reversal: make it at `<base>` and keep `auditSource()`'s `git merge --ff-only <the builder's branch>`, then drop the no-merge assertion.
- The row is written `COMMITTED, <date>, <hash>` with the landing commit, not `DONE`, once the base holds it. Standard 2.2.0 says `DONE` means not yet committed, and wk has already printed the hash. Reversal: `wkRecord()` writes `DONE - <date>`.
- `refused` is handled. wk's queue has that state (a conflict with the landing tip), and without it the lead would wait on a changeset that never moves. The builder runs `wk sync` and resolves only a file its item owns. Reversal: drop that bullet from `wkLandStep()`.
- A refused fast-forward ends in `wk land --apply --expect <hash>`, the command `wk land` prints once the blockers are gone, because no later worker pass fast-forwards a batch that already landed. That is wk's own guarded fast-forward and push, never a git command by hand. Reversal: drop that sentence.
- The step 6 heading is "Submit it to wk's queue". `tests/land-step-key.test.ts` reads the absence of `## 6. Land it` for `landStep: "wk"` as no prose step, and the item says existing tests pass unchanged.
- The byte-identity case in `tests/land-step-key.test.ts` pins main's text of the six moved passages, with the key absent and with `"prose"`, and checks that an unknown key value renders as no key. It does not pin a digest of whole renders, because a digest breaks on every later edit to these skills. The wider proof was a scratch script: all 576 skill renders of a 96-answer grid (three policies, four `landStep` values, both work profiles, both track modes, git and no git), diffed against `main`'s at d453fe8. Only six changed, all under `agent-pushes` with `landStep: "wk"` on a ledger board with git: `/delegate`, `/close-out` and `/clean-up`, each tracked and local. Reversal: replace the passages with digests.
- `catalog.json` is regenerated (`bun run catalog`), outside "Files it owns". The catalog's freshness test fails once `commit-policy.md` changes, and only its content hash and that long form's body move.
- Five relative dates in this file's own prompt (lines 25, 38 and 42) became "2026-10-17" or "`main` at d453fe8", because `doctor`'s `relative-dates` rule failed the gate on them. The meaning is unchanged.

**Each test with its fix turned off** (each mutation made in `src/render/skills.ts`, then the file restored and checked with `cmp`):

- The step 6 stop cases from review finding 4a removed (and "Never a wait with no limit" reworded): "the lead makes, submits and removes through wk" fails.
- `landingOf` never returns `'wk'`: the three `/delegate` tests and both `/close-out` and `/clean-up` tests fail (5 fail).
- `/close-out`'s two `'wk'` branches off: "/close-out names `wk status` and `wk gc`" fails.
- `/clean-up`'s `'wk'` fold timing off: "/clean-up names `wk status` and `wk gc`" fails.
- `landingOf` returns `'wk'` before it checks the policy: the agent-commits tests for `/delegate`, `/close-out` and `/clean-up` fail. The `/autopilot` case passes under that mutation, because `/autopilot` does not read the landing; it guards the next change that makes it.
- One word of a moved passage changed ("old code" to "stale code"): "/delegate holds every moved passage" fails.
- Any non-empty key lands through wk: "a value the engine does not know renders as the key absent" fails.

**Review (step 7).** One Opus 5.5 subagent, in a detached worktree at 9528890, told to edit nothing. It rendered the three skills for an `agent-pushes`, `landStep: "wk"` profile with the test helpers and read them against wk's README and source. `git status --porcelain` of its worktree was empty afterwards, and the worktree is removed. Findings and outcomes:

- 4a, blocking: the wait for `landed`, `failed` or `refused` never ends when the worker stops (a start error, every gate skipped, a diverged landing ref), because the changeset stays `submitted`. Fixed: the wait has a limit, with a bounded background loop as the example, and "Still `submitted` when the wait ends" gives the next action for each stop. A test covers it.
- 1a and 1b: `/clean-up` commits on the base with no wk guard. Fixed: its fold step says each commit on the base waits until `wk status` shows the landing ref `at <base>; nothing to land` or `behind <base>`. `/close-out`'s own commit has no such guard yet (left owed).
- 1c: the claim commit. No change needed.
- 2a: the claim guard named no `wk status` line and no landing ref. Fixed with wk's own note strings and a definition.
- 2b: no wk precondition. Fixed: step 2 checks `wk config show` for `enabled = true` under `[landing]` and a `[[gates.run]]` before `wk new`.
- 2c: the background wait gave no command. Fixed, as 4a.
- 2d: `<repo>` undefined. Fixed: the name of the primary checkout's folder (wk's `filepath.Base` of it).
- 2e: "landing tip" undefined, and the conflict resolution's audit unclear. Fixed: defined, and the builder reports the resolution as a fix round does, with wk's gates on the result, as the prose land step has it.
- 2f: the scheduled cleanup's command unnamed. Fixed: `wk gc schedule install`.
- 2g: `/close-out`'s heading says the record goes in the code's commit, which is false under wk. Not fixed: the heading is shared with every policy (left owed).
- 3a: wk's README says an agent never commits in a workspace. Fixed: the builder rule says why it commits anyway (the auditor reproduces from the branch, and `wk gc` removes only a workspace with no changed path).
- 3b: the land step stated wk's fast-forward and push as unconditional. Fixed: it names the config they depend on.
- 3c: the landing message is lowercased. Fixed.
- 3d: the gates run three times (builder, auditor, wk). Not fixed: changing who gates is outside this row (left owed).
- 3e: claims checked against wk's source. No change.
- 3f: wk's README says only P1 is built. Outside this repository; for the owner.
- 4b: a hook-blocked commit still lands, from the working tree. Fixed: the record says "submitted uncommitted", and step 7 says `wk gc` keeps that workspace and the owner removes it.
- 4c: a fix round after `failed` would append the record twice. Fixed: it replaces the lines.
- 4d: `wk/<n>` stays, so a second `wk new <n>` refuses. Partly fixed: step 7 says so. What to do with the branch is left owed.
- 4e: auditor worktrees of earlier rounds may be kept for good. Not fixed (left owed).
- 4f: with wk's leases on, `wk claim` is needed. Not fixed: conditional on a setting no profile uses yet (left owed).

**Left owed.**

- A `doctor` rule that checks a `landStep: "wk"` repository has `~/.wk/<repo>.toml` with landing on and a gate list (out of scope here).
- `/autopilot` under `'wk'` keeps the `direct` text: its `LAND_ROUTE` is empty and its record follows `/delegate`. Its own landing text is out of scope.
- `/close-out` under `'wk'` still commits on the base with no `wk status` guard (review 1a), and its heading says the record goes in the code's commit (2g).
- Who gates under wk: the builder and the auditor still run every gate that wk's worker runs again (review 3d).
- A landed `wk/<n>` branch stays, so a re-run of the same row needs it gone first (4d); auditor worktrees of earlier rounds may be kept for good (4e); `wk claim` where wk's leases are on (4f).
- The wk text names wk's defaults (the 60-minute quiet window, `~/.wk/<repo>/landing.log`); a repository that changes them in its wk config reads its own values.
