# personal-config

> **Before writing or editing any code, read `docs/conventions-ts.md` in full.** Not optional,
> not conditional on task size. If you have not read it this session, read it now.

> **Before scoping, planning or building a feature, read
> `standard/AGENT-PRACTICES.boilerplate.md`.** It is the process standard this repo owns and
> ships — the same one the tool installs into other repos. Do not ask how the flow works; it is
> written down.

This repo is a Bun + TypeScript CLI that asks a person how they work and writes the matching
documents into their repos. **Other people clone and run it**, most of whom have never seen a
ledger, a board or a model tier.

## The rules that get broken

- **Zero personal strings in the engine.** No name, no `~/Projects`, no machine-specific hook
  belongs in `src/`, `templates/` or `standard/`. Those live in `profiles/*.json`, or in
  `docs/choices/*.md` labelled as one person's worked example. `bun test` enforces this with a
  grep; do not defeat it by paraphrasing.
- **Never write outside a temp directory in a test.** `os.homedir()` is snapshotted by Bun at
  startup, so `src/lib/paths.ts` reads `$HOME` itself and the test preload redirects it. A test
  that reaches the real `~/.claude` has already done the damage by the time it fails.
- **Every question needs a long form.** `docs/choices/<readMore>.md` must exist, and must carry
  each option's defense, **the strongest argument against it**, what it writes, and how to undo
  it. A test checks presence and length; only a reader checks honesty.
- **Nothing is written without a stamp and a preview.** Everything goes through
  `planned()` in `src/render/context.ts` and `resolvePlan()` before `commitPlan()`. A renderer
  that writes a file directly bypasses the preview, the backup and the undo.
- **A generated file's placeholders must all be filled — except the two Part 0 owns.**
  `{{WORKTREE_SETUP}}` and `{{BUILD_CMD}}` are deliberately left; anything else left behind is
  a renderer that forgot a variable, and `fill()` leaves unknown tokens in place so `doctor`
  catches it.
- **Never run `git commit` or `git push`.** Print two blocks instead: `git add <exact files>` —
  never `-A`, never `.` — then `git commit <the same files> -m "<short, lowercase>"`, because
  naming paths implies `--only` and a bare commit takes the whole index. No attribution trailer.

## Stack

Bun 1.2.9 (build tool and test runner) · TypeScript 5.9.2 (`strict`, `noUncheckedIndexedAccess`) ·
`@clack/prompts` 1.8.1 · Biome 2.2.4 · `bun test`. The published bin is Node, not Bun:
`bun run build` compiles `src/cli.ts` into `dist/cli.js` (`#!/usr/bin/env node`), and Bun-only
APIs are deliberately kept out of `src/` so it runs under plain Node — see `src/lib/disk.ts`.

## Architecture

- **Questions are data, not control flow.** A `Question` is `{ id, phase, ask, options, readMore,
  configKey }`. Phases pick questions; a `Prompter` asks them. That split is the only reason any
  of this is testable — the harness has no TTY, so `defaultsPrompter()` answers from the merged
  config and `clackPrompter()` is only used against a real terminal.
- **Rendering is pure until the very end.** `renderAll()` returns `PlannedFile[]`; nothing
  touches the disk until `commitPlan()`.
- **A `PracticeArea` carries its question *and* what the answer renders into**, so the catalog
  cannot drift from the files it produces.
- **`doctor` rules are one file each** under `src/doctor/rules/`, each with a fixture test that
  violates it and one that passes.

## Directory map

| Path | Belongs here | Does not |
|---|---|---|
| `src/commands/` | One module per CLI subcommand (`setup`, `doctor`, `undo`, `archive`, `passoff`, `handoff`, `worktree`, `context`, `catalog`), each exporting a `run*()` that `src/cli.ts` dispatches to | Question text, rendering, the argument parser itself |
| `src/lib/` | Pure logic: config merge, paths, stamps, diff, write plan, discovery | Prompts, console output (except `ui.ts`) |
| `src/questions/` | Question definitions and the practices catalog | Rendering, file paths |
| `src/phases/` | The runner that asks a phase's questions | Question text |
| `src/render/` | One module per output family; returns `PlannedFile[]` | Disk writes |
| `src/doctor/` | One rule per file, plus the scanner | Anything that fixes by default |
| `templates/` | Document scaffolds carrying `{{TOKENS}}` | Answer-dependent prose — that is code |
| `standard/` | The canonical boilerplate, versioned. **Byte-for-byte except its version line** | Local edits |
| `docs/choices/` | One long form per question | Anything the wizard reads at runtime |
| `profiles/` | Default answers, including personal ones | Anything the engine imports directly |
| `examples/` | Filled, sanitized documents for a fictional repo. Tracked. | Real repo data |
| `tests/fixtures/` | **Generated** by `bun run fixtures`; git-ignored | Committed fixtures |

## Commands

```bash
bun run typecheck
```

```bash
bun run lint
```

```bash
bun test
```

```bash
bun run doctor . examples
```

```bash
bun run setup --profile starter --yes --dry-run --projects-dir tests/fixtures
```

**Gates that lie.** `bun test` needs `tests/fixtures/` to exist — `tests/make-fixtures.ts`
rebuilds it in `beforeAll`, so a bare `bun run fixtures` is only needed for the manual dry-run
above. `bun run lint` fails on *formatting* as well as lint findings; `bunx biome check --write`
fixes almost all of them, and from then on the config is the rule.

## Where work is written down

- `HANDOFF.md` — what is true here: environment, settled decisions, the code map, the step log.
  Read first. **Untracked** — this is personal process, not part of the public repo.
- `PASSOFF.md` — what is next, one standalone prompt per item. Untracked.
- `examples/` — the tracked, curated equivalents, for people reading the repo.

## Never do this

- Commit `tests/fixtures/` — they are generated, and a nested `.git` is an embedded repository
  git will not track.
- Edit `standard/AGENT-PRACTICES.boilerplate.md`'s content. Only its version header line is in
  scope, and changing anything else desynchronizes it from the version it claims to be.
- Add a test-only branch to `src/`. If something is untestable, that is a design finding.
- Write a conventions rule with an invented correct/incorrect pair and no provenance label —
  the labels exist to stop a later agent "correcting" a deliberate call.
