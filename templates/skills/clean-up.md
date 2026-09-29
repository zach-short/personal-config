---
name: clean-up
description: Sweep finished work out of the live documents and into the archive — {{WHAT_MOVES}} — then repair everything that pointed at it. Use when doctor reports `unfolded`, after several items have closed, or when the user says "clean up", "tidy the board", "archive what's done", or "fold the handoff".
---

# /clean-up

The live documents are read in full at the start of every session, so finished work left in
them is a cost every session pays, not an untidiness. This skill decides what is finished, hands
the moving to the commands that already do it safely, and repairs what pointed at what moved.
**Do not move by hand what a command moves.** The commands append to the archive and read it
back before they cut — the only safe order for a document git may not be holding a copy of.

## 1 — Find what is finished

Run `personal-config doctor .` and read every finding before touching anything.

{{FINISHED}}

**Report, never mark.** Something that looks finished but is not marked so, or a `DONE` whose
pointer resolves to nothing, goes back to the owner with its evidence — the commit, the step,
the date — and stays as it is. Marking work done is a claim about the work, and only the session
that did it, or the owner, makes it. Carry on with what is already marked.

## 2 — Preview, ask, then move

Every command below runs with `--dry-run` first. **Without a terminal they write without
asking**, so the preview is the only confirmation there is: post it, say in one line what will
move and what will stay, and wait for a yes in chat.

{{MOVE_STEPS}}

## 3 — Repair what pointed at it

Grep for each moved name {{GREP_WHERE}}. A command's referrer report reads tracked files only,
and a document kept out of git is invisible to it.

- **Live text** — {{LIVE_TEXT}}, the router file, the docs index, a memory entry — is repointed
  at the archive location, or cut where it no longer governs anything.
- **Historical text** — {{HISTORICAL_TEXT}} — stays as written. It records what was true when
  it was written, and **a record you did not write is not yours to edit.**
- **A rule the moved doc leaves behind that still governs the work** moves to "Standing rules
  that outlived their doc". A rule nobody can find is a rule nobody follows.

Then run `personal-config doctor . <archive home>` — the archive as a second root, so it can see
what now lives there — and account for every finding left.

## 4 — Hand back

One short report: what moved and where, and how many lines each live document lost; what was
left for the owner and why — unmarked work, broken pointers, a blocked move.{{COMMIT_CLAUSE}}
