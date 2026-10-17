# Plan: a bare `personal-config` opens a guided setup and a home screen

**Status:** `PLANNED` 2026-10-16, approved at GATE 2 the same day. Board item 110, lane N. Built from `DESIGN.md` D1 to D4 beside
it. GATE 2 is section 7.

## 0. Facts verified 2026-10-16 (supersede the design where they differ)

Checked in the worktree at `52a3838`.

| # | Claim | Verified state | Citation |
|---|---|---|---|
| F1 | `setup` prints between prompts through `say()` | The target list, the per-repo notes, the preview and the warnings all go through `say()`, which is `console.log` | `src/lib/ui.ts`, `src/commands/setup.ts:135`, `:199` to `:210`, `:452` |
| F2 | One clack call in the write path is outside `ask.ts` | `confirmBatch()` prints each diff with `p.note` | `src/commands/setup.ts:558` |
| F3 | `runSetup` picks its own prompters | It builds `clackPrompter()` twice: for the questions and for `finish` | `src/commands/setup.ts:54`, `:80` |
| F4 | The prompter can tell which step a question is on | `Question.phase` is `you`, `discover` or `practices`; `projects-dir` is the one `discover` question asked before the repo picker; `pick()` is the picker | `src/lib/types.ts:41`, `src/commands/setup.ts:124` |
| F5 | The prompter cannot tell which repo a `discover` question is for | `planRepo` passes no repo to `askPhase`; it prints the name through `say()` only when a note applies | `src/commands/setup.ts:186` |
| F6 | `commitPlan()` reports nothing until it returns | It returns `{ written, removed, manifest }` at the end; `src/lib/write-plan.ts` is item 109's file | `src/commands/setup.ts:479`, board row 109 |
| F7 | `@clack/core` prompts take their own streams | `PromptOptions` has `input?: Readable` and `output?: Writable` | `node_modules/@clack/core/dist/index.d.mts:228` to `:245` |
| F8 | Escape cancels a clack prompt | Back in this tool is the `← back` option, never a key | `src/lib/ask.ts` `choiceOptions` |
| F9 | Item 109's plan edits `src/commands/setup.ts` | Its Phase 1 scope 5 edits `planEverything` and `finish`; board row 109 lists only hooks, ceiling and write-plan | `docs/incomplete/setup-hook-leftovers/PLAN.md` Phase 1, `PASSOFF.md` row 109 |
| F10 | `src/cli.ts` holds the command table | `DISPATCH` maps each command to its runner | `src/cli.ts` |

## 1. Decisions taken since ratification

**BD-1. The terminal check lives in `src/cli.ts`** as `interactive()`: true when
`process.stdin.isTTY` and `process.stdout.isTTY` are both true. `main()` passes it to a pure
`bareRoute(argv, interactive, hasConfig)` that returns `'help'`, `'guided'` or `'home'`. Reverse
by deleting the call; `resolveCommand()` is unchanged.

**BD-2. `src/commands/home.ts` takes the command runner as a parameter**, so it does not import
`src/cli.ts` (which would be a cycle). `cli.ts` hands it `(command, argv) => DISPATCH[command]`.

**BD-3. The menu is a pure function of facts read once**: `homeMenu({ configLoads, hasFolderConfig,
hasBoard, hasStandard })`. The reads use `src/lib/repo-config.ts` (`readDocNames`,
`readStandardPath`) and `exists()`. A config that does not load gives `['Quit']` (D2).

**BD-4. `say()` writes to a sink that the frame can swap.** `ui.ts` gains `setSink()`; the default
sink is `console.log`, so every command's output is byte for byte the same. In the frame, lines
collect into the next panel: per-repo notes above that repo's first question, the preview in the
review step. No `say()` call in `setup.ts` changes.

**BD-5. `runSetup(cli, prompters?)`** takes an optional pair (questions, confirm). With none it
builds the two `clackPrompter()`s it builds now. Only the bare command passes the frame's pair.
`confirmBatch()`'s `p.note` becomes `note()` in `ui.ts`, which calls `p.note` by default and goes
to the sink in the frame (F2).

**BD-6. The run step shows a spinner while `commitPlan()` runs, then the written list.** It
cannot be live per file without editing `write-plan.ts` (F6), which is item 109's. The last 6
paths show (D4); the full count is printed under them.

**BD-7. The rail marks "Each repo" with the repo's name** from the sink line `planRepo` prints, and
otherwise as "Each repo (n of m)" counted from `pick()`'s result (F5).

**BD-8. No alternate screen.** Each step clears the screen and draws the frame from the top, so
the done screen stays in the scrollback when the run ends. `cancelRun()` exits through
`process.exit`, so the frame registers an `exit` handler that shows the cursor again.

**BD-9. Back stays the `← back` option; escape still cancels** (F8). The key hints say so.

**BD-10. Below 80 columns or 24 rows the frame drops the rail** and keeps the header and panel
(D4). Below 36 columns of panel it prints the step as clack does now.

**BD-11. The words, plain register (D3), for the owner to read at the runtime pass:**

| Where | Words |
|---|---|
| Header | `⬢ personal-config · setup`, `⬢ personal-config · home`, then the working folder on the right |
| Panel corner | `step 3 of 7` |
| Key hints, choice | `↑/↓ choose · enter next · ctrl+c quit` |
| Key hints, multiselect | `↑/↓ move · space toggle · enter next · ctrl+c quit` |
| Key hints, review | `↑/↓ scroll · enter choose · ctrl+c quit` |
| Read more view | `More on: <question>`, hint `↑/↓ scroll · enter back to the question` |
| Home title | `You are set up` over the config path |
| Home summary labels | `Saved answers`, `Models`, `Projects folder` |
| Error panel | `✖ Your saved answers do not load`, the path and the parse error, then `Fix the file by hand. This screen never rewrites it.` |
| Done | `Setup is done`, then `Next`: `personal-config init` (set up one more folder), `personal-config doctor` (check what was written), `personal-config undo` (put back what this run changed) |

## 2. Phases

| # | Phase | Driver | Subagents | Est. context | Why that shape |
|---|---|---|---|---|---|
| 1 | Route the bare command, the renderers and the home screen | Opus 5.5 | none | full | New files plus `src/cli.ts`; a wrong route is loud (a pipe that stops getting `HELP`), so the Default tier |
| 2 | Setup inside the frame | Opus 5.5 | none | full | Touches `setup.ts` and `ui.ts`; a wrong seam breaks every setup run loudly. Waits on item 109 (F9) |
| 3 | README, CHANGELOG, board row | Sonnet 5.5 | none | comfortable | Doc reconciliation against a fixed build; waits on the owner's word about the main checkout's edits |

### Phase 1. Route the bare command, the renderers and the home screen

**Status.** `BUILT` 2026-10-16. Committed by Zach as `32bee9d` on `worktree-bare-command-home`
and merged with `main` in `ad1ea66` (verified 2026-10-16, `git log`). The "uncommitted" in the As
built note below was true when it was written and is out of date (R5).

**Scope.**

1. `package.json`: `"@clack/core": "1.5.1"` under `dependencies` (D1); `bun install` updates
   `bun.lock`.
2. New `src/lib/screens.ts`, pure: the palette (`wk`'s ten pairs, D4), `header()`, `rail()`,
   `panel()`, `frame()` (header, rail and panel joined and centered), `homeScreen()`,
   `errorPanel()`, `keyHints()`. Each takes a state and a width and returns a string. ANSI width
   is measured with `fast-string-width`, which `@clack/prompts` already depends on, or a local
   strip; decide by whether it is a direct dependency.
3. `src/cli.ts`: `interactive()` and `bareRoute()` (BD-1). `'guided'` calls `runSetup(cli)` as it
   is in this phase; Phase 2 puts it in the frame.
4. New `src/commands/home.ts`: reads the facts (BD-3), draws `homeScreen()` through a
   `SelectPrompt` with a custom `render()`, and on a choice leaves the frame and calls the runner
   (BD-2, D4).
5. New tests, one file per area (X1):
   - `tests/bare-command.test.ts`: `bareRoute` for all four states; the real bin with piped stdin
     and stdout prints `HELP` byte for byte (compared with `--help`) and exits 0, from
     `bun run src/cli.ts` and from `node dist/cli.js`;
   - `tests/screens.test.ts`: rail marks for done, current and later steps; the step counter; the
     error panel; every line at most 80 columns at width 80 after stripping ANSI; the frame
     centered at 120;
   - `tests/home.test.ts`: `homeMenu()` for each fact combination, and `['Quit']` for a config
     that does not load; a broken `config.json` in the temp home is left byte for byte.

**Subagents.** None.

**Done when.**

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

```bash
bun run build
```

Plus: `bun run src/cli.ts | cat` and `node dist/cli.js | cat` both give output that `diff` finds
equal to `--help`'s, exit 0. `dist/cli.js` grows only by this phase's code (record the new byte
count). Read lint's output, not its exit code. The owner runs the bare command in a terminal with
their real config and sees the home screen.

**Watch for.** `process.stdout.isTTY` is `undefined`, not `false`, for a pipe; test the pipe from
a real child process, not by setting the property.

**As built, 2026-10-16** (uncommitted in the worktree on `worktree-bare-command-home`, based on
`52a3838`). Gates green, not seen running in a terminal.

- `bareRoute(interactive, hasConfig)` lives in `src/lib/args.ts` and takes no argv; `main()` calls
  it only for an empty argv (`src/cli.ts`). `runArgv()` is the old body of `main()`, and the home
  menu calls it, so a menu entry passes `checkUsage()` like a typed command.
- ANSI width is a local strip and code-point count (`visibleWidth` in `src/lib/screens.ts`), not
  `fast-string-width`, which is not a direct dependency. Every glyph the frame draws is one column.
- `errorPanel()` is `errorLines()`, the error part of the home body.
- The rail is 24 columns (D5).
- `clearScreen()` was added to `src/lib/ui.ts` in this phase, because `home.ts` may not write to
  the terminal itself (L3). It is the only change to `ui.ts`.
- `tests/bare-command.test.ts` drives `bun run src/cli.ts` only. `node dist/cli.js` was checked by
  hand: `node dist/cli.js | cat` and `bun run src/cli.ts | cat` both `diff` equal to
  `node dist/cli.js --help`, and both exit 0 with stdout redirected. A test cannot run the built
  bin, because the bundle resolves its external packages from the repo and a test may not write
  into the repo.
- `tests/home.test.ts` sets its own `HOME` per case: the preload's sandbox is shared by the run.
- `dist/cli.js` is 362,172 bytes, up 10,625 from 351,547.
- `bun test`: 1,838 pass, 4 fail. The 4 are `tests/tracks.test.ts` and `tests/catalog.test.ts`
  golden cases on `~/.claude/rules/model-routing.md`'s hash, and they fail the same way on a
  `git archive 52a3838` copy (44 pass, 4 fail over those two files). Not this item's.

### Phase 2. Setup inside the frame

**Status.** `BUILT` 2026-10-16 in the main checkout on `ad1ea66`, uncommitted. Gates green, not
seen running in a terminal (see As built below). Item 109 closed first, as GATE 2 asked.

**Scope.**

1. `src/lib/ui.ts`: `setSink()` and `note()` (BD-4, BD-5). Default output unchanged.
2. `src/commands/setup.ts`: `runSetup(cli, prompters?)` (BD-5); `confirmBatch()` calls `note()`.
   Nothing else in the file changes.
3. New `src/lib/frame.ts`: `framePrompter(state)` implementing `Prompter` with `@clack/core`
   `SelectPrompt`, `MultiSelectPrompt`, `TextPrompt` and `ConfirmPrompt`, each rendering
   `frame()`. The step comes from `question.phase`, the `projects-dir` id and `pick()` (F4, BD-7).
   `Read more…` opens a scroll view of the long form and returns to the question. The confirm
   calls become the review step (the sink's preview in a scroll view) and its two choices; the
   write becomes the run step (BD-6); the end becomes the done screen (D3). It is wrapped by
   `checkpointing()` as `clackPrompter()` is, and a replayed answer marks its step done.
4. `src/cli.ts`: `'guided'` calls `runSetup(cli, framePrompters())`.
5. New tests:
   - `tests/frame-prompter.test.ts`: drive each prompt kind through `PassThrough` streams (F7)
     with key bytes; assert the answers, `BACK` from `← back`, `READ_MORE` handled inside, and the
     rendered frame text per step;
   - a whole guided run in the temp home through the frame with scripted keys gives the same
     planned files as a `--yes` run with the same answers;
   - `tests/ui-sink.test.ts`: the default sink prints exactly what `console.log` printed.

**Subagents.** None.

**Done when.** The Phase 1 gates, plus: every existing setup test passes unchanged (none edited);
`bun run src/cli.ts setup` in a terminal looks as it does at `52a3838`; the owner walks the bare
command with `HOME` pointed at an empty temp folder and sees the frame from About you to Setup is
done, and `← back`, `Read more…` and `ctrl+c` then a resume each behave as in `setup`.

**Watch for.** A `say()` line that reaches the real stdout while a frame is drawn breaks the
in-place redraw; the sink must be set before the first question and cleared on every exit path.

**As built, 2026-10-16** (uncommitted in the main checkout on `ad1ea66`). Gates green, not seen
running in a terminal.

- `framePrompters(io?)` in `src/lib/frame.ts` returns `{ ask, confirm, run }`. `ask` and `confirm`
  are the pair `runSetup(cli, prompters?)` takes (BD-5). `run(setup)` sets the sink, runs setup,
  draws the last screen, and puts the sink back in a `finally`. `src/cli.ts`'s `'guided'` route is
  `frame.run(() => runSetup(parseCli(argv), frame))`, not `runSetup(cli, framePrompters())` as
  scope 4 wrote it, because nothing else could draw the done screen or clear the sink.
- `runSetup` wraps the frame's `ask` in `checkpointing()` through the code that already wraps
  `clackPrompter()`: a `prompters` argument counts as interactive. With `prompters` the clack intro
  is not printed, because the frame has its own header. With none, every line runs as before.
- The cancel path calls `setSink(null)` and then `cancelRun()`, so its message reaches the
  terminal. An `exit` handler shows the cursor again (BD-8).
- `ui.ts` also gained `drawScreen(text, out?)`, and `clearScreen()` takes an optional stream, so a
  test can draw into its own stream. `src/commands/home.ts` calls both with no argument, as before.
- **BD-6, built differently.** The write step is one static screen: the step, and the confirm's
  own words. It has no spinner, because `commitPlan()` is one `await` with no progress (F6) and the
  done screen replaces the step when it returns. The done screen shows the last 6 non-blank lines
  `setup` said after the write (the counts, the backup line, the clipboard line), not 6 paths:
  `finish()` says no paths, and scope 2 allowed no other change to `setup.ts`.
- **BD-7, as built.** The panel heading names the repo (`Each repo · <name>`) from `pick()`'s
  result, in the order `chooseRepos` plans them. The rail says `Each repo (n of m)`. A repo starts
  when its first question is asked again, unless `← back` led there. On a resumed run that replays
  whole repos, the count starts from the first repo the frame draws, so it can be low.
- **BD-11, one change for the owner to read.** The review hints are `↑/↓ scroll · ←/→ yes or no ·
  enter choose · ctrl+c quit`. BD-11's line has no key for the choice, and ↑/↓ scrolls. `y` and
  `n` answer at once, as in clack. Text questions show `enter next · ctrl+c quit`.
- **BD-12 (new, 2026-10-16).** A frame multiselect starts with its default ticked, so enter takes
  the default as it does on every other kind. `setup`'s clack multiselect starts empty and is
  unchanged. No question is a multiselect as of 2026-10-16 (counted from `ALL_QUESTIONS`), so no
  screen shows it yet. The repo picker is not a question, and it starts empty, as `setup`'s does.
  Reverse by passing `initialValues: []`.
- An ended run that wrote nothing (declined, already current) ends on what `setup` said, in the
  panel of the step it ended on, with no done screen.
- Tests: `tests/frame-prompter.test.ts` (17 cases, through `PassThrough` streams by way of
  `tests/frame-driver.ts`), `tests/guided-run.test.ts` (a whole run through the frame writes the
  same files as `--yes`; a select that ignored its default made it fail), `tests/ui-sink.test.ts`.
  No existing test was edited.
- Gates, in the main checkout: `bun run typecheck` clean; `bun run lint` checked 209 files, no
  warnings; `bun test` 1,884 pass, 0 fail; `bun run doctor . examples` 13 findings (7 advisory), all
  in untracked or `examples/` markdown and none in a file this phase touched; `bun run build` gives
  `dist/cli.js` 384,077 bytes, up 14,300 from 369,777 at `ad1ea66`. `node dist/cli.js | cat` and
  `bun run src/cli.ts | cat` both `diff` equal to `node dist/cli.js --help`.
- During the build, a rewrite of `main` at 16:23 (a `reset` to `d28c90a`, then a rebase that
  reworded `b1d4ef7`) discarded the uncommitted `ui.ts` and `setup.ts` edits once. They were made
  again; the tree at `ad1ea66` equals `d28c90a`'s (`git diff --stat`).
- **A second build, 2026-10-16.** A session in the worktree `bare-command-home` built Phase 2 at
  the same time, as `c7b847e` on its branch. Zach kept this build (`e6bb1b7`) and dropped that
  one. Its pseudo-terminal walk (`script` with `stty cols 100 rows 30`, an empty temp `HOME`,
  enter on every step) found two defects this build shares, fixed on branch `frame-fixes`:
  a terminal that reports 0 columns now draws at 80 (`sizeOf()` in `src/lib/screens.ts`, read by
  `terminalIo()` and `runHome()`), and a model tier saved as `''` is left out of the home summary.
  The same walk of this build reached the done screen with "Wrote 8 file(s)." and found nothing
  else. Gates in the worktree: `bun test` 1,886 pass, 0 fail; `doctor . examples` nothing failing.
- **The 0-column fix above was wrong, 2026-10-16 (R5).** `sizeOf()` (in `45f1bb7`) draws the frame
  at 80, but `@clack/core` wraps every frame at `process.stdout.columns` itself
  (`node_modules/@clack/core/dist/index.mjs:321`), so a `script` walk with `stty cols 0` still put
  one character on each line. The fix that holds: `interactive()` in `src/cli.ts` also needs
  `process.stdout.columns > 0`, so a terminal with no width gets `HELP`, as a pipe does. The same
  walk then printed the help text, and a walk at `stty cols 100` still drew the frame.
- **The frame tests depended on the terminal they ran in, 2026-10-16.** In Zach's 80-column
  terminal, `bun test` failed 3 of them, because clack wrapped their 100-column screens at 80; off
  a terminal (the harness, CI) `columns` is undefined and they passed. `tests/preload.ts` now sets
  `process.stdout.columns` and `rows` to undefined for every run. Proof: `tests/frame-prompter`
  and `tests/guided-run` under `script` with `stty cols 80`, 18 pass, 0 fail.

### Phase 3. README, CHANGELOG, board row

**Status.** `BUILT` 2026-10-17. Wrote one paragraph in `README.md` after the `npx personal-config setup` block and one bullet under `## Unreleased`, `### Added` in `CHANGELOG.md`, both in the owner's words. The board row is the orchestrating session's. Facts checked against `src/cli.ts`, `src/lib/args.ts` and `src/commands/home.ts`. No version cut.

Was: `PLANNED` 2026-10-16. Waits on Phase 2 being committed. The wait on the main checkout's
edits to `README.md` and `CHANGELOG.md` is over: Zach said on 2026-10-16 that the main checkout no
longer holds another session's edits to tracked files.

**Scope.** One paragraph in `README.md` on the bare command; one line under the next version in
`CHANGELOG.md`; board row 110's "Files it owns" corrected to the files this plan names
(`src/lib/frame.ts`, `src/lib/ui.ts`, `src/commands/setup.ts`, `package.json`, `bun.lock`, and no
`Prompter` in `ask.ts`).

**Done when.** The Phase 1 gates; `grep -n "personal-config\b" README.md` shows the paragraph.

## 3. Dials

As `DESIGN.md` section 4, all seven accepted (D4).

## 4. Seams reserved, deliberately not built

- The frame for `setup` typed in full (dial 1), and for `init`.
- A per-file live run list, which needs a progress callback in `commitPlan()` (BD-6).
- Light and dark detection beyond `wk`'s adaptive pairs.

## 5. Repo hazards, with live numbers

- `dist/cli.js` is 351,547 bytes at `52a3838`.
- `@clack/prompts` 1.8.1 pins `@clack/core` 1.5.1 exactly; a bump of one is a bump of both.
- The main checkout holds another session's uncommitted edits to 13 tracked files (git status at
  session start, 2026-10-16), including `src/lib/types.ts` and `src/lib/write-plan.ts`. *Out of
  date 2026-10-16 (R5):* those edits were item 109's, committed in `6ad97ef` and `7b67efe`; `git
  status` at the start of Phase 2 showed no modified tracked file.
- `doctor .` in a worktree checks fewer files than in the main checkout (`CLAUDE.md`, "Gates that
  lie"): rerun it there after the merge.

## 6. Session protocol

`standard/AGENT-PRACTICES.boilerplate.md`, and `CLAUDE.md`. Build in the worktree
`.claude/worktrees/bare-command-home`, fast-forwarded to local `main` before each phase.

## 7. GATE 2

1. Approve the three phases in this order?
2. Phase 2 and item 109 both edit `src/commands/setup.ts` (F9). Wait for item 109 to close first
   (recommended), or build Phase 2 now in different functions and merge?

### Answers, 2026-10-16

Given by Zach in chat on 2026-10-16:

1. **Approved**: the three phases in this order.
2. **Wait for item 109**: Phase 1 is built now; Phase 2 starts after item 109 closes, from a
   worktree fast-forwarded to `main`.
