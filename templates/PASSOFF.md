# PASSOFF — {{PROJECT_NAME}} (the board)

**What is next.** One row per item, one standalone prompt per item below the board. What is
true lives in `{{LEDGER_FILE}}`. **Check "Files it owns" against every open item before
starting one** — two items naming the same file never run at the same time, whatever their
lanes say.

Status vocabulary, and no other words: `OPEN` · `IN FLIGHT` · `DONE — HANDOFF n` · `HELD` ·
`SETTLED AS NO` · `SUPERSEDED`. `DONE` always points at the ledger step that is the real
record. `HELD` always names what it waits on. `SUPERSEDED` always names what replaced it.
`SETTLED AS NO` always carries its reason, because its whole job is to not be re-proposed.

Lanes run in parallel, each in its own worktree; items inside a lane run in order.

| # | Task | Status | Model | Lane | Waits on | Files it owns |
|---|------|--------|-------|------|----------|---------------|
| 1 | <!-- first task --> | `OPEN` | {{MODEL_DEFAULT}} | A | — | — |

---

### 1. <!-- Imperative title, naming the change, not the area -->

*Opened {{DATE}}, out of <!-- what prompted this -->.*

**Model: {{MODEL_DEFAULT}}. Lane A. Waits on nothing.**

<!-- A standalone prompt. The next agent will not see the conversation that produced this, so
     it carries everything: who they are picking up and what to read first; the session rules
     restated inline, not by reference; why this exists in product terms; what is fixed and
     must not be relitigated, with citations; the numbered steps, each with its reason; what to
     ask before building; what is out of scope whoever asks; and what to hand back — the
     literal gate commands, what the owner should see, and the commit step. -->

**Do not paste a prompt marked DONE** — a fresh session would build it again.
