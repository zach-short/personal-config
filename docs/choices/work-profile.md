# How work arrives: a ledger and a board, or project folders

## What this is

Two shapes for writing work down. Pick by the *shape of the work*, not the size of the repo.

## The options

**A stream of mostly independent items — a ledger and a board.** *Recommended.*

`HANDOFF.md` is what is **true**: environment, settled decisions, a code map, invariants, and a
numbered append-only step log. `PASSOFF.md` is what is **next**: a table of items with status,
model, lane and "files it owns", plus one standalone prompt per item below it.

*The defense.* Most solo work looks like this — fix a flaky test, add an endpoint, bump a
dependency. Two files, no ceremony, and the step log gives every piece of work a permanent
address ("HANDOFF 24") that everything else can cite. The board's "files it owns" column is what
lets several sessions run at once without eating each other's work.

*The strongest argument against it.* It has nowhere to put a decision that needs ratifying
before code. A big effort with real design questions gets crammed into a board row and the
reasoning ends up in a chat log nobody can find.

**A few big efforts that each span many sessions — project folders.**

One folder per effort: `SCOPE.md` (options, no decisions) → **you ratify** → `DESIGN.md`
(decisions, frozen, amended never edited) → `PLAN.md` (phases, done-when, lanes) → **you
approve** → build → `RUNTIME-PASS.md` → archive.

*The defense.* It puts two explicit gates in front of code, and it separates *what and why*
from *in what order and done when*. For work that touches several subsystems, that separation
is the difference between a project and a long argument.

*The strongest argument against it.* It is a lot of ceremony for a two-hour task, and a folder
opened for something small tends to be abandoned half-written — which is worse than a board row,
because a half-written `DESIGN.md` looks authoritative.

They are not exclusive: a ledger repo opens a folder for the one effort that needs it.

## What it writes and where

**Asked only for code work on the whole method.** Non-code work and the lighter setup both get
a ledger whatever you answer here: the folder-per-effort shape is machinery their shorter
standard does not describe, and a `docs/incomplete/README.md` citing a part of a document that
does not exist is worse than not offering the choice. Asking would be asking to be ignored.

Ledger: `HANDOFF.md` and `PASSOFF.md` at the repo root. Folders: `docs/incomplete/README.md`
scaffolding the stages.

## How to undo it

Delete the files. They are documents, not configuration — nothing else depends on them existing.
