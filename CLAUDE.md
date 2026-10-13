# personal-config

> **Code:** `docs/conventions-ts.md` answers how TypeScript is written here (rule IDs F1 to S1).
> Open it before you write or edit a `.ts` file.

> **Process:** `standard/AGENT-PRACTICES.boilerplate.md` answers how a feature is scoped, planned,
> built and closed. Open it by heading when you scope a feature (Part 2 where work is written,
> Part 5 context budget, Part 7 closing). It is the standard this repo ships to other repos.

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

## Commands

```bash
bun run typecheck && bun run lint && bun test && bun run doctor . examples
```

`bun run lint` fails on formatting too; `bunx biome check --write` fixes most of it.
`tests/make-fixtures.ts` rebuilds `tests/fixtures/` in `beforeAll`.

## Where work is written down

- `HANDOFF.md` (untracked) answers what is true: settled decisions, the code map, the step log.
  Search it for the topic at hand.
- `PASSOFF.md` (untracked) answers what is next, one standalone prompt per item.
- `examples/` holds the tracked, sanitized equivalents.

## Never do this

- Commit `tests/fixtures/`, or edit the standard's content (only its version line is in scope).
- Add a test-only branch to `src/`. If something is untestable, that is a design finding.
- Write a conventions rule with an invented correct/incorrect pair and no provenance label.
