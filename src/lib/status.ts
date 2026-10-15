/**
 * §2.3's two closing words, read in one place because `board-status`, `unfolded`, `item-files`
 * and `fold` must agree on which rows are closed and which of those may fold.
 *
 * `DONE` and `COMMITTED` split one fact into two. The owner commits, so the session that built an
 * item cannot know its hash: it writes `DONE, <record>` before it posts the commit blocks, and
 * whoever later finds the commit in git writes `COMMITTED, <record>, <hash>`. Before 2026-10-15
 * agents left rows at `IN FLIGHT` until after the commit, waiting for a hash they could not have.
 *
 * The separator after the word is a comma, or the em dash the older rows carry, or a hyphen.
 */
const SEPARATOR = String.raw`\s*[,—-]\s*`;

/** A hash git would accept as a short or full commit name, and nothing hex-like after it. */
const HASH = '([0-9a-f]{7,40})(?![0-9a-z])';

const COMMITTED = new RegExp(`^COMMITTED${SEPARATOR}(.+?)\\s*,\\s*${HASH}\\s*(.*)$`);

/** Built, gates green, record written, and not yet in a commit. */
export function isDone(status: string): boolean {
  return status.startsWith('DONE');
}

/** The owner's commit exists. Only these rows fold. */
export function isCommitted(status: string): boolean {
  return status.startsWith('COMMITTED');
}

/** Either closing word: the work is built and its record is written. */
export function isClosed(status: string): boolean {
  return isDone(status) || isCommitted(status);
}

/**
 * The record a `DONE` cell points at, or null where the word has no separator after it. A cell
 * like `DONE 2026-10-13: P0 to P6` has none, so it is never read as `DONE, <date>`.
 */
export function doneRecord(status: string): string | null {
  return status.match(new RegExp(`^DONE${SEPARATOR}(.+)$`))?.[1]?.trim() ?? null;
}

/**
 * A `COMMITTED` cell's parts. `rest` is whatever follows the hash, which is where a row names
 * the worktree branch that holds a commit `main` does not have yet.
 */
export type CommittedCell = { record: string; hash: string; rest: string };

export function committedCell(status: string): CommittedCell | null {
  const match = status.match(COMMITTED);
  if (!match) return null;
  const [, record = '', hash = '', rest = ''] = match;
  return { record: record.trim(), hash, rest: rest.trim() };
}

/**
 * Whether a closed row may leave the live board, the one answer `fold` and `unfolded` must share.
 *
 * Where git holds the work, only `COMMITTED`: a `DONE` item's file is the only way to rebuild it
 * until the owner's commit exists. Where no `.git` sits at or above the root, no commit will ever
 * exist, so `DONE` is final and that reason is gone (standard 2.1.1). Without this a folder's
 * rows stop at `DONE` and its board grows without limit, which is the cost §2.1 exists to stop.
 */
export function isFoldable(status: string, git: boolean): boolean {
  return isCommitted(status) || (!git && isDone(status));
}
