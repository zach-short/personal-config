# DESIGN: a bare `personal-config` opens a guided setup and a home screen

**Status:** `RATIFIED`. Opened 2026-10-16 by board item 110, on Opus 5.5. Owner: Zach. GATE 1 was
answered 2026-10-16 (section 6). This file was `SCOPE.md` until 2026-10-16, when the answers were
written in below as D1 to D4. From here it changes by amendment only: a new dated decision or an
`As built:` note, never an edit to a decision in place. `PLAN.md` beside it orders the build.

## Decisions

**D1. The frame is drawn with `@clack/core` prompts whose `render()` returns the whole screen**
(2026-10-16, GATE 1 Q1, option C). The header, the rail and the panel are one string from a pure
renderer, and `@clack/core` redraws it in place on each key. `@clack/core` is declared in
`package.json` at exactly `1.5.1`, the version `@clack/prompts` 1.8.1 already pins.

*Defense.* It is the only option that keeps the rail fixed beside the question (as in `wk`) and
adds no bytes: the package is already installed. Its key handling, raw mode and cancel are the
code every setup runs now. Ink 6 costs 39 packages and 23.6 MB per install and a second prompt
stack (section 1); option A cannot hold the rail in place.

*What it costs, accepted.* The screen between prompts, and any view taller than the terminal (the
long forms, the preview, the diffs), are ours to draw. The exact pin must move with
`@clack/prompts`, never ahead of it.

**D2. A saved config opens a home screen with a summary and a menu** (2026-10-16, GATE 1 Q2,
option H1). The menu is section 3's table as proposed: Set up this folder (`init .`), Check this
folder (`doctor .`), Next board item (`passoff next`), What changed in the standard
(`upgrade .`), Run setup again (`setup`), Quit. A `config.json` that does not parse shows an error
panel and Quit, and is never rewritten.

*Defense.* A returning person learns the next move from the screen, and the conditions on each
entry are reads the commands already make (`src/lib/repo-config.ts`). H2 leaves the returning
person with the 13-line help text.

*What it costs, accepted.* Each entry repeats a command name that `HELP` also holds.

**D3. The words are the plain register** (2026-10-16, GATE 1 Q3). Rail: About you, Where your
repos are, Pick repos, Each repo, Practices, Review, Write, Done. Done headline: "Setup is done".
Any other words the screens need (key hints, the home title, the error panel) are written in the
same register at build time and listed in `PLAN.md` for the owner to read at the runtime pass.

**D4. The seven dials in section 4 hold as recommended** (2026-10-16, GATE 1 Q4). In short: only
an empty argv opens the frame, and only when stdin and stdout are both terminals; `setup` typed in
full is unchanged; a home menu entry leaves the frame and runs the command with its own output and
exit code; the frame needs 80 by 24 and below that draws the same steps without the rail; rail 20,
panel up to 64 with a floor of 36; 6 log lines; `wk`'s palette.

**D5. The rail is 24 columns, not 20** (2026-10-16, Zach in chat during the Phase 1 build).
*Supersedes in part* D4's dial 5: the rail width only; the panel's 64-column maximum and 36-column
floor stand. D3's longest label, "Where your repos are", is 20 columns behind the rail's 4-column
mark, and a 20-column rail clipped it to "Where your repo…". At 80 columns the panel's outer width
goes from 54 to 50.

*Defense.* Every ratified label fits on one line, and the frame still fits 80 columns. Wrapping
the label would grow the rail by a line; a shorter label would reopen D3.

## Rules that survive unchanged

- `personal-config setup`, `init`, `undo` and every other command typed in full look and behave as
  they do at `52a3838`.
- A bare command with stdin or stdout not a terminal prints `HELP` byte for byte and exits 0.
- `checkUsage()` still refuses typos before anything else runs.
- `askPhase()`, the trail and `← back`, `checkpointing()` and resume, `defaultsPrompter()`,
  `--yes` and `--dry-run` do not change.
- `finish()` keeps its order: preview, warnings, dry-run stop, already-current stop, confirm,
  `commitPlan()`, backup, Part 0 copy. The frame draws the preview and the confirm; it does not
  skip, reorder or reimplement them.
- No question, option, long form or written file changes.
- `src/lib/args.ts` stays pure: the terminal check is passed in.
- Item 109's files (`src/render/hooks.ts`, `src/render/ceiling.ts`, `src/lib/write-plan.ts`) are
  not edited.

A person who types `personal-config` with no arguments gets the help text. This effort makes that
bare command open a guided setup in a full-screen frame when no saved config exists, and (if the
owner wants one) a home screen when it does. The visual precedent is `wk`, which gained the same
thing in wk commit `5e4368b`.

## 1. What exists, verified 2026-10-16

Every row was checked in this worktree at `52a3838`, fast-forwarded from `eb92e69` to local
`main`.

| Claim | Verified state | Citation |
|---|---|---|
| A bare command resolves to `help` | `resolveCommand()` returns `'help'` when `first === undefined`; `main()` prints `HELP` and returns 0 | `src/lib/args.ts:155`, `src/cli.ts:93` |
| Typos are refused before parsing | `checkUsage(argv)` runs first and exits 1 on an unknown command | `src/cli.ts`, `src/lib/args.ts:78` |
| The help text lists the commands | 13 lines for 12 runnable commands (`passoff` has two lines); `COMMANDS` holds 14 names, with `help` and `version` | `src/cli.ts:18`, `src/lib/args.ts:6` |
| The pass-off says "fourteen commands" | Wrong by the help text's count: a newcomer reads 13 lines. `COMMANDS` has 14 entries, which is likely the source of the figure | as above |
| Setup asks through `Prompter` | `runSetup` picks `clackPrompter()` when `stdin.isTTY && !cli.yes`, else `defaultsPrompter()`, and wraps it in `checkpointing()` for resume | `src/commands/setup.ts:53`, `src/lib/ask.ts` |
| The phases `setup` runs | `you` (19 questions), then `discover` for `projects-dir` only, then the repo picker (`pick`), then `discover` per picked repo (15 questions), then `practices` (15) | `src/commands/setup.ts:66`, `:124`, `:215`, `:72`; counts from `questionsFor()` |
| Back is the runner's, not the prompter's | `askPhase()` keeps the trail and passes `canGoBack`; the prompter only shows `← back` | `src/phases/run.ts` |
| `text` and `confirm` questions offer no back | They have no option list to put it in | `src/lib/ask.ts`, comment above `askInteractively` |
| Writing goes through one function | `finish()` prints `previewTree`, warnings, then `confirmBatch()`, `commitPlan()`, backup, undo record | `src/commands/setup.ts:440`, `:549` |
| The batch confirm already has its own prompter | `runSetup` passes a fresh `clackPrompter()` to `finish`, never the question prompter | `src/commands/setup.ts:80` |
| The saved-config marker | `configFile()` is `~/.config/personal-config/config.json`; `init` treats its existence as "set up" | `src/lib/paths.ts:30`, `src/commands/init.ts:113` |
| A broken config throws | `readLayer` calls `readJson`, which is a bare `JSON.parse`; nothing catches it before `cli.ts`'s top-level handler | `src/lib/config.ts:58`, `src/lib/disk.ts:48` |
| What `config.json` holds | `models`, `answers` and `globalAnswers` | `src/render/user-config.ts:28` |
| Three modules import clack | `src/commands/setup.ts`, `src/commands/init.ts`, `src/lib/ask.ts` | `grep -rln "@clack/prompts" src` |
| `dist/cli.js` before any change | 351,547 bytes, 9,591 lines | `bun run build`, then `ls -l dist/cli.js` |
| Dependencies are not bundled | The build passes `--packages=external`, so a library adds nothing to `dist/cli.js`; its cost lands in the installer's `node_modules` | `package.json` `scripts.build` |
| Node floor | `engines.node` is `>=20`; CI tests Node 20, 22 and 24 | `package.json:61`, `.github/workflows/ci.yml:58` |
| No JSX setup | `tsconfig.json` sets no `jsx` option | `grep -n jsx tsconfig.json` returned nothing |
| The longest long form | `docs/choices/hooks.md`, 509 lines; 39 long forms in all | `wc -l docs/choices/*.md` |
| A setup preview is long | 99 lines for a `--yes --dry-run` run with no repos picked | `bun run src/cli.ts setup --profile starter --yes --dry-run` |
| `wk`'s terminal rule | A bare `wk` draws setup only when stdin and stdout are both character devices | `~/Projects/wk/cmd/wk/main.go:169` |
| `wk`'s frame | Header with a rule, 20-column rail, rounded panel up to 64 columns, key hints under it; the panel shrinks to fit and has a 36-column floor | `~/Projects/wk/internal/setup/view.go:32`, `:93` |
| `wk`'s home screen | A summary, then "Open the hive", "Refresh the template", "Quit"; a config that fails to load leaves only "Quit" | `~/Projects/wk/internal/setup/model.go:308`, `view.go:331` |

### Library facts, measured 2026-10-16

Each option was installed into its own scratch folder with `npm i --ignore-scripts` and measured
with `du -sk node_modules`.

| Option | Packages | On disk | Node floor | Citation |
|---|---|---|---|---|
| `@clack/prompts` 1.8.1 (what ships) | 6 | 280 KB | `>=20.12.0` | ledger Environment table |
| `@clack/core` 1.5.1 | already inside the row above | +0 KB | same | `node_modules/@clack/core/package.json` |
| `ink` 6.8.0 + `react` 19.3.1 | 39 | 23,644 KB | `>=20` | `npm view ink@6 engines` |
| `ink` 8.0.0 + `react` 19.3.1 | 38 | 23,816 KB | `>=22` | `npm view ink engines` |

Of Ink 6's 23,644 KB, `es-toolkit` is 17,988 KB. A minimal Ink program bundled with
`bun build --target=node` (with `react-devtools-core` external) is 1,154,713 bytes, three times
the size of `dist/cli.js`. Ink 7 and 8 require Node 22, so they would break the `>=20` promise and
CI's Node 20 job; Ink 6 is the newest major that keeps it.

`@clack/core` is the layer under `@clack/prompts`. Each of its prompts (`SelectPrompt`,
`MultiSelectPrompt`, `TextPrompt`, `ConfirmPrompt`) takes a `render()` function that returns the
whole frame as a string, and redraws it in place on every key by diffing lines against the last
frame and the terminal's row count (`node_modules/@clack/core/dist/index.mjs:320`). So the frame
can hold a header, a rail and a panel, and the rail stays fixed while the cursor moves. Option A
in the pass-off assumed that only the high-level `@clack/prompts` was available; this is a third
option, C, below.

## 2. What this is, and what this is not

**This is:**

- A bare `personal-config` (an empty argv) in a terminal, routed by a terminal check passed into
  the CLI from outside `src/lib/args.ts`.
- These states, each with its own screen:

| State | Bare command shows |
|---|---|
| stdin or stdout is not a terminal | `HELP`, exit 0, byte for byte as before |
| Terminal, no `config.json` | The guided setup in the frame (a checkpoint from an unfinished run is still offered, as `setup` offers it now) |
| Terminal, `config.json` parses | The home screen (option H1), or `HELP` (option H2) |
| Terminal, `config.json` fails to parse | An error panel naming the file and the parse error, with only "Quit"; never a rewrite (H1). Under H2, `HELP` |

- A pure renderer module under `src/lib/` that turns a screen state and a width into a string,
  with the palette defined once and adapted to light and dark terminals.
- A `Prompter` that wraps the existing questions in the frame, so `askPhase`, back, resume,
  `--yes` and `--dry-run` are unchanged.
- The review step (the same `previewTree` text `finish()` prints), the same confirm, a run step,
  and a done screen with next commands.
- Under H1, a home screen whose menu entries call the existing commands.

**This is not** (from the pass-off, and it holds whoever asks):

- Any change to questions, their wording, order or long forms.
- Any change to what `setup` writes, or to `planned()`, `resolvePlan()`, `commitPlan()`, backup
  or undo.
- `standard/`, `templates/`, other commands' output, `doctor`'s report.
- A version cut or a publish.
- The portfolio site's copy of the flow.
- Item 109's files: `src/render/hooks.ts`, `src/render/ceiling.ts`, `src/lib/write-plan.ts`.
- `personal-config setup` typed in full. It keeps its present screens; only the bare command gets
  the frame. (Dial 1 asks whether that should change.)

## 3. Options

### Q1. Which library draws the frame

**A. `@clack/prompts` as it is, with a header and rail printed between prompts.** No new code
path for keys. *Defense:* nothing new to learn or ship, and every prompt keeps the behavior that
tests and the ledger already describe. *Against:* clack's high-level prompts draw their own frame
and cannot be told to include a rail, so the header and rail are printed above each question and
scroll away. The result is a decorated version of what ships, not the `wk` screen the owner saw.

**B. Ink 6 (React for the terminal).** A full-screen redraw like Bubble Tea. *Defense:* the
closest match to `wk`'s model (components, layout by Yoga, a clear update loop), and the most
headroom for later screens. *Against:* 39 packages and 23.6 MB in every installer's
`node_modules` for one screen, against 280 KB for what ships; React and JSX in a codebase that has
neither (`tsconfig.json` has no `jsx`); text input needs another package or our own; and Ink 7
and 8 need Node 22, so this pins the project to an old major or drops Node 20. It is also a second
prompt stack beside clack, which `init`, `undo` and the confirms keep using.

**C. `@clack/core` with our own `render()` (recommended).** The same prompt classes clack already
uses, with the frame drawn by the new pure renderer. *Defense:* the frame redraws in place on
every key, so the rail stays fixed beside the question as in `wk`; it adds no bytes (`@clack/core`
1.5.1 is already installed as an exact dependency of `@clack/prompts` 1.8.1) and only one
`package.json` line to declare it directly; key handling, cancel and raw mode are the code that
already runs in every setup; and the screens are pure `state -> string` functions, which is the
testing shape the pass-off asks for. *Against:* the screen between prompts is ours to manage
(clear and redraw at each step, or use the alternate screen buffer); a frame taller than the
terminal defeats the in-place redraw, so the 509-line `hooks.md` long form and the 99-line preview
need a scrolling view we write ourselves; and `@clack/core` is a lower-level API whose 1.x minor
releases may change details that `@clack/prompts` hides, so the pin must stay exact.

### Q2. What the home screen holds, and whether it exists

**H1. A home screen with a summary and a short menu (recommended).** The summary reads
`config.json`: its path, the four model tiers, the number of saved answers, the projects folder.
The menu, as proposed:

| Entry | Runs | Shown when |
|---|---|---|
| Set up this folder | `init .` | the working folder has no `.personal-config.json` |
| Check this folder | `doctor .` | always |
| Next board item | `passoff next` | the working folder has a board |
| What changed in the standard | `upgrade .` | the working folder has an adapted standard |
| Run setup again | `setup` | always |
| Quit | nothing | always |

*Defense:* a person who has run setup once learns the next move from the screen, without the
13-line help text; and it is the screen the owner called "so much better" in `wk`. *Against:* it
duplicates `--help` for anyone who knows the commands, and every entry is a second place a
command's name appears, which can drift from `HELP`. The conditions in the third column are reads
of the working folder, which is new logic, small but not zero.

**H2. The wizard only, and `HELP` for everyone with a saved config.** *Defense:* the smallest
change that fixes the newcomer's first screen, and nothing new to keep in step with `HELP`.
*Against:* a returning person still gets the 13 lines, with nothing that says the tool knows they
are set up.

### Q3. The words on the rail and the closing screen (R7)

The rail needs one label per step. Three registers:

| Step | Plain | Warm | Terse |
|---|---|---|---|
| `you` phase | About you | How you work | You |
| `projects-dir` | Where your repos are | Where you keep code | Folder |
| repo picker | Pick repos | Choose your repos | Repos |
| per-repo `discover` | Each repo | Tell me about each repo | Per repo |
| `practices` | Practices | How you like code written | Practices |
| review | Review | Look it over | Review |
| write | Write | Putting it in place | Write |
| done | Done | All set | Done |

The done screen's headline, in the same three registers: "Setup is done" · "You are set up" ·
"Done".

## 4. Dials

| # | Dial | Recommended default | Why |
|---|---|---|---|
| 1 | Does `personal-config setup` typed in full also open the frame? | No, the bare command only, for this item | Keeps the change to one entry point; a later item can widen it |
| 2 | What counts as "bare" | An empty argv only; `personal-config --yes` still prints `HELP` | Flags with no command are a typo or a script |
| 3 | After a home menu entry runs | Leave the frame, run the command with its own output, exit with its code | The home screen adds no logic, and the commands' output is out of scope |
| 4 | Smallest terminal the frame draws in | 80 columns by 24 rows; below that, the same steps without the rail | The pass-off fixes 80 columns; 24 rows is the common default |
| 5 | Rail and panel widths | Rail 20, panel up to 64, floor 36, as in `wk` | Copy the shape; 20 + 2 + 54 fits 80 columns |
| 6 | Run step log lines | The last 6 written paths | `wk`'s figure |
| 7 | Palette | `wk`'s ten colors, as hex pairs for light and dark | The pass-off says copy the palette |

## 5. Hazards this work walks into

- **`process.exit` inside `cancelRun()`** (`src/lib/ask.ts`). A full-screen frame must restore
  the cursor and leave the alternate screen (if used) before that exit, or the person's terminal
  is left without a cursor.
- **The frame wraps at `process.stdout.columns`.** `@clack/core` hard-wraps the render output to
  the terminal width (`index.mjs:321`), so a line one column too wide breaks the whole frame.
  Every renderer test must assert line widths at 80.
- **Color detection.** Light and dark adaptation needs a background guess. Without one, the
  palette must read on both, which is how `wk`'s adaptive pairs were chosen.
- **The checkpoint wraps the prompter.** The frame `Prompter` sits inside `checkpointing()`, so a
  replayed answer is never drawn; the rail must still mark that step done.
- **`init` and `undo` keep their clack screens.** Two visual styles will ship side by side until a
  later item moves them.
- **The main checkout holds another session's edits** to `README.md` and `CHANGELOG.md`. Step 7
  of the pass-off waits for the owner's word that they are settled.
- **Terminal behavior cannot be seen by an agent here.** The ledger's Environment section says
  so. Every screen is tested as text; the live walk is the owner's, with exact commands in the
  hand-back.

## 6. Open questions (GATE 1)

1. Which library draws the frame: A, B or C? Recommended: **C**.
2. The home screen: H1 (with the menu in section 3, edited as you like) or H2? Recommended:
   **H1**.
3. Which register for the rail labels and the done headline: plain, warm or terse? Recommended:
   **plain**.
4. Are the dials in section 4 right as recommended?

## Answers

Given by Zach in chat on 2026-10-16, in one batch:

1. Library: **C**, `@clack/core` with our own `render()`.
2. Home screen: **H1**, with the menu in section 3 as proposed.
3. Copy: **plain** register for the rail labels and the done headline ("Setup is done").
4. Dials: **all seven accepted** as recommended in section 4.
