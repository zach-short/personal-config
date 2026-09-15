# Where items and decisions are visible to the team

## What this is

Asked only in team mode. The place where an item lives when it is not a row in a file — GitHub
Issues, a Linear project, a Jira board.

## Why it is asked

In a team, three things change address and all of them need a name for it:

- **A question goes to the decider on the item**, not into a doc and not into a direct message.
  The work stops there until it is answered. A question written into a document for async review
  does not get answered.
- **The board becomes the tracker.** One item per task, carrying the prompt's title, its product
  reason, its fixed facts and its non-scope list. Lane is a label; "files it owns", "waits on"
  and "decider" are fields.
- **The hand-back's three blocks land on items** — the next prompt into the next item, the
  runtime entries onto this one, the model in the next item's header.

The ledger does **not** move. It stays a file in the repo, and a pull request links to its step
rather than replacing it.

## The strongest argument against naming one

If your team genuinely runs off files in the repo, naming a tracker you do not use writes a
reference that will rot. `none` is a legitimate answer, and the standard says so: an empty slot
is information, a token left in place is a bug.

## What it writes and where

Fills `{{TRACKER}}` throughout the standard copy's Part 12.

## How to undo it

Edit the standard copy, or re-run `setup`.
