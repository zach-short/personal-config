# Contributing

## Setup

[Bun](https://bun.sh) 1.2.9 or newer. There is no build step for development — Bun runs
`src/cli.ts` directly.

```bash
git clone https://github.com/zach-short/personal-config
cd personal-config
bun install
```

## The gates

Every change has to pass all four before it is done. CI runs the same four, on Linux and macOS.

```bash
bun run typecheck
bun run lint
bun test
bun run doctor . examples
```

`bun test` needs `tests/fixtures/`, which `tests/make-fixtures.ts` rebuilds automatically in
`beforeAll` — a bare `bun run fixtures` is only needed if you want to inspect the fixture tree
by hand. `bun run lint` fails on formatting as well as lint findings;
`bunx biome check --write` fixes almost all of it.

## Where the rules are written down

This repo's own conventions — what belongs in `src/` versus `profiles/`, how a `doctor` rule is
structured, what a renderer may and may not do — are in [`CLAUDE.md`](CLAUDE.md) and
[`docs/conventions-ts.md`](docs/conventions-ts.md). Read them before sending a change; they are
the actual review standard, not a formality.

## Pull requests

Keep a PR to one concern. Add or update a test with any behavior change — this repo has none
that are untested by design (see `CLAUDE.md`: "Never do this"). Describe *why*, not just *what*;
the diff already shows what changed.
