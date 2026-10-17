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

The lead of a `/delegate` run today does by hand what wk now does by machine: merge the base into the builder's branch, gate again, fast-forward, push, and remove worktrees. Each step is a place a run went wrong on 2026-10-17 (a worktree made in the wrong repository; a fast-forward refused because another session had an uncommitted edit in the main checkout). With wk, the builder works in a wk workspace, the item lands by `wk submit`, and wk's worker gates the exact tree that lands, blames or bisects a red one, moves `main` and pushes. The skill text must say that, and only that, for a profile that opted in, while every other profile renders byte for byte as today.

## What is fixed

Read these before changing anything; do not relitigate them.

- `Landing` is `'none' | 'step' | 'direct'` (`skills.ts` line 329). `landingOf` returns `'none'` unless `agentPushes(ctx)`, then `'step'` for a board with `landStep: "prose"`, else `'direct'`. `landStep` is a profile key, not a question (decision 13), so it needs no `docs/choices/` long form of its own; `commit-policy.md` documents it.
- `tests/land-step-key.test.ts` pins the two existing shapes, and `PROSE_LAND_STEP` in `tests/helpers.ts` (line 187) is the answers object a test of the prose step sets.
- wk's commands, as its usage text gives them on 2026-10-17: `wk new <row>` makes a workspace from the base on branch `wk/<row>` and prints only its absolute path on stdout; `wk submit -m <message> [--row <n>]`, run in a workspace with `landing.enabled = true`, writes the working tree as a changeset, appends it to the queue, prints its id as the only stdout line, and starts the landing worker; the worker gates each batch in a trial worktree, lands green changesets onto the landing ref, fast-forwards `main` when `landing.ff_main` is true and pushes when `landing.push` is true; `wk status` lists every changeset with its state (`submitted`, `landed`, `failed`) and the reason of a failed one; a gate that cannot start stops the worker with an error and blames nobody, and the changesets stay `submitted`; the worker's log is `~/.wk/<repo>/landing.log`; `wk gc` judges and `wk gc --apply` removes finished workspaces, never forcing.
- A fast-forward of `main` is refused while the main checkout has uncommitted edits in the files it would change (wk's `internal/landing/ff.go`, `Blockers`); the queue then waits.

## Do these, in order

1. **A fourth landing kind.** Add `'wk'` to `Landing`: `landingOf` returns it for a board (not project folders) under `agent-pushes` whose profile sets `landStep: "wk"`. Any other value of `landStep` keeps today's result. Reason: wk moves and pushes `main`, which only `agent-pushes` allows.
2. **`/delegate` under `'wk'`.** Render, in place of the prose and direct text:
   - Step 2: the lead makes the builder's workspace with `wk new <n>` in the primary checkout and passes its printed path in the brief; the Agent is spawned without `isolation`, and the brief tells the builder to work only in that path with `git -C` and subshells. Say why in one sentence (worktree isolation makes a worktree of the session's own repository).
   - The builder rule: commit on the workspace branch; never merge, never push, never run `wk submit`.
   - Step 3: the auditor's own worktree comes from `git worktree add` of the builder's branch, made by the lead, as today's audit source text allows; keep the reproduction rules.
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
