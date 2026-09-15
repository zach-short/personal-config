# Where closed work goes

## What this is

A directory outside the repo where finished documents land when their work is done, with an
`INDEX.md` mapping what is in there.

## The defense

An in-tree `docs/` folder that only grows is a folder nobody reads. Every session pays for it —
it is in the directory listing, it is in searches, and a closed design doc looks exactly like a
live one until you read the date. Moving closed work out and leaving one index line behind keeps
the repo's docs to the ones that are still true.

The index earns its keep on the way in, not on the way out: before a folder moves, you grep for
what still references it, and the difference between a path read at runtime and a bare citation
in prose is the difference between a broken build and a stale sentence.

## The strongest argument against it

It puts half your project's history in a directory that is not version-controlled with the
project, may not be backed up, and will not follow the repo to another machine or another
person. If the archive is lost, the index entries in the repo point at nothing. Keeping closed
work in-tree under `docs/archive/` is a real alternative — it costs listing noise and buys
durability.

## What it writes and where

`<archive home>/INDEX.md`, seeded with the legend and an empty Closed section. `<repo>` in the
path you give is replaced with each repo's name, so one answer covers every repo.

Write `none` to keep closed work in-tree; nothing is written and the standard's archive rules
are still there to follow when you want them.

## `doctor` checks it both ways

A folder in the archive with no index line is invisible, and an index line pointing at a folder
that is not there is worse than none. `personal-config doctor` reports both.

## How to undo it

Delete the `INDEX.md`. Nothing moves anything on its own — archiving is something you do.
