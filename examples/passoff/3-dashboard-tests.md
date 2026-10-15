# 3. Dashboard tests

*Opened 2026-09-08, out of item 6: the web test glob had been passing having run nothing.*

**Model: Mechanical. Lane B. Waits on item 2**, which changes the new-link form this would test.
`HELD` until item 2 is `DONE` — writing these first means writing them twice. Same worktree as
item 2 once it lands, or a fresh one from `main`.

You are picking up leaflet, a Go + TypeScript link shortener. Read `HANDOFF.md` first — the
gates are there, and the web test gate is the one that lied — then `docs/AGENT-PRACTICES.md` in
full, then `docs/conventions-typescript.md`, then `web/app/`.

Session rules, inline: absolute dates only. Every claim carries a `file:line` or the command
that produced it. Grep before recording an absence. Never run `git commit` or `git push` — print
the two blocks instead. This is Mechanical-tier work: if a test fails for a reason you cannot
name in one sentence, stop and hand back rather than debugging into it.

**Why this exists.** From 2026-09-02 to 2026-09-08 the web test command exited 0 having run
nothing (item 6, closed and in the archive). Fixing the glob turned up two real failures in the
shared lib and showed that the dashboard screens themselves have no tests — every one is checked by a
person opening it.

**What is fixed.** Read these before changing anything; do not relitigate them.

- **Tests are pure logic in a new file named for the feature** (`docs/conventions-typescript.md`,
  `X1`). No existing test file is appended to; each screen gets its own.
- **Every screen renders loading, error and empty through one component** (`D2`). That contract
  is what to test, not the pixels.
- **`web/lib/api.ts` is the only typed client**, so it is the only thing to mock.

Do these, in order:

1. **List the screens first**, with the states each can be in, as a table in your notes. That
   table is the work-list, and it is what you report against.
2. **One file per screen**, `web/app/<screen>/<screen>.test.tsx`, asserting the three states and
   the one happy path. Mock the client, never the network.
3. **Prove the gate sees them.** Run `bun run --cwd web test` and quote the test count; a count
   that did not go up means the glob still misses them.
4. **Record it.** Write this file's close-out section, add one log line to `HANDOFF.md`, and mark
   the row `DONE - <date>`. Close the "dashboard has no tests" gap that item 6 left owed.

**Ask before building:** nothing — the shape is settled by the conventions file. If a screen does
not fit the shared states component, stop and raise it; do not test around it.

**Not in scope, whoever asks:** fixing what the tests find — each finding becomes a new board
item with its citation; changing `web/lib/api.ts`; visual or snapshot testing.

**Hand back:** `bun run --cwd web typecheck` and `bun run --cwd web test`, green, with the test
count quoted before and after. No runtime entry — nothing here is user-visible. Then
`git status --short` and the two commit blocks.
