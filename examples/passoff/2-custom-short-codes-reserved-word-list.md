# 2. Custom short codes, with a reserved-word list

*Opened 2026-09-10, out of the owner wanting `leaflet.sh/docs` to be theirs to set.*

**Model: Default. Lane B. Waits on nothing.** Lane A has item 1 in the primary checkout, so
take a worktree: `git worktree add .claude/worktrees/item-2 main`, then `bun install --cwd web`
inside it before believing any gate.

You are picking up leaflet, a Go + TypeScript link shortener. Read `HANDOFF.md` first — the
gates, the invariants and the code map are there; do not re-derive them — then
`docs/AGENT-PRACTICES.md` in full, then `internal/shortcode/` and `web/app/new/`.

Session rules, inline: absolute dates only. Every claim carries a `file:line` or the command
that produced it. Grep before recording an absence. Ask the owner in chat, in one batch, in the
same turn, before building anything that depends on an answer. Never run `git commit` or
`git push` — print the two blocks instead.

**Why this exists.** Every code is random, which is right for links nobody has to remember — but
the owner wants `leaflet.sh/docs` and `leaflet.sh/hiring` to be theirs to set. A custom code is a
small feature with one sharp edge: a user who claims `api`, `admin` or `login` has taken a path
the app may need later, and a code printed on a flyer cannot be reassigned.

**What is fixed.** Read these before changing anything; do not relitigate them.

- **Random codes are the default and stay the default** — settled 2026-08-30, `HANDOFF.md`. A
  custom code is opt-in on the new-link form, never inferred.
- **Codes are 7 characters from a 58-character alphabet** (`internal/shortcode/generate.go:31`).
  A custom code may be longer, never shorter than 4, and only from the same alphabet.
- **The redirect path makes exactly one database read** (`internal/redirect/handler.go:44`).
  Custom codes live in the same column and the same index, so it stays one.
- **`web/lib/api.ts` is the only typed client.** The form talks to the API through it and
  nowhere else.

Do these, in order:

1. **Write the reserved list as data, not code.** One file, `internal/shortcode/reserved.go`,
   holding the words with a one-line reason each; the check reads the list. Seed it from the
   routes the API and the dashboard already serve (`grep -rn HandleFunc cmd/` and `ls web/app/`),
   so a live path can never be claimed.
2. **Validate in one place.** `internal/shortcode/` gains `ValidateCustom(code string) error`,
   and both the API handler and the form call it — the form for a fast message, the API because
   the form is not the only client.
3. **The form.** One optional field on `web/app/new/`, with loading, error and empty states
   through the shared component (`docs/conventions-typescript.md`, `D2`). The three messages it
   can show are the owner's to word (below).
4. **Record it.** Write this file's close-out section, add one log line to `HANDOFF.md`, and mark
   the row `DONE - <date>`. Name what changed, why, and what is now fixed. Add `reserved.go` to the
   code map.

**Ask before building:** the three messages a user sees when a code is taken, reserved, or
malformed — offer plain, warm and terse variants of each rather than picking. And whether the
owner may claim a reserved word themselves, which is a real question: `docs` is reserved
precisely so that the owner can have it.

**Not in scope, whoever asks:** editing a code after creation; anything in `internal/redirect/`;
the click sweep (item 1, Lane A).

**Hand back:** `go build ./...`, `go test -race ./...`, `golangci-lint run` and
`bun run --cwd web typecheck`, all green, with output quoted — and the web test count, not its
exit code (`HANDOFF.md`, gates that lie). A runtime entry: open `/new`, submit the code `docs`,
and say what the form showed. Then `git status --short` and the two commit blocks.
