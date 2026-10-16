# personal-config

> **Code:** `docs/conventions-ts.md` answers how TypeScript is written here (rule IDs F1 to S1).
> Open it before you write or edit a `.ts` file.

> **Process:** `standard/AGENT-PRACTICES.boilerplate.md` answers how a feature is scoped, planned,
> built and closed. Open it by heading when you scope a feature (Part 2 where work is written,
> Part 5 context budget, Part 7 closing). It is the standard this repo ships to other repos.
> Where `docs/AGENT-PRACTICES.md` exists, it is the copy adapted to this repo (untracked, so a
> clone or a worktree has only the boilerplate); it wins where the two differ.

A Bun + TypeScript CLI that asks a person how they work and writes the matching documents into
their repos. **Other people clone and run it**, most of whom have never seen a ledger or a board.

## The rules that get broken

- **Zero personal strings in `src/`, `templates/` or `standard/`.** No name, no `~/Projects`, no
  machine-specific hook. Those live in `profiles/*.json` or labelled worked examples in
  `docs/choices/`. `bun test` greps for it; do not defeat it by paraphrasing.
- **Never write outside a temp directory in a test.** `src/lib/paths.ts` reads `$HOME` itself
  (Bun snapshots `os.homedir()`), and `tests/preload.ts` redirects it.
- **Every question needs a long form** at `docs/choices/<readMore>.md`: each option's defense,
  the strongest argument against it, what it writes, and how to undo it.
- **Nothing is written without a stamp and a preview:** `planned()` in `src/render/context.ts`,
  then `resolvePlan()`, then `commitPlan()`. A direct write skips preview, backup and undo.
- **Every placeholder in a generated file is filled**, except `{{WORKTREE_SETUP}}` and
  `{{BUILD_CMD}}`, which Part 0 owns. `fill()` leaves unknown tokens so `doctor` catches them.
- **Never run `git commit` or `git push`.** Print two blocks instead: `git add <exact files>`
  (never `-A`, never `.`), then `git commit <the same files> -m "<short, lowercase>"`, because
  naming paths implies `--only` and a bare commit takes the whole index. No attribution trailer.

## Stack and shape

Bun 1.2.9 · TypeScript 7.0.2 (`strict`, `noUncheckedIndexedAccess`) · `@clack/prompts` 1.8.1 ·
Biome 2.5.14. The published bin is Node: `bun run build` makes `dist/cli.js`, so no Bun-only API
goes in `src/` (see `src/lib/disk.ts`). Questions are data and a `Prompter` asks them;
`renderAll()` returns `PlannedFile[]` and touches no disk; `doctor` rules are one file each under
`src/doctor/rules/`, each with a violating and a passing fixture test. `src/commands/` holds one
module per subcommand, `src/lib/` pure logic, `src/render/` one module per output family.
`standard/` is byte-for-byte except its version line. `tests/fixtures/` is generated and ignored.

## Directory map

| Path | Belongs here | Does not |
|---|---|---|
| `src/commands/` | One module per subcommand | Logic another command needs; that goes in `src/lib/` |
| `src/lib/` | Pure logic: no prompts, no writes outside `disk.ts` | Printing, except `ui.ts` |
| `src/render/` | One module per output family, each returning `PlannedFile[]` | Any disk write |
| `src/doctor/rules/` | One rule per file, each with a violating and a passing fixture test | A rule with no test |
| `src/questions/` | The questions, as data | Rendering |
| `standard/` | The shipped standard, byte for byte except its version line | Edits to its content |
| `templates/` | Scaffolds carrying `{{TOKENS}}`, hooks, skills | Personal strings |
| `docs/choices/` | One long form per question's `readMore` | Anything not tied to a question |
| `docs/incomplete/` | One folder per effort in flight (`SCOPE.md` to `RUNTIME-PASS.md`) | Closed efforts; they move to the archive |
| `examples/` | Tracked, sanitized ledger, board and archive for a fictional repo | Real entries |
| `profiles/` | `starter.json` (neutral) and named profiles | Engine logic |
| `tests/` | One suite per area; `tests/fixtures/` is generated and ignored | Writes outside a temp directory |

## Commands

Install with `bun install --frozen-lockfile`. Each gate below was run on 2026-10-16 at `a589d4c`:

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
bun run build
```

Together, before handing work back:

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

`bun run lint` fails on formatting too; `bunx biome check --write` fixes most of it.
`tests/make-fixtures.ts` rebuilds `tests/fixtures/` in `beforeAll`. `.personal-config.json`'s
`gateCommand`, which the completion-gate hook runs on every stop, is the same line without
`doctor .` (see the first lie below).

**Gates that lie.** Each was seen on 2026-10-16.

- **`doctor .` checks more files in the main checkout than anywhere else.** `HANDOFF.md`,
  `PASSOFF.md`, `passoff/`, `.personal-config.json` and `docs/AGENT-PRACTICES.md` are
  untracked, so a worktree, a fresh clone and CI never see them. The main checkout reported 16
  findings; a `git archive HEAD` copy and CI run `38920504583` reported 3. Run `doctor` in the
  main checkout before you call it green.
- **`bun test` green on macOS is not green on Linux.** `tests/fold-migrate-ranges.test.ts:193`
  expects `readdir` order; it passed locally and failed on CI's `ubuntu-latest`. CI's Linux job
  is the proof for anything that lists a directory.
- **`bun run lint` exits 0 on warnings.** Biome's recommended rules include warning-level ones;
  a probe with an unused import and an unused variable gave `Found 2 warnings`, exit 0. Those
  two are caught by `typecheck` (`noUnusedLocals`); other warning-level rules are caught by
  nothing. Read the output, not the exit code.
- **`doctor`'s `placeholders` rule cannot see a fenced block.** It reads prose lines only
  (`src/doctor/rules/placeholders.ts:16`), and Part 6's two tokens live in fences. Check an
  adapted standard with `grep -nE '\{\{' <file>`.
- **CI's `boilerplate-version` job passes when it has nothing to compare.** With no base
  commit, the first push of a branch, it prints `skipping` and exits 0
  (`.github/workflows/ci.yml`).
- **The completion gate runs nothing in a worktree.** It reads `gateCommand` from
  `.personal-config.json` in the working directory, and a worktree has no such file.

**What an agent cannot verify here.** The interactive wizard: the harness has no TTY, so clack
prompts cannot be driven. Use `--profile <name> --yes` or `--dry-run`, and give the owner the
exact command and what should appear.

**Merged is not shipped.** A merge to `main` runs CI and nothing else. The package reaches npm
only through a "Cut 0.x.y" board item that bumps `package.json`, `CHANGELOG.md` and
`catalog.json`, then a publish the owner runs (`npm view` gave `0.8.0` as the latest
release on 2026-10-16). The portfolio site pins a version and deploys separately.

## Where work is written down

- `HANDOFF.md` (untracked) answers what is true: settled decisions, the code map, the step log.
  Search it for the topic at hand.
- `PASSOFF.md` (untracked) answers what is next, one standalone prompt per item.
- `examples/` holds the tracked, sanitized equivalents.

## Never do this

- Commit `tests/fixtures/`, or edit the standard's content (only its version line is in scope).
- Add a test-only branch to `src/`. If something is untestable, that is a design finding.
- Create `HANDOFF.md` or `PASSOFF.md` in a worktree. Return the text to the owner instead.
- Run `setup` against this checkout without `--dry-run` first. It rewrites `.personal-config.json`.
- Write a conventions rule with an invented correct/incorrect pair and no provenance label.
